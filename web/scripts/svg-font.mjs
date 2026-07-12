/*
 * Shared SVG font-embedding helper for the talk's generated charts.
 *
 * Why: our chart SVGs are embedded via <img src="...svg">. An img-loaded SVG
 * renders in an isolated document that CANNOT see the host page's @font-face
 * web fonts, so a `font-family: 'mIosevka-QP Web'` reference silently falls
 * back to the system monospace (Menlo on macOS). The only way an <img> SVG
 * gets a custom font is to embed that font INSIDE the SVG.
 *
 * We embed a subset of Iosevka QP (regular + bold) as base64 @font-face rules
 * in an SVG <defs><style>. The subset (scripts/assets/miosevka-qp-subset-*.woff2)
 * is ~13KB each, covering printable ASCII + the few symbols the charts use.
 *
 * To regenerate the subset after adding new glyphs to a chart (needs
 * fonttools' pyftsubset on PATH):
 *   UNI="U+0020-007E,U+00B7,U+00D7,U+2260,U+2192,U+2014,U+2713,U+00B1,U+00B0,U+21C6"
 *   for w in Regular Bold; do
 *     pyftsubset public/fonts/miosevka-qp/MIosevkaQp-$w.woff2 \
 *       --unicodes="$UNI" --flavor=woff2 --no-hinting --desubroutinize \
 *       --output-file=scripts/assets/miosevka-qp-subset-${w,,}.woff2
 *   done
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// The family name the charts reference (matches global.css miosevka-qp.css).
export const FONT_FAMILY = 'mIosevka-QP Web'
// Full stack used on <text> elements; the embedded family resolves first.
export const FONT_STACK = `'${FONT_FAMILY}','Iosevka Web','JetBrains Mono',Menlo,monospace`

function b64(rel) {
    return readFileSync(join(__dirname, 'assets', rel)).toString('base64')
}

/**
 * Returns an SVG <defs> string embedding the Iosevka QP subset at weights
 * 400 and 700. Place it as the first child of the <svg> element.
 */
export function fontDefs() {
    const reg = b64('miosevka-qp-subset-regular.woff2')
    const bold = b64('miosevka-qp-subset-bold.woff2')
    return `<defs><style>
@font-face{font-family:'${FONT_FAMILY}';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${reg}) format('woff2');}
@font-face{font-family:'${FONT_FAMILY}';font-style:normal;font-weight:700;src:url(data:font/woff2;base64,${bold}) format('woff2');}
</style></defs>`
}
