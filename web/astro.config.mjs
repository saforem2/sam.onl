import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import { visit } from 'unist-util-visit'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkSlides from './src/utils/remark-slides.mjs'
import rehypeTaskListInteractive from './src/utils/rehype-task-list-interactive.mjs'
// import rehypeMermaid from 'rehype-mermaid'
// import Catppuccin from 'tm-themes/themes/catppuccin-mocha'
// import { getSingletonHighlighter } from 'shiki'

// type LineHighlight = 'add' | 'remove' | 'change'
//
// interface Props {
//     code: string
//     lang?: 'html' | 'css'
//     file?: {
//         name: string
//         icon: [string, string] | string
//     }
//     highlights?: [number, LineHighlight][]
//     withShadow?: boolean
// }
//
// const {
//     code,
//     highlights,
//     lang = 'html',
//     file,
//     withShadow = false,
//     ...props
// } = Astro.props
//
// const highlighter = await getSingletonHighlighter({
//     themes: ['catppuccin-mocha'],
//     langs: ['html', 'css'],
// })
// const tokens = highlighter.codeToTokens(code, {
//     lang,
//     theme: 'catppuccin-mocha',
// })

import { createHighlighter } from 'shiki'
import { createCssVariablesTheme } from 'shiki'

// In-house Shiki themes generated from the project palette. Live alongside
// the prepackaged themes (min-light, one-dark-pro, catppuccin-*) — see the
// shikiConfig.themes block below. JSON imports use Node's import-attributes
// proposal, which Vite/Node 22+ support.
import samLight from './src/shiki-themes/sam-light.json' with { type: 'json' }
import samDark from './src/shiki-themes/sam-dark.json' with { type: 'json' }

const oneLight = createCssVariablesTheme({
    name: 'one-light',
    variablePrefix: '--shiki',
    variableDefaults: {},
    fontStyle: true,
})

const catpuccinMocha = createCssVariablesTheme({
    name: 'css-variables',
    variablePrefix: '--shiki-',
    variableDefaults: {},
    fontStyle: true,
})
const highlighter = await createHighlighter({
    themes: [oneLight, catpuccinMocha, samLight, samDark],
})

// import oneLight from 'shiki/themes/one-light.json'

const indexableElements = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'pre',
    'li',
    'p',
    'a',
    'div',
    'details',
    'summary',
    'flex-container',
    'column',
    'flex',
]

const calloutTypeAliases = {
    note: 'note',
    abstract: 'note',
    summary: 'note',
    info: 'tip',
    tip: 'tip',
    hint: 'tip',
    important: 'important',
    todo: 'important',
    warning: 'warning',
    caution: 'warning',
    attention: 'warning',
    error: 'error',
    danger: 'error',
    failure: 'error',
    fail: 'error',
    bug: 'error',
    success: 'success',
    question: 'note',
}

const calloutTitleByType = {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    error: 'Error',
    success: 'Success',
}

const calloutMarkerPattern = /^\s*\[!([a-zA-Z]+)\]([+-])?\s*(.*)$/

const toTitleCase = (value) =>
    value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value

