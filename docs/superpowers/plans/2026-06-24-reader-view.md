# Reader View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-page distraction-free reading toggle to all `Doc.astro` pages that hides chrome (both sidebars, post-meta, share, pagination, related posts, vim statusline, mobile nav) and centers the prose in an 80ch column, keeping the terminal aesthetic.

**Architecture:** A single boolean attribute `html[data-reader]` drives a pure-CSS overlay in `Doc.css`. A small inline script in `Doc.astro` toggles the attribute and is wired to three triggers: a `zr` vim chord, a command-palette chip in `Filter.astro`, and a `.reader-toggle` badge button rendered as a sibling of `.post-meta`. No persistence — the attribute is only ever set by explicit user action after load, so navigating starts fresh (no localStorage, no anti-FOUC head script).

**Tech Stack:** Astro 5 (static), vanilla TS in `<script>` islands, WebTUI CSS (ch/lh units only), Bun + Turborepo.

## Global Constraints

- **CSS units:** ch/lh only — never em/px/rem/% (preserves TUI aesthetic). `0` is fine unitless.
- **Prettier:** 4-space indent, no semicolons, single quotes, astro plugin. Run `bun format:check` before every commit; `bun format` to autofix.
- **Build verify:** `bun run build` from `web/` must succeed before any commit that touches build inputs.
- **Measure:** reader column = `80ch`, centered via `margin-inline: auto`.
- **Scope:** all `Doc.astro` pages (posts, talks, webtui docs). Slide decks + landing/about are excluded by construction (different layouts).
- **Commit cadence:** one logical change per commit; do not batch. No force-push.
- **No new dependencies.**

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `web/src/layouts/Doc.css` | All `html[data-reader]` visual rules | Append a reader-view CSS block |
| `web/src/layouts/Doc.astro` | Reader toggle button markup; `toggleReader()` script; `zr` chord case; `Esc`-exit branch | Modify (markup + scripts) |
| `web/src/components/Filter.astro` | Command-palette "Reader" chip + keybinds-help `zr` row | Modify (markup only; reuses delegated click) |

No new files. No test framework exists in this repo — verification is `bun run build` + Playwright/manual checks against `bun preview`, consistent with how the rest of the site is validated.

---

## Task 1: Reader-view CSS layer

Establishes the visual behavior first so later tasks (the toggle) have something to flip. After this task you can verify by manually adding `data-reader` to `<html>` in devtools.

**Files:**
- Modify: `web/src/layouts/Doc.css` (append at end of file)

**Interfaces:**
- Consumes: existing DOM ids/classes from `Doc.astro` — `#sidebar-container`, `#sidebar-resizer`, `#toc-container`, `#toc-resizer`, `#vim-statusline`, `#mobile-nav`, `.post-meta`, `#doc-pagination`, `#main-content`, and the related-posts `<aside>` inside `#main-content`.
- Produces: the `html[data-reader]` style contract that Task 2's `toggleReader()` activates, and the `.reader-toggle` class that Task 2's button uses.

- [ ] **Step 1: Confirm the target selectors exist**

Run: `grep -nE 'id="(sidebar-container|sidebar-resizer|toc-container|toc-resizer|vim-statusline|mobile-nav|doc-pagination|main-content)"|class="post-meta"' web/src/layouts/Doc.astro`
Expected: a line for each id, plus `class="post-meta"`. (The related-posts `<aside>` is matched structurally as `#main-content aside`; the TOC `<aside>` is outside `#main-content` so it is not matched by that selector.)

- [ ] **Step 2: Append the reader-view CSS block to `Doc.css`**

Add at the end of `web/src/layouts/Doc.css`:

```css
/* ── Reader view ──────────────────────────────────────────────────────
   Per-page distraction-free mode, toggled by html[data-reader] (set by
   the toggleReader() script in Doc.astro). Pure CSS overlay: hides the
   surrounding chrome and centers the prose in an 80ch column while
   keeping the article's box frame. No persistence — see the reader-view
   spec. The .reader-toggle button is a SIBLING of .post-meta, so hiding
   .post-meta never hides the exit affordance. */
html[data-reader] #sidebar-container,
html[data-reader] #sidebar-resizer,
html[data-reader] #toc-container,
html[data-reader] #toc-resizer,
html[data-reader] #vim-statusline,
html[data-reader] #mobile-nav,
html[data-reader] .post-meta,
html[data-reader] #doc-pagination,
html[data-reader] #main-content aside {
    display: none;
}

html[data-reader] #main-content {
    max-width: 80ch;
    margin-inline: auto;
}

/* Pin the toggle top-right while reading purely for placement; its
   visibility does not depend on this (it's outside .post-meta). */
html[data-reader] .reader-toggle {
    position: fixed;
    top: 1lh;
    right: 1ch;
    z-index: 5;
}
```

