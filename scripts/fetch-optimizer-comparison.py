"""
Pull AuroraGPT-2B large-batch optimizer-comparison data from W&B.

Replicates the chart at https://api.wandb.ai/links/aurora_gpt/giy3swff
which compares {AdamW, ipex.FusedLamb, MuonClip, SophiaG, Muon} at
GBS=6,144 (50M tokens / batch, 8192 ctx, LBS=2) on 256 Aurora nodes.

Each optimizer was run as a CHAIN of restart-resumes (each subsequent
run picks up from the previous checkpoint), so we:

  1. List every run in `aurora_gpt/AuroraGPT` whose `config.outdir`
     points at the optimizer-experiments tree on flare.
  2. Group runs by `config.args.optimizer`.
  3. For each optimizer, scan_history() each run (NO key filter — that
     truncates rows to the inner-join cadence and silently drops
     ~6x the data) and concatenate.
  4. Dedup by _step keeping the row from the run with the most steps
     (the canonical resume), so chain handoffs don't double-count.

Outputs under `web/public/talks/2026-06-03/data/optimizer-comparison/`:
  adamw.parquet  lamb.parquet  muonclip.parquet  sophiag.parquet  muon.parquet

Each parquet has columns:
  step (int)       # _step
  tokens (float)   # training/consumed_tokens
  loss (float)     # loss/lm loss   (note: space, not underscore)
  grad_norm (float)

Auth: ~/.netrc.
"""

from collections import defaultdict
from pathlib import Path

import pandas as pd
import wandb

PROJECT = "aurora_gpt/AuroraGPT"
# Two parallel experiment trees on Flare ran the same comparison: the
# `optimizer-experiments` tree (Oct–Nov 2025) and the earlier
# `large-batch-training/tok50M-n512` tree (Sep 2025, where Muon lived).
# We need both to recreate the chart.
OUTDIR_FILTERS = (
    "/lus/flare/projects/AuroraGPT/AuroraGPT-v1/Experiments/AuroraGPT-2B/"
    "optimizer-experiments/Megatron-DeepSpeed",
    "/lus/flare/projects/AuroraGPT/AuroraGPT-v1/Experiments/AuroraGPT-2B/"
    "large-batch-training/tok50M-n512/Megatron-DeepSpeed",
)

STEP_KEY = "_step"
TOKEN_KEY = "training/consumed_tokens"
LOSS_KEY = "loss/lm loss"
GRAD_KEY = "loss/grad_norm"

# Map W&B optimizer string → (filename, human label). The keys are the
# raw values of `config.args.optimizer` we observed in the project.
OPTIMIZERS = {
    "adamw":          ("adamw.parquet",    "AdamW"),
    "ipex.fusedlamb": ("lamb.parquet",     "ipex.FusedLamb"),
    "muonclip":       ("muonclip.parquet", "MuonClip"),
    "sophiag":        ("sophiag.parquet",  "SophiaG"),
    "muon":           ("muon.parquet",     "Muon"),
}

# Known bad runs to skip — these are restarts that wrote a few bogus
# rows (loss not yet converged from checkpoint, or pre-checkpoint
# garbage). Identified by id rather than name in case the run gets
# renamed. Add to this set when a divergent-restart pollutes the
# concat.
RUN_BLACKLIST: set = set()

OUT_DIR = (
    Path.home()
    / "projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/optimizer-comparison"
)


def _group_runs(api: wandb.Api):
    runs = api.runs(
        PROJECT,
        filters={"config.outdir": {"$in": list(OUTDIR_FILTERS)}},
        per_page=500,
    )
    print(f"matched {len(runs)} runs across {len(OUTDIR_FILTERS)} outdirs")
    by_opt: dict[str, list] = defaultdict(list)
    for r in runs:
        if r.id in RUN_BLACKLIST:
            continue
        # config["args"] is the megatron arg-namespace as a dict; the
        # optimizer flag lives there as `optimizer`. Earlier we tried
        # the flattened "args.optimizer" key which wandb does NOT
        # populate — every run silently fell into UNKNOWN.
        args = r.config.get("args") or {}
        opt = args.get("optimizer") if isinstance(args, dict) else None
        if not isinstance(opt, str):
            continue
        opt = opt.strip().lower()
        if opt not in OPTIMIZERS:
            # Don't print every UNKNOWN — the loop has a `for r in runs`
            # iterator that already filtered to the right outdir, so
            # mismatches here are minor (e.g. an early experimental
            # optimizer key like "dshampoo"). Surface in summary instead.
            by_opt.setdefault(f"__skip__{opt}", []).append(r)
            continue
        by_opt[opt].append(r)
    # Surface skipped opts so we know if we're missing anything.
    for key in [k for k in by_opt if k.startswith("__skip__")]:
        opt = key.removeprefix("__skip__")
        print(f"  skipping {len(by_opt[key])} runs with optimizer={opt!r}")
        del by_opt[key]
    return by_opt


