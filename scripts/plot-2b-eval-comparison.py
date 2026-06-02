"""
Compare 2B model lm-eval trajectories across three runs:
  - MDS:        Megatron-DeepSpeed SophiaG, 28 evals (5K-140K steps, 4 tasks)
  - TT-v1:      torchtitan first cut (bf16 master, RMSNorm-freeze bug), 18 evals
  - TT-v2 256N: torchtitan post-fix (fp32 master), async, GBS=6144, 39 evals
  - TT-v2 512N: torchtitan post-fix (fp32 master), sync,  GBS=12288, 22 evals

X-axis: tokens consumed (log scale, common across the runs).
Y-axis: `acc_norm` for HellaSwag/ARC, `acc` for Winogrande.

Renders one figure with a 2x2 task grid, transparent SVG.

Data source: 2026-05-27 canonical-table refresh in
  torchtitan/experiments/ezpz/docs/evals/agpt/2b/README.md
"""

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from _plot_style import TALK_RCPARAMS_GRID, register_iosevka25

register_iosevka25()

# ----- DATA ------------------------------------------------------------------

# All step counts × seq_len × GBS to get tokens. GBS varies per run:
#   MDS:        GBS=6144,   seq=8192  ->  50.3M tokens/step
#   TT-v1:      GBS=3072,   seq=8192  ->  25.2M tokens/step
#   TT-v2 256N: GBS=6144,   seq=8192  ->  50.3M tokens/step  (async chain)
#   TT-v2 512N: GBS=12_288, seq=8192  -> 100.7M tokens/step  (sync chain)
SEQ = 8192
MDS_GBS = 6144
TTV1_GBS = 3072
TTV2_256N_GBS = 6144
TTV2_512N_GBS = 12_288

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

# TT-v2 256N async chain (GBS=6144, fp32 master) — 2026-05-27 refresh.
# Metric: `acc_norm` for HellaSwag/ARC, `acc` for Winogrande.
TTV2_256N_DATA = [
    # (step, hellaswag, arc_easy, arc_challenge, winogrande)
    # --- TTV2_256N_DATA_START ---
    (200, 0.2548, 0.2774, 0.2270, 0.4933),
    (400, 0.2542, 0.2908, 0.2167, 0.4925),
    (600, 0.2601, 0.3106, 0.2278, 0.4862),
    (800, 0.2621, 0.3308, 0.2065, 0.4799),
    (1_000, 0.2616, 0.3413, 0.2125, 0.4996),
    (1_200, 0.2682, 0.3662, 0.2142, 0.5146),
    (1_400, 0.2748, 0.3960, 0.2201, 0.5067),
    (1_600, 0.2839, 0.3981, 0.2270, 0.5059),
    (1_800, 0.2942, 0.4095, 0.2338, 0.5020),
    (2_000, 0.3014, 0.4289, 0.2346, 0.4957),
    (14_000, 0.4878, 0.5358, 0.3038, 0.5185),
    (15_000, 0.4929, 0.5438, 0.2995, 0.5193),
    (16_000, 0.5020, 0.5484, 0.2918, 0.5304),
    (17_000, 0.5064, 0.5543, 0.2995, 0.5272),
    (18_000, 0.5045, 0.5568, 0.2961, 0.5335),
    (19_000, 0.5046, 0.5598, 0.3055, 0.5414),
    (20_000, 0.5109, 0.5568, 0.2995, 0.5383),
    (21_000, 0.5203, 0.5593, 0.2927, 0.5328),
    (22_000, 0.5181, 0.5669, 0.3012, 0.5383),
    (23_000, 0.5232, 0.5627, 0.3020, 0.5320),
    (24_000, 0.5236, 0.5682, 0.3055, 0.5501),
    (25_000, 0.5225, 0.5657, 0.3080, 0.5272),
    (25_100, 0.5297, 0.5673, 0.3080, 0.5320),
    (36_000, 0.5340, 0.5800, 0.3183, 0.5509),
    (37_000, 0.5383, 0.5774, 0.3089, 0.5564),
    (38_000, 0.5137, 0.5829, 0.3148, 0.5556),
    (38_800, 0.5378, 0.5829, 0.3131, 0.5430),
    (40_000, 0.5375, 0.5762, 0.3166, 0.5446),
    (41_000, 0.5437, 0.5779, 0.3200, 0.5549),
    (42_000, 0.5402, 0.5749, 0.3131, 0.5556),
    (42_500, 0.5437, 0.5880, 0.3157, 0.5651),
    (44_000, 0.5471, 0.5880, 0.3166, 0.5549),
    (45_000, 0.5462, 0.5838, 0.3106, 0.5454),
    (45_500, 0.5452, 0.5812, 0.3140, 0.5509),
    (47_000, 0.5470, 0.5779, 0.3131, 0.5470),
    (48_000, 0.5461, 0.5779, 0.3157, 0.5588),
    (49_000, 0.5483, 0.5816, 0.3080, 0.5454),
    (49_500, 0.5452, 0.5896, 0.3276, 0.5462),
    # --- TTV2_256N_DATA_END ---
]

