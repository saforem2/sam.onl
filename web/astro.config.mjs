import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import { visit } from 'unist-util-visit'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeMermaid from 'rehype-mermaid'

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
            rehypeMermaid,
        ],
        syntaxHighlight: {
            type: 'shiki',
            excludeLangs: ['mermaid', 'math'],
        },
        shikiConfig: {
            // theme: 'one-dark-pro',
            themes: {
                dark: 'one-dark-pro',
                light: 'min-light',
            },
        },
        wrap: true,
    },
    integrations: [
        mdx({
            extendMarkdownConfig: true,
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
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
