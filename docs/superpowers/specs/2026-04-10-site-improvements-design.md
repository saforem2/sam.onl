# sam.onl Site Improvements — Design Spec

## Context

The site (sam.onl) is an Astro 5.x static site with a custom WebTUI terminal-aesthetic design system. It has 58+ blog posts, 16+ talks, and a bento-grid landing page (variant 21). The site works well on desktop but has significant mobile/responsive issues, and is missing several reading experience, performance, and engagement features.

This spec covers 4 independent improvement projects that can be executed in parallel where file dependencies allow.

---

## Project 1: Mobile/Responsive Fixes

### 1.1 Landing page auto-scrolls to About widget on load

**Root cause:** `Intro.astro:306` unconditionally calls `vimFocusElement(intro)` on page load. `vimFocusElement()` in `vim.ts:120,126` calls `scrollIntoView()`, which scrolls past the navbar on mobile.

**Fix:** Guard the focus call with a viewport width check. On viewports < 768px, either skip the call entirely or use `focus({ preventScroll: true })` instead of `vimFocusElement()`.

**Files:** `web/src/components/landing/sections/Intro.astro`, `web/src/utils/vim.ts`

### 1.2 Code block font size enormous on mobile

**Root cause:** `global.css:252-258` sets code font-size to `var(--font-size)` (16px). The 480px media query in `global.css:486-507` sets `--font-size: 16px` but provides no smaller override for code blocks.

**Fix:** Add a mobile override for code blocks:
```css
@media (max-width: 768px) {
  pre.astro-code, pre.astro-code code {
    font-size: clamp(0.7rem, 2.5vw, 0.9rem);
  }
}
```

**Files:** `web/src/styles/global.css`

### 1.3 Bottom nav (Menu/Docs/TOC) hidden below fold

**Root cause:** `Doc.css:471-476` — `#scroll-container` has `height: auto`, so content pushes the mobile nav buttons below the viewport.

**Fix:** Make `#mobile-nav` `position: fixed` at the bottom of the viewport on mobile, and add corresponding bottom padding to the scroll container so content isn't hidden behind it.

**Files:** `web/src/layouts/Doc.css`

### 1.4 TOC opens blank on mobile

**Root cause:** `Doc.astro:165` — TOC starts with both `mobile-hidden` and `collapsed` classes. The mobile nav toggle (`Doc.astro:1322-1324`) only removes `mobile-hidden` but leaves `collapsed`, so `#toc-list-container` stays `display: none` per `Doc.css:202`.

**Fix:** When the mobile TOC button is clicked, also remove the `collapsed` class from `#toc-container`. When switching away from TOC, re-add `collapsed`.

**Files:** `web/src/layouts/Doc.astro`, `web/src/layouts/Doc.css`

### 1.5 Post titles truncated in tables

**Root cause:** The posts table doesn't allow text wrapping on the title column.

**Fix:** Allow wrapping on the title column, or use `text-overflow: ellipsis` with a tooltip showing the full title on hover/tap.

**Files:** `web/src/components/landing/widgets/PostsWidget.astro` or `web/src/pages/posts/index.mdx` (depending on which table)

### 1.6 Navbar bracket hints waste mobile space

**Root cause:** The `[ h ]`, `[ p ]`, `[ t ]` keyboard shortcut notation takes ~50% of horizontal space on a 390px screen.

**Fix:** Hide the bracket/shortcut notation on mobile (`max-width: 768px`), showing only the text labels or icons.

**Files:** `web/src/components/Navbar.astro` or `web/src/components/NavbarMinimal.astro`

### 1.7 Sidebar breakpoint too wide (120ch)

**Root cause:** `Doc.css:634` uses `max-width: 120ch` (~1440px) for the mobile breakpoint. Even tablets get collapsed layout.

**Fix:** Change to `max-width: 768px` or `max-width: 80ch` so the sidebar shows on tablets in landscape.

**Files:** `web/src/layouts/Doc.css`

### 1.8 No responsive typography

**Root cause:** Font sizes are fixed throughout. No `clamp()` usage for fluid typography.

**Fix:** Add `clamp()` for key elements:
- Body: `font-size: clamp(0.875rem, 1vw + 0.5rem, 1rem)`
- H1: `font-size: clamp(1.5rem, 3vw + 0.5rem, 2rem)`
- H2: `font-size: clamp(1.25rem, 2.5vw + 0.5rem, 1.75rem)`
- H3: `font-size: clamp(1.1rem, 2vw + 0.5rem, 1.5rem)`

**Files:** `web/src/styles/global.css`

---

## Project 2: Reading Experience

### 2.1 Estimated reading time

Add reading time to post headers. Calculate from word count at build time (Astro can do this in the layout). Display as "X min read" next to the date.

**Approach:** Create a `readingTime()` utility that counts words in the raw MDX content and divides by 200 WPM. Call it in `Doc.astro` layout and display in the post header.

**Files:** `web/src/utils/readingTime.ts` (new), `web/src/layouts/Doc.astro`

### 2.2 Scroll progress indicator

Add a thin progress bar at the top of the page (or below the navbar) that fills as the user scrolls through a post.

**Approach:** CSS-only if possible using `animation-timeline: scroll()`, or a lightweight JS scroll listener that updates a CSS custom property on a fixed-position bar.

**Files:** `web/src/layouts/Doc.astro` or `web/src/layouts/Doc.css`

### 2.3 Better code blocks

