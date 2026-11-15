"""Isolated regression fixtures. No fixture represents a NASA flight result."""

import copy
import csv
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import intake as tool


class PsiIntake(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.mirror = self.root / "mirror"
        self.mirror.mkdir()
        self.reference = next(
            s for s in tool.read(tool.RAW / "psi-manifest.json")["investigations"] if s["accession"] == "PSI-98"
        )
        self.meta = {k: self.reference[k] for k in tool.fetch_psi.METADATA_KEYS}
        self.meta["experimentalTable"] = [{k: self.reference["tables"][0][k] for k in tool.fetch_psi.TABLE_KEYS}]
        self.data = (tool.RAW / self.reference["tables"][0]["local_file"]).read_bytes()

    def stage(self, destination="release", base=tool.RAW):
        accession = self.meta["accession"]
        self.meta["experimentalTable"][0]["file_size"] = len(self.data)
        (self.mirror / f"{accession}-1.csv").write_bytes(self.data)
        tool.write(self.mirror / f"{accession}.json", self.meta)
        return tool.psi(self.root / destination, accession, base=base, mirror=self.mirror)

    def test_frozen_census(self):
        census = tool.census(tool.RAW)
        self.assertEqual(census["whole_archive"], {"investigations": 19, "tables": 20, "source_records": 1999})
        self.assertEqual(census["challenge_fifteen"], {"investigations": 15, "tables": 16, "source_records": 1622})
        self.assertEqual(
            census["census_sha256"], "e3612c42a54c3a88ff381a34764ef0d4ce1d02f8823d5ae4ccf30b3d1af354d0"
        )

    def test_known_projection_replays_and_bytes_are_verified(self):
        report = self.stage()
        stage = self.root / "release"
        self.assertEqual((report["row_receipts"], report["normalized_preview"]), (4, 2))
        self.assertEqual(report["origin"], "supplied offline mirror")
        with (stage / "normalized-preview.csv").open(newline="") as stream:
            projected = list(csv.DictReader(stream))
        with (tool.ROOT / "data/tests.csv").open(newline="") as stream:
            pinned = [row for row in csv.DictReader(stream) if row["accession"] == "PSI-98"]
        self.assertEqual(projected, pinned)
        self.assertEqual(tool.verify(stage)["census_sha256"], report["new_census_sha256"])
        with self.assertRaisesRegex(ValueError, "new staging destination"):
            self.stage()
        (stage / "incoming-rows.csv").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "inventory checksum"):
            tool.verify(stage)

    def test_new_version_changed_header_never_auto_promotes(self):
        self.meta["version"] += 1
        self.data = self.data.replace(b"Sample Length (cm)", b"Sample Length (mm)")
        report = self.stage()
        self.assertNotEqual(report["previous_census_sha256"], report["new_census_sha256"])
        self.assertEqual((report["row_receipts"], report["normalized_preview"]), (4, 0))
        again = self.stage("next", self.root / "release/raw")
        self.assertEqual(again["normalized_preview"], 0)
        self.assertEqual(again["new_census_sha256"], report["new_census_sha256"])

    def test_versioned_table_update_can_keep_its_study_version(self):
        self.meta["experimentalTable"][0]["version"] += 1
        self.data = self.data.replace(b"40.6", b"44.6")
        report = self.stage()
        self.assertEqual(report["change"], "new table version")
        self.assertEqual(report["normalized_preview"], 2)
        self.assertNotEqual(report["previous_census_sha256"], report["new_census_sha256"])

    def test_new_accession_retains_provenance_without_guessing_rows(self):
        self.meta.update(
            accession="PSI-999999", doi="10.0000/intake-regression-fixture", title="Local regression fixture"
        )
        report = self.stage()
        self.assertEqual(report["new_counts"], {"investigations": 20, "tables": 21, "source_records": 2003})
        self.assertEqual((report["row_receipts"], report["normalized_preview"]), (4, 0))
        self.assertTrue(report["unmapped_tables"])

    def test_same_version_edit_restriction_and_rollbacks(self):
        self.data = self.data.replace(b"40.6", b"44.6")
        with self.assertRaisesRegex(ValueError, "changed without"):
            self.stage()
        self.meta["restricted"] = True
        with self.assertRaisesRegex(ValueError, "restricted"):
            self.stage()
        self.meta["restricted"] = False
        self.meta["version"] -= 1
        with self.assertRaisesRegex(ValueError, "newer release"):
            self.stage()
        self.assertFalse((self.root / "release").exists())

    def test_csv_use_logical_records_with_quoted_newline(self):
        _, records = tool.csv_table(b'a,b\n"one\ntwo",three\n,\nx,y\n')
        self.assertEqual([i for i, _ in records], [2, 4])
        with self.assertRaisesRegex(ValueError, "column count"):
            tool.csv_table(b"a,b\n1,2,3\n")


