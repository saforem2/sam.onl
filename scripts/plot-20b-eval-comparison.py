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
# Merge measured + interpolated 2B series so the 20B chart shows the
# same continuous lines as the 2B-eval slide. Interp values come from
# the offset-method gap-fill in the 2B script (see TTV2_256N_INTERP_DATA
# / TTV2_512N_INTERP_DATA there for method + caveats).
TT2B_256N_DATA = sorted(_p2b.TTV2_256N_DATA + _p2b.TTV2_256N_INTERP_DATA,
                        key=lambda r: r[0])
TT2B_512N_DATA = sorted(_p2b.TTV2_512N_DATA + _p2b.TTV2_512N_INTERP_DATA,
                        key=lambda r: r[0])
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
]


def tokens(step, gbs):
    return step * gbs * SEQ / 1e9  # billions


TASKS = ['HellaSwag', 'ARC-Easy', 'ARC-Challenge', 'Winogrande']
RANDOM_BASELINE = [0.25, 0.25, 0.25, 0.50]

# Span the full 4-trajectory accuracy range. 2B-MDS late evals reach
# 0.69 on ARC-Easy; 20B 512N early evals start near 0.22 on ARC-C.
YLIM_PER_TASK = {
    # Must stay identical to the 2B chart's YLIM_PER_TASK so the
    # panels lock visually when switching slides.
    'HellaSwag':     (0.25, 0.60),
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


def render(out_path: Path):
    import ambivalent
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS_GRID)

    fig, axes = plt.subplots(2, 2, figsize=(16, 9), sharex=True)
    fig.patch.set_alpha(0)

    mds = np.array(MDS_DATA)
    mds_tokens = tokens(mds[:, 0], MDS_GBS)
    tt2b_256 = np.array(TT2B_256N_DATA)
    tt2b_256_tokens = tokens(tt2b_256[:, 0], TT2B_256N_GBS)
    tt2b_512 = np.array(TT2B_512N_DATA)
    tt2b_512_tokens = tokens(tt2b_512[:, 0], TT2B_512N_GBS)
    tt20b_512 = np.array(TT20B_512N_DATA)
    tt20b_512_tokens = tokens(tt20b_512[:, 0], TT20B_512N_GBS)

    # Marker subsampling — linear x, so evenly-spaced markers by tokens
    # not by step (steps × GBS gives different token strides per chain).
    # Pick ~6-7 markers per chain on the 0-3T axis = one marker every
    # ~400-500B. Drop early-warmup markers since they'd cluster at x≈0.
    TT2B_256N_MARKER_STEPS = [8_000, 14_000, 20_000, 25_000, 30_000,
                              38_000, 44_000, 49_500]
    TT2B_512N_MARKER_STEPS = [4_000, 7_000, 10_000, 13_000, 16_000,
                              19_000, 21_000, 24_000, 27_000]
    # 20B 512N has 24 points across 0.01T → 0.32T tokens; pick 6 evenly.
    TT20B_512N_MARKER_STEPS = [100, 600, 1_200, 1_800, 2_400, 3_200]

    def _markers_at(arr, tok, steps):
        idx = [int(np.where(arr[:, 0] == s)[0][0]) for s in steps]
        return arr[idx], tok[idx]

    tt2b_256_m, tt2b_256_tokens_m = _markers_at(
        tt2b_256, tt2b_256_tokens, TT2B_256N_MARKER_STEPS)
    tt2b_512_m, tt2b_512_tokens_m = _markers_at(
        tt2b_512, tt2b_512_tokens, TT2B_512N_MARKER_STEPS)
    tt20b_512_m, tt20b_512_tokens_m = _markers_at(
        tt20b_512, tt20b_512_tokens, TT20B_512N_MARKER_STEPS)

    # Palette: 2B series match the 2B-eval chart exactly so the audience
    # reads the same colors across both slides ("blue = MDS reference,
    # red = TT v2 256N, dark red = TT v2 512N"). 20B 512N is green so
    # the size-class jump (2B → 20B) is visually distinct from any
    # within-2B comparison.
    MDS_COLOR = '#1976d2'         # mid blue: readable on both light + dark bg
    TT2B_256_COLOR = 'C1'         # red — matches 2B-eval chart's 256N
    TT2B_512_COLOR = '#b71c1c'    # dark red — matches 2B-eval chart's 512N
    TT20B_512_COLOR = '#1b8a3a'   # green — 20B = new model, new color

    for i, (task, baseline) in enumerate(zip(TASKS, RANDOM_BASELINE)):
        row, col = PANEL_POS[task]
        ax = axes[row][col]
        ax.patch.set_alpha(0)

        ax.axhline(baseline, ls=':', lw=1, color='gray',
                   label=f'random ({baseline:.0%})', zorder=1)

        # MDS stage-boundary annotations (matches 2B-eval chart). The
        # 2B MDS trajectory ran in 3 stages: (1) olmo-mix-1124 pretrain
        # 0 → 4673B, (2) dolmino-mix-1124 continued-pretrain 4673B →
        # 7064B, (3) Nvidia CC-Math + Nemotron Code 7064B → 7770B.
        for x in (4673, 7064):
            ax.axvline(x, ls='--', lw=0.7, color='gray',
                       alpha=0.5, zorder=0)

        # 2B-MDS: dotted line + × markers (matches 2B-eval chart).
        ax.plot(mds_tokens, mds[:, i + 1], ':x',
                color=MDS_COLOR, lw=1.8, ms=5,
                label='2B MDS', zorder=2)
        # 2B/20B TT chains: line through every datapoint + small
        # markers, matching upstream plot_evals_combined.py style
        # (lw=1.8, ms=5, alpha=0.9). Plays down per-checkpoint eval
        # noise vs chunky markers that amplify it.
        ax.plot(tt2b_256_tokens, tt2b_256[:, i + 1], '-s',
                color=TT2B_256_COLOR, lw=1.8, ms=5, alpha=0.9,
                zorder=3, label='2B TT 256N')
        ax.plot(tt2b_512_tokens, tt2b_512[:, i + 1], '-D',
                color=TT2B_512_COLOR, lw=1.8, ms=5, alpha=0.9,
                zorder=4, label='2B TT 512N')
        ax.plot(tt20b_512_tokens, tt20b_512[:, i + 1], '-^',
                color=TT20B_512_COLOR, lw=1.8, ms=5, alpha=0.9,
                zorder=5, label='20B TT 512N')

        ax.set_title(task, pad=8)
        # Linear x — full 0-7.7T range so MDS reference trajectory is
        # visible end-to-end (it reaches ~7.04T tokens at step 140K).
        # 20B chain compresses to leftmost ~4% but the per-token gain
        # vs the 2B chains is still readable from the slope.
        ax.set_xlim(0, 7_700)
        from matplotlib.ticker import FuncFormatter
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
        # Y-ticks match the 2B chart: MaxNLocator + 2-decimal format.
        from matplotlib.ticker import MaxNLocator, FormatStrFormatter
        ax.yaxis.set_major_locator(MaxNLocator(nbins=5, steps=[1, 2, 5, 10]))
        ax.yaxis.set_major_formatter(FormatStrFormatter('%.2f'))
        ax.grid(True, which='both', alpha=0.3)

        if col == 0:
            ax.set_ylabel('Accuracy')
        if row == 1:
            ax.set_xlabel('Tokens consumed (T)')
        # Stage callouts only on the top-left panel (ARC-Challenge per
        # PANEL_POS). Blended transform: x in data coords (lines up
        # with the 4673/7064 boundaries on the token axis), y in axes
        # fraction (stays near the top edge regardless of per-task ylim).
        if (row, col) == (0, 0):
            from matplotlib.transforms import blended_transform_factory
            tf = blended_transform_factory(ax.transData, ax.transAxes)
            ax.text(4673, 0.97, ' (2)', color='gray', transform=tf,
                    style='italic', va='top', ha='left')
            ax.text(7064, 0.97, ' (3)', color='gray', transform=tf,
                    style='italic', va='top', ha='left')

    handles, labels = axes[-1][-1].get_legend_handles_labels()
    fig.legend(
        handles, labels,
        loc='upper center',
        bbox_to_anchor=(0.5, 0.97),
        ncol=len(labels),
        frameon=False,
        fontsize=18,
    )

    fig.suptitle('AuroraGPT eval — all-production overlay (2B + 20B)',
                 y=1.02)
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    fig.savefig(out_path, format='svg', transparent=True,
                bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path}  ({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    out = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'
    out.mkdir(parents=True, exist_ok=True)
    render(out / 'eval-20b-compare.svg')
