#!/usr/bin/env python3
"""Consolidate per-page assets from web/public/<path>/assets/ into web/public/assets/.

For each file in per-page asset directories:
  1. Copy to web/public/assets/<filename> (skip if same-content file exists)
  2. Handle name collisions by comparing content (md5)
  3. Update all MDX/md references to use /assets/<filename>
  4. Remove the now-empty per-page asset directories
"""

import hashlib
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / 'web' / 'public'
PAGES_DIR = ROOT / 'web' / 'src' / 'pages'
GLOBAL_ASSETS = PUBLIC_DIR / 'assets'


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def main():
    GLOBAL_ASSETS.mkdir(exist_ok=True)

    # Find all per-page asset directories (exclude static/, old/, and the global assets/ itself)
    per_page_dirs = sorted(
        d for d in PUBLIC_DIR.rglob('assets')
        if d.is_dir()
        and d != GLOBAL_ASSETS
        and 'static' not in d.parts
        and 'old' not in d.parts
    )

    # Track: original absolute URL path -> new absolute URL path
    url_rewrites: dict[str, str] = {}
    # Track files by name -> {md5: global_path}
    name_registry: dict[str, dict[str, Path]] = {}
    files_moved = 0
    files_skipped = 0

    for asset_dir in per_page_dirs:
        # URL prefix for this asset dir: e.g. /talks/llms-at-scale/assets
        rel = asset_dir.relative_to(PUBLIC_DIR)
        url_prefix = '/' + str(rel)

        for f in sorted(asset_dir.rglob('*')):
            if not f.is_file():
                continue

            # Relative path within the assets dir (handles subdirs like aeris/)
            rel_in_assets = f.relative_to(asset_dir)
            file_hash = md5(f)
            old_url = f'{url_prefix}/{rel_in_assets}'

            # Check if same file already exists in global assets
            target = GLOBAL_ASSETS / rel_in_assets

            if target.exists():
                if md5(target) == file_hash:
                    # Same content, just rewrite URL
                    url_rewrites[old_url] = f'/assets/{rel_in_assets}'
                    files_skipped += 1
                else:
                    # Name collision with different content — add hash suffix
                    stem = target.stem
                    suffix = target.suffix
                    new_name = f'{stem}-{file_hash[:8]}{suffix}'
                    target = GLOBAL_ASSETS / rel_in_assets.parent / new_name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f, target)
                    new_rel = target.relative_to(GLOBAL_ASSETS)
                    url_rewrites[old_url] = f'/assets/{new_rel}'
                    files_moved += 1
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, target)
                url_rewrites[old_url] = f'/assets/{rel_in_assets}'
                files_moved += 1

    print(f'Moved {files_moved} files, skipped {files_skipped} (already existed)')
    print(f'Total URL rewrites: {len(url_rewrites)}')

    # Rewrite references in MDX/md files
    files_updated = 0
    for ext in ('*.mdx', '*.md'):
        for mdx_path in sorted(PAGES_DIR.rglob(ext)):
            text = mdx_path.read_text()
            new_text = text
            for old_url, new_url in url_rewrites.items():
                new_text = new_text.replace(old_url, new_url)
            if new_text != text:
                mdx_path.write_text(new_text)
                files_updated += 1

    print(f'Updated {files_updated} MDX/md files')

    # Remove per-page asset directories
    removed = 0
    for asset_dir in per_page_dirs:
        # Remove all files (they've been copied)
        shutil.rmtree(asset_dir)
        removed += 1
        # Clean up empty parent dirs
        parent = asset_dir.parent
        while parent != PUBLIC_DIR:
            try:
                parent.rmdir()  # Only succeeds if empty
                parent = parent.parent
            except OSError:
                break

    print(f'Removed {removed} per-page asset directories')


if __name__ == '__main__':
    main()
