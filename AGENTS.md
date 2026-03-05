# AGENTS.md

This guide is for coding agents working in `/Users/samforeman/projects/saforem2/sam.onl`.

## Repo Snapshot

- Monorepo: Bun + Turborepo.
- Workspaces: `web/` (Astro site/docs) and `packages/*` (CSS/plugin/theme packages).
- Legacy folder: `old/` is not part of active workspace tooling.
- Module format: ESM (`"type": "module"`).
- Runtime/tooling: Node `>=18`, Bun (`packageManager: bun@1.2.16`, `engines.bun: >=1.3.0`).

## Root Commands (all workspaces)

Run from repo root unless noted.

- Install: `bun install`
- Dev: `bun run dev`
- Build: `bun run build`
- Lint: `bun run lint`
- Format: `bun run format`
- Format check: `bun run format:check`
- Clean: `bun run clean`

## Workspace Commands

### `web/` (Astro)

Run from `web/`:

- `bun run dev`
- `bun run build`
- `bun run preview`
- `bun run lint`
- `bun run format`
- `bun run format:check`
- `bun run clean`

### `packages/*` (`@webtui/*`)

Each package supports:

- `bun run dev` (watch build)
- `bun run build`
- `bun run format`
- `bun run format:check`
- `bun run clean`

## Run One Target with Turborepo

Use root commands with `--filter` when only one workspace changed.

- `bun run build --filter=web`
- `bun run lint --filter=web`
- `bun run format:check --filter=@webtui/css`
- `bun run build --filter=@webtui/theme-vitesse`

## Tests and Single-Test Execution

Current repository status:

- No `test` script in root `package.json`.
- No `test` script in workspace `package.json` files.
- No test runner config files are present (`vitest`, `jest`, `playwright.config.*`, etc.).
- No runnable `*.test.*` or `*.spec.*` test suite is configured.

Therefore:

- "Run all tests" command: not available today.
- "Run a single test" command: not available today.
- Validation currently relies on `bun run format:check`, `bun run lint`, and `bun run build`.

If tests are added later, update this file with exact commands.
If Playwright is adopted (dependency already exists), typical commands are:

- All tests: `bunx playwright test`
- Single file: `bunx playwright test path/to/file.spec.ts`
- Single test by name: `bunx playwright test -g "test name"`

## Formatting and Linting Rules

Source of truth:

- Prettier: `.prettierrc.js`
- ESLint: `eslint.config.js`

Prettier settings used in this repo:

- `tabWidth: 4`
- `useTabs: false`
- `semi: false`
- `singleQuote: true`
- `bracketSameLine: true`
- `htmlWhitespaceSensitivity: strict`
- `prettier-plugin-astro` enabled

ESLint setup:

- `typescript-eslint` recommended config
- `eslint-plugin-astro` recommended config
- `web` lint command is `eslint src/`

## TypeScript and Imports

- `web/tsconfig.json` extends `astro/tsconfigs/strict`.
- Alias in `web/`: `@/* -> ./src/*`.
- Prefer ESM `import` / `export`.
- Prefer `@/` imports over deep relative paths when it improves readability.
- Keep imports minimal; remove unused imports.
- Use `import type` for type-only imports.
- Prefer explicit types for public APIs or when inference is unclear.
- Avoid `any`; use `unknown` plus narrowing when needed.

## Naming and Structural Conventions

- Variables/functions: `camelCase`
- Components/types/interfaces/classes: `PascalCase`
- Content/page directories: generally `kebab-case`
- Keep files organized by feature and follow nearby patterns.
- Prefer small, focused functions/components.
- Avoid introducing new architecture unless needed for the task.

## CSS Conventions (especially `packages/*`)

- Keep selectors inside `@layer` blocks (`base`, `components`, `utils`).
- Prefer `ch` and `lh` units for layout in package CSS.
- Use custom attribute selectors with trailing dash (`is-`, `size-`, `variant-`).
- For component selectors, prefer `[is-~='component-name']`.
- Avoid new class/id-driven styling in package CSS unless the file already uses it.

## Error Handling

- Use `try/catch` around async/I-O boundaries where failure is expected.
- Throw `Error` objects with clear context.
- Do not swallow errors silently; rethrow or log with context.
- In browser scripts, guard missing DOM nodes and fail gracefully.

## Astro/MDX Content Rules

- Docs/content live in `web/src/pages/**`.
- Frontmatter typically includes `layout` and `title`.
- Keep MDX syntax valid (especially attribute values and fenced blocks).
- Preserve existing layout usage (`@/layouts/Doc.astro`, `@/layouts/Layout.astro`).

## Build Outputs and Generated Files

- Package output: `packages/*/dist/`
- Web output: `web/dist/`
- Turbo cache: `.turbo/`
- Avoid editing generated output directly unless explicitly asked.

## Cursor and Copilot Rules

- `.cursor/rules/`: not found.
- `.cursorrules`: not found.
- `.github/copilot-instructions.md`: not found.
