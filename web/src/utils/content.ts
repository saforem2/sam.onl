// order of documentation categories

import { getCollection } from 'astro:content'

// if a category is not included in the array, it will be moved to the end
export const categoryOrder = [
    'about',
    'posts',
    'talks',
    'more',
    'webtui',
    'projects',
    'ideas',
    'now',
    // 'start',
    // 'installation',
    // 'components',
    // 'plugins',
    // 'contributing',
]

/** Categories that should be nested under the "more" group in the sidebar */
export const moreSidebarGroup = new Set(['projects', 'ideas', 'now'])

/** Categories that should not appear in the sidebar at all
   (still reachable via direct URL). */
export const sidebarHiddenCategories = new Set(['docs'])

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
// <a href="https://github.com/saforem2/samf.sh" target="_blank"
//     > Github</a
// >
// <button id="theme-button" size-="small">  </button>
// <button id="search-button" size-="small"> &#xea6d;</button>
// home:   Home
// posts:   Posts
// talks 󰐨  Talks
// more: 󰐱    More
// projects:   Projects
export const categoryLabels: Record<(typeof categoryOrder)[number], string> = {
    posts: 'posts',
    talks: 'talks',
    about: 'about',
    more: 'more',
    projects: 'projects',
    ideas: 'ideas',
    webtui: 'style',
    now: 'now',
    // ---------------------------
    // landing: '  start',
    // posts: '  posts',
    // talks: '  talks',
    // projects: '  projects',
    // about: '  about',
    // ideas: '  ideas',
    // more: '  More',
    // webtui: '  Style',
    // now: '  now',
    // ---------------------------
    // landing: '  Landing',
    // landing: '󱠡  Hello!',
    // landing: '󱠡  Hello!',
    // landing: '  start',
    // posts: '  posts',
    // projects: '  projects',
    // ideas: '󱠃 ideas',
    // more: '󰩦  More',
    // webtui: '󰸌  Style',
    // webtui: '  Style',
    // webtui: '  Style',
    // start: '\uf024 start',
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

/** Year-grouped categories order their sidebar entries by year (desc),
 * then by date (desc) within a year. Subdir-grouped categories order by
 * subdir (asc), then by title (asc). Everything else by title (asc). */
const yearGroupedCategoryOrder = new Set(['posts', 'talks'])
const yearPattern = /^\d{4}$/

/**
 * Flat page list in the same order the sidebar renders them. Used by
 * Doc.astro's prev/next nav so the buttons walk the tree the same way
 * the sidebar shows it.
 *
 * - posts/talks: year (desc) → date (desc within year) → id (asc tiebreak)
 * - everything else: subdir (asc) → title (asc), then subdir-less last
 */
export function makeSidebarOrderedPages() {
    const ordered: typeof docPages = []
    for (const [slug, pages] of makeSortedCategoryEntries()) {
        if (yearGroupedCategoryOrder.has(slug)) {
            ordered.push(...orderByYear(pages))
        } else {
            ordered.push(...orderBySubdir(pages))
        }
    }
    return ordered
}

function orderByYear(pages: typeof docPages) {
    const grouped = new Map<string, typeof docPages>()
    const misc: typeof docPages = []
    for (const page of pages) {
        const year = getPageYearString(page)
        if (year) {
            const g = grouped.get(year) ?? []
            g.push(page)
            grouped.set(year, g)
        } else {
            misc.push(page)
        }
    }
    for (const [, gpages] of grouped) {
        gpages.sort((a, b) => {
            const da = getPageDate(a)
            const db = getPageDate(b)
            if (da !== db) return db - da
            return a.id.localeCompare(b.id)
        })
    }
    const years = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))
    const out: typeof docPages = []
    for (const y of years) out.push(...(grouped.get(y) ?? []))
    out.push(...misc)
    return out
}

function orderBySubdir(pages: typeof docPages) {
    const grouped = new Map<string, typeof docPages>()
    const misc: typeof docPages = []
    for (const page of pages) {
        const parts = page.id.split('/')
        if (parts.length > 2 && parts[1]) {
            const subdir = parts[1]
            const g = grouped.get(subdir) ?? []
            g.push(page)
            grouped.set(subdir, g)
        } else {
            misc.push(page)
        }
    }
    for (const [, gpages] of grouped) {
        gpages.sort((a, b) => a.data.title.localeCompare(b.data.title))
    }
    const subdirs = Array.from(grouped.keys()).sort()
    const out: typeof docPages = []
    for (const sd of subdirs) out.push(...(grouped.get(sd) ?? []))
    out.push(...misc)
    return out
}

function getPageYearString(page: (typeof docPages)[number]): string | null {
    // Prefer the page's date frontmatter (matches sidebar's getPageYear)
    const d = (page.data as { date?: string | Date }).date
    if (d instanceof Date) return String(d.getFullYear())
    if (typeof d === 'string') {
        const parsed = new Date(d)
        if (!Number.isNaN(parsed.getTime())) return String(parsed.getFullYear())
    }
    // Fall back to a year segment in the URL path: posts/2025/05/03
    const [, year] = page.id.split('/')
    return year && yearPattern.test(year) ? year : null
}
