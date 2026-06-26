// Generate the Neovim Shiki themes by cloning the default Shiki themes
// (min-light / one-dark-pro), which already have complete TextMate scope
// coverage, and swapping ONLY the palette to the user's nvim colors
// (onelight for light, cyberdream for dark — incl. their auto_dark_mode.lua
// overrides).
//
// Two mapping strategies are emitted per theme so they can be compared:
//   - role : map each default color to the nvim color for the SAME semantic
//            role (keyword→nvim keyword, string→nvim string, …). Truest to how
//            the user's actual nvim looks.
//   - hue  : keep the default theme's role→color structure, shift each default
//            color to its nearest nvim hue.
//
// Run:  node web/scripts/gen-nvim-themes.mjs
// (from repo root; paths below are relative to this file.)

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const themesDir = resolve(__dirname, '../src/shiki-themes')
const shikiThemes = resolve(
    __dirname,
    '../../node_modules/.bun/@shikijs+themes@3.23.0/node_modules/@shikijs/themes/dist',
)

const minLight = (await import(resolve(shikiThemes, 'min-light.mjs'))).default
const oneDarkPro = (await import(resolve(shikiThemes, 'one-dark-pro.mjs')))
    .default

// ── nvim palettes ────────────────────────────────────────────────────────
// onelight (nvim-light), base + auto_dark_mode.lua overrides
const LIGHT = {
    bg: '#ffffff',
    fg: '#6a6a6a',
    comment: '#9b9fa6',
    red: '#e05661',
    orange: '#ee9025',
    string: '#fd971f', // override (was orange base)
    green: '#1da912',
    cyan: '#56b6c2',
    blue: '#118dc3',
    purple: '#9a77cf',
    pink: '#ec407a', // function.call override
    member: '#ea76cb',
    constant: '#f92672',
    module: '#01a9f4',
    gray: '#bebebe',
}

// cyberdream (nvim-dark), base + auto_dark_mode.lua overrides
const DARK = {
    bg: '#1c1c1c', // override
    fg: '#ffffff',
    grey: '#7b8496',
    punct: '#c8ccd4',
    string: '#99ffa2', // override
    keyword: '#ffbd5e', // cyberdream Keyword = orange
    number: '#ffbd5e',
    import: '#00ccff', // override
    conditional: '#d69aff', // override
    func: '#5ea1ff',
    cyan: '#5ef1ff',
    pink: '#ff5ea0',
    purple: '#bd5eff',
    magenta: '#ff5ef1',
    red: '#ff6e5e',
}

// ── Strategy A: by semantic role ──────────────────────────────────────────
// Keyed by the default theme's actual token colors (extracted from the .mjs).
// Each default color maps to the nvim color for that role.

// min-light: #212121/#24292eff fg/punct · #D32F2F keyword/storage ·
// #1976D2 number/constant · #6f42c1 function/type · #22863a tag/string(green) ·
// #2b5581 string · #FF9800 param · #c2c3c5 comment
const LIGHT_ROLE = {
    '#212121': LIGHT.fg,
    '#24292eff': LIGHT.fg,
    '#24292e': LIGHT.fg,
    '#d32f2f': LIGHT.purple, // keyword → onelight keyword (purple)
    '#1976d2': LIGHT.cyan, // number/constant → onelight constant-ish (cyan)
    '#6f42c1': LIGHT.pink, // function/type → onelight function (pink)
    '#22863a': LIGHT.string, // tag/string → onelight string (orange)
    '#2b5581': LIGHT.string, // string → onelight string (orange)
    '#ff9800': LIGHT.orange, // param → orange
    '#c2c3c5': LIGHT.comment,
}

// one-dark-pro: #abb2bf fg/punct · #e06c75 var/tag(red) · #c678dd keyword ·
// #d19a66 number/const(orange) · #e5c07b type/class(yellow) · #61afef func ·
// #98c379 string(green) · #56b6c2 operator(cyan) · #5c6370/#7f848e comment
const DARK_ROLE = {
    '#abb2bf': DARK.punct,
    '#e06c75': DARK.red, // variable/tag → cyberdream red
    '#c678dd': DARK.keyword, // keyword → cyberdream keyword (orange)
    '#d19a66': DARK.number, // number/constant → orange
    '#e5c07b': DARK.purple, // type/class → cyberdream type (purple)
    '#61afef': DARK.func, // function → blue
    '#98c379': DARK.string, // string → green
    '#56b6c2': DARK.cyan, // operator → cyan
    '#5c6370': DARK.grey,
    '#7f848e': DARK.grey,
}

