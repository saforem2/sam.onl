/*
 * scaling-chart.ts — client-side runtime for the ScalingChart.astro
 * component.
 *
 * Imported once for side-effects from Doc.astro's main <script> block,
 * so every doc-layout page can mount a chart without each MDX file
 * having to wire up the runtime itself. The mounted-chart check at the
 * bottom is a cheap querySelectorAll, and uPlot itself is dynamically
 * imported only when at least one mount exists — pages without charts
 * pay the selector cost, nothing more.
 *
 * Reads `data-chart-payload` (JSON) off every `.scaling-chart-mount`,
 * builds a uPlot per mount, re-renders on resize, and re-paints when
 * the active theme flips so series colors stay tied to live CSS-var
 * values.
 *
 * Why a separate runtime file vs. an inline <script> in the component:
 * Astro hoists component-level <script> tags onto pages that import
 * the component directly, but it does NOT reliably hoist them when the
 * component is consumed from inside MDX content (only the component's
 * CSS module survives). Putting the runtime in @/utils and importing
 * it from a layout sidesteps the issue.
 */

/* uPlot is dynamically imported below so its ~50 KB bundle (+ CSS)
   only loads on pages that actually mount a chart. The class +
   namespace are pulled in here as types only (import type) — no
   runtime cost. */
import 'uplot/dist/uPlot.min.css'
import type UPlot from 'uplot'

type ChartPayload = {
    xLabel?: string
    yLabel?: string
    x: number[]
    series: {
        name: string
        color: string
        data: number[]
        marker?: string
    }[]
    refs: { name: string; color: string; dash?: number[]; data: number[] }[]
    xLog: boolean
    yLog: boolean
    height: number
}

/* Module-singleton probe — one hidden <span> shared across every chart
   on the page so we never accumulate leaked DOM nodes per mount. Lazy-
   created on first read so pages without charts don't add a stray
   element to body. */
let _probe: HTMLSpanElement | null = null
function getProbe(): HTMLSpanElement {
    if (_probe) return _probe
    _probe = document.createElement('span')
    _probe.style.cssText = 'position:absolute;visibility:hidden;'
    document.body.appendChild(_probe)
    return _probe
}
function cssColor(varName: string, fallback = '#888'): string {
    const probe = getProbe()
    probe.style.color = `var(--${varName}, ${fallback})`
    return getComputedStyle(probe).color
}
function cssColorExpr(expr: string): string {
    const probe = getProbe()
    probe.style.color = expr
    return getComputedStyle(probe).color
}
// Resolve --font-family into a concrete font-family string the canvas
// font shorthand can use. uPlot writes ctx.font directly, so passing
// the CSS var literally silently falls back to sans.
function bodyFontFamily(): string {
    const probe = getProbe()
    probe.style.fontFamily = ''
    probe.style.fontFamily = 'var(--font-family)'
    const resolved = getComputedStyle(probe).fontFamily
    return resolved || 'monospace'
}
function fontStr(sizeEm: number, bold = false): string {
    // Convert em to px against the body's current font-size so the
    // canvas font shorthand gets an absolute size it can parse.
    const bodyPx = parseFloat(getComputedStyle(document.body).fontSize) || 16
    const px = Math.round(sizeEm * bodyPx)
    const weight = bold ? 'bold ' : ''
    return `${weight}${px}px ${bodyFontFamily()}`
}

/* Module-singleton theme observer + chart registry. Each initChart()
   call registers its rebuild callback here; one MutationObserver on
   <html data-webtui-theme> drives all of them. This replaces the
   previous per-chart observer (which leaked an observer per mount and
   compounded across theme flips). */
const themeRebuilders = new Set<() => void>()
let _themeObserverInstalled = false
function installThemeObserver() {
    if (_themeObserverInstalled) return
    _themeObserverInstalled = true
    new MutationObserver(() => {
        for (const rebuild of themeRebuilders) rebuild()
    }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-webtui-theme'],
    })
}

/* Module-singleton resize listener — one window listener fans out to
   every registered chart. rAF-debounced so a drag-resize doesn't fire
   N rebuilds. */
const resizeHandlers = new Set<() => void>()
let _resizeListenerInstalled = false
let _resizeRaf: number | null = null
function installResizeListener() {
    if (_resizeListenerInstalled) return
    _resizeListenerInstalled = true
    window.addEventListener('resize', () => {
        if (_resizeRaf) cancelAnimationFrame(_resizeRaf)
        _resizeRaf = requestAnimationFrame(() => {
            for (const fn of resizeHandlers) fn()
        })
    })
}

