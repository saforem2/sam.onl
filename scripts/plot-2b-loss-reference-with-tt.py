"""
Render the AuroraGPT-2B MDS reference loss curve (same 3-stage chart
as plot-2b-loss-reference.py) with the TorchTitan 256N production run
overlaid on top.

The overlay sits in the same axes / units as the MDS curve so the
audience can see the TT trajectory start *inside* the MDS pretrain
region and track it forward — answering "how does our v2 stack
compare to the reference" without needing a second slide.

Source:
  - MDS:  ~/projects/saforem2/Megatron-DeepSpeed/.../loss_lm_loss_vs_tokens.parquet
  - TT v2 256N: web/public/talks/2026-06-03/data/tt-v2-256n-loss.parquet
Output: web/public/talks/2026-06-03/figures/loss-2b-reference-with-tt.svg
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.ticker import FuncFormatter, LogLocator, ScalarFormatter

sys.path.insert(0, str(Path(__file__).parent))
from _plot_style import TALK_RCPARAMS, register_iosevka25

register_iosevka25()

MDS_PARQUET = Path.home() / 'projects/saforem2/Megatron-DeepSpeed/ALCF/AuroraGPT/2B/data/loss_lm_loss_vs_tokens.parquet'
TT_PARQUET = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/data/tt-v2-256n-loss.parquet'

# Stage boundaries (tokens).
MDS_STAGE_BOUNDARIES = [4_673e9, 7_064e9]

# TT v2 256N config — must match fetch-tt-v2-loss.py.
TT_GBS = 6_144
TT_SEQ = 8_192


def render(out_path: Path):
    import ambivalent
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS)

    fig, ax = plt.subplots(figsize=(14, 8))
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)

    # MDS 3-stage trajectory — same palette as plot-2b-loss-reference
    # for cross-slide consistency.
    MDS_STAGE_SHADES = ['#0d2c6b', '#1976d2', '#42a5f5']
    mds = pd.read_parquet(MDS_PARQUET).sort_values('x').reset_index(drop=True)
    stage_render = [
        ('olmo-mix-1124.txt',                    'MDS (1) pretrain',           MDS_STAGE_SHADES[0]),
        ('dolmino-mix-1124-fused-file-list.txt', 'MDS (2) continued-pretrain', MDS_STAGE_SHADES[1]),
        ('stage1-33-stage2-33-stage3-34.txt',    'MDS (3) math+code',          MDS_STAGE_SHADES[2]),
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

    # TorchTitan 256N production run — overlay in the same matching
    # red used on the loss-comparison and eval-comparison slides so the
    # audience reads "blue = MDS, red = TT" identically across all
    # three 2B-result charts.
    tt = pd.read_parquet(TT_PARQUET).sort_values('step').reset_index(drop=True)
    tt_tokens_B = tt['step'].values * TT_GBS * TT_SEQ / 1e9
    ax.plot(tt_tokens_B, tt['loss'].values,
            color='C1', lw=2.0, label='TorchTitan (256N)',
            zorder=4, alpha=0.95)

    # MDS endpoint annotation (kept from the reference plot).
    final = mds.iloc[-1]
    final_tokens_B = float(final['x']) / 1e9
    final_loss = float(final['y'])
    ax.annotate(
        f'MDS final: loss {final_loss:.2f}\n@ {final_tokens_B/1000:.2f}T tokens',
        xy=(final_tokens_B, final_loss),
        xytext=(0.92, 0.22),
        xycoords='data', textcoords='axes fraction',
        fontsize=14, ha='right', va='center',
        color=MDS_STAGE_SHADES[2],
        arrowprops={'arrowstyle': '-', 'color': MDS_STAGE_SHADES[2],
                    'lw': 1.0, 'alpha': 0.7,
                    'connectionstyle': 'angle3,angleA=0,angleB=90'},
    )

    # TT endpoint annotation — call out the current TT loss/tokens.
    tt_final_loss = float(tt['loss'].iloc[-1])
    tt_final_tok_B = float(tt_tokens_B[-1])
    ax.annotate(
        f'TT: loss {tt_final_loss:.2f}\n@ {tt_final_tok_B/1000:.2f}T tokens',
        xy=(tt_final_tok_B, tt_final_loss),
        xytext=(0.55, 0.42),
        xycoords='data', textcoords='axes fraction',
        fontsize=14, ha='left', va='center',
        color='C1',
        arrowprops={'arrowstyle': '-', 'color': 'C1',
                    'lw': 1.0, 'alpha': 0.7,
                    'connectionstyle': 'angle3,angleA=0,angleB=90'},
    )

    ax.set_yscale('log')
    ax.set_xlim(0, 8e3)
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
    ax.set_title('AuroraGPT-2B  —  MDS reference + TorchTitan (256N)',
                 pad=10)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True,
                bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path}  ({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    out = Path.home() / 'projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures'
    out.mkdir(parents=True, exist_ok=True)
    render(out / 'loss-2b-reference-with-tt.svg')
