'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const confidence=require('../site/answer-confidence.js');
const model=require('../site/answer-confidence-fit.js');
const {fit,metrics}=require('../scripts/fit_reply_confidence.cjs');
global.window=global;
require('../site/evidence-desk.js');

test('a refused proposal on the archive path cannot inherit local-model confidence',async()=>{
  global.FF={};
  const question='What is the measured value?';
  const answer=await FFEvidenceDesk.gate(question,{answer:'4000',evidenceKind:'unknown',sources:[],status:'answered'});
  assert.equal(answer.status,'abstained');
  assert.doesNotMatch(answer.answer,/4000/);
  assert.equal(answer.verification.confidence.value,null);
  assert.equal(answer.verification.calibration.probability,null);
  assert.equal(answer.verification.calibration.reason,'archive-only');
  const input={answer:'Which material and endpoint?',status:'limited',evidenceKind:'input-needed',sources:[]};
  const followup=await FFEvidenceDesk.gate('What about the other one?',input,[answer]);
  assert.equal(followup.verification.calibration.showPercentage,false);
});

test('inference uses final-reply features and ignores benchmark labels and old confidence',()=>{
  const q='Which oxygen concentration was measured?',turn={answer:'The oxygen concentration was measured.',status:'answered',evidenceKind:'archive-row',sources:[{}]};
  const bogus={...turn,expected_answer:'irrelevant',scores:{strict_pass:false},difficulty:'challenge',id:'not-seen',verification:{confidence:{value:0}}};
  assert.deepEqual(confidence.predict(q,turn,model),confidence.predict(q,bogus,model));
  assert.throws(()=>confidence.predict(q,turn,{...model,features:[]}),/Incompatible/);
});

test('confidence metrics include empty bins, exact boundaries, withheld rows and constant comparator',()=>{
  const rows=[{probability:0,correct:false},{probability:.5,correct:true},{probability:.8,correct:false},{probability:1,correct:true}];
  const m=metrics(rows,.5);
  assert.deepEqual(m.reliability.map(b=>b.n),[1,1,2]);
  assert.equal(m.brier,(.25+.8**2)/4);
  assert.equal(m.constantBrier,.25);
  assert(Math.abs(m.logLoss-(-Math.log(.5)-Math.log(.2))/4)<1e-12);
  assert(Math.abs(m.ece-.325)<1e-12);
  assert.equal(m.eachPopulatedBinWithinTenPoints,false);
  const perfect=metrics([{probability:1,correct:true}],1);
  assert.equal(perfect.brier,0);
  assert.equal(perfect.reliability[0].accuracy95,null);
  assert(perfect.accuracy95[0]<.3);
  assert.throws(()=>metrics([{probability:1.2,correct:false}],.5),/Invalid/);
});

test('regularized fit is finite for constant predictors and deterministic',()=>{
  const r={question:'What is the limit?',turn:{answer:'Insufficient data.',status:'abstained',evidenceKind:'withheld',sources:[]}};
  const data=[{...r,correct:true},{...r,correct:true},{...r,correct:false}];
  const model=fit(data),out=confidence.predict(r.question,r.turn,model);
  assert.equal(out.probability,.666667);assert.deepEqual(model,fit(data));
});
