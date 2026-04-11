# Site Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 mobile/responsive issues, improve reading experience (reading time, code block copy button, scroll progress, related posts), improve performance (font loading, initial load), and add engagement features (auto OG images, share buttons, better RSS).

**Architecture:** 4 projects broken into independent tasks. Tasks are ordered so shared-file edits don't conflict — independent files first, then sequenced edits to shared files (`Doc.astro`, `Doc.css`, `global.css`). Each task produces a working commit.

**Tech Stack:** Astro 5.x, CSS, TypeScript, satori + @resvg/resvg-js (OG images)

**Spec:** `docs/superpowers/specs/2026-04-10-site-improvements-design.md`

---

## File Map

### Files to modify

| File | Tasks | Changes |
|------|-------|---------|
| `web/src/components/landing/sections/Intro.astro` | 1 | Guard vimFocusElement on mobile |
| `web/src/styles/global.css` | 2, 8 | Code block mobile font-size, responsive typography, image overflow |
| `web/src/layouts/Doc.css` | 3, 4, 7 | Fixed mobile nav, TOC collapsed fix, sidebar breakpoint |
| `web/src/layouts/Doc.astro` | 4, 9, 10, 14 | TOC toggle fix, reading time, scroll progress, share buttons, structured data |
| `web/src/components/Navbar.astro` | 6 | Hide bracket hints on mobile |
| `web/src/layouts/Layout.astro` | 12, 14 | Font preload, structured data |
| `web/src/pages/rss.xml.ts` | 16 | Full-content RSS |

### Files to create

| File | Task | Purpose |
|------|------|---------|
| `web/src/utils/readingTime.ts` | 9 | Word count → reading time utility |
| `web/src/components/ShareButtons.astro` | 15 | Copy link / Twitter / Bluesky share |
| `web/src/pages/og/[...slug].png.ts` | 13 | Auto-generated OG images per post |
| `web/src/pages/rss/posts.xml.ts` | 16 | Posts-only RSS feed |
| `web/src/pages/rss/talks.xml.ts` | 16 | Talks-only RSS feed |

---

## Project 1: Mobile/Responsive Fixes

### Task 1: Fix landing page auto-scroll on mobile

**Files:**
- Modify: `web/src/components/landing/sections/Intro.astro:305-306`

- [ ] **Step 1: Add viewport width guard**

In `web/src/components/landing/sections/Intro.astro`, find the script block near line 305:

```javascript
const intro = document.getElementById('intro-widget')
if (intro) vimFocusElement(intro)
```

Replace with:

```javascript
const intro = document.getElementById('intro-widget')
if (intro) {
    if (window.innerWidth <= 768) {
        intro.focus({ preventScroll: true })
    } else {
        vimFocusElement(intro)
    }
}
```

- [ ] **Step 2: Verify on mobile viewport**

Run dev server: `cd web && bun run dev`

Open browser at 390px width. Reload landing page. Navbar should be visible at top without scrolling. On desktop (>768px), the widget should still auto-focus and scroll as before.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/landing/sections/Intro.astro
git commit -m "fix: Prevent auto-scroll to intro widget on mobile"
```

---

### Task 2: Fix code block font size on mobile

**Files:**
- Modify: `web/src/styles/global.css:486-507`

- [ ] **Step 1: Add mobile code block font-size override**

In `web/src/styles/global.css`, find the `@media (max-width: 480px)` block (line 486). Add a code block override inside it, after the existing `html` rule:

```css
pre.astro-code,
pre.astro-code code {
    font-size: clamp(0.7rem, 2.5vw, 0.875rem);
    line-height: 1.4;
}
```

The full media query should look like:

```css
@media (max-width: 480px) {
    :root {
        --font-size: 16px;
    }

    body,
    html {
        width: auto;
        min-height: 100vh;
        overflow-x: hidden;
        font-variant-ligatures: common-ligatures;
        margin: 0 1ch;
    }

    html {
        margin: 0;
        display: block;
    }

    pre.astro-code,
    pre.astro-code code {
        font-size: clamp(0.7rem, 2.5vw, 0.875rem);
        line-height: 1.4;
    }
}
```

- [ ] **Step 2: Also fix image container overflow**

In the same file, find the `p:has(> img)` rule (line 659). Change `overflow-x: scroll` to `overflow-x: auto`:

```css
p:has(> img) {
    max-width: 100%;
    height: auto;
    overflow-x: auto;
    img {
        object-fit: contain;
        max-width: 100%;
        height: auto;
    }
}
```

- [ ] **Step 3: Verify**

Open a blog post with code blocks (e.g., `/posts/2026/02/28`) at 390px viewport width. Code should be readable — smaller than body text but not tiny. Image containers should not show unnecessary scrollbars.

- [ ] **Step 4: Commit**

```bash
git add web/src/styles/global.css
git commit -m "fix: Reduce code block font size on mobile and fix image overflow"
```

---

### Task 3: Fix bottom nav hidden below fold

**Files:**
- Modify: `web/src/layouts/Doc.css:1-8` (mobile-nav styles), `web/src/layouts/Doc.css:634+` (120ch media query)

- [ ] **Step 1: Make mobile-nav fixed at bottom**

In `web/src/layouts/Doc.css`, find `#mobile-nav` at the top of the file (line 1):