const rehypeGitHubCallouts = () => {
    // @ts-expect-error doesn't matter
    return (tree) => {
        visit(tree, 'element', (node, index, parent) => {
            if (!parent || typeof index !== 'number') return
            if (node.tagName !== 'blockquote') return

            const paragraphIndex = node.children.findIndex(
                (child) => child.type === 'element' && child.tagName === 'p',
            )

            if (paragraphIndex < 0) return

            const paragraph = node.children[paragraphIndex]
            const firstTextNode = paragraph.children.find(
                (child) => child.type === 'text',
            )

            if (!firstTextNode || typeof firstTextNode.value !== 'string') {
                return
            }

            const [firstLine, ...remainingLines] =
                firstTextNode.value.split('\n')
            const markerMatch = firstLine.match(calloutMarkerPattern)
            if (!markerMatch) return

            const rawType = markerMatch[1].toLowerCase()
            const calloutType = calloutTypeAliases[rawType] ?? rawType
            const calloutTitle = markerMatch[3]?.trim()
            const summaryText =
                calloutTitle ||
                calloutTitleByType[calloutType] ||
                toTitleCase(rawType)

            // Three blockquote shapes we need to handle:
            //   (a) `> [!NOTE] body on same line`    → single <p>, single text node
            //   (b) `> [!NOTE]\n> body on next line` → single <p>, body in
            //       following children of THAT paragraph
            //   (c) `> [!NOTE]\n>\n> body in next paragraph` (blank `>` line)
            //       → TWO <p>s — marker paragraph + body paragraph
            //
            // The original implementation only handled (a). For (b)/(c) the
            // marker's first text node had no remaining lines, so the
            // marker paragraph was deleted and the rest of the paragraph
            // (case b) or the entire body paragraph (case c) was either
            // dropped or stranded as a sibling of the marker text.
            const remainingTextOnFirstLine = remainingLines.join('\n').replace(/^\s+/, '')
            const hasInlineBody = remainingTextOnFirstLine.trim().length > 0
            const hasMoreSiblingsInMarkerParagraph =
                paragraph.children.indexOf(firstTextNode) <
                paragraph.children.length - 1
            const markerParagraphHasBody =
                hasInlineBody || hasMoreSiblingsInMarkerParagraph

            if (hasInlineBody) {
                // Case (a)/(b) inline tail — strip the marker line, keep
                // the rest as the paragraph's leading text.
                firstTextNode.value = remainingTextOnFirstLine
            } else if (hasMoreSiblingsInMarkerParagraph) {
                // Case (b) where the marker is the only text on the first
                // line but the paragraph has more inline content after
                // (e.g. `> [!NOTE]\n> **bold** body`). Drop the marker
                // text node, keep the rest of the paragraph intact.
                paragraph.children.splice(
                    paragraph.children.indexOf(firstTextNode),
                    1,
                )
                // Trim a leading newline-text remnant if remark left one.
                const next = paragraph.children[
                    paragraph.children.indexOf(firstTextNode)
                ]
                if (next && next.type === 'text' && typeof next.value === 'string') {
                    next.value = next.value.replace(/^\s+/, '')
                }
            }

            // Drop the marker paragraph from the blockquote if it has no
            // remaining body content (case c — body is in a separate <p>).
            if (!markerParagraphHasBody) {
                node.children.splice(paragraphIndex, 1)
            }

            const detailsNode = {
                type: 'element',
                tagName: 'details',
                properties: {
                    'is-': 'accordion',
                    className: ['callout', `callout-${calloutType}`],
                    'data-callout': calloutType,
                },
                children: [
                    {
                        type: 'element',
                        tagName: 'summary',
                        properties: {},
                        children: [{ type: 'text', value: summaryText }],
                    },
                    ...node.children,
                ],
            }

            if (markerMatch[2] === '+') {
                detailsNode.properties.open = true
            }

            parent.children[index] = detailsNode
        })
    }
}

const rehypeMermaidClientSide = () => {
    // @ts-expect-error doesn't matter
    return (tree) => {
        visit(tree, 'element', (node, index, parent) => {
            if (!parent || typeof index !== 'number') return
            if (node.tagName !== 'pre') return

            const codeNode = node.children.find(
                (child) => child.type === 'element' && child.tagName === 'code',
            )
            if (!codeNode) return

            const classes = Array.isArray(codeNode.properties?.className)
                ? codeNode.properties.className
                : []
            const lang =
                codeNode.properties?.dataLanguage ??
                classes
                    .find(
                        (cls) =>
                            typeof cls === 'string' &&
                            cls.startsWith('language-'),
                    )
                    ?.slice('language-'.length)

            if (lang !== 'mermaid') return

            const source = codeNode.children
                .filter((child) => child.type === 'text')
                .map((child) => child.value)
                .join('')

            parent.children[index] = {
                type: 'element',
                tagName: 'div',
                properties: {
                    className: ['mermaid'],
                    'data-mermaid': source,
                },
                children: [{ type: 'text', value: source }],
            }
        })
    }
}

const rehypeMarkdownTabIndex = () => {
    // @ts-expect-error doesn't matter
    return (tree) => {
        visit(tree, 'element', (node) => {
            if (indexableElements.includes(node.tagName)) {
                node.properties.tabIndex = 0
            }
        })
    }
}

// https://astro.build/config
export default defineConfig({
    devToolbar: { enabled: false },
    site: 'https://sam.onl',
    compressHTML: false,
    markdown: {
        remarkPlugins: [remarkMath],
        rehypePlugins: [
            rehypeHeadingIds,
            rehypeGitHubCallouts,
            rehypeMarkdownTabIndex,
            rehypeKatex,
            rehypeMermaidClientSide,
            rehypeTaskListInteractive,
        ],
        syntaxHighlight: {
            type: 'shiki',
            excludeLangs: ['mermaid', 'math'],
        },
        shikiConfig: {
            wrap: false,
            // theme: 'one-dark-pro',
            defaultColor: 'custom-light',
            themes: {
                'custom-light': 'min-light',
                'custom-dark': 'one-dark-pro',
                catppuccin: 'catppuccin-mocha',
                'catppuccin-latte': 'catppuccin-latte',
                // In-house themes generated from the project palette.
                // Toggle via the theme picker → "sam-light" / "sam-dark".
                'sam-light': samLight,
                'sam-dark': samDark,
            },
            colorReplacements: {
                'one-light': {
                    '#986801': '#ee8f24',
                    '#C18401': '#eea724',
                },
            },
        },
    },
    integrations: [
        mdx({
            extendMarkdownConfig: true,
            remarkPlugins: [remarkMath, remarkSlides],
            rehypePlugins: [
                rehypeGitHubCallouts,
                rehypeKatex,
                rehypeMermaidClientSide,
                rehypeTaskListInteractive,
            ],
        }),
        sitemap(),
    ],
    vite: {
        ssr: {
            noExternal: [
                '@webtui/css',
                '@webtui/theme-catppuccin',
                '@webtui/theme-custom',
                '@webtui/plugin-nf',
            ],
        },
        plugins: [stubUnusedMermaidDiagrams()],
    },
})

