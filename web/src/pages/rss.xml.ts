import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'

// Section-level index/landing pages that share the posts/ or talks/
// prefix but aren't standalone content entries. Excluded from the feed
// so subscribers don't see year-summary pages alongside actual posts.
const indexPageIds = new Set([
    'posts/index.mdx',
    'posts/2025/index.mdx',
    'posts/2025/06/index.mdx',
    'posts/auroragpt/index.mdx',
    'posts/ai-for-physics/index.mdx',
    'posts/jupyter/index.mdx',
    'talks/index.mdx',
])

export async function GET(context: APIContext) {
    const allDocs = await getCollection('docs')
    // Combined feed: posts + talks, sorted newest-first by frontmatter
    // date. Drafts, draft folders, and section-index pages are filtered
    // out. Entries without a date are dropped (we can't sort or render
    // a pubDate for them, so they don't belong in the feed).
    const entries = allDocs
        .filter((doc) => {
            const id = doc.id
            const isFeedable =
                (id.startsWith('posts/') && !id.startsWith('posts/drafts/')) ||
                id.startsWith('talks/')
            const isDraft = doc.data.draft === true
            return (
                isFeedable && !indexPageIds.has(id) && !isDraft && doc.data.date
            )
        })
        .sort((a, b) => {
            const dateA = new Date(a.data.date!).getTime()
            const dateB = new Date(b.data.date!).getTime()
            return dateB - dateA
        })

    return rss({
        title: 'Sam Foreman',
        stylesheet: '/rss/styles.xsl',
        description:
            'Personal site and blog of Sam Foreman -- computational scientist at Argonne National Laboratory.',
        site: context.site!.toString(),
        items: entries.map((entry) => {
            // Convert collection id (e.g. "posts/2025/09/17/index.mdx") to a URL path
            const slug = entry.id
                .replace(/\/index\.(mdx?|md)$/, '/')
                .replace(/\.(mdx?|md)$/, '/')
            // Prefix entry title with [talk] / [post] so subscribers can
            // tell them apart in their reader without opening each one.
            const kind = entry.id.startsWith('talks/') ? 'talk' : 'post'
            return {
                title: `[${kind}] ${entry.data.title}`,
                pubDate: new Date(entry.data.date!),
                description: entry.data.description ?? '',
                link: `/${slug}`,
                content: entry.data.description ?? '',
                categories: [kind],
            }
        }),
    })
}