```css
#mobile-nav {
    display: none;
    gap: 1ch;

    button {
        flex-grow: 1;
    }
}
```

Replace with:

```css
#mobile-nav {
    display: none;
    gap: 1ch;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 0.5lh 1ch;
    background-color: var(--background0, white);
    border-top: 1px solid var(--foreground2, #ccc);

    button {
        flex-grow: 1;
    }
}
```

- [ ] **Step 2: Add bottom padding to prevent content from hiding behind fixed nav**

In the same file, inside the `@media (max-width: 120ch)` block (line 634), add a rule for the main layout container. Find where `#mobile-nav { display: flex; }` appears (around line 670) and add after it:

```css
#doc-article {
    padding-bottom: 4lh;
}
```

- [ ] **Step 3: Verify**

Open a blog post at 390px width. The Menu/Docs/TOC buttons should be pinned to the bottom of the screen, always visible. Scroll through content — buttons should stay fixed. Content at the bottom should not be hidden behind the nav bar.

- [ ] **Step 4: Commit**

```bash
git add web/src/layouts/Doc.css
git commit -m "fix: Pin mobile nav to bottom of viewport"
```

---

### Task 4: Fix blank TOC on mobile

**Files:**
- Modify: `web/src/layouts/Doc.astro:1321-1337`

- [ ] **Step 1: Toggle collapsed class when showing TOC**

In `web/src/layouts/Doc.astro`, find the `setMobileActive` function (line 1321):

```javascript
function setMobileActive(panel: 'menu' | 'docs' | 'toc') {
    sidebarContainer.classList.toggle('mobile-hidden', panel !== 'menu')
    article.classList.toggle('mobile-hidden', panel !== 'docs')
    tocContainer?.classList.toggle('mobile-hidden', panel !== 'toc')
```

Add a line after the `tocContainer?.classList.toggle('mobile-hidden'...)` line to also toggle the `collapsed` class:

```javascript
function setMobileActive(panel: 'menu' | 'docs' | 'toc') {
    sidebarContainer.classList.toggle('mobile-hidden', panel !== 'menu')
    article.classList.toggle('mobile-hidden', panel !== 'docs')
    tocContainer?.classList.toggle('mobile-hidden', panel !== 'toc')
    tocContainer?.classList.toggle('collapsed', panel !== 'toc')
```

- [ ] **Step 2: Verify**

Open a blog post with headings at 390px width. Tap the TOC button. The table of contents should appear with all heading links visible — not a blank white page. Tap Docs to go back. Tap TOC again — should still work.

- [ ] **Step 3: Commit**

```bash
git add web/src/layouts/Doc.astro
git commit -m "fix: Toggle collapsed class when showing TOC on mobile"
```

---

### Task 5: Fix post title truncation

**Files:**
- Modify: `web/src/components/landing/widgets/PostsWidget.astro:101-104`

This is specifically about the PostsWidget on the landing page. The `.pw-name` class uses `text-overflow: ellipsis` but with no `white-space: nowrap`, the behavior is inconsistent.

- [ ] **Step 1: Ensure consistent ellipsis behavior**

In `web/src/components/landing/widgets/PostsWidget.astro`, find the `.pw-name` style (line 101):

```css
.pw-name {
    overflow: hidden;
    text-overflow: ellipsis;
}
```

Replace with:

```css
.pw-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
}
```

Also find the `.pw-item` style and ensure it has `overflow: hidden` and `min-width: 0` so flex children truncate properly:

```css
.pw-item {
    /* existing styles... */
    overflow: hidden;
    min-width: 0;
}
```

- [ ] **Step 2: Check the full posts page table too**

Open `web/src/pages/posts/index.mdx` and check if the posts table there also truncates. If it uses a standard HTML table, the fix is different — add to `global.css`:

```css
@media (max-width: 480px) {
    /* ...existing rules... */

    td, th {
        word-break: break-word;
    }
}
```

- [ ] **Step 3: Verify**

View the landing page at 390px. Post titles in the widget should show with ellipsis when too long. View `/posts` page — titles in the table should wrap instead of being clipped.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/landing/widgets/PostsWidget.astro web/src/styles/global.css
git commit -m "fix: Consistent text truncation for post titles on mobile"
```

---

### Task 6: Hide navbar bracket hints on mobile

**Files:**
- Modify: `web/src/components/Navbar.astro:57-63, 315+`

- [ ] **Step 1: Wrap bracket/key notation in a span**

In `web/src/components/Navbar.astro`, find the link markup (line 59-62):

```html
<span id="wages">
     [<a href="/posts" data-active={isOn === 'posts'}>p</a>]osts &nbsp;
    󰐨 [<a href="/talks" data-active={isOn === 'talks'}>t</a>]alks &nbsp;
     [<a href="/more" data-active={isOn === 'more'}>m</a>]ore &nbsp;
</span>
```

Replace with spans wrapping the bracket notation so it can be hidden:

```html
<span id="wages">
     <span class="keyhint">[</span><a href="/posts" data-active={isOn === 'posts'}>p</a><span class="keyhint">]</span>osts &nbsp;
    󰐨 <span class="keyhint">[</span><a href="/talks" data-active={isOn === 'talks'}>t</a><span class="keyhint">]</span>alks &nbsp;
     <span class="keyhint">[</span><a href="/more" data-active={isOn === 'more'}>m</a><span class="keyhint">]</span>ore &nbsp;
</span>
```

Do the same for the home link (line 57):

```html
<span><a href="/" id="home-link"><span class="keyhint">[</span><span> </span><span class="keyhint">]</span></a></span>
```

- [ ] **Step 2: Add CSS to hide keyhints on mobile**

In the same file's `<style>` section, add after the existing media queries (around line 346):

```css
@media (max-width: 480px) {
    .keyhint {
        display: none;
    }
}
```

- [ ] **Step 3: Verify**

View the site at 390px width. The navbar should show icon + text (e.g., " posts") without brackets. At desktop width, brackets should still show.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Navbar.astro
git commit -m "style: Hide keyboard shortcut bracket hints on mobile"
```

---

### Task 7: Lower sidebar mobile breakpoint

**Files:**
- Modify: `web/src/layouts/Doc.css:634`

- [ ] **Step 1: Change breakpoint from 120ch to 80ch**

In `web/src/layouts/Doc.css`, find line 634:

```css
@media (max-width: 120ch) {
```

Replace with:

```css
@media (max-width: 80ch) {
```

This changes the breakpoint from ~1440px to ~960px, so tablets in landscape get the full sidebar layout.

- [ ] **Step 2: Verify**

Test at 1024px width — sidebar should be visible. Test at 768px width — should show mobile layout with Menu/Docs/TOC buttons. Test at 390px — should still work as mobile.

- [ ] **Step 3: Commit**

```bash
git add web/src/layouts/Doc.css
git commit -m "fix: Lower mobile sidebar breakpoint from 120ch to 80ch"
```

---

### Task 8: Add responsive typography

**Files:**
- Modify: `web/src/styles/global.css:54-60`

- [ ] **Step 1: Add clamp() to root font size**

In `web/src/styles/global.css`, find the `:root` block (line 54). Change the `--font-size` variable:

```css
--font-size: clamp(0.875rem, 0.5rem + 1vw, 1rem);
```

- [ ] **Step 2: Add responsive heading sizes**

Find the heading color rules in the `@layer base` section. Add responsive font-size rules. Look for where `h1`, `h2`, `h3` styles are defined and add:

```css
h1 { font-size: clamp(1.4rem, 1rem + 2vw, 2rem); }
h2 { font-size: clamp(1.2rem, 0.9rem + 1.5vw, 1.6rem); }
h3 { font-size: clamp(1.05rem, 0.8rem + 1vw, 1.35rem); }
```

If heading styles are defined in `Doc.css` instead, add them there.

