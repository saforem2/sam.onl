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
const FONT_PATH = join(import.meta.dir, 'fonts', 'Iosevka-Regular.ttf')

// Load font once
const fontData = await Bun.file(FONT_PATH).arrayBuffer()

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
function extractFrontmatter(
    content: string,
): Record<string, string> | null {
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

// Generate a single OG image
async function generateOgImage(
    title: string,
    date: string | null,
): Promise<Buffer> {
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    width: '100%',
                    height: '100%',
                    padding: '60px',
                    backgroundColor: '#1c1c1c',
                    color: '#e0e0e0',
                    fontFamily: 'Iosevka Web',
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                fontSize: '28px',
                                opacity: 0.5,
                                marginBottom: '16px',
                            },
                            children: 'sam.onl',
                        },
                    },
                    {
                        type: 'div',
                        props: {
                            style: {
                                fontSize: title.length > 40 ? '48px' : '60px',
                                fontWeight: 400,
                                lineHeight: 1.2,
                                marginBottom: '24px',
                            },
                            children: title,
                        },
                    },
                    ...(date
                        ? [
                              {
                                  type: 'div',
                                  props: {
                                      style: {
                                          fontSize: '24px',
                                          opacity: 0.6,
                                      },
                                      children: date,
                                  },
                              },
                          ]
                        : []),
                ],
            },
        },
        {
            width: 1200,
            height: 630,
            fonts: [
                {
                    name: 'Iosevka Web',
                    data: fontData,
                    weight: 400 as const,
                    style: 'normal' as const,
                },
            ],
        },
    )

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

        // Incremental: skip if PNG exists and is newer than source
        if (existsSync(outPath)) {
            const srcStat = await stat(page)
            const outStat = await stat(outPath)
            if (outStat.mtimeMs >= srcStat.mtimeMs) {
                skipped++
                continue
            }
        }

        const title = stripEmoji(fm.title)

        // Format date
        const date = fm.date
            ? new Date(fm.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
              })
            : null

        // Generate
        const png = await generateOgImage(title, date)
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
