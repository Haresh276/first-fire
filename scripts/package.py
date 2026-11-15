"""Create a portable release ZIP. The zip's only top-level folder is FIRST-FIRE/."""
import argparse
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import tempfile
import hashlib
from verify_release import check

ROOT=Path(__file__).resolve().parents[1]
def package(target):
    check(ROOT/'dist')
    target=target.resolve()
    if target.is_relative_to(ROOT):raise ValueError('Choose a destination outside the source tree.')
    target.parent.mkdir(parents=True,exist_ok=True)
    sources=[ROOT/x for x in ('README.md','LICENSE')]
    for folder in ('site','data','dist','chat','scripts','tests','research','rover-design'):
        sources.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and
                       not any(s.startswith('.') or s in ('__pycache__','node_modules','share') for s in p.relative_to(ROOT).parts))
    with tempfile.TemporaryDirectory(dir=target.parent) as tmp:
        out=Path(tmp)/'release.zip'
        with ZipFile(out,'w',compression=ZIP_DEFLATED,compresslevel=7) as z:
            for src in sorted(sources):
                z.write(src,'FIRST-FIRE/'+src.relative_to(ROOT).as_posix())
        with ZipFile(out) as z:
            assert z.testzip() is None and 'FIRST-FIRE/dist/index.html' in z.namelist()
            assert not any('.git/' in path or '.openai/' in path for path in z.namelist())
        out.replace(target)
    print(f'{target.name}: {len(sources)} files; {target.stat().st_size:,} bytes; SHA-256 {hashlib.sha256(target.read_bytes()).hexdigest()}')
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    package(parser.parse_args().output)
