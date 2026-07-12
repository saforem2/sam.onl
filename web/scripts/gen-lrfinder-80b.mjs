#!/usr/bin/env node
/*
 * Generate the 80B production-batch (GBS=6144) LR-finder chart for the
 * 2026-07-14 talk, matching the SC26 paper's Fig. 10 CONTENT (all four
 * optimizers, diverged-LR x-marks, circled U-minima) but rendered in the
 * deck's "ambivalent" style: transparent background, #838383 theme-invariant
 * chrome, Iosevka embedded, and the deck's optimizer palette so a given
 * optimizer reads the same color here as on the mano loss-curves slide.
 *
 * Data transcribed from the paper repo's committed
 *   aurora-gpt-tpc-sc26/scripts/lr_finder_80b.csv
 * (written by pull_wandb_80b_lrfinder.py). AdamW and muon diverge to NaN with
 * no usable minimum (x on the top strip mark the diverged LRs); mano and
 * SophiaG reach a real U-minimum (circled) before blowing up past it.
 *
 * Emits landscape (slide) + mobile (narrow/tall) variants.
 * Regenerate:  node scripts/gen-lrfinder-80b.mjs
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
    '2026-07-14',
    'figures',
)
const OUT = join(FIG_DIR, 'lr-finder-80b.svg')
const OUT_MOBILE = join(FIG_DIR, 'lr-finder-80b-mobile.svg')

// Each run: finite (lr, loss) points + the LRs that diverged to NaN.
// Colors match the deck's optimizer palette (gen-optimizer-loss.mjs).
const NaNv = null
const RUNS = [
    {
        key: 'mano',
        label: 'mano',
        color: '#1da811',
        marker: 'square',
        hasMin: true,
        rows: [
            [2.0e-5, 12.978],
            [4.0e-5, 12.975],
            [6.0e-5, 12.969],
            [8.0e-5, 12.96],
            [1.0e-4, 12.942],
            [1.2e-4, 12.907],
            [1.4e-4, 12.849],
            [1.6e-4, 12.727],
            [1.8e-4, 12.517],
            [2.0e-4, 12.154],
            [2.2e-4, 12.231],
            [2.4e-4, 12.239],
            [2.6e-4, 11.891],
            [2.8e-4, 13.269],
            [3.0e-4, 13.408],
        ],
        nan: [],
    },
    {
        key: 'sophiag',
        label: 'SophiaG',
        color: '#e05560',
        marker: 'triangle',
        hasMin: true,
        rows: [
            [2.0e-5, 12.936],
            [4.0e-5, 12.941],
            [6.0e-5, 12.925],
            [8.0e-5, 12.901],
            [1.0e-4, 12.892],
            [1.2e-4, 12.792],
            [1.4e-4, 12.662],
            [1.6e-4, 12.418],
            [1.8e-4, 12.005],
            [2.0e-4, 11.772],
            [2.2e-4, 13.504],
            [2.4e-4, 18.984],
            [2.6e-4, 17.135],
            [2.8e-4, 17.834],
            [3.0e-4, 18.178],
        ],
        nan: [],
    },
    {
        key: 'adamw',
        label: 'AdamW',
        color: '#ee8f24',
        marker: 'circle',
        hasMin: false,
        rows: [
            [5.333e-5, 12.911],
            [1.067e-4, 12.904],
            [1.6e-4, 12.974],
            [2.133e-4, 12.898],
            [2.667e-4, 12.835],
            [3.2e-4, 12.773],
            [3.733e-4, 12.636],
            [4.267e-4, 12.403],
        ],
        nan: [4.8e-4, 5.333e-4, 5.867e-4, 6.4e-4, 6.933e-4, 7.467e-4, 8.0e-4],
    },
    {
        key: 'muon',
        label: 'Muon',
        color: '#118cc2',
        marker: 'diamond',
        hasMin: false,
        rows: [
            [1.6e-4, 12.92],
            [3.2e-4, 12.918],
            [4.8e-4, 12.915],
            [6.4e-4, 12.909],
            [8.0e-4, 12.921],
            [9.6e-4, 12.877],
        ],
        nan: [
            1.12e-3, 1.28e-3, 1.44e-3, 1.6e-3, 1.76e-3, 1.92e-3, 2.08e-3,
            2.24e-3, 2.4e-3,
        ],
    },
]
void NaNv

const X_MIN = 1.7e-5
const X_MAX = 2.9e-3
const Y_MIN = 11.4
const Y_MAX = 13.6
const NAN_Y = 13.42 // top strip where diverged LRs are marked
const DIV_Y = 13.3 // dotted separator line

const FONT = FONT_STACK
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const log10 = (x) => Math.log(x) / Math.LN10

function marker(kind, cx, cy, color, r = 4.5) {
    const x = cx.toFixed(1)
    const y = cy.toFixed(1)
    switch (kind) {
        case 'square':
            return `<rect x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${(2 * r).toFixed(1)}" height="${(2 * r).toFixed(1)}" fill="${color}" stroke="#fff" stroke-width="0.6"/>`
        case 'triangle': {
            const p = `${x},${(cy - r).toFixed(1)} ${(cx - r).toFixed(1)},${(cy + r).toFixed(1)} ${(cx + r).toFixed(1)},${(cy + r).toFixed(1)}`
            return `<polygon points="${p}" fill="${color}" stroke="#fff" stroke-width="0.6"/>`
        }
        case 'diamond': {
            const p = `${x},${(cy - r).toFixed(1)} ${(cx + r).toFixed(1)},${y} ${x},${(cy + r).toFixed(1)} ${(cx - r).toFixed(1)},${y}`
            return `<polygon points="${p}" fill="${color}" stroke="#fff" stroke-width="0.6"/>`
        }
        default:
            return `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${color}" stroke="#fff" stroke-width="0.6"/>`
    }
}

// ── layout configs ──────────────────────────────────────────────────
const LANDSCAPE = {
    W: 1120,
    H: 680,
    M: { top: 118, right: 34, bottom: 74, left: 84 },
    titleSize: 30,
    subSize: 18,
    legendSize: 20,
    axisSize: 22,
    tickSize: 18,
    lw: 2.4,
    mr: 4.8,
    legendCols: 4,
}
const MOBILE = {
    W: 640,
    H: 720,
    M: { top: 150, right: 26, bottom: 74, left: 74 },
    titleSize: 30,
    subSize: 17,
    legendSize: 21,
    axisSize: 23,
    tickSize: 19,
    lw: 2.6,
    mr: 5.2,
    legendCols: 2,
}

function buildSVG(cfg) {
    const { W, H, M } = cfg
    const ax = M.left
    const ay = M.top
    const aw = W - M.left - M.right
    const ah = H - M.top - M.bottom
    const sx = (lr) =>
        ax + ((log10(lr) - log10(X_MIN)) / (log10(X_MAX) - log10(X_MIN))) * aw
    const sy = (v) => ay + ah - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * ah
    const clipId = `plot-${cfg.W}`

    let body = ''

    // title + subtitle
    body += `<text x="${W / 2}" y="34" text-anchor="middle" font-family="${FONT}" font-size="${cfg.titleSize}" font-weight="700" fill="#838383">80B LR-finder (production batch, GBS=6,144)</text>`
    body += `<text x="${W / 2}" y="58" text-anchor="middle" font-family="${FONT}" font-size="${cfg.subSize}" fill="#838383">AdamW &amp; muon cliff straight to NaN; mano &amp; SophiaG reach a real minimum first</text>`

    // axes box
    body += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`

    // y gridlines + labels (0.5 steps: 11.5..13.5)
    for (let v = 11.5; v <= 13.5 + 1e-9; v += 0.5) {
        const yy = sy(v)
        body += `<line x1="${ax}" y1="${yy.toFixed(1)}" x2="${ax + aw}" y2="${yy.toFixed(1)}" stroke="#83838318" stroke-width="1"/>`
        body += `<text x="${ax - 10}" y="${(yy + 5).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v.toFixed(1)}</text>`
    }

    // x gridlines: decade majors (1e-4, 1e-3) + faint minors (2..9)
    for (let e = -5; e <= -2; e++) {
        for (let m = 1; m <= 9; m++) {
            const lr = m * Math.pow(10, e)
            if (lr < X_MIN || lr > X_MAX) continue
            const xx = sx(lr)
            const major = m === 1
            body += `<line x1="${xx.toFixed(1)}" y1="${ay}" x2="${xx.toFixed(1)}" y2="${ay + ah}" stroke="${major ? '#83838322' : '#8383830f'}" stroke-width="1"/>`
            if (major) {
                body += `<line x1="${xx.toFixed(1)}" y1="${ay + ah}" x2="${xx.toFixed(1)}" y2="${ay + ah + 5}" stroke="#83838388" stroke-width="1"/>`
                body += `<text x="${xx.toFixed(1)}" y="${ay + ah + 24}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">10<tspan dy="-8" font-size="${(cfg.tickSize * 0.7).toFixed(0)}">${e}</tspan></text>`
            }
        }
    }

    // diverged (NaN) strip: dotted separator + label
    body += `<line x1="${ax}" y1="${sy(DIV_Y).toFixed(1)}" x2="${ax + aw}" y2="${sy(DIV_Y).toFixed(1)}" stroke="#83838355" stroke-width="1" stroke-dasharray="2 3"/>`
    body += `<text x="${ax + 8}" y="${(sy(NAN_Y) + 5).toFixed(1)}" text-anchor="start" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">diverged (NaN)</text>`

    // clip so post-minimum blow-ups (SophiaG) exit cleanly through the top
    body += `<clipPath id="${clipId}"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}"/></clipPath>`

    // series (draw order = RUNS order; winners first so they sit on top)
    let series = `<g clip-path="url(#${clipId})">`
    let overlay = '' // minima circles + NaN x-marks drawn above the clip
    for (const run of RUNS) {
        const pts = run.rows.slice().sort((a, b) => a[0] - b[0])
        const d = pts
            .map(
                (p, i) =>
                    `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`,
            )
            .join(' ')
        series += `<path d="${d}" fill="none" stroke="${run.color}" stroke-width="${cfg.lw}"/>`
        for (const [lr, loss] of pts) {
            series += marker(run.marker, sx(lr), sy(loss), run.color, cfg.mr)
        }
        // circle the real minimum
        if (run.hasMin) {
            let mi = 0
            for (let i = 1; i < pts.length; i++)
                if (pts[i][1] < pts[mi][1]) mi = i
            const cx = sx(pts[mi][0])
            const cy = sy(pts[mi][1])
            overlay += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(cfg.mr * 2.6).toFixed(1)}" fill="none" stroke="${run.color}" stroke-width="2"/>`
        }
        // x-marks for diverged LRs on the top strip
        for (const lr of run.nan) {
            const cx = sx(lr)
            const cy = sy(NAN_Y)
            const r = cfg.mr
            overlay += `<path d="M${(cx - r).toFixed(1)} ${(cy - r).toFixed(1)}l${(2 * r).toFixed(1)} ${(2 * r).toFixed(1)}M${(cx + r).toFixed(1)} ${(cy - r).toFixed(1)}l${(-2 * r).toFixed(1)} ${(2 * r).toFixed(1)}" stroke="${run.color}" stroke-width="1.8"/>`
        }
    }
    series += '</g>'
    body += series + overlay

    // axis labels
    body += `<text x="${ax + aw / 2}" y="${H - 18}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383">learning rate</text>`
    body += `<text x="24" y="${ay + ah / 2}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383" transform="rotate(-90 24 ${(ay + ah / 2).toFixed(1)})">smoothed loss</text>`

    // legend (row of optimizer swatches; wraps by legendCols)
    const lsz = cfg.legendSize
    const legendY = 86
    const colW = aw / cfg.legendCols
    RUNS.forEach((run, i) => {
        const c = i % cfg.legendCols
        const r = Math.floor(i / cfg.legendCols)
        const lx = ax + c * colW
        const ly = legendY + r * (lsz + 10)
        body += `<line x1="${lx}" y1="${ly - 5}" x2="${lx + 26}" y2="${ly - 5}" stroke="${run.color}" stroke-width="2.6"/>`
        body += marker(run.marker, lx + 13, ly - 5, run.color, lsz * 0.28)
        body += `<text x="${lx + 34}" y="${ly}" font-family="${FONT}" font-size="${lsz}" fill="#555">${esc(run.label)}</text>`
    })

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
