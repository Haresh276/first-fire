"""Run an independent local reviewer against the exact source pages used by the Referee.

Regenerate with pypdf 6.10.0, Ollama with gemma3:1b and the originals named in
data/evidence/pages.json: python scripts/review_referee.py /path/to/originals
No completed answer, visitor question, or résumé is sent to a remote provider.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener

from verify_quotes import CASES, EVIDENCE, ROOT, extract, fingerprints, hit, sha

MODEL = 'gemma3:1b'
PROMPT = """Read the supplied scientific source extract. Classify the candidate statement. Choose 'supported' only if the extract directly establishes the whole statement. Observations, authors' interpretations and expected future outcomes are distinct. Match materials, gas streams, conditions, direction and quantities. Choose 'contradicted' if the source states the opposite or gives an incompatible value. Otherwise choose 'insufficient'. Use only the provided text. Return a JSON object with verdict."""
# Named public assertions (including challenges), written independently of model verdicts.
CASES_TO_CHECK = [
    ('nomex', 'saff25', 'The Nomex fabric did not ignite in Saffire-II sample 2-7.'),
    ('acrylic', 'saff25', 'PMMA burned while its flame heated the Nomex fabric.'),
    ('flex-155', 'flex189', 'After the visible flame went out, the researchers interpreted the later behavior as evidence of cool-flame burning.'),
    ('flex-120', 'flex154', 'The investigators could not establish cool-flame burning from the available measurements.'),
    ('extinction', 'luci34', 'The fabric flame went out about 45 seconds earlier at Earth gravity than at partial gravity.'),
    ('teflon', 'sameS8', 'The ISS detector would have missed about 66.7% of the Teflon smoke tests.'),
    ('kapton', 'sameS8', 'The ISS detector signal would have stayed below the alarm threshold in over half of the Kapton smoke tests.'),
    ('burner', 'cfig21', 'The chamber atmosphere was set before the burner gas began to flow.'),
    ('tape', 'ices9', 'The lunar-gravity buoyant limit was below the extrapolated ground-test value in the reported comparison.'),
    ('plastic', 'ices11', 'For polycarbonate and Nomex Velcro the lunar-gravity extinction oxygen concentration was higher than in the cited ground tests.'),
    ('velocity', 'ices10', 'The lunar-gravity flow velocity was unknown in this analysis.'),
    ('lunar', 'fm25', 'The planned lunar test at 25% starting oxygen was expected to be unlikely to ignite.'),
    ('lunar-design', 'fm25', 'NASA described four planned tests at different starting oxygen concentrations.'),
    ('fake-ignition', 'saff25', 'The Nomex fabric ignited in the composite test.'),
    ('fake-time', 'luci34', 'The fabric flame went out about 450 seconds earlier at Earth gravity than at partial gravity.'),
    ('fake-alarm', 'sameS8', 'The ISS detector would have missed about 6.7% of the Teflon smoke tests.'),
    ('fake-flight', 'fm25', 'A lunar flight test has already demonstrated ignition at 25% oxygen.'),
]
# Additional short receipts include material or endpoint context on the same pinned page.
QUOTES = {
    'sameS8': 'The ISS detector would not have alarmed for over half of the Kapton smoke tests, and 2/3 of the Teflon tests.',
    'fm25': 'Start at 25% not expected to ignite but would provide a margin of safety',
    'lunar-design': 'Conduct four tests at 8.2 psi:',
    'saff25': 'Despite this significant heating load, the fabric was not ignited.',
    'acrylic': 'the flame plume was extending over and heating the base of the Nomex® fabric.',
}
NUMERIC = {
    'nomex':'sample-id', 'extinction':'extinction', 'fake-time':'extinction',
    'teflon':'teflon', 'fake-alarm':'teflon', 'lunar':'starting-oxygen', 'fake-flight':'starting-oxygen',
    'lunar-design':'burn-count'
}

def run(originals):
    evidence=json.loads(EVIDENCE.read_text())
    sources={s['anchor']:s for c in json.loads(CASES.read_text()) for s in c['sources'] if s.get('anchor')}
    client=build_opener(ProxyHandler({}))
    def api(route, body=None):
        request=Request('http://127.0.0.1:11434'+route, data=json.dumps(body).encode() if body else None,
                        headers={'Content-Type':'application/json'})
        with client.open(request,timeout=90) as stream:
            return json.load(stream)
    digest=next(m['digest'] for m in api('/api/tags')['models'] if m['name']==MODEL)
    results=[]
    for key,anchor_id,claim in CASES_TO_CHECK:
        anchor=evidence['anchors'][anchor_id]
        document=evidence['documents'][anchor['document']]
        content=(originals/document['filename']).read_bytes()
        assert sha(content)==document['sha256']
        page=extract(content,document,anchor)
        assert fingerprints(page)==anchor['tokens']
        quote=QUOTES.get(key,QUOTES.get(anchor_id,sources[anchor_id]['quote']))
        assert hit(anchor['tokens'],quote), (anchor_id,quote)
        body={'model':MODEL,'options':{'temperature':0,'seed':19,'num_ctx':8192,'num_predict':32},
              'keep_alive':'5m','stream':False,'format':{'type':'object','properties':{'verdict':{'type':'string','enum':['supported','contradicted','insufficient']}},'required':['verdict']},
              'messages':[{'role':'system','content':PROMPT},{'role':'user','content':json.dumps({'source':page,'claim':claim},ensure_ascii=False)}]}
        verdict=json.loads(api('/api/chat',body)['message']['content'])['verdict']
        if verdict not in ('supported','contradicted','insufficient'):raise ValueError(verdict)
        binding=json.dumps([anchor_id,document['sha256'],quote,claim],separators=(',',':'),ensure_ascii=False)
        results.append(dict(id=key,anchor=anchor_id,quote=quote,claim=claim,verdict=verdict,binding=sha(binding.encode()),numeric=NUMERIC.get(key),fixture=key.startswith('fake-')))
        print(key,verdict,flush=True)
    report={'model':MODEL,'digest':digest,'prompt_sha256':hashlib.sha256(PROMPT.encode()).hexdigest(),'cases':results}
    path=ROOT/'site/referee-reviews.js'
    path.write_text('globalThis.FFRefereeReviews='+json.dumps(report,ensure_ascii=False,indent=2)+';\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('originals',type=Path)
    run(parser.parse_args().originals)
