#!/usr/bin/env python3
"""Consolidate per-page assets from web/src/pages/*/assets/ into web/public/assets/.

Also rewrites relative asset paths in MDX/md to absolute /assets/ paths.
Handles both:
  - ./assets/foo.png (local)
  - ../../../../assets/foo.png (relative to shared pages/assets/)
  - ../../../assets/foo.png (etc.)
"""

import hashlib
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / 'web' / 'public'
PAGES_DIR = ROOT / 'web' / 'src' / 'pages'
GLOBAL_ASSETS = PUBLIC_DIR / 'assets'

# Match relative paths to assets dirs: ./assets/, ../assets/, ../../assets/, etc.
RELATIVE_ASSET_RE = re.compile(r'(?:\.\.?/)+assets/')


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def copy_to_global(src: Path, rel_in_assets: Path) -> str:
    """Copy file to global assets, return the new URL path."""
    target = GLOBAL_ASSETS / rel_in_assets
    if target.exists():
        if md5(target) == md5(src):
            return f'/assets/{rel_in_assets}'
        # Name collision — add hash suffix
        stem = target.stem
        suffix = target.suffix
        new_name = f'{stem}-{md5(src)[:8]}{suffix}'
        target = GLOBAL_ASSETS / rel_in_assets.parent / new_name
        rel_in_assets = target.relative_to(GLOBAL_ASSETS)

    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, target)
    return f'/assets/{rel_in_assets}'


def main():
    GLOBAL_ASSETS.mkdir(exist_ok=True)

    # 1. Move all per-page asset files to global assets
    per_page_dirs = sorted(
        d for d in PAGES_DIR.rglob('assets')
        if d.is_dir() and d != PAGES_DIR / 'assets'
    )

    files_moved = 0
    for asset_dir in per_page_dirs:
        for f in sorted(asset_dir.rglob('*')):
            if not f.is_file():
                continue
            rel_in_assets = f.relative_to(asset_dir)
            copy_to_global(f, rel_in_assets)
            files_moved += 1

    # 2. Move shared pages/assets/ to global assets
    shared_assets = PAGES_DIR / 'assets'
    if shared_assets.is_dir():
        for f in sorted(shared_assets.rglob('*')):
            if not f.is_file():
                continue
            rel_in_assets = f.relative_to(shared_assets)
            copy_to_global(f, rel_in_assets)
            files_moved += 1

    print(f'Copied {files_moved} files to public/assets/')

    # 3. Rewrite all relative asset paths in MDX/md to absolute /assets/
    files_updated = 0
    refs_rewritten = 0

    for ext in ('*.mdx', '*.md'):
        for mdx_path in sorted(PAGES_DIR.rglob(ext)):
            text = mdx_path.read_text()

            def rewrite_match(m):
                """Resolve a relative asset path to an absolute one."""
                nonlocal refs_rewritten
                rel_path = m.group(0)

                # Resolve relative to the MDX file's directory
                resolved = (mdx_path.parent / rel_path).resolve()

                # Find the path within the assets dir
                # Try to match against any known assets dir
                for assets_root in [shared_assets] + per_page_dirs:
                    try:
                        rel_in_assets = resolved.relative_to(assets_root.resolve())
                        # Reconstruct as prefix only (the filename comes after in the source)
                        refs_rewritten += 1
                        return '/assets/'
                    except ValueError:
                        continue

                # If we can't resolve, just use /assets/ — the file structure
                # within the relative path should match
                refs_rewritten += 1
                return '/assets/'

            new_text = RELATIVE_ASSET_RE.sub(rewrite_match, text)
            if new_text != text:
                mdx_path.write_text(new_text)
                files_updated += 1

    print(f'Rewrote {refs_rewritten} references across {files_updated} files')

    # 4. Remove per-page asset directories from src/pages
    removed = 0
    for asset_dir in per_page_dirs:
        if asset_dir.exists():
            shutil.rmtree(asset_dir)
            removed += 1

    # Also remove shared pages/assets/
    if shared_assets.exists():
        shutil.rmtree(shared_assets)
        removed += 1

    print(f'Removed {removed} asset directories from src/pages/')


if __name__ == '__main__':
    main()
