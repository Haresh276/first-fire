import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {captureReview,compareReview,createReviewPackage,createTeamEvidence,researchRows} from './mission-review.mjs';
import {simulate,selectPart} from './model.mjs';

const read=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const catalog=read('parts.json'),index=read('sources.json'),schema=read('scenario.schema.json');
function example(name='lunar-cellulose') {
  const scenario=read('examples/'+name+'.json');return {scenario,result:simulate(scenario,catalog,schema)};
}
function find(rows,path) {return rows.find(r=>r.path===path);}
function run(distanceM,elapsedS,driveWh) {
  return {mode:'waypoint replay',status:'route complete',waypointsReached:1,waypoints:[{xM:2,zM:2}],
    state:{distanceM,elapsedS,driveWh,batteryWh:2400-driveWh}};
}
test('capturing A deeply detaches the scenario, result and traverse from later user edits',()=>{
  const b=example();b.traverse=run(30,45,2);
  const a=captureReview(b.scenario,b.result,b.traverse);
  b.scenario.name='edited';b.scenario.parts.material='pe';b.result.power.endWh=1;b.traverse.state.driveWh=30;b.traverse.waypoints[0].xM=500;
  assert.notEqual(a.scenario.name,b.scenario.name);assert.equal(a.scenario.parts.material,'cellulose');
  assert.equal(a.result.power.endWh,2800);assert.equal(a.traverse.state.driveWh,2);assert.equal(a.traverse.waypoints[0].xM,2);
  assert.equal(captureReview(b.scenario,null,null),null);
});
test('A/B preserves sign, units and changes to part identifiers and optional labels',()=>{
  const a=example(),b=example('lunar-pe');b.scenario.customNames={payload:'Custom payload'};
  const d=compareReview(a,b),heat=find(d.engineering,'coupon.netChemicalPotentialKJ'),mass=find(d.engineering,'mobility.massKg');
  assert.equal(heat.a,152);assert.equal(heat.b,434);assert.equal(heat.delta,282);assert.equal(heat.unit,'kJ');assert.equal(mass.delta,0);
  assert.equal(heat.aGap,null);assert.deepEqual(d.changedInputs.map(k=>k.key),['material','payload']);
  assert.deepEqual(d.changedInputs[1],{group:'customNames',key:'payload',a:null,b:'Custom payload'});
});
test('unavailable cabin, material, sensor and flight qualification are distinct from numeric zero',()=>{
  const a=example(),open=selectPart(a.scenario,'cabin','open-deck',catalog);
  const b={scenario:open,result:simulate(open,catalog,schema)};
  let d=compareReview(a,b);assert.equal(find(d.engineering,'air.initialO2KPa').bGap,'Open deck');
  assert.equal(find(d.engineering,'coupon.netChemicalPotentialKJ').delta,null);
  assert.match(find(d.engineering,'suppression.extinction').bGap,/test/);
  const mars=example('mars-night-pe');d=compareReview(a,mars);
  assert.equal(find(d.engineering,'power.generationW').b,0);assert.equal(find(d.engineering,'power.generationW').delta,-450);
  assert.match(find(d.engineering,'tracer.thresholdTimeWithDelayS').bGap,/No alarm/);
  assert.match(find(compareReview(null,b).engineering,'power.endWh').aGap,/No design/);
});
test('travel comparisons preserve coverage, differences and units without imputing missing runs',()=>{
  const a={...example(),traverse:run(30,45,2)},b={...example(),traverse:run(60,120,9)};
  let d=compareReview(a,b);assert.match(d.traverseBasis,/different travelled distances and elapsed times/);
  assert.deepEqual([find(d.traverse,'state.driveWh').delta,find(d.traverse,'state.driveWh').unit],[7,'Wh']);
  assert.match(compareReview(a,a).traverseBasis,/equal distance and elapsed time/);
  b.traverse=null;d=compareReview(a,b);assert.match(d.traverseBasis,/Two traverse/);
  assert.equal(find(d.traverse,'state.driveWh').bGap,'No traverse recorded');assert.equal(find(d.traverse,'state.driveWh').delta,null);
});
test('all partner codes, extracted quantities, classes, source text and scope are discoverable',()=>{
  for (const code of [index.lead,...Object.keys(index.partners)]) {
    const rows=researchRows(index,{agency:code});assert.ok(rows.length,code);assert.ok(rows.every(r=>r.agency===code));
  }
  assert.equal(researchRows(index).length,index.sources.length);
  assert.ok(researchRows(index,{query:'Spanish 35.4',agency:'AEE',evidenceClass:'measurement'}).some(r=>r.id==='aee-02'));
  assert.ok(researchRows(index,{query:'roechling'}).length===0);
  assert.ok(researchRows(index,{query:'rochling'}).some(r=>r.id==='stock-pe'));
  assert.equal(researchRows(null).length,0);
});
test('the export carries both designs, cited and pinned records, and explicit source gaps',()=>{
  const a=example(),b=example('lunar-pe');b.traverse=run(40,60,5);
  const pkg=createReviewPackage({team:'  Labo lunaire 月  ',baseline:a,current:b,index,catalog,
    pinned:['kasa-02','kasa-02','unindexed'],createdAt:'2026-11-15T00:00:00Z'});
  assert.equal(pkg.team,'Labo lunaire 月');assert.deepEqual(pkg.selectedEvidenceIds,['kasa-02','unindexed']);
  assert.deepEqual(pkg.missingEvidenceIds,['unindexed']);assert.equal(new Set(pkg.evidence.map(s=>s.id)).size,pkg.evidence.length);
  for(const id of ['stock-cellulose','stock-pe','kasa-02'])assert.ok(pkg.evidence.some(s=>s.id===id));
  assert.ok(pkg.selectedParts.some(p=>p.id==='cellulose'));assert.ok(pkg.selectedParts.some(p=>p.id==='pe'));
  assert.equal(pkg.current.traverse.state.distanceM,40);assert.equal(pkg.comparison.engineering.find(r=>r.path==='coupon.netChemicalPotentialKJ').delta,282);
  b.traverse.state.distanceM=90;assert.equal(pkg.current.traverse.state.distanceM,40);
  for(const record of pkg.evidence.filter(e=>e.localFile))assert.ok(existsSync(new URL('../'+record.localFile,import.meta.url)),record.id);
  assert.doesNotThrow(()=>JSON.stringify(pkg));
  assert.throws(()=>createReviewPackage({current:null}),/valid current design/);
  const standalone=createReviewPackage({current:b,index:null,catalog:null});
  assert.equal(standalone.baseline,null);assert.ok(standalone.missingEvidenceIds.length>0);
});

