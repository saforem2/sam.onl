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
| **Build command**      | `bun install --frozen-lockfile && npx playwright install chromium && bun run build` |
| **Build output**       | `web/dist`                                       |
| **Root directory**     | (project root, leave blank)                      |
| **Framework preset**   | None (auto-detect picks Astro, also fine)        |

> **Note:** the explicit `bun install --frozen-lockfile` at the front of
> the build command is required. Unlike Netlify, Cloudflare Pages does
> NOT auto-run `bun install` before invoking the build command —
> without it, `turbo` (a devDependency) is not on PATH and the build
> fails with `turbo: command not found`.

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

## Scrape Shield — Email Obfuscation (render-blocking script)

Cloudflare's **Email Address Obfuscation** (Scrape Shield) rewrites any
`mailto:` in the HTML into an encoded blob and injects
`/cdn-cgi/scripts/.../email-decode.min.js` to decode it client-side. That
script is **render-blocking** and shows up in Lighthouse's render-blocking
list (~1.2 KiB, ~150ms on Slow 4G) even though it is not in this repo — CF
adds it at the edge. The site has one `mailto:` (`sf@omg.lol`, in
`about/index.mdx`), which is what triggers it.

To remove it from the critical path, turn the feature off:
**dashboard → the zone (sam.onl) → Scrape Shield → Email Address
Obfuscation → Off.** (It is a zone/Scrape-Shield setting, not a Pages
build setting, so there is no file to change — it must be toggled in the
dashboard.) Trade-off: the raw `mailto:` address becomes scrapeable by
bots again. Low stakes for a single `omg.lol` alias; leave it on if you'd
rather keep the obfuscation and eat the ~150ms.

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

## Google Analytics (GA4) — dashboard steps after the samf.sh rename

The GA tag is wired in `web/src/layouts/Layout.astro` (measurement ID
`G-RD883HJ1J2`). A GA4 measurement ID is **not** domain-locked — the tag
collects from whatever host runs it, and the data-stream "website URL"
is informational (it drives the "Visit site" link and the default page
path, not an allowlist). Verified after cutover: samf.sh page_view
beacons are accepted (`dl=https://samf.sh/…` → HTTP 204). So no code
change was needed for the domain move.

Two dashboard-only cleanups remain (GA Admin at
https://analytics.google.com → Admin, for the property containing
`G-RD883HJ1J2`). Neither blocks collection; they keep the reports
labelled correctly:

1. **Rename the data stream + property** from `sam.onl` to `samf.sh`.
   Admin → Data streams → the web stream → update the stream URL/name;
   and Admin → Property details → property name. Cosmetic, but fixes the
   "Visit site" link and enhanced-measurement link decoration.
2. **Check for a hostname Data Filter.** Admin → Data settings → Data
   filters. If an "include only hostname = sam.onl" filter was ever
   added, it would silently drop samf.sh hits despite the 204. Off by
   default and rarely configured — but this is the one place a real
   domain-binding could hide, so confirm there isn't one (or update it
   to samf.sh).

> **Note:** analytics were separately broken by a `requestIdleCallback`
> loader bug (fixed in the commit that added this section) — the
> deferred gtag.js was never injected on browsers supporting
> requestIdleCallback. That was unrelated to the domain; see
> `Layout.astro`'s `scheduleIdle` helper.
