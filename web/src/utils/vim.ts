// If the user is typing in an input, textarea, select, or contenteditable element
export function isUserTyping() {
    return (
        document.activeElement &&
        (/input|textarea|select/i.test(document.activeElement.tagName) ||
            document.activeElement.hasAttribute('contenteditable'))
    )
}

// Recursively gets the first text node from a DOM element
function getFirstTextNode(element: Node | null): Node | null {
    if (!element) return null

    if (element.nodeType === Node.TEXT_NODE) {
        return element
    }

    return getFirstTextNode(element.firstChild)
}

let vimHighlightRange: Range | null = null
let vimHighlightVisible = true
let vimBlinkIntervalId: number | null = null
let vimFocusedElement: HTMLElement | null = null

function setVimFocusedElement(element: HTMLElement) {
    if (vimFocusedElement && vimFocusedElement !== element) {
        vimFocusedElement.removeAttribute('data-vim-focused')
    }

    vimFocusedElement = element
    vimFocusedElement.setAttribute('data-vim-focused', 'true')
}

function stopVimCursorBlink() {
    if (vimBlinkIntervalId !== null) {
        window.clearInterval(vimBlinkIntervalId)
        vimBlinkIntervalId = null
    }
}

function renderVimHighlight() {
    if (!vimHighlightRange || !vimHighlightVisible) {
        CSS.highlights.delete('vim')
        return
    }

    CSS.highlights.set('vim', new Highlight(vimHighlightRange))
}

function clearVimCursorHighlight() {
    vimHighlightRange = null
    stopVimCursorBlink()
    CSS.highlights.delete('vim')
}

function startVimCursorBlink() {
    stopVimCursorBlink()

    vimBlinkIntervalId = window.setInterval(() => {
        if (!vimHighlightRange) {
            clearVimCursorHighlight()
            return
        }

        vimHighlightVisible = !vimHighlightVisible
        renderVimHighlight()
    }, 500)
}

// Applies the ::highlight(vim) CSS pseudo-class to an element
export function applyVimCursorHighlight(element: HTMLElement) {
    const firstChild = element.firstChild

    if (!firstChild) {
        clearVimCursorHighlight()
        return
    }

    const textNode = getFirstTextNode(firstChild)

    if (!textNode) {
        clearVimCursorHighlight()
        return
    }

    if (
        typeof textNode?.textContent !== 'string' ||
        textNode.textContent.trim() === ''
    ) {
        clearVimCursorHighlight()
        return
    }

    const firstNonWhitespace =
        textNode.textContent?.split('').findIndex((c) => !/\s/.test(c)) ?? 0

    const range = new Range()
    range.setStart(textNode, firstNonWhitespace)
    range.setEnd(textNode, firstNonWhitespace + 1)

    /* Match the cursor block's background to the focused element's
       own color (link tint, etc.) instead of always painting it
       foreground0. ::highlight(vim) can't inherit per-range so we
       publish the values as CSS vars on :root and let the highlight
       pseudo-rule read them. */
    setVimCursorColorsFromElement(element)

    vimHighlightRange = range
    vimHighlightVisible = true
    renderVimHighlight()
    startVimCursorBlink()
}