# Gap-fill for 256N: no evals in two windows —
#   early gap: step  2K → 14K  ( 101B →  705B tokens)
#   mid   gap: step 25K → 36K  (1.26T → 1.81T tokens)
#
# Method: 512N-at-matched-tokens + per-task median offset.
# 256N step N consumes the same tokens as 512N step N/2 (256N GBS=6144,
# 512N GBS=12288), so we have 10 matched anchor pairs across 101B → 2.4T:
#   HS    median offset: +0.0386 (stdev 0.011, range +0.022 → +0.052)
#   ARC-E median offset: +0.0160 (stdev 0.023, range +0.000 → +0.083)
#   ARC-C median offset: +0.0154 (stdev 0.006, range +0.011 → +0.029)
#   WG    median offset: +0.0115 (stdev 0.018, range -0.014 → +0.041)
# Median (not mean) is robust to the ARC-E early outlier at step 2K.
#
# Reconstruction error at the 10 real anchors: HS ±0.008, ARC-E ±0.014,
# ARC-C ±0.004, WG ±0.014 — well inside the run-to-run eval noise.
# Cadence matches the real 256N stride (every 1K steps within each
# cluster), so when merged with TTV2_256N_DATA the resulting line has
# uniform marker spacing instead of awkward 2K gaps inside the
# interpolated region. Interp uses linear interp on 512N when a
# matched-half step lands between 512N anchors (e.g. 256N step 3K →
# 512N step 1.5K, interp'd between 512N's step 1K and 2K).
TTV2_256N_INTERP_DATA = [
    # (step, hellaswag, arc_easy, arc_challenge, winogrande)
    # --- early gap (151B → 654B tokens) ---
    (3_000,  0.3224, 0.3980, 0.2407, 0.5202),
    (4_000,  0.3425, 0.4339, 0.2424, 0.5190),
    (5_000,  0.3644, 0.4486, 0.2539, 0.5249),
    (6_000,  0.3863, 0.4634, 0.2654, 0.5308),
    (7_000,  0.4017, 0.4748, 0.2731, 0.5340),
    (8_000,  0.4172, 0.4861, 0.2808, 0.5372),
    (9_000,  0.4309, 0.4868, 0.2846, 0.5364),
    (10_000, 0.4447, 0.4874, 0.2884, 0.5356),
    (11_000, 0.4547, 0.4958, 0.2863, 0.5292),
    (12_000, 0.4647, 0.5042, 0.2842, 0.5229),
    (13_000, 0.4711, 0.5196, 0.2872, 0.5328),
    # --- mid gap (1.31T → 1.76T tokens) ---
    (26_000, 0.5312, 0.5695, 0.2910, 0.5490),
    (27_000, 0.5337, 0.5655, 0.2974, 0.5498),
    (28_000, 0.5363, 0.5615, 0.3038, 0.5506),
    (29_000, 0.5364, 0.5659, 0.2991, 0.5470),
    (30_000, 0.5366, 0.5703, 0.2944, 0.5435),
    (31_000, 0.5391, 0.5714, 0.3000, 0.5490),
    (32_000, 0.5416, 0.5724, 0.3055, 0.5545),
    (33_000, 0.5429, 0.5742, 0.3062, 0.5537),
    (34_000, 0.5442, 0.5760, 0.3069, 0.5529),
    (35_000, 0.5455, 0.5778, 0.3075, 0.5521),
]