/**
 * Vite plugin: stub out the mermaid diagram chunks we never render.
 *
 * Mermaid's core entry contains `import('./chunks/mermaid.core/{X}-{hash}.mjs')`
 * for every diagram type it knows about. Rollup follows those dynamic imports
 * and builds a chunk per diagram — plus their transitive vendor deps. Two of
 * those vendor chunks dominate the bundle:
 *   - cytoscape (~442 KB) — only needed by c4 / architecture / kanban
 *   - treemap (~453 KB) — only needed by treemap / mindmap
 *
 * Our deck uses flowchart, stateDiagram-v2, and gantt (in older posts). Every
 * other diagram class is unused. Resolving each unused chunk path to a stub
 * module that throws "diagram type not bundled" lets Rollup tree-shake their
 * vendor deps out of the build. If someone authors an architecture/treemap/etc
 * block later, mermaid will surface a clear runtime error pointing at this
 * stub, and the fix is to add the diagram to the keep-list below.
 */
function stubUnusedMermaidDiagrams() {
    const KEEP = new Set([
        'flowDiagram',
        'flowchartElk',
        'flowchart-elk',
        'stateDiagram',
        'stateDiagram-v2',
        'ganttDiagram',
        // 'diagram-*' is mermaid's per-type registration shim; keep them
        // all since they're tiny and removing them breaks registry init.
    ])
    // Match `chunks/mermaid.{core,esm}/{Name}-{HASH}.mjs`. Hash is
    // case-insensitive — mermaid's filenames use mixed-case rollup
    // hashes (e.g. `flowDiagram-PKNHOUZH.mjs`, `chunk-AGHRB4JF.mjs`),
    // so don't require all-uppercase. Also match the bare relative
    // form mermaid emits (no `mermaid/dist/` prefix) since the
    // importer is already inside mermaid's dist.
    const CHUNK_RE = /chunks[/\\]mermaid\.(?:core|esm)[/\\]([A-Za-z][A-Za-z0-9-]*)-[A-Za-z0-9]+\.mjs$/

    return {
        name: 'stub-unused-mermaid-diagrams',
        enforce: 'pre',
        async resolveId(source, importer) {
            if (!source.includes('chunks/mermaid.')) return null
            const m = source.match(CHUNK_RE)
            if (!m) {
                if (process.env.STUB_DEBUG) {
                    console.log('[stub] no match:', source, 'from', importer)
                }
                return null
            }
            const name = m[1]
            // Always allow the bare `diagram-*` registration shim
            // through, and the `chunk-*` shared internal modules
            // (those are common mermaid runtime, not per-diagram).
            if (name.startsWith('diagram-')) return null
            if (name === 'chunk') return null
            if (KEEP.has(name)) return null
            if (process.env.STUB_DEBUG) {
                console.log('[stub] STUBBING:', name, 'from', importer)
            }
            // Synthetic ID — load() below returns an empty module so
            // Rollup tree-shakes the transitive vendor deps out.
            return `\0mermaid-stub:${name}`
        },
        load(id) {
            if (!id.startsWith('\0mermaid-stub:')) return null
            const name = id.slice('\0mermaid-stub:'.length)
            return [
                `// Stubbed by astro.config.mjs:stubUnusedMermaidDiagrams.`,
                `// '${name}' isn't used anywhere in the site; authoring a diagram of`,
                `// this type will throw at runtime — add the chunk name to the KEEP`,
                `// set in astro.config.mjs to re-enable.`,
                `export default {`,
                `  id: '${name}',`,
                `  detector: () => false,`,
                `  loader: () => {`,
                `    throw new Error(`,
                `      "mermaid diagram type '${name}' is not bundled on this site. " +`,
                `      "Add it to the KEEP set in astro.config.mjs to re-enable."`,
                `    )`,
                `  },`,
                `}`,
            ].join('\n')
        },
    }
}

