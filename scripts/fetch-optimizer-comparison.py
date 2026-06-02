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

# The W&B report's comparison uses ONE outdir per optimizer:
#   - AdamW / Lamb / MuonClip / SophiaG → the canonical Oct-Nov 2025
#     "optimizer-experiments/Megatron-DeepSpeed" campaign at GBS=6,144
#   - Muon → the earlier Sep 2025 "large-batch-training/tok50M-n512"
#     campaign (Muon never ran in the later outdir).
# Including the early Lamb chain (Oct 6-8, also lived in tok50M-n512)
# would conflate two distinct experiments — that chain reaches 7T
# tokens at loss 1.32, which is a different setup we don't want to
# attribute to the comparison.
OUTDIR_OPTIMIZER_TREE = (
    "/lus/flare/projects/AuroraGPT/AuroraGPT-v1/Experiments/AuroraGPT-2B/"
    "optimizer-experiments/Megatron-DeepSpeed"
)
OUTDIR_LARGE_BATCH_TREE = (
    "/lus/flare/projects/AuroraGPT/AuroraGPT-v1/Experiments/AuroraGPT-2B/"
    "large-batch-training/tok50M-n512/Megatron-DeepSpeed"
)
# Per-optimizer outdir scope. Optimizers not listed here use
# OUTDIR_OPTIMIZER_TREE by default.
OPTIMIZER_OUTDIR_OVERRIDE = {
    "muon": OUTDIR_LARGE_BATCH_TREE,
}

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
    """For each optimizer, fetch only the runs in *its* canonical outdir.

    Running one big query across both outdirs and then filtering would
    pull the early Oct 6-8 Lamb chain (which lived in the
    large-batch-training tree) into the Lamb concat — that chain
    reaches 7T tokens at loss 1.32 and represents a different setup
    than the optimizer-comparison campaign. Scoping per-optimizer
    avoids the cross-campaign contamination.
    """
    by_opt: dict[str, list] = defaultdict(list)
    for opt_key in OPTIMIZERS:
        outdir = OPTIMIZER_OUTDIR_OVERRIDE.get(opt_key, OUTDIR_OPTIMIZER_TREE)
        runs = api.runs(
            PROJECT,
            filters={"config.outdir": outdir},
            per_page=500,
        )
        for r in runs:
            if r.id in RUN_BLACKLIST:
                continue
            # config["args"] is the megatron arg-namespace as a dict;
            # the optimizer flag lives there as `optimizer`. The
            # flattened "args.optimizer" key isn't populated.
            args = r.config.get("args") or {}
            opt = args.get("optimizer") if isinstance(args, dict) else None
            if not isinstance(opt, str):
                continue
            if opt.strip().lower() != opt_key:
                continue
            by_opt[opt_key].append(r)
        print(
            f"  {opt_key:15s}  outdir=…/{outdir.rsplit('/', 2)[-2]}/{outdir.rsplit('/', 1)[-1]}  "
            f"runs={len(by_opt[opt_key])}"
        )
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