- [ ] **Step 3: Verify**

Resize browser from 390px to 1920px. Text should scale smoothly — slightly smaller on mobile, full size on desktop. No jarring jumps.

- [ ] **Step 4: Commit**

```bash
git add web/src/styles/global.css
git commit -m "style: Add responsive typography with clamp()"
```

---

## Project 2: Reading Experience

### Task 9: Add reading time estimate

**Files:**
- Create: `web/src/utils/readingTime.ts`
- Modify: `web/src/layouts/Doc.astro:86-90`

- [ ] **Step 1: Create reading time utility**

Create `web/src/utils/readingTime.ts`:

```typescript
const WORDS_PER_MINUTE = 200

export function getReadingTime(text: string): string {
    const words = text.trim().split(/\s+/).length
    const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
    return `${minutes} min read`
}
```

- [ ] **Step 2: Display reading time in Doc.astro header**

In `web/src/layouts/Doc.astro`, find the header section (line 86-90):

```html
<header is-="row" align-="between">
    <div is-="badge" variant-="background0">
        <h1>{frontmatter.title}</h1>
    </div>
</header>
```

First, add the import at the top of the frontmatter section (between the `---` fences):

```typescript
import { getReadingTime } from '@/utils/readingTime'
```

Then compute reading time from the raw body. In the frontmatter section, add after the existing variables:

```typescript
const rawBody = await Astro.slots.render('default')
const readingTime = getReadingTime(rawBody.replace(/<[^>]*>/g, ''))
```

Then update the header to show it:

```html
<header is-="row" align-="between">
    <div is-="badge" variant-="background0">
        <h1>{frontmatter.title}</h1>
    </div>
    {frontmatter.date && (
        <span style="font-size: 0.85em; opacity: 0.7;">
            {readingTime}
        </span>
    )}
</header>
```

- [ ] **Step 3: Verify**

Open a blog post. Below the title, you should see "X min read". Check a short post and a long post — values should differ.

- [ ] **Step 4: Commit**

```bash
git add web/src/utils/readingTime.ts web/src/layouts/Doc.astro
git commit -m "feat: Add estimated reading time to blog post headers"
```

---

### Task 10: Add scroll progress indicator

**Files:**
- Modify: `web/src/layouts/Doc.astro` (add element + script)
- Modify: `web/src/layouts/Doc.css` (add styles)

- [ ] **Step 1: Add progress bar element**

In `web/src/layouts/Doc.astro`, find the `#scroll-container` element (line 92). Add a progress bar just before it:

```html
<div id="scroll-progress" aria-hidden="true"></div>
<div id="scroll-container">
```

- [ ] **Step 2: Add CSS for progress bar**

In `web/src/layouts/Doc.css`, add at the end of the file (before any media queries, or in the global scope):

```css
#scroll-progress {
    position: sticky;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--accent, var(--red));
    transform-origin: left;
    transform: scaleX(0);
    z-index: 50;
    transition: transform 50ms linear;
}
```

- [ ] **Step 3: Add scroll listener script**

In `web/src/layouts/Doc.astro`, add a new script block before the closing of the file (before the footnote tooltip script):

```html
<script>
    const scrollContainer = document.getElementById('scroll-container')
    const progressBar = document.getElementById('scroll-progress')

    if (scrollContainer && progressBar) {
        const mainContent = document.getElementById('main-content')
        scrollContainer.addEventListener('scroll', () => {
            if (!mainContent) return
            const scrollTop = scrollContainer.scrollTop
            const scrollHeight = mainContent.scrollHeight - scrollContainer.clientHeight
            const progress = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0
            progressBar.style.transform = `scaleX(${progress})`
        })
    }
</script>
```

- [ ] **Step 4: Verify**

Open a long blog post. As you scroll, a thin colored bar at the top of the article should fill from left to right. At the bottom, it should be full width.

- [ ] **Step 5: Commit**

```bash
git add web/src/layouts/Doc.astro web/src/layouts/Doc.css
git commit -m "feat: Add scroll progress indicator to blog posts"
```

---

### Task 11: Add copy button to code blocks

**Files:**
- Modify: `web/src/layouts/Doc.astro` (client script)
- Modify: `web/src/styles/global.css` (button styles)

- [ ] **Step 1: Add client script to inject copy buttons**

In `web/src/layouts/Doc.astro`, add a new script block:

```html
<script>
    const codeBlocks = document.querySelectorAll('pre.astro-code')
    for (const block of codeBlocks) {
        const wrapper = document.createElement('div')
        wrapper.style.position = 'relative'
        block.parentNode?.insertBefore(wrapper, block)
        wrapper.appendChild(block)

        const button = document.createElement('button')
        button.className = 'code-copy-btn'
        button.textContent = 'copy'
        button.addEventListener('click', async () => {
            const code = block.querySelector('code')
            if (!code) return
            await navigator.clipboard.writeText(code.innerText)
            button.textContent = 'copied!'
            setTimeout(() => { button.textContent = 'copy' }, 2000)
        })
        wrapper.appendChild(button)
    }
</script>
```

- [ ] **Step 2: Add copy button styles**

In `web/src/styles/global.css`, add after the existing `pre.astro-code` rules (around line 627):

```css
.code-copy-btn {
    position: absolute;
    top: 0.5lh;
    right: 1ch;
    padding: 0 1ch;
    font-size: 0.75em;
    font-family: var(--font-family);
    color: var(--foreground2);
    background: var(--background1);
    border: 1px solid var(--foreground2);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 5;

    &:hover {
        color: var(--foreground0);
        background: var(--background2);
    }
}

div:has(> pre.astro-code):hover .code-copy-btn {
    opacity: 1;
}
```

- [ ] **Step 3: Verify**

Open a blog post with code blocks. Hover over a code block — a "copy" button should appear in the top-right corner. Click it — text should be copied to clipboard and button should show "copied!" briefly.

- [ ] **Step 4: Commit**

```bash
git add web/src/layouts/Doc.astro web/src/styles/global.css
git commit -m "feat: Add copy button to code blocks"
```

---

### Task 12: Add related posts

**Files:**
- Modify: `web/src/layouts/Doc.astro`

- [ ] **Step 1: Compute related posts in frontmatter**

In `web/src/layouts/Doc.astro`, in the frontmatter section (between `---` fences), add after the reading time computation:

```typescript
import { getCollection } from 'astro:content'

// Find related posts (same parent directory)
const currentPath = Astro.url.pathname
const isPost = currentPath.startsWith('/posts/')
let relatedPosts: Array<{ title: string; date: Date; href: string }> = []

if (isPost) {
    const allDocs = await getCollection('docs')
    const pathParts = currentPath.split('/').filter(Boolean)
    // Get parent directory (e.g., /posts/auroragpt/ or /posts/2025/)
    const parentDir = pathParts.length >= 3
        ? pathParts.slice(0, pathParts.length - 1).join('/')
        : 'posts'

    relatedPosts = allDocs
        .filter((doc) => {
            const docPath = doc.id.replace(/\/index\.(mdx?|md)$/, '')
            return (
                docPath.startsWith(parentDir) &&
                `/${docPath}` !== currentPath.replace(/\/$/, '') &&
                doc.data.title &&
                doc.data.date &&
                !doc.data.draft &&
                !doc.id.endsWith(`${parentDir}/index.mdx`)
            )
        })
        .map((doc) => ({
            title: doc.data.title,
            date: new Date(doc.data.date!),
            href: `/${doc.id.replace(/\/index\.(mdx?|md)$/, '/')}`,
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 3)
}
```

- [ ] **Step 2: Render related posts at end of article**

In the template section of `Doc.astro`, find the end of the `<main id="main-content">` content area (before the `</main>` closing tag or before the prev/next navigation). Add:

```html
{relatedPosts.length > 0 && (
    <aside style="margin-top: 2lh; border-top: 1px solid var(--foreground2); padding-top: 1lh;">
        <h3>Related posts</h3>
        <ul style="list-style: none; padding: 0;">
            {relatedPosts.map((post) => (
                <li>
                    <a href={post.href}>{post.title}</a>
                    <span style="opacity: 0.6; font-size: 0.85em;"> — {post.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </li>
            ))}
        </ul>
    </aside>
)}
```

- [ ] **Step 3: Verify**

Open a post that has siblings in the same directory (e.g., any post under `/posts/auroragpt/`). Related posts section should appear at the bottom with links to sibling posts. A post with no siblings should show nothing.

- [ ] **Step 4: Commit**

```bash
git add web/src/layouts/Doc.astro
git commit -m "feat: Add related posts section to blog posts"
```

---

## Project 3: Performance & SEO

### Task 13: Fix font loading flash