- [ ] **Step 3: Format check**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl && bun format:check`
Expected: `All matched files use Prettier code style!` (if it fails, run `bun format` then re-check)

- [ ] **Step 4: Build**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && bun run build`
Expected: `[build] Complete!` with no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/samforeman/projects/saforem2/sam.onl
git add web/src/layouts/Doc.css
git commit -m "feat(reader): add html[data-reader] CSS layer for Doc pages"
```

---

## Task 2: Toggle button + `toggleReader()` script + `Esc` exit

Adds the visible affordance and the core toggle, wired to the button and to `Esc`. The `zr` chord is Task 3; the palette chip is Task 4 — both call the same global toggle this task exposes.

**Files:**
- Modify: `web/src/layouts/Doc.astro` (button markup inside the `(frontmatter.date || isPost || isTalk)` meta block region — but as a sibling of `.post-meta`; new `<script>`; `Esc` branch in existing main keydown handler)

**Interfaces:**
- Consumes: `.reader-toggle` CSS class (Task 1); `#main-content` presence.
- Produces: `window.toggleReader(force?: boolean): void` — adds/removes `data-reader` on `document.documentElement`, syncs the button's `aria-pressed`. Tasks 3 and 4 call `window.toggleReader()`.

- [ ] **Step 1: Add the reader-toggle button as a sibling of `.post-meta`**

In `web/src/layouts/Doc.astro`, find the `<main id="main-content">` opening and the `<span id="toc-page-title" .../>` immediately inside it (around line 257-261). Insert the button right after that span and BEFORE the `{(frontmatter.date || isPost || isTalk) && (` meta block, so it is a sibling preceding `.post-meta`:

```astro
                        <main id="main-content">
                            <span
                                id="toc-page-title"
                                aria-hidden="true"
                                tabindex="-1"></span>
                            <button
                                type="button"
                                class="reader-toggle"
                                is-="badge"
                                variant-="background2"
                                aria-pressed="false"
                                title="Toggle reader view (zr)"
                                aria-label="Toggle reader view">
                                &#xf02d;
                            </button>
```

(`&#xf02d;` is the Nerd Font "book" glyph; the Symbols Nerd Font is already loaded site-wide. If it renders as tofu during Step 6 verification, swap to `&#xf518;` and re-verify.)

- [ ] **Step 2: Add the `toggleReader` script near the end of `Doc.astro`**

Append a new `<script>` block after the existing scripts in `Doc.astro` (after the closing `</script>` of the Sidebar-Toggle block, before end of file):

```astro
<!-- Reader View -->
<script>
    const root = document.documentElement
    const readerBtn = document.querySelector('.reader-toggle')

    const syncReaderButton = () => {
        if (!(readerBtn instanceof HTMLElement)) return
        const on = root.hasAttribute('data-reader')
        readerBtn.setAttribute('aria-pressed', String(on))
    }

    // Exposed on window so the command-palette chip (Filter.astro) and
    // the zr chord (Sidebar-Toggle script) can call the same toggle.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).toggleReader = (force?: boolean) => {
        const next = force === undefined ? !root.hasAttribute('data-reader') : force
        if (next) {
            root.setAttribute('data-reader', '')
        } else {
            root.removeAttribute('data-reader')
        }
        syncReaderButton()
    }

    readerBtn?.addEventListener('click', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).toggleReader()
    })
</script>
```

- [ ] **Step 3: Make `Esc` exit reader view**

In `Doc.astro`, find the existing `Esc` branch in the main vim keydown handler (the block beginning `// Esc — unfocus the currently focused element`, around line 1043). Add a reader-exit check at the TOP of that branch so `Esc` exits reader mode before falling through to blur logic:

```javascript
        // Esc — exit reader view first if active, else unfocus.
        if (
            e.key === 'Escape' &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !e.shiftKey
        ) {
            if (document.documentElement.hasAttribute('data-reader')) {
                e.preventDefault()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(window as any).toggleReader(false)
                return
            }
            const active = document.activeElement
            if (
                active instanceof HTMLElement &&
                active !== document.body &&
                active !== document.documentElement
            ) {
                e.preventDefault()
                active.blur()
                return
            }
        }
```

(This replaces the existing `Esc` branch — same blur logic, with the reader-exit check prepended.)

