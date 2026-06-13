# Cloudflare Pages — setup

Source of truth for the dashboard-only build settings (Cloudflare Pages
doesn't read a `pages.toml` or similar; settings live in the project
dashboard at https://dash.cloudflare.com → Workers & Pages → sam-onl →
Settings → Build).

Mirrors what `netlify.toml` used to encode.

## Project settings

| Setting                | Value                                            |
| ---------------------- | ------------------------------------------------ |
| **Production branch**  | `main`                                           |
| **Build command**      | `npx playwright install chromium && bun run build` |
| **Build output**       | `web/dist`                                       |
| **Root directory**     | (project root, leave blank)                      |
| **Framework preset**   | None (auto-detect picks Astro, also fine)        |

## Environment variables

| Name                          | Value | Notes                                      |
| ----------------------------- | ----- | ------------------------------------------ |
| `NODE_VERSION`                | `22`  | match local                                |
| `NODE_OPTIONS`                | `--max-old-space-size=4096` | bigger heap for mermaid+sharp |
| `PLAYWRIGHT_BROWSERS_PATH`    | `0`   | install Chromium into node_modules so CF's build cache catches it |

## Headers / redirects

- **Headers** live in `web/public/_headers` — copied verbatim into
  `web/dist/_headers` by Astro's build. CF Pages reads it natively.
- **No redirects** currently; if needed, add `web/public/_redirects`.

## Skip-build keyword

Netlify recognized `[skip netlify]`. **Cloudflare uses `[CI Skip]`** (or
`[Skip CI]`, `[CI-Skip]`, `[Skip-CI]`, `[skip-ci]`, case-insensitive).
Commit message convention going forward:

    style(prose): tweak callout border [CI Skip]

Multiple back-to-back skip commits still skip — CF doesn't try to batch.

## DNS cutover

DNS is already on Cloudflare (per project memory). To cut over:

1. In the Pages project, add `sam.onl` (and `www.sam.onl`) as custom
   domains. Cloudflare will offer to add the DNS records automatically
   since the zone is in the same account.
2. Wait for the SSL cert to provision (~minutes).
3. Confirm `https://sam.onl` resolves to CF Pages.
4. Delete the site in Netlify (or leave it — it'll just stop receiving
   traffic).

## Preview deploys

CF Pages opens a preview deploy per PR by default; URL pattern:
`https://<commit-sha>.sam-onl.pages.dev` (or `<branch>.sam-onl.pages.dev`
for branch deploys). GitHub PR check posts a link automatically.

## Build minutes / quotas

| Tier        | Free                                            |
| ----------- | ----------------------------------------------- |
| Builds      | 500 per month (was Netlify's 300)               |
| Concurrency | 5 (was 1)                                       |
| Bandwidth   | Unlimited (was 100 GB/month)                    |
| Sites       | Unlimited                                       |

Reset at the start of each calendar month, UTC.
