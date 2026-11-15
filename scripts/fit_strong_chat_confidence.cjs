'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const api=require('../site/reply-calibration.js'),{metrics}=require('./fit_reply_confidence.cjs');
const root=path.resolve(__dirname,'..'),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),lines=p=>read(p).toString().trim().split(/\r?\n/).map(s=>JSON.parse(s));
const {originalFile,planFile,splitFile}=Object.fromEntries(Object.entries({originalFile:'tests/chat/questions.json',planFile:'research/chat-runs/strong-calibration-plan.md',splitFile:'research/chat-runs/strong-calibration-split.json'}).map(([k,v])=>[k,path.join(root,v)]));
function split(bank,rows){
  const train=[],validation=[];
  const levels=new Map();
  for(const r of rows){const level=r.level||r.difficulty;if(!levels.has(level))levels.set(level,[]);levels.get(level).push(r);}
  for(const group of levels.values()){
    const sorted=group.map(r=>({id:r.id,key:hash('FF-reply-confidence-2/'+bank+'/'+r.id)})).sort((a,b)=>a.key.localeCompare(b.key)).map(r=>r.id);
    const k=Math.floor(.7*sorted.length);train.push(...sorted.slice(0,k));validation.push(...sorted.slice(k));
  }
  return {train:train.sort(),validation:validation.sort()};
}
function solve(matrix,rhs){
  const n=rhs.length,a=matrix.map((r,i)=>[...r,rhs[i]]);
  for(let i=0;i<n;i++){
    let pivot=i;
    for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];
    if(Math.abs(a[i][i])<1e-12)throw Error('Unidentified coefficient');
    for(let j=i+1;j<n;j++){const f=a[j][i]/a[i][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k];}
  }
  const x=Array(n).fill(0);
  for(let i=n-1;i>=0;i--){let v=a[i][n];for(let j=i+1;j<n;j++)v-=a[i][j]*x[j];x[i]=v/a[i][i];}
  return x;
}
function fit(rows){
  function rate(bank){const group=rows.filter(r=>r.bank===bank);return group.filter(r=>r.correct).length/group.length;}
  const old=rate('original'),semantic=rate('semantic');
  if(!(old>0&&old<1&&semantic>0&&semantic<1))throw Error('Both outcomes required in each training split');
  const x=rows.map(r=>api.features(r.question,r.turn)),centers=x[0].map((_,j)=>x.reduce((sum,row)=>sum+row[j],0)/x.length);
  const data=rows.map((r,i)=>[Number(r.bank==='original'),Number(r.bank==='semantic'),...x[i].map((v,j)=>v-centers[j])]);
  let w=[...[old,semantic].map(r=>Math.log(r/(1-r))),...centers.map(()=>0)];
  for(let iter=0;iter<60;iter++){
    const g=w.map((v,i)=>i>=2?-4*v:0),h=w.map((_,i)=>w.map((__,j)=>i===j&&i>=2?4:0));
    data.forEach((row,t)=>{const p=api.sigmoid(row.reduce((v,x,i)=>v+x*w[i],0));
      row.forEach((x,i)=>{g[i]+=x*(Number(rows[t].correct)-p);row.forEach((y,j)=>{h[i][j]+=p*(1-p)*x*y;});});
    });
    const step=solve(h,g);w=w.map((v,i)=>v+step[i]);
    if(Math.max(...step.map(Math.abs))<1e-9)break;
  }
  return {intercepts:{original:w[0],semantic:w[1]},devRate:semantic,originalDevRate:old,centers,weights:w.slice(2)};
}
function prediction(rows,model,intercept='semantic'){
  return rows.map(r=>({id:r.id,level:r.level,bank:r.bank,correct:r.correct,route:api.family(r.turn),probability:api.probability(r.question,r.turn,model,intercept)}));
}
function result(rows,rate) {
  const all=metrics(rows,rate);
  return {...all,calibrationInTheLarge:all.meanProbability-all.accuracy,highConfidenceMisses:rows.filter(r=>r.probability>=.8&&!r.correct).map(r=>r.id)};
}
function judgmentKey(row,fullSource=false){
  const citations=row.turn.sources.map(s=>{
    if(typeof s==='string')return s;
    const keys=fullSource?Object.keys(s).filter(k=>!['confidence','latency','duration','score','similarity'].includes(k)):['title','url','locator'];
    return Object.fromEntries(keys.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
  });
  const canonical=(_key,obj)=>obj&&typeof obj==='object'&&!Array.isArray(obj)?Object.fromEntries(Object.keys(obj).sort().map(k=>[k,obj[k]])):obj;
  return hash(JSON.stringify({id:row.id,answer:row.displayed.trim(),citations},canonical));
}
function originalLabels(rows){
  const code="import sys,json;sys.path.insert(0,'scripts');from benchmark_chat import score;s=json.load(open('tests/chat/questions.json'));r=json.load(sys.stdin);print(json.dumps({q['id']:score(q,{'answer':r[q['id']]['displayed'],'status':r[q['id']]['turn']['status'],'citations':r[q['id']]['turn']['sources']},s['sources'])['strict_pass'] for q in s['questions']}))";
  const p=cp.spawnSync('python3',['-c',code],{cwd:root,input:JSON.stringify(Object.fromEntries(rows.map(r=>[r.id,r]))),encoding:'utf8',maxBuffer:30e6});
  if(p.status!==0)throw Error(p.stderr);return JSON.parse(p.stdout);
}
function run(args){
  const [action,semanticFile,originalTrace,semanticTrace,gradesFile]=args;
  if(!['split','fit'].includes(action))throw Error('Use split original-A-questions.json or fit original-A-questions.json original.jsonl v2A.jsonl single-track-A-grades.json');
  const original=json(originalFile).questions,semantic=json(semanticFile).questions;
  if(original.length!==100||semantic.length!==100||!semantic.every(q=>/^F\d{3}$/.test(q.id)))throw Error('Expected exposed banks');
  if(hash(read(originalFile))!=='de7d1c8f0bd722f59475a3c30785929ef9e6b060e94c657e5edd44a214dd4afd')throw Error('Original bank changed');
  const record={rule:'Within each bank and level sort SHA-256 of FF-reply-confidence-2/ + bank + / + ID. First floor(70%) train.',planSHA256:hash(read(planFile)),bankHashes:{original:hash(read(originalFile)),semantic:hash(read(semanticFile))},original:split('original',original),semantic:split('semantic',semantic)};
  const serialized=JSON.stringify(record,null,2)+'\n';
  if(action==='split'){
    if(fs.existsSync(splitFile)&&read(splitFile).toString()!==serialized)throw Error('Existing split fingerprint differs');
    fs.writeFileSync(splitFile,serialized);console.log(hash(serialized));return;
  }
  if(read(splitFile).toString()!==serialized)throw Error('Development split disagrees with preregistration');
  const rows={original:lines(originalTrace),semantic:lines(semanticTrace)},verdicts=json(gradesFile);
  if(!Array.isArray(verdicts)||verdicts.length!==100||new Set(verdicts.map(r=>r.id)).size!==100)throw Error('Require exactly 100 unique graded A IDs');
  const labels={original:originalLabels(rows.original),semantic:Object.fromEntries(verdicts.map(r=>[r.id,r.passed]))};
  for(const [bank,qs] of Object.entries({original,semantic})){
    const ids=new Map(qs.map(q=>[q.id,q]));
    if(rows[bank].length!==100||new Set(rows[bank].map(r=>r.id)).size!==100)throw Error('Incomplete trace '+bank);
    for(const r of rows[bank]){
      if(r.question!==ids.get(r.id)?.message||typeof r.displayed!=='string'||!r.turn?.verification||typeof labels[bank][r.id]!=='boolean')throw Error('Trace or labels mismatch '+r.id);
      Object.assign(r,{bank,correct:labels[bank][r.id],level:ids.get(r.id).level||ids.get(r.id).difficulty});
    }
  }
  const byId=new Map(verdicts.map(v=>[v.id,v]));
  for(const r of rows.semantic){
    const key=byId.get(r.id).key;
    if(key && ![judgmentKey(r),judgmentKey(r,true)].includes(key))throw Error('Different visible answer or sources for the adjudication of '+r.id);
  }
  const health=[originalTrace,semanticTrace].map(p=>json(p+'.meta.json').health);
  if(!health[0].model_digest||health.some(h=>h.model_digest!==health[0].model_digest||h.engine_sha256!==health[0].engine_sha256||h.corpus_sha256!==health[0].corpus_sha256||h.research_sha256!==health[0].research_sha256||h.encoder_revision!==health[0].encoder_revision))throw Error('Different models or backend between development captures');
  const all=[...rows.original,...rows.semantic],train=all.filter(r=>record[r.bank].train.includes(r.id)),validation=all.filter(r=>record[r.bank].validation.includes(r.id));
  const model={...fit(train),ready:true,n:train.length,modelDigest:health[0].model_digest,engineSHA256:health[0].engine_sha256,corpusSHA256:health[0].corpus_sha256,researchSHA256:health[0].research_sha256,encoderRevision:health[0].encoder_revision,features:api.names,featureSHA256:hash(read(path.join(root,'site/reply-calibration.js'))),splitSHA256:hash(serialized),traceSHA256:[originalTrace,semanticTrace].map(p=>hash(read(p))),semanticVerdictSHA256:hash(read(gradesFile))};
  const semTrain=prediction(train.filter(r=>r.bank==='semantic'),model),semVal=prediction(validation.filter(r=>r.bank==='semantic'),model);
  const trainStats=result(semTrain,model.devRate),valStats=result(semVal,model.devRate);
  model.familyCounts={};
  for(const r of semTrain)model.familyCounts[r.route]=(model.familyCounts[r.route]||0)+1;
  model.publishBands=valStats.reliability.map((b,i)=>trainStats.reliability[i].n>=10&&b.n>=8&&b.gap<=.1);
  model.version='reply-v2-'+hash(JSON.stringify(model)).slice(0,12);
  const origVal=validation.filter(r=>r.bank==='original');
  const stats={semanticTraining:trainStats,semanticValidation:valStats,originalValidationAtSemanticIntercept:result(prediction(origVal,model),model.devRate),originalValidationAtOriginalIntercept:result(prediction(origVal,model,'original'),model.originalDevRate)};
  const outputs=all.map(r=>({id:r.id,bank:r.bank,level:r.level,training:record[r.bank].train.includes(r.id),correct:r.correct,...api.predict(r.question,r.turn,model,{local:true,digest:model.modelDigest,engine:model.engineSHA256,corpus:model.corpusSHA256,research:model.researchSHA256,encoder:model.encoderRevision})}));
  for(const [k,bank,training] of [['semanticTraining','semantic',true],['semanticValidation','semantic',false],['originalValidationAtSemanticIntercept','original',false]])stats[k].numericDisplayCount=outputs.filter(r=>r.bank===bank&&r.training===training&&r.showPercentage).length;
  fs.writeFileSync(path.join(root,'research/chat-runs/strong-calibration-development.json'),JSON.stringify({model,metrics:stats,outputs},null,2)+'\n');
  fs.writeFileSync(path.join(root,'site/reply-calibration-fit.js'),'/* Frozen on exposed original/A development inputs; bank B excluded. */\n(() => {const fit='+JSON.stringify(model)+';if(typeof module!=="undefined")module.exports=fit;globalThis.FFReplyCalibrationFit=fit;})();\n');
  console.log(model.version,model.devRate,model.publishBands,valStats.brier,valStats.ece);
}
module.exports={fit,split,result,judgmentKey};
if(require.main===module)run(process.argv.slice(2));
