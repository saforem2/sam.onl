"""
Render the 2B cross-optimizer LR-finder chart for the TPC'26 talk.

Layout: single panel overlaying LR-vs-loss curves for AdamW · Muon ·
SophiaG on the 2B model. Log x (LR), log y (loss). A vertical dashed
marker on each curve indicates the suggested LR (steepest-descent
heuristic — Smith 2015 / Gugger).

Data: web/public/talks/2026-06-03/data/lr-finder/sunspot__2b__<opt>.parquet
      (fetched by scripts/fetch-lr-finder.py from W&B)

Output: web/public/talks/2026-06-03/figures/lr-finder-sunspot.svg
        web/public/talks/2026-06-03/figures/lr-finder-sunspot-mobile.svg

Palette matches the optimizer-comparison chart so the audience reads
the same color → same optimizer across the two slides.
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
    / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/lr-finder'
)
OUT_DIR = (
    Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'
)

# (label, color, marker) — matches the optimizer-comparison chart's
# rainbow palette. AdamW=green, Muon=yellow, SophiaG=blue.
OPTIMIZERS = [
    ('AdamW',   'adamw',   '#43a047', 'o'),
    ('Muon',    'muon',    '#eab308', '^'),
    ('SophiaG', 'sophiag', '#2196f3', 'D'),
]

# 2B only for the main-path slide — the 20B and 80B sweeps live in
# the docs/experiments/lr-finder README that the figcaption links to.
MODELS = [
    ('2B', '2b'),
]


def _smooth(loss: pd.Series, window: int = 5) -> pd.Series:
    """Light rolling-mean smoothing to make the descent + blow-up
    structure readable through per-step noise. 5-step window is
    short enough to preserve the knee position."""
    return loss.rolling(window=window, min_periods=1, center=True).mean()


def _suggested_lr(lr: np.ndarray, loss: np.ndarray) -> float | None:
    """Heuristic 'suggested LR': steepest descent point.

    Compute dloss/d(log lr) (since LR is exponential) and pick the
    LR where it's most negative. Restrict to the descending region
    (before the blow-up) so post-divergence noise doesn't win.
    Returns None if data is too short or no clear descent.
    """
    if len(lr) < 5:
        return None
    log_lr = np.log(lr)
    # Smooth before differencing — raw 1-step gradient is too noisy
    smoothed = pd.Series(loss).rolling(7, min_periods=1, center=True).mean().values
    dl = np.gradient(smoothed, log_lr)
    # Restrict to the section before loss starts climbing significantly
    # (within 1.5× of the running minimum).
    running_min = np.minimum.accumulate(smoothed)
    in_descent = smoothed <= running_min * 1.5
    if not in_descent.any():
        return None
    candidates = np.where(in_descent)[0]
    idx = candidates[np.argmin(dl[candidates])]
    return float(lr[idx])


def _load(flavor_slug: str, opt_slug: str) -> pd.DataFrame | None:
    p = DATA_DIR / f'sunspot__{flavor_slug}__{opt_slug}.parquet'
    if not p.exists():
        return None
    df = pd.read_parquet(p).sort_values('lr').reset_index(drop=True)
    # NaN losses (post-blow-up) get clipped at the y-cap so they're
    # still visible as the curve flattening at the ceiling.
    return df


def _draw_panel(ax, flavor_label: str, flavor_slug: str, y_cap: float):
    for opt_label, opt_slug, color, marker in OPTIMIZERS:
        df = _load(flavor_slug, opt_slug)
        if df is None or df.empty:
            continue
        lr = df['lr'].to_numpy()
        loss = df['loss'].to_numpy()
        # Replace NaN losses (post-blow-up) with the y-cap so the
        # divergence is visible as a ceiling line, not a gap.
        loss_plot = np.where(np.isnan(loss), y_cap, loss)
        loss_plot = np.clip(loss_plot, None, y_cap)
        smoothed = _smooth(pd.Series(loss_plot), window=5).to_numpy()
        ax.plot(lr, smoothed, color=color, lw=2.0,
                marker=marker, ms=4, markevery=max(1, len(lr) // 12),
                alpha=0.95, label=opt_label, zorder=3)
        # Suggested-LR marker — vertical dashed at the steepest-descent LR.
        sug = _suggested_lr(lr, loss)
        if sug is not None:
            ax.axvline(sug, ls='--', lw=1.0, color=color, alpha=0.5, zorder=2)
    ax.set_xscale('log')
    ax.set_yscale('log')
    ax.set_title(flavor_label, pad=6)
    ax.set_xlabel('learning rate (log)')
    ax.grid(True, alpha=0.25, which='both')
    ax.yaxis.set_major_locator(LogLocator(base=10.0, subs=(1.0,)))
    ax.yaxis.set_major_formatter(FormatStrFormatter('%g'))


def render(out_path: Path, figsize: tuple[float, float]) -> None:
    import ambivalent  # noqa: F401
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS_GRID)

    fig, ax = plt.subplots(1, 1, figsize=figsize)
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)
    # Cap loss at ~60 — covers the SophiaG blow-up tail (max ~459 in
    # the raw data) without letting one outlier flatten the descent
    # region we actually want to read. Smoothing + clipping in
    # _draw_panel handles the rest.
    Y_CAP = 60.0
    flavor_label, flavor_slug = MODELS[0]
    _draw_panel(ax, flavor_label, flavor_slug, Y_CAP)
    ax.set_title('')  # Title would duplicate the slide heading
    ax.set_ylim(4.0, Y_CAP)
    ax.set_ylabel('training loss (log)')
    ax.legend(loc='upper left', framealpha=0)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True, bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path.relative_to(Path.home())}  '
          f'({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if MOBILE:
        render(OUT_DIR / 'lr-finder-sunspot-mobile.svg', figsize=(8, 10))
    else:
        render(OUT_DIR / 'lr-finder-sunspot.svg', figsize=(14, 7))
