#!/usr/bin/env python3
"""Build the static dashboard. The checkout contains its complete data and model."""
import base64
import csv
import hashlib
import html
import json
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from .compact_observations import compact_script
    from .offline_edition import package_offline_site
except ImportError:
    from compact_observations import compact_script
    from offline_edition import package_offline_site

if __package__:
    from .rover_workbench import copy_rover_workbench
else:
    from rover_workbench import copy_rover_workbench

ROOT = Path(__file__).resolve().parents[1]
DATA, SITE, DIST = ROOT/'data', ROOT/'site', ROOT/'dist'
def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))
def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
def csv_rows(path):
    raw=path.read_bytes()
    try: txt=raw.decode('utf-8-sig')
    except UnicodeDecodeError: txt=raw.decode('cp1252')
    import io
    return list(csv.reader(io.StringIO(txt, newline='')))
def hsh(content):
    return hashlib.sha256(content).hexdigest()

ROVER_EXAMPLES = ('lunar-cellulose', 'lunar-pe', 'mars-night-pe')
ROVER_INPUTS = ('prototype/model.mjs', 'parts.json', 'sources.json', 'scenario.schema.json',
                'result.schema.json', *(f'examples/{name}.json' for name in ROVER_EXAMPLES))

def build_rover_bundle(stage):
    """Package the rover team's pure module and catalogue for HTTP and file:// use."""
    source = ROOT / 'rover-design'
    model = (source / 'prototype/model.mjs').read_text(encoding='utf-8')
    # Classic scripts load from a downloaded directory without module CORS restrictions.
    # Only the declaration modifier changes. The model has no imported dependencies.
    declarations = re.findall(r'^export function (\w+)\(', model, flags=re.M)
    if not {'selectPart', 'setEnvironment', 'simulate'}.issubset(declarations):
        raise ValueError('The rover module contract changed; check the research workspace adapter.')
    classic = re.sub(r'^export (?=function \w+\()', '', model, flags=re.M)
    if re.search(r'^\s*(?:import|export)\b', classic, flags=re.M):
        raise ValueError('The rover calculator now has module dependencies; update its offline bundle.')
    source_rows = read_json(source / 'sources.json')['sources']
    fields = ('id', 'agency', 'title', 'url', 'locator', 'role', 'supports', 'limits', 'evidenceClass')
    archive = {
        'catalog': read_json(source / 'parts.json'),
        'schema': read_json(source / 'scenario.schema.json'),
        'resultSchema': read_json(source / 'result.schema.json'),
        'sources': [{k: row[k] for k in fields if k in row} for row in source_rows],
        'examples': {key: read_json(source / f'examples/{key}.json') for key in ROVER_EXAMPLES},
        'modelSHA256': hsh(model.encode('utf-8')),
    }
    bundle = ("(() => {\n'use strict';\n" + classic
              + "\nglobalThis.FFRoverModel = {simulate, selectPart, setEnvironment};\n})();\n"
              + 'globalThis.FFRoverData = ' + packed(archive) + ';\n')
    (stage / 'rover-model.js').write_text(bundle, encoding='utf-8')