**Files:**
- Modify: `web/src/layouts/Layout.astro:83-88`

- [ ] **Step 1: Add font preload and display swap**

In `web/src/layouts/Layout.astro`, find the font loading section (line 83-88):

```html
<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
    href="https://iosevka-webfonts.github.io/iosevka/Iosevka.css"
    rel="stylesheet"
/>
```

Replace with:

```html
<!-- Fonts -->
<link rel="preconnect" href="https://iosevka-webfonts.github.io" crossorigin />
<link
    rel="preload"
    href="https://iosevka-webfonts.github.io/iosevka/Iosevka.css"
    as="style"
/>
<link
    href="https://iosevka-webfonts.github.io/iosevka/Iosevka.css"
    rel="stylesheet"
/>
```

Note: The `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com` can be removed if the site no longer uses Google Fonts (it loads Iosevka from `iosevka-webfonts.github.io`). Check if any other font is loaded from Google — if not, remove those preconnects.

- [ ] **Step 2: Verify**

Run `bun run build` in the `web/` directory. Open the built site and check the network waterfall — the font CSS should be preloaded and start fetching earlier. The flash of unstyled text should be reduced.

- [ ] **Step 3: Commit**

```bash
git add web/src/layouts/Layout.astro
git commit -m "perf: Preload Iosevka font CSS to reduce FOUT"
```

---

### Task 14: Add structured data (JSON-LD)

**Files:**
- Modify: `web/src/layouts/Layout.astro` (Person schema on all pages)
- Modify: `web/src/layouts/Doc.astro` (Article schema on posts)

- [ ] **Step 1: Add Person schema to Layout.astro**

In `web/src/layouts/Layout.astro`, add before the closing `</head>` tag:

```html
<script type="application/ld+json" set:html={JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Sam Foreman",
    "url": "https://sam.onl",
    "author": {
        "@type": "Person",
        "name": "Sam Foreman",
        "jobTitle": "Computational Scientist",
        "affiliation": {
            "@type": "Organization",
            "name": "Argonne National Laboratory"
        },
        "url": "https://sam.onl"
    }
})} />
```

- [ ] **Step 2: Add Article schema to Doc.astro for posts**

In `web/src/layouts/Doc.astro`, in the template section, add inside the `<head>` slot or in the component body (wherever meta tags are injected):

Add to the frontmatter:

```typescript
const isPostPage = Astro.url.pathname.startsWith('/posts/')
const articleSchema = isPostPage && frontmatter.date ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": frontmatter.title,
    "datePublished": new Date(frontmatter.date).toISOString(),
    "author": {
        "@type": "Person",
        "name": "Sam Foreman",
        "url": "https://sam.onl"
    },
    "description": frontmatter.description ?? '',
}) : null
```

Add in the template, after the header:

```html
{articleSchema && (
    <script type="application/ld+json" set:html={articleSchema} />
)}
```

- [ ] **Step 3: Verify**

Run `bun run build`. Check the generated HTML source for a post page — it should contain both WebSite and Article JSON-LD blocks. Validate with Google's Rich Results Test.

- [ ] **Step 4: Commit**

```bash
git add web/src/layouts/Layout.astro web/src/layouts/Doc.astro
git commit -m "feat: Add JSON-LD structured data for SEO"
```

---

## Project 4: Engagement (independent — can parallelize)

### Task 15: Add share buttons

**Files:**
- Create: `web/src/components/ShareButtons.astro`
- Modify: `web/src/layouts/Doc.astro`

- [ ] **Step 1: Create ShareButtons component**

Create `web/src/components/ShareButtons.astro`:

```astro
---
interface Props {
    title: string
    url: string
}

const { title, url } = Astro.props
---

<div class="share-buttons">
    <span style="font-size: 0.85em; opacity: 0.7;">share:</span>
    <button class="share-btn" data-action="copy" data-url={url} title="Copy link">
        &#xf0c5; copy
    </button>
    <a
        class="share-btn"
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on Twitter/X"
    >
        &#xf099; twitter
    </a>
    <a
        class="share-btn"
        href={`https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Share on Bluesky"
    >
        &#xe28e; bluesky
    </a>
</div>

<style>
    .share-buttons {
        display: flex;
        align-items: center;
        gap: 1ch;
        flex-wrap: wrap;
    }

    .share-btn {
        font-family: var(--font-family);
        font-size: 0.85em;
        padding: 0 1ch;
        color: var(--foreground1);
        background: var(--background1);
        border: 1px solid var(--foreground2);
        cursor: pointer;
        text-decoration: none;

        &:hover {
            color: var(--foreground0);
            background: var(--background2);
        }
    }