// ── Strategy B: by nearest hue ────────────────────────────────────────────
// Keep the default theme's role→color structure; shift each default color to
// the closest nvim hue (so e.g. one-dark-pro keywords stay purple).
const LIGHT_HUE = {
    '#212121': LIGHT.fg,
    '#24292eff': LIGHT.fg,
    '#24292e': LIGHT.fg,
    '#d32f2f': LIGHT.red, // red → red
    '#1976d2': LIGHT.blue, // blue → blue
    '#6f42c1': LIGHT.purple, // purple → purple
    '#22863a': LIGHT.green, // green → green
    '#2b5581': LIGHT.blue, // dark blue → blue
    '#ff9800': LIGHT.orange, // orange → orange
    '#c2c3c5': LIGHT.comment,
}

const DARK_HUE = {
    '#abb2bf': DARK.punct,
    '#e06c75': DARK.red, // red → red
    '#c678dd': DARK.purple, // purple → purple
    '#d19a66': DARK.number, // orange → orange
    '#e5c07b': DARK.keyword, // yellow → cyberdream yellow-ish (orange)
    '#61afef': DARK.func, // blue → blue
    '#98c379': DARK.string, // green → green
    '#56b6c2': DARK.cyan, // cyan → cyan
    '#5c6370': DARK.grey,
    '#7f848e': DARK.grey,
}

// ── core remap ────────────────────────────────────────────────────────────
const norm = (c) => (c || '').toLowerCase()

function remapColor(color, map) {
    if (!color) return color
    const hit = map[norm(color)]
    return hit ?? color // leave unmapped colors as-is (preserves coverage)
}

function buildTheme(base, { name, displayName, type, palette, map }) {
    const clone = JSON.parse(JSON.stringify(base))
    clone.name = name
    clone.displayName = displayName
    clone.type = type

    // Editor chrome colors → nvim bg/fg. Only touch the handful that matter for
    // a rendered code block; leave the rest (they're never used by Shiki HTML).
    if (clone.colors) {
        clone.colors['editor.background'] = palette.bg
        clone.colors['editor.foreground'] = palette.fg
    }
    // Top-level fg/bg some themes carry:
    if (clone.fg) clone.fg = palette.fg
    if (clone.bg) clone.bg = palette.bg

    for (const tc of clone.tokenColors || []) {
        if (!tc.settings) continue
        if (tc.settings.foreground)
            tc.settings.foreground = remapColor(tc.settings.foreground, map)
        if (tc.settings.background)
            tc.settings.background = remapColor(tc.settings.background, map)
    }
    return clone
}

// Ship all four variants (role + hue, light + dark) as selectable themes so
// they can be compared side by side in the picker.
const candidates = [
    {
        file: 'nvim-light-role.json',
        base: minLight,
        name: 'nvim-light-role',
        displayName: 'Neovim Light (role)',
        type: 'light',
        palette: LIGHT,
        map: LIGHT_ROLE,
    },
    {
        file: 'nvim-light-hue.json',
        base: minLight,
        name: 'nvim-light-hue',
        displayName: 'Neovim Light (hue)',
        type: 'light',
        palette: LIGHT,
        map: LIGHT_HUE,
    },
    {
        file: 'nvim-dark-role.json',
        base: oneDarkPro,
        name: 'nvim-dark-role',
        displayName: 'Neovim Dark (role)',
        type: 'dark',
        palette: DARK,
        map: DARK_ROLE,
    },
    {
        file: 'nvim-dark-hue.json',
        base: oneDarkPro,
        name: 'nvim-dark-hue',
        displayName: 'Neovim Dark (hue)',
        type: 'dark',
        palette: DARK,
        map: DARK_HUE,
    },
]

for (const c of candidates) {
    const theme = buildTheme(c.base, c)
    const out = resolve(themesDir, c.file)
    writeFileSync(out, JSON.stringify(theme, null, 2) + '\n')
    console.log('wrote', c.file)
}
