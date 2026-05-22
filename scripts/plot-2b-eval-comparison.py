"""
Compare 2B model lm-eval trajectories across three runs:
  - MDS:    Megatron-DeepSpeed SophiaG, 28 evals (5K-140K steps, 4 tasks)
  - TT-v1:  torchtitan first cut (bf16 master, RMSNorm-freeze bug), 18 evals
  - TT-v2:  torchtitan post-fix (fp32 master), 512N, 13 evals × 4 tasks

X-axis: tokens consumed (log scale, common across the three runs).
Y-axis: accuracy (`acc`).

Renders one figure with a 2x2 task grid, in both light and dark variants.

Data source for v2: the 2026-05-22 refresh in
  torchtitan/experiments/ezpz/docs/evals/agpt/2b/README.md
"""

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

# ----- DATA ------------------------------------------------------------------

# All step counts × seq_len × GBS to get tokens. GBS varies per run:
#   MDS:    GBS=6144,   seq=8192  ->  50.3M tokens/step
#   TT-v1:  GBS=3072,   seq=8192  ->  25.2M tokens/step  (from README)
#   TT-v2:  GBS=12_288, seq=8192  -> 100.7M tokens/step  (v2 512N, the
#                                                          "full sweep" data
#                                                          in the 2026-05-22
#                                                          README refresh)
SEQ = 8192
MDS_GBS = 6144
TTV1_GBS = 3072
TTV2_GBS = 12_288

# MDS: Megatron-DeepSpeed SophiaG, full eval trajectory.
MDS_DATA = [
    # (step, hellaswag, arc_easy, arc_challenge, winogrande)
    (5_000, 0.3598, 0.4822, 0.2654, 0.5014),
    (10_000, 0.4575, 0.5219, 0.2753, 0.5101),
    (15_000, 0.5030, 0.5533, 0.3040, 0.5409),
    (20_000, 0.5231, 0.5634, 0.3046, 0.5567),
    (25_000, 0.5421, 0.5800, 0.3131, 0.5522),
    (30_000, 0.5531, 0.5821, 0.2935, 0.5617),
    (35_000, 0.5561, 0.5919, 0.3148, 0.5659),
    (40_000, 0.5640, 0.5819, 0.3120, 0.5717),
    (45_000, 0.5692, 0.6052, 0.3257, 0.5583),
    (50_000, 0.5727, 0.6000, 0.3294, 0.5806),
    (55_000, 0.5784, 0.6083, 0.3333, 0.5801),
    (60_000, 0.5801, 0.5960, 0.3299, 0.5733),
    (65_000, 0.5885, 0.6013, 0.3353, 0.5727),
    (70_000, 0.5838, 0.6230, 0.3342, 0.5714),
    (75_000, 0.5887, 0.6055, 0.3436, 0.5725),
    (80_000, 0.5911, 0.6093, 0.3333, 0.5691),
    (85_000, 0.5900, 0.6180, 0.3336, 0.5688),
    (90_000, 0.5887, 0.6244, 0.3362, 0.5780),
    (95_000, 0.6004, 0.6660, 0.3623, 0.5770),
    (100_000, 0.5937, 0.6675, 0.3746, 0.5859),
    (105_000, 0.5944, 0.6953, 0.3845, 0.6004),
    (110_000, 0.5921, 0.6637, 0.3817, 0.5777),
    (115_000, 0.5897, 0.6937, 0.3914, 0.5946),
    (120_000, 0.5910, 0.6985, 0.3862, 0.5864),
    (125_000, 0.5920, 0.6921, 0.3808, 0.5827),
    (130_000, 0.5947, 0.6918, 0.3840, 0.5846),
    (135_000, 0.5932, 0.6514, 0.3732, 0.5877),
    (140_000, 0.5924, 0.6658, 0.3712, 0.5806),
]

# TT-v1: torchtitan first cut, bf16-master, RMSNorm-freeze bug.
TTV1_DATA = [
    (1_000, 0.2535, 0.2744, 0.2338, 0.4783),
    (2_000, 0.2526, 0.2719, 0.2423, 0.4957),
    (3_000, 0.2525, 0.2689, 0.2355, 0.5107),
    (4_000, 0.2512, 0.2698, 0.2406, 0.4846),
    (5_000, 0.2509, 0.2698, 0.2406, 0.4901),
    (6_000, 0.2510, 0.2748, 0.2423, 0.4854),
    (7_000, 0.2539, 0.2719, 0.2355, 0.4988),
    (8_000, 0.2535, 0.2698, 0.2449, 0.5107),
    (9_000, 0.2517, 0.2723, 0.2406, 0.4767),
    (10_000, 0.2507, 0.2782, 0.2381, 0.4886),
    (11_000, 0.2536, 0.2668, 0.2415, 0.4799),
    (12_000, 0.2504, 0.2731, 0.2406, 0.4909),
    (13_000, 0.2511, 0.2731, 0.2415, 0.4901),
    (14_000, 0.2500, 0.2748, 0.2457, 0.4988),
    (15_000, 0.2517, 0.2778, 0.2415, 0.5099),
    (16_000, 0.2527, 0.2744, 0.2415, 0.4996),
    (17_000, 0.2516, 0.2673, 0.2560, 0.4980),
    (18_000, 0.2522, 0.2727, 0.2500, 0.4949),
]

