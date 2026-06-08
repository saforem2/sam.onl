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
   only loads on pages that actually mount a chart. */
import 'uplot/dist/uPlot.min.css'

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

function initChart(uPlot: any, mount: HTMLElement, payload: ChartPayload) {
    // CSS vars don't work inside canvas contexts; resolve to concrete
    // colors via a hidden probe element whose `color` we then read off
    // via getComputedStyle.
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;visibility:hidden;'
    document.body.appendChild(probe)
    function cssColor(varName: string, fallback = '#888') {
        probe.style.color = `var(--${varName}, ${fallback})`
        return getComputedStyle(probe).color
    }

    function formatValue(v: number, axisLabel?: string) {
        const isMs = axisLabel && /\bms\b/.test(axisLabel)
        const isSec = axisLabel && /\bsec/i.test(axisLabel)
        const suffix = isMs ? 'ms' : isSec ? 's' : ''
        if (v >= 1000) return `${Math.round(v).toLocaleString()}${suffix}`
        if (v >= 100) return `${Math.round(v)}${suffix}`
        return `${v}${suffix}`
    }

    let chart: any = null

    function build() {
        if (chart) chart.destroy()

        const fg2 = cssColor('foreground2', '#888')
        const fg3 = cssColor('foreground3', '#bbb')
        const bg2 = cssColor('background2', '#eee')

        // uPlot's data layout: parallel arrays. data[0] = x; data[1..] = each y.
        const seriesAll = [...payload.series, ...payload.refs]
        const data = [payload.x, ...seriesAll.map((s) => s.data)] as any

        const uSeries: any[] = [
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

        const opts: any = {
            width: mount.clientWidth || 600,
            height: payload.height,
            scales: {
                x: payload.xLog ? { distr: 3, log: 10 } : {},
                y: payload.yLog ? { distr: 3, log: 10 } : {},
            },
            axes: [
                {
                    label: payload.xLabel,
                    labelSize: 24,
                    labelFont: `bold 0.85em var(--font-family)`,
                    stroke: fg2,
                    grid: { stroke: bg2, width: 1 },
                    ticks: { stroke: fg3, width: 1 },
                    font: `0.75em var(--font-family)`,
                },
                {
                    label: payload.yLabel,
                    labelSize: 32,
                    labelFont: `bold 0.85em var(--font-family)`,
                    stroke: fg2,
                    grid: { stroke: bg2, width: 1 },
                    ticks: { stroke: fg3, width: 1 },
                    font: `0.75em var(--font-family)`,
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
                        ctx.font = `0.7em var(--font-family)`
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
                                ctx.fillText(text, x, y - 10)
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

    // Resize: track layout width changes, debounced via rAF.
    let resizeRaf: number | null = null
    window.addEventListener('resize', () => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf)
        resizeRaf = requestAnimationFrame(() => {
            if (chart)
                chart.setSize({
                    width: mount.clientWidth,
                    height: payload.height,
                })
        })
    })

    // Theme swap: re-resolve CSS-var colors and re-paint.
    new MutationObserver(() => build()).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-webtui-theme'],
    })
}

const mounts = Array.from(
    document.querySelectorAll<HTMLElement>('.scaling-chart-mount'),
)
if (mounts.length > 0) {
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
}
