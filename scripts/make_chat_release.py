"""Make the offline browser report from a completed run without re-grading or logging later chats."""
import argparse,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main(datafile,out,version=None):
    run=json.loads(datafile.read_text())
    rows=run['rows'];assert len(rows)==100 and len({r['id'] for r in rows})==100
    release=[]
    model_names={r.get('response',{}).get('model') for r in rows}-{None}
    for r in rows:
        res=r.get('response',{});score=r['scores']
        missed=[]
        if score['failed_claim_patterns']:missed.append(str(len(score['failed_claim_patterns']))+' required wording or fact check(s) did not match. Compare the reference answer; this can include a valid paraphrase.')
        if score['contradiction_patterns_matched']:missed.append('A prewritten contradiction pattern matched the answer.')
        if not score['behavior_pass']:missed.append('The response status did not match the expected handling of this question.')
        if score['citation_pass'] is False:missed.append('At least one expected source or locator was absent.')
        if r.get('error'):missed.append('Request or model output error: '+str(r['error'])[:160])
        release.append(dict(id=r['id'],question=r['message'],level=r['difficulty'],history=r['history'],expected=r['reference_answer'],answer=res.get('answer',''),status=res.get('status','error'),citations=res.get('citations',[]),content=score['answer_content_pass'],behavior=score['behavior_pass'],citation=score['citation_pass'],retrieval=score['retrieval_all_at_3'],missed=missed,ms=r['latency_ms'],**{'pass':score['strict_pass']}))
    model=', '.join(sorted(model_names)) or 'Unavailable'
    version=version or ('v2' if datafile.parent.name.endswith('v2') else 'v1')
    data={'version':version,'name':model+' · grounded local chat · '+version,'inputs_sha256':hashlib.sha256((ROOT/'tests/chat/questions.json').read_bytes()).hexdigest(),'note':'A strict pass needs the required facts, acceptable handling and any specified source locators. Each source-checked question counts once, including those requiring multiple sources. Regexes can miss good paraphrases and overlook unrelated material. The full report includes the bare-model comparison and examples of both kinds of error.','rows':release}
    out.write_text(json.dumps(data,ensure_ascii=False,indent=1)+'\n')
if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('run',type=Path);ap.add_argument('--version',help='Version of the evaluated engine, for example v2.1');ap.add_argument('--out',type=Path,default=ROOT/'data/chat-benchmark.json');a=ap.parse_args();main(a.run,a.out,a.version)
