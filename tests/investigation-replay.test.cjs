const test = require('node:test');
const assert = require('node:assert/strict');
const {documentItems,audit} = require('../site/investigation-replay.js');
const physics = require('../site/physics-lab.js');
const paired = require('../site/trial-comparison.js');
const units={position:'cm',oxygen:'wet vol%',co2:'wet vol%',water:'wet vol%',burned:'g',chemical:'kJ',electrical:'kJ',energy:'kJ'};
function trial(speed=.18){
  const inputs={...physics.defaults,volume:16,speed},seconds=50;
  const run=physics.run(inputs);
  return {title:'Cabin',summary:'Research trial',record:{kind:'simulated',inputs,seconds,
    outputs:{...run.trace[25],chassisWeightN:run.chassisWeight,idealFlameK:run.flame.kelvin},units:{...units},reference:null,liquid:null,liquidStatus:'deferred in Lite mode'}};
}
const doc=(results,extra={})=>({schema:'first-fire.investigation.v1',results,...extra});
test('actual solver reproduces the saved 50-second sample and distinguishes an edited travel claim',()=>{
  const [item]=documentItems(doc({physics:trial()}));
  assert.equal(audit(item,{physics}).status,'match');
  item.record.outputs.position=90;
  const result=audit(item,{physics});
  assert.equal(result.status,'different');
  assert.deepEqual(result.checks.filter(c=>c.status==='different'),[{path:'outputs.position',status:'different',saved:90,current:9}]);
});
test('units, source rate and source receipts are independently checked',()=>{
  const [item]=documentItems(doc({physics:trial(.13)}));item.record.units.position='m';item.record.reference='concurrent';
  const r=audit(item,{physics});
  assert.deepEqual(r.checks.filter(c=>c.status==='different').map(c=>c.path),['units.position','imposed speed (cm/s)','Saffire-I row and dataset','NASA slide 21']);
});
test('only supported file schemas are read and each frozen run is re-evaluated',()=>{
  const pair=paired.exportComparison(paired.capture(paired.freeze(trial()),trial(.13)));
  assert.deepEqual(documentItems(pair).map(item=>audit(item,{physics,pair:paired.compare}).status),['match','match','match']);
  assert.equal(documentItems(doc({physics:trial()},{trialComparison:pair})).length,4);
  pair.analysis.type='altered';
  assert.equal(audit(documentItems(pair)[2],{pair:paired.compare}).status,'different');
  assert.throws(()=>documentItems({schema:'unknown',results:{}}));
  assert.throws(()=>documentItems({...pair,trial:{entry:{}}}));
  assert.deepEqual(documentItems(doc({})),[]);
});
test('unavailable input is reported, a saved instrument without an automatic checker is listed separately',()=>{
  const [item]=documentItems(doc({physics:trial()}));item.record.seconds=51;
  assert.equal(audit(item,{physics}).status,'unavailable');
  assert.equal(audit({tool:'transport-lab',title:'Tracer',record:{}},{}).status,'included');
});
test('Atlas original is compared field for field and an absent ID cannot pass',()=>{
  const current={id:'PSI-98:1:2',conditions:{pressure:null},endpoint:'continued'};
  const item={tool:'atlas',title:'Atlas',record:{...current,conditions:{pressure:0}}};
  assert.equal(audit(item,{atlas:()=>current}).status,'different');
  assert.equal(audit(item,{atlas:()=>null}).status,'unavailable');
});
test('modular rover replay distinguishes absence, unknown and a numeric zero',()=>{
  const current={modelSHA256:'fingerprint',result:{flow:{spreadRateMmS:null},power:{endWh:0}},sources:[],boundary:'simulation'};
  const item={title:'Rover',tool:'rover-design',record:structuredClone(current)};
  assert.equal(audit(item,{rover:()=>current}).status,'match');
  item.record.result.flow.spreadRateMmS=0;
  assert.equal(audit(item,{rover:()=>current}).status,'different');
});
test('liquid replay rejects fabricated statuses, mismatched domains and contradictory or missing outputs',()=>{
  const [item]=documentItems(doc({physics:trial()}));
  const trained={};
  require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../site/cabin-liquid-weights.js'),'utf8'),trained);
  const env={physics,weights:trained.FFCabinLiquid};
  const r=item.record;
  assert.match(audit(item,{physics}).note,/deferred/);
  r.liquidStatus='invented';assert.equal(audit(item,env).status,'unavailable');
  r.liquidStatus='evaluated';assert.equal(audit(item,env).status,'different');
  const oxygen=physics.liquidPrediction(r.inputs,env.weights)[r.seconds/physics.interval];
  r.liquid={oxygenPercent:oxygen,errorPercentagePoints:Math.abs(oxygen-r.outputs.oxygen),training:'synthetic cabin runs'};
  assert.equal(audit(item,env).status,'match');
  r.liquidStatus='deferred in Lite mode';assert.equal(audit(item,{physics}).status,'different');
  r.liquidStatus='outside training domain';r.liquid=null;assert.equal(audit(item,env).status,'different');
  r.inputs.volume=1;
  const out=physics.run(r.inputs);r.outputs={...out.trace[r.seconds/physics.interval],chassisWeightN:out.chassisWeight,idealFlameK:out.flame.kelvin};
  assert.equal(audit(item,env).status,'match');assert.equal(audit(item,{physics}).status,'unavailable');
  delete r.liquidStatus;assert.match(audit(item,{physics}).note,/legacy/);
});
