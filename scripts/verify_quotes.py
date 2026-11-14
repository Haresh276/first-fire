"""Verify case quotations against page fingerprints, optionally against the original publications.

Default is offline, standard library only. --originals DIR independently regenerates
page fingerprints from publisher files; PDF extraction requires pypdf. --fetch
retrieves originals and verifies them in memory. --query ANCHOR QUOTE tests one
candidate. Fingerprints authenticate text location, not scientific interpretation.
"""
from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import sys
import unicodedata
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'data' / 'evidence' / 'pages.json'
CASES = ROOT / 'data' / 'cases.json'


def sha(value):
    return hashlib.sha256(value).hexdigest()


def tokens(text):
    return unicodedata.normalize('NFKC', text).replace('\u00ad', '').split()


def fingerprints(text):
    return [sha(word.encode()) for word in tokens(text)]


def hit(page, quote):
    needle = fingerprints(quote)
    return bool(needle) and any(page[i:i + len(needle)] == needle for i in range(len(page) - len(needle) + 1))


class SectionText(HTMLParser):
    """Extract visible paragraph text inside one HTML section, including inline links."""
    def __init__(self, target_id):
        super().__init__(convert_charrefs=True)
        self.target_id = target_id
        self.depth = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == 'section' and (self.depth or dict(attrs).get('id') == self.target_id):
            self.depth += 1
        if self.depth and tag in ('p','h2','h3','li','br','td','figcaption'):
            self.parts.append(' ')

    def handle_endtag(self, tag):
        if self.depth and tag == 'section':
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.parts.append(data)


def extract(content, source, anchor):
    if source['format'] == 'html':
        parser = SectionText(anchor['section_id'])
        parser.feed(content.decode())
        return ''.join(parser.parts)
    from pypdf import PdfReader
    reader = PdfReader(BytesIO(content))
    return reader.pages[anchor['page'] - 1].extract_text()


def compare_snapshots(evidence, directory, fetch):
    @lru_cache(None)
    def content_for(key):
        source = evidence['documents'][key]
        if directory:
            return (directory / source['filename']).read_bytes()
        request = Request(source['url'], headers={'User-Agent':'FIRST-FIRE/source-verification'})
        with urlopen(request, timeout=90) as response:
            return response.read()

    failures = []
    for key, anchor in evidence['anchors'].items():
        sid = anchor['document']
        source = evidence['documents'][sid]
        content = content_for(sid)
        if sha(content) != source['sha256']:
            # A PMC HTML page can acquire a different navigation banner independently
            # of its article. Report byte-level mismatch too, never silently accept it.
            failures.append(f'{sid}: publisher file digest differs from pinned version')
        if fingerprints(extract(content, source, anchor)) != anchor['tokens']:
            failures.append(f'{key}: extracted page/section differs from pinned version')
    return list(dict.fromkeys(failures))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--originals', type=Path, help='directory of originals named as in pages.json')
    group.add_argument('--fetch', action='store_true', help='re-fetch pinned source URLs and compare content')
    parser.add_argument('--query', nargs=2, metavar=('ANCHOR','QUOTE'))
    args = parser.parse_args()
    evidence = json.loads(EVIDENCE.read_text())
    anchors = evidence['anchors']
    if args.query:
        key, text = args.query
        ok = key in anchors and hit(anchors[key]['tokens'], text)
        print('Present on the cited page/section.' if ok else 'No exact occurrence on the cited page/section.')
        return 0 if ok else 1

    errors = []
    total = 0
    for case in json.loads(CASES.read_text()):
        for source in case['sources']:
            if 'quote' not in source:
                continue
            total += 1
            key = source['anchor']
            if key not in anchors:
                errors.append(f'{key}: unknown anchor')
                continue
            anchor = anchors[key]
            if source['url'].split('#')[0].split('?')[0] != evidence['documents'][anchor['document']]['canonical_url']:
                errors.append(f'{key}: incorrect source URL')
            if not hit(anchor['tokens'], source['quote']):
                errors.append(f'{key}: quote missing')
    used = {s['anchor'] for case in json.loads(CASES.read_text()) for s in case['sources'] if 'anchor' in s}
    if used != set(anchors) or total != evidence['expected_quotations']:
        errors.append('Missing or orphaned pinned quotations')
    # Includes a negation edit and a real quote deliberately cited to the wrong page.
    canaries = [
        ('saff25','Despite this significant heating load, the fabric was ignited.'),
        ('luci34','1-g extinction happens ~ 450 seconds sooner than partial-g extinction'),
        ('ices10','Despite this significant heating load, the fabric was not ignited.'),
        ('flex154','behavior is indicative of cool flame burning and extinction.'),
    ]
    for key, fake in canaries:
        if hit(anchors[key]['tokens'], fake):
            errors.append(f'{key}: planted incorrect quote was accepted')
    if args.originals or args.fetch:
        errors.extend(compare_snapshots(evidence, args.originals, args.fetch))
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'{total} quotations located; {len(canaries)} altered or misattributed quotations rejected.')
    if args.originals or args.fetch:
        print('All source file hashes and extracted pages/sections match the original snapshots.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
