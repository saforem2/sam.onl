import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'

export async function GET(context: APIContext) {
    const allDocs = await getCollection('docs')
    const posts = allDocs
        .filter((doc) => {
            const id = doc.id
            const isPost =
                id.startsWith('posts/') && !id.startsWith('posts/drafts/')
            const isIndex =
                id === 'posts/index.mdx' ||
                id === 'posts/2025/index.mdx' ||
                id === 'posts/2025/06/index.mdx' ||
                id === 'posts/auroragpt/index.mdx' ||
                id === 'posts/ai-for-physics/index.mdx' ||
                id === 'posts/jupyter/index.mdx'
            const isDraft = doc.data.draft === true
            return isPost && !isIndex && !isDraft && doc.data.date
        })
        .sort((a, b) => {
            const dateA = new Date(a.data.date!).getTime()
            const dateB = new Date(b.data.date!).getTime()
            return dateB - dateA
        })

    return rss({
        title: 'Sam Foreman — Posts',
        stylesheet: '/rss/styles.xsl',
        description: 'Blog posts by Sam Foreman',
        site: context.site!.toString(),
        items: posts.map((post) => {
            const slug = post.id
                .replace(/\/index\.(mdx?|md)$/, '/')
                .replace(/\.(mdx?|md)$/, '/')
            return {
                title: post.data.title,
                pubDate: new Date(post.data.date!),
                description: post.data.description ?? '',
                link: `/${slug}`,
            }
        }),
    })
}