def build():
    for script in ('build_data.py','forecast.py','verify_quotes.py','build_referee_passages.py'):
        subprocess.run([sys.executable,str(ROOT/'scripts'/script)],check=True)
    for required in ('app.js','chat-ui.js','chat.css','benchmark-ui.js','search.js','explorer.js','study.js','claim.js','acrylic.js','forecast-ui.js','forecast.css','spread-scene.js','workbench.js','manual.html','offline.html','first-fire-user-manual.pdf','demo.html'):
        if not (SITE/required).is_file(): raise SystemExit(f'Missing site/{required}')
    cases=read_json(DATA/'cases.json'); studies=read_json(DATA/'investigations.json')
    assert len({c['id'] for c in cases})==7 and all(len(c['options'])==6 for c in cases)
    with (DATA/'tests.csv').open(encoding='utf-8',newline='') as inp: tests=list(csv.DictReader(inp))
    tables={t['file']:csv_rows(ROOT/t['file']) for s in studies for t in s['tables']}
    assert len(tests)==sum(s['rows'] for s in studies)
    for row in tests:
        assert 1 < int(row['source_row']) <= len(tables[row['source_file']])
    with tempfile.TemporaryDirectory(dir=ROOT,prefix='.firstfire-build-') as temp:
        stage=Path(temp)/'dist';shutil.copytree(SITE,stage)
        copy_rover_workbench(ROOT, stage)
        build_rover_bundle(stage)
        (stage/'data').mkdir()
        for f in ('cases.json','tests.csv','investigations.json','forecast.json','challenge-resources.json','incidents.json'):
            shutil.copy2(DATA/f,stage/'data'/f)
        shutil.copytree(DATA/'raw',stage/'data'/'raw')
        if (DATA/'evidence').is_dir():shutil.copytree(DATA/'evidence',stage/'data'/'evidence')
        research=[p for p in (ROOT/'research').glob('*.md') if p.is_file()]
        (stage/'research').mkdir()
        for p in research:
            content=p.read_text(encoding='utf-8').replace('](../dist/','](../')
            (stage/'research'/p.name).write_text(content,encoding='utf-8')
        exp=ROOT/'research/evaluation-examples'
        if exp.is_dir():(stage/'research'/'practice').mkdir(exist_ok=True)
        if exp.is_dir():
            shutil.copy2(exp/'participant.example.json',stage/'research'/'practice'/'participant.example.json')
        forecast=read_json(DATA/'forecast.json')
        data={'incidents':read_json(DATA/'incidents.json'),'evidence':read_json(DATA/'evidence/pages.json'),'cases':cases,'investigations':studies,'forecast':forecast,'resources':read_json(DATA/'challenge-resources.json'),'research':[{'name':p.stem,'file':p.name,'text':p.read_text(encoding='utf-8')} for p in sorted(research)]}
        (stage/'observation-rows.js').write_text('Object.assign(window.FF,'+packed({'tests':tests,'rawTables':tables})+');\n',encoding='utf-8')
        (stage/'observation-rows-lite.js').write_text(compact_script(tests,tables),encoding='utf-8')
        benchmark=DATA/'chat-benchmark.json'
        if benchmark.is_file():
            data['chatBenchmark']=read_json(benchmark)
            shutil.copy2(benchmark,stage/'data'/benchmark.name)
        (stage/'records.js').write_text('window.FF='+packed(data)+';\n',encoding='utf-8')
        manual=(SITE/'manual.html').read_text(encoding='utf-8')
        article=re.search('(<article.*?</article>)',manual,flags=re.S)
        if not article:raise ValueError('The manual needs an article element')
        audits=[]
        for identifier,filename,title,description in (
            ('calculator','science-chat-holdout.json','First calculator test · 40 questions','First evaluation of the frozen archive calculator. The full chat may answer a question that the calculator declines.'),
            ('initial-interface','science-chat-browser-audit.json','First browser replay · 40 questions','The visible response needed to answer the question or explicitly withhold an unsupported numerical result.'),
            ('replay','science-chat-regression.json','Updated chat · 40 exposed questions','These questions were available during repairs. Compare each response with the original calculator and browser replies.'),
            ('acceptance','science-chat-acceptance.json','Updated chat · 24 new questions','The 24 prompts and reference answers were sealed separately before the UI adapter was frozen. Each prompt was entered in the static chat interface. These questions focus on the revised query handling.'),
            ('corrected','science-chat-acceptance-replay.json','Earlier release · replay of 24 questions','After the first attempt, repairs addressed the two failures. This replay checks the previous interface.'),
            ('master24','master-science-24.json','Master edition · 24-question replay','Actual visible chat with the evidence gate on a previously exposed bank.'),
            ('master40','master-science-40.json','Master edition · 40-question replay','Actual visible chat with the evidence gate on the original 40-question archive bank.')):
            if (stage/filename).is_file():
                cases_for_run=read_json(stage/filename)['cases']
                if identifier=='initial-interface':
                    cases_for_run=[dict(row,**{'pass':row['pass_visible']}) for row in cases_for_run]
                audits.append(dict(id=identifier,file=filename,title=title,description=description,cases=cases_for_run))
        (stage/'archive-audit-data.js').write_text('window.FFArchiveAudits='+packed(audits)+';\n',encoding='utf-8')
        (stage/'guide.js').write_text('window.FFGuide='+packed(article[1])+';\n',encoding='utf-8')
        modeldir=DATA/'model'; weights=(modeldir/'model.safetensors').read_bytes()
        if hsh(weights)!='f95ffde02ad06f63ae38eb9d400038cd5ccaf8411ec3cb650c6025113f96cbb8':raise ValueError('Model checksum mismatch')
        tokenfile=(modeldir/'tokenizer.json').read_bytes()
        if hsh(tokenfile)!='e67e803f624fb4d67dea1c730d06e1067e1b14d830e2c2202569e3ef0f70bb50':raise ValueError('Tokenizer checksum mismatch')
        offset=struct.unpack('<Q',weights[:8])[0]; h=json.loads(weights[8:8+offset])['embeddings'];n,dim=h['shape']
        raw=weights[8+offset:];vocab=json.loads(tokenfile)['model']['vocab']
        if h['dtype']!='F32' or len(raw)!=n*dim*4 or len(vocab)!=n:raise ValueError('Invalid model')
        (stage/'model.js').write_text('window.FFModel='+packed({'dim':dim,'vocab':vocab,'weights':base64.b64encode(raw).decode('ascii')})+';\n',encoding='utf-8')
        (stage/'licenses').mkdir()
        for name in ('README.md','LICENSE.txt'):
            shutil.copy2(modeldir/name,stage/'licenses'/('model-'+name))
        if (ROOT/'LICENSE').exists():shutil.copy2(ROOT/'LICENSE',stage/'licenses'/'software.txt')
        evidence={p.relative_to(stage).as_posix():hsh(p.read_bytes()) for p in sorted(stage.rglob('*')) if p.is_file()}
        evidence.update(package_offline_site(stage, evidence))
        (stage/'checksums.json').write_text(json.dumps(evidence,indent=2)+'\n')
        # Preserve last working build until staging is complete.
        old=Path(temp)/'previous'
        if DIST.exists(): DIST.rename(old)
        try: stage.rename(DIST)
        except OSError:
            if old.exists():old.rename(DIST)
            raise
    print(f'Built {DIST}: {len(tests)} observations, {len(studies)} catalog entries, {len(cases)} cases and forecast.')
if __name__=='__main__':build()
