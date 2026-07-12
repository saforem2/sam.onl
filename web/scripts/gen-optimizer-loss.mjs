#!/usr/bin/env node
/*
 * Generate the optimizer loss-curves chart for the 2026-07-14 talk's mano slide.
 *
 * Pairs with the mano results table: the same 2B / GBS=48 / 1000-step speedrun
 * (agpt_2b with FineWeb-EDU, 2N Sunspot, 2026-04-26), showing loss-vs-step for
 * the four optimizers the table ranks. Final losses match the table + the docs
 * competition writeup (docs/competitions/agpt2b-n2-1000steps): Muon 3.557,
 * mano 3.631, AdamW 3.801, SophiaG 4.719.
 *
 * Data pulled from W&B (aurora_gpt/torchtitan.ezpz.train) via sampledHistory,
 * metric loss_metrics/global_avg_loss, runs:
 *   muon    speedrun_2b_muon    (wi9mp8co)
 *   mano    speedrun_2b_mano    (9pd9opbe)
 *   adamw   speedrun_2b_adamw   (p1qwxboy)
 *   sophiag speedrun_2b_sophiag (vkfy4lot)
 * Downsampled here (stride 4 <=120, 10 <=400, 20 after); raw values kept, incl.
 * the honest transient blips (AdamW step-4, SophiaG step-520).
 *
 * Iosevka is embedded via svg-font.mjs (an <img>-loaded SVG can't see page web
 * fonts). No matplotlib/numpy: emits SVG directly. Regenerate:
 *   node scripts/gen-optimizer-loss.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fontDefs, FONT_STACK } from './svg-font.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(
    __dirname,
    '..',
    'public',
    'talks',
    '2026-07-14',
    'figures',
    'optimizer-loss.svg',
)

// ── data (downsampled from W&B sampledHistory) ──────────────────────
// prettier-ignore
const MUON = [[1, 12.9633], [2, 12.605], [4, 11.6219], [8, 9.4447], [12, 8.5083], [16, 8.3228], [20, 8.0469], [24, 7.7906], [28, 7.653], [32, 7.4097], [36, 7.214], [40, 7.1873], [44, 7.1039], [48, 6.9833], [52, 7.0175], [56, 6.844], [60, 6.7625], [64, 6.7238], [68, 6.6753], [72, 6.6098], [76, 6.5614], [80, 6.6117], [84, 6.5194], [88, 6.466], [92, 6.4864], [96, 6.406], [100, 6.3986], [104, 6.3497], [108, 6.3449], [112, 6.2796], [116, 6.2385], [120, 6.2567], [130, 6.2392], [140, 6.175], [150, 6.0717], [160, 6.0572], [170, 6.1299], [180, 5.9678], [190, 6.0003], [200, 5.9489], [210, 5.8658], [220, 5.92], [230, 5.8055], [240, 5.7399], [250, 5.6789], [260, 5.5819], [270, 5.5531], [280, 5.4329], [290, 5.4897], [300, 5.4267], [310, 5.351], [320, 5.2691], [330, 5.2222], [340, 5.0538], [350, 5.0395], [360, 5.0521], [370, 4.9935], [380, 4.9471], [390, 4.8972], [400, 4.8753], [420, 4.7499], [440, 4.6389], [460, 4.5976], [480, 4.4791], [500, 4.4964], [520, 4.3111], [540, 4.2311], [560, 4.2747], [580, 4.2081], [600, 4.0942], [620, 4.0751], [640, 4.0646], [660, 3.9957], [680, 3.94], [700, 3.997], [720, 3.9013], [740, 3.9241], [760, 3.8013], [780, 3.7712], [800, 3.6707], [820, 3.7804], [840, 3.746], [860, 3.7825], [880, 3.7225], [900, 3.6494], [920, 3.6777], [940, 3.63], [960, 3.5697], [980, 3.5403], [1000, 3.5568]]
// prettier-ignore
const MANO = [[1, 12.957], [2, 12.8489], [4, 12.2775], [8, 10.9469], [12, 9.7445], [16, 8.2729], [20, 7.4881], [24, 7.1044], [28, 7.0509], [32, 6.9077], [36, 6.8521], [40, 6.817], [44, 6.7677], [48, 6.7667], [52, 6.8475], [56, 6.8709], [60, 6.6898], [64, 6.6578], [68, 6.6066], [72, 6.5603], [76, 6.54], [80, 6.572], [84, 6.4861], [88, 6.4202], [92, 6.4607], [96, 6.3585], [100, 6.3638], [104, 6.2957], [108, 6.2797], [112, 6.21], [116, 6.1464], [120, 6.1559], [130, 6.126], [140, 6.0518], [150, 5.9254], [160, 5.8821], [170, 5.9521], [180, 5.7379], [190, 5.7699], [200, 5.699], [210, 5.577], [220, 5.6107], [230, 5.4772], [240, 5.3976], [250, 5.3248], [260, 5.2271], [270, 5.2321], [280, 5.0906], [290, 5.1652], [300, 5.1016], [310, 5.0383], [320, 4.9594], [330, 4.9473], [340, 4.793], [350, 4.8001], [360, 4.8256], [370, 4.7751], [380, 4.7374], [390, 4.695], [400, 4.7071], [420, 4.5924], [440, 4.5003], [460, 4.4735], [480, 4.3841], [500, 4.4137], [520, 4.2541], [540, 4.1775], [560, 4.2276], [580, 4.1838], [600, 4.0866], [620, 4.0784], [640, 4.0754], [660, 4.0069], [680, 3.9648], [700, 4.029], [720, 3.9366], [740, 3.9498], [760, 3.8365], [780, 3.8128], [800, 3.7199], [820, 3.828], [840, 3.791], [860, 3.8232], [880, 3.7757], [900, 3.7051], [920, 3.7402], [940, 3.6967], [960, 3.6392], [980, 3.6164], [1000, 3.6311]]
// prettier-ignore
const ADAMW = [[1, 12.9628], [2, 12.0462], [4, 14.4863], [8, 9.1148], [12, 7.8493], [16, 7.899], [20, 7.5475], [24, 7.4986], [28, 7.3883], [32, 7.1992], [36, 7.0276], [40, 7.0531], [44, 7.0063], [48, 6.8687], [52, 6.9376], [56, 6.7811], [60, 6.707], [64, 6.6674], [68, 6.6579], [72, 6.5932], [76, 6.5156], [80, 6.5453], [84, 6.4755], [88, 6.4433], [92, 6.448], [96, 6.3636], [100, 6.3556], [104, 6.3009], [108, 6.285], [112, 6.2432], [116, 6.2101], [120, 6.2007], [130, 6.1527], [140, 6.0529], [150, 5.9919], [160, 5.9334], [170, 6.0033], [180, 5.8127], [190, 5.87], [200, 5.7877], [210, 5.7423], [220, 5.7634], [230, 5.6421], [240, 5.6233], [250, 5.527], [260, 5.4279], [270, 5.4206], [280, 5.3736], [290, 5.3826], [300, 5.3452], [310, 5.2732], [320, 5.2408], [330, 5.2185], [340, 5.0654], [350, 5.0823], [360, 5.12], [370, 5.0565], [380, 5.077], [390, 5.0069], [400, 4.9981], [420, 4.9127], [440, 4.8362], [460, 4.8048], [480, 4.718], [500, 4.7541], [520, 4.5978], [540, 4.5544], [560, 4.5943], [580, 4.5638], [600, 4.454], [620, 4.4502], [640, 4.4585], [660, 4.3572], [680, 4.325], [700, 4.3719], [720, 4.264], [740, 4.2712], [760, 4.1306], [780, 4.1037], [800, 3.9935], [820, 4.0935], [840, 4.0405], [860, 4.0548], [880, 4.005], [900, 3.9201], [920, 3.9508], [940, 3.895], [960, 3.8281], [980, 3.7935], [1000, 3.801]]
// prettier-ignore
const SOPHIAG = [[1, 12.9161], [2, 12.6263], [4, 11.6407], [8, 10.3784], [12, 8.7992], [16, 7.8154], [20, 7.4519], [24, 7.6708], [28, 7.6208], [32, 7.4145], [36, 7.2496], [40, 7.2897], [44, 7.2508], [48, 7.1433], [52, 7.2549], [56, 7.0773], [60, 6.9624], [64, 6.9221], [68, 6.9047], [72, 6.8003], [76, 6.731], [80, 6.7835], [84, 6.6966], [88, 6.6371], [92, 6.6385], [96, 6.5308], [100, 6.5211], [104, 6.4857], [108, 6.4399], [112, 6.3752], [116, 6.3238], [120, 6.3153], [130, 6.2882], [140, 6.2278], [150, 6.0973], [160, 6.0741], [170, 6.1625], [180, 5.9834], [190, 5.9958], [200, 5.9849], [210, 5.9846], [220, 6.2537], [230, 6.3813], [240, 5.9999], [250, 5.8939], [260, 5.7845], [270, 5.7856], [280, 5.6855], [290, 5.7548], [300, 5.7279], [310, 5.6461], [320, 5.5998], [330, 5.647], [340, 5.5046], [350, 5.5125], [360, 5.55], [370, 5.5054], [380, 5.48], [390, 5.4327], [400, 5.4338], [420, 5.3789], [440, 5.2958], [460, 5.2982], [480, 5.2497], [500, 5.2397], [520, 7.4652], [540, 5.6265], [560, 5.369], [580, 5.2962], [600, 5.1764], [620, 5.1354], [640, 5.1476], [660, 5.0761], [680, 5.0617], [700, 5.135], [720, 5.0086], [740, 5.0537], [760, 4.9394], [780, 4.9388], [800, 4.8531], [820, 4.9372], [840, 4.9067], [860, 4.9096], [880, 4.8894], [900, 4.796], [920, 4.8793], [940, 4.7906], [960, 4.7149], [980, 4.7189], [1000, 4.7187]]

// draw order: worst-first so the winners (muon/mano) sit on top
const SERIES = [
    { label: 'SophiaG', data: SOPHIAG, val: 4.719, color: '#e05560' },
    { label: 'AdamW', data: ADAMW, val: 3.801, color: '#ee8f24' },
    { label: 'Muon', data: MUON, val: 3.557, color: '#118cc2' },
    { label: 'mano', data: MANO, val: 3.631, color: '#1da811' },
]

// ── layout: landscape, fits the right column of a 2-col slide ───────
const W = 760
const H = 500
const AX = { top: 60, right: 24, bottom: 60, left: 62 }
const ax = AX.left
const ay = AX.top
const aw = W - AX.left - AX.right
const ah = H - AX.top - AX.bottom
const X_MAX = 1000 // steps
const Y_MIN = 3.0
const Y_MAX = 13.0
const FONT = FONT_STACK

const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const sx = (s) => ax + (Math.min(s, X_MAX) / X_MAX) * aw
const sy = (v) =>
    ay +
    ah -
    ((Math.min(Math.max(v, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * ah

let body = ''

// title + subtitle
body += `<text x="${W / 2}" y="28" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="700" fill="#838383">Loss vs step (2B, GBS=48, 1k steps)</text>`
body += `<text x="${W / 2}" y="50" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#838383">agpt_2b speedrun on FineWeb-EDU</text>`

// axes box
body += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`

// y gridlines + labels (3 .. 13 by 2)
for (let v = Y_MIN; v <= Y_MAX + 0.001; v += 2) {
    const yy = sy(v)
    body += `<line x1="${ax}" y1="${yy}" x2="${ax + aw}" y2="${yy}" stroke="#83838322" stroke-width="1"/>`
    body += `<text x="${ax - 10}" y="${yy + 5}" text-anchor="end" font-family="${FONT}" font-size="13" fill="#838383">${v.toFixed(0)}</text>`
}
// x ticks (0 .. 1000 by 250)
for (let s = 0; s <= 1000; s += 250) {
    const xx = sx(s)
    body += `<line x1="${xx}" y1="${ay + ah}" x2="${xx}" y2="${ay + ah + 5}" stroke="#83838388" stroke-width="1"/>`
    body += `<text x="${xx}" y="${ay + ah + 24}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#838383">${s}</text>`
}
// axis titles
body += `<text x="${ax + aw / 2}" y="${ay + ah + 52}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#838383">step</text>`
body += `<text x="${ax - 46}" y="${ay + ah / 2}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#838383" transform="rotate(-90 ${ax - 46} ${ay + ah / 2})">training loss</text>`

// series
for (const r of SERIES) {
    const d = r.data
        .map(
            (p, i) =>
                `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`,
        )
        .join(' ')
    body += `<path d="${d}" fill="none" stroke="${r.color}" stroke-width="2.2"/>`
}

// legend (top-right, inside the plot where the curves are high early then drop)
let lx = ax + aw - 168
let ly = ay + 16
body += `<rect x="${lx - 10}" y="${ly - 16}" width="178" height="${SERIES.length * 22 + 12}" fill="#83838310" stroke="#83838333" stroke-width="1"/>`
for (const r of [...SERIES].reverse()) {
    body += `<line x1="${lx}" y1="${ly - 4}" x2="${lx + 22}" y2="${ly - 4}" stroke="${r.color}" stroke-width="2.8"/>`
    body += `<text x="${lx + 30}" y="${ly}" font-family="${FONT}" font-size="13" fill="#838383">${esc(r.label)} <tspan fill="${r.color}">${r.val.toFixed(3)}</tspan></text>`
    ly += 22
}

const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
${fontDefs()}
${body}
</svg>
`

writeFileSync(OUT, svg)
console.log('wrote', OUT)
