"""Stage a published PSI release or bind NASA FM² resolutions to the signed v1 bytes."""

import argparse
import csv
import hashlib
import io
import json
import math
import re
import shutil
import ssl
import subprocess
import tempfile
import unicodedata
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

import build_data
import fetch_psi
import forecast

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
LOCK = ROOT / "site/forecast-lock"
FORECAST_SHA = "9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3"
TIMESTAMP_SHA = "5f023603b8c9beaa792e672efdb0dc7c40c87a50f1ff1a26bf7bd4dd5ea41c66"
CORE = {f"PSI-{n}" for n in [107, 159, 69, 25, 26, 101, 39, 22, 20, 99, 106, 68, 102, 98, 100]}
ACC = re.compile(r"PSI-[1-9]\d*\Z")
SHA = re.compile(r"[a-f0-9]{64}\Z")
DOI = re.compile(r"10\.\d{4,9}/\S+\Z", re.IGNORECASE)
MAX_BYTES = 64 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf8")


def read(path):
    return json.loads(path.read_text(encoding="utf8"))


def write(path, data):
    path.write_bytes(json.dumps(data, ensure_ascii=False, allow_nan=False, indent=2).encode("utf8") + b"\n")


def require(ok, msg):
    if not ok:
        raise ValueError(msg)


def positive_int(value):
    return type(value) is int and value > 0


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def safename(name):
    require(
        isinstance(name, str) and name not in ("", ".", "..") and Path(name).name == name and "\\" not in name,
        "Invalid local file name",
    )
    return name


def checked_sha(value):
    require(
        isinstance(value, str) and SHA.fullmatch(value),
        "Expected a lowercase SHA-256 digest",
    )
    return value


def published_day(text):
    for fmt in ("%Y-%m-%d", "%d-%b-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except (TypeError, ValueError):
            pass
    raise ValueError("A NASA publication date is required")


def nasa(url):
    parsed = urlsplit(url)
    require(
        parsed.scheme == "https"
        and parsed.hostname
        and (parsed.hostname == "nasa.gov" or parsed.hostname.endswith(".nasa.gov"))
        and not parsed.username
        and not parsed.password
        and parsed.port in (None, 443),
        "An official HTTPS NASA publication URL is required",
    )
    return url


def nasa_bytes(url):
    with urlopen(
        Request(nasa(url), headers={"User-Agent": "FIRST-FIRE-publication-intake/1.0"}),
        timeout=60,
    ) as response:
        nasa(response.geturl())
        body = response.read(MAX_BYTES + 1)
    require(0 < len(body) <= MAX_BYTES, "Publication must be nonempty and at most 64 MiB")
    return body


@contextmanager
def staging(output):
    output = Path(output).resolve()
    require(not output.exists(), "Use a new staging destination")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".first-fire-", dir=output.parent) as folder:
        tmp = Path(folder) / "stage"
        tmp.mkdir()
        yield tmp
        require(not output.exists(), "Another process created the staging destination")
        tmp.rename(output)


def csv_table(data):
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1252")
    rows = list(csv.reader(io.StringIO(text, newline=""), strict=True))
    require(rows and rows[0] and any(c.strip() for c in rows[0]), "Missing CSV header")
    records = []
    for i, row in enumerate(rows[1:], 2):
        if not any(cell.strip() for cell in row):
            continue
        require(
            len(row) == len(rows[0]),
            "CSV column count changed at source record " + str(i),
        )
        records.append((i, row))
    return rows[0], records


