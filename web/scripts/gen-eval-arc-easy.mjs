#!/usr/bin/env node
/*
 * 20B v2 ARC-Easy learning curve for the 2026-08-03 talk's silent-rmsnorm slide.
 * The point of the slide: loss looks fine but only lm-eval tells you the model is
 * actually learning. This plots the REAL v2 (fp32-master) ARC-Easy accuracy
 * climbing with tokens, from random baseline (~0.25) up past 0.69 -- proof the
 * eval gate moves once the RMSNorm-freeze bug is fixed.
 *
 * Data transcribed verbatim from the committed eval table:
 *   torchtitan/experiments/ezpz/docs/evals/agpt/20b/README.md
 *   (v2 512N sync chain: the continuous production run, steps 100..6000)
 * ARC-Easy vs tokens-seen (B). Random baseline for ARC-Easy is 0.25.
 *
 * Deck chart style: transparent bg, #838383 theme-invariant chrome, deck
 * palette, Iosevka embedded. Landscape + mobile variants.
 * Regenerate:  node scripts/gen-eval-arc-easy.mjs
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
const OUT = join(FIG_DIR, 'eval-20b-v2-arc-easy.svg')
const OUT_MOBILE = join(FIG_DIR, 'eval-20b-v2-arc-easy-mobile.svg')

const FONT = FONT_STACK
const LINE = '#1da811' // v2 = green (the fixed / good run)
const BASELINE = 0.25 // ARC-Easy random baseline (4-way)

// [tokensB, arc_easy] -- v2 512N sync chain, from the 20b eval README.
const ROWS = [
    [10.1, 0.266],
    [20.1, 0.2883],
    [30.2, 0.3022],
    [40.3, 0.3363],
    [50.3, 0.3594],
    [60.4, 0.3935],
    [70.5, 0.4352],
    [80.5, 0.4411],
    [90.6, 0.4621],
    [100.7, 0.4701],
    [120.8, 0.492],
    [140.9, 0.5307],
    [161.1, 0.5606],
    [181.2, 0.5505],
    [201.3, 0.5939],
    [221.5, 0.6124],
    [241.6, 0.6195],
    [261.7, 0.6305],
    [281.9, 0.6444],
    [302.0, 0.6574],
    [322.1, 0.6633],
    [342.3, 0.6717],
    [362.4, 0.6658],
    [382.5, 0.6768],
    [402.7, 0.6827],
    [422.8, 0.6915],
    [432.9, 0.6961],
    [442.9, 0.6932],
    [463.1, 0.6738],
    [483.2, 0.6662],
    [503.3, 0.6688],
    [543.6, 0.6671],
    [604.0, 0.6481],
]

const X_MAX = 620
const Y_MIN = 0.2
const Y_MAX = 0.72

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

const LANDSCAPE = {
    W: 900,
    H: 520,
    M: { top: 70, right: 96, bottom: 66, left: 74 },
    titleSize: 24,
    subSize: 16,
    axisSize: 19,
    tickSize: 17,
    lw: 3.2,
    mr: 3.6,
}
const MOBILE = {
    W: 620,
    H: 540,
    M: { top: 84, right: 60, bottom: 70, left: 66 },
    titleSize: 22,
    subSize: 15,
    axisSize: 18,
    tickSize: 16,
    lw: 3.4,
    mr: 3.8,
}

function buildSVG(cfg) {
    const { W, H, M } = cfg
    const ax = M.left
    const ay = M.top
    const aw = W - M.left - M.right
    const ah = H - M.top - M.bottom
    const sx = (t) => ax + (t / X_MAX) * aw
    const sy = (v) => ay + ah - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * ah

    let body = ''

    body += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="${FONT}" font-size="${cfg.titleSize}" font-weight="700" fill="#838383">20B v2: ARC-Easy actually moves</text>`
    body += `<text x="${W / 2}" y="52" text-anchor="middle" font-family="${FONT}" font-size="${cfg.subSize}" fill="#838383">fp32 master; the eval gate rises from random to ~0.69</text>`

    // axes box
    body += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`

    // y gridlines (0.2..0.7 by 0.1)
    for (let v = 0.2; v <= 0.7 + 1e-9; v += 0.1) {
        const yy = sy(v)
        body += `<line x1="${ax}" y1="${yy.toFixed(1)}" x2="${ax + aw}" y2="${yy.toFixed(1)}" stroke="#83838318" stroke-width="1"/>`
        body += `<text x="${ax - 10}" y="${(yy + 5).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v.toFixed(1)}</text>`
    }

    // x gridlines every 200B
    for (let t = 0; t <= X_MAX; t += 200) {
        const xx = sx(t)
        body += `<line x1="${xx.toFixed(1)}" y1="${ay}" x2="${xx.toFixed(1)}" y2="${ay + ah}" stroke="#83838318" stroke-width="1"/>`
        body += `<text x="${xx.toFixed(1)}" y="${(ay + ah + 22).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${t}</text>`
    }

    // random-baseline reference line (label at right, clear of the rising curve)
    body += `<line x1="${ax}" y1="${sy(BASELINE).toFixed(1)}" x2="${ax + aw}" y2="${sy(BASELINE).toFixed(1)}" stroke="#e0556088" stroke-width="1.2" stroke-dasharray="5 4"/>`
    body += `<text x="${(ax + aw - 8).toFixed(1)}" y="${(sy(BASELINE) - 6).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#e05560">random (0.25)</text>`

    // curve
    const clipId = `plot-${cfg.W}`
    body += `<clipPath id="${clipId}"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}"/></clipPath>`
    let d = ''
    ROWS.forEach(([t, v], i) => {
        d += `${i ? 'L' : 'M'}${sx(t).toFixed(1)} ${sy(v).toFixed(1)} `
    })
    body += `<g clip-path="url(#${clipId})"><path d="${d.trim()}" fill="none" stroke="${LINE}" stroke-width="${cfg.lw}"/>`
    for (const [t, v] of ROWS) {
        body += `<circle cx="${sx(t).toFixed(1)}" cy="${sy(v).toFixed(1)}" r="${cfg.mr}" fill="${LINE}" stroke="#fff" stroke-width="0.6"/>`
    }
    body += '</g>'

    // peak callout at the max point
    let peak = ROWS[0]
    for (const r of ROWS) if (r[1] > peak[1]) peak = r
    const pxv = sx(peak[0])
    const pyv = sy(peak[1])
    // display 0.69 (floor to 2dp) so it matches the "~0.69" subtitle rather than
    // rounding 0.6961 up to 0.70
    const peakDisp = (Math.floor(peak[1] * 100) / 100).toFixed(2)
    body += `<text x="${pxv.toFixed(1)}" y="${(pyv - 10).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" font-weight="700" fill="${LINE}">peak ${peakDisp}</text>`

    // axis labels
    body += `<text x="${(ax + aw / 2).toFixed(1)}" y="${(H - 16).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383">tokens seen (B)</text>`
    body += `<text x="22" y="${(ay + ah / 2).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383" transform="rotate(-90 22 ${(ay + ah / 2).toFixed(1)})">ARC-Easy accuracy</text>`

    void esc
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