function setVimCursorColorsFromElement(element: HTMLElement) {
    const root = getComputedStyle(document.documentElement)

    // Terminal reverse-video — but read both colors STRAIGHT FROM
    // the browser's computed styles rather than tracking CSS-variable
    // cascades. Whatever the focused element is *actually painted in*
    // (after all the hover/focus/inherited rules resolve) is exactly
    // what we want to invert for the cursor block.
    //
    // The cursor block paints in the element's effective background
    // color (so when the user hovers a green-tinted spotify chip,
    // the cursor block goes green; when a purple github chip, purple;
    // etc.). The cursor character is the element's text color (which
    // already contrasts against that background by definition — the
    // chip's hover rule made it so).
    //
    // This sidesteps every CSS-variable / @layer / specificity puzzle
    // we'd otherwise have to thread — the browser already did the
    // work, we just read the answer.
    const cs = getComputedStyle(element)
    const pageBg = root.getPropertyValue('--background0').trim() || '#fff'
    const text =
        cs.color || root.getPropertyValue('--foreground0').trim() || '#000'

    // Two cases:
    //  1. Element has its OWN painted background (a chip with a hover
    //     tint, a callout, etc.) — cursor block = chip's bg, character
    //     = chip's text color. Reads as a translucent flash on the
    //     chip's own surface.
    //  2. Element has NO own bg (a plain prose link inside a <p>) —
    //     cursor block in the element's bg would be invisible against
    //     the (resolved) page bg. Flip: cursor block = element's text
    //     color (which DOES contrast with the page), character = page
    //     bg. Reads as inverted text.
    const ownBg = cs.backgroundColor
    const hasOwnBg =
        ownBg && ownBg !== 'transparent' && !/rgba?\(.*,\s*0\s*\)/.test(ownBg)

    const bg = hasOwnBg ? ownBg : text
    const fg = hasOwnBg ? text : pageBg

    document.documentElement.style.setProperty('--vim-cursor-bg', bg)
    document.documentElement.style.setProperty('--vim-cursor-fg', fg)
}

/** Walk parents until we find a background-color that's actually
 *  rendered (non-transparent, non-zero alpha). Returns the css color
 *  string or null if everything up to <html> is transparent. */
function resolveEffectiveBackground(element: HTMLElement): string | null {
    let cur: HTMLElement | null = element
    while (cur && cur !== document.documentElement) {
        const bg = getComputedStyle(cur).backgroundColor
        // Match `rgba(…, 0)` and `transparent`; everything else counts.
        if (bg && bg !== 'transparent' && !/rgba?\(.*,\s*0\)/.test(bg)) {
            return bg
        }
        cur = cur.parentElement
    }
    return null
}

