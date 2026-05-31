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

# (filename, label, color, marker). Colors mirror the W&B report
# (https://api.wandb.ai/links/aurora_gpt/giy3swff) so the slide reads
# 1:1 against the report. Markers add a second visual channel so the
# chart isn't color-only — important for print / colorblind viewers
# and for matching legend ↔ line when curves bunch up in the same
# band.
RUNS = [
    ('adamw.parquet',    'AdamW',          '#f5b800', 'o'),  # circle
    ('lamb.parquet',     'ipex.FusedLamb', '#3b82f6', 's'),  # square
    ('muonclip.parquet', 'MuonClip',       '#f97316', '^'),  # triangle
    ('sophiag.parquet',  'SophiaG',        '#22c55e', 'D'),  # diamond
    ('muon.parquet',     'Muon',           '#ef4444', 'X'),  # x
]

# Drop a marker every N billion tokens. Coarse enough to avoid a
# zipper-look on the smoothed lines, dense enough to be readable.
MARKER_TOKENS_B = 100

# Focus window — story is decided by ~1.5T tokens (AdamW dies in
# warmup, Muon diverges ~250B, MuonClip spikes ~1.1T, SophiaG/Lamb
# separate by ~1T). Lamb + SophiaG continue past 6T but that's
# redundant.
X_MAX_T = 1.5


def _smooth(series: pd.Series, window: int = 200) -> pd.Series:
    """Wide rolling mean over per-step traces.

    With 30K rows per chain, narrow smoothing renders every grad-norm
    tick and turns the overlay into a smear. 200 rows ≈ 200 steps ≈
    10B tokens — that's the right scale for showing structure (band
    separation, divergence events) without the per-step noise.
    """
    return series.rolling(window=window, min_periods=1, center=False).mean()


