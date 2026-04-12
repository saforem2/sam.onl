import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getCollection } from 'astro:content'

export async function GET(context: APIContext) {
    const allDocs = await getCollection('docs')
    const talks = allDocs
        .filter((doc) => {
            const id = doc.id
            const isTalk = id.startsWith('talks/')
            const isIndex = id === 'talks/index.mdx'
            const isDraft = doc.data.draft === true
            return isTalk && !isIndex && !isDraft && doc.data.date
        })
        .sort((a, b) => {
            const dateA = new Date(a.data.date!).getTime()
            const dateB = new Date(b.data.date!).getTime()
            return dateB - dateA
        })

    return rss({
        title: 'Sam Foreman — Talks',
        stylesheet: '/rss/styles.xsl',
        description: 'Talks and presentations by Sam Foreman',
        site: context.site!.toString(),
        items: talks.map((talk) => {
            const slug = talk.id
                .replace(/\/index\.(mdx?|md)$/, '/')
                .replace(/\.(mdx?|md)$/, '/')
            return {
                title: talk.data.title,
                pubDate: new Date(talk.data.date!),
                description: talk.data.description ?? '',
                link: `/${slug}`,
            }
        }),
    })
}