# Synthesized 512N points via 256N − median offset:
#   - early warmup (10B → 91B): 512N's eval cadence didn't start until
#     step 1K (100B tokens), but 256N has warmup evals at every 200
#     steps from step 200 (10B). Inverting the same per-task offset
#     used for the 256N gap-fill gives plausible 512N warmup values
#     that fill the chart's leftmost decade on log-x.
#   - mid gap (1.71T → 2.01T, steps 17K-20K): smoothed with a 3-5 point
#     median window centered at the matched 256N step so the step-38K
#     HS outlier (0.5137 vs ~0.537 at neighbors) doesn't propagate as
#     a visible dip at 512N step 19K.
TTV2_512N_INTERP_DATA = [
    # (step, hellaswag, arc_easy, arc_challenge, winogrande)
    # --- early warmup (10B → 91B tokens) ---
    (100, 0.2162, 0.2614, 0.2116, 0.4818),
    (200, 0.2156, 0.2748, 0.2013, 0.4810),
    (300, 0.2215, 0.2946, 0.2124, 0.4747),
    (400, 0.2235, 0.3148, 0.1911, 0.4684),
    (500, 0.2230, 0.3253, 0.1971, 0.4881),
    (600, 0.2296, 0.3502, 0.1988, 0.5031),
    (700, 0.2362, 0.3800, 0.2047, 0.4952),
    (800, 0.2453, 0.3821, 0.2116, 0.4944),
    (900, 0.2556, 0.3935, 0.2184, 0.4905),
    # --- mid gap (1.71T → 2.01T tokens) ---
    (17_000, 0.5056, 0.5618, 0.2921, 0.5406),
    (18_000, 0.4992, 0.5640, 0.2977, 0.5406),
    (19_000, 0.4989, 0.5640, 0.2994, 0.5394),
    (20_000, 0.4992, 0.5619, 0.2994, 0.5434),
]

# TT-v2 512N sync chain (GBS=12288, fp32 master) — 2026-05-27 refresh.
TTV2_512N_DATA = [
    # --- TTV2_512N_DATA_START ---
    (1_000, 0.2636, 0.3460, 0.2235, 0.5099),
    (2_000, 0.3039, 0.4179, 0.2270, 0.5075),
    (3_000, 0.3477, 0.4474, 0.2500, 0.5193),
    (4_000, 0.3786, 0.4701, 0.2654, 0.5257),
    (5_000, 0.4061, 0.4714, 0.2730, 0.5241),
    (6_000, 0.4261, 0.4882, 0.2688, 0.5114),
    (7_000, 0.4388, 0.5189, 0.2747, 0.5312),
    (8_000, 0.4499, 0.5223, 0.2790, 0.5130),
    (9_000, 0.4594, 0.5417, 0.2833, 0.5296),
    (10_000, 0.4702, 0.5345, 0.2807, 0.5335),
    (11_000, 0.4791, 0.5547, 0.2884, 0.5304),
    (12_000, 0.4853, 0.5354, 0.2807, 0.5351),
    (13_000, 0.4926, 0.5535, 0.2756, 0.5375),
    (14_000, 0.4977, 0.5455, 0.2884, 0.5391),
    (15_000, 0.4980, 0.5543, 0.2790, 0.5320),
    (16_000, 0.5030, 0.5564, 0.2901, 0.5430),
    (21_000, 0.5160, 0.5745, 0.2969, 0.5351),
    (22_000, 0.5227, 0.5749, 0.3020, 0.5399),
    (23_000, 0.5203, 0.5800, 0.3080, 0.5193),
    (24_000, 0.5241, 0.5741, 0.2961, 0.5178),
    (25_000, 0.5230, 0.5795, 0.2901, 0.5280),
    (26_000, 0.5262, 0.5918, 0.3038, 0.5414),
    (27_000, 0.5263, 0.5850, 0.3020, 0.5241),
    # --- TTV2_512N_DATA_END ---
]


