"""Verify the published FLINT evidence against the immutable downloaded package."""
import csv
import hashlib
import io
import unittest
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'


class Report(HTMLParser):
    def __init__(self):
        super().__init__()
        self.atlas = []
        self.figures = []

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if tag == 'details' and fields.get('class') == 'scenario':
            self.atlas.append(fields)
        if tag == 'img':
            self.figures.append(fields['src'])
            assert fields['alt'].strip()


class FlintReportTest(unittest.TestCase):
    def test_atlas_rows_match_official_tables_including_validity(self):
        report = Report()
        report.feed((SITE/'flint.html').read_text())
        with ZipFile(SITE/'flint/FIRST-FIRE_FLINT-engine.zip') as pack:
            expected = []
            for family in ('solids', 'droplets'):
                archive_name = f'flint-engine/results/micro/atlas_{family}.csv'
                expected.extend(csv.DictReader(io.StringIO(pack.read(archive_name).decode())))
            self.assertEqual(len(report.atlas),len(expected))
            for attrs, row in zip(report.atlas, expected):
                for key in ('gravity','fuel','atmosphere','validity','family','ventilation'):
                    self.assertEqual(attrs['data-'+key],row.get(key,''))
            figures = {name.replace('flint-engine/', 'flint/') for name in pack.namelist() if name.endswith('.png')}
            self.assertEqual(Counter(report.figures),Counter(figures))
            for name in pack.namelist():
                if not name.endswith('/'):
                    self.assertEqual((ROOT/name).read_bytes(),pack.read(name))
                if '/results/' in name and not name.endswith('/'):
                    self.assertEqual((SITE/name.replace('flint-engine/','flint/')).read_bytes(),pack.read(name))

    def test_raw_pack_manifest_still_matches_shipped_psi_data(self):
        with (SITE/'flint/psi-pack-comparison.csv').open() as stream:
            manifest = list(csv.DictReader(stream))
        targets = {row['repository_path'] for row in manifest}
        self.assertEqual(len(manifest),16)
        self.assertEqual(len(targets),16)
        for row in manifest:
            self.assertEqual(row['comparison'],'byte-identical')
            raw = (ROOT/row['repository_path']).read_bytes()
            self.assertEqual(len(raw), int(row['bytes']))
            self.assertEqual(hashlib.sha256(raw).hexdigest(),row['sha256'])
