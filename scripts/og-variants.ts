import { join } from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { mkdir } from 'node:fs/promises'

const FONT_PATH = join(import.meta.dir, 'fonts', 'Iosevka-Regular.ttf')
const OUT_DIR = join(import.meta.dir, '..', 'og-variants')
const fontData = await Bun.file(FONT_PATH).arrayBuffer()

const title = 'Cooling Down Checkpoints: Best Practices for Model Evaluation'
const date = 'November 12, 2025'
const category = 'posts'
const author = 'Sam Foreman'

const fonts = [{ name: 'Iosevka Web', data: fontData, weight: 400 as const, style: 'normal' as const }]
const opts = { width: 1200, height: 630, fonts }

async function render(name: string, el: Record<string, unknown>) {
    const svg = await satori(el, opts)
    const png = Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng())
    await mkdir(OUT_DIR, { recursive: true })
    await Bun.write(join(OUT_DIR, `${name}.png`), png)
    console.log(`  ${name}.png`)
}

// Helper: all parent divs need display:flex in satori
const col = (style: Record<string, unknown>, children: unknown[]) => ({
    type: 'div', props: { style: { display: 'flex', flexDirection: 'column', ...style }, children }
})
const row = (style: Record<string, unknown>, children: unknown[]) => ({
    type: 'div', props: { style: { display: 'flex', flexDirection: 'row', ...style }, children }
})
const txt = (text: string, style: Record<string, unknown> = {}) => ({
    type: 'div', props: { style: { display: 'flex', ...style }, children: text }
})

// A: Current
await render('A-current', col(
    { justifyContent: 'flex-end', width: '100%', height: '100%', padding: '60px', backgroundColor: '#1c1c1c', color: '#e0e0e0', fontFamily: 'Iosevka Web' },
    [
        txt('sam.onl', { fontSize: '28px', opacity: 0.5, marginBottom: '16px' }),
        txt(title, { fontSize: '48px', lineHeight: 1.2, marginBottom: '24px' }),
        txt(date, { fontSize: '24px', opacity: 0.6 }),
    ]
))

// B: Left accent bar + category
await render('B-accent-bar', row(
    { width: '100%', height: '100%', backgroundColor: '#1c1c1c', color: '#e0e0e0', fontFamily: 'Iosevka Web' },
    [
        { type: 'div', props: { style: { display: 'flex', width: '8px', backgroundColor: '#e06c75' }, children: [] } },
        col({ flex: 1, padding: '50px 60px', justifyContent: 'space-between' }, [
            row({ justifyContent: 'space-between', alignItems: 'center' }, [
                txt('sam.onl', { fontSize: '28px', opacity: 0.5 }),
                txt(category, { fontSize: '20px', padding: '4px 16px', backgroundColor: '#333', color: '#e06c75' }),
            ]),
            col({}, [
                txt(title, { fontSize: '48px', lineHeight: 1.2, marginBottom: '24px' }),
                row({ gap: '24px', fontSize: '22px', opacity: 0.5 }, [
                    txt(author), txt(date),
                ]),
            ]),
        ]),
    ]
))

// C: Terminal / TUI
await render('C-terminal', col(
    { width: '100%', height: '100%', padding: '30px', backgroundColor: '#1c1c1c', color: '#e0e0e0', fontFamily: 'Iosevka Web' },
    [
        col({ flex: 1, border: '2px solid #444', padding: '40px', justifyContent: 'space-between' }, [
            row({ justifyContent: 'space-between', fontSize: '22px', color: '#888' }, [
                txt('$ cat post.md'), txt('sam.onl'),
            ]),
            col({}, [
                txt('# ' + category, { fontSize: '20px', color: '#e06c75', marginBottom: '12px' }),
                txt(title, { fontSize: '48px', lineHeight: 1.2, marginBottom: '20px' }),
                txt(author + '  |  ' + date, { fontSize: '22px', opacity: 0.5, borderTop: '1px solid #444', paddingTop: '16px' }),
            ]),
        ]),
    ]
))

// D: Bottom stripe
await render('D-bottom-stripe', col(
    { width: '100%', height: '100%', backgroundColor: '#1c1c1c', color: '#e0e0e0', fontFamily: 'Iosevka Web' },
    [
        col({ flex: 1, justifyContent: 'flex-end', padding: '60px', paddingBottom: '30px' }, [
            txt(title, { fontSize: '52px', lineHeight: 1.2, marginBottom: '20px' }),
            txt(date + '  ·  ' + author, { fontSize: '22px', opacity: 0.5 }),
        ]),
        row({ height: '48px', backgroundColor: '#e06c75', alignItems: 'center', padding: '0 60px', justifyContent: 'space-between' }, [
            txt('sam.onl', { fontSize: '20px', color: '#1c1c1c' }),
            txt(category, { fontSize: '18px', color: '#1c1c1c' }),
        ]),
    ]
))

console.log(`\nDone! Open og-variants/ to compare.`)
