#!/usr/bin/env node
/*
 * Generate the 2B CPT (continued-pretraining) loss chart for the 2026-07-14 talk.
 *
 * Why this exists: the torchtitan docs ship `docs/production/cpt/figures/
 * cpt_loss.svg`, a matplotlib render that (a) bakes in DejaVu Sans (Iosevka
 * wasn't in the cluster fontlist, so ambivalent silently fell back) and
 * (b) colors dolmino-100 `#264653`, a near-black that vanishes on the deck's
 * dark theme. We re-render the SAME data with the deck's theme-invariant
 * ambivalent palette (transparent bg, #838383 chrome) and Iosevka stack.
 *
 * Data: the exact per-step loss curves committed alongside the docs plot,
 *   docs/production/cpt/figures/cpt-dolmino100.tsv          (step<TAB>loss)
 *   docs/production/cpt/figures/cpt-olmo50-dolmino50.tsv
 * (branch ezpz), each 5,960 steps, downsampled here (8-step stride over the
 * steep first ~400, 25-step after). olmo-100 base plateau (~2.80) is the
 * control reference band, per plot_cpt_loss.py.
 *
 * No matplotlib / numpy dependency: emits SVG directly so it runs anywhere.
 * Regenerate with:  node scripts/gen-cpt-loss.mjs
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
const OUT = join(FIG_DIR, 'cpt-loss.svg')
const OUT_MOBILE = join(FIG_DIR, 'cpt-loss-mobile.svg')

// ── data (downsampled from the committed per-step TSVs) ─────────────
// prettier-ignore
const DOLMINO100 = [[1,7.2679],[8,6.7328],[16,6.1316],[24,5.7952],[32,5.4787],[40,5.0976],[48,4.8222],[56,4.4504],[64,4.0968],[72,3.7937],[80,3.5631],[88,3.3939],[96,3.2592],[104,3.1609],[112,3.0827],[120,3.0236],[128,2.9626],[136,2.9195],[144,2.877],[152,2.8458],[160,2.8226],[168,2.7954],[176,2.7763],[184,2.7622],[192,2.7478],[200,2.7348],[208,2.7236],[216,2.711],[224,2.699],[232,2.6982],[240,2.6774],[248,2.6799],[256,2.674],[264,2.6587],[272,2.6614],[280,2.6496],[288,2.6514],[296,2.6405],[304,2.6428],[312,2.643],[320,2.6397],[328,2.6312],[336,2.6286],[344,2.6257],[352,2.6249],[360,2.619],[368,2.623],[376,2.6125],[384,2.6175],[392,2.6098],[400,2.6198],[425,2.6113],[450,2.6039],[475,2.5978],[500,2.6001],[525,2.5988],[550,2.5988],[575,2.5942],[600,2.5915],[625,2.5886],[650,2.5888],[675,2.5814],[700,2.5826],[725,2.5808],[750,2.5797],[775,2.5753],[800,2.5754],[825,2.5756],[850,2.5731],[875,2.5731],[900,2.5725],[925,2.5677],[950,2.5656],[975,2.5684],[1000,2.5679],[1025,2.5662],[1050,2.5626],[1075,2.5666],[1100,2.5605],[1125,2.5652],[1150,2.5617],[1175,2.5595],[1200,2.5633],[1225,2.5598],[1250,2.562],[1275,2.5555],[1300,2.565],[1325,2.5606],[1350,2.5562],[1375,2.554],[1400,2.5543],[1425,2.5544],[1450,2.5538],[1475,2.5485],[1500,2.5544],[1525,2.5514],[1550,2.5452],[1575,2.5504],[1600,2.5486],[1625,2.544],[1650,2.5452],[1675,2.5463],[1700,2.5429],[1725,2.5484],[1750,2.5457],[1775,2.547],[1800,2.543],[1825,2.539],[1850,2.5428],[1875,2.5382],[1900,2.5376],[1925,2.5412],[1950,2.5397],[1975,2.54],[2000,2.5401],[2025,2.54],[2050,2.533],[2075,2.5369],[2100,2.5324],[2125,2.5369],[2150,2.5321],[2175,2.5388],[2200,2.529],[2225,2.5283],[2250,2.5298],[2275,2.5318],[2300,2.533],[2325,2.5305],[2350,2.5301],[2375,2.5278],[2400,2.5349],[2425,2.5299],[2450,2.5302],[2475,2.5322],[2500,2.5281],[2525,2.5271],[2550,2.5288],[2575,2.5275],[2600,2.5289],[2625,2.522],[2650,2.5242],[2675,2.5249],[2700,2.5228],[2725,2.5236],[2750,2.527],[2775,2.5196],[2800,2.5221],[2825,2.5232],[2850,2.5189],[2875,2.5172],[2900,2.5244],[2925,2.5201],[2950,2.5227],[2975,2.5196],[3000,2.5215],[3025,2.5153],[3050,2.5156],[3075,2.5137],[3100,2.5175],[3125,2.516],[3150,2.5139],[3175,2.511],[3200,2.5117],[3225,2.5112],[3250,2.516],[3275,2.5114],[3300,2.5172],[3325,2.5174],[3350,2.5113],[3375,2.5164],[3400,2.5125],[3425,2.5158],[3450,2.5113],[3475,2.5111],[3500,2.5101],[3525,2.5073],[3550,2.5081],[3575,2.5097],[3600,2.5094],[3625,2.5092],[3650,2.51],[3675,2.5097],[3700,2.5088],[3725,2.5078],[3750,2.5036],[3775,2.5105],[3800,2.5077],[3825,2.5055],[3850,2.5065],[3875,2.5006],[3900,2.5044],[3925,2.5085],[3950,2.5054],[3975,2.5032],[4000,2.5013],[4025,2.5056],[4050,2.5099],[4075,2.5071],[4100,2.5067],[4125,2.5006],[4150,2.5028],[4175,2.5062],[4200,2.4979],[4225,2.5033],[4250,2.5016],[4275,2.4981],[4300,2.5024],[4325,2.5002],[4350,2.5015],[4375,2.4987],[4400,2.4997],[4425,2.4994],[4450,2.4926],[4475,2.5005],[4500,2.4941],[4525,2.5008],[4550,2.4936],[4575,2.5008],[4600,2.4931],[4625,2.4951],[4650,2.491],[4675,2.4962],[4700,2.5015],[4725,2.4999],[4750,2.4926],[4775,2.495],[4800,2.4972],[4825,2.495],[4850,2.4963],[4875,2.4967],[4900,2.4961],[4925,2.4948],[4950,2.49],[4975,2.4927],[5000,2.4922],[5025,2.4873],[5050,2.497],[5075,2.4929],[5100,2.4955],[5125,2.4917],[5150,2.4888],[5175,2.4958],[5200,2.4906],[5225,2.4886],[5250,2.4961],[5275,2.4907],[5300,2.4862],[5325,2.4914],[5350,2.4942],[5375,2.4918],[5400,2.4879],[5425,2.4853],[5450,2.4872],[5475,2.4833],[5500,2.4889],[5525,2.4842],[5550,2.4899],[5575,2.4852],[5600,2.491],[5625,2.489],[5650,2.4843],[5675,2.4826],[5700,2.4862],[5725,2.4866],[5750,2.4889],[5775,2.4882],[5800,2.4839],[5825,2.4863],[5850,2.4885],[5875,2.4818],[5900,2.485],[5925,2.4842],[5950,2.4838],[5960,2.4799]]
// prettier-ignore
const OLMO50 = [[1,7.2376],[8,6.7172],[16,6.12],[24,5.7977],[32,5.5199],[40,5.1512],[48,4.871],[56,4.5174],[64,4.1712],[72,3.8655],[80,3.6393],[88,3.4633],[96,3.3212],[104,3.223],[112,3.1385],[120,3.0698],[128,3.0199],[136,2.9697],[144,2.9376],[152,2.9071],[160,2.8766],[168,2.856],[176,2.8339],[184,2.8207],[192,2.8104],[200,2.795],[208,2.785],[216,2.7729],[224,2.7687],[232,2.7546],[240,2.7451],[248,2.7405],[256,2.7362],[264,2.7364],[272,2.7291],[280,2.7229],[288,2.712],[296,2.7123],[304,2.7175],[312,2.7071],[320,2.7024],[328,2.7042],[336,2.7017],[344,2.6956],[352,2.695],[360,2.695],[368,2.6953],[376,2.6879],[384,2.686],[392,2.6862],[400,2.6873],[425,2.6841],[450,2.6795],[475,2.6737],[500,2.6697],[525,2.6747],[550,2.666],[575,2.6703],[600,2.6672],[625,2.6665],[650,2.6612],[675,2.6605],[700,2.6606],[725,2.6599],[750,2.6632],[775,2.6556],[800,2.6537],[825,2.655],[850,2.6535],[875,2.6528],[900,2.6569],[925,2.655],[950,2.6483],[975,2.6505],[1000,2.6534],[1025,2.6512],[1050,2.6513],[1075,2.6514],[1100,2.6479],[1125,2.6515],[1150,2.6477],[1175,2.6435],[1200,2.6487],[1225,2.6453],[1250,2.6505],[1275,2.644],[1300,2.6494],[1325,2.6502],[1350,2.6369],[1375,2.6455],[1400,2.6429],[1425,2.6447],[1450,2.6399],[1475,2.6447],[1500,2.6432],[1525,2.6393],[1550,2.6387],[1575,2.6384],[1600,2.6398],[1625,2.6366],[1650,2.6357],[1675,2.6423],[1700,2.6338],[1725,2.6352],[1750,2.6394],[1775,2.628],[1800,2.6347],[1825,2.6276],[1850,2.634],[1875,2.6348],[1900,2.634],[1925,2.6321],[1950,2.6321],[1975,2.6337],[2000,2.6321],[2025,2.6271],[2050,2.6304],[2075,2.6369],[2100,2.6279],[2125,2.6307],[2150,2.6324],[2175,2.6281],[2200,2.6322],[2225,2.6255],[2250,2.6239],[2275,2.6243],[2300,2.6302],[2325,2.6271],[2350,2.6295],[2375,2.6258],[2400,2.6252],[2425,2.6219],[2450,2.6274],[2475,2.623],[2500,2.622],[2525,2.6208],[2550,2.6266],[2575,2.6215],[2600,2.6179],[2625,2.623],[2650,2.622],[2675,2.624],[2700,2.6184],[2725,2.6215],[2750,2.6233],[2775,2.6194],[2800,2.6181],[2825,2.6207],[2850,2.6202],[2875,2.6189],[2900,2.6212],[2925,2.623],[2950,2.6203],[2975,2.6207],[3000,2.6223],[3025,2.6169],[3050,2.6121],[3075,2.6139],[3100,2.6146],[3125,2.6159],[3150,2.6164],[3175,2.6188],[3200,2.6119],[3225,2.6163],[3250,2.6141],[3275,2.6137],[3300,2.6133],[3325,2.6164],[3350,2.6133],[3375,2.6129],[3400,2.6105],[3425,2.6121],[3450,2.6122],[3475,2.6113],[3500,2.6153],[3525,2.6119],[3550,2.6115],[3575,2.6071],[3600,2.6144],[3625,2.6075],[3650,2.6124],[3675,2.6112],[3700,2.6102],[3725,2.6125],[3750,2.6026],[3775,2.6097],[3800,2.6063],[3825,2.6103],[3850,2.6112],[3875,2.6047],[3900,2.609],[3925,2.6082],[3950,2.606],[3975,2.6105],[4000,2.6061],[4025,2.6024],[4050,2.6065],[4075,2.6008],[4100,2.6048],[4125,2.6027],[4150,2.6094],[4175,2.6116],[4200,2.6046],[4225,2.5999],[4250,2.6025],[4275,2.6021],[4300,2.5995],[4325,2.6047],[4350,2.6],[4375,2.6004],[4400,2.602],[4425,2.6023],[4450,2.6028],[4475,2.5994],[4500,2.6012],[4525,2.6013],[4550,2.6003],[4575,2.6002],[4600,2.5964],[4625,2.5971],[4650,2.5993],[4675,2.6003],[4700,2.5969],[4725,2.5981],[4750,2.6016],[4775,2.602],[4800,2.5977],[4825,2.5986],[4850,2.5973],[4875,2.5912],[4900,2.5997],[4925,2.5933],[4950,2.5992],[4975,2.5941],[5000,2.597],[5025,2.5966],[5050,2.5969],[5075,2.597],[5100,2.5949],[5125,2.5948],[5150,2.602],[5175,2.5923],[5200,2.592],[5225,2.5961],[5250,2.594],[5275,2.592],[5300,2.5907],[5325,2.5944],[5350,2.593],[5375,2.5932],[5400,2.5919],[5425,2.5917],[5450,2.5922],[5475,2.5886],[5500,2.5871],[5525,2.5939],[5550,2.5863],[5575,2.5932],[5600,2.591],[5625,2.5909],[5650,2.5873],[5675,2.5889],[5700,2.5899],[5725,2.5889],[5750,2.5933],[5775,2.5869],[5800,2.5848],[5825,2.587],[5850,2.5868],[5875,2.5857],[5900,2.5906],[5925,2.5901],[5950,2.5832],[5960,2.5901]]

// (label, data, final val loss, color) — theme-invariant palette; the docs'
// dolmino `#264653` is dropped (invisible on dark).
const RUNS = [
    { label: 'dolmino-100', data: DOLMINO100, val: 2.492, color: '#118cc2' },
    { label: 'olmo50-dolmino50', data: OLMO50, val: 2.601, color: '#ee8f24' },
]
const OLMO100_PLATEAU = 2.8 // control: 2B 256N base saturated here on its own mix

const X_MAX = 5960 // CPT steps
const Y_MIN = 2.2
const Y_MAX = 8.0
const FONT = FONT_STACK

const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Landscape: 16:9 with a right-gutter legend. Mobile: taller aspect, legend
// below the plot (no right gutter), larger fonts so it stays legible in a
// phone column (< 768px).
const LANDSCAPE = {
    W: 1280,
    H: 720,
    AX: { top: 96, right: 240, bottom: 92, left: 92 },
    legend: 'right',
    titleSize: 32,
    subSize: 19,
    tickSize: 19,
    axisSize: 20,
    plateauSize: 18,
    insetTitleSize: 16,
    insetTickSize: 16,
    insetLabelSize: 16,
    legendSize: 19,
    legendSubSize: 18,
    inset: { xFrac: 0.3, wFrac: 0.6, top: 30, h: 250 },
}
const MOBILE = {
    W: 720,
    H: 760,
    AX: { top: 104, right: 34, bottom: 190, left: 78 },
    legend: 'below',
    titleSize: 30,
    subSize: 18,
    tickSize: 20,
    axisSize: 22,
    plateauSize: 19,
    insetTitleSize: 19,
    insetTickSize: 18,
    insetLabelSize: 19,
    legendSize: 22,
    legendSubSize: 20,
    inset: { xFrac: 0.34, wFrac: 0.62, top: 20, h: 210 },
}

function buildSVG(cfg) {
    const { W, H, AX } = cfg
    const ax = AX.left
    const ay = AX.top
    const aw = W - AX.left - AX.right
    const ah = H - AX.top - AX.bottom
    const sx = (t) => ax + (Math.min(t, X_MAX) / X_MAX) * aw
    const sy = (v) => ay + ah - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * ah
    const clipId = `cptTailClip-${W}`

    let body = ''

    // title + subtitle
    body += `<text x="${W / 2}" y="38" text-anchor="middle" font-family="${FONT}" font-size="${cfg.titleSize}" font-weight="700" fill="#838383">2B continued-pretraining: olmo x dolmino sweep</text>`
    body += `<text x="${W / 2}" y="62" text-anchor="middle" font-family="${FONT}" font-size="${cfg.subSize}" fill="#838383">training loss vs CPT step (fork from 2B base step-92,859; 256N, GBS=6144, ~300B tok each)</text>`

    // axes box
    body += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="none" stroke="#83838355" stroke-width="1"/>`

    // y gridlines + labels (2.2 .. 8.0 by 0.8)
    for (let k = 0; k <= 8; k++) {
        const v = Y_MIN + ((Y_MAX - Y_MIN) * k) / 8
        const yy = sy(v)
        body += `<line x1="${ax}" y1="${yy}" x2="${ax + aw}" y2="${yy}" stroke="#83838322" stroke-width="1"/>`
        body += `<text x="${ax - 10}" y="${yy + 5}" text-anchor="end" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${v.toFixed(1)}</text>`
    }
    // x ticks (0 .. ~6k steps)
    for (let k = 0; k <= 6; k++) {
        const t = (6000 * k) / 6
        const xx = sx(t)
        body += `<line x1="${xx}" y1="${ay + ah}" x2="${xx}" y2="${ay + ah + 5}" stroke="#83838388" stroke-width="1"/>`
        body += `<text x="${xx}" y="${ay + ah + 24}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.tickSize}" fill="#838383">${k === 0 ? '0' : (t / 1000).toFixed(0) + 'k'}</text>`
    }
    // axis titles
    body += `<text x="${ax + aw / 2}" y="${ay + ah + 58}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383">CPT step</text>`
    body += `<text x="${ax - 58}" y="${ay + ah / 2}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.axisSize}" fill="#838383" transform="rotate(-90 ${ax - 58} ${ay + ah / 2})">training loss</text>`

    // olmo-100 plateau reference (the level CPT has to beat, on loss)
    const yp = sy(OLMO100_PLATEAU)
    body += `<line x1="${ax}" y1="${yp}" x2="${ax + aw}" y2="${yp}" stroke="#838383" stroke-width="1.4" stroke-dasharray="6 4"/>`
    body += `<text x="${ax + aw - 8}" y="${yp - 8}" text-anchor="end" font-family="${FONT}" font-size="${cfg.plateauSize}" fill="#838383">olmo-100 base plateau (~2.80)</text>`

    // series
    for (const run of RUNS) {
        const d = run.data
            .map(
                (p, i) =>
                    `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)} ${sy(p[1]).toFixed(1)}`,
            )
            .join(' ')
        body += `<path d="${d}" fill="none" stroke="${run.color}" stroke-width="2.2"/>`
    }

    // ── inset: tail zoom (the two mixes separating near the plateau) ──
    {
        const zX0 = 200
        const zX1 = X_MAX
        const zY0 = 2.45
        const zY1 = 2.85
        const ix = ax + aw * cfg.inset.xFrac
        const iy = ay + cfg.inset.top
        const iw = aw * cfg.inset.wFrac
        const ih = cfg.inset.h
        const isx = (t) => ix + ((t - zX0) / (zX1 - zX0)) * iw
        const isy = (v) => iy + ih - ((v - zY0) / (zY1 - zY0)) * ih
        const srcX = sx(zX0)
        const srcYt = sy(zY1)
        const srcW = sx(zX1) - sx(zX0)
        const srcH = sy(zY0) - sy(zY1)
        body += `<rect x="${srcX.toFixed(1)}" y="${srcYt.toFixed(1)}" width="${srcW.toFixed(1)}" height="${srcH.toFixed(1)}" fill="none" stroke="#838383" stroke-width="1" stroke-dasharray="4 3"/>`
        body += `<line x1="${srcX.toFixed(1)}" y1="${srcYt.toFixed(1)}" x2="${ix.toFixed(1)}" y2="${(iy + ih).toFixed(1)}" stroke="#83838355" stroke-width="1" stroke-dasharray="3 3"/>`
        body += `<line x1="${(srcX + srcW).toFixed(1)}" y1="${srcYt.toFixed(1)}" x2="${(ix + iw).toFixed(1)}" y2="${(iy + ih).toFixed(1)}" stroke="#83838355" stroke-width="1" stroke-dasharray="3 3"/>`
        body += `<clipPath id="${clipId}"><rect x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}"/></clipPath>`
        body += `<rect x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" width="${iw.toFixed(1)}" height="${ih.toFixed(1)}" fill="#8888880f" stroke="#838383" stroke-width="1.2"/>`
        for (let v = 2.5; v <= 2.8 + 0.001; v += 0.1) {
            const yy = isy(v)
            body += `<line x1="${ix}" y1="${yy}" x2="${ix + iw}" y2="${yy}" stroke="#83838322" stroke-width="1"/>`
            body += `<text x="${ix - 7}" y="${yy + 4}" text-anchor="end" font-family="${FONT}" font-size="${cfg.insetTickSize}" fill="#838383">${v.toFixed(1)}</text>`
        }
        for (let t = 1000; t <= 5000; t += 2000) {
            const xx = isx(t)
            body += `<text x="${xx}" y="${iy + ih + 16}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.insetTickSize}" fill="#838383">${(t / 1000).toFixed(0)}k</text>`
        }
        if (OLMO100_PLATEAU >= zY0 && OLMO100_PLATEAU <= zY1) {
            const yp2 = isy(OLMO100_PLATEAU)
            body += `<line x1="${ix}" y1="${yp2}" x2="${ix + iw}" y2="${yp2}" stroke="#838383" stroke-width="1.2" stroke-dasharray="6 4"/>`
        }
        body += `<g clip-path="url(#${clipId})">`
        for (const run of RUNS) {
            const pts = run.data.filter((p) => p[0] >= zX0)
            const d = pts
                .map(
                    (p, i) =>
                        `${i ? 'L' : 'M'}${isx(p[0]).toFixed(1)} ${isy(p[1]).toFixed(1)}`,
                )
                .join(' ')
            body += `<path d="${d}" fill="none" stroke="${run.color}" stroke-width="2.2"/>`
        }
        body += `</g>`
        for (const run of RUNS) {
            const last = run.data[run.data.length - 1]
            const ly2 = isy(Math.min(Math.max(last[1], zY0), zY1))
            body += `<text x="${(ix + iw - 8).toFixed(1)}" y="${(ly2 - 6).toFixed(1)}" text-anchor="end" font-family="${FONT}" font-size="${cfg.insetLabelSize}" font-weight="700" fill="${run.color}">${esc(run.label)} ${run.val.toFixed(3)}</text>`
        }
        body += `<text x="${ix + iw / 2}" y="${iy - 6}" text-anchor="middle" font-family="${FONT}" font-size="${cfg.insetTitleSize}" fill="#838383">tail zoom</text>`
    }

    // legend: right gutter (landscape) or a row below the plot (mobile)
    if (cfg.legend === 'right') {
        const lx = ax + aw + 24
        let ly = ay + 18
        body += `<text x="${lx}" y="${ly - 22}" font-family="${FONT}" font-size="${cfg.legendSize}" font-weight="700" fill="#838383">final val loss</text>`
        for (const run of RUNS) {
            body += `<line x1="${lx}" y1="${ly - 4}" x2="${lx + 26}" y2="${ly - 4}" stroke="${run.color}" stroke-width="2.8"/>`
            body += `<text x="${lx + 34}" y="${ly}" font-family="${FONT}" font-size="${cfg.legendSize}" fill="#838383">${esc(run.label)}</text>`
            body += `<text x="${lx + 34}" y="${ly + 18}" font-family="${FONT}" font-size="${cfg.legendSubSize}" fill="${run.color}">val ${run.val.toFixed(3)}</text>`
            ly += 52
        }
        body += `<line x1="${lx}" y1="${ly - 4}" x2="${lx + 26}" y2="${ly - 4}" stroke="#838383" stroke-width="1.6" stroke-dasharray="6 4"/>`
        body += `<text x="${lx + 34}" y="${ly}" font-family="${FONT}" font-size="${cfg.legendSize}" fill="#838383">olmo-100 base</text>`
        body += `<text x="${lx + 34}" y="${ly + 18}" font-family="${FONT}" font-size="${cfg.legendSubSize}" fill="#838383">~2.80 (control)</text>`
    } else {
        // stacked rows centered below the x-axis title
        let ly = ay + ah + 90
        const lx = ax
        for (const run of RUNS) {
            body += `<line x1="${lx}" y1="${ly - 5}" x2="${lx + 30}" y2="${ly - 5}" stroke="${run.color}" stroke-width="3"/>`
            body += `<text x="${lx + 40}" y="${ly}" font-family="${FONT}" font-size="${cfg.legendSize}" fill="#838383">${esc(run.label)} — val <tspan fill="${run.color}" font-weight="700">${run.val.toFixed(3)}</tspan></text>`
            ly += 32
        }
        body += `<line x1="${lx}" y1="${ly - 5}" x2="${lx + 30}" y2="${ly - 5}" stroke="#838383" stroke-width="1.8" stroke-dasharray="6 4"/>`
        body += `<text x="${lx + 40}" y="${ly}" font-family="${FONT}" font-size="${cfg.legendSize}" fill="#838383">olmo-100 base — ~2.80 (control)</text>`
    }

    return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">
${fontDefs()}
${body}
</svg>
`
}

writeFileSync(OUT, buildSVG(LANDSCAPE))
console.log('wrote', OUT, `(${DOLMINO100.length}+${OLMO50.length} pts)`)
writeFileSync(OUT_MOBILE, buildSVG(MOBILE))
console.log('wrote', OUT_MOBILE)
