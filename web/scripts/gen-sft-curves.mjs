#!/usr/bin/env node
/*
 * Generate the SFT training-curves SVG for the 2026-07-14 talk.
 *
 * Why this exists: the docs' committed sft-curves.svg has a saw-toothed
 * "tokens seen" panel, because TRL's num_tokens counter resets to ~0 on every
 * auto-retry resume. The upstream plot script (plot_sft_curves.py, patched to
 * stitch cumulative tokens) needs the cluster's merged trainer_state.json to
 * regenerate; that data isn't here. So this reconstructs the chart from the
 * W&B runs instead: the AuroraGPT-2B x tulu_math_uc_mix SFT run's per-attempt
 * histories (project aurora_gpt/torchtitan.ezpz.sft) were pulled via the W&B
 * API, merged by global_step (newest attempt wins on overlap), and the tokens
 * axis recomputed as a monotonic cumulative curve (global_step x tokens/step).
 *
 * Data snapshot: run "stoic-water-40" chain, steps 10..720 @ gap 10, final
 * loss 0.775 / acc 0.796 / 4.49B cumulative tokens (matches the 4.5B caption).
 * Regenerate: node scripts/gen-sft-curves.mjs
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
    'sft-curves.svg',
)

// Merged from the W&B SFT run histories (see header). Each row:
// [step, loss, grad_norm, lr, mean_token_accuracy, entropy, cum_tokens_B].
// prettier-ignore
const ROWS = [[10,1.151884,0.738132,2e-05,0.728331,1.159362,0.0624],[20,0.995761,0.397224,1.9e-05,0.750526,0.997149,0.1248],[30,0.957157,0.304476,1.9e-05,0.757764,0.963183,0.1872],[40,0.936656,0.241919,1.9e-05,0.761555,0.941943,0.2496],[50,0.921469,0.244555,1.9e-05,0.764591,0.922458,0.312],[60,0.906408,0.23805,1.8e-05,0.767209,0.906735,0.3744],[70,0.898336,0.229548,1.8e-05,0.769046,0.898701,0.4368],[80,0.892881,0.237867,1.8e-05,0.770481,0.89257,0.4992],[90,0.889479,0.263728,1.8e-05,0.771355,0.889947,0.5616],[100,0.878222,0.267867,1.7e-05,0.773428,0.87865,0.624],[110,0.909615,0.532174,1.7e-05,0.765704,0.911215,0.6864],[120,0.881152,0.32327,1.7e-05,0.772545,0.878526,0.7488],[130,0.869089,0.249062,1.6e-05,0.775196,0.868276,0.8112],[140,0.859991,0.219165,1.6e-05,0.777098,0.858884,0.8736],[150,0.860195,0.204533,1.6e-05,0.777424,0.859375,0.936],[160,0.861278,0.244869,1.6e-05,0.777157,0.860798,0.9984],[170,0.855289,0.225541,1.5e-05,0.778392,0.855167,1.0608],[180,0.849464,0.211346,1.5e-05,0.779419,0.848436,1.1232],[190,0.84589,0.24567,1.5e-05,0.780368,0.845333,1.1856],[200,0.846751,0.24083,1.5e-05,0.780295,0.846316,1.248],[210,0.856973,0.404399,1.4e-05,0.777653,0.84684,1.3104],[220,0.842263,0.283679,1.4e-05,0.780695,0.840592,1.3728],[230,0.838019,0.234242,1.4e-05,0.781758,0.837301,1.4352],[240,0.838158,0.230905,1.3e-05,0.781938,0.837111,1.4976],[250,0.822486,0.226105,1.3e-05,0.785246,0.824908,1.56],[260,0.815647,0.22257,1.3e-05,0.786639,0.816462,1.6224],[270,0.814062,0.240808,1.3e-05,0.786838,0.815212,1.6848],[280,0.814646,0.21709,1.2e-05,0.786717,0.815219,1.7472],[290,0.813869,0.240033,1.2e-05,0.787031,0.814861,1.8096],[300,0.811554,0.226548,1.2e-05,0.787612,0.812564,1.872],[310,0.825192,0.416165,1.2e-05,0.78374,0.827984,1.9344],[320,0.80918,0.307938,1.1e-05,0.787508,0.807354,1.9968],[330,0.805403,0.250672,1.1e-05,0.788582,0.805864,2.0592],[340,0.808965,0.22399,1.1e-05,0.788074,0.808971,2.1216],[350,0.809357,0.22228,1e-05,0.787974,0.809697,2.184],[360,0.800736,0.208977,1e-05,0.789542,0.801829,2.2464],[370,0.803979,0.210168,1e-05,0.789109,0.804364,2.3088],[380,0.801117,0.202701,1e-05,0.789499,0.802429,2.3712],[390,0.802472,0.227809,9e-06,0.789357,0.80285,2.4336],[400,0.796517,0.213703,9e-06,0.79048,0.79775,2.496],[410,0.801207,0.39455,9e-06,0.789312,0.801898,2.5584],[420,0.800533,0.275654,9e-06,0.78972,0.801236,2.6208],[430,0.803771,0.221732,8e-06,0.789233,0.804672,2.6832],[440,0.789823,0.235229,8e-06,0.791948,0.79,2.7456],[450,0.794218,0.201466,8e-06,0.791254,0.795651,2.808],[460,0.795945,0.207666,7e-06,0.790851,0.796671,2.8704],[470,0.793158,0.199261,7e-06,0.791502,0.794253,2.9328],[480,0.788524,0.199952,7e-06,0.792442,0.789742,2.9952],[490,0.784824,0.210106,7e-06,0.7933,0.788258,3.0576],[500,0.779467,0.209403,6e-06,0.79429,0.782147,3.12],[510,0.782162,0.348368,6e-06,0.793703,0.785795,3.1824],[520,0.780895,0.272193,6e-06,0.794061,0.782971,3.2448],[530,0.776152,0.219337,5e-06,0.795198,0.778576,3.3072],[540,0.777163,0.238128,5e-06,0.79473,0.780157,3.3696],[550,0.781491,0.206657,5e-06,0.793876,0.78453,3.432],[560,0.77399,0.206352,5e-06,0.795588,0.7768,3.4944],[570,0.770116,0.189848,4e-06,0.79645,0.773532,3.5568],[580,0.775449,0.202529,4e-06,0.79521,0.777485,3.6192],[590,0.771484,0.199286,4e-06,0.79609,0.774046,3.6816],[600,0.769846,0.202148,4e-06,0.796071,0.77258,3.744],[610,0.77369,0.227688,3e-06,0.795409,0.775987,3.8064],[620,0.778844,0.212613,3e-06,0.794595,0.780862,3.8688],[630,0.778169,0.202864,3e-06,0.794802,0.781222,3.9312],[640,0.77742,0.203939,2e-06,0.795026,0.780801,3.9936],[650,0.766741,0.195286,2e-06,0.79691,0.769823,4.056],[660,0.775116,0.194113,2e-06,0.795255,0.777737,4.1184],[670,0.772594,0.209975,2e-06,0.796144,0.775298,4.1808],[680,0.763716,0.18795,1e-06,0.798018,0.766666,4.2432],[690,0.769828,0.192842,1e-06,0.796381,0.772522,4.3056],[700,0.765842,0.191835,1e-06,0.797154,0.768259,4.368],[710,0.771382,0.187216,1e-06,0.796023,0.77437,4.4304],[720,0.77462,0.182372,0.0,0.795586,0.777194,4.4928]]

// column index in each row -> panel
const PANELS = [
    { i: 1, title: 'loss', color: '#118cc2' },
    { i: 2, title: 'grad_norm', color: '#ee8f24' },
    { i: 3, title: 'learning rate (×1e-5)', color: '#9a76ce', scale: 1e5 },
    { i: 4, title: 'mean token accuracy', color: '#1da811' },
    { i: 5, title: 'entropy (nats)', color: '#e05560' },
    { i: 6, title: 'tokens seen (cumulative, B)', color: '#06b6d4' },
]

const W = 1280
const H = 720
const M = { top: 78, right: 26, bottom: 50, left: 26 }
const COLS = 3
const ROWS_N = 2
const GX = 52
const GY = 56
const gridW = W - M.left - M.right
const gridH = H - M.top - M.bottom
const panelW = (gridW - GX * (COLS - 1)) / COLS
const panelH = (gridH - GY * (ROWS_N - 1)) / ROWS_N
const PAD = { top: 24, right: 10, bottom: 30, left: 52 }

const FONT = "'mIosevka-QP Web','Iosevka Web','JetBrains Mono',Menlo,monospace"
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

const steps = ROWS.map((r) => r[0])
const sMin = steps[0]
const sMax = steps[steps.length - 1]

function niceRange(vals) {
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    if (lo === hi) {
        lo -= 1
        hi += 1
    }
    const pad = (hi - lo) * 0.08
    return [lo - pad, hi + pad]
}

function fmtTick(v) {
    const a = Math.abs(v)
    if (a !== 0 && (a < 0.01 || a >= 1000)) return v.toExponential(1)
    return (Math.round(v * 1000) / 1000).toString()
}

function panel(p, px, py) {
    const scale = p.scale || 1
    const vals = ROWS.map((r) => r[p.i] * scale)
    const [yMin, yMax] = niceRange(vals)
    const ax = px + PAD.left
    const ay = py + PAD.top
    const aw = panelW - PAD.left - PAD.right
    const ah = panelH - PAD.top - PAD.bottom
    const sx = (s) => ax + ((s - sMin) / (sMax - sMin || 1)) * aw
    const sy = (v) => ay + ah - ((v - yMin) / (yMax - yMin || 1)) * ah

    let s = ''
    s += `<text x="${px + panelW / 2}" y="${py + 15}" text-anchor="middle" font-family="${FONT}" font-size="17" fill="#838383">${esc(p.title)}</text>`
    s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`
    // y ticks
    for (let k = 0; k <= 4; k++) {
        const v = yMin + ((yMax - yMin) * k) / 4
        const yy = sy(v)
        s += `<line x1="${ax}" y1="${yy}" x2="${ax + aw}" y2="${yy}" stroke="#83838322" stroke-width="1"/>`
        s += `<text x="${ax - 6}" y="${yy + 4}" text-anchor="end" font-family="${FONT}" font-size="11" fill="#838383">${fmtTick(v)}</text>`
    }
    // x ticks (0..sMax steps, 4 divisions)
    for (let k = 0; k <= 4; k++) {
        const st = sMin + ((sMax - sMin) * k) / 4
        const xx = sx(st)
        s += `<line x1="${xx}" y1="${ay + ah}" x2="${xx}" y2="${ay + ah + 4}" stroke="#83838388" stroke-width="1"/>`
        s += `<text x="${xx}" y="${ay + ah + 17}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#838383">${Math.round(st)}</text>`
    }
    s += `<text x="${ax + aw / 2}" y="${py + panelH - 1}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#838383">global step</text>`

    // line + dots
    const pts = ROWS.map((r) => [sx(r[0]), sy(r[p.i] * scale)])
    const d = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(' ')
    s += `<path d="${d}" fill="none" stroke="${p.color}" stroke-width="2"/>`
    for (const pt of pts)
        s += `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2" fill="${p.color}"/>`
    return s
}

let body = ''
body += `<text x="${W / 2}" y="34" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="700" fill="#838383">AuroraGPT-2B × tulu_math_uc_mix SFT trajectory</text>`
body += `<text x="${W / 2}" y="56" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#838383">step ${sMax}, 3 epochs, 32N, GBS=6144 · final loss ${ROWS[ROWS.length - 1][1].toFixed(2)} · ${ROWS[ROWS.length - 1][6].toFixed(2)}B tokens (cumulative)</text>`

PANELS.forEach((p, idx) => {
    const c = idx % COLS
    const r = Math.floor(idx / COLS)
    const px = M.left + c * (panelW + GX)
    const py = M.top + r * (panelH + GY)
    body += panel(p, px, py)
})

const svg = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
${body}
</svg>
`
writeFileSync(OUT, svg)
console.log('wrote', OUT)
