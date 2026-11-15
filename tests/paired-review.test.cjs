const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const desk=require('../site/paired-review.js');

function completed(first='first_fire'){
  const run=desk.newRun(first,'example-run');
  for(const [i,method] of run.order.entries()){
    run.active={started:10000,toolLabel:'Version of '+method,draft:''};
    desk.finish(run,'Evidence-based response '+i,13000+i*1000,['zzz-first','aaa-second'][i]);
  }
  return desk.exportPair(run);
}
test('identical frozen packet contains both archived observations with unchanged role and units',()=>{
  assert.equal(crypto.createHash('sha256').update(desk.packet).digest('hex'),desk.packetHash);
  const source=fs.readFileSync(path.join(__dirname,'../data/raw/PSI-98-experimental.csv'),'utf8').split(/\r?\n/);
  for(let i=1;i<=2;i++){
    const c=source[i].split(',');
    assert.ok(desk.packet.includes(['PSI-98:1:'+(i+1),c[0],c[1],c[5],c[6],c[10]].map(s=>s.trim()).join(' | ')));
  }
  assert.ok(desk.packet.includes(desk.prompt)&&desk.packet.includes('PDF p. 21')&&desk.packet.includes('mm/s'));
});
test('separate responses, times and allocation and mask order are preserved across methods',()=>{
  for(const first of ['first_fire','general_assistant']){
    const {assessor,analyst}=completed(first);desk.assess(assessor);
    assert.deepEqual(assessor.responses.map(r=>r.id),['aaa-second','zzz-first']);
    assert.deepEqual(Object.keys(assessor.responses[0]).sort(),['answer','id']);
    assert.equal(analyst.runs[0].method,first);assert.deepEqual(analyst.runs.map(r=>r.elapsedSeconds),[3,4]);
    assert.ok(!JSON.stringify(analyst).includes('Evidence-based response'));
    const marks={...assessor,type:'paired_scores',grades:assessor.responses.map((r,i)=>({id:r.id,evidence:1,calculation:i,transfer:0}))};
    const result=desk.join(analyst,marks);
    assert.deepEqual(result.map(r=>r.score),[2,1]);
    assert.throws(()=>desk.join(analyst,{...marks,reviewId:'wrong-review'}));
    assert.throws(()=>desk.join(analyst,{...marks,packetSHA256:'wrong'}));
    assert.throws(()=>desk.join(analyst,{...marks,grades:[marks.grades[0],marks.grades[0]]}));
    assert.throws(()=>desk.join(analyst,{...marks,grades:[{...marks.grades[0],evidence:2},marks.grades[1]]}));
    assert.throws(()=>desk.assess({...assessor,responses:assessor.responses.map(r=>({...r,arm:'first_fire'}))}));
  }
});
test('unfinished trials cannot masquerade as completed comparisons',()=>{
  const run=desk.newRun('first_fire','example-run');
  assert.throws(()=>desk.exportPair(run));assert.throws(()=>desk.finish(run,'test answer',10000,'example-answer'));
  run.active={started:10000,toolLabel:'Offline FIRST FIRE'};
  assert.throws(()=>desk.finish(run,' ',11000,'example-answer'));
  assert.throws(()=>desk.finish(run,'answer',9999,'example-answer'));
  desk.finish(run,'answer',14000,'example-answer');assert.equal(run.active,null);
  assert.throws(()=>desk.exportPair(run));
});
