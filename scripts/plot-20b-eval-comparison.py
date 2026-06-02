"""
20B eval comparison — all-production overlay across 4 trajectories:

  - AuroraGPT-2B  MDS (SophiaG, GBS=6144)        — gray reference
  - AuroraGPT-2B  TT v2 256N async (GBS=6144)    — blue
  - AuroraGPT-2B  TT v2 512N sync  (GBS=12288)   — dark blue
  - AuroraGPT-20B TT v2 512N sync  (GBS=12288)   — red

Mirrors the upstream `all_production_evals.svg` chart in
torchtitan/experiments/ezpz/docs/evals/README.md (one chart, 4 panels,
all trajectories overlaid vs tokens, log-x).

The 2B series are imported directly from `plot_2b_eval_comparison`
(canonical source of truth: 2026-05-27 data refresh). The 20B 512N
series is the canonical 20B sync chain (step 100 → 3,200).

Output: web/public/talks/2026-06-03/figures/eval-20b-compare.svg
"""

import importlib.util
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from _plot_style import TALK_RCPARAMS_GRID, register_iosevka25

register_iosevka25()

# Import the 2B eval data tables from the sibling script. The filename
# has hyphens (not legal Python ident) so use importlib.
_spec = importlib.util.spec_from_file_location(
    'plot_2b_eval_comparison',
    Path(__file__).parent / 'plot-2b-eval-comparison.py',
)
_p2b = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_p2b)

MDS_DATA = _p2b.MDS_DATA
# Measured 2B points only — natural gaps in 256N are the truth of the data.
TT2B_256N_DATA = sorted(_p2b.TTV2_256N_DATA, key=lambda r: r[0])
TT2B_512N_DATA = sorted(_p2b.TTV2_512N_DATA, key=lambda r: r[0])
MDS_GBS = _p2b.MDS_GBS              # 6144
TT2B_256N_GBS = _p2b.TTV2_256N_GBS  # 6144
TT2B_512N_GBS = _p2b.TTV2_512N_GBS  # 12_288

SEQ = 8192
TT20B_512N_GBS = 12_288

# 20B v2 512N sync chain (GBS=12288, fp32 master) — canonical sweep
# from the all-production overlay (steps 100 → 3,200).
# (step, hellaswag, arc_easy, arc_challenge, winogrande)
TT20B_512N_DATA = [
    (100, 0.2537, 0.2710, 0.2321, 0.4917),
    (200, 0.2572, 0.2891, 0.2278, 0.5114),
    (300, 0.2535, 0.2950, 0.2287, 0.4917),
    (400, 0.2597, 0.3178, 0.2261, 0.5067),
    (500, 0.2661, 0.3455, 0.2227, 0.4949),
    (600, 0.2695, 0.3598, 0.2227, 0.5012),
    (700, 0.2814, 0.3914, 0.2133, 0.5012),
    (800, 0.2844, 0.4061, 0.2184, 0.4988),
    (900, 0.2963, 0.4112, 0.2244, 0.4925),
    (1_000, 0.3046, 0.4234, 0.2346, 0.5162),
    (1_200, 0.3339, 0.4373, 0.2304, 0.5154),
    (1_400, 0.3606, 0.4684, 0.2560, 0.5114),
    (1_600, 0.3922, 0.4878, 0.2619, 0.5067),
    (1_800, 0.4164, 0.5013, 0.2654, 0.5138),
    (2_000, 0.4521, 0.5379, 0.2782, 0.5067),
    (2_200, 0.4761, 0.5690, 0.3038, 0.5249),
    (2_400, 0.5023, 0.5699, 0.2995, 0.5225),
    (2_600, 0.5262, 0.5896, 0.3080, 0.5493),
    (2_700, 0.5300, 0.6044, 0.3106, 0.5343),
    (2_800, 0.5467, 0.5997, 0.3157, 0.5541),
    (2_900, 0.5556, 0.6149, 0.3225, 0.5462),
    (3_000, 0.5626, 0.6178, 0.3268, 0.5367),
    (3_100, 0.5751, 0.6107, 0.3268, 0.5627),
    (3_200, 0.5737, 0.6221, 0.3225, 0.5612),
    (3_300, 0.5793, 0.6178, 0.3268, 0.5588),
    (3_400, 0.5931, 0.6334, 0.3362, 0.5659),
    (3_500, 0.5918, 0.6376, 0.3345, 0.5549),
    (3_600, 0.6001, 0.6284, 0.3345, 0.5556),
    (3_700, 0.6020, 0.6473, 0.3370, 0.5770),
    (3_800, 0.6105, 0.6532, 0.3549, 0.5817),
    (3_900, 0.6129, 0.6587, 0.3541, 0.5738),
    (4_000, 0.6141, 0.6507, 0.3609, 0.5809),
    (4_100, 0.6198, 0.6599, 0.3618, 0.5754),
    (4_200, 0.6191, 0.6662, 0.3660, 0.5841),
    (4_300, 0.6278, 0.6646, 0.3643, 0.5943),
    (4_400, 0.6346, 0.6641, 0.3797, 0.5864),
]