def _scan_run(run) -> pd.DataFrame:
    """scan_history with NO key filter — get every row, then project.

    Passing keys=[…] to scan_history is an *inner-join* over those keys:
    rows missing ANY of the requested keys are dropped. That truncated
    each optimizer chain to ~5K rows (the loss/grad/token intersection
    cadence) when the run actually has ~30K rows of loss data.
    """
    rows = []
    for h in run.scan_history():
        rows.append(
            (
                h.get(STEP_KEY),
                h.get(TOKEN_KEY),
                h.get(LOSS_KEY),
                h.get(GRAD_KEY),
            )
        )
    df = pd.DataFrame(rows, columns=["step", "tokens", "loss", "grad_norm"])
    for col in ("step", "tokens", "loss", "grad_norm"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    # Drop completely-empty rows (no _step and no metrics — wandb logs
    # housekeeping rows for system metrics with no values for ours).
    df = df.dropna(subset=["loss", "grad_norm", "tokens"], how="all")
    df = df.dropna(subset=["step"]).reset_index(drop=True)
    df["run_id"] = run.id
    return df


def fetch_optimizer(runs) -> pd.DataFrame:
    """Concatenate every run for one optimizer, dedup by `tokens`.

    NB: _step is NOT monotonic across resumes — every chained restart
    resets _step to 0 inside its own run, so dedup-by-_step collapses
    the entire chain to the first ~5K steps. `training/consumed_tokens`
    is the monotonic axis (each resume reads the consumed-tokens count
    from checkpoint), so we dedup on a rounded-tokens key instead.

    Rounding: tokens-per-step ≈ 50M for these runs (GBS=6144 × 8192
    ctx), so identical steps reproduce identical token counts to the
    integer; we round to 1M tokens just to defend against floating-
    point noise across resume boundaries.

    Tie-break: process longest-first, then keep="first" so the longer
    run's row wins where overlaps exist (crashed restarts that wrote
    a few bogus rows post-checkpoint shouldn't clobber the canonical
    multi-thousand-row run at those tokens).
    """
    runs_sorted = sorted(
        runs,
        key=lambda r: r.summary.get("_step", 0) or 0,
        reverse=True,
    )
    frames = []
    for r in runs_sorted:
        if not r.summary.get("_step"):
            print(f"    skip {r.id}  (no steps)")
            continue
        df = _scan_run(r)
        if df.empty:
            print(f"    skip {r.id}  (empty after dropna)")
            continue
        # Drop rows that have no token count — without tokens we can't
        # place them on the chain timeline.
        df = df.dropna(subset=["tokens"])
        if df.empty:
            print(f"    skip {r.id}  (no tokens column)")
            continue
        print(
            f"    load {r.id:10s}  state={r.state:<8s}  rows={len(df):>6,}  "
            f"tokens=[{df.tokens.min() / 1e9:>5.1f}B, {df.tokens.max() / 1e9:>5.1f}B]"
        )
        frames.append(df)
    if not frames:
        return pd.DataFrame(columns=["step", "tokens", "loss", "grad_norm", "run_id"])
    union = pd.concat(frames, ignore_index=True)
    # Round tokens to 1M for stable dedup (steps are 50M apart, so this
    # is generous and never collapses distinct steps).
    union["__tkey"] = (union["tokens"] / 1e6).round().astype("int64")
    union = (
        union.sort_values(["__tkey"], kind="stable")
        .drop_duplicates(subset=["__tkey"], keep="first")
        .drop(columns=["__tkey"])
        .sort_values("tokens")
        .reset_index(drop=True)
    )
    return union


def main():
    api = wandb.Api()
    by_opt = _group_runs(api)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for opt_key, (filename, label) in OPTIMIZERS.items():
        runs = by_opt.get(opt_key, [])
        print(f"\n=== {filename} ({label})  {len(runs)} runs ===")
        if not runs:
            print("  (no runs found — skipping)")
            continue
        df = fetch_optimizer(runs)
        if df.empty:
            print("  (no data — skipping write)")
            continue
        loss_finite = df.loss.dropna()
        print(
            f"  union rows={len(df):,}  step=[{int(df.step.min())}, {int(df.step.max())}]  "
            f"loss=[{loss_finite.min():.3f}, {loss_finite.max():.3f}]  "
            f"tokens.max={df.tokens.max() / 1e9:.0f}B"
        )
        out = OUT_DIR / filename
        df.to_parquet(out, index=False)
        print(f"  wrote {out.name}  size={out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
