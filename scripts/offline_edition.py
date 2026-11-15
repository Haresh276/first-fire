"""Bundle the built static site so another classroom can use the same measurements offline."""

import hashlib
import json
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


FILENAME = "first-fire-offline.zip"


def package_offline_site(directory, digests):
    target = directory / FILENAME
    # The extracted edition has its own manifest. The hosted manifest also covers the ZIP.
    manifest = (json.dumps(digests, indent=2) + "\n").encode()
    with ZipFile(target, "w") as archive:
        for name in [*sorted(digests), "checksums.json"]:
            entry = ZipInfo("FIRST-FIRE/" + name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.external_attr = 0o100644 << 16
            data = manifest if name == "checksums.json" else (directory / name).read_bytes()
            archive.writestr(entry, data, compress_type=ZIP_DEFLATED, compresslevel=6)
    return hashlib.sha256(target.read_bytes()).hexdigest()
