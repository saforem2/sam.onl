/**
 * Offline OG image generator.
 * Reads all .md/.mdx pages, extracts frontmatter, and generates
 * 1200x630 PNG images using satori + resvg.
 *
 * Usage: bun run scripts/generate-og-images.ts
 *
 * Incremental: skips pages whose PNG is newer than the source file.
 */

import { readdir, stat, mkdir } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const PAGES_DIR = join(import.meta.dir, '..', 'web', 'src', 'pages')
const OUT_DIR = join(import.meta.dir, '..', 'web', 'public', 'og')
const FONT_REGULAR = join(import.meta.dir, 'fonts', 'Iosevka-Regular.ttf')
// Bold is decompressed from web/public/fonts/iosevka/Iosevka-Bold.woff2 via
// `woff2_decompress` (satori can't read woff2). Same family the site ships.
const FONT_BOLD = join(import.meta.dir, 'fonts', 'Iosevka-Bold.ttf')

// Load fonts once
const regularData = await Bun.file(FONT_REGULAR).arrayBuffer()
const boldData = await Bun.file(FONT_BOLD).arrayBuffer()

// Site palette (from web/src/styles/global.css). The category tag + statusline
// accent are keyed off the top-level slug segment so cards are sortable by type.
const BG = '#1c1c1c'
const PANEL = '#242424'
const FG = '#e0e0e0'
const MUTED = '#8a8a8a'
const FRAME = '#3a3a3a'
const CATEGORY_COLOR: Record<string, string> = {
    posts: '#3b9dd2', // blue
    talks: '#ee8f24', // orange
    projects: '#9a76ce', // purple
    ideas: '#ee8f24', // orange
    about: '#3fb950', // green
    now: '#3fb950', // green
    css: '#3b9dd2', // blue
    webtui: '#3b9dd2', // blue
}
const DEFAULT_ACCENT = '#e05560' // red

// For the incremental check: if the generator itself or either font is
// newer than a cached PNG, regenerate (the template may have changed
// even when the source page didn't).
const SCRIPT_MTIME = (await stat(new URL(import.meta.url).pathname)).mtimeMs
const FONT_MTIME = Math.max(
    (await stat(FONT_REGULAR)).mtimeMs,
    (await stat(FONT_BOLD)).mtimeMs,
)
const GENERATOR_MTIME = Math.max(SCRIPT_MTIME, FONT_MTIME)

// Strip emoji and other non-renderable characters from titles
function stripEmoji(text: string): string {
    return text
        .replace(
            /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}\u{E000}-\u{F8FF}\u{200D}\u{20E3}]/gu,
            '',
        )
        .replace(/\s{2,}/g, ' ')
        .trim()
}

// Extract frontmatter from .md/.mdx files
function extractFrontmatter(content: string): Record<string, string> | null {
    const match = content.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return null
    const fm: Record<string, string> = {}
    for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':')
        if (idx === -1) continue
        const key = line.slice(0, idx).trim()
        const val = line
            .slice(idx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, '')
        fm[key] = val
    }
    return fm
}

// Recursively find all .md/.mdx files
async function findPages(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...(await findPages(full)))
        } else if (/\.(mdx?|md)$/.test(entry.name)) {
            files.push(full)
        }
    }
    return files
}

// Layout helpers: every parent div needs display:flex in satori.
const col = (style: Record<string, unknown>, children: unknown[]) => ({
    type: 'div',
    props: {
        style: { display: 'flex', flexDirection: 'column', ...style },
        children,
    },
})
const row = (style: Record<string, unknown>, children: unknown[]) => ({
    type: 'div',
    props: {
        style: { display: 'flex', flexDirection: 'row', ...style },
        children,
    },
})
const txt = (text: string, style: Record<string, unknown> = {}) => ({
    type: 'div',
    props: {
        style: { display: 'flex', fontFamily: 'Iosevka', ...style },
        children: text,
    },
})
const dot = (color: string) => ({
    type: 'div',
    props: {
        style: {
            display: 'flex',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: color,
        },
        children: [],
    },
})

