"""
Compare AuroraGPT-2B training loss across runs:
  - MDS:    Megatron-DeepSpeed SophiaG, full 3-stage trajectory
            (from `Megatron-DeepSpeed/ALCF/AuroraGPT/2B/data/loss_lm_loss_vs_tokens.parquet`)
  - TT-v2:  torchtitan 512N production chain, full per-step curve
            (deduped from W&B via `scripts/fetch-tt-v2-loss.py` →
            `web/public/talks/2026-06-03/data/tt-v2-512n-loss.parquet`)

X-axis: tokens consumed (log scale).
Y-axis: training loss (log scale, matches MDS report convention).

Renders one transparent SVG that works on both site themes — same
pattern as plot-2b-eval-comparison.py.
"""

import os
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib import font_manager as _fm


def _register_iosevka25():
    """Register every Iosevka25 .ttf in /Library/Fonts/ with matplotlib.

    matplotlib's bundled font cache often doesn't see fonts installed
    outside ~/.fonts; this scans /Library/Fonts/ once per process so we
    don't depend on a manual font-cache rebuild.
    """
    if not os.path.isdir('/Library/Fonts'):
        return
    for name in os.listdir('/Library/Fonts'):
        if name.lower().startswith('iosevka25') and name.lower().endswith(('.ttf', '.otf', '.ttc')):
            _fm.fontManager.addfont(f'/Library/Fonts/{name}')


_register_iosevka25()

MDS_PARQUET = Path.home() / 'projects/saforem2/Megatron-DeepSpeed/ALCF/AuroraGPT/2B/data/loss_lm_loss_vs_tokens.parquet'

# TT-v2 chains: (path, label, GBS). Same-node-count comparison with
# the MDS reference run (which is also 256N), so 512N is fetched +
# kept in the parquet but excluded from the slide chart — different
# batch size, different per-token learning, different story.
TT_DATA_DIR = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/data'
# Tuple format: (parquet path, short label for legend, annotation tag,
# global batch size). Keeping the legend label terse so the audience
# isn't reading config trivia mid-talk; full config lives in the
# slide caption.
TT_CHAINS = [
    # (TT_DATA_DIR / 'tt-v2-512n-loss.parquet', 'TT', 'TT 512N', 12_288),
    (TT_DATA_DIR / 'tt-v2-256n-loss.parquet', 'TT', 'TT 256N', 6_144),
]
TT_SEQ = 8_192

# MDS stage boundaries (tokens). From the model card:
#   stage 1 (olmo-mix):       0 → 4.673T
#   stage 2 (dolmino-mix):  4.673T → 7.064T
#   stage 3 (math+code):    7.064T → 7.770T
MDS_STAGE_BOUNDARIES = [4_673e9, 7_064e9]


