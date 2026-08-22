/**
 * Colorize Python/Rich log output in ```logs fences.
 *
 * Notebook exports carry console output that was colored by Rich in the
 * terminal, but the ANSI is either stripped (leaving flat monochrome text) or
 * preserved as raw escape bytes that a browser cannot render. Either way the
 * structure is lost. This plugin recovers it by parsing the log FORMAT rather
 * than decoding ANSI:
 *
 *   [2025-12-31 11:21:32,364810][I][pytorch/experiment:117:evaluate] Running...
 *    └ timestamp             └ level └ source                      └ message
 *
 * `logs` is registered in astro.config.mjs `syntaxHighlight.excludeLangs`, so
 * Shiki skips these blocks (without that, it warns "The language 'logs'
 * doesn't exist" and falls back to plaintext). That leaves a plain
 * `<pre><code class="language-logs">` for us to walk.
 *
 * Lines that do not match the pattern -- tensor dumps, bare prints, torch
 * warnings -- pass through untouched. They were never colored either.
 */
import { visit } from 'unist-util-visit'

/** `[ts][LEVEL][source] message`, with the message optional. */
const LOG_LINE = /^\[([\d-]+ [\d:,]+)\]\[([A-Z])\]\[([^\]]+)\]\s?(.*)$/

/** Level letter -> modifier class. Anything else gets no level color. */
const LEVEL_CLASS = {
    I: 'log-level-i',
    W: 'log-level-w',
    E: 'log-level-e',
    C: 'log-level-e',
    D: 'log-level-d',
}

function span(className, value) {
    return {
        type: 'element',
        tagName: 'span',
        properties: { className: [className] },
        children: [{ type: 'text', value }],
    }
}

/**
 * One log line -> hast nodes. Returns a flat array so the caller can splice
 * it straight into `<code>`'s children.
 *
 * Building nodes (not HTML strings) means hast handles escaping, so a log
 * message containing `<` or `&` cannot break the document.
 */
function lineToNodes(line) {
    const m = LOG_LINE.exec(line)
    if (!m) return [{ type: 'text', value: line }]

    const [, ts, level, src, msg] = m
    const levelClass = LEVEL_CLASS[level]
    const nodes = [
        span('log-ts', `[${ts}]`),
        {
            type: 'element',
            tagName: 'span',
            properties: {
                className: levelClass
                    ? ['log-level', levelClass]
                    : ['log-level'],
            },
            children: [{ type: 'text', value: `[${level}]` }],
        },
        span('log-src', `[${src}]`),
    ]
    if (msg) nodes.push(span('log-msg', ` ${msg}`))
    return nodes
}

export default function rehypeLogOutput() {
    return (tree) => {
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'code') return
            const classes = node.properties?.className
            if (!Array.isArray(classes) || !classes.includes('language-logs')) {
                return
            }

            // Excluded from Shiki, so the body is a single raw text node.
            const raw = node.children
                .filter((c) => c.type === 'text')
                .map((c) => c.value)
                .join('')
            if (!raw) return

            const out = []
            // Split on \n and re-add it between lines, so a trailing newline
            // in the source does not become a stray empty line at the end.
            const lines = raw.split('\n')
            lines.forEach((line, i) => {
                if (i > 0) out.push({ type: 'text', value: '\n' })
                out.push(...lineToNodes(line))
            })
            node.children = out
        })
    }
}
