#!/usr/bin/env python3
"""Convert markdown image syntax with relative/bare asset paths to HTML img tags
with absolute /assets/ paths.

Transforms:
  ![alt](assets/foo.png)           → <img src="/assets/foo.png" alt="alt" />
  ![alt](./assets/foo.png)         → <img src="/assets/foo.png" alt="alt" />
  ![alt](../../.././path/assets/foo.png) → <img src="/assets/foo.png" alt="alt" />
  ![](assets/subdir/foo.png)       → <img src="/assets/subdir/foo.png" />

Does NOT touch:
  ![alt](/assets/foo.png)           — already absolute
  ![alt](https://...)               — external URLs
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES_DIR = ROOT / 'web' / 'src' / 'pages'

# Match ![alt](relative-path-to-assets/file)
# Captures: alt text, everything before "assets/", and the path after "assets/"
MD_IMG_RE = re.compile(
    r'!\[([^\]]*)\]'           # ![alt]
    r'\('                       # (
    r'(?:\.\.?/)*'             # optional ../ or ./ prefixes
    r'(?:[^)]*?/)?'            # optional path segments before assets/
    r'assets/'                  # the assets/ directory
    r'([^)]+)'                 # capture: path after assets/
    r'\)'                       # )
)


def convert_image(m: re.Match) -> str:
    alt = m.group(1)
    asset_path = m.group(2)
    alt_attr = f' alt="{alt}"' if alt else ''
    return f'<img src="/assets/{asset_path}"{alt_attr} />'


def main():
    files_updated = 0
    refs_fixed = 0

    for ext in ('*.mdx', '*.md'):
        for mdx_path in sorted(PAGES_DIR.rglob(ext)):
            text = mdx_path.read_text()
            # Skip lines that already use absolute /assets/ paths
            # Only transform relative asset references
            new_text = text
            count = 0

            def counted_replace(m):
                nonlocal count
                full = m.group(0)
                # Skip if already absolute
                if '(/assets/' in full:
                    return full
                count += 1
                return convert_image(m)

            new_text = MD_IMG_RE.sub(counted_replace, text)

            if count > 0:
                mdx_path.write_text(new_text)
                files_updated += 1
                refs_fixed += count
                print(f'  {mdx_path.relative_to(PAGES_DIR)}: {count} image(s)')

    print(f'\nFixed {refs_fixed} markdown image(s) across {files_updated} file(s)')


if __name__ == '__main__':
    main()
