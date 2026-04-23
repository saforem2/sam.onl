import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

const docs = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/pages' }),
    schema: z.object({
        title: z.string(),
        order: z.number().nullish(),
        date: z.coerce.date().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        draft: z.boolean().optional(),
    }),
})

export const collections = { docs }