# TT-v2: torchtitan post-fix (fp32-master), 512N full sweep
# (2026-05-22 README refresh). `acc` (not `acc_norm`).
TTV2_DATA = [
    # (step, hellaswag, arc_easy, arc_challenge, winogrande)
    (1_000, 0.2642, 0.3624, 0.1894, 0.5099),
    (2_000, 0.2859, 0.4613, 0.1877, 0.5075),
    (3_000, 0.3060, 0.5109, 0.1980, 0.5193),
    (4_000, 0.3264, 0.5366, 0.2261, 0.5257),
    (5_000, 0.3427, 0.5231, 0.2287, 0.5241),
    (6_000, 0.3498, 0.5543, 0.2372, 0.5114),
    (7_000, 0.3599, 0.5753, 0.2594, 0.5312),
    (8_000, 0.3687, 0.5850, 0.2679, 0.5130),
    (9_000, 0.3736, 0.6023, 0.2765, 0.5296),
    (10_000, 0.3799, 0.5981, 0.2739, 0.5335),
    (11_000, 0.3835, 0.6002, 0.2747, 0.5304),
    (12_000, 0.3889, 0.6035, 0.2637, 0.5351),
    (13_000, 0.3929, 0.6115, 0.2679, 0.5375),
]


def tokens(step, gbs):
    return step * gbs * SEQ / 1e9  # billions


TASKS = ['HellaSwag', 'ARC-Easy', 'ARC-Challenge', 'Winogrande']
RANDOM_BASELINE = [0.25, 0.25, 0.25, 0.50]


def render(out_path: Path):
    """Render the comparison chart with the ambivalent style.

    The plot uses ambivalent's prop_cycle — no hand-picked colors. Calls
    to `ax.plot()` consume successive 'C0', 'C1', ... from the cycle,
    matching the rest of the AuroraGPT-2B figures rendered by
    `Megatron-DeepSpeed/ALCF/AuroraGPT/2B/scripts/generate_report.py`.

    The style ships with `bg=none`, so one SVG works on both light and
    dark site themes — the slide background shows through.
    """
    import ambivalent  # required — no fallback; if missing, `uv run --with`
    plt.style.use(ambivalent.STYLES['ambivalent'])

    plt.rcParams.update({
        'font.family': 'monospace',
        'font.size': 10,
        'axes.spines.top': False,
        'axes.spines.right': False,
    })

    fig, axes = plt.subplots(2, 2, figsize=(11, 7), sharex=True)
    fig.patch.set_alpha(0)

    mds = np.array(MDS_DATA)
    mds_tokens = tokens(mds[:, 0], MDS_GBS)
    v2 = np.array(TTV2_DATA)
    v2_tokens = tokens(v2[:, 0], TTV2_GBS)
    # (TTV1_DATA / TTV1_GBS still defined at module top in case we ever
    #  want to bring the broken-baseline series back for a different
    #  framing — currently unused since this slide focuses on the fix.)

    # Pin colors for cross-slide consistency. The loss-comparison slide
    # uses the same MDS=blue / TT-v2=red pair, so "blue=MDS, red=TT"
    # reads identically across both charts.
    #   C0 = MDS (blue)  — reference trajectory
    #   C1 = TT v2 (red) — the fix
    # (TT v1 broken series removed; the bug story lives on the 20B
    #  smoking-gun slide and the bf16-RMSNorm-freeze deep-dive.)
    MDS_COLOR = 'C0'
    TT_V2_COLOR = 'C1'

    for i, (task, baseline) in enumerate(zip(TASKS, RANDOM_BASELINE)):
        ax = axes[i // 2][i % 2]
        ax.patch.set_alpha(0)

        ax.axhline(baseline, ls=':', lw=1, color='gray',
                   label=f'random ({baseline:.0%})', zorder=1)

        # MDS stage-boundary annotations. The 2B MDS trajectory ran in
        # 3 stages (per the model card): (1) pretrain on olmo-mix-1124,
        # 0 → 4673B tokens; (2) continued-pretrain on dolmino-mix-1124,
        # 4673B → 7064B; (3) math+code on Nvidia CC-Math + Nemotron Code,
        # 7064B → 7770B. The eval table only covers stages 1 and 2 (last
        # eval is at step 140K = ~7.04T tokens), so stage 3 isn't on the
        # chart — but the (1)→(2) boundary at 4.67T is visible.
        for x in (4673, 7064):
            ax.axvline(x, ls='--', lw=0.7, color='gray', alpha=0.5, zorder=0)

        ax.plot(mds_tokens, mds[:, i + 1], '-o', color=MDS_COLOR,
                lw=2, ms=4, label='MDS (SophiaG)', zorder=3)
        ax.plot(v2_tokens, v2[:, i + 1], '-D', color=TT_V2_COLOR,
                lw=2, ms=5, label='TT v2 (fp32, fix)', zorder=4)

        ax.set_title(task, fontsize=11, pad=8)
        ax.set_xscale('log')
        ax.set_xlim(20, 10_000)
        ax.set_ylim(0.15, 0.75)
        ax.grid(True, which='both', alpha=0.3)

        if i % 2 == 0:
            ax.set_ylabel('Accuracy')
        if i // 2 == 1:
            ax.set_xlabel('Tokens consumed (B)')
        # Stage callouts only on the top-left panel; trim labels to a
        # tight italic so they don't compete with the curves.
        if i == 0:
            ax.text(4673, 0.72, ' (2)', fontsize=8, color='gray',
                    style='italic', va='top', ha='left')
            ax.text(7064, 0.72, ' (3)', fontsize=8, color='gray',
                    style='italic', va='top', ha='left')
            ax.legend(loc='lower right', fontsize=8, framealpha=0)

    fig.suptitle('AuroraGPT-2B  —  eval comparison across runs',
                 fontsize=12, y=0.995)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True, bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path}  ({out_path.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    out = Path('/Users/samforeman/projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures')
    out.mkdir(parents=True, exist_ok=True)
    render(out / 'eval-2b-compare.svg')
