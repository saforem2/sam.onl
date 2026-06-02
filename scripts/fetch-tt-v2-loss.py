"""
Pull AuroraGPT-2B v2 production training-loss chains from W&B and save
deduped parquets that the slide plot can read offline.

Each chain is a sequence of chronologically-ordered runs that share a
checkpoint dir (e.g. `…-n512-gbs12288`). Each successor resumes from
the previous run's last ckpt; without dedup, overlapping steps near
each chain boundary appear twice in the union.

We sort by `_step` and drop duplicates by `_step`, keeping the first
occurrence — that gives the canonical loss-at-this-step value (later
resumes report the same value at the same step).

Outputs under `web/public/talks/2026-06-03/data/`:
  tt-v2-512n-loss.parquet
  tt-v2-256n-loss.parquet

Each with columns: step (int), loss (float), run_id, run_state.

Auth: relies on credentials in ~/.netrc (where you already have them).
"""

from pathlib import Path

import pandas as pd
import wandb

PROJECT = "aurora_gpt/torchtitan.ezpz.train"
METRIC = "loss_metrics/global_avg_loss"
STEP_KEY = "_step"

# Each chain = (output file, ckpt folder filter). The 256N v1 chain
# (gbs3072) is the bf16-broken run — not listed here; we keep the
# eval-slide v1 series for that story.
CHAINS = [
    (
        "tt-v2-512n-loss.parquet",
        "checkpoints/agpt-2b-sophiag-olmo-mix-1124-n512-gbs12288",
    ),
    (
        "tt-v2-256n-loss.parquet",
        "checkpoints/agpt-2b-sophiag-olmo-mix-1124-n256-gbs6144",
    ),
]

OUT_DIR = Path.home() / "projects/saforem2/sam.onl/web/public/talks/2026-06-03/data"


# Runs to exclude regardless of config — sometimes a particular run is
# tainted by a known issue not captured in config (e.g. dataloader
# misconfig, hand-edited optimizer state) and the only safe selector
# is the run name itself. `likely-sunset-1667` is one such — kept here
# even though it isn't in the canonical 512N/256N chains today, so the
# filter survives any future regeneration that picks it up.
NAME_BLACKLIST = {"likely-sunset-1667"}

# Canonical training config we want to plot. Filters guard against
# accidental contamination from forks (LR=3.22e-5 sweep) or LBS=1
# debug runs that share a ckpt dir.
CANONICAL_LR = 2.28e-5
CANONICAL_LBS = 2
LR_TOL = 1e-7

# W&B's `config.checkpoint.folder` is the *relative* path
# (`checkpoints/agpt-2b-...`), so pre-cutover experiments and the
# post-cutover v2 production chains *look* like the same chain even
# though they wrote to entirely different on-disk roots. We
# disambiguate with `training.dtype`: v1 (broken) used bf16, v2
# (canonical) uses fp32. Same key flips for 20B / 80B v1-vs-v2 too,
# so this generalises if the script grows more chains.
CANONICAL_DTYPE = "float32"


def _is_canonical(run) -> tuple[bool, str]:
    """Return (keep, reason). reason explains the rejection if any."""
    cfg = run.config
    lbs = cfg.get("training", {}).get("local_batch_size")
    lr = cfg.get("optimizer", {}).get("lr")
    dtype = cfg.get("training", {}).get("dtype")
    if run.name in NAME_BLACKLIST:
        return False, f"name blacklisted ({run.name})"
    if lbs != CANONICAL_LBS:
        return False, f"LBS={lbs} (want {CANONICAL_LBS})"
    if lr is None or abs(lr - CANONICAL_LR) > LR_TOL:
        return False, f"LR={lr} (want {CANONICAL_LR})"
    if dtype != CANONICAL_DTYPE:
        return False, f"dtype={dtype} (want {CANONICAL_DTYPE} — v1 bf16 runs are broken)"
    return True, "ok"


def fetch_chain(api: wandb.Api, ckpt_folder: str) -> pd.DataFrame:
    runs = api.runs(PROJECT, filters={"config.checkpoint.folder": ckpt_folder})
    print(f"found {len(runs)} chain candidates under {ckpt_folder}")
    frames = []
    for r in runs:
        keep, reason = _is_canonical(r)
        if not keep:
            print(f"  skip {r.id:>9s} state={r.state:<10s} ({reason})")
            continue
        if not r.summary.get(STEP_KEY):
            print(f"  skip {r.id:>9s} state={r.state:<10s} (no steps)")
            continue
        history = r.scan_history(keys=[STEP_KEY, METRIC])
        rows = [(h[STEP_KEY], h[METRIC]) for h in history if METRIC in h]
        if not rows:
            print(f"  skip {r.id:>9s} state={r.state:<10s} (no loss rows)")
            continue
        df = pd.DataFrame(rows, columns=["step", "loss"])
        df["run_id"] = r.id
        df["run_state"] = r.state
        print(f"  load {r.id:>9s} state={r.state:<10s} "
              f"rows={len(df):>5d}  step_range=[{df.step.min()}, {df.step.max()}]")
        frames.append(df)
    if not frames:
        return pd.DataFrame(columns=["step", "loss", "run_id", "run_state"])

    union = pd.concat(frames, ignore_index=True)
    # Dedup by step: when multiple runs report the same step, keep the
    # row from the run with the most logged steps overall. Crashed
    # restart attempts that wrote 1-2 bogus rows (loss not yet
    # converged back to checkpoint) would otherwise clobber the
    # canonical multi-thousand-row run at that step. Sorting by
    # ascending run length puts the canonical run *last*, so
    # `keep="last"` selects it.
    counts = union.groupby("run_id").size()
    union["__run_rows"] = union["run_id"].map(counts)
    union = (
        union.sort_values(["step", "__run_rows"])
        .drop_duplicates(subset=["step"], keep="last")
        .drop(columns=["__run_rows"])
        .sort_values("step")
        .reset_index(drop=True)
    )
    return union


def main():
    api = wandb.Api()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, ckpt_folder in CHAINS:
        print(f"\n=== {filename} ===")
        df = fetch_chain(api, ckpt_folder)
        if df.empty:
            print("  (no data — skipping write)")
            continue
        out = OUT_DIR / filename
        df.to_parquet(out, index=False)
        print(
            f"wrote {out.name}  rows={len(df):,}  "
            f"steps={df.step.min():,}→{df.step.max():,}  "
            f"loss={df.loss.max():.3f}→{df.loss.min():.3f}  "
            f"size={out.stat().st_size // 1024} KB"
        )


if __name__ == "__main__":
    main()
