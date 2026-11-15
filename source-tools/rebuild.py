#!/usr/bin/env python3
"""Rebuild the static workspace entry script, recovery worker, and two checksums files."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile

HERE = Path(__file__).resolve().parent
ENTRY = ('shell-nav.js', 'desk-directions.js', 'local-qwen.js', 'chat-ui.js', 'desk-home.js', 'app.js')
RECOVERY = {
    'index.html', 'workspace.css', 'icon.svg', 'earth.js', 'earth-poster.webp', 'earth-map.webp',
    'records.js', 'observation-rows.js', 'science-chat.js', 'referee-deck.js', 'referee-reviews.js',
    'referee-passages.js', 'forecast-ui.js', 'search.js', 'awareness.js', 'research-session.js',
    'trial-comparison.js', 'investigation-replay.js',
    'physics-lab.js', 'cabin-liquid-weights.js', 'rover-concept.png', 'spread-scene.js',
    'design-lab.js', 'transport-lab.js', 'transport-fit.js', 'transfer-lab.js',
    'rover-model.js', 'rover-integration.js', 'tools.html', 'tool-directory.js',
    'tool-directory.css', 'judge-lab.html', 'judge-lab.css', 'homepage.css', 'rover-hero.js',
    'intent-router.js', 'reader-device.js', 'judge-reader.js', 'judge-experiment.js',
    'judge-awareness.js', 'judge-lab.js', 'sibal.png', 'fm2-worked-example.png',
    'rover-workbench/parts.json', 'rover-workbench/sources.json', 'rover-workbench/scenario.schema.json',
    'rover-workbench/terrain/lola-samples.mjs', 'rover-workbench/terrain/lola.json',
    'rover-workbench/terrain/jezero-route.json',
}
OBSERVER_RECOVERY = {
    'material-observer.html', 'material-observer.css', 'material-observer.js',
    'material-observer-model.js', 'material-observer-evidence.js', 'material-screening.mjs',
    'flint-coefficients.js', 'flint-solid.js', 'data/raw/PSI-99-experimental.csv',
    'fonts/dm-regular.ttf', 'fonts/dm-bold.ttf', 'fonts/barlow-bold.ttf', 'icon.svg',
}

def sha(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()

def json_text(value):
    return json.dumps(value, indent=2, sort_keys=True) + '\n'

def build(public, check):
    workspace = public / 'research-workspace'
    changes = []
    def output(path, text):
        data = text.encode()
        if path.exists() and path.read_bytes() == data:
            return
        changes.append(path.relative_to(public).as_posix())
        if check:
            return
        with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as file:
            file.write(data)
            temp = Path(file.name)
        try:
            temp.chmod(0o644)
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)

    core = '\n;\n'.join((workspace / name).read_text() for name in ENTRY) + '\n'
    output(workspace / 'workspace-core.js', core)

    page = workspace / 'index.html'
    text = page.read_text()
    registration = '<script id="workspace-recovery">\n' + (HERE / 'workspace-register.js').read_text() + '\n</script>'
    pattern = r'<script id="workspace-recovery">.*?</script>'
    if re.search(pattern,text,re.S):
        text = re.sub(pattern, lambda _: registration, text, count=1, flags=re.S)
    elif text.count('</body>') == 1:
        text = text.replace('</body>', registration + '\n</body>')
    else:
        raise ValueError('Cannot locate the workspace document body')
    output(page, text)

    assets = RECOVERY | set(re.findall(r'<script[^>]+src="([^"?#]+)"',text))
    assets.update(re.findall(r'url\((fonts/[^)]*)\)', (workspace / 'workspace.css').read_text()))
    assets.update(p.name for p in workspace.glob('workspace-*.bundle.js'))
    for pattern in ('rover-workbench/prototype/**/*', 'rover-workbench/examples/*.json'):
        assets.update(p.relative_to(workspace).as_posix() for p in workspace.glob(pattern) if p.is_file())
    saved_files = OBSERVER_RECOVERY | {'research-workspace/' + name for name in assets}
    integrity = {'/' + name:'sha256-' + base64.b64encode(bytes.fromhex(sha(public / name))).decode() for name in sorted(saved_files)}
    payload = json.dumps(integrity,sort_keys=True,separators=(',',':'))
    template = (HERE / 'workspace-worker.template.js').read_text()
    revision = hashlib.sha256((payload + template).encode()).hexdigest()[:20]
    output(public / 'workspace-worker.js', template.replace('__REVISION__',revision).replace('__INTEGRITY__',payload))

    for folder in (workspace,public):
        document = folder / 'checksums.json'
        entries = {}
        for path in sorted(folder.rglob('*')):
            if path.is_symlink():
                raise ValueError('Refusing a symlink in the public release: ' + str(path))
            if not path.is_file() or path == document or (folder == public and workspace in path.parents):
                continue
            entries[path.relative_to(folder).as_posix()] = sha(path)
        output(document, json_text(entries))
    if check and changes:
        raise SystemExit('Rebuild required for: ' + ', '.join(changes))
    print(('Verified' if check else 'Built') + ' workspace entry, recovery worker and SHA-256 manifests. ' + str(len(changes)) + ' changed.')

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public',type=Path,default=HERE.parent/'public')
    parser.add_argument('--check',action='store_true',help='verify existing files without writing')
    args=parser.parse_args()
    build(args.public.resolve(),args.check)