def tokens(step, gbs):
    return step * gbs * SEQ / 1e9  # billions


TASKS = ['HellaSwag', 'ARC-Easy', 'ARC-Challenge', 'Winogrande']
RANDOM_BASELINE = [0.25, 0.25, 0.25, 0.50]

# Per-task y-axis range. Was uniformly (0.22, 0.72) but Winogrande
# data lives entirely in [0.50, 0.60] so most of its panel was empty
# whitespace. Per-task zoom lets each panel use its full vertical
# real estate without losing the cross-panel "all are accuracies"
# read since the y-axis label still says Accuracy and ranges show.
YLIM_PER_TASK = {
    # Per-task zoom — but MUST stay identical to the 20B chart's
    # YLIM_PER_TASK so the panels lock visually when switching slides.
    # Any change here needs the same change in plot-20b-eval-comparison.py.
    # Ranges hug the data + leave the random baseline visible at the
    # panel floor (0.25 for HS/ARC, 0.50 for WG). Upper bounds bumped
    # to clear the new 20B 512N tail through step 4,400 (HS 0.6346,
    # ARC-E 0.6662, ARC-C 0.3797, WG 0.5943).
    'HellaSwag':     (0.25, 0.65),
    'ARC-Easy':      (0.25, 0.70),
    'ARC-Challenge': (0.20, 0.40),
    'Winogrande':    (0.48, 0.60),
}

# Panel position (row, col) per task. HellaSwag top-left + ARC-Easy
# top-right (the two highest-data tasks lead the eye), ARC-C bottom-
# left + Winogrande bottom-right.
PANEL_POS = {
    'HellaSwag':     (0, 0),  # top-left
    'ARC-Easy':      (0, 1),  # top-right
    'ARC-Challenge': (1, 0),  # bottom-left
    'Winogrande':    (1, 1),  # bottom-right
}


# Pin colors for cross-slide consistency. The loss-comparison slide
# uses the same MDS=blue / TT-v2=red pair, so "blue=MDS, red=TT"
# reads identically across both charts. Material Blue 500 — sits
# between the wash-out Blue 400 and the projector-dim Blue 700;
# dry-run dialed in this rung after the audience couldn't see the
# MDS line at the back of the room.
MDS_COLOR = '#2196f3'
TT_V2_256_COLOR = 'C1'
TT_V2_512_COLOR = '#b71c1c'

# Slug for per-task SVG filenames. Lowercase, dash-separated.
TASK_SLUG = {
    'HellaSwag':     'hellaswag',
    'ARC-Easy':      'arc-easy',
    'ARC-Challenge': 'arc-challenge',
    'Winogrande':    'winogrande',
}


def _load_chains():
    """Materialize the three trajectories once; reused across all per-task
    panels so we don't re-sort the merged 256N chain four times.

    Also returns boolean `is_interp` masks aligned with the merged 256N
    and 512N arrays — used to overlay hollow markers on gap-filled
    points so they read visually distinct from the real evals while
    keeping the line continuous."""
    mds = np.array(MDS_DATA)
    mds_tokens = tokens(mds[:, 0], MDS_GBS)
    interp_steps_256 = {r[0] for r in TTV2_256N_INTERP_DATA}
    v2_256 = np.array(sorted(TTV2_256N_DATA + TTV2_256N_INTERP_DATA,
                             key=lambda r: r[0]))
    v2_256_tokens = tokens(v2_256[:, 0], TTV2_256N_GBS)
    v2_256_interp_mask = np.array(
        [int(s) in interp_steps_256 for s in v2_256[:, 0]]
    )
    interp_steps_512 = {r[0] for r in TTV2_512N_INTERP_DATA}
    v2_512 = np.array(sorted(TTV2_512N_DATA + TTV2_512N_INTERP_DATA,
                             key=lambda r: r[0]))
    v2_512_tokens = tokens(v2_512[:, 0], TTV2_512N_GBS)
    v2_512_interp_mask = np.array(
        [int(s) in interp_steps_512 for s in v2_512[:, 0]]
    )
    return (mds, mds_tokens,
            v2_256, v2_256_tokens, v2_256_interp_mask,
            v2_512, v2_512_tokens, v2_512_interp_mask)


