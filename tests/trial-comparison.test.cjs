'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const compare = require('../site/trial-comparison.js');
const solver = require('../site/physics-lab.js');

function entry(overrides = {}, seconds = 120) {
  const inputs = {...solver.defaults,...overrides};
  const outputs = solver.atTime(inputs,seconds);
  return {title:'Rover and cabin physics',summary:'Cabin trial',questionAtCapture:'How does free volume change the oxygen trace?',
    record:{kind:'simulated',inputs,outputs,seconds,reference:null,designName:'Test cabin',
      units:{position:'cm',oxygen:'wet vol%',co2:'wet vol%',water:'wet vol%',burned:'g',chemical:'kJ',electrical:'kJ',energy:'kJ'},
      sources:[{title:'Fuel thermochemistry',url:'https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf'}]}};
}

test('a frozen baseline stays independent of later inputs, sources and question changes', () => {
  const original=entry({speed:.18},50);
  original.record.sources.push({row:'PSI-98:1:2',url:'https://doi.org/10.60555/0t15-1z43'});
  original.record.reference='concurrent';
  const fixed=compare.freeze(original);
  original.questionAtCapture='A second question';
  original.record.inputs.speed=1;
  original.record.sources[1].row='other';
  const receipt=fixed.baseline.entry;
  assert.equal(receipt.record.inputs.speed,.18);
  assert.equal(receipt.record.sources[1].row,'PSI-98:1:2');
  assert.equal(receipt.record.reference,'concurrent');
  assert.equal(receipt.questionAtCapture,'How does free volume change the oxygen trace?');
  assert.equal(compare.exportComparison(fixed).analysis,null);
});

test('one changed source speed at matched time yields signed trial-minus-baseline travel', () => {
  const a=entry({speed:.18,volume:16},50);
  const b=entry({speed:.13,volume:16},50);
  a.record.reference='concurrent';b.record.reference='opposed';
  const pair=compare.capture(compare.freeze(a),b);
  const {analysis} = compare.exportComparison(pair);
  assert.equal(analysis.type,'single-input');
  assert.deepEqual(analysis.changes,[{field:'speed',label:'Imposed front speed',unit:'cm/s',baseline:.18,trial:.13}]);
  const d=analysis.measurements.find(m=>m.field==='position');
  assert.equal(d.unit,'cm');assert.ok(Math.abs(d.delta+2.5)<1e-12);
  assert.equal(pair.baseline.entry.record.reference,'concurrent');
  assert.equal(pair.trial.entry.record.reference,'opposed');
});

test('oxygen changes are percentage points; unavailable optional outputs stay unknown', () => {
  const pair=compare.capture(compare.freeze(entry()),entry({volume:4}));
  const {analysis}=compare.exportComparison(pair);
  const o=analysis.measurements.find(m=>m.field==='oxygen');
  assert.equal(analysis.type,'single-input');
  assert.equal(o.deltaUnit,'percentage points');assert.ok(Math.abs(o.delta+2.43412)<.00002);
  assert.equal(analysis.measurements.find(m=>m.field==='idealFlameK').delta,null);
});

test('matching, cochanged and time-shifted trials have distinct interpretations', () => {
  const baseline=compare.freeze(entry());
  const classify=trial=>compare.exportComparison(compare.capture(baseline,trial)).analysis;
  const renamed=entry();renamed.record.designName='Different drawn rover';
  assert.equal(classify(renamed).type,'same-inputs');
  assert.equal(classify(entry({fuel:'polyethylene',volume:8})).type,'multiple-inputs');
  const shift=classify(entry({volume:8},50));assert.equal(shift.type,'different-times');
  assert.equal(shift.timeChanged,true);assert.equal(shift.baselineSeconds,120);assert.equal(shift.trialSeconds,50);
});

test('new input definitions, incompatible units and changed solver identity block single-input attribution', () => {
  const baseline=compare.freeze(entry());
  const trial=entry({volume:6});trial.record.inputs.heatLoss=0;trial.record.solverVersion='prototype';
  trial.record.units.energy='J';delete trial.record.inputs.oxygen;
  const result=compare.exportComparison(compare.capture(baseline,trial));
  assert.equal(result.analysis.type,'unsupported');
  assert.deepEqual(new Set(result.analysis.unsupportedFields),new Set(['Initial oxygen','heatLoss','solverVersion','Total heat units']));
  const m=result.analysis.measurements.find(row=>row.field==='energy');
  assert.equal(m.trialUnit,'J');assert.equal(m.delta,null);
});

test('paired export can be reopened; empty, corrupt or another tool are handled safely', () => {
  const pair=compare.capture(compare.freeze(entry()),entry({fuel:'polyethylene'}));
  const first=compare.exportComparison(pair);
  const restored=compare.restore(JSON.parse(JSON.stringify(first)));
  assert.deepEqual(compare.exportComparison(restored),first);
  first.baseline.entry.record.sources.length=0;assert.equal(pair.baseline.entry.record.sources.length,1);
  assert.equal(compare.restore(undefined),null);
  assert.equal(compare.restore({...pair,baseline:{tool:'transport-lab',entry:entry()}}),null);
  assert.equal(compare.restore({...pair,trial:{entry:{}}}).trial,null);
  assert.throws(()=>compare.freeze({record:{kind:'archived evidence'}}),/valid/);
});
