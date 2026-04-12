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

let fontDataPromise: Promise<ArrayBuffer | null> | null = null

async function getFontData(): Promise<ArrayBuffer | null> {
    if (!fontDataPromise) {
        fontDataPromise = fetch(
            'https://cdn.jsdelivr.net/fontsource/fonts/jetbrains-mono@latest/latin-400-normal.woff',
        ).then(
            (res) => (res.ok ? res.arrayBuffer() : null),
            () => null,
        )
    }
    return fontDataPromise
}

export const GET: APIRoute = async ({ props }) => {
    const { title, date } = props as { title: string; date: string | null }
    const fontData = await getFontData()

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
                    fontFamily: 'JetBrains Mono',
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
                                fontWeight: 400,
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
            fonts: fontData
                ? [
                      {
                          name: 'JetBrains Mono',
                          data: fontData,
                          weight: 400,
                          style: 'normal' as const,
                      },
                  ]
                : [],
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