// Generate a single OG image: a terminal-window card. The category (top-level
// slug segment) drives the tag + statusline accent color.
async function generateOgImage(
    title: string,
    date: string | null,
    category: string,
): Promise<Buffer> {
    const accent = CATEGORY_COLOR[category] ?? DEFAULT_ACCENT
    // Size the title to fit: longer titles step down.
    const big = title.length > 52 ? 52 : title.length > 34 ? 62 : 72

    const tree = col(
        {
            width: '100%',
            height: '100%',
            padding: '56px',
            backgroundColor: BG,
            fontFamily: 'Iosevka',
        },
        [
            col(
                {
                    flex: 1,
                    backgroundColor: PANEL,
                    border: `2px solid ${FRAME}`,
                    borderRadius: '14px',
                    overflow: 'hidden',
                },
                [
                    // Title bar: traffic lights + sam.onl, category tag
                    row(
                        {
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '20px 32px',
                            borderBottom: `2px solid ${FRAME}`,
                        },
                        [
                            row({ alignItems: 'center', gap: '12px' }, [
                                dot('#ff5f56'),
                                dot('#ffbd2e'),
                                dot('#27c93f'),
                                txt('sam.onl', {
                                    fontSize: '24px',
                                    color: MUTED,
                                    marginLeft: '12px',
                                }),
                            ]),
                            txt(category, {
                                fontSize: '22px',
                                fontWeight: 700,
                                color: accent,
                                border: `2px solid ${accent}`,
                                borderRadius: '8px',
                                padding: '4px 16px',
                            }),
                        ],
                    ),
                    // Body: prompt + title, statusline footer
                    col(
                        {
                            flex: 1,
                            padding: '44px 48px',
                            justifyContent: 'space-between',
                        },
                        [
                            col({}, [
                                txt(`$ cat ${category}/post.md`, {
                                    fontSize: '26px',
                                    color: MUTED,
                                    marginBottom: '28px',
                                }),
                                txt(title, {
                                    fontSize: `${big}px`,
                                    fontWeight: 700,
                                    color: FG,
                                    lineHeight: 1.15,
                                }),
                            ]),
                            row(
                                {
                                    alignItems: 'center',
                                    gap: '16px',
                                    fontSize: '24px',
                                    borderTop: `2px solid ${FRAME}`,
                                    paddingTop: '24px',
                                },
                                [
                                    txt('Sam Foreman', {
                                        color: accent,
                                        fontWeight: 700,
                                    }),
                                    ...(date
                                        ? [
                                              txt('·', { color: MUTED }),
                                              txt(date, { color: MUTED }),
                                          ]
                                        : []),
                                ],
                            ),
                        ],
                    ),
                ],
            ),
        ],
    )

    const svg = await satori(tree, {
        width: 1200,
        height: 630,
        fonts: [
            {
                name: 'Iosevka',
                data: regularData,
                weight: 400 as const,
                style: 'normal' as const,
            },
            {
                name: 'Iosevka',
                data: boldData,
                weight: 700 as const,
                style: 'normal' as const,
            },
        ],
    })

    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: 1200 },
    })
    return Buffer.from(resvg.render().asPng())
}

// Main
async function main() {
    const pages = await findPages(PAGES_DIR)
    let generated = 0
    let skipped = 0

    for (const page of pages) {
        const content = await Bun.file(page).text()
        const fm = extractFrontmatter(content)
        if (!fm?.title) continue
        if (fm.draft === 'true') continue

        // Compute slug: relative path from PAGES_DIR, strip index.md(x)
        let slug = relative(PAGES_DIR, page)
            .replace(/\/index\.(mdx?|md)$/, '')
            .replace(/\.(mdx?|md)$/, '')

        const outPath = join(OUT_DIR, `${slug}.png`)

        // Incremental: skip if PNG is newer than source AND newer than
        // both this script and the font (so template changes invalidate
        // cached PNGs).
        if (existsSync(outPath)) {
            const srcStat = await stat(page)
            const outStat = await stat(outPath)
            if (
                outStat.mtimeMs >= srcStat.mtimeMs &&
                outStat.mtimeMs >= GENERATOR_MTIME
            ) {
                skipped++
                continue
            }
        }

        const title = stripEmoji(fm.title)

        // Category = top-level slug segment (posts/talks/projects/...); a
        // top-level page (e.g. "about") is its own category.
        const category = slug.split('/')[0] || 'sam.onl'

        // Format date
        const date = fm.date
            ? new Date(fm.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
              })
            : null

        // Generate
        const png = await generateOgImage(title, date, category)
        await mkdir(dirname(outPath), { recursive: true })
        await Bun.write(outPath, png)
        generated++
        console.log(`  ${slug}.png`)
    }

    console.log(
        `\nDone: ${generated} generated, ${skipped} skipped (up to date)`,
    )
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
