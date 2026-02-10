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

// Applies the ::highlight(vim) CSS pseudo-class to an element
export function applyVimCursorHighlight(element: HTMLElement) {
    const firstChild = element.firstChild

    if (!firstChild) return

    const textNode = getFirstTextNode(firstChild)

    if (!textNode) {
        CSS.highlights.clear()
        return
    }

    if (
        typeof textNode?.textContent !== 'string' ||
        textNode.textContent.trim() === ''
    ) {
        CSS.highlights.clear()
        return
    }

    const firstNonWhitespace =
        textNode.textContent?.split('').findIndex((c) => !/\s/.test(c)) ?? 0

    const range = new Range()
    range.setStart(textNode, firstNonWhitespace)
    range.setEnd(textNode, firstNonWhitespace + 1)

    const hi = new Highlight(range)

    CSS.highlights.set('vim', hi)
}

export function vimFocusElement(element: HTMLElement) {
    element.focus()
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    applyVimCursorHighlight(element)
}

// Adds vim-like navigation to an element
export function applyVimNavigation(
    element: HTMLElement,
    queryString: string,
    onElementFocus?: (element: HTMLElement) => void,
) {
    const isElementVisible = (candidate: HTMLElement) => {
        if (candidate.hidden) return false

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
            el.onfocus = () => {
                vimFocusElement(el)
                onElementFocus?.(el)
            }
        }

        return vimTabbableElements
    }

    reattachTabbableElements()

    element.addEventListener('keydown', (e) => {
        if (isUserTyping()) return

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
            const fallbackTarget =
                isPrevKey || isLastKey
                    ? activeElements.at(-1)
                    : activeElements[0]
            fallbackTarget?.focus()
            return
        }

        const { next, prev, first, last } = paginateElements(
            activeElement as HTMLElement,
            activeElements,
        )

        if (isNextKey) {
            e.preventDefault()
            next?.focus()
        }

        if (isPrevKey) {
            e.preventDefault()
            prev?.focus()
        }

        if (isFirstKey) {
            e.preventDefault()
            first?.focus()
        }

        if (isLastKey) {
            e.preventDefault()
            last?.focus()
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