def render(out_path: Path):
    import ambivalent
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update({
        # Iosevka25 matches the site's display font (Iosevka Web fallback);
        # monospace family is the final fallback if it isn't registered.
        'font.family': ['Iosevka25', 'monospace'],
        'font.size': 16,            # bumped from 14 — easier from the back
        'font.weight': 500,         # medium — between regular (400) and bold (700)
        'axes.titlesize': 18,
        'axes.titleweight': 600,
        'axes.labelsize': 16,
        'axes.labelweight': 500,
        'xtick.labelsize': 14,
        'ytick.labelsize': 14,
        'legend.fontsize': 14,
        'axes.spines.top': False,
        'axes.spines.right': False,
    })

    fig, ax = plt.subplots(figsize=(11, 6.5))
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)

    # Pin colors for cross-slide consistency with the eval-comparison
    # slide. Both slides use MDS=C0 (blue) and TT v2=C1 (red); the
    # audience reads "blue = MDS, red = TT v2" without context-switching.
    MDS_COLOR = 'C0'
    TT_V2_COLOR = 'C1'

    # --- MDS: full parquet, group by stage. Three shades of blue —
    # stage 1 dark, stage 2 medium, stage 3 light — so the curves stay
    # in the "MDS = blue family" visual idiom but each stage reads as
    # its own distinct line. (Previously used alpha-stepping on a single
    # blue, which made stages 2 and 3 hard to see.) All shades are
    # fully opaque so they don't fade against the chart background.
    MDS_STAGE_SHADES = ['#0d47a1', '#2196F3', '#90caf9']  # dark / med / light
    mds = pd.read_parquet(MDS_PARQUET).sort_values('x').reset_index(drop=True)
    stage_render = [
        ('olmo-mix-1124.txt',
         'MDS (1) pretrain',                 MDS_STAGE_SHADES[0], 1.8),
        ('dolmino-mix-1124-fused-file-list.txt',
         'MDS (2) continued-pretrain',       MDS_STAGE_SHADES[1], 1.6),
        ('stage1-33-stage2-33-stage3-34.txt',
         'MDS (3) math+code',                MDS_STAGE_SHADES[2], 1.4),
    ]
    for stage, label, color, lw in stage_render:
        sub = mds[mds['group_data_file'] == stage]
        if len(sub) == 0:
            continue
        ax.plot(sub['x'].values / 1e9, sub['y'].values,
                color=color, lw=lw, label=label, zorder=3)

    for b in MDS_STAGE_BOUNDARIES:
        ax.axvline(b / 1e9, ls='--', lw=0.7, color='gray',
                   alpha=0.5, zorder=0)

    # --- TT v2 chains: pinned to TT_V2_COLOR so the series matches
    # the eval slide. If multiple chains are enabled (e.g. 256N + 512N),
    # later chains step down through linestyles instead of grabbing
    # different palette slots.
    chain_styles = [('-', 2.2), ('--', 2.0), (':', 1.8)]
    tt_endpoints = []
    for (path, label, tag, gbs), (ls, lw) in zip(TT_CHAINS, chain_styles):
        if not path.exists():
            print(f"  skipping missing {path.name}")
            continue
        tt = pd.read_parquet(path)
        tt_tokens_B = tt['step'].values * gbs * TT_SEQ / 1e9
        line, = ax.plot(tt_tokens_B, tt['loss'].values,
                        color=TT_V2_COLOR, lw=lw, ls=ls,
                        label=label,
                        zorder=5, alpha=0.95)
        tt_endpoints.append((
            int(tt['step'].iloc[-1]),
            float(tt['loss'].iloc[-1]),
            float(tt_tokens_B[-1]),
            line.get_color(),
            tag,
        ))

    # Annotate MDS at the same token point as TT's final step. The whole
    # point of the slide is "TT tracks MDS"; comparing the two losses at
    # matched x makes that quantitative. Fall back to MDS's own final
    # point if no TT chain is enabled.
    if tt_endpoints:
        tt_final_x = max(e[2] for e in tt_endpoints)
        mds_sorted = mds.sort_values('x')
        nearest = mds_sorted.iloc[(mds_sorted['x'] - tt_final_x * 1e9).abs().argmin()]
        mds_x_B = float(nearest['x']) / 1e9
        mds_y = float(nearest['y'])
    else:
        mds_final = mds.sort_values('x').iloc[-1]
        mds_x_B = float(mds_final['x']) / 1e9
        mds_y = float(mds_final['y'])
    # Annotation color = the stage the matched-x falls in (stage 1 for
    # the typical ~777B-token TT endpoint).
    mds_endpoint = (None, mds_y, mds_x_B, MDS_STAGE_SHADES[0], 'MDS 256N')

    # Stack annotations: anchor each to the lower-right corner so they
    # don't overlap each other or the legend. Diagonal connector lines
    # in each series' own color so the audience can tell which goes with
    # which without squinting at color matching at the data point itself.
    # Y-positions are in axes-fraction so they're stable across rescales.
    all_endpoints = [mds_endpoint, *tt_endpoints]
    anno_xys = [(0.92, 0.42), (0.92, 0.30), (0.92, 0.18)]
    # Sort by loss so the higher-loss series gets the upper slot.
    all_endpoints.sort(key=lambda e: -e[1])
    for (step, loss, tok, color, tag), (ax_x, ax_y) in zip(all_endpoints, anno_xys):
        # Drop the step count — it's TT-specific bookkeeping and the
        # tag (256N) + loss are what the audience cares about.
        text = f'{tag}: loss {loss:.2f}'
        ax.annotate(
            text,
            xy=(tok, loss),
            xytext=(ax_x, ax_y),
            xycoords='data', textcoords='axes fraction',
            fontsize=11, ha='right', va='center',
            color=color,
            arrowprops={'arrowstyle': '-', 'color': color,
                        'lw': 1.0, 'alpha': 0.7,
                        'connectionstyle': 'angle3,angleA=0,angleB=90'},
        )

    ax.set_xscale('log')
    ax.set_yscale('log')
    # Crop the leftmost decades: < 5B tokens is warmup (loss > 6), not
    # part of the run comparison this chart is about. Both runs have
    # already converged the easy "predict the next gemma token from
    # frequency" loss by ~10B, so the interesting separation lives in
    # the 10B → 10T range.
    ax.set_xlim(5, 1e4)
    ax.set_ylim(1.8, 14)
    # Keep underlying data in B (consistent with internal tokens math),
    # but format tick labels as trillions for the audience-facing axis.
    from matplotlib.ticker import FuncFormatter

    def _b_to_t(x_B, _pos):
        t = x_B / 1000.0
        return f'{t:g}T' if t >= 1 else f'{t:g}T'
    ax.xaxis.set_major_formatter(FuncFormatter(_b_to_t))
    ax.set_xlabel('Tokens consumed (T)')
    ax.set_ylabel('LM training loss')
    ax.grid(True, which='both', alpha=0.3)

    for x_T, label in zip(MDS_STAGE_BOUNDARIES, ['(2)', '(3)']):
        ax.text(x_T / 1e9, 13.5, f' {label}', fontsize=11,
                color='gray', style='italic', va='top', ha='left')

    ax.legend(loc='upper right', framealpha=0)
    ax.set_title('AuroraGPT-2B  —  training loss vs tokens', pad=10)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True,
                bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path}  ({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    out = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'
    out.mkdir(parents=True, exist_ok=True)
    render(out / 'loss-2b-compare.svg')
