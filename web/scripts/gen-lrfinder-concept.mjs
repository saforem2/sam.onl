#!/usr/bin/env node
/*
 * Generate the CONCEPTUAL LR-finder curve for the 2026-08-03 talk's Part 1
 * "find the learning rate" slide. This teaches the METHOD (sweep LR on a short
 * run, read the U, pick below the cliff); the real 80B multi-optimizer carnage
 * is the Part 2 optimizer-cliff payoff (lr-finder-80b.svg) and is deliberately
 * NOT reused here so the reveal lands later.
 *
 * One smooth curve over a log-LR sweep with three annotated regions:
 *   too low (flat, underfits) · sweet spot (the minimum) · cliff (diverge -> NaN)
 * Rendered in the deck's "ambivalent" style: transparent background, #838383
 * theme-invariant chrome, Iosevka embedded.
 *
 * Emits landscape (slide) + mobile (narrow/tall) variants.
 * Regenerate:  node scripts/gen-lrfinder-concept.mjs
 * No matplotlib / numpy: emits SVG directly.
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
const OUT = join(FIG_DIR, 'lr-finder-concept.svg')
const OUT_MOBILE = join(FIG_DIR, 'lr-finder-concept-mobile.svg')

// Synthetic loss-vs-log10(lr). Flat-high plateau on the left (steps too tiny to
// learn), a monotone decline into the basin, then a steep cliff into divergence.
// A smaller-than-ideal LR only trains slower, it does NOT push the loss back up,
// so the curve is non-increasing until the cliff. x is log10(lr): 1e-5 .. 1e-2.
const X_MIN = -5 // 1e-5
const X_MAX = -2 // 1e-2
const Y_MIN = 2.5
const Y_MAX = 7.0
// finite curve stops at the cliff; past CLIFF_X it's NaN (dotted -> top strip)
const CLIFF_X = -2.5
const CLIFF_KNEE = -2.95 // where the wall starts to bite
const NAN_Y = 6.72
const DIV_Y = 6.45

function loss(x) {
    const plateau = 5.6
    const floor = 3.05
    // sigmoid decline from the flat plateau down to the basin as lr grows
    const drop = 1 / (1 + Math.exp(-(x - -3.9) * 3.4))
    const base = plateau - (plateau - floor) * drop
    // cliff: ~0 until the knee, then a steep quartic wall into NaN
    const dc = x - CLIFF_KNEE
    const cliff = dc > 0 ? 6 * dc * dc + 120 * Math.pow(dc, 4) : 0
    return base + cliff
}

const FONT = FONT_STACK
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const LINE = '#118cc2' // deck url/blue for the single curve

const LANDSCAPE = {
    W: 1120,
    H: 620,
    M: { top: 96, right: 34, bottom: 78, left: 88 },
    titleSize: 30,
    subSize: 18,
    axisSize: 22,
    tickSize: 18,
    annSize: 19,
    lw: 3.4,
}
const MOBILE = {
    W: 640,
    H: 640,
    M: { top: 120, right: 26, bottom: 82, left: 78 },
    titleSize: 29,
    subSize: 16,
    axisSize: 22,
    tickSize: 18,
    annSize: 18,
    lw: 3.6,
}

function buildSVG(cfg) {
    const { W, H, M } = cfg
    const ax = M.left
    const ay = M.top
    const aw = W - M.left - M.right
    const ah = H - M.top - M.bottom
    const sx = (x) => ax + ((x - X_MIN) / (X_MAX - X_MIN)) * aw
    const sy = (v) => ay + ah - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * ah

    let body = ''

    // title + subtitle
    body += `<text x="${W / 2}" y="34" text-anchor="middle" font-family="${FONT}" font-size="${cfg.titleSize}" font-weight="700" fill="#838383">LR-finder: sweep the rate on a short run</text>`
    body += `<text x="${W / 2}" y="58" text-anchor="middle" font-family="${FONT}" font-size="${cfg.subSize}" fill="#838383">pick the fastest rate still clear of the cliff</text>`

    // axes box
    body += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`

    // y gridlines (whole numbers)
    for (let v = 3; v <= 7 - 1e-9; v += 1) {
        const yy = sy(v)
        body += `<line x1="${ax}" y1="${yy.toFixed(1)}" x2="${ax + aw}" y2="${yy.toFixed(1)}" stroke="#83838318" stroke-width="1"/>`
        body += `<text x="${ax - 10}" y="${(yy + 5).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v.toFixed(0)}</text>`
    }

    // x decade gridlines + minors
    for (let e = -5; e <= -2; e++) {
        for (let m = 1; m <= 9; m++) {
            const x = e + Math.log10(m)
            if (x < X_MIN || x > X_MAX) continue
            const xx = sx(x)
            const major = m === 1
            body += `<line x1="${xx.toFixed(1)}" y1="${ay}" x2="${xx.toFixed(1)}" y2="${ay + ah}" stroke="${major ? '#83838322' : '#8383830f'}" stroke-width="1"/>`
            if (major) {
                body += `<line x1="${xx.toFixed(1)}" y1="${ay + ah}" x2="${xx.toFixed(1)}" y2="${ay + ah + 5}" stroke="#83838388" stroke-width="1"/>`
                body += `<text x="${xx.toFixed(1)}" y="${ay + ah + 24}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">10<tspan dy="-8" font-size="${(cfg.tickSize * 0.7).toFixed(0)}">${e}</tspan></text>`
            }
        }
    }

    // diverged (NaN) strip: dotted separator + single label at left
    body += `<line x1="${ax}" y1="${sy(DIV_Y).toFixed(1)}" x2="${ax + aw}" y2="${sy(DIV_Y).toFixed(1)}" stroke="#83838355" stroke-width="1" stroke-dasharray="2 3"/>`
    body += `<text x="${ax + 8}" y="${(sy(NAN_Y) + 5).toFixed(1)}" text-anchor="start" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">diverged (NaN)</text>`

    const clipId = `plot-${cfg.W}`
    body += `<clipPath id="${clipId}"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}"/></clipPath>`

    // the curve: sample finite region up to the cliff
    const STEP = 0.01
    let d = ''
    let first = true
    for (let x = X_MIN; x <= CLIFF_X + 1e-9; x += STEP) {
        const v = loss(x)
        if (v > Y_MAX + 2) continue
        d += `${first ? 'M' : 'L'}${sx(x).toFixed(1)} ${sy(v).toFixed(1)} `
        first = false
    }
    let g = `<g clip-path="url(#${clipId})">`
    g += `<path d="${d.trim()}" fill="none" stroke="${LINE}" stroke-width="${cfg.lw}"/>`

    // three region bands (very faint fills) to label too-low / sweet / cliff
    const bandY = ay + 4
    const bandH = ah - 8
    const SWEET_X0 = -3.55 // basin has flattened out
    const SWEET_X1 = CLIFF_KNEE // ends where the wall starts
    const regions = [
        { x0: X_MIN, x1: SWEET_X0, fill: '#83838308' }, // too low
        { x0: SWEET_X0, x1: SWEET_X1, fill: '#1da81112' }, // sweet spot
        { x0: SWEET_X1, x1: X_MAX, fill: '#e0556012' }, // cliff
    ]
    for (const r of regions) {
        const x0 = sx(r.x0)
        const x1 = sx(r.x1)
        g += `<rect x="${x0.toFixed(1)}" y="${bandY.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${bandH.toFixed(1)}" fill="${r.fill}"/>`
    }
    g += '</g>'
    body += g

    // "pick here" marker: the last safe rate, just below the cliff knee
    const PICK_X = -3.05
    const px = sx(PICK_X)
    const py = sy(loss(PICK_X))
    body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="13" fill="none" stroke="#1da811" stroke-width="2.4"/>`
    body += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="#1da811" stroke="#fff" stroke-width="0.8"/>`

    // region annotations (kept clear of the curve + strip label)
    const midSweet = (SWEET_X0 + SWEET_X1) / 2
    body += `<text x="${sx(-4.72).toFixed(1)}" y="${sy(4.4).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.annSize}" fill="#838383">too low:<tspan x="${sx(-4.72).toFixed(1)}" dy="${cfg.annSize + 3}">trains slow</tspan></text>`
    body += `<text x="${sx(midSweet).toFixed(1)}" y="${(sy(loss(midSweet)) + 52).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.annSize}" font-weight="700" fill="#1da811">sweet spot</text>`
    body += `<text x="${sx(-2.28).toFixed(1)}" y="${sy(4.4).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.annSize}" font-weight="700" fill="#e05560">cliff:<tspan x="${sx(-2.28).toFixed(1)}" dy="${cfg.annSize + 3}">diverges</tspan></text>`

    // axis labels
    body += `<text x="${ax + aw / 2}" y="${H - 18}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383">learning rate</text>`
    body += `<text x="26" y="${ay + ah / 2}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383" transform="rotate(-90 26 ${(ay + ah / 2).toFixed(1)})">loss (short run)</text>`

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
