// order of documentation categories

import { getCollection } from 'astro:content'

// if a category is not included in the array, it will be moved to the end
export const categoryOrder = [
    'landing',
    'posts',
    'talks',
    'projects',
    'about',
    'ideas',
    'more',
    'webtui',
    'now',
    // 'start',
    // 'installation',
    // 'components',
    // 'plugins',
    // 'contributing',
]

//                   
//                   
//                   
//       
// ------------
//   Home
//   Posts
// 󰐨  Talks
//   More
//   Projects
// ------------
// <span><a href="/" id="home-link">[<span> </span>]</a></span>
// <row id="links">
// <a href="/posts" data-active={isOn === 'posts'}> Posts</a>
// <a href="/talks" data-active={isOn === 'talks'}>󰐨 Talks</a>
// <a href="/more" data-active={isOn === 'more'}> More</a>
// <!-- <a href="/projects" data-active={isOn === 'projects'}>  Projects </a> -->
// <a href="https://github.com/saforem2/sam.onl" target="_blank"
//     > Github</a
// >
// <button id="theme-button" size-="small">  </button>
// <button id="search-button" size-="small"> &#xea6d;</button>
// home:   Home
// posts:   Posts
// talks 󰐨  Talks
// more:   More
// projects:   Projects
export const categoryLabels: Record<(typeof categoryOrder)[number], string> = {
    // landing: '  Landing',
    landing: '󱠡  Hello!',
    posts: '  Posts',
    talks: '󰐨  Talks',
    projects: '  Projects',
    about: '  About',
    ideas: '  Ideas',
    more: '  More',
    webtui: '  WebTUI',
    now: '  Now',
    // start: '\uf024 Start',
    // installation: '\uf019 Installation',
    // components: '\uf121 Components',
    // plugins: '󰐱 Plugins',
    // contributing: '\uf407 Contributing',
}

export const docPages = await getCollection('docs')
// export const

export function makeCategoryMap() {
    const categoryMap: Map<string, typeof docPages> = new Map()

    for (const docPage of docPages) {
        const [category] = docPage.id.split('/')

        const categoryPages = [
            ...(categoryMap.get(category) || []),
            docPage,
        ].sort((a, b) => a.data.title.localeCompare(b.data.title))
        const orderedPages = categoryPages.filter(
            (page) => typeof page.data.order === 'number',
        )
        const unordered = categoryPages.filter(
            (page) => typeof page.data.order !== 'number',
        )

        const positive = orderedPages
            .filter((page) => (page.data.order as number) >= 0)
            .sort((a, b) => (a.data.order as number) - (b.data.order as number))
        const negative = orderedPages
            .filter((page) => (page.data.order as number) < 0)
            .sort((a, b) => (b.data.order as number) - (a.data.order as number))

        categoryMap.set(category, [...positive, ...unordered, ...negative])
    }

    return categoryMap
}

export function makeSortedCategoryEntries() {
    const categoryMap = makeCategoryMap()
    const categories = Array.from(categoryMap.entries()).sort(
        ([catA], [catB]) => {
            const indexA = categoryOrder.indexOf(catA)
            const indexB = categoryOrder.indexOf(catB)

            const inOrderA = indexA !== -1
            const inOrderB = indexB !== -1

            if (inOrderA && inOrderB) return indexA - indexB
            if (inOrderA) return -1
            if (inOrderB) return 1
            return 0
        },
    )

    return categories
}
