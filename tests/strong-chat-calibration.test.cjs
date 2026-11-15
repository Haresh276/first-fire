'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../site/reply-calibration.js'),{fit,split}=require('../scripts/fit_strong_chat_confidence.cjs');
const sample={answer:'N1 was 5 s longer than P1. [1]',status:'answered',evidenceKind:'grounded-synthesis',sources:[{id:'N1',locator:'row for N1 and P1'}],synthesisReceipt:{blocks:[{text:'N1 was 5 s longer than P1.',refs:[0],calculations:[['-',20,15]]}]},verification:{checks:{quote:{state:'pass'}}}};
const model={version:'test',ready:true,features:api.names,modelDigest:'known',engineSHA256:'selector',corpusSHA256:'archive',familyCounts:{synthesis:20},publishBands:[true,true,true],centers:api.names.map(()=>0),weights:api.names.map(()=>0),intercepts:{semantic:-1,original:1}};
test('all local outcomes get score; percentages require matching backend and supported route and probability band',()=>{
  const q='Compare N1 and P1. By how much?';
  const local={local:true,digest:'known',engine:'selector',corpus:'archive'};
  const good=api.predict(q,sample,model,local);
  assert.equal(good.probability,.268941);assert.equal(good.showPercentage,true);
  for(const env of [{local:false,digest:'known'},{local:true,digest:'other'},{...local,engine:'changed'},{...local,corpus:'changed'},undefined])assert.equal(api.predict(q,sample,model,env).probability,null);
  const held=api.predict(q,{...sample,evidenceKind:'withheld',status:'abstained'},model,local);
  assert.equal(held.probability,.268941);assert.equal(held.showPercentage,false);
  assert.equal(api.predict(q,sample,{...model,publishBands:[false,false,false]},local).showPercentage,false);
});
test('only verified blocks supply expression and attribution features',()=>{
  const q='By how much did N1 and P1 differ?';
  const valid=api.features(q,sample),invalid=api.features(q,{...sample,verification:{checks:{quote:{state:'fail'}}}});
  assert.equal(valid[0],1);assert.equal(valid[1],1);assert.equal(valid[4],1);assert.equal(valid[5],0);assert.equal(valid[8],1);
  assert.equal(invalid[0],0);assert.equal(invalid[1],0);assert.equal(invalid[5],1);assert.equal(invalid[8],0);
});
test('split is level-stratified and stable under reordering; semantic intercept does not inherit easier grading prevalence',()=>{
  const group=Array.from({length:40},(_,i)=>({id:'r'+i,level:i%2?'a':'b'}));
  const s=split('semantic',group);
  assert.equal(s.train.length,28);assert.equal(s.validation.length,12);assert.deepEqual(split('semantic',[...group].reverse()),s);
  const data=['original','semantic'].flatMap(bank=>Array.from({length:10},(_,i)=>({bank,correct:i<(bank==='semantic'?3:8),question:'How long?',turn:sample})));
  const f=fit(data);assert.equal(f.devRate,.3);assert.equal(api.probability('How long?',sample,f),.3);assert.equal(api.probability('How long?',sample,f,'original'),.8);
});
