#!/usr/bin/env python3
"""Consolidate callout titles from multi-line to inline format.

Transforms:
    > [!TYPE]
    >
    > ### Title
    > contents

Into:
    > [!TYPE] Title
    > contents

Handles indented variants (e.g. `    > [!TYPE]`).
"""

import re
from pathlib import Path

# Pattern matches:
# (optional indent)(> [!TYPE])
# (same indent)(>)  (blank blockquote line)
# (same indent)(> ### Title)
#
# Captures:
#   1: leading whitespace/indent
#   2: > [!TYPE]
#   3: the title text after ### (may include HTML spans etc.)
PATTERN = re.compile(
    r'^( *)(> \[!(?:TIP|NOTE|WARNING|IMPORTANT|CAUTION)\])\s*\n'  # > [!TYPE]
    r'\1>\s*\n'                                                     # >
    r'\1> ### (.*)\n',                                              # > ### Title
    re.MULTILINE
)

def consolidate(text: str) -> tuple[str, int]:
    """Replace all multi-line callout headers with inline format.

    Returns (new_text, count_of_replacements).
    """
    count = 0
    def replacer(m):
        nonlocal count
        count += 1
        indent = m.group(1)
        callout = m.group(2)
        title = m.group(3).strip()
        return f'{indent}{callout} {title}\n'

    new_text = PATTERN.sub(replacer, text)
    return new_text, count

def main():
    pages_dir = Path(__file__).resolve().parent.parent / 'web' / 'src' / 'pages'

    total = 0
    files_changed = []

    for mdx_file in sorted(pages_dir.rglob('*.mdx')):
        text = mdx_file.read_text()
        new_text, count = consolidate(text)
        if count > 0:
            mdx_file.write_text(new_text)
            files_changed.append((mdx_file.relative_to(pages_dir), count))
            total += count

    print(f'Consolidated {total} callout(s) across {len(files_changed)} file(s):')
    for path, count in files_changed:
        print(f'  {path}: {count}')

if __name__ == '__main__':
    main()
