"""
Render the LR-finder chart for the TPC'26 talk from the canonical
Aurora CSV outputs (scp'd from
  /lus/flare/projects/AuroraGPT/foremans/projects/saforem2/torchtitan-ezpz/
  outputs/lr_finder/ezpz/ezpz.agpt/<size>/<opt>/lr_finder_data.csv
into web/public/talks/2026-06-03/data/lr-finder/aurora/).

Each CSV has two columns: learning_rate, loss — one point per
LR-finder step. Layout: 2 panels (2B + 20B) overlaying AdamW · Muon
· SophiaG curves. Log x (LR), log y (loss). Palette matches the
optimizer-comparison chart so the audience reads the same color → same
optimizer across slides.

Output: web/public/talks/2026-06-03/figures/lr-finder-aurora.svg
        web/public/talks/2026-06-03/figures/lr-finder-aurora-mobile.svg
"""

import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.ticker import FormatStrFormatter, LogLocator

sys.path.insert(0, str(Path(__file__).parent))
from _plot_style import TALK_RCPARAMS_GRID, register_iosevka25

register_iosevka25()

MOBILE = bool(os.environ.get('MOBILE'))

DATA_DIR = (
    Path.home()
    / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/lr-finder/aurora'
)
OUT_DIR = (
    Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'
)

# (label, slug, color, marker) — matches the optimizer-comparison palette.
OPTIMIZERS = [
    ('AdamW',   'adamw',   '#43a047', 'o'),  # green
    ('Muon',    'muon',    '#eab308', '^'),  # yellow
    ('SophiaG', 'sophiag', '#2196f3', 'D'),  # blue
]

MODELS = [
    ('2B',  '2b'),
    ('20B', '20b'),
]


def _load(size_slug: str, opt_slug: str) -> pd.DataFrame | None:
    p = DATA_DIR / f'aurora__{size_slug}__{opt_slug}.csv'
    if not p.exists():
        return None
    return pd.read_csv(p).sort_values('learning_rate').reset_index(drop=True)


def _smooth(loss: pd.Series, window: int = 5) -> pd.Series:
    return loss.rolling(window=window, min_periods=1, center=True).mean()


def _suggested_lr(lr: np.ndarray, loss: np.ndarray) -> float | None:
    """Steepest-descent suggested LR (Smith 2015 / Gugger): pick the
    LR where dloss/d(log lr) is most negative, restricted to the
    descending region (within 1.5× of running min so post-blow-up
    noise doesn't win)."""
    if len(lr) < 5:
        return None
    log_lr = np.log(lr)
    smoothed = pd.Series(loss).rolling(7, min_periods=1, center=True).mean().values
    dl = np.gradient(smoothed, log_lr)
    running_min = np.minimum.accumulate(smoothed)
    in_descent = smoothed <= running_min * 1.5
    if not in_descent.any():
        return None
    cands = np.where(in_descent)[0]
    idx = cands[np.argmin(dl[cands])]
    return float(lr[idx])


def _draw_panel(ax, size_label: str, size_slug: str, y_cap: float):
    for opt_label, opt_slug, color, marker in OPTIMIZERS:
        df = _load(size_slug, opt_slug)
        if df is None or df.empty:
            continue
        lr = df['learning_rate'].to_numpy()
        loss = df['loss'].to_numpy()
        # Clip post-blow-up spikes at the y-cap so they show as a
        # ceiling instead of blowing out the y-axis.
        loss_plot = np.clip(np.where(np.isnan(loss), y_cap, loss), None, y_cap)
        smoothed = _smooth(pd.Series(loss_plot), window=5).to_numpy()
        ax.plot(lr, smoothed, color=color, lw=2.0,
                marker=marker, ms=5, markevery=max(1, len(lr) // 12),
                alpha=0.95, label=opt_label, zorder=3)
        sug = _suggested_lr(lr, loss)
        if sug is not None:
            ax.axvline(sug, ls='--', lw=1.0, color=color, alpha=0.55, zorder=2)
    ax.set_xscale('log')
    ax.set_yscale('log')
    ax.set_title(size_label, pad=6)
    ax.set_xlabel('learning rate (log)')
    ax.grid(True, alpha=0.25, which='both')
    ax.yaxis.set_major_locator(LogLocator(base=10.0, subs=(1.0,)))
    ax.yaxis.set_major_formatter(FormatStrFormatter('%g'))


def render(out_path: Path, figsize: tuple[float, float], mobile: bool) -> None:
    import ambivalent  # noqa: F401
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS_GRID)

    if mobile:
        fig, axes = plt.subplots(2, 1, figsize=figsize, sharey=True)
    else:
        fig, axes = plt.subplots(1, 2, figsize=figsize, sharey=True)
    fig.patch.set_alpha(0)
    # Cap covers SophiaG's late-blow-up spike (max ~459) without
    # flattening the descent region. 60 reads on log y as "this is
    # where it diverged" without dominating the panel.
    Y_CAP = 60.0
    for ax, (size_label, size_slug) in zip(axes, MODELS):
        ax.patch.set_alpha(0)
        _draw_panel(ax, size_label, size_slug, Y_CAP)
        ax.set_ylim(4.0, Y_CAP)
    axes[0].set_ylabel('training loss (log)')
    axes[0].legend(loc='upper left', framealpha=0)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True, bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path.relative_to(Path.home())}  '
          f'({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if MOBILE:
        render(OUT_DIR / 'lr-finder-aurora-mobile.svg',
               figsize=(8, 12), mobile=True)
    else:
        render(OUT_DIR / 'lr-finder-aurora.svg',
               figsize=(16, 6), mobile=False)