- **Copy button:** Add a "copy" button to each code block. Astro's Shiki integration doesn't include one by default.
- **Filename labels:** If a code block has a meta string like `title="config.ts"`, display it as a label above the block.
- **Mobile sizing:** Covered by Project 1, issue 1.2.

**Approach:** Add a rehype plugin or client-side script that injects a copy button into each `pre.astro-code` element. For filename labels, parse the `data-language` or custom attributes.

**Files:** `web/src/styles/global.css` (copy button styles), `web/src/layouts/Layout.astro` (client script or rehype plugin in `astro.config.mjs`)

### 2.4 Related posts

Show 2-3 related posts at the bottom of each blog post. Relate by shared directory path (e.g., all posts under `/posts/auroragpt/` are related) or by frontmatter tags if/when added.

**Approach:** At build time in `Doc.astro`, find posts in the same parent directory. Display as a simple list with title, date, and link.

**Files:** `web/src/layouts/Doc.astro`, `web/src/utils/content.ts`

---

## Project 3: Performance & SEO

### 3.1 Investigate slow initial load

Profile the landing page to identify bottlenecks. Likely culprits:
- Last.fm API fetch (Player widget) blocking render
- Mermaid JS bundle loaded on every page
- Large CSS bundle from WebTUI packages
- Widget grid complexity

**Approach:** Run Lighthouse audit, check network waterfall, identify largest resources. Defer non-critical JS (Last.fm fetch, Mermaid) with `async`/`defer` or only load on pages that need them.

**Files:** `web/src/layouts/Layout.astro`, `web/astro.config.mjs`, widget components

### 3.2 Font loading flash (FOUT)

Iosevka loads from Google Fonts / self-hosted, causing a flash of fallback font.

**Approach:**
- Add `<link rel="preload">` for the primary font files
- Use `font-display: swap` (likely already set by Google Fonts, but verify)
- Consider `font-display: optional` if the flash is worse than missing the custom font on slow connections
- Subset the font to only needed characters if self-hosted

**Files:** `web/src/layouts/Layout.astro` (head section)

### 3.3 SEO improvements

- **Structured data:** Add JSON-LD for `Article` schema on blog posts and `Person` schema on the about page
- **Meta descriptions:** Ensure each post has a `description` in frontmatter, used in `<meta name="description">`
- **Canonical URLs:** Verify canonical tags point to `sam.onl` (not legacy `samforeman.me`)

**Files:** `web/src/layouts/Layout.astro`, `web/src/layouts/Doc.astro`

---

## Project 4: Engagement

### 4.1 Auto-generated OG images

Generate unique Open Graph images per post with the title, date, and site branding.

**Approach:** Use `satori` + `resvg-js` to generate SVG → PNG at build time. Create an Astro endpoint that renders the OG image for each post. Store generated images in the build output.

**Files:** `web/src/pages/og/[...slug].png.ts` (new), `web/src/layouts/Layout.astro` (og:image meta tag)

### 4.2 Share buttons

Add share buttons to blog posts: copy link, share to Twitter/X, share to Bluesky.

**Approach:** Simple client-side buttons using `navigator.clipboard.writeText()` for copy, and `window.open()` with pre-filled share URLs for Twitter/Bluesky. No external dependencies needed.

**Files:** `web/src/components/ShareButtons.astro` (new), `web/src/layouts/Doc.astro`

### 4.3 Better RSS

- Full-content RSS (include post body, not just excerpts)
- Per-category feeds (e.g., `/rss/posts.xml`, `/rss/talks.xml`)

**Approach:** Modify the existing RSS endpoint to include full HTML content. Add additional endpoints for category feeds.

**Files:** `web/src/pages/rss.xml.ts`, `web/src/pages/rss/posts.xml.ts` (new), `web/src/pages/rss/talks.xml.ts` (new)

---

## File Dependency Map

Projects that touch the same files must be sequenced, not parallelized:

| File | Projects |
|------|----------|
| `web/src/layouts/Doc.astro` | 1 (TOC, bottom nav), 2 (reading time, related posts, code blocks), 3 (SEO) |
| `web/src/layouts/Doc.css` | 1 (bottom nav, TOC, sidebar breakpoint) |
| `web/src/styles/global.css` | 1 (code font, typography), 2 (code block styles) |
| `web/src/layouts/Layout.astro` | 2 (code block script), 3 (font preload, SEO) |

**Safe to parallelize:**
- Project 4 (engagement) is fully independent — new files only
- Within Project 1: issues 1.1 (Intro.astro), 1.5 (PostsWidget), 1.6 (Navbar) touch unique files
- Within Project 2: reading time utility (new file) can be built independently

**Must be sequential:**
- Project 1 CSS changes (1.2, 1.3, 1.4, 1.7, 1.8) all touch Doc.css or global.css
- Projects 1, 2, 3 all modify Doc.astro — should be done in sequence

---

## Verification

After implementation, verify each project:

1. **Mobile fixes:** Test on 390px viewport (iPhone 15 Pro) in browser DevTools. Check: no auto-scroll on landing, code font readable, bottom nav visible, TOC opens with content, titles wrap, navbar compact.
2. **Reading experience:** Check reading time displays on a post, copy button works on code blocks, related posts appear at bottom.
3. **Performance:** Run Lighthouse on landing page, verify font preload in network tab, check JSON-LD in page source.
4. **Engagement:** Verify OG image generates (`/og/posts/2026/01/07.png`), share buttons work, RSS feeds validate.
5. **Cross-cutting:** Run `bun run build` successfully, `bun format:check` passes, test on both desktop and mobile viewports.
