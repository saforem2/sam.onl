#!/usr/bin/env python3
"""Undo shift_headings.py: shift all heading levels UP by 1 (## → #, ### → ##, etc.).

Skips lines inside fenced code blocks.
"""

import re
from pathlib import Path


def unshift_headings(text: str) -> tuple[str, int]:
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

        m = re.match(r'^(\s*)(#{2,6}) (.*)$', line)
        if m:
            indent, hashes, rest = m.groups()
            result.append(f'{indent}{"#" * (len(hashes) - 1)} {rest}')
            count += 1
        else:
            result.append(line)

    return '\n'.join(result), count


def main():
    pages_dir = Path(__file__).resolve().parent.parent / 'web' / 'src' / 'pages'
    total = 0

    for ext in ('*.mdx', '*.md'):
        for path in sorted(pages_dir.rglob(ext)):
            text = path.read_text()
            new_text, count = unshift_headings(text)
            if count > 0:
                path.write_text(new_text)
                total += count

    print(f'Reverted {total} heading(s)')


if __name__ == '__main__':
    main()
