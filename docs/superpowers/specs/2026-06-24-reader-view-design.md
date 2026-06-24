# Reader View — Design

**Date:** 2026-06-24
**Status:** Approved, pending implementation
**Scope:** Distraction-free reading toggle for all `Doc.astro` pages (posts, talks, webtui docs)

## Goal

Add a distraction-free reading mode to long-form pages. When active, it hides
the surrounding chrome (both sidebars, post metadata, share buttons, pagination,
related posts, vim statusline, mobile nav) and constrains the prose to a
comfortable centered reading measure — while preserving the terminal aesthetic
(the article's `box-="square"` frame stays).

It stays on the same page (no separate route), keeps the existing visual
language, and reuses the site's established control patterns (keybind +
command palette + a meta-row badge).

## Decisions (from brainstorming)

| Question | Decision |
| --- | --- |
| Core intent | Distraction-free reading (declutter layout, keep aesthetic) |
| Trigger | All three: `zr` keybind, command-palette entry, meta-row badge button |
| Layout when ON | Hide both sidebars; narrow (80ch) centered column; hide post-meta + share + pagination + related; hide vim statusline |
| Persistence | **Per-page, resets on navigate** — no localStorage, no anti-FOUC head script |
| Scope | All `Doc.astro` pages (posts, talks, webtui docs). NOT slide decks, NOT landing/about |
| Keybind | `zr` chord (fits `zh`/`zl` family); `Esc` also exits |
| Article frame | Keep the `box-="square"` border in reader mode |

## Approach

**Chosen: `data-reader` attribute on `<html>` + a CSS layer.**

A small script toggles `html[data-reader]`. All hiding/narrowing lives in CSS in
`Doc.css`. Turning reader mode off just removes the attribute, so the normal
layout — including whatever sidebar-collapse state the user already had —
reasserts itself with zero state juggling.

Rejected alternatives:
- **Reuse the existing collapse functions** (`setSidebarCollapsed`,
  `setTocCollapsed`): they persist to localStorage, so reader mode would clobber
  the user's manual sidebar prefs and require save/restore on exit. More moving
  parts, no upside.
- **Separate clean stylesheet/route:** overkill; violates the "same page"
  requirement.

## Why per-page is simpler than theme/font

The theme and font pickers persist to localStorage and need an inline head
script to set the attribute before first paint (avoiding a flash). Reader view
is **per-page / resets on navigate**, so:
- No localStorage key.
- No anti-FOUC head script — the page always loads in normal view; the attribute
  is only ever set by an explicit user action after load.
- Navigating to another post naturally starts in normal view (fresh document).

## Component / behavior breakdown

### 1. State carrier — `html[data-reader]`

A single boolean attribute on `document.documentElement`. Present = reader mode
on. Set/removed by the toggle function. No value needed.

### 2. Toggle function (Doc.astro `<script>`)

One function `toggleReader(force?: boolean)`:
- Adds/removes `data-reader` on `<html>`.
- Updates the badge button's `aria-pressed` + label/icon.
- That's it — CSS does the rest.

Wired to three call sites:
- **`zr` chord:** extend the existing z-chord handler in the Sidebar-Toggle
  script (which already handles `zh`, `zl`, `zj`, `zk`, `zM`, `zR`). Add an `r`
  case that calls `toggleReader()`.
- **`Esc`:** in the main keydown handler, if `data-reader` is set and no
  element is focused / no dialog open, exit reader mode (before the existing
  blur-active-element branch, or coordinated with it).
- **Badge button click.**

### 3. Command-palette entry (Filter.astro)

A new `command-section` (or a single chip in an existing row) labeled
"Reader" with an underlined access key, mirroring the Theme/Font sections.
Clicking it calls the same toggle. The palette dialog closes on activation
(matching theme/font behavior).

### 4. Badge button (Doc.astro)

