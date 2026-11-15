import assert from 'node:assert/strict';
import test from 'node:test';
import { compareFieldTrack, fieldResultCsv, parseFieldCsv } from './field-comparison.mjs';

// Synthetic unit-test values are isolated here. The workbench ships with no observed trial.
const sim = [
  {elapsedS:100,xM:100,zM:-20,batteryWh:1000},
  {elapsedS:102,xM:102,zM:-16,batteryWh:996},
  {elapsedS:104,xM:104,zM:-12,batteryWh:992}
];
const obs = [
  {elapsedS:500,xM:-300,zM:300,batteryWh:50},
  {elapsedS:501,xM:-300,zM:300,batteryWh:49},
  {elapsedS:503,xM:-298,zM:305,batteryWh:46},
  {elapsedS:506,xM:-295,zM:312,batteryWh:40}
];
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-12, a + ' ≠ ' + b);

test('CSV accepts offset clocks, quotes, UTF-8 BOM and optional missing charge without coercing a missing position', () => {
  const csv='\uFEFFelapsedS,xM,zM,batteryWh,note\r\n15,-2,3,,"one, two"\r\n16,-1.2,4,5e1,"a ""quoted"" note"\r\n';
  assert.deepEqual(parseFieldCsv(csv), [
    {elapsedS:15,xM:-2,zM:3,batteryWh:null},{elapsedS:16,xM:-1.2,zM:4,batteryWh:50}
  ]);
  assert.ok(parseFieldCsv('elapsedS,zM,xM\n1,2,3\n3,4,5').every(s => s.batteryWh === null));
  for (const bad of ['elapsedS,xM,zM\n1,,2\n2,3,4','elapsedS,xM,zM\n1,2,3\n1,3,4',
    'elapsedS,xM,zM\n1,Infinity,3\n2,3,4','elapsedS,xM,zM\n1,0x10,3\n2,3,4',
    'elapsedS,xM,xM\n1,2,3\n2,3,4','elapsedS,xM,zM\n1,2,3\n2,3',
    'elapsedS,xM,zM\n1,2,3\n2,"bad,4', 'elapsedS,xM,zM,batteryWh\n1,2,3,-1\n2,3,4,0']) {
    assert.throws(() => parseFieldCsv(bad), RangeError);
  }
});

test('translation and interpolation preserve axes; signed error is simulation minus the independent observation', () => {
  const before = structuredClone({sim,obs});
  const r = compareFieldTrack(sim, obs);
  assert.deepEqual({sim,obs}, before);
  assert.equal(r.matchedCount,3);
  assert.equal(r.outsideTimeCount,1);
  assert.equal(r.coveragePct,75);
  assert.deepEqual(r.rows.map(s=>[s.timeS,s.errorXM,s.errorZM]),[[0,0,0],[1,1,2],[3,1,1]]);
  close(r.horizontalRmseM,Math.sqrt(7/3));
  assert.deepEqual(r.rows.map(s=>s.batteryChangeErrorWh),[0,-1,-2]);
  assert.deepEqual(r.rows.map(s=>s.absoluteBatteryChangeErrorWh),[0,1,2]);
  close(r.batteryChangeRmseWh,Math.sqrt(5/3));
  assert.equal(r.largestObservedGapS,3);
  assert.equal(r.largestSimulatedGapS,2);
});

test('no extrapolation and optional temporal gap limit retain exact grid times', () => {
  const next=[...sim, {elapsedS:112,xM:112,zM:4,batteryWh:976}];
  const obsTimes=[0,1,4,8,12,14].map(elapsedS=>({elapsedS,xM:0,zM:0}));
  const r=compareFieldTrack(next,obsTimes,{maxGapS:2});
  assert.deepEqual(r.rows.map(x=>x.timeS),[0,1,4,12]);
  assert.equal(r.interpolationGapCount,1);
  assert.equal(r.outsideTimeCount,1);
  assert.equal(r.firstMatchedS,0);
  assert.equal(r.lastMatchedS,12);
  assert.equal(r.batteryChangeRmseWh,null);
});

