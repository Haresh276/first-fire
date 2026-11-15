/* Evaluate two previously frozen estimators on the same final, independently graded replies. */
'use strict';
const fs=require('node:fs'), crypto=require('node:crypto');
const older=require('../site/answer-confidence.js'),priorFit=require('../site/answer-confidence-fit.js');
const strong=require('../site/reply-calibration.js'),fit=require('../site/reply-calibration-fit.js');
const {judgmentKey,result}=require('./fit_strong_chat_confidence.cjs');
const [tracePath,keyPath,gradePath,track,reportPath]=process.argv.slice(2);
if(!reportPath)throw Error('Provide candidate.jsonl key.json grades.json track output.json');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const load=p=>JSON.parse(fs.readFileSync(p));
const raw=fs.readFileSync(tracePath,'utf8').trim().split('\n').map(s=>JSON.parse(s));
const key=load(keyPath),grade=load(gradePath).filter(r=>key[r.ticket][0]===track);
const byId=new Map(grade.map(g=>[g.id,g]));
if(raw.length!==100||grade.length!==100||new Set(raw.map(r=>r.id)).size!==100||byId.size!==100)throw Error('Expected one response and one judgment per question');
const rows=raw.map(r=>{
  const g=byId.get(r.id),c=r.turn.verification.calibration;
  if(!g||key[g.ticket][1]!==r.id||g.key!==judgmentKey(r)&&g.key!==judgmentKey(r,true)||typeof g.passed!=='boolean')throw Error('Unmatched response '+r.id);
  if(c.model!==fit.version||!Number.isFinite(c.probability)||c.probability!==strong.probability(r.question,r.turn,fit))throw Error('Captured confidence mismatch '+r.id);
  return {id:r.id,level:r.level,correct:g.passed,code:g.code,newProbability:c.probability,previousProbability:older.predict(r.question,r.turn,priorFit).probability,
    percentageDisplayed:c.showPercentage,decision:g.key};
});
const score=name=>result(rows.map(r=>({correct:r.correct,id:r.id,probability:r[name]})),fit.devRate);
const report={description:'Same untouched B answers and semantic judgments under both fits. The stronger fit is the recorded before-grading estimate. The earlier 0.6B-era estimator is replayed on the identical final turns and was fitted for another model/rubric.',traceSHA256:sha(tracePath),gradesSHA256:sha(gradePath),mappingSHA256:sha(keyPath),model:fit.version,
 oldModel:priorFit.version,comparisonPrevalence:fit.devRate,numericUI:rows.filter(r=>r.percentageDisplayed).length,current:score('newProbability'),previous:score('previousProbability'),rows};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({n:rows.length,passed:report.current.passed,numericUI:report.numericUI,newBrier:report.current.brier,oldBrier:report.previous.brier,newECE:report.current.ece,oldECE:report.previous.ece}));
const [compactPath,compactTrack,shortPath]=process.argv.slice(7);
if(compactPath){
  const own=fs.readFileSync(compactPath,'utf8').trim().split('\n').map(s=>JSON.parse(s));
  const labels=new Map(load(gradePath).filter(r=>key[r.ticket][0]===compactTrack).map(r=>[r.id,r]));
  if(own.length!==100||new Set(own.map(r=>r.id)).size!==100||labels.size!==100)throw Error('Incomplete compact comparison');
  const scored=own.map(r=>{
    const g=labels.get(r.id),c=r.turn.verification.calibration;
    if(!g||key[g.ticket][1]!==r.id||g.key!==judgmentKey(r)&&g.key!==judgmentKey(r,true)||typeof g.passed!=='boolean')throw Error('Compact answer did not match adjudication '+r.id);
    if(c.model!==priorFit.version||!Number.isFinite(c.probability)||c.probability!==older.predict(r.question,r.turn,priorFit).probability)throw Error('Compact recorded estimate mismatch '+r.id);
    return {id:r.id,correct:g.passed,probability:c.probability};
  });
  const short={description:'Untouched B, first responses. First two entries use identical stronger answers and correct/incorrect labels. The third uses the compact system’s own answers, probabilities and labels. The compact constant comparator uses its own original development prevalence.',
    strongTraceSHA256:report.traceSHA256,compactTraceSHA256:sha(compactPath),gradesSHA256:report.gradesSHA256,mappingSHA256:report.mappingSHA256,
    pairedRowsSHA256:sha(reportPath),semanticallyGradedTrainingPrevalence:fit.devRate,compactTrainingPrevalence:priorFit.devRate,strongNumericDisplayCoverage:report.numericUI,
    strongerAnswerCurrentEstimator:report.current,strongerAnswerEarlierEstimator:report.previous,compactAnswerOwnEstimator:result(scored,priorFit.devRate)};
  fs.writeFileSync(shortPath,JSON.stringify(short,null,2)+'\n');
  console.log(JSON.stringify({compactPass:short.compactAnswerOwnEstimator.passed,compactBrier:short.compactAnswerOwnEstimator.brier,compactECE:short.compactAnswerOwnEstimator.ece,shortSHA256:sha(shortPath)}));
}
