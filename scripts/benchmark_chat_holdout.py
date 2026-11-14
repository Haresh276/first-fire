#!/usr/bin/env python3
"""Run the 24-question follow-up with the original benchmark scoring rules."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from benchmark_chat import ROOT, collect, metrics, score


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    path=ROOT/'tests/chat/holdout.json'
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest==(path.with_suffix('.sha256')).read_text().split()[0]
    suite=json.loads(path.read_text())
    assert len(suite['questions'])==24
    args.out.mkdir(parents=True,exist_ok=True)
    raw=args.out/'responses.jsonl'
    started=datetime.now(timezone.utc).isoformat()
    with urlopen(args.url.rsplit('/chat',1)[0]+'/health',timeout=10) as request:
        health=json.load(request)
    rows=[]
    with raw.open('x') as output:
        for q in suite['questions']:
            item=collect(args.url,q,120)
            output.write(json.dumps(item,ensure_ascii=False)+'\n');output.flush()
            rows.append(dict(q,response=item['response'],latency_ms=item['latency_ms'],
                             error=item.get('error'),scores=score(q,item['response'],suite['sources'])))
    stats={'suite':suite['version'],'suite_sha256':digest,'overall':metrics(rows),
           'started_utc':started,'finished_utc':datetime.now(timezone.utc).isoformat(),
           'expected_behavior':{g:metrics([r for r in rows if r['expected_behavior']==g])
                                for g in ('answer','boundary','unanswerable')},
           'endpoint':args.url,'health':health,'scorer_sha256':hashlib.sha256((ROOT/'scripts/benchmark_chat.py').read_bytes()).hexdigest()}
    (args.out/'summary.json').write_text(json.dumps(stats,indent=2)+'\n')
    (args.out/'results.json').write_text(json.dumps({'summary':stats,'rows':rows},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(stats['overall'],indent=2))

if __name__=='__main__':
    main()
