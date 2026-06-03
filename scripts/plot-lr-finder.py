"""
Render the LR-finder chart for the TPC'26 talk from the canonical
CSV outputs on Aurora + Sunspot.

Data (scp'd into
web/public/talks/2026-06-03/data/lr-finder/{aurora,sunspot}/):
  Aurora:  /lus/flare/projects/AuroraGPT/foremans/projects/saforem2/
           torchtitan-ezpz/outputs/lr_finder/ezpz/ezpz.agpt/<sz>/<opt>/
           lr_finder_data.csv
  Sunspot: /home/foremans/datascience/foremans/projects/saforem2/
           torchtitan/outputs/lr_finder/ezpz/ezpz.agpt/<sz>/<opt>/
           lr_finder_data.csv

Each CSV has at least learning_rate + loss columns (Sunspot adds
timestamp/job_id/hostname/world_size, ignored). Layout: 2B single
panel overlaying both machines × 3 optimizers, with line style
distinguishing machine (Aurora solid, Sunspot dashed). Color =
optimizer, matching the optimizer-comparison chart's palette.

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

DATA_ROOT = (
    Path.home()
    / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/lr-finder'
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

# Machines we pool over. Both machines' CSVs are loaded for each
# (size, optimizer); their losses are merged by nearest-LR bin and
# rendered as a single mean line with min/max whiskers per bin —
# so the audience reads color=optimizer and the spread answers
# "does this hold across hardware?"
MACHINES = [
    ('Aurora',  'aurora'),
    ('Sunspot', 'sunspot'),
]

# 2B only on the main-path slide — the 20B sweep is in the linked
# README. Single-panel chart reads faster and matches the slide's
# narrow purpose ("how we picked LR=2.28e-5 for SophiaG 2B").
MODELS = [
    ('2B', '2b'),
]


def _load(machine_slug: str, size_slug: str, opt_slug: str) -> pd.DataFrame | None:
    p = DATA_ROOT / machine_slug / f'{machine_slug}__{size_slug}__{opt_slug}.csv'
    if not p.exists():
        return None
    df = pd.read_csv(p)
    # Sunspot CSVs carry extra metadata columns; only the first two matter.
    df = df[['learning_rate', 'loss']].copy()
    return df.sort_values('learning_rate').reset_index(drop=True)


def _smooth(loss: pd.Series, window: int = 5) -> pd.Series:
    return loss.rolling(window=window, min_periods=1, center=True).mean()


def _suggested_lr(lr: np.ndarray, loss: np.ndarray) -> float | None:
    """Steepest-descent suggested LR (Smith 2015 / Gugger): pick the
    LR where dloss/d(log lr) is most negative.

    A descent gate (loss within 2× of running min) keeps the pick on
    the actual descent rather than a noise dip in the post-blow-up
    region. AdamW's pooled curve is the flattest of the three, so
    fewer points pass the gate — if <5 do, fall back to the global
    argmin gradient so the slide still gets a marker."""
    if len(lr) < 5:
        return None
    log_lr = np.log(lr)
    smoothed = pd.Series(loss).rolling(7, min_periods=1, center=True).mean().values
    dl = np.gradient(smoothed, log_lr)
    running_min = np.minimum.accumulate(smoothed)
    in_descent = smoothed <= running_min * 2.0
    cands = np.where(in_descent)[0] if in_descent.sum() >= 5 else np.arange(len(lr))
    idx = cands[np.argmin(dl[cands])]
    return float(lr[idx])


def _pool(size_slug: str, opt_slug: str, y_cap: float):
    """Concat Aurora + Sunspot CSVs for one (size, opt) group, bin
    rows by log-LR (~30 bins covering 6 decades = 0.2 decade per
    bin), and return per-bin (lr_center, mean, lo, hi). The bin
    granularity is tight enough that within-bin spread reflects
    machine-to-machine variance, not the LR sweep itself."""
    frames = []
    for _, machine_slug in MACHINES:
        df = _load(machine_slug, size_slug, opt_slug)
        if df is None or df.empty:
            continue
        frames.append(df)
    if not frames:
        return None
    pooled = pd.concat(frames, ignore_index=True)
    # Clip post-blow-up spikes to the y-cap before pooling so a NaN
    # spike from one machine doesn't single-handedly inflate the
    # whisker for that bin.
    pooled['loss'] = np.where(pooled['loss'].isna(), y_cap, pooled['loss'])
    pooled['loss'] = pooled['loss'].clip(upper=y_cap)
    # Log-uniform bins across the actual LR range.
    log_lr = np.log10(pooled['learning_rate'].to_numpy())
    n_bins = 30
    edges = np.linspace(log_lr.min(), log_lr.max(), n_bins + 1)
    pooled['__bin'] = np.digitize(log_lr, edges[1:-1])
    agg = pooled.groupby('__bin').agg(
        lr=('learning_rate', 'mean'),
        mean=('loss', 'mean'),
        lo=('loss', 'min'),
        hi=('loss', 'max'),
    ).reset_index(drop=True).sort_values('lr').reset_index(drop=True)
    return agg


def _draw_panel(ax, size_label: str, size_slug: str, y_cap: float):
    for opt_label, opt_slug, color, marker in OPTIMIZERS:
        agg = _pool(size_slug, opt_slug, y_cap)
        if agg is None or agg.empty:
            continue
        lr = agg['lr'].to_numpy()
        mean = agg['mean'].to_numpy()
        lo = agg['lo'].to_numpy()
        hi = agg['hi'].to_numpy()
        # Per-bin min/max as a translucent band behind the mean
        # line. Reads as "this is the uncertainty across machines"
        # without the visual clutter of per-point whiskers.
        every = max(1, len(lr) // 12)
        ax.fill_between(lr, lo, hi, color=color, alpha=0.15,
                        linewidth=0, zorder=2)
        ax.plot(lr, mean, color=color, lw=2.0,
                marker=marker, ms=5, markevery=every,
                alpha=0.95, label=opt_label, zorder=3)
        # Suggested-LR vertical dotted line — use the pooled mean
        # curve as the input so the marker reflects both machines.
        # lw bumped (was 1.2 → 2.0) and alpha up (0.6 → 0.85) since
        # the dotted line was too faint on the projector. zorder 4
        # so it draws OVER the fill_between band.
        sug = _suggested_lr(lr, mean)
        if sug is not None:
            ax.axvline(sug, ls=':', lw=2.0, color=color, alpha=0.85, zorder=4)
    ax.set_xscale('log')
    ax.set_yscale('log')
    ax.set_title(size_label, pad=6)
    ax.set_xlabel('learning rate (log)')
    # Start at ~8e-6 — earlier points sit in the flat warmup region
    # before any optimizer differentiates; trimming saves horizontal
    # real estate for the parts of the curve that actually inform.
    ax.set_xlim(left=8e-6)
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
    # Cap covers SophiaG's late-blow-up spike (max ~459) without
    # flattening the descent region. 60 reads on log y as "this is
    # where it diverged" without dominating the panel.
    Y_CAP = 60.0
    size_label, size_slug = MODELS[0]
    _draw_panel(ax, size_label, size_slug, Y_CAP)
    ax.set_title('')  # slide heading already says "LR-finder — 2B"
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
        render(OUT_DIR / 'lr-finder-aurora-mobile.svg', figsize=(8, 10))
    else:
        render(OUT_DIR / 'lr-finder-aurora.svg', figsize=(12, 7))