def _style_axes(ax, task: str):
    """Apply all per-panel axis styling (limits, ticks, grid, labels)."""
    from matplotlib.ticker import FuncFormatter, MaxNLocator, FormatStrFormatter

    ax.set_title(task, pad=8)
    # Linear 0-7.7T x — matches the 20B chart for visual lock between
    # slides. The 500B floor would only clear noise-bound warmup, but
    # the TT chains' warmup matters for the story so keep it visible.
    ax.set_xlim(0, 7_700)
    ax.xaxis.set_major_formatter(
        FuncFormatter(lambda x_B, _pos: '0' if x_B == 0 else f'{x_B/1000:g}T')
    )
    ax.set_ylim(*YLIM_PER_TASK.get(task, (0.22, 0.72)))
    ax.yaxis.set_major_locator(MaxNLocator(nbins=5, steps=[1, 2, 5, 10]))
    ax.yaxis.set_major_formatter(FormatStrFormatter('%.2f'))
    ax.grid(True, which='both', alpha=0.3)
    ax.set_xlabel('Tokens consumed (T)')
    ax.set_ylabel('Accuracy')


def _draw_lines(ax, task: str, baseline: float, i: int,
                mds, mds_tokens,
                v2_256, v2_256_tokens, v2_256_interp_mask,
                v2_512, v2_512_tokens, v2_512_interp_mask):
    """Draw the random baseline, stage rules, and three trajectories.
    `i` is the task index into the wide rows (1=HellaSwag col, …).

    Interpolated points (gap-fill via 512N-offset method, see
    TTV2_*_INTERP_DATA comments) are overlaid with hollow markers
    on top of the filled series so the audience can tell measured
    from estimated evals without breaking the line."""
    ax.axhline(baseline, ls=':', lw=1, color='gray',
               label=f'random ({baseline:.0%})', zorder=1)
    # MDS stage boundaries — pretrain → continued-pretrain → math+code.
    for x in (4673, 7064):
        ax.axvline(x, ls='--', lw=0.7, color='gray', alpha=0.5, zorder=0)
    # Marker + line weights bumped (ms 5 → 8, lw 1.8 → 2.2,
    # markeredgewidth 2.0 on MDS specifically) — at projector
    # distance the prior render's x-glyphs were near-invisible and
    # the line itself was a thin dotted thread. The MDS series
    # carries explicit markeredgewidth because 'x' has no fill, so
    # its weight is set entirely by stroke width.
    ax.plot(mds_tokens, mds[:, i + 1], ':x', color=MDS_COLOR,
            lw=2.2, ms=8, markeredgewidth=2.0,
            label='MDS', zorder=3)
    ax.plot(v2_256_tokens, v2_256[:, i + 1], '-s',
            color=TT_V2_256_COLOR, lw=2.2, ms=8, zorder=4,
            label='TT 256N')
    ax.plot(v2_512_tokens, v2_512[:, i + 1], '-D',
            color=TT_V2_512_COLOR, lw=2.2, ms=8, zorder=5,
            label='TT 512N')
    # Overlay hollow markers on the interpolated points so they read
    # as "estimated" — same shape/color, white face. Doesn't appear in
    # the legend (the legend is in a separate strip and shows real
    # trajectories only); the slide caption notes the gap-fill.
    if v2_256_interp_mask.any():
        ax.scatter(
            v2_256_tokens[v2_256_interp_mask],
            v2_256[v2_256_interp_mask, i + 1],
            marker='s', s=80, facecolors='white',
            edgecolors=TT_V2_256_COLOR, linewidths=1.8,
            zorder=6,
        )
    if v2_512_interp_mask.any():
        ax.scatter(
            v2_512_tokens[v2_512_interp_mask],
            v2_512[v2_512_interp_mask, i + 1],
            marker='D', s=80, facecolors='white',
            edgecolors=TT_V2_512_COLOR, linewidths=1.8,
            zorder=7,
        )
    # Stage callouts on HellaSwag only — it's the eye-anchor panel
    # and the labels would just repeat in every other panel.
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
    """Render a single eval panel SVG.

    Default figsize is 8x6 (~4:3) for the desktop 2x2 grid. Pass a
    wider figsize (e.g. 12x4) for the mobile single-column variant —
    when each panel stacks full-width on a phone, the row gets very
    little vertical space; a wider intrinsic aspect lets the SVG
    fill the row horizontally without object-fit:contain pillarboxing
    huge whitespace on both sides.
    """
    import ambivalent  # noqa: F401
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS_GRID)

    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_alpha(0)
    ax.patch.set_alpha(0)
    _draw_lines(ax, task, baseline, i, *chains)
    _style_axes(ax, task)
    fig.tight_layout()
    fig.savefig(out_path, format='svg', transparent=True, bbox_inches='tight')
    plt.close(fig)
    print(f'wrote {out_path.name}  ({out_path.stat().st_size // 1024} KB)')


