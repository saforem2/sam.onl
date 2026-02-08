# AGENTS.md

This repository is a Bun + Turborepo monorepo. It includes an Astro site in `web/` and CSS/theme packages in `packages/*`.

## Tooling and environment

- Package manager: Bun (see `package.json` -> `packageManager: bun@1.2.16`)
- Node: >= 18
- Bun: >= 1.3.0
- Workspace orchestration: Turborepo (`turbo.json`)

## Build / lint / format / dev

Run these from the repository root unless stated otherwise.

### Root (all workspaces)

- Install: `bun install`
- Dev (all packages): `bun run dev` (runs `turbo run dev`)
- Build (all packages): `bun run build` (runs `turbo run build`)
- Lint: `bun run lint` (runs `turbo run lint`)
- Format: `bun run format` (runs `turbo run format`)
- Format check: `bun run format:check` (runs `turbo run format:check`)
- Clean: `bun run clean`

### Web app (Astro)

- Dev: `bun run dev` (from `web/`)
- Build: `bun run build` (from `web/`)
- Preview: `bun run preview` (from `web/`)
- Lint: `bun run lint` (from `web/`)
- Format: `bun run format` (from `web/`)
- Format check: `bun run format:check` (from `web/`)
- Clean: `bun run clean` (from `web/`)

### Packages (CSS/themes/plugins)

Each package in `packages/*` provides:

- Dev: `bun run dev` (from that package)
- Build: `bun run build` (from that package)
- Format: `bun run format` (from that package)
- Format check: `bun run format:check` (from that package)
- Clean: `bun run clean` (from that package)

### Running a single target

- Turborepo can scope tasks with `--filter`:
    - Example: `bun run build --filter=@webtui/css`
    - Example: `bun run lint --filter=web`
    - Use this when you only need to build/lint a single workspace.

### Tests

- No test runner or `test` script is currently configured in `package.json`.
- If tests are added later, document the command and a single-test invocation here.

## Formatting and linting rules

### Prettier

Defined in `.prettierrc.js`:

- `tabWidth: 4`
- `useTabs: false`
- `semi: false`
- `singleQuote: true`
- `bracketSameLine: true`
- `htmlWhitespaceSensitivity: strict`
- Astro formatting via `prettier-plugin-astro`

When editing files, keep the existing formatting and run `bun run format` if needed.

### ESLint

Defined in `eslint.config.js`:

- Uses `typescript-eslint` recommended configs
- Uses `eslint-plugin-astro` recommended configs
- TypeScript parsing uses the root `tsconfig.json` (strict)

Lint with `bun run lint` (root or `web/`).

## TypeScript and module conventions

### TypeScript configuration

From `web/tsconfig.json`:

- Extends `astro/tsconfigs/strict` (strict type checking)
- `module` and `target`: `esnext`
- `moduleResolution`: `node`
- `esModuleInterop: true`
- Path alias: `@/*` -> `web/src/*`

### Modules and imports

- This repo uses ES modules (`"type": "module"` in package.json).
- Prefer `import` / `export` syntax.
- Use the `@/` alias for `web/src` when it improves readability.
- Keep import lists minimal and remove unused imports (ESLint will flag them).

## Code style guidelines

### General style

- Prefer small, focused functions and components.
- Keep files organized by feature (follow existing layout).
- Avoid introducing new architectural patterns unless necessary.

### Naming conventions

- Use `camelCase` for variables and functions.
- Use `PascalCase` for components/classes/types.
- Use `kebab-case` for file and directory names in content/pages unless the area already uses another pattern.
- Keep CSS class and custom attribute names consistent with existing CSS in `packages/*`.

### Types

- Use explicit types where inference is unclear or public API surface is involved.
- Prefer `type` for unions/intersections; use `interface` when extending or for public shapes.
- Avoid `any`; use `unknown` with narrowing when needed.

### Error handling

- Use `try/catch` around async or I/O boundaries when failures are expected.
- Throw `Error` with a clear message rather than strings.
- Avoid swallowing errors; log or rethrow with context.

### MDX/Astro content

- MDX/Markdown lives under `web/src/pages/**`.
- Keep MDX syntax valid (attribute values must be plain strings, not nested Markdown).
- For embedded HTML, use fenced HTML blocks when needed.

## Repository structure

- `web/`: Astro site and content pages
- `packages/*`: CSS library, plugin, and themes (Vite build)
- `old/`: legacy content (not part of active tooling)

## Build outputs

- Packages output to `dist/`
- Web builds to `web/dist/`
- Turborepo caches in `.turbo/`

## Docs and metadata

- Root README: `README.md`
- Web README: `web/README.md`

## Cursor / Copilot rules

- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot rules found in `.github/copilot-instructions.md`.

## When in doubt

- Follow existing patterns in nearby files.
- Run `bun run format` and `bun run lint` before finalizing changes.
- If a change impacts multiple workspaces, prefer the root `turbo` commands.