</style>

<script>
    const copyButtons = document.querySelectorAll('.share-btn[data-action="copy"]')
    for (const btn of copyButtons) {
        btn.addEventListener('click', async () => {
            const url = (btn as HTMLElement).dataset.url
            if (!url) return
            await navigator.clipboard.writeText(url)
            const original = btn.textContent
            btn.textContent = '\uf00c copied!'
            setTimeout(() => { btn.textContent = original }, 2000)
        })
    }
</script>
```

- [ ] **Step 2: Add ShareButtons to Doc.astro**

In `web/src/layouts/Doc.astro`, import the component in the frontmatter:

```typescript
import ShareButtons from '@/components/ShareButtons.astro'
```

Add it after the post header (after the reading time, around line 90):

```html
{isPost && (
    <ShareButtons
        title={frontmatter.title}
        url={`https://sam.onl${Astro.url.pathname}`}
    />
)}
```

Note: `isPost` may need to be defined if it doesn't already exist:

```typescript
const isPost = Astro.url.pathname.startsWith('/posts/')
```

- [ ] **Step 3: Verify**

Open a blog post. Share buttons should appear below the title. Click "copy" — URL should be copied to clipboard. Click Twitter/Bluesky — should open share intent in a new tab with pre-filled text.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ShareButtons.astro web/src/layouts/Doc.astro
git commit -m "feat: Add share buttons to blog posts"
```

---

### Task 16: Auto-generate OG images

**Files:**
- Create: `web/src/pages/og/[...slug].png.ts`
- Modify: `web/src/layouts/Layout.astro:54-64`

- [ ] **Step 1: Install satori and resvg**

```bash
cd web && bun add satori @resvg/resvg-js
```

- [ ] **Step 2: Create OG image endpoint**

Create `web/src/pages/og/[...slug].png.ts`:

```typescript
import type { APIRoute, GetStaticPaths } from 'astro'
import { getCollection } from 'astro:content'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

export const getStaticPaths: GetStaticPaths = async () => {
    const docs = await getCollection('docs')
    return docs
        .filter((doc) => doc.data.title && !doc.data.draft)
        .map((doc) => {
            const slug = doc.id.replace(/\/index\.(mdx?|md)$/, '')
            return {
                params: { slug },
                props: {
                    title: doc.data.title,
                    date: doc.data.date
                        ? new Date(doc.data.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                          })
                        : null,
                },
            }
        })
}

export const GET: APIRoute = async ({ props }) => {
    const { title, date } = props as { title: string; date: string | null }

    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    width: '100%',
                    height: '100%',
                    padding: '60px',
                    backgroundColor: '#1c1c1c',
                    color: '#e0e0e0',
                    fontFamily: 'monospace',
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                fontSize: '28px',
                                opacity: 0.5,
                                marginBottom: '16px',
                            },
                            children: 'sam.onl',
                        },
                    },
                    {
                        type: 'div',
                        props: {
                            style: {
                                fontSize: title.length > 40 ? '48px' : '60px',
                                fontWeight: 700,
                                lineHeight: 1.2,
                                marginBottom: '24px',
                            },
                            children: title,
                        },
                    },
                    ...(date
                        ? [
                              {
                                  type: 'div',
                                  props: {
                                      style: {
                                          fontSize: '24px',
                                          opacity: 0.6,
                                      },
                                      children: date,
                                  },
                              },
                          ]
                        : []),
                ],
            },
        },
        {
            width: 1200,
            height: 630,
            fonts: [],
        },
    )

    const resvg = new Resvg(svg, {
        fitTo: { mode: 'width', value: 1200 },
    })
    const png = resvg.render().asPng()

    return new Response(png, {
        headers: { 'Content-Type': 'image/png' },
    })
}
```

- [ ] **Step 3: Update Layout.astro to use dynamic OG images**

In `web/src/layouts/Layout.astro`, the component needs to accept a `slug` prop. First, check how `Layout.astro` receives props from `Doc.astro`. Add a prop for `ogSlug`:

In the frontmatter of `Layout.astro`, add:

```typescript
interface Props {
    ogSlug?: string
    title?: string
    description?: string
}
const { ogSlug, title, description } = Astro.props
```