const submittedSource={
  organization:'Instituto de Ensayos Lunares',title:'Cold chamber run 23',url:'https://example.org/reports/23',
  locator:'Table 4, row B',evidenceClass:'experiment',conditions:'Ground chamber, no solar input.',
  supports:'Panel temperature reached the reported minimum.',limits:'One engineering unit, no lunar flight.',
  quantities:[{quantity:'Minimum panel temperature',value:-22.75,unit:'°C'}]
};
test('team evidence travels in its own export collection with original quantities and independent IDs',()=>{
  const register={...index,sources:[...index.sources,{id:'team-1',title:'Reserved catalog ID'}]};
  const store=createTeamEvidence(register);
  const id=store.add({...submittedSource,id:'nasa-01',origin:'curated',verification:'flight qualified'});
  assert.equal(id,'team-2');
  const first=store.records()[0];assert.equal(first.verification,'unverified');assert.equal(first.origin,'user-supplied');
  first.quantities[0].value=300;assert.equal(store.records()[0].quantities[0].value,-22.75);
  const report=createReviewPackage({current:example(),index:register,catalog,teamEvidence:store.records()});
  assert.deepEqual(report.teamEvidence,store.records());assert.ok(!report.evidence.some(s=>s.id===id));
  assert.equal(store.remove('nasa-01'),false);assert.equal(store.remove(id),true);assert.equal(store.records().length,0);
  assert.equal(report.teamEvidence[0].quantities[0].value,-22.75);
  const id2=store.add({...submittedSource,quantities:[]});assert.equal(id2,'team-3');
  assert.throws(()=>createReviewPackage({current:example(),index:register,teamEvidence:[{...first,id:'team-1'}]}),/duplicate/);
  assert.throws(()=>createReviewPackage({current:example(),index:register,teamEvidence:[first,first]}),/duplicate/);
});
test('team evidence rejects incomplete claims, unsafe links, missing units and nonfinite values',()=>{
  const store=createTeamEvidence(index);
  for(const key of ['organization','title','locator','conditions','supports','limits']) {
    assert.throws(()=>store.add({...submittedSource,[key]:'  '}),/Enter/);
  }
  for(const url of ['javascript:alert(1)','data:text/html,foo','/unpublished','invalid']){
    assert.throws(()=>store.add({...submittedSource,url}),/HTTP/);
  }
  assert.throws(()=>store.add({...submittedSource,evidenceClass:'flight certified'}),/class/);
  for(const q of [{quantity:'',value:1,unit:'N'},{quantity:'Load',value:1,unit:''},{quantity:'Load',value:Infinity,unit:'N'}]){
    assert.throws(()=>store.add({...submittedSource,quantities:[q]}),/Enter/);
  }
  assert.deepEqual(store.records(),[]);
  assert.equal(store.add({...submittedSource,quantities:[{quantity:'Error',value:0,unit:'mm'},{quantity:'Factor',value:-0.2,unit:'ratio'}]}),'team-1');
});
