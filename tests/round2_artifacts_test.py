"""Check the judge-facing files against the engine and the timed walkthrough."""
import json
from pathlib import Path
import re
import unittest
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}


class Round2Artifacts(unittest.TestCase):
    def test_engine_table_and_rover_results(self):
        with ZipFile(ROOT / "site/master-round2-slides.pptx") as deck:
            presentation = ET.fromstring(deck.read("ppt/presentation.xml"))
            slide_ids = presentation.findall("p:sldIdLst/p:sldId", NS)
            self.assertEqual(len(slide_ids), 13)
            flint_slide = ET.fromstring(deck.read("ppt/slides/slide7.xml"))
            rover_slide = ET.fromstring(deck.read("ppt/slides/slide8.xml"))

        def slide_text(slide):
            return " ".join(node.text or "" for node in slide.findall(".//a:t", NS))

        self.assertIn("FLINT, the engine", slide_text(flint_slide))
        table = flint_slide.find(".//a:tbl", NS)
        self.assertIsNotNone(table)
        rows = [[slide_text(cell) for cell in row.findall("a:tc", NS)]
                for row in table.findall("a:tr", NS)]
        core = json.loads((ROOT / "flint-engine/results/core/results.json").read_text())
        self.assertEqual(len(rows) - 1, len(core["lunar"]))
        for actual, value in zip(rows[1:], core["lunar"].values()):
            self.assertEqual(actual[1], f"{100*value['observed']:.1f}%")
            self.assertEqual(actual[2], f"{100*value['flint_loo']:.1f}%")
            self.assertEqual(actual[3].replace("−", "-"), f"{100*value['loo_error']:+.1f}")

        copy = slide_text(rover_slide)
        self.assertIn("Why a rover: the hardest fire case", copy)
        rover = json.loads((ROOT / "flint-engine/results/rover/rover_case.json").read_text())
        responses = {r["material"]: r for r in rover["responses"]}
        self.assertIn(f"{responses['NOMEX']['vent']['P_psia']:.1f} psia", copy)
        self.assertIn(f"{responses['NOMEX']['co2']['kg']:.1f} kg", copy)
        self.assertIn(f"{responses['PMMA']['timeline']['t_hrr_10kW_s']:.1f} s", copy)

    def test_run_sheet_matches_rehearsal_clock(self):
        guide = (ROOT / "site/field-guide.js").read_text()
        rows = json.loads(re.search(r"const rehearsal=(\[.*?\]);", guide, re.S).group(1))
        sheet = (ROOT / "site/master-round2.html").read_text()
        self.assertEqual(len(rows), 13)
        self.assertEqual([r[-1] for r in rows[6:8]], ["flint.html", "rover-fire-case.html"])
        self.assertNotIn("vehicle-designer", str(rows))
        start = 0
        for index, (seconds, speaker, title, *_) in enumerate(rows, 1):
            end = start + seconds
            label = f"{start//60}:{start%60:02d}–{end//60}:{end%60:02d}"
            self.assertIn(f"<td>{index}</td><td>{label}</td><td>{speaker}</td>", sheet)
            self.assertIn(title, sheet)
            start = end
        self.assertLess(start, 12 * 60)
