#!/usr/bin/env node
/*
 * "The pipeline delivered" results-payoff figure for the 2026-08-03 talk, at the
 * Part 2 -> close seam. The deck spends its length on HOW to train and survive;
 * this is the one slide that shows the machinery produced a real model. Two
 * panels, both unambiguous wins:
 *   (left)  20B pretraining loss: 12.9 -> 5.2 over ~1.7k steps / ~600B tokens
 *   (right) 20B final lm-eval scores, all well above random baselines
 *
 * (A CPT/post-training panel was considered but dropped: the on-disk CPT eval
 * series is a domain-adaptation tradeoff, not a clean "it improved" story, so
 * plotting it as a payoff would mislead. Loss + eval carry the win honestly.)
 *
 * Data transcribed verbatim from torchtitan docs:
 *   loss:  docs/experiments/agpt/aurora/figures/loss_20b_256n_combined.csv
 *   eval:  docs/evals/agpt/20b/README.md  (v2 512N sync, step 6,000 / 604B tok)
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

// 20B pretraining loss (step, loss), downsampled from the combined 256N+512N csv.
const LOSS = [
    [1, 12.92],
    [80, 12.24],
    [160, 9.95],
    [240, 7.8],
    [320, 7.58],
    [400, 7.53],
    [480, 7.36],
    [560, 7.27],
    [640, 7.2],
    [720, 7.06],
    [800, 6.79],
    [880, 6.53],
    [960, 6.29],
    [1040, 6.08],
    [1120, 5.89],
    [1200, 5.72],
    [1280, 5.61],
    [1360, 5.5],
    [1440, 5.42],
    [1520, 5.34],
    [1600, 5.26],
    [1680, 5.21],
    [1723, 5.17],
]
const LOSS_XMAX = 1723
const LOSS_YMIN = 5
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
    const sx = (s) => ax + (s / LOSS_XMAX) * aw
    const sy = (v) => ay + ah - ((v - LOSS_YMIN) / (LOSS_YMAX - LOSS_YMIN)) * ah
    let b = ''
    b += `<text x="${(ax + aw / 2).toFixed(1)}" y="${(ay - 12).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.panelTitleSize}" font-weight="700" fill="#118cc2">20B pretraining loss: 12.9 → 5.2</text>`
    b += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`
    for (let v = 5; v <= 13; v += 2) {
        const yy = sy(v)
        b += `<line x1="${ax}" y1="${yy.toFixed(1)}" x2="${ax + aw}" y2="${yy.toFixed(1)}" stroke="#83838318" stroke-width="1"/>`
        b += `<text x="${(ax - 8).toFixed(1)}" y="${(yy + 5).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v}</text>`
    }
    for (let s = 0; s <= LOSS_XMAX; s += 500) {
        const xx = sx(s)
        b += `<text x="${xx.toFixed(1)}" y="${(ay + ah + 20).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${s}</text>`
    }
    let d = ''
    LOSS.forEach(([s, v], i) => {
        d += `${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(v).toFixed(1)} `
    })
    b += `<path d="${d.trim()}" fill="none" stroke="#118cc2" stroke-width="${cfg.lw}"/>`
    const last = LOSS[LOSS.length - 1]
    b += `<circle cx="${sx(last[0]).toFixed(1)}" cy="${sy(last[1]).toFixed(1)}" r="${cfg.mr + 1}" fill="#118cc2"/>`
    b += `<text x="${(ax + aw / 2).toFixed(1)}" y="${(ay + ah + 40).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">training step</text>`
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