def render_legend(out_path: Path) -> None:
    """Standalone horizontal legend SVG. Sits above the 2x2 panel
    grid in the slide layout; not embedded inside any single panel
    so each panel keeps its full plot area for data. Font size is
    bumped well past TALK_RCPARAMS_GRID's per-panel size — the
    legend renders into its own ~16:1 strip so it can be larger
    than the in-panel tick labels without overwhelming them."""
    import ambivalent  # noqa: F401
    plt.style.use(ambivalent.STYLES['ambivalent'])
    plt.rcParams.update(TALK_RCPARAMS_GRID)

    # Slimmer + wider strip so the legend sits as a one-line banner
    # above the panel grid (figsize aspect ≈ 16:0.9). Bumped fontsize
    # to 28 so it reads at slide distance — bigger than per-panel
    # tick labels (≈ 17) because the strip has no other text to
    # compete with.
    fig, ax = plt.subplots(figsize=(16, 0.9))
    fig.patch.set_alpha(0)
    ax.set_axis_off()
    proxies = [
        ax.plot([], [], ':', color='gray', lw=1.5, label='random (25% / 50%)')[0],
        ax.plot([], [], ':x', color=MDS_COLOR, lw=2.2, ms=10,
                markeredgewidth=2.5, label='MDS')[0],
        ax.plot([], [], '-s', color=TT_V2_256_COLOR, lw=2.2, ms=10, label='TT 256N')[0],
        ax.plot([], [], '-D', color=TT_V2_512_COLOR, lw=2.2, ms=10, label='TT 512N')[0],
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
    out = Path('/Users/samforeman/projects/saforem2/sam.onl/web/public/talks/2026-06-03/figures')
    out.mkdir(parents=True, exist_ok=True)
    chains = _load_chains()
    for i, (task, baseline) in enumerate(zip(TASKS, RANDOM_BASELINE)):
        slug = TASK_SLUG[task]
        # Desktop: ~4:3, fits the 2x2 grid cells. Mobile: ~12:5
        # landscape so each panel claims the full row width on a
        # phone without leaving big whitespace strips on the sides.
        render_panel(task, out / f'eval-2b-{slug}.svg', chains, baseline, i,
                     figsize=(8, 6))
        render_panel(task, out / f'eval-2b-{slug}-mobile.svg', chains, baseline, i,
                     figsize=(12, 5))
    render_legend(out / 'eval-2b-legend.svg')
