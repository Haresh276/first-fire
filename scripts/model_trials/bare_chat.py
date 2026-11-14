"""Generate an ungrounded local comparator using only public benchmark prompts and histories."""
import argparse, hashlib, json, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

MODEL='gemma3:1b'
SYSTEM=('You answer research questions about spacecraft fire experiments and FIRST FIRE. '
'Answer the exact question concisely. Be careful with material, unit, gravity, endpoint and negation. '
'If you do not have evidence, say so; do not invent experiments, outcomes or citations. '
'Return a JSON object with status (answered, limited, or abstained) and answer. No tools are available.')
SCHEMA={'type':'object','properties':{'status':{'type':'string','enum':['answered','limited','abstained']},'answer':{'type':'string'}},'required':['status','answer'],'additionalProperties':False}
def generate(a):
    raw=a.suite.read_bytes();suite=json.loads(raw)
    qs=suite if isinstance(suite,list) else suite.get('questions',suite.get('items'))
    if not isinstance(qs,list) or len(qs)!=100:raise ValueError('Expected all 100 questions')
    a.out.parent.mkdir(parents=True,exist_ok=True)
    req_url='http://127.0.0.1:11434/api/chat'
    with a.out.open('x' if not a.overwrite else 'w',encoding='utf-8') as out:
        for i,q in enumerate(qs,1):
            prompt=q.get('question') or q.get('message') or q.get('prompt')
            assert prompt and q.get('id'), 'Unrecognized question schema'
            history=q.get('history',[])
            messages=[{'role':'system','content':SYSTEM},*({'role':x['role'],'content':x['content']} for x in history),{'role':'user','content':prompt}]
            payload={'model':a.model,'messages':messages,'format':SCHEMA,'stream':False,'options':{'temperature':0,'seed':13,'num_ctx':4096,'num_predict':220}}
            if a.model.startswith('qwen3'):payload['think']=False
            start=time.perf_counter()
            row={'id':q['id'],'question':prompt}
            try:
                req=urllib.request.Request(req_url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
                with urllib.request.urlopen(req,timeout=120) as response:r=json.load(response)
                raw_answer=r['message']['content'];row['raw_model_text']=raw_answer
                body=json.loads(raw_answer);assert body['status'] in ('answered','limited','abstained') and isinstance(body['answer'],str)
                row['response']={**body,'citations':[],'retrieved':[],'model':r['model'],'provider':'ollama_closed_book'}
                row.update(output_tokens=r.get('eval_count'),input_tokens=r.get('prompt_eval_count'),finish=r.get('done_reason'))
            except Exception as e:row.update(error=type(e).__name__+': '+str(e),response={'answer':'','status':'error','citations':[],'retrieved':[]})
            row['latency_ms']=round((time.perf_counter()-start)*1000,1)
            out.write(json.dumps(row,ensure_ascii=False)+'\n');out.flush()
            if i%10==0:print('Closed-book',i,'of',len(qs),flush=True)
    meta={'model':a.model,'system':SYSTEM,'options':payload['options'],'schema':SCHEMA,'suite_sha256':hashlib.sha256(raw).hexdigest(),'completed_utc':datetime.now(timezone.utc).isoformat(),'note':'No primary-source access. Answer content is the fair comparison: scores that require registered citations structurally favor the grounded system.'}
    a.out.with_suffix('.meta.json').write_text(json.dumps(meta,indent=2)+'\n')
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--suite',type=Path,default=Path('tests/chat/questions.json'));p.add_argument('--model',default=MODEL);p.add_argument('--out',required=True,type=Path);p.add_argument('--overwrite',action='store_true');generate(p.parse_args())
