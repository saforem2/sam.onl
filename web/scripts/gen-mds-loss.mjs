#!/usr/bin/env node
/*
 * AuroraGPT-2B MDS 3-stage pretraining loss for the 2026-08-03 talk. One
 * continuous 154K-iteration / ~7.77T-token run (the MDS reference continuation),
 * with two data-mix stage transitions that show up as sharp downward steps in
 * both train and val loss:
 *   stage 1 -> 2 at ~95k iters  (ntok4673B -> ntok7064B)
 *   stage 2 -> 3 at ~134k iters (ntok7064B -> ntok7770B, final anneal)
 *
 * Data pulled from W&B (aurora_gpt) via the repo's
 *   docs/production/agpt/2b-mds/loss_data/pull_wandb_loss.py
 * then downsampled here. tok/iter = gbs 6144 * seq 8192 = 50.33M.
 * y-axis zoomed to [2.0, 3.4]: init loss is 12.65 but the story is the plateaus
 * and the stage steps, which would be invisible on a full-range axis.
 *
 * Deck chart style: transparent bg, #838383 theme-invariant chrome, deck
 * palette, Iosevka embedded. Landscape + mobile variants.
 * Regenerate:  node scripts/gen-mds-loss.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fontDefs, FONT_STACK } from './svg-font.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIG_DIR = join(
    __dirname,
    '..',
    'public',
    'talks',
    '2026-08-03',
    'figures',
)
const OUT = join(FIG_DIR, 'mds-loss.svg')
const OUT_MOBILE = join(FIG_DIR, 'mds-loss-mobile.svg')

const FONT = FONT_STACK
const TOK_PER_ITER = 6144 * 8192 // 50.33M tokens/iteration
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// train loss (iteration, lm_loss), EMA-smoothed (alpha=0.02, matching the repo's
// plot_loss.py) then downsampled to ~120 points so the plateaus read as a clean
// line rather than segment-to-segment chop.
const TRAIN = [
    [1, 12.653],
    [1287, 4.939],
    [2573, 3.66],
    [3859, 3.283],
    [5145, 3.103],
    [6431, 2.999],
    [7717, 2.935],
    [9003, 2.892],
    [10289, 2.86],
    [11575, 2.836],
    [12861, 2.816],
    [14147, 2.797],
    [15433, 2.784],
    [16719, 2.772],
    [18005, 2.763],
    [19291, 2.755],
    [20577, 2.747],
    [21863, 2.739],
    [23149, 2.732],
    [24435, 2.727],
    [25721, 2.721],
    [27007, 2.716],
    [28293, 2.712],
    [29579, 2.708],
    [30865, 2.704],
    [32151, 2.7],
    [33437, 2.694],
    [34723, 2.691],
    [36009, 2.688],
    [37295, 2.685],
    [38581, 2.685],
    [39867, 2.683],
    [41153, 2.68],
    [42439, 2.678],
    [43725, 2.675],
    [45011, 2.673],
    [46297, 2.671],
    [47583, 2.67],
    [48869, 2.668],
    [50155, 2.666],
    [51441, 2.664],
    [52727, 2.663],
    [54013, 2.662],
    [55299, 2.66],
    [56585, 2.659],
    [57871, 2.657],
    [59157, 2.655],
    [60443, 2.655],
    [61729, 2.653],
    [63015, 2.653],
    [64301, 2.651],
    [65587, 2.65],
    [66873, 2.649],
    [68159, 2.648],
    [69445, 2.647],
    [70731, 2.646],
    [72017, 2.645],
    [73303, 2.644],
    [74589, 2.643],
    [75875, 2.642],
    [77161, 2.642],
    [78447, 2.641],
    [79733, 2.64],
    [81019, 2.639],
    [82305, 2.639],
    [83591, 2.637],
    [84877, 2.637],
    [86163, 2.636],
    [87449, 2.635],
    [88735, 2.628],
    [90021, 2.621],
    [91307, 2.617],
    [92593, 2.614],
    [93879, 2.49],
    [95165, 2.477],
    [96451, 2.47],
    [97737, 2.464],
    [99023, 2.459],
    [100309, 2.455],
    [101595, 2.452],
    [102881, 2.449],
    [104167, 2.447],
    [105453, 2.444],
    [106739, 2.442],
    [108025, 2.44],
    [109311, 2.44],
    [110597, 2.438],
    [111883, 2.436],
    [113169, 2.435],
    [114455, 2.435],
    [115741, 2.433],
    [117027, 2.432],
    [118313, 2.431],
    [119599, 2.43],
    [120885, 2.429],
    [122171, 2.428],
    [123457, 2.428],
    [124743, 2.426],
    [126029, 2.426],
    [127315, 2.424],
    [128601, 2.425],
    [129887, 2.423],
    [131173, 2.422],
    [132459, 2.422],
    [133745, 2.421],
    [135031, 2.42],
    [136317, 2.419],
    [137603, 2.419],
    [138889, 2.418],
    [140175, 2.418],
    [141461, 2.066],
    [142747, 2.054],
    [144033, 2.048],
    [145319, 2.044],
    [146605, 2.052],
    [147891, 2.038],
    [149177, 2.036],
    [150463, 2.034],
    [151749, 2.033],
    [153035, 2.032],
    [154321, 2.03],
    [154391, 2.03],
]
// val loss (iteration, val_loss), EMA-smoothed (alpha=0.05), iter-0 sentinel dropped.
const VAL = [
    [100, 8.797],
    [2600, 5.638],
    [5100, 3.912],
    [7600, 3.247],
    [10100, 2.991],
    [12600, 2.881],
    [15100, 2.824],
    [17600, 2.791],
    [20000, 2.769],
    [22500, 2.752],
    [25000, 2.739],
    [27500, 2.727],
    [30000, 2.718],
    [32500, 2.71],
    [35000, 2.701],
    [37500, 2.695],
    [40000, 2.691],
    [42500, 2.686],
    [45000, 2.682],
    [47500, 2.678],
    [50000, 2.674],
    [52500, 2.67],
    [55000, 2.668],
    [57500, 2.665],
    [60000, 2.662],
    [62500, 2.66],
    [65000, 2.657],
    [67500, 2.655],
    [70000, 2.653],
    [72500, 2.651],
    [75000, 2.649],
    [77500, 2.648],
    [80000, 2.646],
    [82500, 2.644],
    [85000, 2.643],
    [87500, 2.641],
    [90000, 2.634],
    [92500, 2.625],
    [94900, 2.537],
    [97400, 2.49],
    [99900, 2.47],
    [102400, 2.46],
    [104900, 2.453],
    [107400, 2.448],
    [109900, 2.444],
    [112400, 2.441],
    [114900, 2.438],
    [117400, 2.436],
    [119900, 2.434],
    [122400, 2.433],
    [124900, 2.431],
    [127400, 2.429],
    [129900, 2.428],
    [132400, 2.426],
    [134900, 2.425],
    [137400, 2.423],
    [139900, 2.422],
    [142300, 2.197],
    [144800, 2.092],
    [147300, 2.058],
    [149800, 2.045],
    [152300, 2.039],
    [154391, 2.036],
]
// stage transition iterations + labels (from plot_loss.py STAGE_BOUNDARIES).
const STAGES = [
    [95000, '4.673T → 7.064T'],
    [134000, '7.064T → 7.770T'],
]

const X_MAX = 155000
const Y_MIN = 2.0
const Y_MAX = 3.4

const LANDSCAPE = {
    W: 960,
    H: 520,
    M: { top: 74, right: 30, bottom: 68, left: 66 },
    titleSize: 24,
    subSize: 15,
    axisSize: 18,
    tickSize: 15,
    stageSize: 13,
    lw: 2.6,
    legendSize: 15,
}
const MOBILE = {
    W: 640,
    H: 520,
    M: { top: 88, right: 24, bottom: 70, left: 62 },
    titleSize: 22,
    subSize: 14,
    axisSize: 17,
    tickSize: 14,
    stageSize: 12,
    lw: 2.8,
    legendSize: 14,
}

function buildSVG(cfg) {
    const { W, H, M } = cfg
    const ax = M.left
    const ay = M.top
    const aw = W - M.left - M.right
    const ah = H - M.top - M.bottom
    const sx = (it) => ax + (it / X_MAX) * aw
    const sy = (v) => ay + ah - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * ah

    let body = ''
    body += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="${FONT}" font-size="${cfg.titleSize}" font-weight="700" fill="#838383">AuroraGPT-2B: 7.77T tokens, one continuous run</text>`
    body += `<text x="${W / 2}" y="52" text-anchor="middle" font-family="${FONT}" font-size="${cfg.subSize}" fill="#838383">3 data-mix stages; each transition steps the loss down</text>`

    body += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`
    for (let v = 2.0; v <= 3.4 + 1e-9; v += 0.2) {
        const yy = sy(v)
        body += `<line x1="${ax}" y1="${yy.toFixed(1)}" x2="${ax + aw}" y2="${yy.toFixed(1)}" stroke="#83838318" stroke-width="1"/>`
        body += `<text x="${(ax - 8).toFixed(1)}" y="${(yy + 5).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v.toFixed(1)}</text>`
    }
    // x ticks in tokens (T), computed from iteration
    for (let it = 0; it <= X_MAX; it += 30000) {
        const xx = sx(it)
        const tokT = ((it * TOK_PER_ITER) / 1e12).toFixed(1)
        body += `<line x1="${xx.toFixed(1)}" y1="${ay}" x2="${xx.toFixed(1)}" y2="${ay + ah}" stroke="#83838312" stroke-width="1"/>`
        body += `<text x="${xx.toFixed(1)}" y="${(ay + ah + 20).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${tokT}T</text>`
    }

    // stage boundary lines + labels
    for (const [it, label] of STAGES) {
        const xx = sx(it)
        body += `<line x1="${xx.toFixed(1)}" y1="${ay}" x2="${xx.toFixed(1)}" y2="${ay + ah}" stroke="#83838399" stroke-width="1" stroke-dasharray="3 3"/>`
        body += `<text x="${(xx - 5).toFixed(1)}" y="${(ay + 14).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.stageSize}" fill="#666" transform="rotate(-90 ${(xx - 5).toFixed(1)} ${(ay + 14).toFixed(1)})">${esc(label)}</text>`
    }

    const clipId = `plot-${cfg.W}`
    body += `<clipPath id="${clipId}"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}"/></clipPath>`
    let g = `<g clip-path="url(#${clipId})">`
    // val (lighter, behind)
    let dv = ''
    VAL.forEach(([it, v], i) => {
        dv += `${i ? 'L' : 'M'}${sx(it).toFixed(1)} ${sy(v).toFixed(1)} `
    })
    g += `<path d="${dv.trim()}" fill="none" stroke="#ee8f24" stroke-width="${cfg.lw}" stroke-dasharray="6 4"/>`
    // train (solid blue, on top)
    let dt = ''
    TRAIN.forEach(([it, v], i) => {
        dt += `${i ? 'L' : 'M'}${sx(Math.min(it, X_MAX)).toFixed(1)} ${sy(Math.max(Math.min(v, Y_MAX + 1), Y_MIN - 1)).toFixed(1)} `
    })
    g += `<path d="${dt.trim()}" fill="none" stroke="#118cc2" stroke-width="${cfg.lw + 0.4}"/>`
    g += '</g>'
    body += g

    // final-loss marker
    const last = TRAIN[TRAIN.length - 1]
    body += `<circle cx="${sx(last[0]).toFixed(1)}" cy="${sy(last[1]).toFixed(1)}" r="3.5" fill="#118cc2"/>`
    body += `<text x="${(sx(last[0]) - 6).toFixed(1)}" y="${(sy(last[1]) - 8).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" font-weight="700" fill="#118cc2">2.03</text>`

    // axis labels
    body += `<text x="${(ax + aw / 2).toFixed(1)}" y="${(H - 16).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383">tokens seen</text>`
    body += `<text x="20" y="${(ay + ah / 2).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383" transform="rotate(-90 20 ${(ay + ah / 2).toFixed(1)})">loss</text>`

    // legend
    const ly = ay + ah - 8
    const lx = ax + aw - 150
    body += `<line x1="${lx}" y1="${(ly - 12).toFixed(1)}" x2="${lx + 22}" y2="${(ly - 12).toFixed(1)}" stroke="#118cc2" stroke-width="${cfg.lw + 0.4}"/>`
    body += `<text x="${lx + 28}" y="${(ly - 8).toFixed(1)}" font-family="${FONT}" font-size="${cfg.legendSize}" fill="#555">train</text>`
    body += `<line x1="${lx}" y1="${(ly + 6).toFixed(1)}" x2="${lx + 22}" y2="${(ly + 6).toFixed(1)}" stroke="#ee8f24" stroke-width="${cfg.lw}" stroke-dasharray="6 4"/>`
    body += `<text x="${lx + 28}" y="${(ly + 10).toFixed(1)}" font-family="${FONT}" font-size="${cfg.legendSize}" fill="#555">val</text>`

    return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
${fontDefs()}
${body}
</svg>
`
}

writeFileSync(OUT, buildSVG(LANDSCAPE))
console.log('wrote', OUT)
writeFileSync(OUT_MOBILE, buildSVG(MOBILE))
console.log('wrote', OUT_MOBILE)
