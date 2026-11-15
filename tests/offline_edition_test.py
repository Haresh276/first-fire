"""Exercise the split format without rebuilding the entire site."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from offline_edition import AGENCIES, ENGINEERING, EXPERIMENTS, FILM, FILENAME, LIMIT, OPTIONAL, PACK_INDEX, package_offline_site


class OfflineEditionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.expected = {
            'data/raw/measurements.csv': FILENAME,
            'rover-workbench/prototype/scene/drive.mjs': FILENAME,
            'rover-workbench/terrain/reference.geojson': FILENAME,
            'rover-workbench/evidence/files/saffire-i.csv': FILENAME,
            'rover-workbench/evidence/methods.json': FILENAME,
            'rover-workbench/preview/workbench.png': FILENAME,
            'rover-workbench/evidence/files/filter-paper.pdf': EXPERIMENTS,
            'rover-workbench/evidence/files/standard6001.pdf': ENGINEERING,
            'rover-workbench/evidence/files/mbrsc-wheel-traction.pdf': AGENCIES,
            'rover-workbench/preview/rover-workbench.mp4': FILM,
        }
        self.digests = {}
        for name in [*self.expected, 'model.js']:
            source = self.root/name
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(name.encode())
            self.digests[name] = hashlib.sha256(source.read_bytes()).hexdigest()

    def test_merge_reproduces_every_byte_and_download_is_deterministic(self):
        first = package_offline_site(self.root, self.digests)
        self.assertEqual(first, package_offline_site(self.root, {**dict(reversed(self.digests.items())), **first}))
        installed = self.root/'extract'
        for name in [*reversed(OPTIONAL), FILENAME]:
            with ZipFile(self.root/name) as z:
                expected = {'FIRST-FIRE/'+p for p, group in self.expected.items() if group == name}
                if name == FILENAME:
                    expected.update(['FIRST-FIRE/checksums.json', 'FIRST-FIRE/'+PACK_INDEX])
                self.assertEqual(set(z.namelist()), expected)
                z.extractall(installed)
        root = installed/'FIRST-FIRE'
        for file, pack in self.expected.items():
            self.assertEqual((root/file).read_bytes(), (self.root/file).read_bytes())
        self.assertFalse((root/'model.js').exists())
        supplements = json.loads((root/PACK_INDEX).read_text())['supplements']
        core = json.loads((root/'checksums.json').read_text())
        for file, pack in self.expected.items():
            manifest = core if pack == FILENAME else supplements[pack]['files']
            self.assertEqual(manifest[file], self.digests[file])

    def test_distribution_cap_is_enforced(self):
        with patch.dict(LIMIT, {FILENAME: 512}):
            with self.assertRaisesRegex(ValueError, 'must be below'):
                package_offline_site(self.root, self.digests)


if __name__ == '__main__':
    unittest.main()
