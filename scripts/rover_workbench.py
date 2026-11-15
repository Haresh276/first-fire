"""Copy the 3D rover workbench and its reference material into the static site."""
import json
from pathlib import Path
import re
import shutil


def copy_rover_workbench(root: Path, stage: Path):
    source = root / 'rover-design'
    destination = stage / 'rover-workbench'
    destination.mkdir()
    shutil.copy2(source / 'index.html', destination / 'index.html')
    for name in ('prototype', 'examples', 'evidence', 'terrain', 'preview'):
        shutil.copytree(source / name, destination / name,
                        ignore=shutil.ignore_patterns('*.test.mjs', '.*', '__pycache__'))
    for pattern in ('*.json', '*.md'):
        for path in source.glob(pattern):
            shutil.copy2(path, destination / path.name)

    # Serve third-party HTML snapshots as inert source text, preserving the original bytes and hashes.
    for path in (destination / 'evidence/files').glob('*.html'):
        path.rename(path.with_suffix('.html.txt'))
    for path in [destination / 'sources.json', *(destination / 'evidence').glob('*.json')]:
        content = json.loads(path.read_text())
        rows = content['sources'] if isinstance(content, dict) else content
        for row in rows:
            if (row.get('localFile') or '').endswith('.html'):
                row['localFile'] += '.txt'
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')

    github = 'https://github.com/Haresh276/first-fire/blob/main/rover-design/'
    for path in destination.rglob('*.md'):
        def resolve_link(match):
            target = match.group(1)
            if target.startswith(('https:', 'http:', '#')):
                if target.startswith('http://127.0.0.1:8766/prototype/'):
                    return '](prototype/index.html#workbench)'
                return match.group(0)
            location = (path.parent / target.split('#')[0]).resolve()
            if location.suffix == '.html' and location.with_suffix('.html.txt').is_file():
                return '](' + target + '.txt)'
            if location.is_relative_to(destination) and not location.exists():
                relative = location.relative_to(destination).as_posix()
                if (source / relative).exists():
                    return '](' + github + relative + ')'
            return match.group(0)
        path.write_text(re.sub(r'\]\(([^)]+)\)', resolve_link, path.read_text()))
