import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'

/**
 * Resolve a file's "last content change" timestamp, robust to git
 * checkouts / branch-switches / stashes rewriting the filesystem mtime.
 *
 * Priority:
 *   1. `override` — an author-set date (e.g. frontmatter `date-modified`).
 *      Used only when it parses to a real date, so placeholder strings
 *      like `today` fall through. This path needs no git history, so it's
 *      the deterministic escape hatch on a shallow clone.
 *   2. git committer date (%cI) of the last commit that touched the file.
 *   3. filesystem mtime — uncommitted files, git unavailable, or a
 *      shallow clone (where git would otherwise report a fabricated
 *      boundary-commit date; see isShallowRepo).
 *
 * @param absPath  ABSOLUTE filesystem path to the SOURCE file. Absolute is
 *                 required: a repo-relative pathspec silently returns
 *                 nothing when git's cwd isn't the repo root (the build
 *                 runs from the `web/` workspace). Do NOT pass a bundled
 *                 `import.meta.url` — at build that points into dist/, an
 *                 untracked path that git can't date.
 * @param override optional author-set date (string | Date | null)
 */
export interface LastModified {
    date: Date
    /** false only for a date-only override (no meaningful time-of-day). */
    hasTime: boolean
    source: 'override' | 'git' | 'mtime'
}

/** Author's display timezone — pins output so a UTC build container and a
 *  local (Chicago) build render the same calendar day / wall-clock time. */
const DISPLAY_TZ = 'America/Chicago'

// Memoized once per build: a shallow clone grafts a parentless boundary
// commit, so `git log -1 -- <path>` returns that boundary commit's date
// for any file not changed in the tip — a real-looking but WRONG date.
// When shallow, skip git entirely and fall back to mtime (no regression)
// rather than emit a fabricated date.
let _shallow: boolean | null = null
function isShallowRepo(): boolean {
    if (_shallow !== null) return _shallow
    try {
        _shallow =
            execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim() === 'true'
    } catch {
        // Not a git repo / git missing: treat as "no git", let git step skip.
        _shallow = true
    }
    return _shallow
}

export function getLastModified(
    absPath: string,
    override?: string | Date | null,
): LastModified {
    // 1. explicit override, only if it's a real date (ignores `today` etc.)
    if (override != null && override !== '') {
        if (override instanceof Date) {
            if (!isNaN(override.getTime()))
                return { date: override, hasTime: true, source: 'override' }
        } else {
            const s = String(override).trim()
            const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s)
            // Date-only strings parse as UTC midnight, which shifts a day
            // when formatted in a behind-UTC zone. Anchor at noon so the
            // intended calendar day survives any display zone.
            const d = new Date(dateOnly ? `${s}T12:00:00` : s)
            if (!isNaN(d.getTime()))
                return { date: d, hasTime: !dateOnly, source: 'override' }
        }
    }

    // 2. git committer date of the last commit touching this file.
    //    Absolute pathspec => cwd-independent. execFileSync => no shell.
    //    stderr ignored so "not a git repo" etc. stays out of build logs.
    if (!isShallowRepo()) {
        try {
            const out = execFileSync(
                'git',
                ['log', '-1', '--format=%cI', '--', absPath],
                { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
            ).trim()
            if (out) {
                const d = new Date(out)
                if (!isNaN(d.getTime()))
                    return { date: d, hasTime: true, source: 'git' }
            }
        } catch {
            // fall through to mtime
        }
    }

    // 3. filesystem mtime fallback.
    return { date: statSync(absPath).mtime, hasTime: true, source: 'mtime' }
}

/** "2026-06-29" in the author's display zone (build-machine independent). */
export function formatISODate(d: Date): string {
    // en-CA => YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: DISPLAY_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d)
}

/** "08:48:59" (24h) in the author's display zone. */
export function formatISOTime(d: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: DISPLAY_TZ,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(d)
}
