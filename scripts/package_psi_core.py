"""Rebuild the challenge pack offline. --refresh queries NASA and refreshes a compact source receipt."""

import argparse
import csv
import gzip
import hashlib
import io
import json
import os
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import urlencode
from urllib.request import Request
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

import fetch_psi
from intake import CORE, csv_table

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
CACHE = RAW / "psi-core-file-census.json.gz"
OUTPUT = ROOT / "site/challenge-data-pack.zip"
ENDPOINT = fetch_psi.BASE + "files/v2"
VIDEO = {".avi", ".mp4", ".mov", ".m4v", ".webm", ".wmv", ".mpg", ".mpeg", ".mkv", ".m2v", ".m2ts", ".mts", ".vob"}
KINDS = {
    "video": VIDEO,
    "archive": {".zip", ".gz", ".tar", ".7z", ".rar", ".bz2"},
    "image": {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".gif", ".bmp", ".fits"},
    "table": {".csv", ".tsv", ".xls", ".xlsx", ".ods"},
    "document": {".txt", ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".rtf"},
}
ROW_FIELDS = ["source_path", "file_version", "bytes", "category", "subcategory"]
FILE_HEADER = [
    "accession",
    "doi",
    "study_version",
    "name",
    *ROW_FIELDS,
    "extension",
    "file_class",
    "versioned_nasa_url",
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n").encode()


def csv_bytes(headers, rows):
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return stream.getvalue().encode()


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temp = Path(handle.name)
        handle.write(data)
    try:
        temp.chmod(0o644)
        os.replace(temp, path)
    finally:
        temp.unlink(missing_ok=True)


def request_params(study):
    return {
        "folder": study["accession"] + "/",
        "fileType": "study",
        "studyId": study["accession"],
        "version": study["version"],
        "obfuscationcode": "",
    }


def leaf_files(nodes):
    for node in nodes:
        if node.get("directory") is False:
            if node.get("files"):
                raise ValueError("File entry unexpectedly has children")
            yield node
        else:
            children = node.get("files")
            if not isinstance(children, list):
                raise ValueError("Unknown NASA file-list entry")
            yield from leaf_files(children)


def packed_row(acc, key, version, size, category, subcategory):
    if not isinstance(key, str) or not key.startswith("psi-data/" + acc + "/"):
        raise ValueError(f"File key does not belong to {acc}: {key}")
    if (
        type(version) is not int
        or version < 1
        or not isinstance(size, (int, float))
        or int(size) != size
        or size < 0
    ):
        raise ValueError(f"Invalid published file version or size: {key}")
    return [key, version, int(size), category, subcategory or ""]


def refreshed_study(study, mirror=None):
    """A mirror is used only to ingest a saved byte capture from this same network protocol."""
    acc = study["accession"]
    metadata = (
        (mirror / (acc + ".metadata.json")).read_bytes() if mirror else fetch_psi.fetch(study["metadata_url"])
    )
    meta = json.loads(metadata)
    if (meta["accession"], meta["version"], meta["doi"], meta["public"], meta["restricted"]) != (
        acc,
        study["version"],
        study["doi"],
        True,
        False,
    ):
        raise ValueError("Release identity or visibility changed for " + acc)
    params = request_params(study)
    if mirror:
        listing = (mirror / (acc + ".files.json")).read_bytes()
    else:
        from urllib.request import urlopen

        request = Request(
            ENDPOINT,
            data=json_bytes(params),
            headers={"Content-Type": "application/json", "User-Agent": "FIRST-FIRE-archive-audit/1.0"},
        )
        with urlopen(request, timeout=90) as response:
            listing = response.read()
    public_tree = []
    hidden_tree = 0
    for node in leaf_files(json.loads(listing)["files"]):
        if node.get("restricted") is not False or node.get("restrictedAccess") or node.get("visible") is not True:
            hidden_tree += 1
            continue
        public_tree.append(
            packed_row(
                acc,
                node["key"],
                node["version"],
                node["bytes_size"],
                node.get("sortingCategory", ""),
                node.get("subcategory"),
            )
        )
    additions = []
    hidden_added = 0
    for node in meta["added"]:
        if node.get("restricted") is not False or node.get("visible") is not True:
            hidden_added += 1
            continue
        key = node["s3_path"]
        if PurePosixPath(key).name != node["file_name"]:
            raise ValueError("Metadata filename and public key differ: " + key)
        additions.append(
            packed_row(acc, key, node["version"], node["file_size"], key.split("/")[2], node.get("subcategory"))
        )
    tree = {(PurePosixPath(key).name, version, size) for key, version, size, _, _ in public_tree}
    tables = []
    for tab in study["tables"]:
        if (tab["file_name"], tab["version"], tab["file_size"]) not in tree:
            raise ValueError("Versioned experimental table absent from NASA tree: " + tab["file_name"])
        if not any(
            t["file_name"] == tab["file_name"] and t["version"] == tab["version"]
            for t in meta["experimentalTable"]
        ):
            raise ValueError("Table version disagrees with fresh metadata for " + acc)
        body = (
            (mirror / tab["local_file"]).read_bytes()
            if mirror
            else fetch_psi.remote_csv(tab["download_url"] + "&redirect=false")
        )
        local = (RAW / tab["local_file"]).read_bytes()
        if body != local or sha(body) != tab["sha256"] or len(body) != tab["file_size"]:
            raise ValueError("Independent NASA table download differs for " + tab["file_name"])
        tables.append(
            {
                "file": tab["local_file"],
                "published_name": tab["file_name"],
                "table_version": tab["version"],
                "fresh_download_sha256": sha(body),
                "repository_sha256": sha(local),
                "bytes": len(body),
                "source_url": tab["download_url"],
                "nonempty_source_records": len(csv_table(body)[1]),
            }
        )
    return {
        "accession": acc,
        "doi": meta["doi"],
        "study_version": meta["version"],
        "metadata_url": study["metadata_url"],
        "metadata_response_sha256": sha(metadata),
        "file_list_request": params,
        "file_list_response_sha256": sha(listing),
        "excluded_nonpublic_file_list_entries": hidden_tree,
        "excluded_nonpublic_additions": hidden_added,
        "release_additions": sorted(additions),
        "file_tree": sorted(public_tree),
        "independent_tables": tables,
    }


def sources():
    original = json.loads((RAW / "psi-manifest.json").read_bytes())
    studies = sorted(
        (s for s in original["investigations"] if s["accession"] in CORE), key=lambda s: int(s["accession"][4:])
    )
    if len(studies) != 15 or {s["accession"] for s in studies} != CORE:
        raise ValueError("Expected the 15 named core investigations")
    return original, studies


def refresh(mirror=None):
    _, studies = sources()
    with ThreadPoolExecutor(max_workers=4) as pool:
        retrieved = list(pool.map(lambda s: refreshed_study(s, mirror), studies))
    stamp = (
        (mirror / "retrieved-utc.txt").read_text().strip() if mirror else datetime.now(timezone.utc).isoformat()
    )
    payload = {
        "schema": "first-fire.nasa-psi-file-snapshot.v1",
        "retrieved_utc": stamp,
        "file_list_endpoint": ENDPOINT,
        "row_fields": ROW_FIELDS,
        "investigations": retrieved,
    }
    atomic(CACHE, gzip.compress(json_bytes(payload), compresslevel=9, mtime=0))


def classify(name):
    extension = PurePosixPath(name).suffix.lower()
    return extension, next((category for category, endings in KINDS.items() if extension in endings), "other")


def inventory(study, rows):
    output = []
    for key, version, size, category, subcategory in rows:
        name = PurePosixPath(key).name
        ext, kind = classify(name)
        link = (
            fetch_psi.BASE
            + "studies/"
            + study["accession"]
            + "/download?"
            + urlencode({"file": name, "version": version, "studyVersion": study["study_version"]})
        )
        output.append(
            [
                study["accession"],
                study["doi"],
                study["study_version"],
                name,
                key,
                version,
                size,
                category,
                subcategory,
                ext,
                kind,
                link,
            ]
        )
    return output


def counts(rows):
    versioned = {(row[0], row[4], row[5]): row for row in rows}
    paths = {(row[0], row[4]): row for row in rows}
    return {
        "listed_file_entries": len(rows),
        "listed_video_entries": sum(row[-2] == "video" for row in rows),
        "distinct_versioned_files": len(versioned),
        "distinct_versioned_videos": sum(row[-2] == "video" for row in versioned.values()),
        "distinct_paths": len(paths),
        "distinct_video_paths": sum(row[-2] == "video" for row in paths.values()),
        "by_extension": dict(sorted(Counter(row[-3] for row in rows).items())),
        "by_class": dict(sorted(Counter(row[-2] for row in rows).items())),
    }


def create(output=OUTPUT):
    original, studies = sources()
    cached = json.loads(gzip.decompress(CACHE.read_bytes()))
    if cached["row_fields"] != ROW_FIELDS or cached["file_list_endpoint"] != ENDPOINT:
        raise ValueError("Unreadable inventory snapshot")
    fetched = {s["accession"]: s for s in cached["investigations"]}
    if set(fetched) != CORE or len(cached["investigations"]) != len(CORE):
        raise ValueError("Inventory does not cover all core studies")
    files, checked, additions, tree, per_study, inventory_rows = {}, [], [], [], [], []
    for s in studies:
        f = fetched[s["accession"]]
        if (f["study_version"], f["doi"], f["file_list_request"]) != (s["version"], s["doi"], request_params(s)):
            raise ValueError("Reacquire the source release for " + s["accession"])
        release_files = inventory(f, f["release_additions"])
        listed_files = inventory(f, f["file_tree"])
        additions.extend(release_files)
        tree.extend(listed_files)
        a, t = counts(release_files), counts(listed_files)
        per_study.append(
            [
                s["accession"],
                s["doi"],
                s["version"],
                a["listed_file_entries"],
                a["listed_video_entries"],
                t["listed_file_entries"],
                t["listed_video_entries"],
                t["distinct_versioned_files"],
                t["distinct_paths"],
            ]
        )
        tables = {tab["file"]: tab for tab in f["independent_tables"]}
        if set(tables) != {tab["local_file"] for tab in s["tables"]}:
            raise ValueError("Independent fetch receipts do not match the source table list")
        for tab in s["tables"]:
            name = tab["local_file"]
            body = (RAW / name).read_bytes()
            receipt = tables[name]
            actual = sha(body)
            if (
                actual != receipt["fresh_download_sha256"]
                or actual != receipt["repository_sha256"]
                or actual != tab["sha256"]
            ):
                raise ValueError("Table digest disagrees with independent receipt: " + name)
            if (receipt["table_version"], receipt["source_url"], receipt["bytes"]) != (
                tab["version"],
                tab["download_url"],
                len(body),
            ):
                raise ValueError("Invalid table identity: " + name)
            rows = len(csv_table(body)[1])
            if rows != receipt["nonempty_source_records"]:
                raise ValueError("Row census changed for " + name)
            try:
                body.decode("utf-8-sig")
                encoding = "UTF-8 BOM" if body.startswith(b"\xef\xbb\xbf") else "UTF-8"
            except UnicodeDecodeError:
                encoding = "Windows-1252"
            inventory_rows.append(
                [
                    s["accession"],
                    s["doi"],
                    s["version"],
                    tab["version"],
                    name,
                    rows,
                    len(body),
                    encoding,
                    actual,
                    tab["download_url"],
                ]
            )
            checked.append(
                [
                    s["accession"],
                    s["version"],
                    tab["version"],
                    name,
                    rows,
                    len(body),
                    tab["sha256"],
                    receipt["fresh_download_sha256"],
                    tab["download_url"],
                ]
            )
            files["tables/" + name] = body
    source_rows = sum(r[4] for r in checked)
    if (len(checked), source_rows) != (16, 1622):
        raise ValueError("The frozen core table census changed")
    summary = {
        "status": "independently verified NASA versioned downloads",
        "retrieved_utc": cached["retrieved_utc"],
        "study_count": len(studies),
        "table_count": len(checked),
        "source_records": source_rows,
        "release_additions": counts(additions),
        "full_public_file_tree": counts(tree),
        "historical_report": {"files": 8285, "videos": 566, "original_T5_available": False},
        "historical_counts_reproduced_from_additions": (len(additions), counts(additions)["listed_video_entries"])
        == (8285, 566),
        "source_receipts": [
            {k: v for k, v in s.items() if k not in {"release_additions", "file_tree", "independent_tables"}}
            for s in fetched.values()
        ],
        "file_list_method": "POST " + ENDPOINT,
        "video_filename_extensions": sorted(VIDEO),
    }
    files["archive-summary.json"] = json_bytes(summary)
    files["release-additions.csv"] = csv_bytes(FILE_HEADER, additions)
    files["complete-public-file-tree.csv"] = csv_bytes(FILE_HEADER, tree)
    files["per-study-census.csv"] = csv_bytes(
        [
            "accession",
            "doi",
            "study_version",
            "added_files",
            "added_videos",
            "tree_entries",
            "tree_video_entries",
            "distinct_versioned_files",
            "distinct_paths",
        ],
        per_study,
    )
    files["independent-table-checks.csv"] = csv_bytes(
        [
            "accession",
            "study_version",
            "file_version",
            "file",
            "nonempty_source_rows",
            "bytes",
            "repository_sha256",
            "new_nasa_download_sha256",
            "versioned_nasa_url",
        ],
        checked,
    )
    files["inventory.csv"] = csv_bytes(
        [
            "accession",
            "doi",
            "study_version",
            "file_version",
            "file",
            "nonempty_source_rows",
            "bytes",
            "decoding_for_census",
            "sha256",
            "official_url",
        ],
        inventory_rows,
    )
    files["metadata.json"] = json_bytes({"retrieved": original["retrieved_utc"], "investigations": studies})
    a = summary["release_additions"]
    t = summary["full_public_file_tree"]
    files["README.txt"] = (
        f"""FIRST FIRE · NASA PSI challenge archive
Acquired {cached["retrieved_utc"]}. The 15 core investigations contain 16 original experimental CSVs
and {source_rows:,} nonempty source records. Independent downloads of all 16 matched the frozen
repository bytes. independent-table-checks.csv pairs each new digest with its original digest.

release-additions.csv reproduces the release changelogs: {a["listed_file_entries"]:,} public file entries,
including {a["listed_video_entries"]:,} videos by filename. The master document reported 8,285 and 566.
complete-public-file-tree.csv walks the separate versioned inventory returned to NASA's browser:
{t["listed_file_entries"]:,} leaf entries, {t["listed_video_entries"]:,} video entries, {t["distinct_versioned_files"]:,} distinct accession/path/versions,
and {t["distinct_paths"]:,} distinct accession/paths. Entries appearing twice in returned folders are retained.
A ZIP counts as one archive; classifying names does not inspect its members. Only the original
experimental CSV contents are bundled. Access flags and release versions are checked.
archive-summary.json gives extension counts, exact requests, response SHA-256 hashes and
the distinction between release additions and the complete published tree. The historical
team ZIP T5 was unavailable for an independent comparison to that specific file.

Check the package after extracting with shasum -a 256 -c SHA256SUMS.txt.
Rebuild offline: python3 scripts/package_psi_core.py
Repeat the NASA source requests: python3 scripts/package_psi_core.py --refresh
Read inventory.csv for decoding, source locators and row counts. Count each nonempty
logical CSV record following its header once. NASA metadata, flow checks and repeated
settings can produce source records without a separately identifiable test.
"""
    ).encode()
    files["SHA256SUMS.txt"] = "".join(
        sha(body) + "  " + name + "\n" for name, body in sorted(files.items())
    ).encode()
    stream = io.BytesIO()
    with ZipFile(stream, "w") as archive:
        for name, body in sorted(files.items()):
            info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            archive.writestr(info, body, compress_type=ZIP_DEFLATED)
    atomic(output, stream.getvalue())
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Reacquire the 15 public listings, metadata and 16 versioned experimental CSVs",
    )
    options = parser.parse_args()
    if options.refresh:
        refresh()
    result = create()
    for key in ("release_additions", "full_public_file_tree"):
        count = result[key]
        print(
            f"{key}: {count['listed_file_entries']:,} file entries, {count['listed_video_entries']:,} videos, {count['distinct_paths']:,} distinct paths"
        )
    print(
        f"{result['table_count']} independent table SHA-256 matches, {result['source_records']:,} nonempty records"
    )
