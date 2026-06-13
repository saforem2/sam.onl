# [sam.onl](https://sam.onl)

Personal website for [Sam Foreman](https://sam.onl), built with [Astro](https://astro.build) and [WebTUI](https://webtui.ironclad.sh).

## Stack

- **Framework**: [Astro](https://astro.build) (SSG)
- **Styling**: [WebTUI](https://webtui.ironclad.sh) — terminal UI aesthetics for the web
- **Monorepo**: [Turborepo](https://turbo.build) + [Bun](https://bun.sh)
- **Hosting**: [Cloudflare Pages](https://pages.cloudflare.com) — see [`CLOUDFLARE_PAGES.md`](./CLOUDFLARE_PAGES.md) for build settings

## Structure

```
web/           → Astro site (pages, layouts, components)
packages/      → WebTUI packages (CSS, plugins, themes)
```

## Development

Requires [Bun](https://bun.sh/) (`>=1.3.0`) and Node (`>=18`).

```bash
git clone https://github.com/saforem2/sam.onl.git
cd sam.onl
bun install
bun run build
bun run dev
```

## Commands

| Command                | Description              |
| ---------------------- | ------------------------ |
| `bun run dev`          | Start dev server         |
| `bun run build`        | Build all workspaces     |
| `bun run lint`         | Lint all workspaces      |
| `bun run format`       | Format all workspaces    |
| `bun run format:check` | Check formatting         |
| `bun run clean`        | Clean build artifacts    |

## License

[MIT](LICENSE)
