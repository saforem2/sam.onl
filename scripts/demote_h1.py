#!/usr/bin/env python3
"""Demote H1 headings (# ) to H2 (## ) in MDX/md content files.

The page title is already rendered as <h1> by the layout via frontmatter,
so content should not contain H1 headings. This script only changes
`# ` → `## `, leaving all other heading levels untouched.

Skips lines inside fenced code blocks.
"""

import re
from pathlib import Path


def demote_h1(text: str) -> tuple[str, int]:
    lines = text.split('\n')
    result = []
    in_code_block = False
    count = 0

    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith('```') or stripped.startswith('~~~'):
            in_code_block = not in_code_block
            result.append(line)
            continue

        if in_code_block:
            result.append(line)
            continue

        m = re.match(r'^(\s*)# (.+)$', line)
        if m:
            indent, rest = m.groups()
            result.append(f'{indent}## {rest}')
            count += 1
        else:
            result.append(line)

    return '\n'.join(result), count


def main():
    pages_dir = Path(__file__).resolve().parent.parent / 'web' / 'src' / 'pages'
    total = 0
    files_changed = []

    for ext in ('*.mdx', '*.md'):
        for path in sorted(pages_dir.rglob(ext)):
            text = path.read_text()
            new_text, count = demote_h1(text)
            if count > 0:
                path.write_text(new_text)
                files_changed.append((path.relative_to(pages_dir), count))
                total += count

    print(f'Demoted {total} H1(s) to H2 across {len(files_changed)} file(s):')
    for path, count in files_changed:
        print(f'  {path}: {count}')


if __name__ == '__main__':
    main()
