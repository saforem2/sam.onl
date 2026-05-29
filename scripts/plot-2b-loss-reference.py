"""
Render the AuroraGPT-2B MDS reference loss curve — three-stage
trajectory, no TT comparison overlay.

Same styling as plot-2b-loss-comparison.py (Iosevka25, ambivalent
palette, heavy lines, T-formatted x-axis) so slides 9 and 10 share a
visual idiom.

Source: same parquet as the comparison chart.
Output: web/public/talks/2026-06-03/figures/loss-2b-reference.svg
"""

import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.ticker import FuncFormatter, LogLocator, ScalarFormatter

sys.path.insert(0, str(Path(__file__).parent))
from _plot_style import TALK_RCPARAMS, register_iosevka25

register_iosevka25()

# Mobile portrait variant — single-panel chart, swap to a slightly
# taller-than-wide figsize so the line shape isn't crushed in a thin
# landscape band on a phone in portrait orientation.
MOBILE = bool(os.environ.get('MOBILE'))

MDS_PARQUET = Path.home() / 'projects/saforem2/Megatron-DeepSpeed/ALCF/AuroraGPT/2B/data/loss_lm_loss_vs_tokens.parquet'

# Stage boundaries (tokens). Same source as the comparison plot.
MDS_STAGE_BOUNDARIES = [4_673e9, 7_064e9]


def render(out_path: Path):
    import ambivalent
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS)

    figsize = (8, 10) if MOBILE else (14, 8)
    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)

    # Three shades of blue — keeps the "MDS = blue family" idiom shared
    # with the comparison slide (slide 10), and gives each stage its
    # own distinct line. Shade darkness steps with the stage number so
    # the reader can map (1)/(2)/(3) → dark/medium/light intuitively.
    # Three blue shades, all dark enough to be visible on white
    # projector backgrounds in a presentation hall.
    # Shifted one step lighter from the old [#0d2c6b, #1976d2, #42a5f5]
    # ramp so stage (1) reads on dark backgrounds too (the old dark
    # navy disappeared on mobile dark theme). Same Material blue ramp,
    # just one rung up.
    MDS_STAGE_SHADES = ['#1976d2', '#42a5f5', '#90caf9']
    mds = pd.read_parquet(MDS_PARQUET).sort_values('x').reset_index(drop=True)
    stage_render = [
        ('olmo-mix-1124.txt',                    '(1) pretrain',            MDS_STAGE_SHADES[0]),
        ('dolmino-mix-1124-fused-file-list.txt', '(2) continued-pretrain',  MDS_STAGE_SHADES[1]),
        ('stage1-33-stage2-33-stage3-34.txt',    '(3) math+code',           MDS_STAGE_SHADES[2]),
    ]
    for stage, label, color in stage_render:
        sub = mds[mds['group_data_file'] == stage]
        if len(sub) == 0:
            continue
        ax.plot(sub['x'].values / 1e9, sub['y'].values,
                color=color, lw=2.2, label=label,
                zorder=3, alpha=0.95)

    for b in MDS_STAGE_BOUNDARIES:
        ax.axvline(b / 1e9, ls='--', lw=0.7, color='gray',
                   alpha=0.5, zorder=0)

    # Endpoint annotation — final loss at the end of math+code.
    final = mds.iloc[-1]
    final_tokens_B = float(final['x']) / 1e9
    final_loss = float(final['y'])
    ax.annotate(
        f'final: loss {final_loss:.2f}\n@ {final_tokens_B/1000:.2f}T tokens',
        xy=(final_tokens_B, final_loss),
        xytext=(0.92, 0.22),
        xycoords='data', textcoords='axes fraction',
        fontsize=14, ha='right', va='center',
        color=MDS_STAGE_SHADES[2],
        arrowprops={'arrowstyle': '-', 'color': MDS_STAGE_SHADES[2],
                    'lw': 1.0, 'alpha': 0.7,
                    'connectionstyle': 'angle3,angleA=0,angleB=90'},
    )

    # Log-y with plain decimal labels (2, 3, 4, …) instead of the
    # default scientific 2×10⁰ notation. LogLocator pulls the standard
    # decade subdivisions; ScalarFormatter renders them as bare numbers.
    ax.set_yscale('log')
    ax.set_xlim(0, 8e3)  # 0 → 8T (a hair past the 7.77T end)
    ax.set_ylim(1.8, 14)
    ax.yaxis.set_major_locator(LogLocator(base=10.0, subs=(1.0,)))
    ax.yaxis.set_minor_locator(
        LogLocator(base=10.0, subs=(2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0))
    )
    ax.yaxis.set_major_formatter(ScalarFormatter())
    ax.yaxis.set_minor_formatter(ScalarFormatter())

    def _b_to_t(x_B, _pos):
        return f'{x_B / 1000:g}T'
    ax.xaxis.set_major_formatter(FuncFormatter(_b_to_t))
    ax.set_xlabel('Tokens consumed (T)')
    ax.set_ylabel('LM training loss')
    ax.grid(True, which='both', alpha=0.3)

    ax.legend(loc='upper right', framealpha=0)
    ax.set_title('AuroraGPT-2B  —  training loss (3 stages)', pad=10)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True,
                bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path}  ({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    out = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'
    out.mkdir(parents=True, exist_ok=True)
    fname = 'loss-2b-reference-mobile.svg' if MOBILE else 'loss-2b-reference.svg'
    render(out / fname)
