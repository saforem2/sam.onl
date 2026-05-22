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
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib import font_manager as _fm
from matplotlib.ticker import FuncFormatter


def _register_iosevka25():
    """Register Iosevka25 .ttf files with matplotlib's font cache."""
    if not os.path.isdir('/Library/Fonts'):
        return
    for name in os.listdir('/Library/Fonts'):
        if name.lower().startswith('iosevka25') and name.lower().endswith(('.ttf', '.otf', '.ttc')):
            _fm.fontManager.addfont(f'/Library/Fonts/{name}')


_register_iosevka25()

MDS_PARQUET = Path.home() / 'projects/saforem2/Megatron-DeepSpeed/ALCF/AuroraGPT/2B/data/loss_lm_loss_vs_tokens.parquet'

# Stage boundaries (tokens). Same source as the comparison plot.
MDS_STAGE_BOUNDARIES = [4_673e9, 7_064e9]


def render(out_path: Path):
    import ambivalent
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update({
        'font.family': ['Iosevka25', 'monospace'],
        'font.size': 16,
        'font.weight': 500,
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

    # Three shades of blue — keeps the "MDS = blue family" idiom shared
    # with the comparison slide (slide 10), and gives each stage its
    # own distinct line. Shade darkness steps with the stage number so
    # the reader can map (1)/(2)/(3) → dark/medium/light intuitively.
    MDS_STAGE_SHADES = ['#0d47a1', '#2196F3', '#90caf9']
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

    # Linear x — shows the late-stage convergence and stage transitions
    # at their natural visual weight. (Warmup gets squashed into the
    # leftmost sliver as a result; the comparison slide that follows
    # uses log-x and re-elevates that detail.) Y stays log: the loss
    # spans 12 → 2 and only reads clearly as a log curve.
    ax.set_yscale('log')
    ax.set_xlim(0, 8e3)  # 0 → 8T (a hair past the 7.77T end)
    ax.set_ylim(1.8, 14)

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
    render(out / 'loss-2b-reference.svg')