Then update the OG image meta tags (line 54-64):

```html
<meta property="og:image" content={ogSlug
    ? `https://sam.onl/og/${ogSlug}.png`
    : "https://sam.onl/social-card.png"
} />
```

In `Doc.astro`, pass the slug to Layout:

```html
<Layout ogSlug={Astro.url.pathname.replace(/^\//, '').replace(/\/$/, '')}>
```

- [ ] **Step 4: Verify**

Run `bun run build`. Check that PNG files are generated in `dist/og/`. Open one in a browser — it should show the post title on a dark background. Verify the HTML source of a post page has the correct og:image URL.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/og/ web/src/layouts/Layout.astro web/src/layouts/Doc.astro web/package.json web/bun.lock
git commit -m "feat: Auto-generate Open Graph images per post"
```

---

### Task 17: Improve RSS feeds

**Files:**
- Modify: `web/src/pages/rss.xml.ts`
- Create: `web/src/pages/rss/posts.xml.ts`
- Create: `web/src/pages/rss/talks.xml.ts`

- [ ] **Step 1: Add full content to main RSS feed**

In `web/src/pages/rss.xml.ts`, update the items mapping to include `content` (rendered HTML). The `@astrojs/rss` package supports a `content` field. Since we're using content collections, we can render the entries:

Replace the `items` mapping in the `rss()` call:

```typescript
items: posts.map((post) => {
    const slug = post.id
        .replace(/\/index\.(mdx?|md)$/, '/')
        .replace(/\.(mdx?|md)$/, '/')
    return {
        title: post.data.title,
        pubDate: new Date(post.data.date!),
        description: post.data.description ?? '',
        link: `/${slug}`,
        content: post.data.description ?? '',
    }
}),
```

Note: Full HTML content rendering in RSS requires rendering the MDX at build time, which is complex with Astro content collections. For now, use the `description` field as content. If the user wants full HTML content later, this would require a custom rendering pipeline.

- [ ] **Step 2: Create posts-only RSS feed**

Create `web/src/pages/rss/posts.xml.ts`:

```typescript
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
```

- [ ] **Step 3: Create talks-only RSS feed**

Create `web/src/pages/rss/talks.xml.ts`:

```typescript
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
```

- [ ] **Step 4: Verify**

Run `bun run build`. Check that `dist/rss.xml`, `dist/rss/posts.xml`, and `dist/rss/talks.xml` all exist. Open each in a browser — they should show valid RSS with correct items.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/rss.xml.ts web/src/pages/rss/
git commit -m "feat: Add per-category RSS feeds and improve main feed"
```

---

## Task Dependency & Parallelization Guide

```
Independent (can run in parallel):
├── Task 1  (Intro.astro only)
├── Task 5  (PostsWidget.astro only)
├── Task 6  (Navbar.astro only)
├── Task 9  (new readingTime.ts + Doc.astro*)
├── Task 15 (new ShareButtons.astro + Doc.astro*)
├── Task 16 (new OG endpoint + Layout.astro*)
└── Task 17 (RSS files only)

Sequential chain A — global.css:
    Task 2 → Task 8

Sequential chain B — Doc.css:
    Task 3 → Task 7 → Task 10

Sequential chain C — Doc.astro (after Tasks 4, 9, 11, 12, 14, 15 are sequenced):
    Task 4 → Task 9 → Task 10 → Task 11 → Task 12 → Task 14 → Task 15

Sequential chain D — Layout.astro:
    Task 13 → Task 16

*Doc.astro tasks must be sequenced to avoid merge conflicts
```

## Verification Checklist

After all tasks are complete:

- [ ] `bun run build` succeeds without errors
- [ ] `bun format:check` passes
- [ ] Mobile (390px): landing page doesn't auto-scroll, code blocks readable, bottom nav visible, TOC works, titles don't clip
- [ ] Desktop: all features still work, no regressions
- [ ] Reading time shows on posts
- [ ] Scroll progress bar works
- [ ] Code copy button works
- [ ] Related posts appear on posts with siblings
- [ ] Share buttons work (copy, Twitter, Bluesky)
- [ ] OG images generate (`/og/posts/...`)
- [ ] RSS feeds validate (`/rss.xml`, `/rss/posts.xml`, `/rss/talks.xml`)
- [ ] Font loads without flash (or with minimal flash)
- [ ] JSON-LD structured data present in page source
