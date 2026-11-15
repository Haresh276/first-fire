"""Create disjoint, reproducible FIRST-FIRE offline downloads from the staged site."""

import hashlib
import json
from pathlib import PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


FILENAME = "first-fire-offline.zip"
PACK_INDEX = "offline-packs.json"
EXPERIMENTS = "first-fire-rover-experiments.zip"
ENGINEERING = "first-fire-rover-engineering.zip"
AGENCIES = "first-fire-rover-agencies.zip"
FILM = "first-fire-rover-film.zip"
REPRODUCTION = "first-fire-reproduction.zip"
REPRODUCTION_FILES = frozenset({
    "flint/FIRST-FIRE_FLINT-engine.zip",
    "master-round2-slides.pptx",
    "code-review-files.csv.gz",
    "fresh-chat-audit.zip",
})
OPTIONAL = (EXPERIMENTS, ENGINEERING, AGENCIES, FILM, REPRODUCTION)
LIMIT = {FILENAME: 23*1024**2, **{name: 20*1024**2 for name in OPTIONAL}}
EXPERIMENT_PDFS = {"filter-paper.pdf", "saffire-i-slides.pdf", "nasa-03-saffire-iv-v.pdf"}
AGENCY_PDFS = {"aee-meda-first-weather.pdf", "aep-02-guaranisat1.pdf", "ases-mandate-aps.pdf",
               "bsa-01-bahrain-un.pdf", "bsa-02-bahrain-un.pdf", "mbrsc-rashid1-preflight.pdf",
               "mbrsc-wheel-traction.pdf", "tua-performance-2025.pdf"}


def package_for(name):
    if name in REPRODUCTION_FILES:
        return REPRODUCTION
    p = PurePosixPath(name)
    if name in ("rover-workbench/preview/rover-workbench.mp4", "live-site-film.mp4"):
        return FILM
    if p.parent.as_posix() == "rover-workbench/evidence/files" and p.suffix.lower() == ".pdf":
        if p.name in EXPERIMENT_PDFS:
            return EXPERIMENTS
        if p.name in AGENCY_PDFS:
            return AGENCIES
        return ENGINEERING
    return FILENAME


def json_bytes(data):
    return (json.dumps(data, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def write_pack(directory, filename, members, extra=None):
    target = directory / filename
    extra = extra or {}
    with ZipFile(target, "w") as archive:
        for name in sorted([*members, *extra]):
            entry = ZipInfo("FIRST-FIRE/" + name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            data = extra[name] if name in extra else (directory / name).read_bytes()
            archive.writestr(entry, data, compress_type=ZIP_DEFLATED, compresslevel=6)
    if target.stat().st_size >= LIMIT[filename]:
        raise ValueError(f"{filename} is {target.stat().st_size:,} bytes; must be below {LIMIT[filename]:,}")
    return hashlib.sha256(target.read_bytes()).hexdigest()


def package_offline_site(directory, digests):
    """Return the additional hosted files and hashes, for the release-wide manifest."""
    grouped = {name: {} for name in LIMIT}
    for name, sha in digests.items():
        if name not in {*LIMIT, PACK_INDEX, "checksums.json", "model.js"}:
            grouped[package_for(name)][name] = sha
    additional, packs = {}, {}
    for name in OPTIONAL:
        if not grouped[name]:
            raise ValueError(f"Empty offline supplement: {name}")
        additional[name] = write_pack(directory, name, grouped[name])
        packs[name] = {"bytes": (directory/name).stat().st_size, "sha256": additional[name], "files": grouped[name]}
    index = json_bytes({"schema": "first-fire.offline-packs.v1", "folder": "FIRST-FIRE", "core": FILENAME, "supplements": packs})
    (directory/PACK_INDEX).write_bytes(index)
    additional[PACK_INDEX] = hashlib.sha256(index).hexdigest()
    grouped[FILENAME][PACK_INDEX] = additional[PACK_INDEX]
    additional[FILENAME] = write_pack(directory, FILENAME, grouped[FILENAME], {"checksums.json": json_bytes(grouped[FILENAME])})
    return additional
