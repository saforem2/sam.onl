// order of documentation categories

import { getCollection } from 'astro:content'

// if a category is not included in the array, it will be moved to the end
export const categoryOrder = [
    'landing',
    'posts',
    'talks',
    'more',
    'projects',
    'about',
    'ideas',
    'now',
    'webtui',
    // 'start',
    // 'installation',
    // 'components',
    // 'plugins',
    // 'contributing',
]

/** Categories that should be nested under the "more" group in the sidebar */
export const moreSidebarGroup = new Set(['projects', 'about', 'ideas', 'now'])

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
    // landing: '󱠡  Hello!',
    // landing: '󱠡  Hello!',
    landing: '  Start',
    posts: '  Posts',
    talks: '󰐨  Talks',
    projects: '  Projects',
    about: '  About',
    ideas: '  Ideas',
    more: '  More',
    webtui: '  Style',
    now: '  Now',
    // start: '\uf024 Start',
    // installation: '\uf019 Installation',
    // components: '\uf121 Components',
    // plugins: '󰐱 Plugins',
    // contributing: '\uf407 Contributing',
}

export const docPages = await getCollection('docs')
// export const

function getPageDate(page: (typeof docPages)[number]): number {
    const d = (page.data as { date?: string | Date }).date
    if (d instanceof Date) return d.getTime()
    if (typeof d === 'string') {
        const parsed = new Date(d)
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
    }
    return 0
}

export function makeCategoryMap() {
    const categoryMap: Map<string, typeof docPages> = new Map()

    for (const docPage of docPages) {
        const [category] = docPage.id.split('/')
        const pages = categoryMap.get(category) || []
        pages.push(docPage)
        categoryMap.set(category, pages)
    }

    // Sort each category: pages with explicit order first, then by date
    // (reverse chronological), then alphabetically by title as fallback
    for (const [, pages] of categoryMap) {
        pages.sort((a, b) => {
            const orderA =
                typeof a.data.order === 'number' ? a.data.order : null
            const orderB =
                typeof b.data.order === 'number' ? b.data.order : null

            // Ordered pages come first, sorted by order value
            if (orderA !== null && orderB !== null) return orderA - orderB
            if (orderA !== null) return -1
            if (orderB !== null) return 1

            // Unordered pages: sort by date (reverse chronological)
            const dateA = getPageDate(a)
            const dateB = getPageDate(b)
            if (dateA !== dateB) return dateB - dateA

            // Fallback: alphabetical by title
            return a.data.title.localeCompare(b.data.title)
        })
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
