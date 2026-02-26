import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import { visit } from 'unist-util-visit'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeMermaid from 'rehype-mermaid'
// import { createHighlighter } from 'shiki'
// import { createCssVariablesTheme } from 'shiki'
//
// const oneLight = createCssVariablesTheme({
//   name: 'one-light',
//   variablePrefix: '--shiki',
//   variableDefaults: {},
//   fontStyle: true
// })
// import oneLight from 'shiki/themes/one-light.json'
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

            let removeMarkerParagraph = true

            if (remainingLines.length > 0) {
                const remainingText = remainingLines
                    .join('\n')
                    .replace(/^\s+/, '')

                if (remainingText.trim().length > 0) {
                    firstTextNode.value = remainingText
                    removeMarkerParagraph = false
                }
            }

            if (removeMarkerParagraph) {
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
    site: 'https://samforeman.me',
    compressHTML: false,
    markdown: {
        remarkPlugins: [remarkMath],
        rehypePlugins: [
            rehypeHeadingIds,
            rehypeGitHubCallouts,
            rehypeMarkdownTabIndex,
            rehypeKatex,
            [
                rehypeMermaid,
                {
                    strategy: 'img-svg',
                    mermaidConfig: {
                        fontFamily: 'var(--font-family)',
                        fontSize: 'var(--font-size)',
                    },
                },
            ],
            // rehypeMermaid,
        ],
        syntaxHighlight: {
            type: 'shiki',
            excludeLangs: ['mermaid', 'math'],
        },
        shikiConfig: {
            wrap: false,
            // theme: 'one-dark-pro',
            themes: {
                dark: 'one-dark-pro',
                light: 'min-light',
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
            remarkPlugins: [remarkMath],
            rehypePlugins: [
                rehypeGitHubCallouts,
                rehypeKatex,
                [
                    rehypeMermaid,
                    {
                        mermaidConfig: {
                            fontFamily: 'var(--font-family)',
                            fontSize: 'var(--font-size)',
                        },
                    },
                ],
            ],
        }),
    ],
    vite: {
        ssr: {
            noExternal: [
                '@webtui/css',
                // '@webtui/theme-custom',
                '@webtui/theme-catppuccin',
                '@webtui/theme-nord',
                '@webtui/theme-gruvbox',
                '@webtui/theme-vitesse',
                '@webtui/plugin-nf',
            ],
        },
    },
})
