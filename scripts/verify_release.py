"""Audit the actual offline distribution, including filenames, page receipts and source bytes."""
import argparse
import csv
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets=[]
    def handle_starttag(self, tag, attrs):
        d=dict(attrs)
        for attr in ('src','href'):
            u=d.get(attr)
            if u and not urlsplit(u).scheme and not u.startswith(('#','//')):
                self.assets.append(u)

def check(dist):
    assert dist.is_dir(), 'Missing dist. Build the project first.'
    digests=json.loads((dist/'checksums.json').read_text())
    actual={p.relative_to(dist).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
            for p in dist.rglob('*') if p.is_file() and p.name!='checksums.json'}
    assert digests==actual,'One or more release files changed: rebuild before release.'
    for page in dist.glob('*.html'):
        parser=Links();parser.feed(page.read_text())
        for url in parser.assets:
            f=(page.parent/unquote(urlsplit(url).path)).resolve()
            assert f.is_relative_to(dist.resolve()) and f.is_file(), (page.name,url)
    assert not any(p.name in ('key.example.json','.DS_Store') for p in dist.rglob('*')), 'Do not ship assessor keys or system files.'
    assert not any(p.suffix in ('.env','.pem') or p.name=='.git' for p in dist.rglob('*'))
    catalog=json.loads((dist/'data/investigations.json').read_text())
    tables={a['file']:a['sha256'] for s in catalog for a in s['tables']}
    assert len(tables)==20 and len(catalog)==19
    for name,sha in tables.items(): assert actual[name]==sha,name
    with (dist/'data/tests.csv').open(newline='') as f: rows=list(csv.DictReader(f))
    assert len(rows)==1058==len({r['record_id'] for r in rows})
    assert len({r['accession'] for r in rows})==9
    assert sum(s['rows'] for s in catalog)==len(rows)
    assert all(r['source_file'] in tables and r['doi'] and r['source_url'].startswith('https://') for r in rows)
    # In an inverse gas flame, the oxidizer delivered by the burner cannot become cabin oxygen.
    pair=[r for r in rows if '21202' in r['test_id'] and r['accession']=='PSI-159']
    assert any(r['o2_burner_pct']=='85' and r['o2_initial_pct']=='' for r in pair)
    casebook=json.loads((dist/'data/cases.json').read_text())
    assert len(casebook)==7 and all(len(c['options'])==6 and all(o['proof'] for o in c['options']) for c in casebook)
    incidents=json.loads((dist/'data/incidents.json').read_text())
    sources=incidents['sources']; assert len({event['id'] for event in incidents['records']})==len(incidents['records'])
    for event in incidents['records']:
        assert event['facts'].get('overview')
        for paragraphs in event['facts'].values():
            for paragraph in paragraphs:
                citation=sources[paragraph['source']]
                assert paragraph['text'] and citation['title'] and citation['locator'] and citation['url'].startswith('https://')
    chat_run=json.loads((dist/'data/chat-benchmark.json').read_text())
    assert len(chat_run['rows'])==100 and len({x['id'] for x in chat_run['rows']})==100
    assert all(isinstance(x['pass'],bool) and x['expected'] and x['question'] for x in chat_run['rows'])
    assert not (dist/'chat').exists() and not (dist/'tests').exists(), 'Static site must not expose local model service or evaluator inputs.'
    for required in ('chat-ui.js','chat.css','benchmark-ui.js','data/chat-benchmark.json','research/chat-models.md','research/chat-benchmark.md','research/world-model.md','manual.html','first-fire-user-manual.pdf','demo.html','first-fire-demo.pdf','model.js','claim.js','acrylic.js','guide.js','workbench.js','records.js','explorer.js','forecast-ui.js','study.js','research/evaluation.md','research/search.md'):
        assert required in actual,required
    for required in ('atlas-deck.js', 'mission-desk.js', 'observation-rows.js', 'physics-lab.js',
                     'cabin-liquid-weights.js', 'referee-deck.js', 'referee-passages.js', 'referee-reviews.js',
                     'first-fire-demo.mp4', 'technical-manual.html', 'first-fire-technical-manual.pdf',
                     'research/challenge-projects.md', 'challenge-projects.csv', 'forecast-lock/fm2-v1.tsr',
                     'research/code-review.md', 'code-review-readings.js', 'code-review.js', 'code-review-readings.csv',
                     'code-review-files.csv.gz', 'code-review-repositories.csv', 'code-review-supplement.csv'):
        assert required in actual, required
    for required in ('transfer-lab.js','transfer-lab.css','transport-lab.js','transport-fit.js','design-lab.js',
                     'design-lab.css','advanced.css','science-chat.js','research-session.js','science-chat-holdout.json','science-chat-browser-audit.json','science-chat-acceptance.json','science-chat-regression.json','archive-audit-data.js','archive-audit.js',
                     'research/advanced-methods.md','research/science-chat.md','research/science-chat-audit.md','research/transport-fit.md'):
        assert required in actual,required
    evaluation=json.loads((dist/'science-chat-holdout.json').read_text())
    assert evaluation['recordsSHA256']==actual['data/tests.csv']
    assert len(set(c['id'] for c in evaluation['cases']))==evaluation['count']==40
    assert sum(c['pass'] for c in evaluation['cases'])==evaluation['strictPass']
    for filename,bank in [('science-chat-regression.json','science-unseen-v1.json'),('science-chat-acceptance.json','science-acceptance-v1.json'),('science-chat-acceptance-replay.json','science-acceptance-v1.json')]:
        run=json.loads((dist/filename).read_text())
        assert run['n']==len(run['cases'])==len(set(c['id'] for c in run['cases']))
        assert sum(c['pass'] for c in run['cases'])==run['passed']
        assert hashlib.sha256((ROOT/'tests/chat'/bank).read_bytes()).hexdigest()==run['bankSHA256']
    assert json.loads((dist/'science-chat-acceptance-replay.json').read_text())['localChatUISHA256']==actual['chat-ui.js'], 'Repeat the release chat replay for this build.'
    lock='forecast-lock/fm2-v1.json'
    assert actual[lock]=='9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3', 'The signed forecast bytes must match v1.'
    frozen=json.loads((dist/lock).read_text())
    current=json.loads((dist/'data/forecast.json').read_text())
    for saved, burn in zip(frozen['predictions'], current['burns'], strict=True):
        assert (saved['starting_o2_pct'], saved['p_sustain']) == (burn['oxygen_pct'], burn['p_sustain'])
    print(f'Verified {len(actual)} file hashes, {len(tables)} original NASA tables, {len(rows)} unique observations and offline page assets. No assessor key in site.')
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('dist',nargs='?',type=Path,default=ROOT/'dist')
    check(parser.parse_args().dist)
