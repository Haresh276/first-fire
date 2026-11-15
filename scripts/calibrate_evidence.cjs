/* Use only the saved 100+24 model completions and their recorded strict results.
   The post-gate scorer independently applies the same frozen answer rubric to the new wording. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
globalThis.window=globalThis;for(const file of ['dist/records.js','dist/observation-rows.js','site/forecast-ui.js','site/referee-reviews.js','site/referee-passages.js','site/science-chat.js','site/referee-deck.js','site/intent-router.js','site/mission-receipts.js','site/source-claim-reviews.js','site/source-claims.js','site/evidence-desk.js'])require(path.join(root,file));
const sets=[['Development 100','incident-v21','questions'],['Follow-up 24','holdout-v21','holdout']];
require(path.join(root,'site/record-facts.js'));
function fitted(v,a){if(v===null)return null;const logit=Math.log(v/(1-v));return 1/(1+Math.exp(-logit-a));}
function summarize(rows,key){
  const all=[];
  for(const [set] of sets){
    const bins=new Map();
    for(const r of rows.filter(r=>r.set===set)){
      const v=r[key],label=v===null?'Not established':v>=.8?'High':v>=.5?'Medium':'Low';
      const item=bins.get(label)||{set,label,n:0,total:0,passed:0,gatePassed:0};
      item.n++;item.total+=v||0;item.passed+=Number(r.originalStrict);item.gatePassed+=Number(r.gateStrict);bins.set(label,item);
    }
    for(const {total,...r} of bins.values())all.push({...r,mean:r.label==='Not established'?null:total/r.n});
  }
  return all;
}
async function main(){
  const rows=[],fingerprints={};
  for(const [set,name,bank] of sets){
    const file='research/chat-runs/'+name+'/results.json',data=json(file),suite='tests/chat/'+bank+'.json';
    fingerprints[file]=sha(read(file));fingerprints[suite]=sha(read(suite));
    const answers=[];
    for(const item of data.rows){
      const question=item.message,raw=item.response,prior=[],type=FFIntentRouter.detect(question,prior);
      const input={answer:raw.answer,sources:raw.citations,status:raw.status,mode:'local'};
      const proposed=FFDeckReferee.forecastAnswer(question,prior)||await FFDeckReferee.checkedReply(question,input);
      const out=await FFEvidenceDesk.gate(question,proposed,prior,type,{level:name==='incident-v21'?item.difficulty:FFEvidenceDesk.level(question)});
      const {checks,confidence}=out.verification,failed=Object.keys(checks).filter(k=>['fail','unavailable'].includes(checks[k].state));
      answers.push({answer:out.answer,status:out.status,citations:out.sources});
      rows.push({set,id:item.id,question,proposal:raw.answer,displayed:out.answer,difficulty:confidence.difficulty,base:confidence.rate,score:confidence.value,label:confidence.label,
        originalStrict:item.scores.strict_pass,gateStrict:null,kind:out.evidenceKind,failed,checks,sources:out.sources,rawStatus:raw.status,rawSources:raw.citations});
    }
    const score=spawnSync('python3',['-c',"import sys,json;from benchmark_chat import score; s=json.load(open('../"+suite+"')); a=json.load(sys.stdin);print(json.dumps([score(q,r,s['sources'])['strict_pass'] for q,r in zip(s['questions'],a)]))"],
      {cwd:path.join(root,'scripts'),input:JSON.stringify(answers),encoding:'utf8',maxBuffer:6e6});
    if(score.status!==0)throw Error(score.stderr);
    const strict=JSON.parse(score.stdout);rows.filter(r=>r.set===set).forEach((r,i)=>r.gateStrict=strict[i]);
  }
  // Fit a single intercept to the development labels only. Keep each product's ordering
  // and keep withheld answers unscored. Never choose an intercept using the 24 outcomes.
  const dev=rows.filter(r=>r.set===sets[0][0]&&r.score!==null);
  let l=-12,h=12;
  for(let i=0;i<50;i++){const m=(l+h)/2,diff=dev.reduce((s,r)=>s+fitted(r.score,m)-Number(r.gateStrict),0);if(diff>0)h=m;else l=m;}
  const intercept=(l+h)/2;
  for(const row of rows)row.refit=fitted(row.score,intercept);
  const bins=summarize(rows,'score'),refitBins=summarize(rows,'refit');
  function test(bin){return bin.filter(b=>b.set===sets[1][0]&&b.mean!==null);}
  function outcome(bin){const val=test(bin);return val.length?val.every(b=>Math.abs(b.gatePassed/b.n-b.mean)<=.1):false;}
  const accepted=outcome(refitBins);
  const result='On the separate 24-question follow-up, the preregistered factors '+(outcome(bins)?'met':'missed')+' a ten-point gap between mean score and observed pass frequency in every populated numeric bin. A development-only logistic intercept refit '+(accepted?'met':'also missed')+' that criterion. Small or empty bins cannot validate a general reliability probability. Live scores retain the published evidence factors.';
  const method='The original 100 development and 24 follow-up answers came from recorded local model runs. The frozen question rubric was applied again to the wording shown after the new evidence gate. Calibration compares the factor product with that post-gate pass frequency. The adjacent original-results column preserves the earlier strict score. Not established has no numerical score. Scoring counts an appropriate abstention as correct where the rubric permits it.';
  const ledgerFile='research/evidence-errors-ledger.json';const ledger=fs.existsSync(path.join(root,ledgerFile))?json(ledgerFile):[];
  for(const r of rows){
    const id=FFEvidenceDesk.version+'-'+r.id;
    const previous=ledger.filter(e=>e.id===id||e.supersedes===id);
    const limited=r.failed.length||['withheld','quote-only','input-needed'].includes(r.kind);
    if(!previous.length&&!limited)continue;
    const status=limited?r.kind==='withheld'?'withheld':'limited':'fixed';
    if(previous.at(-1)?.status===status&&previous.at(-1).displayed===r.displayed)continue;
    const revision=previous.length+1;
    ledger.push({id:revision===1?id:id+'-r'+revision,...(revision>1?{supersedes:id}:{}),release:FFEvidenceDesk.version,status,
      question:r.question,proposal:r.proposal,displayed:r.displayed,failed:limited?(r.failed.length?r.failed:['additional inputs required']):[]});
  }
  for(const file of ['site/evidence-desk.js','site/referee-deck.js','site/science-chat.js','site/source-claims.js','site/source-claim-reviews.js','site/record-facts.js','scripts/benchmark_chat.py','data/evidence/pages.json','data/evidence/source-claim-documents.json','site/mission-receipts.js'])fingerprints[file]=sha(read(file));
  const metadata={method,result,fingerprints,intercept,accepted,bins,refitBins};
  fs.writeFileSync(path.join(root,ledgerFile),JSON.stringify(ledger,null,2)+'\n');
  fs.writeFileSync(path.join(root,'site/evidence-calibration.json'),JSON.stringify({...metadata,rows},null,2)+'\n');
  const replayInputs=Object.fromEntries(rows.map(r=>[r.id,{status:r.rawStatus,sources:r.rawSources}]));
  fs.writeFileSync(path.join(root,'site/evidence-calibration.js'),'globalThis.FFEvidenceRelease='+JSON.stringify({...metadata,errors:ledger,replayInputs})+';\n');
  console.log(JSON.stringify({bins,refitBins,accepted,n:rows.length},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
