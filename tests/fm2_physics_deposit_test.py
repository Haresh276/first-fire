import hashlib
import json
import unittest
from scripts.fm2_physics_deposit import ROOT, record


class LockedForecastTests(unittest.TestCase):
    def test_sealed_record_still_matches_engine_report(self):
        locked = ROOT / 'site/forecast-lock/fm2-v2.json'
        self.assertEqual(json.dumps(record(), ensure_ascii=False, indent=2) + '\n', locked.read_text())
        comparison = json.loads((ROOT / 'site/forecast-lock/fm2-v1.json').read_bytes())
        self.assertEqual([x['starting_o2_pct'] for x in comparison['predictions']],
                         [x['starting_o2_pct'] for x in record()['predictions']])
        self.assertEqual(hashlib.sha256(locked.read_bytes()).digest(),
                         bytes.fromhex('044b005002cf55d0bf5f93141023243e8639b1487c4271a9c5cb083c98b0239f'))
