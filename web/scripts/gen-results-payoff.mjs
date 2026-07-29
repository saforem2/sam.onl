#!/usr/bin/env node
/*
 * "The pipeline delivered" results-payoff figure for the 2026-08-03 talk, at the
 * Part 2 -> close seam. The deck spends its length on HOW to train and survive;
 * this is the one slide that shows the machinery produced a real model. Two
 * panels, both unambiguous wins:
 *   (left)  20B pretraining loss: 12.9 -> 2.4 over ~6.0k steps / ~605B tokens
 *   (right) 20B final lm-eval scores, all well above random baselines
 *
 * (A CPT/post-training panel was considered but dropped: the on-disk CPT eval
 * series is a domain-adaptation tradeoff, not a clean "it improved" story, so
 * plotting it as a payoff would mislead. Loss + eval carry the win honestly.)
 *
 * Loss pulled live from W&B (the 14-run 20b_v2_512 chain, stitched by the repo's
 * canonical concat), reload artifacts dropped + bin-meaned. Eval transcribed
 * from docs/evals/agpt/20b/README.md (v2 512N sync).
 *
 * Deck chart style: transparent bg, #838383 theme-invariant chrome, deck
 * palette, Iosevka embedded. Landscape + mobile variants.
 * Regenerate:  node scripts/gen-results-payoff.mjs
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
const OUT = join(FIG_DIR, 'results-payoff.svg')
const OUT_MOBILE = join(FIG_DIR, 'results-payoff-mobile.svg')

const FONT = FONT_STACK
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// 20B v2 512N pretraining loss (tokens_B, loss). Pulled from W&B via the repo's
// canonical 14-run chain concat (trajectories.py "20b_v2_512" ->
// plot_production_combined.load_wandb_trajectory), reload-excursion artifacts
// dropped, then 50-step bin-mean. First point is the true step-1 raw loss so the
// curve starts at 12.9; the rest are bin means. tokens = step * 12288 * 8192.
const LOSS = [
    [0.1, 12.923], [2.5, 10.39], [7.5, 7.372], [12.5, 6.356], [17.6, 5.865],
    [22.6, 5.457], [27.6, 5.096], [32.7, 4.785], [37.7, 4.534], [42.7, 4.334],
    [47.8, 4.156], [52.8, 4.009], [57.8, 3.889], [62.9, 3.794], [67.9, 3.705],
    [72.9, 3.632], [78.0, 3.563], [83.0, 3.508], [88.0, 3.454], [93.1, 3.399],
    [98.1, 3.357], [103.1, 3.322], [108.2, 3.283], [113.2, 3.248], [118.2, 3.214],
    [123.3, 3.182], [128.3, 3.152], [133.3, 3.124], [138.4, 3.099], [143.4, 3.078],
    [148.4, 3.052], [153.5, 3.029], [158.5, 3.007], [163.5, 2.987], [168.6, 2.967],
    [173.6, 2.954], [178.6, 2.937], [183.7, 2.92], [188.7, 2.903], [193.7, 2.888],
    [198.8, 2.873], [203.8, 2.86], [208.8, 2.845], [213.9, 2.831], [218.9, 2.82],
    [223.9, 2.808], [229.0, 2.796], [234.0, 2.785], [239.0, 2.773], [244.1, 2.763],
    [249.1, 2.751], [254.1, 2.741], [259.2, 2.732], [264.2, 2.724], [269.2, 2.713],
    [274.3, 2.705], [279.3, 2.696], [284.3, 2.688], [289.4, 2.68], [294.4, 2.672],
    [299.4, 2.664], [304.5, 2.658], [309.5, 2.65], [314.5, 2.643], [319.6, 2.637],
    [324.6, 2.653], [328.1, 2.649], [385.0, 2.563], [390.0, 2.558], [395.1, 2.553],
    [400.1, 2.549], [405.1, 2.544], [410.2, 2.54], [415.2, 2.535], [420.2, 2.533],
    [425.3, 2.528], [430.3, 2.523], [435.3, 2.519], [440.4, 2.516], [442.9, 2.514],
    [455.7, 2.561], [460.5, 2.545], [465.5, 2.534], [470.6, 2.526], [475.6, 2.518],
    [480.6, 2.513], [485.6, 2.507], [490.7, 2.502], [495.7, 2.497], [500.7, 2.497],
    [506.4, 2.547], [510.9, 2.546], [515.8, 2.51], [520.9, 2.494], [525.9, 2.485],
    [530.9, 2.48], [536.0, 2.475], [541.0, 2.471], [604.5, 2.444], [605.0, 2.443],
]
const LOSS_XMAX = 605
const LOSS_YMIN = 2
const LOSS_YMAX = 13

// 20B final lm-eval (v2 512N sync, step 6,000). [name, score, randomBaseline]
const EVAL = [
    ['HellaSwag', 0.6086, 0.25],
    ['ARC-Easy', 0.6481, 0.25],
    ['ARC-Chall', 0.3635, 0.25],
    ['Winogrande', 0.5825, 0.5],
    ['PIQA', 0.7563, 0.5],
    ['BoolQ', 0.5807, 0.5],
]

const LANDSCAPE = {
    W: 960,
    H: 470,
    panelGap: 56,
    M: { top: 92, bottom: 62, left: 62, right: 24 },
    titleSize: 24,
    subSize: 15,
    panelTitleSize: 17,
    tickSize: 15,
    barLabelSize: 13,
    lw: 3,
    mr: 3.2,
}
const MOBILE = {
    W: 620,
    H: 720,
    panelGap: 0, // stacked
    M: { top: 74, bottom: 56, left: 60, right: 20 },
    titleSize: 22,
    subSize: 14,
    panelTitleSize: 16,
    tickSize: 14,
    barLabelSize: 13,
    lw: 3.2,
    mr: 3.4,
}

function lossPanel(cfg, px, py, pw, ph) {
    const ax = px
    const ay = py
    const aw = pw
    const ah = ph
    const sx = (t) => ax + (t / LOSS_XMAX) * aw
    const sy = (v) => ay + ah - ((v - LOSS_YMIN) / (LOSS_YMAX - LOSS_YMIN)) * ah
    let b = ''
    b += `<text x="${(ax + aw / 2).toFixed(1)}" y="${(ay - 12).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.panelTitleSize}" font-weight="700" fill="#118cc2">20B pretraining loss: 12.9 → 2.4</text>`
    b += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`
    for (let v = 2; v <= 12; v += 2) {
        const yy = sy(v)
        b += `<line x1="${ax}" y1="${yy.toFixed(1)}" x2="${ax + aw}" y2="${yy.toFixed(1)}" stroke="#83838318" stroke-width="1"/>`
        b += `<text x="${(ax - 8).toFixed(1)}" y="${(yy + 5).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v}</text>`
    }
    for (let t = 0; t <= LOSS_XMAX; t += 200) {
        const xx = sx(t)
        b += `<text x="${xx.toFixed(1)}" y="${(ay + ah + 20).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${t}</text>`
    }
    let d = ''
    LOSS.forEach(([t, v], i) => {
        d += `${i ? 'L' : 'M'}${sx(t).toFixed(1)} ${sy(v).toFixed(1)} `
    })
    b += `<path d="${d.trim()}" fill="none" stroke="#118cc2" stroke-width="${cfg.lw}"/>`
    const last = LOSS[LOSS.length - 1]
    b += `<circle cx="${sx(last[0]).toFixed(1)}" cy="${sy(last[1]).toFixed(1)}" r="${cfg.mr + 1}" fill="#118cc2"/>`
    b += `<text x="${(sx(last[0]) - 6).toFixed(1)}" y="${(sy(last[1]) - 8).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" font-weight="700" fill="#118cc2">2.44</text>`
    b += `<text x="${(ax + aw / 2).toFixed(1)}" y="${(ay + ah + 40).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">tokens seen (B)</text>`
    return b
}

function evalPanel(cfg, px, py, pw, ph) {
    const ax = px
    const ay = py
    const aw = pw
    const ah = ph
    const YMAX = 0.8
    const sy = (v) => ay + ah - (v / YMAX) * ah
    let b = ''
    b += `<text x="${(ax + aw / 2).toFixed(1)}" y="${(ay - 12).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.panelTitleSize}" font-weight="700" fill="#1da811">20B lm-eval: well above random</text>`
    b += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`
    for (let v = 0; v <= 0.8 + 1e-9; v += 0.2) {
        const yy = sy(v)
        b += `<line x1="${ax}" y1="${yy.toFixed(1)}" x2="${ax + aw}" y2="${yy.toFixed(1)}" stroke="#83838318" stroke-width="1"/>`
        b += `<text x="${(ax - 8).toFixed(1)}" y="${(yy + 5).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v.toFixed(1)}</text>`
    }
    const n = EVAL.length
    const slot = aw / n
    const bw = slot * 0.56
    EVAL.forEach(([name, score, base], i) => {
        const cx = ax + slot * (i + 0.5)
        const bx = cx - bw / 2
        // bar
        b += `<rect x="${bx.toFixed(1)}" y="${sy(score).toFixed(1)}" width="${bw.toFixed(1)}" height="${(ay + ah - sy(score)).toFixed(1)}" fill="#1da811" stroke="#fff" stroke-width="0.75"/>`
        // random-baseline tick across the slot
        b += `<line x1="${(cx - slot * 0.42).toFixed(1)}" y1="${sy(base).toFixed(1)}" x2="${(cx + slot * 0.42).toFixed(1)}" y2="${sy(base).toFixed(1)}" stroke="#e05560" stroke-width="1.5" stroke-dasharray="4 3"/>`
        // score label above bar
        b += `<text x="${cx.toFixed(1)}" y="${(sy(score) - 6).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.barLabelSize}" font-weight="700" fill="#1da811">${score.toFixed(2)}</text>`
        // benchmark name below axis (rotated for fit)
        b += `<text x="${cx.toFixed(1)}" y="${(ay + ah + 16).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${(cfg.barLabelSize - 1).toFixed(0)}" fill="#838383" transform="rotate(-30 ${cx.toFixed(1)} ${(ay + ah + 16).toFixed(1)})">${esc(name)}</text>`
    })
    // baseline legend
    b += `<line x1="${(ax + 6).toFixed(1)}" y1="${(ay + 12).toFixed(1)}" x2="${(ax + 30).toFixed(1)}" y2="${(ay + 12).toFixed(1)}" stroke="#e05560" stroke-width="1.5" stroke-dasharray="4 3"/>`
    b += `<text x="${(ax + 36).toFixed(1)}" y="${(ay + 16).toFixed(1)}" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#83838399">random</text>`
    return b
}

function buildSVG(cfg) {
    const { W, H, M } = cfg
    let body = ''
    body += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="${FONT}" font-size="${cfg.titleSize}" font-weight="700" fill="#838383">The pipeline delivered</text>`
    body += `<text x="${W / 2}" y="52" text-anchor="middle" font-family="${FONT}" font-size="${cfg.subSize}" fill="#838383">AuroraGPT-20B on Aurora: it trained, and it learned</text>`

    const mobile = cfg.panelGap === 0
    if (mobile) {
        const pw = W - M.left - M.right
        const ph = (H - M.top - M.bottom - 48) / 2
        body += lossPanel(cfg, M.left, M.top, pw, ph)
        body += evalPanel(cfg, M.left, M.top + ph + 60, pw, ph)
    } else {
        const pw = (W - M.left - M.right - cfg.panelGap) / 2
        const ph = H - M.top - M.bottom
        body += lossPanel(cfg, M.left, M.top, pw, ph)
        body += evalPanel(cfg, M.left + pw + cfg.panelGap, M.top, pw, ph)
    }

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