A `<button is-="badge" variant-="background2" class="reader-toggle">` rendered
**just outside `.post-meta`** (as a sibling, immediately before or after it),
NOT inside `.post-meta-links`. Rationale: the reader CSS hides the whole
`.post-meta` block, so a button living inside it would disappear in reader mode.
Keeping it a sibling means it survives the hide with no `display: contents`
hack or fixed-position lift — it simply renders in normal flow at the top of the
article in both states. Icon: a reader/book glyph (Nerd Font, final codepoint
chosen during implementation against the font's coverage). `aria-pressed`
reflects state.

In reader mode the button is the visible exit affordance (belt-and-suspenders
with `zr` + `Esc`). It may be lightly repositioned in reader mode (e.g. pinned
top-right) purely for placement, but reachability does not depend on that.

### 5. Reader CSS layer (Doc.css)

All gated under `html[data-reader]`:

```css
html[data-reader] #sidebar-container,
html[data-reader] #sidebar-resizer,
html[data-reader] #toc-container,
html[data-reader] #toc-resizer,
html[data-reader] #vim-statusline,
html[data-reader] #mobile-nav,
html[data-reader] .post-meta,            /* author/date/reading-time/tags + links + share */
html[data-reader] #doc-pagination,
html[data-reader] #main-content aside    /* related posts */ {
    display: none;
}

html[data-reader] #main-content {
    max-width: 80ch;
    margin-inline: auto;
}

/* reader toggle is a sibling of .post-meta, so it survives the hide
   automatically. Optionally pin it for placement (not for reachability): */
html[data-reader] .reader-toggle {
    position: fixed;
    top: 1lh;
    right: 1ch;
    z-index: 5;
}
```

Selectors confirmed against the real DOM (Doc.astro): there are two
`.post-meta-row` divs — author/date/reading-time/tags, and links/share — both
inside `.post-meta`; the share buttons live in the second row. Related posts are
an `<aside>` inside `#main-content` (the TOC `<aside>` is outside `#main-content`,
so `#main-content aside` scopes only to related posts). The reader button is
rendered as a sibling of `.post-meta`, so hiding `.post-meta` never hides it.

## Edge cases

- **Mobile:** sidebars already hidden by responsive CSS; reader additionally
  drops `#mobile-nav`, `#vim-statusline`, and the meta. Centered 80ch column is
  a no-op when viewport < 80ch (it just fills width). Fine.
- **Vim navigation:** hidden elements are `display: none`, which the existing
  `isVimVisible()` check already filters out — j/k navigation automatically
  skips them. No vim changes needed beyond adding the `zr` binding.
- **Exiting:** removing `data-reader` restores the user's persisted
  sidebar/TOC collapse state automatically (those are driven by their own
  classes + localStorage, untouched by reader mode).
- **TOC border-label scroll effect:** the script that writes the active heading
  into the article border keys off `#toc-list` links; with the TOC hidden the
  links still exist in the DOM, so the effect keeps working (or is harmlessly
  inert). No change required.
- **All Doc pages (posts, talks, webtui docs):** the toggle is offered
  everywhere `Doc.astro` renders — no `isPost`/`isTalk` gating. They're all
  long-form prose, so reader view applies uniformly. Slide decks (separate
  presentation layout) and landing/about (widget pages, not Doc.astro) are
  excluded by construction.

## Files touched

| File | Change |
| --- | --- |
| `web/src/layouts/Doc.astro` | Reader badge button in `.post-meta-links`; `toggleReader()` script; `zr` chord case; `Esc`-exits branch |
| `web/src/layouts/Doc.css` | `html[data-reader]` rule block |
| `web/src/components/Filter.astro` | "Reader" command-palette entry wired to the toggle |
| Keybinds help list (in `Filter.astro` keybinds section) | Document `zr` → toggle reader view |

## Testing / verification

- Toggle on/off via all three triggers (keybind, palette, button); confirm
  `data-reader` flips and layout responds.
- Confirm both sidebars, meta, share, pagination, related, statusline,
  mobile-nav all vanish; prose centers at 80ch; article frame remains.
- Confirm the reader toggle button stays visible + clickable while in reader
  mode.
- Confirm `Esc` and `zr` exit.
- Navigate to another post → confirm it starts in normal view (no persistence).
- Confirm vim j/k skips hidden regions.
- Mobile viewport: confirm meta/statusline/mobile-nav hidden, prose readable.
- `bun run build` clean; `bun format:check` clean.

## Out of scope (YAGNI)

- Typographic retypeset (serif font, larger size) — explicitly not chosen.
- Persistence across navigation.
- Reader view on slide decks or landing/about pages.
- Print/PDF export (separate concern).