function initChart(
    uPlot: typeof UPlot,
    mount: HTMLElement,
    payload: ChartPayload,
) {
    function formatValue(v: number, axisLabel?: string) {
        const isMs = axisLabel && /\bms\b/.test(axisLabel)
        const isSec = axisLabel && /\bsec/i.test(axisLabel)
        const suffix = isMs ? 'ms' : isSec ? 's' : ''
        if (v >= 1000) return `${Math.round(v).toLocaleString()}${suffix}`
        if (v >= 100) return `${Math.round(v)}${suffix}`
        return `${v}${suffix}`
    }

    let chart: UPlot | null = null

    function build() {
        if (chart) chart.destroy()

        const fg2 = cssColor('foreground2', '#888')
        const fg3 = cssColor('foreground3', '#bbb')
        /* Grid lines: a translucent slice of foreground3 so the grid
           recedes behind the data on both light and dark themes.
           Resolve via the shared probe (canvas can't parse css vars). */
        const gridColor = cssColorExpr(
            'oklch(from var(--foreground3, #bbb) l c h / 0.15)',
        )

        // uPlot's data layout: parallel arrays. data[0] = x; data[1..] = each y.
        const seriesAll = [...payload.series, ...payload.refs]
        const data = [
            payload.x,
            ...seriesAll.map((s) => s.data),
        ] as UPlot.AlignedData

        const uSeries: UPlot.Series[] = [
            { label: payload.xLabel || 'x' },
            ...payload.series.map((s) => ({
                label: s.name,
                stroke: cssColor(s.color),
                width: 2,
                points: {
                    show: true,
                    size: 7,
                    stroke: cssColor(s.color),
                    fill: cssColor(s.color),
                },
            })),
            ...payload.refs.map((r) => ({
                label: r.name,
                stroke: cssColor(r.color, fg3),
                width: 1,
                dash: r.dash ?? [4, 4],
                points: { show: false },
            })),
        ]

        const opts: UPlot.Options = {
            width: mount.clientWidth || 600,
            height: payload.height,
            scales: {
                /* time: false on x — uPlot's default treats x values as
                   Unix timestamps and formats axis labels as dates; our
                   x is node count (8, 16, 32, …), so opt out. */
                x: payload.xLog
                    ? { time: false, distr: 3, log: 10 }
                    : { time: false },
                y: payload.yLog ? { distr: 3, log: 10 } : {},
            },
            axes: [
                {
                    label: payload.xLabel,
                    labelSize: 28,
                    labelFont: fontStr(0.85, true),
                    stroke: fg2,
                    grid: { stroke: gridColor, width: 1 },
                    ticks: { stroke: gridColor, width: 1 },
                    font: fontStr(0.8),
                    size: 36,
                },
                {
                    label: payload.yLabel,
                    labelSize: 32,
                    labelFont: fontStr(0.85, true),
                    stroke: fg2,
                    grid: { stroke: gridColor, width: 1 },
                    ticks: { stroke: gridColor, width: 1 },
                    font: fontStr(0.8),
                    size: 60,
                },
            ],
            series: uSeries,
            legend: { show: true },
            cursor: {
                drag: { x: false, y: false },
                points: { size: 9 },
            },
            // Draw per-point value labels above each measured marker —
            // mirrors the matplotlib originals.
            hooks: {
                draw: [
                    (u) => {
                        const ctx = u.ctx
                        ctx.save()
                        ctx.font = fontStr(0.85, true)
                        ctx.textAlign = 'center'
                        ctx.textBaseline = 'bottom'
                        for (const s of payload.series) {
                            ctx.fillStyle = cssColor(s.color)
                            for (let j = 0; j < s.data.length; j++) {
                                const x = u.valToPos(payload.x[j], 'x', true)
                                const y = u.valToPos(s.data[j], 'y', true)
                                const text = formatValue(
                                    s.data[j],
                                    payload.yLabel,
                                )
                                ctx.fillText(text, x, y - 12)
                            }
                        }
                        ctx.restore()
                    },
                ],
            },
        }

        chart = new uPlot(opts, data, mount)
    }

    build()

    // Register with the module-singleton observers so we get notified
    // on resize + theme swap without each chart instantiating its own.
    resizeHandlers.add(() => {
        if (chart)
            chart.setSize({
                width: mount.clientWidth,
                height: payload.height,
            })
    })
    themeRebuilders.add(build)
    installResizeListener()
    installThemeObserver()
}

/* Wrap the mount loop in an async IIFE so the module's top-level
   evaluation stays synchronous — pages without charts shouldn't pay
   the import-graph-await cost just because this file ships uPlot. */
;(async () => {
    const mounts = Array.from(
        document.querySelectorAll<HTMLElement>('.scaling-chart-mount'),
    )
    if (mounts.length === 0) return
    // Only load uPlot when there's actually a chart to draw.
    const mod = await import('uplot')
    const uPlot = mod.default
    for (const mount of mounts) {
        const raw = mount.dataset.chartPayload
        if (!raw) continue
        try {
            initChart(uPlot, mount, JSON.parse(raw) as ChartPayload)
        } catch (err) {
            console.error('ScalingChart init failed:', err)
        }
    }
})()