class ForecastIntake(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.lock = tool.read(tool.LOCK / "fm2-v1.json")
        self.data = b"Internal test fixture\nTEST-ONE indicates sustained spread beyond the igniter.\nTEST-ONE matched the fixture configuration.\n"
        self.pub = {
            "id": "test",
            "title": "Internal unit test",
            "url": "https://example.nasa.gov/intake-test",
            "published_utc": "2026-11-14T12:58:00Z",
            "sha256": tool.digest(self.data),
            "format": "text",
            "role": "flight_results",
        }
        design = self.lock["design"]
        actual = {
            k: design[k]
            for k in ("material", "pressure_psia", "gravity", "gas", "orientation", "length_cm", "chamber_litres")
        }
        actual.update(starting_o2_pct=37, nominal_initial_conditions=True)
        self.entry = {
            "burn": 1,
            "test_id": "TEST-ONE",
            "reviewer": "Unit test only",
            "rationale": "Test the function",
            "basis": "sustained_beyond_igniter",
            "publication_id": "test",
            "planned_o2_pct": 37,
            "actual": actual,
            "locator": {"line": 2},
            "quote": "indicates sustained spread beyond the igniter",
            "conditions_evidence": {"locator": {"line": 3}, "quote": "TEST-ONE matched the fixture configuration"},
            "measured_travel_cm": 18,
        }
        self.packet = {"forecast_sha256": tool.FORECAST_SHA, "publications": [self.pub], "burns": [self.entry]}

    def replay_fixture(self):
        return tool.resolution(self.lock, self.packet, lambda publication: self.data)

    def test_default_four_pending_and_replay_without_network(self):
        with patch.object(tool, "nasa_bytes", side_effect=AssertionError("unexpected fetch")):
            result = tool.fm2(self.root / "pending")
            receipt = tool.verify(self.root / "pending")
        self.assertEqual((result["n_pending"], receipt["resolved"]), (4, 0))
        self.assertIsNone(result["model_brier"]["resolved_mean"])
        self.assertIsNone(result["length"]["mean_absolute_error_cm"])
        self.assertEqual(result["forecast_sha256"], tool.FORECAST_SHA)
        self.assertEqual(
            receipt["receipt_sha256"], "0fd212203294198d3fab95409450df4b8e3291b58e83809b493af847b244137c"
        )

    def test_timestamp_token_and_source_bytes_pinned(self):
        shutil.copytree(tool.LOCK, self.root / "lock")
        token = self.root / "lock/fm2-v1.tsr"
        token.write_bytes(token.read_bytes()[:-1])
        with self.assertRaisesRegex(ValueError, "timestamp receipt"):
            tool.lock_data(self.root / "lock")
        self.packet["forecast_sha256"] = "a" * 64
        with self.assertRaisesRegex(ValueError, "signed forecast"):
            self.replay_fixture()

    def test_scoring_excludes_pending_and_void_and_uses_frozen_precision(self):
        result = self.replay_fixture()
        self.assertEqual(
            result["model_brier"]["resolved_mean"], (self.lock["predictions"][0]["p_sustain"] - 1) ** 2
        )
        self.assertIsNone(result["model_brier"]["full_four_burn_score"])
        self.assertAlmostEqual(result["project_comparator_brier"]["resolved_mean"], 0.01)
        self.assertEqual(result["length"]["mean_absolute_error_cm"], 2)
        self.entry.update(basis="ambiguous_classification", measured_travel_cm=None)
        result = self.replay_fixture()
        self.assertEqual((result["n_pending"], result["n_void"], result["model_brier"]["n_resolved"]), (3, 1, 0))

    def test_quote_design_id_and_checksum_must_match(self):
        changes = [
            (self.entry, "locator", {"line": 1}, "Quoted passage"),
            (self.entry, "test_id", "DIFFERENT", "test ID"),
            (self.entry["actual"], "pressure_psia", 9, "outside signed design"),
            (self.entry["actual"], "starting_o2_pct", 15, "tolerance"),
            (self.pub, "url", "https://nasa.gov.example.com/file", "official HTTPS NASA"),
            (self.pub, "sha256", "e" * 64, "checksum mismatch"),
            (self.pub, "published_utc", "2026-11-13", "same-day"),
            (self.pub, "published_utc", "2026-11-14T12:00:00Z", "follow the lock"),
        ]
        for obj, key, bad, reason in changes:
            with self.subTest(key=key, value=bad):
                before = obj[key]
                obj[key] = bad
                with self.assertRaisesRegex(ValueError, reason):
                    self.replay_fixture()
                obj[key] = before

    def test_duplicate_outcome_and_positive_travel_contradiction(self):
        self.packet["burns"].append(copy.deepcopy(self.entry))
        with self.assertRaisesRegex(ValueError, "duplicate burn"):
            self.replay_fixture()
        self.packet["burns"].pop()
        self.entry.update(basis="nominal_no_ignition")
        with self.assertRaisesRegex(ValueError, "contradicts"):
            self.replay_fixture()


if __name__ == "__main__":
    unittest.main()
