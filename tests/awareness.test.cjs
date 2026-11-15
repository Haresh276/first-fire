'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const desk = require('../site/awareness.js');
const row = id => ({tool:'atlas',title:'Flight record',summary:'Archived conditions',record:{id,accession:id.split(':')[0],conditions:{'Airflow':'20 cm/s'},sourceRow:Number(id.split(':')[2]),kind:'archived evidence'}});
test('device detection uses offline capabilities, remains usable without APIs and obeys overrides', () => {
  assert.equal(desk.automatic({}).tier,'standard');
  assert.equal(desk.automatic({deviceMemory:8,hardwareConcurrency:8}).tier,'standard');
  assert.equal(desk.automatic({deviceMemory:8,hardwareConcurrency:8},{checked:true,adapter:true,free:900_000_000}).tier,'pro');
  assert.equal(desk.automatic({deviceMemory:8,hardwareConcurrency:8,connection:{saveData:true}}).tier,'lite');
  assert.equal(desk.automatic({hardwareConcurrency:2}).tier,'lite');
  for(const mode of ['lite','standard','pro']){
    const state=desk.initial();state.display=mode;
    assert.equal(desk.exportState(state,{}).device.effectiveTier,mode);
  }
});
test('first Atlas pin starts an investigation and links the measured direction only for eligible rows',()=>{
  const state=desk.initial();
  assert.equal(desk.capture(state,row('PSI-98:1:3')),true);
  assert.equal(state.active,true);
  assert.equal(state.reference,'opposed');
  assert.equal(desk.recommendation(state).url,'#physics?mode=rover&reference=opposed');
  assert.equal(desk.exportState(state,{}).selectedReference.measuredSpeedMmS,1.3);
  desk.capture(state,row('PSI-98:1:2'));
  assert.equal(desk.recommendation(state).url,'#physics?mode=rover&reference=concurrent');
  desk.capture(state,row('PSI-69:1:156'));
  assert.match(desk.recommendation(state).url,/^#atlas\?record=PSI-69/);
  state.question='Model a rover cabin';
  assert.equal(desk.recommendation(state).url,'#physics?mode=rover');
});
test('state, exact evidence and model results survive export and restore, invalid input removes obsolete result',()=>{
  const state=desk.initial();
  state.question='How would the front move in a rover?';state.level='advanced';
  desk.capture(state,row('PSI-98:1:3'));
  const physics={tool:'physics',title:'Cabin',summary:'7.8 cm',record:{inputs:{speed:.13},seconds:60,outputs:{position:7.8,oxygen:33.9},reference:'opposed',liquid:{oxygenPercent:33.8},sources:[{url:'https://doi.org/10.60555/0t15-1z43'}]}};
  assert.equal(desk.capture(state,physics),true);
  const reloaded=desk.restore(JSON.parse(JSON.stringify(state)));
  const exported=desk.exportState(reloaded,{});
  assert.equal(exported.readerLevel,'advanced');assert.equal(exported.question,state.question);
  assert.deepEqual(exported.results.physics.record,physics.record);
  assert.deepEqual(exported.results.atlas.record,row('PSI-98:1:3').record);
  assert.equal(desk.recommendation(reloaded).url,'#physics?mode=rover');
  desk.capture(reloaded,{tool:'physics',invalid:true});
  assert.equal(reloaded.records.physics,undefined);assert.equal(reloaded.lastTool,'atlas');
});
test('explicit intent selects the relevant instrument and preserves a literal data question',()=>{
  const state=desk.initial();
  for(const [q,route] of [['Measure remote tracer delay','transport-lab'],['Find the next lunar test','design-lab'],['Compare methanol droplets','transfer-lab'],['How many methanol runs?','chat'],['Identify the original rows','atlas']]){
    state.question=q;
    assert.equal(desk.recommendation(state).tool,route);
    if(route==='chat')assert.equal(desk.recommendation(state).url,'#chat?q='+encodeURIComponent(q));
  }
});
test('unrelated tool emissions do not start a workspace and malformed persisted profiles recover',()=>{
  const state=desk.initial();
  assert.equal(desk.capture(state,{tool:'design-lab',summary:'Median',record:{}}),false);
  assert.equal(desk.capture(state,{tool:'constructor',summary:'Untrusted',record:{}}),false);
  const restored=desk.restore({version:1,level:'constructor',display:'bad',reference:'bad',records:{atlas:{summary:0}}});
  assert.deepEqual(restored,desk.initial());
});
test('a fresh investigation keeps the controls while clearing questions, records, assumptions and decision',()=>{
  const state=desk.initial();
  state.level='beginner';state.display='lite';state.question='Find the opposed front rate';state.notes='Check lot and weave';
  desk.capture(state,row('PSI-98:1:3'));
  const fresh=desk.freshInvestigation(state);
  assert.equal(fresh.active,true);
  assert.equal(fresh.level,'beginner');assert.equal(fresh.display,'lite');
  assert.deepEqual(fresh.records,{});assert.equal(fresh.notes,'');assert.equal(fresh.question,'');
  assert.equal(fresh.referenceOrigin,'catalogue preview');assert.equal(fresh.lastTool,null);
  assert.equal(state.records.atlas.record.id,'PSI-98:1:3');
});
test('the original question stays with archived evidence and a curated selection cannot relabel a pinned row',()=>{
  const state=desk.initial();state.question='How does a fabric front move?';
  desk.capture(state,row('PSI-98:1:3'));
  state.question='Compare rover strip travel';state.reference='concurrent';state.referenceOrigin='source selector';
  const snapshot=desk.exportState(state,{});
  assert.equal(snapshot.results.atlas.questionAtCapture,'How does a fabric front move?');
  assert.equal(snapshot.selectedReference.direction,'concurrent');
  assert.equal(snapshot.selectedReference.selectionOrigin,'source selector');
  assert.equal(snapshot.nextAction.url,'#physics?mode=rover&reference=opposed');
  desk.capture(state,row('PSI-69:1:156'));
  assert.equal(desk.recommendation(state).url,'#physics?mode=rover');
});