- [ ] **Step 4: Format check**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl && bun format:check`
Expected: clean (run `bun format` if not).

- [ ] **Step 5: Build**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && bun run build`
Expected: `[build] Complete!`

- [ ] **Step 6: Verify in browser**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && (bun run preview --port 4399 &) && sleep 3`
Then drive Playwright (or open manually) at `http://localhost:4399/posts/2025/04/28/`:
- Click the reader-toggle badge → `<html>` gains `data-reader`; sidebars, post-meta, pagination, statusline vanish; `#main-content` computed `max-width` ≈ 80ch and is centered; the article box frame remains; the toggle button stays visible (pinned top-right).
- Press `Esc` → `data-reader` removed; normal layout returns.
- Confirm the book glyph renders (not tofu); if tofu, switch to `&#xf518;` (Step 1), rebuild, re-verify.

Stop preview when done: `pkill -f "port 4399"`

- [ ] **Step 7: Commit**

```bash
cd /Users/samforeman/projects/saforem2/sam.onl
git add web/src/layouts/Doc.astro
git commit -m "feat(reader): toggle button, toggleReader(), Esc-to-exit"
```

---

## Task 3: `zr` vim chord

Wires the `zr` chord into the existing z-chord handler so it calls `window.toggleReader()`.

**Files:**
- Modify: `web/src/layouts/Doc.astro` (the Sidebar-Toggle `<script>`'s z-chord branch, where `zh`/`zl`/`zj`/`zk`/`zM`/`zR` are handled, around lines 1635-1691)

**Interfaces:**
- Consumes: `window.toggleReader()` (Task 2); the existing `hasPendingZChord` logic.
- Produces: nothing new — terminal binding.

- [ ] **Step 1: Locate the z-chord plain-key branch**

Run: `grep -n "hasPendingZChord\|if (e.key === 'h')\|if (e.key === 'l')\|if (e.key === 'j')" web/src/layouts/Doc.astro | head`
Expected: the `if (hasPendingZChord) {` block containing `if (e.key === 'h')`, `'l'`, `'j'`, `'k'` cases (around line 1635+).

- [ ] **Step 2: Add the `r` case inside the `hasPendingZChord` block**

In `Doc.astro`, inside `if (hasPendingZChord) {`, add an `r` case alongside the existing `h`/`l`/`j`/`k` cases (place it after the `k` case, before the `M`/`R` cases):

```javascript
                    if (e.key === 'r') {
                        e.preventDefault()
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ;(window as any).toggleReader()
                        return
                    }
```

- [ ] **Step 3: Format check**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl && bun format:check`
Expected: clean.

- [ ] **Step 4: Build**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && bun run build`
Expected: `[build] Complete!`

- [ ] **Step 5: Verify the chord**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && (bun run preview --port 4399 &) && sleep 3`
At `http://localhost:4399/posts/2025/04/28/` with body focused (click empty area first): press `z` then `r` within the chord window → reader view toggles on; `zr` again → off. Confirm `zh`/`zl` still toggle sidebars (no regression).
Stop: `pkill -f "port 4399"`

- [ ] **Step 6: Commit**

```bash
cd /Users/samforeman/projects/saforem2/sam.onl
git add web/src/layouts/Doc.astro
git commit -m "feat(reader): zr chord toggles reader view"
```

---

## Task 4: Command-palette chip + keybinds-help row

Adds a "Reader" chip to the command palette and documents `zr` in the keybinds help. The chip reuses a delegated click handler (no new per-button wiring needed beyond the delegation).

**Files:**
- Modify: `web/src/components/Filter.astro` (new `command-section` markup after the Font section ~line 117; `zr` row in the Layout keybind-group ~line 154; one delegated click handler in the `<script>` ~line 939)

**Interfaces:**
- Consumes: `window.toggleReader()` (Task 2); `commandDialog` reference (already defined in Filter.astro's script).
- Produces: nothing new — terminal task.

- [ ] **Step 1: Add the Reader command-palette section**

In `web/src/components/Filter.astro`, after the closing `</section>` of `command-section-font` (the Font section ends ~line 117) and before `<section class="command-section command-section-keys">`, insert:

```astro
            <section class="command-section command-section-reader">
                <span is-="badge" class="command-section-title cmd-title-green"
                    >&#xf02d; <u>R</u>eader</span
                >
                <row class="command-theme-buttons" gap-="0">
                    <button
                        data-reader-toggle="true"
                        class="command-theme-chip">
                        Toggle reader view
                    </button>
                </row>
            </section>
```

- [ ] **Step 2: Add a `zr` row to the keybinds-help "Layout" group**

In the `keybind-group` whose title is `Layout` (the `<code>&lt;zh&gt; / &lt;zl&gt;</code>` grid, ~line 153-166), add a row. Insert after the `<span>Toggle left/right sidebar</span>` pair:

```astro
                            <code role="listitem">&lt;zr&gt;</code>
                            <span>Toggle reader view</span>
```

- [ ] **Step 3: Wire the chip via a delegated click handler**

In Filter.astro's `<script>`, after the font delegated-click handler (the block ending at line ~939, `if (v) setMonoFont(v)`), append:

```javascript
    // ── Reader view chip ──────────────────────────────────────────────
    // Delegated click; the actual toggle lives in Doc.astro (window.toggleReader).
    // Closes the command dialog on activation, matching theme/font chips.
    document.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement)?.closest?.(
            '[data-reader-toggle]',
        ) as HTMLElement | null
        if (!btn) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = (window as any).toggleReader
        if (typeof fn === 'function') fn()
        commandDialog.close()
    })
```

- [ ] **Step 4: Format check**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl && bun format:check`
Expected: clean.

- [ ] **Step 5: Build**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && bun run build`
Expected: `[build] Complete!`

- [ ] **Step 6: Verify the palette path**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && (bun run preview --port 4399 &) && sleep 3`
At `http://localhost:4399/posts/2025/04/28/`: open the command palette (Ctrl+P or `:`), click "Toggle reader view" → palette closes AND reader view turns on. Open palette again, toggle again → off. Open `?` keybinds help → confirm the `zr` / "Toggle reader view" row shows under Layout.
Stop: `pkill -f "port 4399"`

- [ ] **Step 7: Commit**

```bash
cd /Users/samforeman/projects/saforem2/sam.onl
git add web/src/components/Filter.astro
git commit -m "feat(reader): command-palette chip + zr keybind help row"
```

---

## Task 5: Cross-page + regression verification

A pure verification task — no code — that exercises the full feature across page types and the documented edge cases before declaring done.

**Files:** none (verification only).

- [ ] **Step 1: Build + preview**

Run: `cd /Users/samforeman/projects/saforem2/sam.onl/web && bun run build && (bun run preview --port 4399 &) && sleep 3`
Expected: build completes; preview serves.

- [ ] **Step 2: Verify across page types**

For each URL, toggle reader view (button, `zr`, and palette) and confirm chrome hides + prose centers at 80ch + box frame remains + toggle stays reachable + `Esc`/`zr` exits:
- Post: `http://localhost:4399/posts/2025/04/28/`
- Talk (prose): `http://localhost:4399/talks/2025/10/08/`
- WebTUI doc: `http://localhost:4399/webtui/components/button/`

- [ ] **Step 3: Verify per-page reset (no persistence)**

Enable reader view on the post, then navigate (click a link or change URL) to another post → confirm it loads in NORMAL view (no `data-reader`). Confirms no localStorage leakage.

- [ ] **Step 4: Verify no regressions**

- `zh` / `zl` still toggle the sidebars; exiting reader view restores prior sidebar-collapse state.
- With reader view ON, `j`/`k` vim nav skips the hidden regions (focus never lands in a hidden sidebar/meta).
- Mobile viewport (resize to 390px): meta, statusline, mobile-nav hidden; prose readable full-width.
- Slide deck is unaffected: `http://localhost:4399/talks/2026/06/03/#1` has no reader button and `zr` does nothing.

- [ ] **Step 5: Stop preview**

Run: `pkill -f "port 4399"`

- [ ] **Step 6: Push**

```bash
cd /Users/samforeman/projects/saforem2/sam.onl
git push origin main
```

---

## Self-Review notes

- **Spec coverage:** CSS layer (Task 1) ↔ spec §5; button (Task 2) ↔ §4; toggle script + Esc (Task 2) ↔ §2; `zr` (Task 3) ↔ §2 trigger; palette + help (Task 4) ↔ §3 + files table; edge cases (Task 5) ↔ spec "Edge cases". All spec sections map to a task.
- **No persistence:** confirmed — no localStorage anywhere; Task 5 Step 3 explicitly tests reset-on-navigate.
- **Name consistency:** `window.toggleReader(force?)`, `.reader-toggle`, `data-reader`, `data-reader-toggle` used identically across Tasks 2/3/4.
- **Glyph caveat:** `&#xf02d;` with a `&#xf518;` fallback, decided at first visual check (Task 2 Step 6) and reused in the palette (Task 4 Step 1 uses `&#xf02d;` to match — if swapped, swap both).
