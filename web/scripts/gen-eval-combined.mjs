#!/usr/bin/env node
/*
 * Generate a combined 4-benchmark eval overview SVG for the 2026-07-14 talk.
 *
 * Why this exists: the torchtitan docs ship a 7-panel `all-production-evals.svg`
 * (adds PIQA/OpenBookQA/BoolQ, which lack full TT+MDS coverage) and separate
 * per-model overviews. We want ONE chart with just the four benchmarks that
 * have both TorchTitan and the MDS reference (HellaSwag, ARC-Easy,
 * ARC-Challenge, Winogrande) with 2B and 20B runs overlaid on shared axes.
 *
 * The raw eval JSON isn't committed to the docs repo, so the data below is
 * transcribed from the per-step accuracy tables in
 *   docs/evals/agpt/{2b,20b}/README.md   (branch ezpz).
 * Regenerate the deck asset with:  node scripts/gen-eval-combined.mjs
 *
 * No matplotlib / numpy dependency: emits SVG directly so it runs anywhere.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(
    __dirname,
    '..',
    'public',
    'talks',
    '2026-07-14',
    'figures',
    'eval-combined-4bench.svg',
)

// Tasks (order = panel grid, row-major 2x2)
const TASKS = ['hellaswag', 'arc_easy', 'arc_challenge', 'winogrande']
const TITLES = {
    hellaswag: 'HellaSwag',
    arc_easy: 'ARC-Easy',
    arc_challenge: 'ARC-Challenge',
    winogrande: 'Winogrande',
}
const RANDOM = {
    hellaswag: 0.25,
    arc_easy: 0.25,
    arc_challenge: 0.25,
    winogrande: 0.5,
}

// Each run: rows = [tokensB, hellaswag, arc_easy, arc_challenge, winogrande].
// Transcribed from docs/evals/agpt/{2b,20b}/README.md (ezpz branch).
const RUNS = [
    {
        key: 'mds',
        label: '2B MDS ref (SophiaG)',
        color: '#118cc2',
        dash: '4 3',
        // MDS has a single well-characterized spot vs v2 256N step-52k (~3.52T tok).
        rows: [[3520, 0.5555, 0.649, 0.3336, 0.558]],
        marker: 'x',
    },
    {
        key: 'v2_2b_256',
        label: '2B v2 256N',
        color: '#e05560',
        rows: [
            [10.1, 0.2548, 0.2618, 0.227, 0.4933],
            [50.3, 0.2616, 0.3826, 0.2125, 0.4996],
            [100.7, 0.3014, 0.4819, 0.2346, 0.4957],
            [704.6, 0.4878, 0.5981, 0.3038, 0.5185],
            [1006.6, 0.5109, 0.6174, 0.2995, 0.5383],
            [1263.3, 0.5297, 0.6279, 0.308, 0.532],
            [1811.9, 0.5346, 0.6469, 0.3157, 0.5588],
            [2063.6, 0.544, 0.6435, 0.3183, 0.5564],
            [2617.2, 0.5522, 0.6414, 0.3123, 0.5525],
            [3019.9, 0.5544, 0.6503, 0.3302, 0.5549],
            [3518.2, 0.5555, 0.649, 0.3336, 0.558],
            [4053.7, 0.5601, 0.6519, 0.3345, 0.5533],
            [4353.7, 0.5595, 0.6511, 0.3319, 0.5525],
            [4673.7, 0.561, 0.6511, 0.3362, 0.543],
        ],
    },
    {
        key: 'v2_2b_512',
        label: '2B v2 512N',
        color: '#ee8f24',
        rows: [
            [100.7, 0.2638, 0.362, 0.227, 0.513],
            [302.0, 0.3481, 0.513, 0.2509, 0.5193],
            [503.3, 0.405, 0.5236, 0.2722, 0.5233],
            [704.6, 0.4383, 0.5766, 0.2765, 0.5343],
            [906.0, 0.4585, 0.6048, 0.2833, 0.5399],
            [1208.0, 0.4848, 0.604, 0.2824, 0.5304],
            [1610.6, 0.5035, 0.6145, 0.2944, 0.5438],
            [2113.9, 0.5173, 0.6183, 0.2961, 0.5335],
            [2617.2, 0.5266, 0.6359, 0.3046, 0.5399],
            [3019.9, 0.5319, 0.6406, 0.2995, 0.5217],
        ],
    },
    {
        key: 'v2_20b_512',
        label: '20B v2 512N',
        color: '#1da811',
        rows: [
            [10.1, 0.2541, 0.266, 0.2312, 0.4846],
            [50.3, 0.2657, 0.3594, 0.221, 0.5012],
            [100.7, 0.3048, 0.4701, 0.2363, 0.5099],
            [140.9, 0.3618, 0.5307, 0.2585, 0.5114],
            [201.3, 0.4516, 0.5939, 0.2816, 0.5107],
            [241.6, 0.5025, 0.6195, 0.2978, 0.528],
            [281.9, 0.546, 0.6444, 0.3166, 0.5541],
            [302.0, 0.5624, 0.6574, 0.3268, 0.5406],
            [342.3, 0.5931, 0.6717, 0.3387, 0.5683],
            [372.5, 0.6022, 0.6768, 0.3396, 0.5817],
            [402.7, 0.6139, 0.6827, 0.3609, 0.5817],
            [432.9, 0.6271, 0.6961, 0.3635, 0.5919],
            [442.9, 0.6339, 0.6932, 0.3823, 0.5912],
            [543.6, 0.6103, 0.6671, 0.349, 0.5706],
        ],
    },
]

// ── layout ──────────────────────────────────────────────────────────
const W = 1280
const H = 760
const M = { top: 96, right: 28, bottom: 56, left: 28 }
const COLS = 2
const ROWS = 2
const GX = 64 // gap between panel columns
const GY = 64 // gap between panel rows
const gridW = W - M.left - M.right
const gridH = H - M.top - M.bottom
const panelW = (gridW - GX * (COLS - 1)) / COLS
const panelH = (gridH - GY * (ROWS - 1)) / ROWS
const PAD = { top: 26, right: 12, bottom: 34, left: 46 } // inside each panel

const X_MAX = 4800 // tokens (B); covers the 4.67T 2B run + headroom
const FONT =
    "'mIosevka-QP Web','Iosevka Web','JetBrains Mono',Menlo,monospace"

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const fmt = (n) => (Math.round(n * 1000) / 1000).toString()

function taskYRange(task) {
    // Fixed, readable per-task y-ranges (match the docs' feel).
    if (task === 'winogrande') return [0.45, 0.62]
    if (task === 'arc_challenge') return [0.2, 0.42]
    if (task === 'arc_easy') return [0.24, 0.72]
    return [0.24, 0.64] // hellaswag
}

function panel(task, px, py) {
    const [yMin, yMax] = taskYRange(task)
    const ax = px + PAD.left
    const ay = py + PAD.top
    const aw = panelW - PAD.left - PAD.right
    const ah = panelH - PAD.top - PAD.bottom
    const sx = (t) => ax + (Math.min(t, X_MAX) / X_MAX) * aw
    const sy = (v) => ay + ah - ((v - yMin) / (yMax - yMin)) * ah
    const ti = TASKS.indexOf(task) >= 0 ? TASKS.indexOf(task) : 0
    const col = ti // index within row of RUNS.rows

    let s = ''
    // panel title
    s += `<text x="${px + panelW / 2}" y="${py + 16}" text-anchor="middle" font-family="${FONT}" font-size="19" fill="#444">${esc(TITLES[task])}</text>`

    // axes box
    s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#d8d8d8" stroke-width="1"/>`

    // y gridlines + labels (4 ticks)
    for (let k = 0; k <= 4; k++) {
        const v = yMin + ((yMax - yMin) * k) / 4
        const yy = sy(v)
        s += `<line x1="${ax}" y1="${yy}" x2="${ax + aw}" y2="${yy}" stroke="#eee" stroke-width="1"/>`
        s += `<text x="${ax - 6}" y="${yy + 4}" text-anchor="end" font-family="${FONT}" font-size="12" fill="#888">${fmt(v)}</text>`
    }
    // x ticks (0,1,2,3,4 T)
    for (let k = 0; k <= 4; k++) {
        const t = (X_MAX * k) / 4
        const xx = sx(t)
        s += `<line x1="${xx}" y1="${ay + ah}" x2="${xx}" y2="${ay + ah + 4}" stroke="#aaa" stroke-width="1"/>`
        s += `<text x="${xx}" y="${ay + ah + 18}" text-anchor="middle" font-family="${FONT}" font-size="12" fill="#888">${(t / 1000).toFixed(0)}T</text>`
    }
    // random baseline
    const yr = sy(RANDOM[task])
    if (RANDOM[task] >= yMin && RANDOM[task] <= yMax) {
        s += `<line x1="${ax}" y1="${yr}" x2="${ax + aw}" y2="${yr}" stroke="#bbb" stroke-width="1" stroke-dasharray="2 3"/>`
    }

    // series (data index = 1 + col within row)
    for (const run of RUNS) {
        const pts = run.rows
            .map((r) => [r[0], r[1 + col]])
            .filter((p) => p[1] != null)
            .sort((a, b) => a[0] - b[0])
        if (!pts.length) continue
        const dash = run.dash ? ` stroke-dasharray="${run.dash}"` : ''
        if (pts.length > 1) {
            const d = pts
                .map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`)
                .join(' ')
            s += `<path d="${d}" fill="none" stroke="${run.color}" stroke-width="2"${dash}/>`
        }
        for (const p of pts) {
            const cx = sx(p[0])
            const cy = sy(p[1])
            if (run.marker === 'x') {
                s += `<path d="M${(cx - 4).toFixed(1)} ${(cy - 4).toFixed(1)}l8 8M${(cx + 4).toFixed(1)} ${(cy - 4).toFixed(1)}l-8 8" stroke="${run.color}" stroke-width="2"/>`
            } else {
                s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${pts.length === 1 ? 4 : 2.4}" fill="${run.color}"/>`
            }
        }
    }
    return s
}

let body = ''
// title
body += `<text x="${W / 2}" y="34" text-anchor="middle" font-family="${FONT}" font-size="22" font-weight="700" fill="#333">AuroraGPT eval: 2B + 20B vs MDS reference</text>`
body += `<text x="${W / 2}" y="56" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#888">lm-eval accuracy vs tokens consumed (four benchmarks with TorchTitan + MDS coverage)</text>`

// legend
let lx = M.left + 8
const ly = 78
for (const run of RUNS) {
    const dash = run.dash ? ` stroke-dasharray="${run.dash}"` : ''
    body += `<line x1="${lx}" y1="${ly - 4}" x2="${lx + 24}" y2="${ly - 4}" stroke="${run.color}" stroke-width="2.5"${dash}/>`
    if (run.marker === 'x')
        body += `<path d="M${lx + 8} ${ly - 8}l8 8M${lx + 16} ${ly - 8}l-8 8" stroke="${run.color}" stroke-width="2"/>`
    body += `<text x="${lx + 30}" y="${ly}" font-family="${FONT}" font-size="13" fill="#555">${esc(run.label)}</text>`
    lx += 30 + run.label.length * 8 + 26
}

// panels
TASKS.forEach((task, i) => {
    const c = i % COLS
    const r = Math.floor(i / COLS)
    const px = M.left + c * (panelW + GX)
    const py = M.top + r * (panelH + GY)
    body += panel(task, px, py)
})

const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${body}
</svg>
`

writeFileSync(OUT, svg)
console.log('wrote', OUT)
