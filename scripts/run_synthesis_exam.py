"""Audit the installed synthesis model on every question.

Reuse actual model outputs from the recorded, frozen UI session where available.
For any first-turn question routed entirely to a calculator or guard, run exactly
the local retrieval and synthesis configuration. No reference answers are read.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from chat.engine import Engine, OllamaSelector, DEFAULT_MODEL
from chat.synthesis import synthesize


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('bank','ui','out'):p.add_argument(name,type=Path)
    a=p.parse_args()
    digest=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
    questions=json.loads(a.bank.read_text())['questions']
    recorded={r['id']:r for r in map(json.loads,a.ui.read_text().splitlines())}
    ui_health=json.loads(Path(str(a.ui)+'.meta.json').read_text())['health']
    if set(recorded)!={q['id'] for q in questions}:raise ValueError('UI run incomplete')
    engine=Engine(OllamaSelector(DEFAULT_MODEL));health=engine.health()
    if not health['ready']:raise ValueError('Local model unavailable')
    for f in ('model_digest','engine_sha256','research_sha256','corpus_sha256'):
        if health[f]!=ui_health[f]:raise ValueError('Diagnostic fingerprint differs from visible UI: '+f)
    meta=Path(str(a.out)+'.meta.json')
    info={'bankSHA256':digest(a.bank),'uiSHA256':digest(a.ui),'health':health,'method':'Actual normal model request reused, or explicit model call on tool-only question.'}
    if meta.exists() and json.loads(meta.read_text())!=info:raise ValueError('Different run; cannot resume')
    meta.write_text(json.dumps(info,indent=2)+'\n')
    done={json.loads(line)['id'] for line in a.out.read_text().splitlines()} if a.out.exists() else set()
    with a.out.open('a') as out:
        for q in questions:
            if q['id'] in done:continue
            r=recorded[q['id']];query=q['message']
            if r['question']!=query:raise ValueError('Question mismatch')
            observed=[s for s in r['service'] if s.get('usage',{}).get('inferences',0)>0 and s.get('model_digest')==health['model_digest']]
            if observed:
                item=observed[-1];usage=item['usage'];source='UI model request'
            else:
                hits,context=engine.index.research_hits(query,[])
                item,usage=synthesize(engine.provider,query,[h.passage for h in hits[:15]],context)
                source='additional direct model request'
            if not usage.get('inferences'):raise ValueError('Missing model usage')
            row={'id':q['id'],'question':query,'level':q['level'],'displayed':item['answer'],'status':item['status'],
                 'sources':item.get('citations',[]),'usage':usage,'origin':source,'model_digest':health['model_digest']}
            out.write(json.dumps(row,ensure_ascii=False)+'\n');out.flush()


if __name__=='__main__':main()
