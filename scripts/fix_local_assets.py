#!/usr/bin/env python3
"""Move page-local ./assets/ to web/public/ and rewrite references to absolute paths.

For a page at web/src/pages/talks/llms-at-scale/index.mdx:
  - ./assets/foo.svg → /talks/llms-at-scale/assets/foo.svg
  - copies web/src/pages/talks/llms-at-scale/assets/ → web/public/talks/llms-at-scale/assets/

For a page at web/src/pages/talks/foo/bar.mdx (non-index):
  - ./assets/foo.svg → /talks/foo/assets/foo.svg
  - copies web/src/pages/talks/foo/assets/ → web/public/talks/foo/assets/
"""

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES_DIR = ROOT / 'web' / 'src' / 'pages'
PUBLIC_DIR = ROOT / 'web' / 'public'

# Match both markdown ![...](./assets/...) and HTML src="./assets/..."
ASSET_REF = re.compile(r'(?<=\()\./assets/|(?<=src=["\'])\./assets/')


def get_url_prefix(mdx_path: Path) -> str:
    """Get the URL path prefix for a given MDX file."""
    rel = mdx_path.relative_to(PAGES_DIR)
    # For index.mdx, the URL is the parent directory
    # For foo.mdx, the URL is the parent directory (foo is a page name)
    return '/' + str(rel.parent)


def main():
    # Find all MDX/md files that reference ./assets/
    files_fixed = []

    for ext in ('*.mdx', '*.md'):
        for mdx_path in sorted(PAGES_DIR.rglob(ext)):
            text = mdx_path.read_text()
            if './assets/' not in text:
                continue

            page_dir = mdx_path.parent
            assets_dir = page_dir / 'assets'

            if not assets_dir.is_dir():
                print(f'  WARN: {mdx_path.relative_to(PAGES_DIR)} references ./assets/ but no assets/ dir exists')
                continue

            # Compute the URL prefix for this page
            url_prefix = get_url_prefix(mdx_path)
            abs_asset_path = f'{url_prefix}/assets/'

            # Copy assets to public/
            dest_dir = PUBLIC_DIR / url_prefix.lstrip('/')  / 'assets'
            if not dest_dir.exists():
                shutil.copytree(assets_dir, dest_dir)
            else:
                # Copy individual files that don't exist yet
                for src_file in assets_dir.iterdir():
                    dst_file = dest_dir / src_file.name
                    if not dst_file.exists():
                        shutil.copy2(src_file, dst_file)

            # Rewrite ./assets/ → /url/prefix/assets/ in the MDX
            new_text = text.replace('./assets/', abs_asset_path)
            count = text.count('./assets/')

            if new_text != text:
                mdx_path.write_text(new_text)
                files_fixed.append((mdx_path.relative_to(PAGES_DIR), count, abs_asset_path))

    print(f'Fixed {len(files_fixed)} file(s):')
    for path, count, prefix in files_fixed:
        print(f'  {path}: {count} ref(s) → {prefix}')


if __name__ == '__main__':
    main()
