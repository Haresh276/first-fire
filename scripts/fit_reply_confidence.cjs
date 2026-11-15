/* Fit on the named historical development bank. The new benchmark is never an input to fitting. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const confidence=require('../site/answer-confidence.js');
const root=path.resolve(__dirname,'..');
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const bins=[[0,.5],[.5,.8],[.8,1]];
const l2=2;

function validateRecord(row) {
  if(typeof row.correct!=='boolean'||!Number.isFinite(row.probability)||row.probability<0||row.probability>1)throw Error('Invalid probability or outcome');
}
function proportionInterval(k,n) {
  if(!n)return null;
  const z=1.959963984540054,p=k/n,z2=z*z;
  const center=(p+z2/(2*n))/(1+z2/n),half=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/(1+z2/n);
  return [Math.max(0,center-half),Math.min(1,center+half)];
}
function metrics(rows,devRate) {
  if(!rows.length)throw Error('An evaluation requires responses');
  if(!Number.isFinite(devRate)||devRate<0||devRate>1)throw Error('Missing development prevalence');
  rows.forEach(validateRecord);
  const n=rows.length, mean=field=>rows.reduce((sum,r)=>sum+field(r),0)/n;
  const accuracy=mean(r=>Number(r.correct)),meanProbability=mean(r=>r.probability);
  const brier=mean(r=>(r.probability-Number(r.correct))**2);
  const logLoss=mean(r=>-Math.log(Math.max(1e-15,r.correct?r.probability:1-r.probability)));
  const constantBrier=mean(r=>(devRate-Number(r.correct))**2);
  const reliability=bins.map(([lo,hi])=>{
    const selected=rows.filter(r=>r.probability>=lo && (r.probability<hi || hi===1));
    const count=selected.length,passed=selected.filter(r=>r.correct).length;
    const prediction=count?selected.reduce((a,r)=>a+r.probability,0)/count:null;
    return {lower:lo,upper:hi,n:count,passed,meanProbability:prediction,accuracy:count?passed/count:null,
      accuracy95:proportionInterval(passed,count),gap:count?Math.abs(passed/count-prediction):null};
  });
  const populated=reliability.filter(b=>b.n);
  return {n,passed:rows.filter(r=>r.correct).length,accuracy,accuracy95:proportionInterval(rows.filter(r=>r.correct).length,n),meanProbability,brier,logLoss,constantBrier,
    ece:populated.reduce((s,b)=>s+b.n*b.gap,0)/n,maxGap:Math.max(...populated.map(b=>b.gap)),
    eachPopulatedBinWithinTenPoints:populated.every(b=>b.gap<=.1),reliability};
}
// Solve a small dense positive-definite system with pivoted Gaussian elimination.
function solve(matrix,target) {
  const a=matrix.map((r,i)=>[...r,target[i]]),n=a.length;
  for(let i=0;i<n;i++){
    let pivot=i;
    for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];
    if(Math.abs(a[i][i])<1e-12)throw Error('Calibration fit has a singular matrix');
    for(let j=i+1;j<n;j++){
      const factor=a[j][i]/a[i][i];
      for(let k=i;k<=n;k++)a[j][k]-=factor*a[i][k];
    }
  }
  const out=Array(n).fill(0);
  for(let i=n-1;i>=0;i--){
    let sum=a[i][n];
    for(let j=i+1;j<n;j++)sum-=a[i][j]*out[j];
    out[i]=sum/a[i][i];
  }
  return out;
}
function fit(rows) {
  if(rows.some(r=>typeof r.correct!=='boolean'))throw Error('The development verdict must be true or false');
  if(!rows.length||rows.every(r=>r.correct) || rows.every(r=>!r.correct))throw Error('Development labels need both outcomes');
  const x=rows.map(r=>confidence.features(r.question,r.turn)),n=x.length,m=confidence.featureNames.length+1;
  const centers=x[0].map((_,i)=>x.reduce((s,a)=>s+a[i],0)/n);
  const design=x.map(r=>[1,...r.map((v,i)=>v-centers[i])]);
  const devRate=rows.filter(r=>r.correct).length/n;
  let co=[Math.log(devRate/(1-devRate)),...Array(m-1).fill(0)];
  for(let iter=0;iter<60;iter++){
    const grad=co.map((v,j)=>j?-l2*v:0);
    const h=co.map((_,j)=>co.map((__,k)=>j&&j===k?l2:0));
    for(let i=0;i<n;i++){
      const f=design[i],p=confidence.sigmoid(f.reduce((s,v,j)=>s+v*co[j],0));
      for(let j=0;j<m;j++){
        grad[j]+=(Number(rows[i].correct)-p)*f[j];
        for(let k=0;k<m;k++)h[j][k]+=p*(1-p)*f[j]*f[k];
      }
    }
    const step=solve(h,grad);
    co=co.map((v,j)=>v+step[j]);
    if(Math.max(...step.map(Math.abs))<1e-9)break;
  }
  return {version:'reply-pass-v1',event:'full-reply-rubric-pass',n,devRate,features:confidence.featureNames,centers,intercept:co[0],weights:co.slice(1)};
}
function traces(file,bankPath) {
  const bankDigest=sha(fs.readFileSync(bankPath));
  if(fs.readFileSync(bankPath.replace(/\.json$/,'.sha256'),'utf8').trim().split(/\s/)[0]!==bankDigest)throw Error('Original development bank hash mismatch');
  const bank=JSON.parse(fs.readFileSync(bankPath)).questions;
  const raw=fs.readFileSync(file,'utf8').trim();const parsed=raw.startsWith('[')?JSON.parse(raw):raw.split(/\r?\n/).map(s=>JSON.parse(s));
  const records=new Map(parsed.map(r=>[r.id,r]));
  if(bank.length!==parsed.length || records.size!==bank.length)throw Error('Trace count must match the fixed bank');
  const rows=bank.map(q=>{
    const rec=records.get(q.id);
    if(!rec||rec.question!==q.message||!rec.turn || typeof rec.turn.answer!=='string'||!Array.isArray(rec.turn.sources)||!rec.turn.status)throw Error('Trace does not match the fixed question: '+q.id);
    if(typeof rec.displayed!=='string')throw Error('Missing visible reply: '+q.id);
    return {id:q.id,question:q.message,displayed:rec.displayed,turn:rec.turn};
  });
  const proc=cp.spawnSync('python3',['-c',`import json,sys;sys.path.insert(0,'scripts');from benchmark_chat import score
s=json.load(open(sys.argv[1]));r=json.load(sys.stdin);print(json.dumps([score(q,{'answer':t['displayed'],'status':t['turn']['status'],'citations':t['turn']['sources']},s['sources'])['strict_pass'] for q,t in zip(s['questions'],r)]))`,bankPath],
    {cwd:root,input:JSON.stringify(rows),encoding:'utf8',maxBuffer:8e6});
  if(proc.status!==0)throw Error(proc.stderr);
  const labels=JSON.parse(proc.stdout);
  return rows.map((r,i)=>({...r,correct:labels[i]}));
}
function legacy() {
  const result=JSON.parse(fs.readFileSync(path.join(root,'site/evidence-calibration.json'))).rows;
  return result.map(r=>({id:r.id,question:r.question,correct:r.gateStrict,set:r.set,
    turn:{answer:r.displayed,evidenceKind:r.kind,sources:r.sources,status:r.kind==='withheld'?'abstained':['quote-only','input-needed','mission-note'].includes(r.kind)?'limited':'answered',
      verification:{checks:r.checks,confidence:{value:r.score}}}}));
}
function predictions(rows,model) {
  return rows.map(r=>({id:r.id,correct:r.correct,probability:confidence.predict(r.question,r.turn,model).probability,kind:r.turn.evidenceKind}));
}
function sameReplyComparison(rows,model) {
  const paired=rows.filter(r=>Number.isFinite(r.turn.verification?.confidence?.value));
  return {total:rows.length,coverage:paired.length,
    evidenceFactor:paired.length?metrics(paired.map(r=>({correct:r.correct,probability:r.turn.verification.confidence.value})),model.devRate):null,
    fittedOnSameReplies:paired.length?metrics(predictions(paired,model),model.devRate):null};
}
function run(args) {
  const [mode,devFile,validationFile]=args;
  if(!['--legacy','--traces'].includes(mode) || mode==='--traces'&&!devFile)throw Error('Use --traces <development.jsonl> [followup.jsonl], or --legacy for the historical source.');
  const devBank=path.join(root,'tests/chat/questions.json'),validationBank=path.join(root,'tests/chat/holdout.json');
  let dev,val,provenance;
  if(mode==='--traces'){
    dev=traces(devFile,devBank);val=validationFile?traces(validationFile,validationBank):[];
    provenance={developmentTraceSHA256:sha(fs.readFileSync(devFile)),validationTraceSHA256:validationFile?sha(fs.readFileSync(validationFile)):null};
  }else{
    const earlier=legacy();dev=earlier.filter(r=>r.set==='Development 100');val=earlier.filter(r=>r.set==='Follow-up 24');
    provenance={historicalDisplaySHA256:sha(fs.readFileSync(path.join(root,'site/evidence-calibration.json')))};
  }
  const model={...fit(dev),developmentBankSHA256:sha(fs.readFileSync(devBank)),l2,
    featureCodeSHA256:sha(fs.readFileSync(path.join(root,'site/answer-confidence.js'))),
    developmentTraceSHA256:provenance.developmentTraceSHA256??provenance.historicalDisplaySHA256};
  model.version+='-'+sha(JSON.stringify(model)).slice(0,12);
  const report={method:'L2 logistic model on eight final-reply features; fit on the original development 100 only. Bins and penalty fixed before the independent fresh test.',
    source:mode==='--legacy'?'historical gated display replay':'actual revised chat displays',provenance,
    developmentBankSHA256:model.developmentBankSHA256,followupBankSHA256:sha(fs.readFileSync(validationBank)),model,
    apparentDev:metrics(predictions(dev,model),model.devRate),historicalFollowup:val.length?metrics(predictions(val,model),model.devRate):null,
    evidenceFactorComparison:{development:sameReplyComparison(dev,model),validation:sameReplyComparison(val,model)},
    development:predictions(dev,model),validation:predictions(val,model)};
  const out=path.join(root,'site/answer-confidence-fit.js');
  fs.writeFileSync(out,'/* Generated by scripts/fit_reply_confidence.cjs. Fit excludes follow-up and fresh labels. */\n'+
    '(() => {const fit='+JSON.stringify(model)+';if(typeof module!=="undefined")module.exports=fit;if(typeof globalThis!=="undefined")globalThis.FFAnswerConfidenceFit=fit;})();\n');
  fs.writeFileSync(path.join(root,'research/chat-runs/reply-confidence-development.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({n:dev.length,rate:model.devRate,apparentDev:report.apparentDev.brier,validation:report.historicalFollowup},null,2));
}
module.exports={fit,metrics,proportionInterval,predictions};
if(require.main===module)run(process.argv.slice(2));
