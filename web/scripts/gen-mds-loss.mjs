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

// train loss (iteration, lm_loss), downsampled from train_metrics.csv.
const TRAIN = [
    [1, 12.653],
    [3900, 3.267],
    [7800, 2.923],
    [11700, 2.833],
    [15600, 2.784],
    [19500, 2.752],
    [23400, 2.734],
    [27300, 2.711],
    [31200, 2.701],
    [35100, 2.692],
    [39000, 2.683],
    [42900, 2.674],
    [46800, 2.671],
    [50700, 2.667],
    [54600, 2.661],
    [58500, 2.654],
    [62400, 2.655],
    [66300, 2.653],
    [70200, 2.645],
    [74100, 2.646],
    [78000, 2.637],
    [81900, 2.644],
    [85800, 2.639],
    [89700, 2.622],
    [93600, 2.492],
    [97500, 2.461],
    [101400, 2.455],
    [105300, 2.443],
    [109200, 2.438],
    [113100, 2.433],
    [117000, 2.437],
    [120900, 2.432],
    [124800, 2.426],
    [128700, 2.423],
    [132600, 2.414],
    [136500, 2.421],
    [140400, 2.144],
    [144300, 2.048],
    [148200, 2.031],
    [152100, 2.031],
    [154391, 2.033],
]
// val loss (iteration, val_loss), downsampled (iter-0 sentinel dropped).
const VAL = [
    [11000, 2.848],
    [21900, 2.744],
    [32900, 2.701],
    [43900, 2.681],
    [54900, 2.665],
    [65900, 2.654],
    [76900, 2.647],
    [87900, 2.64],
    [98800, 2.462],
    [109800, 2.442],
    [120800, 2.433],
    [131800, 2.425],
    [142700, 2.057],
    [153700, 2.036],
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
