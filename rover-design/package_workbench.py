"""Build a portable local copy of the lab, including its offline evidence and examples."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent
DESTINATION = ROOT / "share" / "first-fire-rover-workbench.zip"
FOLDERS = ("prototype", "evidence", "examples", "terrain", "tests", "preview")
FILES = ("*.md", "*.json", "*.py")


def included_files():
    candidates = [path for pattern in FILES for path in ROOT.glob(pattern)]
    candidates.extend(path for folder in FOLDERS for path in (ROOT / folder).rglob("*"))
    return sorted(path for path in candidates if path.is_file() and not path.is_symlink()
                  and not any(part.startswith(".") or part == "__pycache__"
                              for part in path.relative_to(ROOT).parts))


def build():
    DESTINATION.parent.mkdir(exist_ok=True)
    temporary = DESTINATION.with_suffix(".tmp")
    with ZipFile(temporary, "w", ZIP_DEFLATED) as archive:
        for path in included_files():
            name = "rover-design/" + path.relative_to(ROOT).as_posix()
            info = ZipInfo(name, date_time=(2026, 11, 15, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    with ZipFile(temporary) as archive:
        damaged = archive.testzip()
        if damaged:
            raise ValueError(f"Archive integrity check failed for {damaged}")
        print(f"{len(archive.namelist())} files, {temporary.stat().st_size:,} bytes")
    temporary.replace(DESTINATION)
    print(DESTINATION)


if __name__ == "__main__":
    build()