def _series(fname: str):
    df = pd.read_parquet(DATA_DIR / fname)
    df = df.dropna(subset=['tokens']).sort_values('tokens').reset_index(drop=True)
    loss = _smooth(df.loss, window=200)
    gn = _smooth(df.grad_norm, window=200)
    # Decimate to keep SVG size sane (5 chains × 30K rows = 150K points
    # is a multi-MB SVG). 1,500 per chain is plenty at slide resolution.
    n_target = 1500
    stride = max(1, len(df) // n_target)
    x = (df.tokens / 1e12).iloc[::stride].reset_index(drop=True)
    loss = loss.iloc[::stride].reset_index(drop=True)
    gn = gn.iloc[::stride].reset_index(drop=True)
    return x, loss, gn


def _marker_indices(x_t: 'pd.Series') -> list[int]:
    """Pick indices in x_t whose token-position lands closest to each
    100B-token marker between the chain's first and last token.

    x_t is in trillions, so step = MARKER_TOKENS_B / 1000.
    """
    if len(x_t) == 0:
        return []
    step = MARKER_TOKENS_B / 1000.0
    x_min, x_max = float(x_t.iloc[0]), float(x_t.iloc[-1])
    # Targets at step, 2·step, … up to and including the last marker
    # below the chain max. Skip the 0-token mark (every chain starts
    # there — would just stack 5 markers on top of each other).
    targets = []
    k = 1
    while True:
        t = k * step
        if t > x_max:
            break
        if t >= x_min:
            targets.append(t)
        k += 1
    if not targets:
        return []
    # For each target, find the nearest index in x_t.
    import numpy as np
    arr = x_t.to_numpy()
    idxs = [int(np.argmin(np.abs(arr - t))) for t in targets]
    # Dedup (a very short chain might have all targets snap to the
    # same row).
    return sorted(set(idxs))


def _draw(ax_loss, ax_grad):
    for fname, label, color, marker in RUNS:
        x, loss, gn = _series(fname)
        idxs = _marker_indices(x)
        ax_loss.plot(
            x, loss,
            color=color, label=label,
            linewidth=2.0, alpha=0.95,
            marker=marker, markevery=idxs,
            markersize=8, markeredgewidth=0,
        )
        ax_grad.plot(
            x, gn,
            color=color, label=label,
            linewidth=2.0, alpha=0.95,
            marker=marker, markevery=idxs,
            markersize=8, markeredgewidth=0,
        )

    # Loss panel — log y so the AdamW crash + Muon explosion compress
    # without losing detail in the converged ~2.4–3 band. Cap at 8;
    # the brief MuonClip spike past 8 clips, but the structure that
    # matters (which optimizer ends up where) lives in [2.4, 6].
    ax_loss.set_yscale('log')
    ax_loss.set_ylim(2.3, 8)
    ax_loss.set_ylabel('LM training loss  (log)')
    ax_loss.grid(True, alpha=0.2, which='both')

    ax_grad.set_yscale('log')
    ax_grad.set_ylabel('grad norm  (log)')
    ax_grad.set_xlabel('consumed tokens (T)')
    ax_grad.grid(True, alpha=0.2, which='both')

    for ax in (ax_loss, ax_grad):
        ax.set_xlim(0, X_MAX_T)


def _legend_in_line_order(ax) -> None:
    """Draw the legend on `ax` with entries ordered by where each line
    sits visually at the right edge of the loss plot — top entry is
    the highest-loss line, bottom is the lowest. This means readers
    can match labels to lines by left-to-right scanning rather than
    color-hunting.

    Order (highest → lowest terminal loss in the [0, 1.5T] window):
      MuonClip, Muon, AdamW, ipex.FusedLamb, SophiaG
    """
    order = ['MuonClip', 'Muon', 'AdamW', 'ipex.FusedLamb', 'SophiaG']
    handles, labels = ax.get_legend_handles_labels()
    by_label = dict(zip(labels, handles))
    ordered = [(by_label[name], name) for name in order if name in by_label]
    ax.legend(
        [h for h, _ in ordered],
        [n for _, n in ordered],
        # Anchor the legend in the middle of the panel — there's an
        # empty triangular gap between MuonClip's high-token spike on
        # the right and the converged lines on the bottom that fits
        # five rows comfortably without overlapping any line.
        loc='center',
        frameon=False,
        ncol=1,
        handlelength=2,
    )


def render_stacked(out_name: str, figsize: tuple[float, float]) -> None:
    """Loss above grad_norm, sharing the x-axis. Use for portrait /
    tall slide layouts (mobile)."""
    plt.rcParams.update(TALK_RCPARAMS)
    fig, (ax_loss, ax_grad) = plt.subplots(
        2, 1, figsize=figsize, sharex=True, gridspec_kw={'hspace': 0.08}
    )
    _draw(ax_loss, ax_grad)
    _legend_in_line_order(ax_loss)
    fig.suptitle(
        'AuroraGPT-2B  optimizer comparison  (GBS=6,144 · 50M tok/batch)',
        fontsize=22, fontweight=600, y=0.995,
    )
    _save(fig, out_name)


def render_side_by_side(out_name: str, figsize: tuple[float, float]) -> None:
    """Loss left, grad_norm right. Wide-screen / desktop layout."""
    plt.rcParams.update(TALK_RCPARAMS)
    fig, (ax_loss, ax_grad) = plt.subplots(
        1, 2, figsize=figsize, gridspec_kw={'wspace': 0.18}
    )
    _draw(ax_loss, ax_grad)
    # Both panels need x-labels now (no shared axis between rows).
    ax_loss.set_xlabel('consumed tokens (T)')
    _legend_in_line_order(ax_loss)
    fig.suptitle(
        'AuroraGPT-2B  optimizer comparison  (GBS=6,144 · 50M tok/batch)',
        fontsize=22, fontweight=600, y=0.995,
    )
    _save(fig, out_name)


def _save(fig, out_name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    out_file = OUT / out_name
    fig.savefig(out_file, format='svg', bbox_inches='tight', transparent=True)
    print(f'wrote {out_file.relative_to(Path.home())}  size={out_file.stat().st_size // 1024} KB')
    plt.close(fig)


if __name__ == '__main__':
    if MOBILE:
        # Portrait-narrow stack for mobile srcset.
        render_stacked('optimizer-comparison-mobile.svg', figsize=(8, 14))
    else:
        # Default desktop slide variant: side-by-side, wide.
        render_side_by_side('optimizer-comparison.svg', figsize=(20, 8))
        # Also emit a tall variant in case a future slide wants the
        # stacked layout (e.g. paired-with-table slides).
        render_stacked('optimizer-comparison-tall.svg', figsize=(16, 10))
