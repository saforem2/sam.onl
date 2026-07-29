#!/usr/bin/env node
/*
 * Faithful recreation of the DeepSpeed ZeRO memory-partitioning figure
 * (Rajbhandari et al. 2020, Fig. 7) for the 2026-08-03 talk's zero-fsdp slide.
 *
 * The original (public/assets/zero.png, reused across ~6 prior decks) is a
 * stacked-bar grid: rows = Baseline / P_os / P_os+g / P_os+g+p, columns =
 * gpu_0 / gpu_i / gpu_N-1. Each component (params / gradients / optimizer
 * states) is either REPLICATED (a full-width strip, every GPU holds it) or
 * SHARDED (a narrow 1/N column at the left edge). Moving down the stages,
 * more components collapse from full-width strips into the narrow shard
 * column, so per-GPU memory visibly shrinks.
 *
 * Mermaid can't draw stacked bars, so this is a hand-rolled SVG in the deck's
 * chart style (transparent bg, #838383 chrome, Iosevka embedded, deck palette).
 *
 * Per-param Adam mixed-precision budget (bytes): params 2 + grads 2 +
 * optimizer states 12 (fp32 master 4 + momentum 4 + variance 4) = 16. Bar
 * heights use that 2 : 2 : 12 ratio.
 *
 * Emits landscape (slide) + mobile (narrow/tall) variants.
 * Regenerate:  node scripts/gen-zero-memory.mjs
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
const OUT = join(FIG_DIR, 'zero-memory.svg')
const OUT_MOBILE = join(FIG_DIR, 'zero-memory-mobile.svg')

const FONT = FONT_STACK
// Deck palette: params blue, gradients orange, optimizer states green.
const C = { params: '#118cc2', grads: '#ee8f24', opt: '#1da811' }
// Byte budget per param -> bar-height ratio.
const H = { params: 2, grads: 2, opt: 12 }
const TOTAL = H.params + H.grads + H.opt // 16

// Rows: which components are replicated (full-width) vs sharded (narrow) at
// each ZeRO stage. Order within a bar is always params -> grads -> opt.
const ROWS = [
    {
        label: 'Baseline',
        sub: '',
        shard: { params: false, grads: false, opt: false },
    },
    {
        label: 'P',
        sub: 'os',
        shard: { params: false, grads: false, opt: true },
    },
    {
        label: 'P',
        sub: 'os+g',
        shard: { params: false, grads: true, opt: true },
    },
    {
        label: 'P',
        sub: 'os+g+p',
        shard: { params: true, grads: true, opt: true },
    },
]
const GPUS = [
    { label: 'gpu', sub: '0' },
    { label: 'gpu', sub: 'i' },
    { label: 'gpu', sub: 'N-1' },
]
const COMPONENTS = ['params', 'grads', 'opt']

const LANDSCAPE = {
    W: 900,
    H: 560,
    M: { top: 62, right: 20, bottom: 66, left: 108 },
    cellW: 190,
    dotW: 62,
    barH: 78,
    shardFrac: 0.16,
    titleSize: 27,
    headSize: 20,
    rowLabelSize: 21,
    legendSize: 19,
    dotsSize: 24,
}
const MOBILE = {
    W: 620,
    H: 620,
    M: { top: 60, right: 16, bottom: 70, left: 92 },
    cellW: 132,
    dotW: 40,
    barH: 84,
    shardFrac: 0.18,
    titleSize: 25,
    headSize: 18,
    rowLabelSize: 19,
    legendSize: 18,
    dotsSize: 22,
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

// A stacked bar for one (row, gpu) cell at top-left (cx, cy).
function cell(cfg, cx, cy, shard) {
    const u = cfg.barH / TOTAL
    const shardW = cfg.cellW * cfg.shardFrac
    let out = ''
    // Replicated components: full-width strips stacked from the top.
    let repY = cy
    for (const k of COMPONENTS) {
        if (shard[k]) continue
        const h = H[k] * u
        out += `<rect x="${cx.toFixed(1)}" y="${repY.toFixed(1)}" width="${cfg.cellW.toFixed(1)}" height="${h.toFixed(1)}" fill="${C[k]}" stroke="#fff" stroke-width="0.75"/>`
        repY += h
    }
    // Sharded components: narrow 1/N column at the left, below the strips.
    let shY = repY
    for (const k of COMPONENTS) {
        if (!shard[k]) continue
        const h = H[k] * u
        out += `<rect x="${cx.toFixed(1)}" y="${shY.toFixed(1)}" width="${shardW.toFixed(1)}" height="${h.toFixed(1)}" fill="${C[k]}" stroke="#fff" stroke-width="0.75"/>`
        shY += h
    }
    return out
}

function buildSVG(cfg) {
    const { W, H: HH, M } = cfg
    const ncol = GPUS.length
    const gridW = ncol * cfg.cellW + (ncol - 1) * cfg.dotW
    const ax = M.left
    const ay = M.top
    const nrow = ROWS.length
    const rowGap = (HH - M.top - M.bottom - nrow * cfg.barH) / (nrow - 1)

    const colX = (c) => ax + c * (cfg.cellW + cfg.dotW)
    const rowY = (r) => ay + r * (cfg.barH + rowGap)

    let body = ''

    // title
    body += `<text x="${W / 2}" y="30" text-anchor="middle" font-family="${FONT}" font-size="${cfg.titleSize}" font-weight="700" fill="#838383">ZeRO: per-GPU memory drops each stage</text>`

    // column headers (gpu_0, gpu_i, gpu_N-1)
    for (let c = 0; c < ncol; c++) {
        const x = colX(c) + cfg.cellW / 2
        body += `<text x="${x.toFixed(1)}" y="${(ay - 14).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.headSize}" fill="#838383">${esc(GPUS[c].label)}<tspan dy="4" font-size="${(cfg.headSize * 0.72).toFixed(0)}">${esc(GPUS[c].sub)}</tspan></text>`
    }
    // "..." between GPU columns
    for (let c = 0; c < ncol - 1; c++) {
        const x = colX(c) + cfg.cellW + cfg.dotW / 2
        body += `<text x="${x.toFixed(1)}" y="${(ay + cfg.barH / 2 + 8).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.dotsSize}" fill="#83838399">...</text>`
    }

    // rows
    for (let r = 0; r < nrow; r++) {
        const y = rowY(r)
        // row label (left), vertically centered on the bar
        const row = ROWS[r]
        const ly = y + cfg.barH / 2 + 6
        if (row.sub) {
            body += `<text x="${(ax - 16).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.rowLabelSize}" fill="#838383">${esc(row.label)}<tspan dy="5" font-size="${(cfg.rowLabelSize * 0.72).toFixed(0)}">${esc(row.sub)}</tspan></text>`
        } else {
            body += `<text x="${(ax - 16).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.rowLabelSize}" fill="#838383">${esc(row.label)}</text>`
        }
        // cells
        for (let c = 0; c < ncol; c++) {
            body += cell(cfg, colX(c), y, row.shard)
        }
        // faint separator under each row
        if (r < nrow - 1) {
            const sepY = y + cfg.barH + rowGap / 2
            body += `<line x1="${(ax - 4).toFixed(1)}" y1="${sepY.toFixed(1)}" x2="${(ax + gridW).toFixed(1)}" y2="${sepY.toFixed(1)}" stroke="#83838315" stroke-width="1"/>`
        }
    }

    // legend (bottom): three swatches
    const legendY = HH - 30
    const items = [
        ['params', 'Parameters'],
        ['grads', 'Gradients'],
        ['opt', 'Optimizer states'],
    ]
    const sw = 20
    // measure roughly: swatch + gap + label; lay out left-anchored, centered
    const approxW = items.reduce(
        (a, [, lbl]) => a + sw + 8 + lbl.length * cfg.legendSize * 0.6 + 26,
        0,
    )
    let lx = Math.max(ax, (W - approxW) / 2)
    for (const [k, lbl] of items) {
        body += `<rect x="${lx.toFixed(1)}" y="${(legendY - sw + 4).toFixed(1)}" width="${sw}" height="${sw}" fill="${C[k]}" stroke="#fff" stroke-width="0.75"/>`
        body += `<text x="${(lx + sw + 8).toFixed(1)}" y="${legendY.toFixed(1)}" font-family="${FONT}" font-size="${cfg.legendSize}" fill="#555">${esc(lbl)}</text>`
        lx += sw + 8 + lbl.length * cfg.legendSize * 0.6 + 26
    }

    return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${HH}" width="${W}" height="${HH}" font-family="${FONT}">
${fontDefs()}
${body}
</svg>
`
}

writeFileSync(OUT, buildSVG(LANDSCAPE))
console.log('wrote', OUT)
writeFileSync(OUT_MOBILE, buildSVG(MOBILE))
console.log('wrote', OUT_MOBILE)
