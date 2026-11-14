const test = require('node:test');
const assert = require('node:assert/strict');
const {schedule,validatePack,checkKey,maskedSession,summarize} = require('../site/study.js');
const example = require('../research/evaluation-examples/participant.example.json');
const key = require('../research/evaluation-examples/key.example.json');
const pack={...example,study_id:'automated-fiction'};
test('balanced over 12 anonymous assignments and three opposed pairs in pilot',()=>{
  validatePack(pack); checkKey(key);
  assert.throws(()=>validatePack({...pack,cases:key.cases}));
  const exposures=new Map();
  for(let slot=1;slot<=12;slot++){
    const seq=schedule(pack,slot);
    assert.equal(seq.filter(r=>r.arm==='first_fire').length,3);
    seq.forEach((r,i)=>{const s=[r.case_id,r.arm,i].join(',');exposures.set(s,(exposures.get(s)||0)+1);});
  }
  assert.equal(exposures.size,72); assert.ok([...exposures.values()].every(n=>n===1));
  for(const {id} of pack.cases)assert.equal([1,2,5,6,9,10].flatMap(n=>schedule(pack,n)).filter(r=>r.case_id===id&&r.arm==='ordinary_search').length,3);
});
test('mask omits arm/position/timing; analyst joins IDs and rejects leakage or incomplete grades',()=>{
  const records=schedule(pack,1).map((r,i)=>({...r,response_id:'fake-'+i,position:i+1,answer:'A',citation:'C',limit:'L',elapsed_s:i?45:240,timed_out:!i}));
  const run={version:1,type:'study_run',study_id:pack.study_id,run_id:'synthetic',time_limit_s:240,pack_signature:JSON.stringify(pack.cases.map(c=>[c.id,c.prompt])),slot:1,records,mode:'study'};
  const masked=maskedSession({pack,records});
  for(const row of masked.responses)assert.deepEqual(Object.keys(row).sort(),['answer','case_id','citation','limit','response_id']);
  const grades={type:'study_grades',version:1,study_id:pack.study_id,grades:records.map(r=>({case_id:r.case_id,response_id:r.response_id,decision:1,source:1,scope:1}))};
  const result=summarize([run,grades]); assert.equal(result.groups.first_fire.complete_correct,3); assert.equal(result.groups.first_fire.timeouts,1); assert.equal(result.paired[0].difference_out_of_three,0);assert.equal(result.case_breakdown.length,6);
  const selective={...grades,grades:grades.grades.map((g,i)=>({...g,scope:records[i].arm==='first_fire'?1:0}))};assert.equal(summarize([run,selective]).paired[0].difference_out_of_three,3);
  assert.throws(()=>summarize([run,{...grades,grades:grades.grades.slice(0,5)}]));
  assert.throws(()=>summarize([run,grades,grades]));assert.throws(()=>summarize([{...run,mode:'practice'},grades]));
});
test('budget decision is reported separately and legacy answers remain unscored on it',()=>{
  const records=schedule(pack,1).map((r,i)=>({...r,response_id:'budget-'+i,position:i+1,answer:'A',citation:'C',limit:'L',elapsed_s:30,timed_out:false,
    ...(i===0?{next_action:'reanalyze',action_reason:'Verify a material-specific threshold.'}:i===2?{next_action:'',action_reason:''}:i===4?{next_action:'other',action_reason:'Verify the sensor.'}:{})}));
  const run={version:1,type:'study_run',study_id:pack.study_id,run_id:'synthetic-budget',time_limit_s:240,pack_signature:'fixed',slot:1,records,mode:'study'};
  const masked=maskedSession({pack,records});assert.equal(masked.responses.find(r=>r.response_id==='budget-0').action_reason,'Verify a material-specific threshold.');
  const grades={version:1,type:'study_grades',study_id:pack.study_id,grades:records.map((r,i)=>({case_id:r.case_id,response_id:r.response_id,decision:1,source:1,scope:1,
    ...(i===0?{action_status:'graded',action_supported:0}:i===2?{action_status:'skipped'}:i===4?{action_status:'no_rubric'}:{})}))};
  const g=summarize([run,grades]).groups.first_fire;
  assert.equal(g.complete_correct,3);assert.equal(g.budget_attempted,2);assert.equal(g.budget_graded,1);assert.equal(g.budget_supported,0);assert.equal(g.budget_skipped,1);assert.equal(g.budget_ungraded,1);
  assert.throws(()=>summarize([run,{...grades,grades:grades.grades.map((row,i)=>i===1?{...row,action_status:'graded',action_supported:1}:row)}]));
  assert.throws(()=>summarize([{...run,records:records.map((row,i)=>i===0?{...row,next_action:'invalid'}:row)},grades]));
});