export function vimFocusElement(element: HTMLElement) {
    element.focus()

    if (document.activeElement === element) {
        setVimFocusedElement(element)
    }

    // Temporarily disable scroll-snap so scrollIntoView doesn't fight
    // with mandatory snap points
    const scrollContainer = element.closest('main')
    if (scrollContainer) {
        scrollContainer.style.scrollSnapType = 'none'
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        // Re-enable snap after the browser has finished the scroll
        requestAnimationFrame(() => {
            scrollContainer.style.scrollSnapType = ''
        })
    } else {
        element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    applyVimCursorHighlight(element)
}

// Adds vim-like navigation to an element
export function applyVimNavigation(
    element: HTMLElement,
    queryString: string,
    onElementFocus?: (element: HTMLElement) => void,
) {
    let lastZKeyAt = 0

    const isElementVisible = (candidate: HTMLElement) => {
        if (candidate.hidden) return false

        const closedDetails = candidate.closest('details:not([open])')
        if (closedDetails instanceof HTMLDetailsElement) {
            const summary =
                closedDetails.firstElementChild instanceof HTMLElement &&
                closedDetails.firstElementChild.tagName === 'SUMMARY'
                    ? closedDetails.firstElementChild
                    : closedDetails.querySelector('summary')

            if (
                !(summary instanceof HTMLElement) ||
                (summary !== candidate && !summary.contains(candidate))
            ) {
                return false
            }
        }

        const style = window.getComputedStyle(candidate)
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false
        }

        return candidate.getClientRects().length > 0
    }

    function reattachTabbableElements() {
        const vimTabbableElements = Array.from(
            element.querySelectorAll(queryString) as NodeListOf<HTMLElement>,
        ).filter(isElementVisible)

        for (const el of vimTabbableElements) {
            el.onfocus = (e: FocusEvent) => {
                // Only handle direct focus, not bubbled focus from children
                if (e.target !== el) return
                vimFocusElement(el)
                onElementFocus?.(el)
            }
        }

        return vimTabbableElements
    }

    const focusFromIndex = (
        elements: HTMLElement[],
        startIndex: number,
        direction: 1 | -1,
    ) => {
        // Disable scroll-snap before focusing to prevent mandatory snap
        // from fighting with the focus scroll
        const scrollContainer = element.closest('main') ?? element
        const prevSnap = scrollContainer.style.scrollSnapType
        scrollContainer.style.scrollSnapType = 'none'

        for (
            let index = startIndex;
            index >= 0 && index < elements.length;
            index += direction
        ) {
            const candidate = elements[index]
            candidate.focus()

            if (document.activeElement === candidate) {
                candidate.scrollIntoView({
                    block: 'nearest',
                    inline: 'nearest',
                })
                requestAnimationFrame(() => {
                    scrollContainer.style.scrollSnapType = prevSnap
                })
                return candidate
            }
        }

        scrollContainer.style.scrollSnapType = prevSnap
        return null
    }

    // Find the index of the first element that is within (or nearest after)
    // the current viewport, so j/k start from the visible region rather
    // than from DOM index 0.
    const findFirstViewportIndex = (elements: HTMLElement[]) => {
        for (let i = 0; i < elements.length; i++) {
            const rect = elements[i].getBoundingClientRect()

            if (
                rect.width > 0 &&
                rect.height > 0 &&
                rect.bottom > 0 &&
                rect.top < window.innerHeight
            ) {
                return i
            }
        }

        return 0
    }

    reattachTabbableElements()

    element.addEventListener('keydown', (e) => {
        if (isUserTyping()) return

        const isPlainZ =
            e.key === 'z' &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !e.shiftKey

        if (isPlainZ) {
            const activeElement = document.activeElement as HTMLElement | null
            const now = Date.now()

            if (
                activeElement &&
                element.contains(activeElement) &&
                now - lastZKeyAt <= 600
            ) {
                e.preventDefault()
                element.style.scrollSnapType = 'none'
                activeElement.scrollIntoView({
                    block: 'center',
                    inline: 'nearest',
                })
                requestAnimationFrame(() => {
                    element.style.scrollSnapType = ''
                })
                lastZKeyAt = 0
                return
            }

            lastZKeyAt = now
            return
        }

        lastZKeyAt = 0

        const activeElements = reattachTabbableElements()
        if (activeElements.length === 0) return

        const isNextKey = e.key === 'j' || e.key === 'ArrowDown'
        const isPrevKey = e.key === 'k' || e.key === 'ArrowUp'
        const isFirstKey = e.key === 'g'
        const isLastKey = e.key === 'G'

        if (!isNextKey && !isPrevKey && !isFirstKey && !isLastKey) {
            return
        }

        const activeElement = document.activeElement as HTMLElement | null
        const activeIndex = activeElement
            ? Array.from(activeElements).indexOf(activeElement)
            : -1

        if (activeIndex === -1) {
            e.preventDefault()

            // Start from the first element visible in the viewport,
            // mirroring how Tab / Shift-Tab begin from the current
            // scroll position rather than from the DOM boundary.
            const viewportIndex = findFirstViewportIndex(activeElements)

            if (isNextKey) {
                focusFromIndex(activeElements, viewportIndex, 1)
            } else if (isPrevKey) {
                // k mirrors Shift-Tab: start at the same visible element
                focusFromIndex(activeElements, viewportIndex, -1)
            } else if (isFirstKey) {
                focusFromIndex(activeElements, 0, 1)
            } else if (isLastKey) {
                focusFromIndex(activeElements, activeElements.length - 1, -1)
            }

            return
        }

        if (isNextKey) {
            e.preventDefault()
            focusFromIndex(
                activeElements,
                Math.min(activeIndex + 1, activeElements.length - 1),
                1,
            )
        }

        if (isPrevKey) {
            e.preventDefault()
            focusFromIndex(activeElements, Math.max(activeIndex - 1, 0), -1)
        }

        if (isFirstKey) {
            e.preventDefault()
            focusFromIndex(activeElements, 0, 1)
        }

        if (isLastKey) {
            e.preventDefault()
            focusFromIndex(activeElements, activeElements.length - 1, -1)
        }
    })
}

export function paginateElements(
    element: HTMLElement,
    elements: NodeListOf<HTMLElement> | HTMLElement[],
) {
    const currentIndex = Array.from(elements).indexOf(element)
    const first = elements[0]
    const next = elements[Math.min(currentIndex + 1, elements.length - 1)]
    const prev = elements[Math.max(currentIndex - 1, 0)]
    const last = elements[elements.length - 1]

    return { first, next, prev, last }
}