def tokens(step, gbs):
    return step * gbs * SEQ / 1e9  # billions


TASKS = ['HellaSwag', 'ARC-Easy', 'ARC-Challenge', 'Winogrande']
RANDOM_BASELINE = [0.25, 0.25, 0.25, 0.50]

# Span the full 4-trajectory accuracy range. 2B-MDS late evals reach
# 0.69 on ARC-Easy; 20B 512N early evals start near 0.22 on ARC-C.
YLIM_PER_TASK = {
    # Must stay identical to the 2B chart's YLIM_PER_TASK so the
    # panels lock visually when switching slides. HellaSwag upper
    # bumped 0.60 -> 0.65 to clear 20B 512N step-4,400 (0.6346).
    'HellaSwag':     (0.25, 0.65),
    'ARC-Easy':      (0.25, 0.70),
    'ARC-Challenge': (0.20, 0.40),
    'Winogrande':    (0.48, 0.60),
}

PANEL_POS = {
    'HellaSwag':     (0, 0),
    'ARC-Easy':      (0, 1),
    'ARC-Challenge': (1, 0),
    'Winogrande':    (1, 1),
}


# Palette pinned to match the 2B-eval chart exactly. 20B 512N is
# green so the size-class jump (2B → 20B) is visually distinct from
# any within-2B comparison.
MDS_COLOR = '#2196f3'         # Material Blue 500 — bump from 400 after dry-run found the lighter shade still washed out at the back of the room
TT2B_256_COLOR = 'C1'         # red — matches 2B-eval chart's 256N
TT2B_512_COLOR = '#b71c1c'    # dark red — matches 2B-eval chart's 512N
TT20B_512_COLOR = '#1b8a3a'   # green — 20B = new model, new color

TASK_SLUG = {
    'HellaSwag':     'hellaswag',
    'ARC-Easy':      'arc-easy',
    'ARC-Challenge': 'arc-challenge',
    'Winogrande':    'winogrande',
}


def _load_chains():
    mds = np.array(MDS_DATA)
    mds_tokens = tokens(mds[:, 0], MDS_GBS)
    tt2b_256 = np.array(TT2B_256N_DATA)
    tt2b_256_tokens = tokens(tt2b_256[:, 0], TT2B_256N_GBS)
    tt2b_512 = np.array(TT2B_512N_DATA)
    tt2b_512_tokens = tokens(tt2b_512[:, 0], TT2B_512N_GBS)
    tt20b_512 = np.array(TT20B_512N_DATA)
    tt20b_512_tokens = tokens(tt20b_512[:, 0], TT20B_512N_GBS)
    return (mds, mds_tokens,
            tt2b_256, tt2b_256_tokens,
            tt2b_512, tt2b_512_tokens,
            tt20b_512, tt20b_512_tokens)


def _style_axes(ax, task: str):
    from matplotlib.ticker import FuncFormatter, MaxNLocator, FormatStrFormatter
    ax.set_title(task, pad=8)
    ax.set_xlim(0, 7_700)
    ax.xaxis.set_major_formatter(
        FuncFormatter(
            lambda x_B, _pos: (
                '0' if x_B == 0
                else f'{x_B/1000:g}T' if x_B >= 1000
                else f'{int(x_B)}B'
            )
        )
    )
    ax.set_ylim(*YLIM_PER_TASK.get(task, (0.20, 0.70)))
    ax.yaxis.set_major_locator(MaxNLocator(nbins=5, steps=[1, 2, 5, 10]))
    ax.yaxis.set_major_formatter(FormatStrFormatter('%.2f'))
    ax.grid(True, which='both', alpha=0.3)
    ax.set_xlabel('Tokens consumed (T)')
    ax.set_ylabel('Accuracy')


