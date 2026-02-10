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
    compressHTML: false,
    markdown: {
        remarkPlugins: [remarkMath],
        rehypePlugins: [
            rehypeHeadingIds,
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
                light: 'one-light',
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
