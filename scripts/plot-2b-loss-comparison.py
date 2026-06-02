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
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from _plot_style import TALK_RCPARAMS, log_marker_indices, register_iosevka25

register_iosevka25()

# Mobile portrait variant — see plot-2b-loss-reference.py for rationale.
MOBILE = bool(os.environ.get('MOBILE'))

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
    # (TT_DATA_DIR / 'tt-v2-512n-loss.parquet', 'TorchTitan', 'TT 512N', 12_288),
    (TT_DATA_DIR / 'tt-v2-256n-loss.parquet', 'TorchTitan', 'TT 256N', 6_144),
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
    plt.rcParams.update(TALK_RCPARAMS)

    figsize = (8, 10) if MOBILE else (15, 10)
    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)

    # Pin colors for cross-slide consistency with the eval-comparison
    # slide. Both slides use MDS=C0 (blue) and TT v2=C1 (red); the
    # audience reads "blue = MDS, red = TT v2" without context-switching.
    MDS_COLOR = 'C0'
    TT_V2_COLOR = 'C1'

    # --- MDS: stage 1 only. TT v2 only reaches 2.49T, MDS stage 1 ends
    # at 4.67T; rendering stages 2/3 (continued-pretrain, math+code)
    # just adds two faint blips at the right edge that aren't in the
    # comparison's scope. When TT crosses 4.67T we can bring stage 2
    # back. Kept the dark-blue shade so the line still reads as "MDS"
    # via the eval-slide color pairing.
    # Same mid blue as stage-1 in plot-2b-loss-reference.py and the
    # MDS series in plot-2b-eval-comparison.py — keeps the audience
    # mapping "this blue = MDS" stable across all three slides.
    # Material Blue 400; bumped up from Blue 700 (#1976d2) because the
    # darker shade washed out on the conference projector during dry-runs.
    MDS_STAGE_COLOR = '#42a5f5'
    mds = pd.read_parquet(MDS_PARQUET).sort_values('x').reset_index(drop=True)
    mds_s1 = mds[mds['group_data_file'] == 'olmo-mix-1124.txt']
    mds_x_B = mds_s1['x'].values / 1e9
    ax.plot(mds_x_B, mds_s1['y'].values,
            color=MDS_STAGE_COLOR, lw=1.8, label='Megatron-DeepSpeed',
            marker='x', markevery=log_marker_indices(mds_x_B, n_target=8),
            ms=11, markeredgewidth=2,
            zorder=3)

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
                        marker='s', markevery=log_marker_indices(tt_tokens_B, n_target=8),
                        ms=11, markeredgewidth=0,
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
    # (mds_x_B + mds_y captured above; the matched-x value is consumed
    # by the combined Δ annotation further down.)

    # Single combined annotation at the matched-x endpoint — the slide's
    # whole point is "MDS loss ≈ TT loss at the same token budget", so
    # show both numbers and the delta in one place rather than spreading
    # them across two annotations the audience has to mentally diff.
    if tt_endpoints:
        # Use the first (=longest) TT chain's endpoint as the matched-x
        # reference; mds_endpoint already pinned to that x above.
        tt_step, tt_loss, tt_tok, tt_color, tt_tag = tt_endpoints[0]
        delta = abs(tt_loss - mds_y)
        ax.annotate(
            f'{tt_loss:.3f} @ {mds_x_B/1000:.2f}T tokens\n'
            f'δ = {delta:.3f}',
            xy=(tt_tok, (mds_y + tt_loss) / 2),  # point at midpoint between the two
            xytext=(0.82, 0.30),
            xycoords='data', textcoords='axes fraction',
            fontsize=20, ha='left', va='center',
            color=tt_color,
            arrowprops={'arrowstyle': '-', 'color': tt_color,
                        'lw': 1.0, 'alpha': 0.6,
                        'connectionstyle': 'angle3,angleA=0,angleB=90'},
        )
    else:
        # Fallback: MDS-only annotation if no TT chain available
        ax.annotate(
            f'MDS: loss {mds_y:.2f}',
            xy=(mds_x_B, mds_y),
            xytext=(0.92, 0.20),
            xycoords='data', textcoords='axes fraction',
            fontsize=12, ha='right', va='center',
            color=MDS_STAGE_COLOR,
            arrowprops={'arrowstyle': '-', 'color': MDS_STAGE_COLOR,
                        'lw': 1.0, 'alpha': 0.6,
                        'connectionstyle': 'angle3,angleA=0,angleB=90'},
        )

    ax.set_xscale('log')
    ax.set_yscale('log')
    # Cap at 3T (TT's 2.49T endpoint with a hair of headroom). MDS
    # stage 1 ends at 4.67T but we're trimming to the comparison's
    # actual span. Y floor at 2.4 since neither curve dips below ~2.66
    # in this range.
    ax.set_xlim(1, 3_000)
    ax.set_ylim(2.4, 13.5)
    # Keep underlying data in B (consistent with internal tokens math),
    # but format tick labels as trillions for the audience-facing axis.
    from matplotlib.ticker import FuncFormatter

    def _b_to_t(x_B, _pos):
        return f'{x_B / 1000.0:g}T'
    ax.xaxis.set_major_formatter(FuncFormatter(_b_to_t))
    ax.set_xlabel('Tokens consumed (T)')
    ax.set_ylabel('LM training loss')
    ax.grid(True, which='both', alpha=0.3)

    # Stage-boundary callouts dropped: the 4.67T / 7.06T boundaries
    # are off-chart now that we've capped x at 3T to match TT's span.

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
    fname = 'loss-2b-compare-mobile.svg' if MOBILE else 'loss-2b-compare.svg'
    render(out / fname)