def _draw_lines(ax, task: str, baseline: float, i: int, chains):
    (mds, mds_tokens,
     tt2b_256, tt2b_256_tokens,
     tt2b_512, tt2b_512_tokens,
     tt20b_512, tt20b_512_tokens) = chains
    ax.axhline(baseline, ls=':', lw=1, color='gray',
               label=f'random ({baseline:.0%})', zorder=1)
    for x in (4673, 7064):
        ax.axvline(x, ls='--', lw=0.7, color='gray', alpha=0.5, zorder=0)
    # Line + marker weights bumped (ms 5 → 8, lw 1.8 → 2.2) for
    # projector legibility. MDS gets explicit markeredgewidth=2.0
    # because the 'x' glyph has no fill — its weight is set by
    # stroke width alone. Same numbers as plot-2b-eval-comparison.py.
    ax.plot(mds_tokens, mds[:, i + 1], ':x',
            color=MDS_COLOR, lw=2.2, ms=8, markeredgewidth=2.0,
            label='2B MDS', zorder=2)
    ax.plot(tt2b_256_tokens, tt2b_256[:, i + 1], '-s',
            color=TT2B_256_COLOR, lw=2.2, ms=8, zorder=3,
            label='2B TT 256N')
    ax.plot(tt2b_512_tokens, tt2b_512[:, i + 1], '-D',
            color=TT2B_512_COLOR, lw=2.2, ms=8, zorder=4,
            label='2B TT 512N')
    ax.plot(tt20b_512_tokens, tt20b_512[:, i + 1], '-^',
            color=TT20B_512_COLOR, lw=2.2, ms=8, zorder=5,
            label='20B TT 512N')
    if task == 'HellaSwag':
        from matplotlib.transforms import blended_transform_factory
        tf = blended_transform_factory(ax.transData, ax.transAxes)
        ax.text(4673, 0.97, ' (2)', color='gray', transform=tf,
                style='italic', va='top', ha='left')
        ax.text(7064, 0.97, ' (3)', color='gray', transform=tf,
                style='italic', va='top', ha='left')


def render_panel(
    task: str, out_path: Path, chains, baseline: float, i: int,
    figsize: tuple[float, float] = (8, 6),
) -> None:
    """See 2b version for figsize rationale: desktop default is 8x6,
    mobile passes a wider aspect so the panel fills its full-width
    row instead of letterboxing horizontally."""
    import ambivalent  # noqa: F401
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS_GRID)
    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)
    _draw_lines(ax, task, baseline, i, chains)
    _style_axes(ax, task)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True, bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path.name}  ({out_path.stat().st_size // 1024} KB)')


def render_legend(out_path: Path) -> None:
    """Standalone horizontal legend, banner above the panel grid.
    Font bumped to 28 so it reads at slide distance — larger than
    per-panel tick labels because the strip has no competing text."""
    import ambivalent  # noqa: F401
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS_GRID)
    fig, ax = plt.subplots(figsize=(20, 0.9))
    fig.patch.set_alpha(0)
    ax.set_axis_off()
    proxies = [
        ax.plot([], [], ':', color='gray', lw=1.5, label='random (25% / 50%)')[0],
        ax.plot([], [], ':x', color=MDS_COLOR, lw=2.2, ms=10,
                markeredgewidth=2.5, label='2B MDS')[0],
        ax.plot([], [], '-s', color=TT2B_256_COLOR, lw=2.2, ms=10, label='2B TT 256N')[0],
        ax.plot([], [], '-D', color=TT2B_512_COLOR, lw=2.2, ms=10, label='2B TT 512N')[0],
        ax.plot([], [], '-^', color=TT20B_512_COLOR, lw=2.2, ms=10, label='20B TT 512N')[0],
    ]
    ax.legend(
        handles=proxies,
        loc='center',
        ncol=len(proxies),
        frameon=False,
        handlelength=3,
        columnspacing=4,
        fontsize=28,
    )
    fig.tight_layout(pad=0)
    fig.savefig(out_path, format='svg', transparent=True, bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path.name}  ({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    out = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'
    out.mkdir(parents=True, exist_ok=True)
    chains = _load_chains()
    for i, (task, baseline) in enumerate(zip(TASKS, RANDOM_BASELINE)):
        slug = TASK_SLUG[task]
        render_panel(task, out / f'eval-20b-{slug}.svg', chains, baseline, i,
                     figsize=(8, 6))
        render_panel(task, out / f'eval-20b-{slug}-mobile.svg', chains, baseline, i,
                     figsize=(12, 5))
    render_legend(out / 'eval-20b-legend.svg')