def census(raw):
    manifest = read(raw / "psi-manifest.json")
    studies = []
    seen = set()
    files = set()
    for study in sorted(manifest["investigations"], key=lambda s: s["accession"]):
        acc = study["accession"]
        require(
            ACC.fullmatch(acc) and acc not in seen and study["public"] is True and study["restricted"] is False,
            "Invalid, duplicate, or restricted accession",
        )
        seen.add(acc)
        version = study["version"]
        require(
            positive_int(version) and DOI.fullmatch(study["doi"]),
            "Malformed NASA version or DOI",
        )
        checked_sha(study["metadata_response_sha256"])
        require(
            study["metadata_url"] == fetch_psi.BASE + "repo/investigations/" + acc,
            "Invalid metadata URL",
        )
        tables = []
        for i, tab in enumerate(study["tables"], 1):
            file = safename(tab["local_file"])
            require(
                file not in files
                and file.endswith(".csv")
                and tab["visible"] is True
                and tab["restricted"] is False,
                "Invalid table path, visibility or duplicate filename",
            )
            files.add(file)
            payload = (raw / file).read_bytes()
            require(
                digest(payload) == checked_sha(tab["sha256"]) and len(payload) == tab["file_size"],
                "Table bytes differ from NASA manifest: " + file,
            )
            require(positive_int(tab["version"]), "Invalid NASA table version")
            expected = (
                fetch_psi.BASE
                + f"studies/{acc}/download?"
                + urlencode(
                    {
                        "file": tab["file_name"],
                        "version": tab["version"],
                        "studyVersion": version,
                    }
                )
            )
            require(
                tab["download_url"] == expected,
                "Source locator has different identity or version",
            )
            header, rows = csv_table(payload)
            tables.append(
                {
                    "index": i,
                    "published_name": tab["file_name"],
                    "local_file": file,
                    "version": tab["version"],
                    "source_url": expected,
                    "sha256": tab["sha256"],
                    "bytes": len(payload),
                    "header_sha256": digest(canonical(header)),
                    "columns": len(header),
                    "source_records": len(rows),
                }
            )
        studies.append(
            {
                "accession": acc,
                "version": version,
                "doi": study["doi"],
                "title": study["title"],
                "released": study["releaseDate"],
                "metadata_url": study["metadata_url"],
                "metadata_sha256": study["metadata_response_sha256"],
                "tables": tables,
            }
        )

    def counts(subset):
        return {
            "investigations": len(subset),
            "tables": sum(len(s["tables"]) for s in subset),
            "source_records": sum(t["source_records"] for s in subset for t in s["tables"]),
        }

    payload = {
        "schema": "first-fire.psi-census.v1",
        "studies": studies,
        "whole_archive": counts(studies),
        "challenge_fifteen": counts([s for s in studies if s["accession"] in CORE]),
    }
    return {**payload, "census_sha256": digest(canonical(payload))}


