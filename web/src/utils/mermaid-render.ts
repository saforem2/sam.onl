import mermaid from 'mermaid'

function stabilizeMermaidSvgLayout() {
    const mermaidSvgs = document.querySelectorAll('svg[id^="mermaid-"]')

    mermaidSvgs.forEach((node) => {
        if (!(node instanceof SVGElement)) return

        const viewBox = node.getAttribute('viewBox')
        if (!viewBox) return

        const [, , widthRaw, heightRaw] = viewBox
            .trim()
            .split(/\s+/)
            .map((value) => Number(value))

        if (!Number.isFinite(widthRaw) || !Number.isFinite(heightRaw)) return
        if (widthRaw <= 0 || heightRaw <= 0) return

        node.setAttribute('width', String(widthRaw))
        node.setAttribute('height', String(heightRaw))
        node.style.setProperty('display', 'block', 'important')
        node.style.setProperty('width', '100%', 'important')
        node.style.setProperty('max-width', '100%', 'important')

        const renderedWidth =
            node.getBoundingClientRect().width ||
            node.parentElement?.getBoundingClientRect().width ||
            widthRaw
        const maxHeight = window.innerHeight * 0.5
        const naturalHeight = (renderedWidth * heightRaw) / widthRaw
        const resolvedHeight =
            Number.isFinite(naturalHeight) && naturalHeight > 0
                ? Math.min(naturalHeight, maxHeight)
                : heightRaw

        node.style.setProperty('height', `${resolvedHeight}px`, 'important')
        node.style.setProperty('max-height', '50vh', 'important')
        node.style.setProperty(
            'aspect-ratio',
            `${widthRaw} / ${heightRaw}`,
            'important',
        )
        node.style.setProperty('visibility', 'visible', 'important')
    })
}

export function initMermaid() {
    const mermaidBlocks = document.querySelectorAll('.mermaid')
    if (mermaidBlocks.length === 0) return

    const resolveMermaidTheme = () => {
        const theme =
            document.documentElement.getAttribute('data-webtui-theme') ??
            'custom-light'
        const lightThemes = ['custom-light', 'catppuccin-latte']
        return lightThemes.includes(theme) ? 'default' : 'dark'
    }

    const resolveMermaidFontFamily = () => {
        const fontFamily = getComputedStyle(
            document.documentElement,
        ).getPropertyValue('--font-family')
        return fontFamily.trim() || 'monospace'
    }

    const resolveMermaidFontSize = () => {
        const fontSize = getComputedStyle(
            document.documentElement,
        ).getPropertyValue('--font-size')
        return fontSize.trim() || '16px'
    }

    const render = async () => {
        mermaid.initialize({
            startOnLoad: false,
            theme: resolveMermaidTheme(),
            fontFamily: resolveMermaidFontFamily(),
            fontSize: resolveMermaidFontSize(),
            flowchart: {
                padding: 16,
            },
        })

        const nodes = document.querySelectorAll('.mermaid')
        nodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return
            const source = node.dataset.mermaid
            if (!source) return
            node.removeAttribute('data-processed')
            node.textContent = source
        })

        try {
            await mermaid.run({ nodes })
            stabilizeMermaidSvgLayout()
        } catch (error) {
            console.error('Mermaid rendering failed:', error)
        }
    }

    render()

    new MutationObserver(() => {
        render()
    }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-webtui-theme'],
    })
}
