"""
Pull AuroraGPT-2B large-batch optimizer-comparison runs from W&B.

These are the 5 runs from the
https://api.wandb.ai/links/aurora_gpt/giy3swff report comparing
{AdamW, Lamb, MuonClip, SophiaG, Muon} at GBS=6,144 (50M tokens / batch,
8192 ctx, LBS=2). The slide thesis: SophiaG outperformed the others
in both loss and stability, which is why it became the 2B production
choice. Pulling raw history so we can re-plot offline + tweak
smoothing / axes locally without re-hitting wandb each iteration.

Outputs under `web/public/talks/2026-06-03/data/optimizer-comparison/`:
  adamw.parquet  lamb.parquet  muonclip.parquet  sophiag.parquet  muon.parquet

Each parquet has columns:
  step (int)              # _step
  tokens (float)          # training/consumed_tokens (preferred x-axis)
  loss (float)            # loss/lm_loss
  grad_norm (float)       # loss/grad_norm

Auth: ~/.netrc.
"""

from pathlib import Path

import pandas as pd
import wandb

PROJECT = "aurora_gpt/AuroraGPT"
STEP_KEY = "_step"
TOKEN_KEY = "training/consumed_tokens"
# NB: this run logs the metric with a space, not underscore ("loss/lm loss").
# wandb's scan_history keys query is exact, so this must match.
LOSS_KEY = "loss/lm loss"
GRAD_KEY = "loss/grad_norm"

# (filename, wandb run_id, human label). Order = the order we want
# to keep in the legend on the slide.
RUNS = [
    ("adamw.parquet",    "s6qh38qj", "AdamW"),
    ("lamb.parquet",     "46v86zg4", "ipex.FusedLamb"),
    ("muonclip.parquet", "0ivyq6dn", "MuonClip"),
    ("sophiag.parquet",  "1kha62ra", "SophiaG"),
    ("muon.parquet",     "urpc8ces", "Muon"),
]

OUT_DIR = (
    Path.home()
    / "projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/optimizer-comparison"
)


def fetch_run(api: wandb.Api, run_id: str, label: str) -> pd.DataFrame:
    run = api.run(f"{PROJECT}/{run_id}")
    print(f"  {label:>16s}  id={run_id}  name={run.name!r}  state={run.state}")

    history = run.scan_history(keys=[STEP_KEY, TOKEN_KEY, LOSS_KEY, GRAD_KEY])
    rows = []
    for h in history:
        # tolerate occasional missing values — some runs log loss every
        # step but grad_norm every N. We want both columns present so
        # the plot can use either as a vertical axis without alignment.
        if LOSS_KEY not in h and GRAD_KEY not in h:
            continue
        rows.append(
            (
                h.get(STEP_KEY),
                h.get(TOKEN_KEY),
                h.get(LOSS_KEY),
                h.get(GRAD_KEY),
            )
        )
    df = pd.DataFrame(rows, columns=["step", "tokens", "loss", "grad_norm"])
    # Some runs log the string "NaN" instead of a numeric NaN (this is
    # what blows up post-grad-overflow steps in Megatron-DeepSpeed).
    # Coerce every numeric column to float so downstream consumers can
    # filter / plot without dispatching through object dtype.
    for col in ("step", "tokens", "loss", "grad_norm"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["loss", "grad_norm"], how="all").reset_index(drop=True)
    loss_finite = df.loss.dropna()
    print(
        f"    rows={len(df):,}  step=[{int(df.step.min())}, {int(df.step.max())}]  "
        f"loss=[{loss_finite.min():.3f}, {loss_finite.max():.3f}]  "
        f"grad_norm.max={df.grad_norm.max():.2f}"
    )
    return df


def main():
    api = wandb.Api()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, run_id, label in RUNS:
        print(f"\n=== {filename} ({label}) ===")
        df = fetch_run(api, run_id, label)
        if df.empty:
            print("  (no data — skipping write)")
            continue
        out = OUT_DIR / filename
        df.to_parquet(out, index=False)
        print(f"  wrote {out.name}  size={out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
