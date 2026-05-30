"""
Optimizer comparison @ 50M tokens/batch — large-batch stability.

Plots loss/lm_loss and loss/grad_norm vs training/consumed_tokens for
the 5 optimizer-comparison runs pulled by fetch-optimizer-comparison.py
(AdamW, ipex.FusedLamb, Muon, MuonClip, SophiaG). The slide thesis:
SophiaG was the only optimizer to reach a lower loss + maintain
bounded grad norms at GBS=6,144 (50M tok/batch, 8192 ctx), which is
why it became the 2B production choice.

Renders a 2-row figure (loss top, grad_norm bottom) sharing an x-axis
in consumed tokens. Transparent SVG, sized for slide-width.
"""

import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from _plot_style import TALK_RCPARAMS, register_iosevka25  # noqa: E402

register_iosevka25()

MOBILE = bool(os.environ.get('MOBILE'))

DATA_DIR = (
    Path.home()
    / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/optimizer-comparison'
)
OUT = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'

# (filename, label, color). Colors match the rest of the deck's palette
# — sophiag in the deck-blue (#3b82f6) since it's the hero, muon /
# muonclip in warm reds (they diverge), lamb in green, adamw in grey
# (crashed early — visually de-emphasized).
RUNS = [
    ('adamw.parquet',    'AdamW',          '#9ca3af'),
    ('lamb.parquet',     'ipex.FusedLamb', '#10b981'),
    ('muon.parquet',     'Muon',           '#ef4444'),
    ('muonclip.parquet', 'MuonClip',       '#f97316'),
    ('sophiag.parquet',  'SophiaG',        '#3b82f6'),
]


def _smooth(series: pd.Series, window: int = 50) -> pd.Series:
    """EMA-ish rolling-mean for the per-step traces.

    Raw per-step loss has high-frequency noise (~±0.02) that turns the
    overlay into a smear at slide-width. A 50-step rolling mean keeps
    the trajectory visible without sanding off the divergence events
    we want to show (loss spikes for Muon, grad_norm bursts for
    SophiaG and Muon).
    """
    return series.rolling(window=window, min_periods=1, center=False).mean()


def render():
    plt.rcParams.update(TALK_RCPARAMS)

    figsize = (8, 14) if MOBILE else (16, 10)
    fig, (ax_loss, ax_grad) = plt.subplots(
        2, 1, figsize=figsize, sharex=True, gridspec_kw={'hspace': 0.08}
    )

    for fname, label, color in RUNS:
        df = pd.read_parquet(DATA_DIR / fname)
        df = df.dropna(subset=['tokens']).sort_values('tokens').reset_index(drop=True)
        # Convert tokens to billions for a friendlier x-axis (these runs
        # consume ~250B before crashing, so a 0–300B linear axis reads
        # cleaner than scientific notation).
        x = df.tokens / 1e9

        # Smooth loss + clip clearly-broken post-divergence values so
        # the y-axis isn't dominated by Muon's loss-12 spike.
        loss = _smooth(df.loss, window=50)
        ax_loss.plot(x, loss, color=color, label=label, linewidth=2.0, alpha=0.95)

        gn = _smooth(df.grad_norm, window=50)
        ax_grad.plot(x, gn, color=color, label=label, linewidth=2.0, alpha=0.95)

    # Loss panel — tight zoom to the band where the optimizers actually
    # compete (2.6–3.5). Muon's post-divergence trace shoots to ~12 but
    # the relevant story (SophiaG converges lowest, Muon/MuonClip drift
    # up, AdamW dies early) lives in this window. Anything above 3.5 is
    # post-failure noise — let the line clip at the top of the panel.
    ax_loss.set_ylim(2.6, 3.6)
    ax_loss.set_ylabel('LM training loss')
    ax_loss.grid(True, alpha=0.2)
    ax_loss.legend(
        loc='upper right',
        frameon=False,
        ncol=1,
        handlelength=2,
    )

    # Grad-norm panel — log y. Muon / SophiaG both spike past 10 at
    # times; log keeps the small (Lamb ~1) and large (Muon 17) coexisting
    # in one panel.
    ax_grad.set_yscale('log')
    ax_grad.set_ylabel('grad norm')
    ax_grad.set_xlabel('consumed tokens (B)')
    ax_grad.grid(True, alpha=0.2, which='both')

    fig.suptitle(
        'AuroraGPT-2B  —  optimizer comparison  (GBS=6,144 · 50M tok/batch)',
        fontsize=22,
        fontweight=600,
        y=0.995,
    )

    OUT.mkdir(parents=True, exist_ok=True)
    suffix = '-mobile' if MOBILE else ''
    out_file = OUT / f'optimizer-comparison{suffix}.svg'
    fig.savefig(out_file, format='svg', bbox_inches='tight', transparent=True)
    print(f'wrote {out_file.relative_to(Path.home())}  size={out_file.stat().st_size // 1024} KB')


if __name__ == '__main__':
    render()
