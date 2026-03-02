#!/usr/bin/env python3
"""Shift all markdown heading levels down by 1 in MDX/md files.

# Heading  →  ## Heading
## Heading →  ### Heading
...
##### Heading → ###### Heading

Only transforms lines that start with 1–5 `#` characters followed by a space.
Skips lines inside fenced code blocks (``` or ~~~).
"""

import re
from pathlib import Path

HEADING_RE = re.compile(r'^(#{1,5}) ', re.MULTILINE)


def shift_headings(text: str) -> tuple[str, int]:
    """Shift heading levels down by 1, skipping fenced code blocks."""
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

        # Match heading at start of line (respecting leading whitespace)
        m = re.match(r'^(\s*)(#{1,5}) (.*)$', line)
        if m:
            indent, hashes, rest = m.groups()
            result.append(f'{indent}{"#" * (len(hashes) + 1)} {rest}')
            count += 1
        else:
            result.append(line)

    return '\n'.join(result), count


def main():
    pages_dir = Path(__file__).resolve().parent.parent / 'web' / 'src' / 'pages'
    total = 0
    files_changed = []

    for path in sorted(pages_dir.rglob('*.mdx')):
        text = path.read_text()
        new_text, count = shift_headings(text)
        if count > 0:
            path.write_text(new_text)
            files_changed.append((path.relative_to(pages_dir), count))
            total += count

    for path in sorted(pages_dir.rglob('*.md')):
        text = path.read_text()
        new_text, count = shift_headings(text)
        if count > 0:
            path.write_text(new_text)
            files_changed.append((path.relative_to(pages_dir), count))
            total += count

    print(f'Shifted {total} heading(s) across {len(files_changed)} file(s):')
    for path, count in files_changed:
        print(f'  {path}: {count}')


if __name__ == '__main__':
    main()
