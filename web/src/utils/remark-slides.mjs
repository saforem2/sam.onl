/**
 * Splits a slide-deck MDX file at horizontal rules (`---`) and wraps each
 * resulting group in <section is-="slide"> with a `.slide-inner` child.
 * Lets decks be written without explicit <Slide> wrappers — just `---`
 * separators between slides.
 *
 * Activates in two cases:
 *   1. The frontmatter `layout` ends in `SlideLayout.astro` — wraps the
 *      whole file's top-level children.
 *   2. The MDX contains an explicit `<Presentation>` element — wraps its
 *      children only.
 *
 * In both cases, if the file already uses explicit <Slide> wrappers the
 * plugin is a no-op so legacy decks keep working.
 *
 * Note: Astro strips frontmatter from the markdown AST before remark
 * plugins run, so we read it from `vfile.data.astro.frontmatter` instead
 * of looking for a `yaml` node.
 */
import { visit } from 'unist-util-visit'

const SLIDE_HOST = 'Presentation'
const SLIDE_LAYOUT_HINT = 'SlideLayout.astro'

const isThematicBreak = (node) =>
    node?.type === 'thematicBreak' ||
    (node?.type === 'mdxJsxFlowElement' && node.name === 'hr')

const wrapInSlide = (children, attributes = []) => ({
    type: 'mdxJsxFlowElement',
    name: 'section',
    attributes: [
        {
            type: 'mdxJsxAttribute',
            name: 'is-',
            value: 'slide',
        },
        ...attributes,
    ],
    children: [
        {
            type: 'mdxJsxFlowElement',
            name: 'div',
            attributes: [
                {
                    type: 'mdxJsxAttribute',
                    name: 'class',
                    value: 'slide-inner',
                },
            ],
            children,
            data: { _mdxExplicitJsx: true },
        },
    ],
    data: { _mdxExplicitJsx: true },
})

const hasExplicitSlide = (children) =>
    children.some(
        (c) =>
            c?.type === 'mdxJsxFlowElement' &&
            (c.name === 'Slide' || c.name === 'section'),
    )

// Non-content nodes that should pass through to the top of the file
// unwrapped — frontmatter, MDX imports/exports, and bare expression
// nodes (the {/* comments */} we use as section dividers).
const isPassthrough = (node) =>
    node?.type === 'yaml' ||
    node?.type === 'toml' ||
    node?.type === 'mdxjsEsm' ||
    node?.type === 'mdxFlowExpression'

const splitIntoSlides = (children) => {
    if (!Array.isArray(children) || children.length === 0) return null
    if (hasExplicitSlide(children)) return null

    const groups = [[]]
    for (const child of children) {
        if (isThematicBreak(child)) {
            groups.push([])
            continue
        }
        groups[groups.length - 1].push(child)
    }

    const cleaned = groups.filter((g) =>
        g.some((c) => {
            if (c.type === 'text') return c.value.trim().length > 0
            return true
        }),
    )

    return cleaned.length > 0 ? cleaned : null
}

const hasSlideFrontmatter = (file) => {
    const layout = file?.data?.astro?.frontmatter?.layout
    return typeof layout === 'string' && layout.endsWith(SLIDE_LAYOUT_HINT)
}

export default function remarkSlides() {
    return (tree, file) => {
        // Case 1: explicit <Presentation> wrapper — split its children.
        visit(tree, 'mdxJsxFlowElement', (node) => {
            if (node.name !== SLIDE_HOST) return
            const split = splitIntoSlides(node.children)
            if (!split) return
            node.children = split.map((group) => wrapInSlide(group))
        })

        // Case 2: frontmatter says this is a slide deck — split top-level
        // siblings, leaving imports/comments at the top.
        if (!hasSlideFrontmatter(file)) return

        const passthroughEnd = (() => {
            let i = 0
            while (i < tree.children.length && isPassthrough(tree.children[i])) {
                i++
            }
            return i
        })()

        const head = tree.children.slice(0, passthroughEnd)
        const body = tree.children.slice(passthroughEnd)
        const split = splitIntoSlides(body)
        if (!split) return

        tree.children = [...head, ...split.map((group) => wrapInSlide(group))]
    }
}
