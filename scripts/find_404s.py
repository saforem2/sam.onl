#!/usr/bin/env python3
"""Crawl the local dev server and find all 404 asset references.

For each page, fetches the HTML, extracts all local src/href references
(images, scripts, stylesheets, links), and checks if they return 200.
"""

import re
import sys
import urllib.request
import urllib.error
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from collections import defaultdict

BASE = 'http://localhost:4321'

class AssetExtractor(HTMLParser):
    """Extract local asset URLs from HTML."""
    def __init__(self):
        super().__init__()
        self.assets = set()
        self.pages = set()

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        # Images
        if tag == 'img':
            src = attrs_dict.get('src', '')
            if src and not src.startswith(('data:', 'http://', 'https://')):
                self.assets.add(src)

        # Links (stylesheets, pages)
        if tag == 'link':
            href = attrs_dict.get('href', '')
            if href and not href.startswith(('data:', 'http://', 'https://')):
                rel = attrs_dict.get('rel', '')
                if 'stylesheet' in rel:
                    self.assets.add(href)

        # Anchors (for crawling pages)
        if tag == 'a':
            href = attrs_dict.get('href', '')
            if href and href.startswith('/') and not href.startswith('//'):
                # Strip fragment
                href = href.split('#')[0]
                if href:
                    self.pages.add(href)

        # Scripts
        if tag == 'script':
            src = attrs_dict.get('src', '')
            if src and not src.startswith(('data:', 'http://', 'https://')):
                self.assets.add(src)

        # Source (video/audio)
        if tag == 'source':
            src = attrs_dict.get('src', '')
            if src and not src.startswith(('data:', 'http://', 'https://')):
                self.assets.add(src)


def fetch(url):
    """Fetch URL, return (status_code, body_text_or_None)."""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'find-404s/1.0'})
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.getcode(), resp.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return 0, None


def get_all_pages():
    """Get all page URLs by crawling from root."""
    visited = set()
    to_visit = {'/'}
    all_pages = set()

    while to_visit:
        path = to_visit.pop()
        if path in visited:
            continue
        visited.add(path)

        url = BASE + path
        status, html = fetch(url)
        if status != 200 or not html:
            continue

        all_pages.add(path)
        parser = AssetExtractor()
        parser.feed(html)

        for page_path in parser.pages:
            if page_path not in visited:
                to_visit.add(page_path)

    return sorted(all_pages)


def main():
    print('Crawling site to discover pages...')
    pages = get_all_pages()
    print(f'Found {len(pages)} pages. Checking assets...\n')

    checked = set()
    broken = defaultdict(list)  # url -> list of pages referencing it

    for page_path in pages:
        url = BASE + page_path
        status, html = fetch(url)
        if status != 200 or not html:
            continue

        parser = AssetExtractor()
        parser.feed(html)

        for asset_ref in parser.assets:
            asset_url = urljoin(url + '/', asset_ref) if not asset_ref.startswith('/') else BASE + asset_ref

            if asset_url in checked:
                # Already checked — if it was broken, it's already recorded
                parsed = urlparse(asset_url)
                if parsed.path in [urlparse(u).path for u in broken]:
                    broken_key = next(u for u in broken if urlparse(u).path == parsed.path)
                    if page_path not in broken[broken_key]:
                        broken[broken_key].append(page_path)
                continue

            checked.add(asset_url)
            a_status, _ = fetch(asset_url)
            if a_status != 200:
                broken[asset_url].append(page_path)
                sys.stdout.write(f'  [{a_status}] {urlparse(asset_url).path}\n')
                sys.stdout.flush()

    print(f'\n{"=" * 60}')
    if broken:
        print(f'Found {len(broken)} broken asset(s):\n')
        for asset_url, pages_list in sorted(broken.items()):
            path = urlparse(asset_url).path
            print(f'  404: {path}')
            for p in pages_list:
                print(f'       referenced by: {p}')
            print()
    else:
        print('No broken assets found!')


if __name__ == '__main__':
    main()
