"""Match each experimental table in the supplied PSI pack to its local raw bytes."""
import argparse
import csv
import hashlib
import io
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]


def compare(archive):
    raw = ROOT / 'data/raw'
    report = io.StringIO(newline='')
    writer = csv.writer(report, lineterminator='\n')
    writer.writerow(['archive_member', 'repository_path', 'bytes', 'sha256', 'comparison'])
    with ZipFile(archive) as pack:
        names = sorted(n for n in pack.namelist() if '_experimental table_' in n.lower() and n.lower().endswith('.csv'))
        if len(names) != 16:
            raise ValueError(f'Expected 16 experimental tables, found {len(names)}')
        matched = set()
        for name in names:
            content = pack.read(name)
            psi_id = Path(name).name.split('_', 1)[0]
            same = [p for p in raw.glob(f'{psi_id}-experimental*.csv') if p.read_bytes() == content]
            result = 'byte-identical' if len(same) == 1 and same[0] not in matched else 'DIFFERENT OR AMBIGUOUS'
            matched.update(same)
            writer.writerow([name, '|'.join(str(p.relative_to(ROOT)) for p in same), len(content),
                             hashlib.sha256(content).hexdigest(), result])
    return report.getvalue()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pack', type=Path)
    parser.add_argument('--save-to', type=Path)
    args = parser.parse_args()
    report = compare(args.pack)
    print(report, end='')
    if args.save_to:
        args.save_to.write_text(report, encoding='utf-8')
    raise SystemExit(int('DIFFERENT OR AMBIGUOUS' in report))