test('clock offset is explicit, battery delta anchors at the first available matched pair only', () => {
  const rows=obs.map((p,i)=>({...p,batteryWh:i===0?null:p.batteryWh}));
  const r=compareFieldTrack(sim,rows,{clockOffsetS:-1});
  assert.deepEqual(r.rows.map(s=>s.timeS),[0,2]);
  assert.equal(r.batteryAnchorTimeS,0);
  assert.equal(r.rows[0].batteryChangeErrorWh,0);
  assert.equal(r.rows[1].batteryChangeErrorWh,-1);
  const missing=sim.map((s,i)=>({...s,batteryWh:i===1?null:s.batteryWh}));
  const unavailable=compareFieldTrack(missing,obs);
  assert.equal(unavailable.batteryMatchedCount,1);
  assert.equal(unavailable.batteryChangeRmseWh,null);
});

test('positive and negative clock offsets use the same physical alignment instant on identical-velocity tracks', () => {
  const model = [0, 1, 2, 3, 4].map(t => ({ elapsedS:100+t, xM:2*t, zM:-3*t }));
  for (const lag of [1.5, -1]) {
    const measured = [0,1,2,3,4].map(t => ({ elapsedS:120+t, xM:1000+2*(t+lag), zM:500-3*(t+lag) }));
    const r = compareFieldTrack(model, measured, { clockOffsetS:lag });
    close(r.horizontalRmseM,0);
    assert.ok(r.rows.every(s=>s.errorXM===0 && s.errorZM===0));
    const anchor = r.positionAnchor;
    assert.equal(anchor.timeS,Math.max(0,lag));
    assert.equal(anchor.observedRow,lag<0 ? 2 : 1);
    close(anchor.simulatedXM,anchor.timeS * 2);
    close(anchor.observedXM,1000+anchor.timeS * 2);
  }
});

test('a stationary replay, a common instant alone, sparse overlap and corrupt intervals never yield a score', () => {
  for (const invalid of [null, [], [sim[0]], [sim[0],sim[0]], [sim[0],{...sim[1],xM:NaN}],
    [sim[0],{...sim[1],batteryWh:Infinity}],[sim[0],{...sim[1],zM:null}]]) {
    assert.throws(()=>compareFieldTrack(invalid,obs));
    assert.throws(()=>compareFieldTrack(sim,invalid));
  }
  assert.throws(()=>compareFieldTrack(sim,obs,{clockOffsetS:100}),/overlap/);
  assert.throws(()=>compareFieldTrack(sim,obs,{clockOffsetS:4}),/overlap/);
  assert.throws(()=>compareFieldTrack(sim,[obs[0],obs.at(-1)]),/Fewer than two/);
  assert.throws(()=>compareFieldTrack(sim,obs,{maxGapS:0}));
  assert.throws(()=>compareFieldTrack(sim,obs,{clockOffsetS:NaN}));
  assert.throws(()=>compareFieldTrack(sim,Array(50001).fill(obs[0])));
  assert.throws(()=>parseFieldCsv(' '.repeat(5000001)));
});

test('download identifies sources, model context, signed/absolute differences, and omits unavailable values', () => {
  const r=compareFieldTrack(sim,obs.map(s=>({...s,batteryWh:null})));
  const csv=fieldResultCsv(r,{source:'=untrusted',clock:'start "A"',frame:'+X east, +Z north',simulation:'test run'});
  const lines=csv.trimEnd().split('\n');
  assert.equal(lines.length,4);
  assert.match(lines[0],/observedXRelM,observedZRelM,simulatedXRelM,simulatedZRelM,errorXM,errorZM,horizontalErrorM/);
  assert.match(lines[0],/batteryChangeErrorWh,absoluteBatteryChangeErrorWh/);
  assert.match(lines[1],/^"'=untrusted","start ""A""","'\+X east, \+Z north"/);
  assert.ok(lines.every(line=>!line.includes('null')));
});
