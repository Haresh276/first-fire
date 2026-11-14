"""Acquire public metadata and experimental CSVs. A fresh output directory protects old snapshots."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ACCESSIONS = (10, 20, 21, 22, 23, 25, 26, 39, 68, 69, 98, 99, 100, 101, 102, 106, 107, 115, 159)
BASE = "https://psi.nasa.gov/geode-py/ws/"
METADATA_KEYS = ("accession", "title", "investigationAcronym", "version", "doi", "modifiedDate", "releaseDate",
                 "licenseIdentifier", "licenseLink", "projectType", "flightProgram", "experimentHardware",
                 "objective", "approach", "public", "restricted")
TABLE_KEYS = ("file_name", "file_size", "version", "restricted", "visible")


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "FIRST-FIRE-data/1.0"}), timeout=60) as response:
        return response.read()


def remote_csv(url):
    body = fetch(url)
    if body.lstrip().startswith(b"{"):
        values = json.loads(body).values()
        links = [v for v in values if isinstance(v, str) and v.startswith("https://")]
        if len(links) != 1:
            raise ValueError("Unrecognized PSI file response")
        body = fetch(links[0])
    elif body.lstrip().startswith(b"https://"):
        body = fetch(body.decode().strip())
    return body


def snapshot(output, source_dir=None, acquired=None):
    if output.exists() and any(output.iterdir()):
        raise ValueError("Use an empty output directory for the new snapshot")
    output.mkdir(parents=True, exist_ok=True)
    records = []
    for n in ACCESSIONS:
        accession = f"PSI-{n}"
        url = BASE + "repo/investigations/" + accession
        raw_meta = (source_dir / f"{accession}.json").read_bytes() if source_dir else fetch(url)
        meta = json.loads(raw_meta)
        if meta["accession"] != accession or not meta["public"] or meta["restricted"]:
            raise ValueError(f"Unexpected record: {accession}")
        entry = {key: meta[key] for key in METADATA_KEYS}
        entry.update(metadata_url=url, metadata_response_sha256=hashlib.sha256(raw_meta).hexdigest(), tables=[])
        for i, t in enumerate(meta.get("experimentalTable") or [], 1):
            if not t["visible"] or t["restricted"] or not t["file_name"].lower().endswith(".csv"):
                continue
            query = urlencode({"file": t["file_name"], "version": t["version"], "studyVersion": meta["version"]})
            download = BASE + f"studies/{accession}/download?" + query
            data = (source_dir / f"{accession}-{i}.csv").read_bytes() if source_dir else remote_csv(download + "&redirect=false")
            if len(data) != t["file_size"]:
                raise ValueError(f"File size mismatch for {t['file_name']}")
            path = f"{accession}-experimental" + (f"-{i}" if i > 1 else "") + ".csv"
            (output / path).write_bytes(data)
            table = {key: t[key] for key in TABLE_KEYS}
            entry["tables"].append(dict(table, local_file=path, download_url=download,
                                        sha256=hashlib.sha256(data).hexdigest()))
        records.append(entry)
    manifest = {"retrieved_utc": acquired or datetime.now(timezone.utc).date().isoformat(),
                "metadata_projection": list(METADATA_KEYS), "investigations": records}
    (output / "psi-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source-dir", type=Path, help="reuse unmodified downloads named PSI-N.json and PSI-N-I.csv")
    parser.add_argument("--retrieved-utc", help="original acquisition date when importing existing downloads")
    args = parser.parse_args()
    snapshot(args.output, args.source_dir, args.retrieved_utc)