def field_csv(path, fields, rows):
    with path.open("w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def psi(output, acc, base=RAW, mirror=None, retrieved=None):
    require(isinstance(acc, str) and ACC.fullmatch(acc), "Use a published PSI-N accession")
    retrieval = (
        published_day(retrieved).isoformat() if retrieved else datetime.now(timezone.utc).date().isoformat()
    )
    baseline = census(base)
    manifest = read(base / "psi-manifest.json")
    prior = next((s for s in manifest["investigations"] if s["accession"] == acc), None)
    url = fetch_psi.BASE + "repo/investigations/" + acc
    meta_bytes = (mirror / (acc + ".json")).read_bytes() if mirror else nasa_bytes(url)
    meta = json.loads(meta_bytes)
    require(
        meta.get("accession") == acc and meta.get("public") is True and meta.get("restricted") is False,
        "Publication is unavailable or restricted",
    )
    version = meta["version"]
    require(
        positive_int(version) and DOI.fullmatch(meta["doi"] or "") and meta["title"].strip(),
        "Missing published version, DOI or title",
    )
    require(
        published_day(meta["releaseDate"]) <= date.fromisoformat(retrieval) <= datetime.now(timezone.utc).date(),
        "Release or retrieval date is inconsistent",
    )
    if prior:
        require(version >= prior["version"], "Refusing to replace a newer release")
        require(
            prior["doi"].lower() == meta["doi"].lower(),
            "Publisher DOI changed for the same accession",
        )
    pinned = next(
        (s for s in read(RAW / "psi-manifest.json")["investigations"] if s["accession"] == acc),
        None,
    )
    incoming = {k: meta[k] for k in fetch_psi.METADATA_KEYS}
    incoming.update(metadata_url=url, metadata_response_sha256=digest(meta_bytes), tables=[])
    mapped_tables = pinned["tables"] if pinned else []
    with staging(output) as stage:
        raw = stage / "raw"
        raw.mkdir()
        (stage / "publisher.json").write_bytes(meta_bytes)
        for study in manifest["investigations"]:
            if study["accession"] != acc:
                for tab in study["tables"]:
                    shutil.copyfile(base / tab["local_file"], raw / tab["local_file"])
        for i, t in enumerate(meta.get("experimentalTable") or [], 1):
            if (
                t.get("visible") is not True
                or t.get("restricted") is not False
                or not t["file_name"].lower().endswith(".csv")
            ):
                continue
            require(
                positive_int(t["version"]) and positive_int(t["file_size"]) and t["file_size"] <= MAX_BYTES,
                "Invalid published table size or version",
            )
            link = (
                fetch_psi.BASE
                + f"studies/{acc}/download?"
                + urlencode({"file": t["file_name"], "version": t["version"], "studyVersion": version})
            )
            data = (
                (mirror / f"{acc}-{i}.csv").read_bytes()
                if mirror
                else fetch_psi.remote_csv(link + "&redirect=false")
            )
            require(
                len(data) == t["file_size"],
                "NASA table size mismatch: " + t["file_name"],
            )
            csv_table(data)
            file = acc + "-experimental" + (f"-{i}" if i > 1 else "") + ".csv"
            (raw / file).write_bytes(data)
            item = {k: t[k] for k in fetch_psi.TABLE_KEYS}
            incoming["tables"].append(dict(item, local_file=file, download_url=link, sha256=digest(data)))
        change = "new accession"
        if prior:
            change = "new study version"
            if prior["version"] == version:
                previous_tables = {t["file_name"]: t for t in prior["tables"]}
                require(
                    len(previous_tables) == len(incoming["tables"])
                    and set(previous_tables) == {t["file_name"] for t in incoming["tables"]},
                    "Table membership changed without a new study version",
                )
                change = "same published table version"
                for table in incoming["tables"]:
                    old = previous_tables[table["file_name"]]
                    require(table["version"] >= old["version"], "Table version rollback")
                    if table["version"] == old["version"]:
                        require(
                            table["sha256"] == old["sha256"], "Table bytes changed without a new published version"
                        )
                    else:
                        change = "new table version"
        incoming["retrieved_utc"] = retrieval
        next_studies = [
            incoming
            if s["accession"] == acc
            else dict(s, retrieved_utc=s.get("retrieved_utc", manifest["retrieved_utc"]))
            for s in manifest["investigations"]
        ]
        if not prior:
            next_studies.append(incoming)
        write(
            raw / "psi-manifest.json",
            {
                "retrieved_utc": retrieval,
                "metadata_projection": list(fetch_psi.METADATA_KEYS),
                "investigations": next_studies,
            },
        )
        after = census(raw)
        write(stage / "previous-census.json", baseline)
        write(stage / "census.json", after)
        receipts = []
        normalized = []
        unknown = []
        # A new accession or changed column order must never inherit an orbital gravity or arbitrary parser.
        for i, t in enumerate(incoming["tables"], 1):
            header, rows = csv_table((raw / t["local_file"]).read_bytes())
            prev = mapped_tables[i - 1] if i <= len(mapped_tables) else None
            eligible = bool(
                prev
                and int(acc[4:]) in build_data.INFO
                and t["file_name"] == prev["file_name"]
                and header == csv_table((RAW / prev["local_file"]).read_bytes())[0]
                and all(incoming[k] == pinned[k] for k in ("projectType", "flightProgram", "experimentHardware"))
            )
            if not eligible:
                unknown.append(t["file_name"])
            seen_rows = set()
            for row, cells in rows:
                rid = f"{acc}:{i}:{row}"
                receipts.append(
                    {
                        "record_id": rid,
                        "accession": acc,
                        "study_version": version,
                        "table_version": t["version"],
                        "source_row": row,
                        "source_url": t["download_url"],
                        "table_sha256": t["sha256"],
                        "row_sha256": digest(canonical(cells)),
                    }
                )
                if not eligible:
                    continue
                if acc == "PSI-39" and tuple(cells) in seen_rows:
                    continue
                seen_rows.add(tuple(cells))
                item = build_data.parse(int(acc[4:]), cells, i)
                if item is None:
                    continue
                item.update(
                    accession=acc,
                    doi=incoming["doi"],
                    source_file="data/raw/" + t["local_file"],
                    source_url=t["download_url"],
                    source_row=row,
                    record_id=rid,
                    gravity_g="0",
                    gravity_regime="orbital microgravity (nominal g)",
                    observation_type=item.get("observation_type", "test record"),
                )
                normalized.append(item)
        fields = [
            "record_id",
            "accession",
            "study_version",
            "table_version",
            "source_row",
            "source_url",
            "table_sha256",
            "row_sha256",
        ]
        field_csv(stage / "incoming-rows.csv", fields, receipts)
        field_csv(stage / "normalized-preview.csv", build_data.FIELDNAMES, normalized)
        report = {
            "schema": "first-fire.psi-stage.v1",
            "origin": "supplied offline mirror" if mirror else "NASA PSI download",
            "accession": acc,
            "previous_version": prior["version"] if prior else None,
            "published_version": version,
            "doi": incoming["doi"],
            "published": meta["releaseDate"],
            "retrieved": retrieval,
            "metadata_url": url,
            "change": change,
            "previous_census_sha256": baseline["census_sha256"],
            "new_census_sha256": after["census_sha256"],
            "previous_counts": baseline["whole_archive"],
            "new_counts": after["whole_archive"],
            "row_receipts": len(receipts),
            "normalized_preview": len(normalized),
            "unmapped_tables": unknown,
            "metadata_only": not incoming["tables"],
        }
        write(stage / "stage.json", report)
        seal(stage)
    return report


LOCK_UTC = datetime.fromisoformat("2026-11-14T12:57:06+00:00")
BASIS = {
    "sustained_beyond_igniter": "yes",
    "nominal_no_ignition": "no",
    "no_sustained_spread_after_power": "no",
    "insufficient_telemetry": "void",
    "changed_material_or_geometry": "void",
    "invalid_initial_conditions": "void",
    "hardware_fault": "void",
    "abort": "void",
    "ambiguous_classification": "void",
}
SUFFIX = {"text": ".txt", "csv": ".csv", "pdf": ".pdf"}


def lock_data(folder, ca=None):
    original = folder / "fm2-v1.json"
    timestamp = folder / "fm2-v1.tsr"
    require(
        digest(original.read_bytes()) == FORECAST_SHA,
        "Original signed forecast bytes changed",
    )
    require(
        digest(timestamp.read_bytes()) == TIMESTAMP_SHA,
        "Original timestamp receipt changed",
    )
    bundle = ca or ssl.get_default_verify_paths().cafile or "/etc/ssl/cert.pem"
    result = subprocess.run(
        [
            "openssl",
            "ts",
            "-verify",
            "-data",
            str(original),
            "-in",
            str(timestamp),
            "-CAfile",
            str(bundle),
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    require(
        result.returncode == 0,
        "RFC 3161 chain verification failed: " + result.stderr.strip(),
    )
    return read(original)


def passage(body, fmt, locator):
    key = {"text": "line", "csv": "row", "pdf": "page"}[fmt]
    require(
        isinstance(locator, dict) and set(locator) == {key} and positive_int(locator[key]),
        "Use a one-based " + key + " locator",
    )
    index = locator[key] - 1
    if fmt == "pdf":
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise ValueError("Install pypdf to verify PDF page text") from error
        pages = PdfReader(io.BytesIO(body)).pages
        require(index < len(pages), "PDF page outside publication")
        return pages[index].extract_text() or ""
    if fmt == "text":
        lines = body.decode("utf-8-sig").splitlines()
        require(index < len(lines), "Line outside publication")
        return lines[index]
    header, records = csv_table(body)
    lines = dict([(1, header), *records])
    require(index + 1 in lines, "CSV record outside publication")
    return " | ".join(lines[index + 1])


def clean(value):
    return " ".join(unicodedata.normalize("NFKC", value).replace("\u00ad", "").split())


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def time_utc(value):
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        when = date.fromisoformat(value)
        require(
            when > LOCK_UTC.date(),
            "For same-day releases, supply the official timestamp",
        )
        return datetime.fromisoformat(value + "T00:00:00+00:00")
    require(
        isinstance(value, str) and "T" in value,
        "Supply an official timezone-qualified release time",
    )
    instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(instant.tzinfo is not None, "A release time needs a timezone")
    return instant.astimezone(timezone.utc)


def resolution(lock, packet, load):
    require(
        packet.get("forecast_sha256") == FORECAST_SHA,
        "Packet must identify the signed forecast SHA-256",
    )
    publications = {}
    for p in packet["publications"]:
        key = p["id"]
        require(
            nonempty(key) and key not in publications and nonempty(p.get("title")),
            "Invalid publication identification",
        )
        nasa(p["url"])
        fmt = p["format"]
        require(
            fmt in SUFFIX and p.get("role") == "flight_results",
            "Expected an official flight results publication",
        )
        stamp = time_utc(p["published_utc"])
        require(
            LOCK_UTC < stamp <= datetime.now(timezone.utc),
            "Flight result publication must follow the lock and have been released",
        )
        expected = checked_sha(p["sha256"])
        body = load(p)
        require(
            0 < len(body) <= MAX_BYTES and digest(body) == expected,
            "NASA publication checksum mismatch",
        )
        publications[key] = (p, body)
    burns = {}
    test_ids = set()
    for entry in packet["burns"]:
        idx = entry["burn"]
        require(
            positive_int(idx) and idx <= len(lock["predictions"]) and idx not in burns,
            "Invalid or duplicate burn",
        )
        pred = lock["predictions"][idx - 1]
        require(
            nonempty(entry.get("test_id")) and entry["test_id"] not in test_ids,
            "Supply a unique official test ID",
        )
        test_ids.add(entry["test_id"])
        require(
            nonempty(entry.get("reviewer")) and nonempty(entry.get("rationale")),
            "A reviewer and classification rationale are required",
        )
        basis = entry["basis"]
        require(basis in BASIS, "Unrecognized resolution basis")
        state = BASIS[basis]
        require(
            entry.get("publication_id") in publications,
            "Missing official publication for burn",
        )
        pub, body = publications[entry["publication_id"]]
        condition_ref = entry.get("conditions_evidence", {})
        conditions_quote = clean(condition_ref.get("quote", ""))
        require(
            len(conditions_quote) >= 8
            and conditions_quote in clean(passage(body, pub["format"], condition_ref.get("locator"))),
            "Actual conditions and test identity need an attributable passage",
        )
        excerpt = clean(entry["quote"])
        require(
            len(excerpt) >= 8 and excerpt in clean(passage(body, pub["format"], entry["locator"])),
            "Quoted passage does not occur at the supplied locator",
        )
        require(
            clean(entry["test_id"]).casefold() in (excerpt + " " + conditions_quote).casefold(),
            "Official test ID must appear in an attributed passage",
        )
        actual = entry["actual"]
        require(
            isinstance(actual, dict)
            and actual
            and finite(entry.get("planned_o2_pct"))
            and entry["planned_o2_pct"] == pred["starting_o2_pct"],
            "Provide actual conditions and the signed target oxygen percentage for this burn",
        )
        if state in ("yes", "no"):
            design = lock["design"]
            for field in ("material", "gravity", "gas", "orientation"):
                require(
                    actual.get(field) == design[field],
                    "Unmatched " + field + " for a nominal burn",
                )
            for field in (
                "pressure_psia",
                "length_cm",
                "chamber_litres",
                "starting_o2_pct",
            ):
                require(finite(actual.get(field)), "Actual measurement required: " + field)
            require(
                actual.get("nominal_initial_conditions") is True and 0 < actual["starting_o2_pct"] < 100,
                "Nominal initial conditions must be confirmed against measured oxygen",
            )
            if actual["starting_o2_pct"] != pred["starting_o2_pct"]:
                tolerance = actual.get("published_o2_tolerance_pp")
                require(
                    finite(tolerance)
                    and tolerance >= 0
                    and abs(actual["starting_o2_pct"] - pred["starting_o2_pct"]) <= tolerance + 1e-12,
                    "Off-target oxygen needs a tolerance supported by the actual-conditions publication",
                )
            require(
                abs(actual["pressure_psia"] - design["pressure_psia"]) <= design["pressure_tolerance_psi"] + 1e-12
                and actual["length_cm"] == design["length_cm"]
                and actual["chamber_litres"] == design["chamber_litres"],
                "Actual pressure or geometry outside signed design",
            )
        length = entry.get("measured_travel_cm")
        if length is not None:
            require(
                state != "void" and finite(length) and 0 <= length <= lock["design"]["length_cm"],
                "Sustained travel requires a valid resolved burn and must lie within the sample",
            )
            require(
                state == "yes" or length == 0,
                "Positive sustained travel contradicts a no-spread outcome",
            )
        burns[idx] = {
            "outcome": state,
            "resolution": entry,
            "publication": {
                "title": pub["title"],
                "url": pub["url"],
                "published_utc": pub["published_utc"],
                "sha256": pub["sha256"],
            },
        }
    require(
        {e["publication_id"] for e in packet["burns"]} == set(publications),
        "Every submitted publication must support a burn",
    )
    rows = []
    lengths = []
    for p in lock["predictions"]:
        evidence = burns.get(p["burn"], {"outcome": "pending", "resolution": None, "publication": None})
        row = {**p, **evidence}
        length = (row["resolution"] or {}).get("measured_travel_cm")
        if length is not None:
            error = p["reference_length_cm"] - length
            lengths.append(
                {
                    "burn": p["burn"],
                    "predicted_cm": p["reference_length_cm"],
                    "measured_cm": length,
                    "signed_error_cm": error,
                    "absolute_error_cm": abs(error),
                }
            )
        rows.append(row)
    outcomes = [r["outcome"] for r in rows]
    model = forecast.brier_report([r["p_sustain"] for r in rows], outcomes)
    comparator = forecast.brier_report([r["comparator_probability"] for r in rows], outcomes)
    return {
        "schema": "first-fire.fm2-intake.v1",
        "forecast_id": lock["id"],
        "forecast_sha256": FORECAST_SHA,
        "timestamp_sha256": TIMESTAMP_SHA,
        "timestamp_utc": LOCK_UTC.isoformat(),
        "burns": rows,
        "n_pending": outcomes.count("pending"),
        "n_void": outcomes.count("void"),
        "model_brier": model,
        "project_comparator_brier": comparator,
        "length": {
            "per_burn": lengths,
            "n": len(lengths),
            "mean_absolute_error_cm": sum(r["absolute_error_cm"] for r in lengths) / len(lengths)
            if lengths
            else None,
        },
    }


def fm2(output, packet_path=None, ca=None):
    packet = (
        read(packet_path) if packet_path else {"forecast_sha256": FORECAST_SHA, "publications": [], "burns": []}
    )
    with staging(output) as stage:
        locked = stage / "lock"
        locked.mkdir()
        for name in ("fm2-v1.json", "fm2-v1.tsr"):
            shutil.copyfile(LOCK / name, locked / name)
        original = lock_data(locked, ca)
        archive = stage / "publications"
        archive.mkdir()

        def capture(p):
            body = nasa_bytes(p["url"])
            (archive / (p["sha256"] + SUFFIX[p["format"]])).write_bytes(body)
            return body

        result = resolution(original, packet, capture)
        write(stage / "packet.json", packet)
        write(stage / "resolution.json", result)
        seal(stage)
    return result


def inventory(stage):
    files = {}
    for path in sorted(stage.rglob("*")):
        require(not path.is_symlink(), "Symlinks are unsupported inside a receipt")
        relative = path.relative_to(stage).as_posix()
        if path.is_file() and relative != "integrity.json":
            files[relative] = digest(path.read_bytes())
    return files


def seal(stage):
    files = inventory(stage)
    write(
        stage / "integrity.json",
        {
            "schema": "first-fire.intake-integrity.v1",
            "files": files,
            "receipt_sha256": digest(canonical(files)),
        },
    )


def verify(stage, ca=None):
    files = inventory(stage)
    proof = read(stage / "integrity.json")
    require(
        proof.get("schema") == "first-fire.intake-integrity.v1"
        and proof["files"] == files
        and proof["receipt_sha256"] == digest(canonical(files)),
        "Stage inventory checksum mismatch",
    )
    if (stage / "resolution.json").exists():
        original = lock_data(stage / "lock", ca)

        def archived(p):
            return (stage / "publications" / (p["sha256"] + SUFFIX[p["format"]])).read_bytes()

        result = resolution(original, read(stage / "packet.json"), archived)
        require(result == read(stage / "resolution.json"), "FM² score differs on replay")
        return {
            "type": "fm2",
            "receipt_sha256": proof["receipt_sha256"],
            "resolved": result["model_brier"]["n_resolved"],
            "pending": result["n_pending"],
            "void": result["n_void"],
        }
    report = read(stage / "stage.json")
    previous = read(stage / "previous-census.json")
    previous_sha = previous.pop("census_sha256")
    require(
        digest(canonical(previous)) == previous_sha == report["previous_census_sha256"],
        "Previous census checksum differs",
    )
    after = census(stage / "raw")
    require(
        after == read(stage / "census.json") and report["new_census_sha256"] == after["census_sha256"],
        "Census differs from staged bytes",
    )
    incoming = next(s for s in after["studies"] if s["accession"] == report["accession"])
    publisher = read(stage / "publisher.json")
    require(
        incoming["metadata_sha256"] == files["publisher.json"]
        and incoming["version"] == publisher["version"]
        and publisher["accession"] == incoming["accession"],
        "Publisher metadata differs",
    )
    return {
        "type": "psi",
        "receipt_sha256": proof["receipt_sha256"],
        "census_sha256": after["census_sha256"],
        "counts": after["whole_archive"],
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    modes = cli.add_subparsers(dest="command", required=True)
    config = modes.add_parser("census", help="Validate and count all pinned public archive tables")
    config.add_argument("--raw", type=Path, default=RAW)
    config = modes.add_parser("psi", help="Stage a released public NASA PSI accession")
    config.add_argument("accession")
    config.add_argument("output", type=Path)
    config.add_argument("--base", type=Path, default=RAW)
    config.add_argument(
        "--mirror",
        type=Path,
        help="Use a supplied snapshot and label the stage as an offline mirror",
    )
    config.add_argument("--retrieved", help="Collection date of an offline mirror, YYYY-MM-DD")
    config = modes.add_parser("fm2", help="Verify the timestamp and score attributable outcomes")
    config.add_argument("output", type=Path)
    config.add_argument("--packet", type=Path)
    config.add_argument("--ca", type=Path, help="Trusted CA bundle for openssl ts -verify")
    config = modes.add_parser("verify", help="Replay an existing receipt without a network connection")
    config.add_argument("stage", type=Path)
    config.add_argument("--ca", type=Path)
    args = cli.parse_args()
    try:
        if args.command == "census":
            result = census(args.raw)
        elif args.command == "psi":
            require(
                not args.retrieved or args.mirror,
                "Live NASA downloads use today's UTC collection date",
            )
            result = psi(args.output, args.accession, args.base, args.mirror, args.retrieved)
        elif args.command == "fm2":
            result = fm2(args.output, args.packet, args.ca)
        else:
            result = verify(args.stage, args.ca)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
        cli.exit(2, f"Intake failed: {error}\n")


if __name__ == "__main__":
    main()
