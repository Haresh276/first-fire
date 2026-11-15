"""Rebuild or verify the offline source index from the reviewed agency records."""
import argparse
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AGENCIES = "GGPEN CONAE BSA AEB CSA ESA ISRO ASI JAXA KASA NASRDA AEP ASES AEE TUA MBRSC UKSA".split()


class RosterParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.headings = []
        self.inside = False

    def handle_starttag(self, tag, attrs):
        if tag == "h4" and "cta-tile" in dict(attrs).get("class", ""):
            self.inside = True
            self.headings.append("")

    def handle_data(self, data):
        if self.inside:
            self.headings[-1] += data

    def handle_endtag(self, tag):
        if tag == "h4":
            self.inside = False


def read(path):
    return json.loads((ROOT / path).read_text())


def compile_catalogue():
    roster = RosterParser()
    roster.feed((ROOT / "evidence/files/partner-roster-2026.html").read_text())
    assert len(roster.headings) == len(AGENCIES)
    partners = [rec for group in "abc" for rec in read(f"evidence/partners-{group}.json")]
    assert {rec["agency"] for rec in partners} == {"NASA", *AGENCIES}
    records = partners + read("evidence/methods.json")
    ids = {row["id"] for row in records}
    assert len(ids) == len(records), "Duplicate source ID"
    archived = set()
    for row in records:
        assert all(row[k] for k in ("title", "url", "locator", "role", "conditions", "supports", "limits", "evidenceClass")), row["id"]
        assert row["url"].startswith("https://"), row["id"]
        for quantity in row["quantities"]:
            assert quantity["quantity"] and quantity["unit"] and quantity["value"] is not None
        name = row["localFile"]
        row["checkedOn"] = "2026-11-15"
        row["sha256"] = None
        row["bytes"] = None
        if name:
            path = ROOT / name
            assert path.resolve().parent == (ROOT / "evidence/files").resolve(), name
            payload = path.read_bytes()
            if path.suffix == ".pdf":
                assert payload.startswith(b"%PDF-") and b"%%EOF" in payload[-2048:], name
            if path.suffix == ".html":
                assert b"<html" in payload.lower(), name
            assert payload, name
            row["bytes"] = len(payload)
            row["sha256"] = hashlib.sha256(payload).hexdigest()
            archived.add(path.name)
    assert archived == {p.name for p in (ROOT / "evidence/files").iterdir() if p.is_file()}, "Unindexed source file"
    parts = read("parts.json")["parts"]
    selectors = read("scenario.schema.json")["properties"]["parts"]["properties"]
    assert len(parts) == len({p["id"] for p in parts})
    for slot, selector in selectors.items():
        assert set(selector["enum"]) == {p["id"] for p in parts if p["slot"] == slot}
    for part in parts:
        assert set(part["sourceIds"]) <= ids, part["id"]
    return {"version": "1.0", "asOf": "2026-11-15", "lead": "NASA",
            "partners": dict(zip(AGENCIES, roster.headings)), "sources": records}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Regenerate sources.json after reviewing source changes.")
    args = parser.parse_args()
    result = compile_catalogue()
    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    target = ROOT / "sources.json"
    if args.write:
        target.write_text(output)
    elif target.read_text() != output:
        raise SystemExit("Stale source catalogue. Review changes and run with --write.")
    counts = result["sources"]
    print(f'{len(result["partners"])} partners + NASA | {len(counts)} records | {sum(bool(r["localFile"]) for r in counts)} local source records')
