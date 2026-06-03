"""
Pull AuroraGPT LR-finder sweep data from W&B (Sunspot, Intel Max 1550,
2 nodes / 24 XPUs).

Each LR-finder run sweeps LR exponentially within a single W&B run —
~100 (lr, loss) samples per run, covering ~1.5 decades of LR. The
docs at torchtitan/experiments/ezpz/docs/experiments/lr-finder/README.md
describe Sunspot sweeps for AuroraGPT 2B / 20B / 80B × {AdamW, Muon,
SophiaG}, dated 2026-04-12 → 2026-04-22.

Filter conventions (verified by probing the W&B project):
  - project: aurora_gpt/torchtitan.ezpz.train
  - config.hostname matches /sunspot/
  - config.training.steps == 1000  (the canonical sweep length; the
    short steps=20 runs are pre-flight smoke tests)
  - config.optimizer.name ∈ {AdamW, Muon, SophiaG}
  - config.model_spec.name == 'ezpz.agpt'
  - config.model_spec.flavor ∈ {'2b', '20b', '80B', ...}

For each (flavor, optimizer) group we pick the canonical run as:
  - state == 'finished' AND
  - most recent createdAt  (latest = closest to the README's reported numbers)

Per-run history columns we keep:
  step, lr, loss

Outputs under web/public/talks/2026-06-03/data/lr-finder/:
  sunspot__2b__adamw.parquet
  sunspot__2b__muon.parquet
  sunspot__2b__sophiag.parquet
  sunspot__20b__adamw.parquet
  ... etc.
"""

from collections import defaultdict
from pathlib import Path

import pandas as pd
import wandb

PROJECT = 'aurora_gpt/torchtitan.ezpz.train'
DATE_START = '2026-04-01T00:00:00'
DATE_END   = '2026-05-01T00:00:00'
HOSTNAME_REGEX = 'sunspot'
CANONICAL_STEPS = 1000

OPTIMIZERS = ('AdamW', 'Muon', 'SophiaG')
# 2B only for the talk slide. 20B / 80B sweeps exist in W&B but the
# story we need on the slide is "here's how we picked the SophiaG LR
# for the 2B production run" — adding extra model sizes dilutes that.
FLAVORS = ('2b',)

OUT_DIR = (
    Path.home()
    / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/lr-finder'
)


def _is_lr_finder_history(df: pd.DataFrame) -> bool:
    """True iff this run's history looks like an LR sweep, not a
    training run with warmup+decay. Both shapes share training.steps=
    1000; only the history can tell them apart.

    Two requirements:
      (1) LR is non-decreasing across ≥90% of consecutive pairs
          (rules out warmup+decay schedules, which decrease).
      (2) Distinct LR values cover ≥50% of the row count
          (rules out training runs that hold a constant LR after
          warmup — those satisfy (1) trivially)."""
    if len(df) < 20:
        return False
    lr = df['lr'].to_numpy()
    monotone = (lr[1:] >= lr[:-1]).sum() / max(1, len(lr) - 1)
    if monotone < 0.9:
        return False
    distinct_frac = pd.Series(lr).nunique() / len(lr)
    return distinct_frac >= 0.5


def _canonical_run(runs, api):
    """Pick the canonical LR-finder run for a (flavor, opt) group.

    Both LR-finder runs and full training runs share training.steps=
    1000. We must inspect each candidate's history to distinguish them —
    finder runs have monotonically-increasing `lr`; training runs have
    warmup+decay. Among runs whose history matches the sweep shape,
    prefer finished > crashed, then most recent (closer to the README
    publish date)."""
    # Probe each candidate's history (cheap — ≤1000 rows).
    classified = []
    for r in runs:
        try:
            df = _scan_run(r)
        except Exception:
            continue
        if df.empty or not _is_lr_finder_history(df):
            continue
        classified.append((r, df))
    if not classified:
        return None, None
    finished = [(r, df) for r, df in classified if r.state == 'finished']
    pool = finished or classified
    r, df = max(pool, key=lambda pair: pair[0].created_at)
    return r, df


def _scan_run(r):
    """Pull (step, lr, loss) rows from one LR-finder run.

    The history is small (≤1000 rows) so a plain scan_history is fine —
    no need for the keys=[] inner-join trick we use in fetch-tt-v2-loss.
    """
    rows = []
    for h in r.scan_history(keys=['_step', 'lr', 'loss_metrics/global_avg_loss']):
        step = h.get('_step')
        lr = h.get('lr')
        loss = h.get('loss_metrics/global_avg_loss')
        rows.append((step, lr, loss))
    df = pd.DataFrame(rows, columns=['step', 'lr', 'loss'])
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    # Drop rows missing the essential pair
    df = df.dropna(subset=['lr', 'loss']).reset_index(drop=True)
    return df


def main():
    api = wandb.Api()
    print(f'Fetching LR-finder runs from {PROJECT} '
          f'({DATE_START[:10]} → {DATE_END[:10]}, sunspot, steps={CANONICAL_STEPS})')
    runs = api.runs(
        PROJECT,
        filters={
            'createdAt': {'$gte': DATE_START, '$lt': DATE_END},
            'config.hostname': {'$regex': HOSTNAME_REGEX},
            'config.optimizer.name': {'$in': list(OPTIMIZERS)},
            'config.training.steps': CANONICAL_STEPS,
        },
        per_page=200,
    )

    # Group by (flavor, optimizer)
    grouped = defaultdict(list)
    for r in runs:
        spec = r.config.get('model_spec') or {}
        flavor = spec.get('flavor', '?')
        opt = (r.config.get('optimizer') or {}).get('name')
        if flavor not in FLAVORS or opt not in OPTIMIZERS:
            continue
        grouped[(flavor, opt)].append(r)

    print(f'\nGrouped candidates:')
    for key in sorted(grouped):
        print(f'  {key}: {len(grouped[key])} runs')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f'\nWriting parquets to {OUT_DIR}')
    for flavor in FLAVORS:
        for opt in OPTIMIZERS:
            key = (flavor, opt)
            candidates = grouped.get(key, [])
            r, df = _canonical_run(candidates, api)
            out_path = OUT_DIR / f'sunspot__{flavor.lower()}__{opt.lower()}.parquet'
            if r is None or df is None:
                print(f'  {key}: no LR-finder shaped run found in '
                      f'{len(candidates)} candidates — skipping')
                continue
            # Drop the constant-LR warmup prefix (lr_finder.py optionally
            # holds at init_lr for `warmup` steps before the exponential
            # sweep starts). Detect warmup as a run of identical-LR
            # rows at the start.
            first_lr = df['lr'].iloc[0]
            warmup_n = (df['lr'] == first_lr).cumprod().sum()
            if warmup_n > 1:
                df = df.iloc[int(warmup_n) - 1:].reset_index(drop=True)
            df.to_parquet(out_path, index=False)
            n_nan = int(df['loss'].isna().sum())
            print(f'  {key}: {r.id}  ({r.state})  rows={len(df)}  '
                  f'lr=[{df["lr"].min():.1e}, {df["lr"].max():.1e}]  '
                  f'nan_loss={n_nan}  → {out_path.name}')


if __name__ == '__main__':
    main()
