const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fit,parseCSV,example}=require('../site/transport-fit');
const model=require('../site/transport-lab');

function search(data=example(),tolerance=.15){
  return fit(data.runs[0],data.scenarios[0],data.runs[1],data.scenarios[1],tolerance);
}
function measured(settings,exchange,lag){
  return model.simulate({...model.defaults,...settings,exchange,lag},.2).points.filter((_,i)=>i%5===0).map(p=>({t:p.t,y:p.sensor}));
}
function csv(header,rows){return header+'\n'+rows.map(row=>row.join(',')).join('\r\n');}

test('two pulses recover the example exchange and lag, with nonzero held-out error and an independently fitted baseline',()=>{
  const o=search();
  assert.equal(o.fitted.exchange_lps,38);
  assert.equal(o.fitted.sensor_tau_s,11);
  assert.equal(o.baseline.sensor_tau_s,60);
  assert.equal(o.two_zone_held.n,61);
  assert(Math.abs(o.two_zone_held.rmse-0.1380491288)<1e-8);
  assert(Math.abs(o.one_zone_held.rmse-5.0804739925)<1e-8);
  assert.equal(o.scenario_calibration.release,.5);
  assert.equal(o.scenario_held_out.release,.75);
  for(const p of o.held_out_trace)assert.equal(p.two_zone_residual,p.two_zone_mg_m3-p.observed_mg_m3);
  assert(o.near_fits.extrema.every(x=>x.rmse<=o.fitted.calibration_rmse+o.near_fits.rmse_allowance_mg_m3+1e-12));
});

test('held-out observations and geometry never influence fitted parameters, baseline lag or near-fit set',()=>{
  const x=example(),original=search(x);
  x.runs[1]=x.runs[1].map(p=>({...p,y:p.y+4.25}));
  const shifted=search(x);
  assert.deepEqual(shifted.fitted,original.fitted);
  assert.deepEqual(shifted.baseline,original.baseline);
  assert.deepEqual(shifted.near_fits,original.near_fits);
  assert(Math.abs(shifted.two_zone_held.bias-original.two_zone_held.bias+4.25)<1e-9);
  x.scenarios[1]={...x.scenarios[1],sourceVolume:12};
  const resized=search(x);
  assert.deepEqual(resized.fitted,original.fitted);
  assert.notEqual(resized.two_zone_held.rmse,shifted.two_zone_held.rmse);
});

test('unobservable lag stays unresolved for genuinely distinct zero-signal series',()=>{
  const x=example();
  x.runs=x.runs.map(run=>run.map(p=>({...p,y:0})));
  x.runs[1].pop();
  const o=search(x,.001);
  assert.equal(o.fitted.exchange_lps,0);
  assert.deepEqual(o.near_fits.sensor_tau_s,[0,60]);
  assert.equal(o.two_zone_held.rmse,0);
});

test('refinement recovers high exchange between coarse settings',()=>{
  const x=example();
  x.runs=x.scenarios.map(s=>measured(s,672,23));
  const o=search(x);
  assert(Math.abs(o.fitted.exchange_lps-672)<=.5);
  assert(Math.abs(o.fitted.sensor_tau_s-23)<=.25);
});

test('CSV enforces units, time bounds and finite fields; converts micrograms and accepts signed corrected observations',()=>{
  const rows=Array.from({length:6},(_,i)=>[i*2,(i-1)*1000]);
  const raw=csv('time_s,sensor_ug_m3',rows);
  assert.deepEqual(parseCSV('\uFEFF'+raw),rows.map(([t,val])=>({t,y:val/1000})));
  assert.throws(()=>parseCSV(raw.replace('sensor_ug_m3','sensor_ppm')),/header/);
  assert.throws(()=>parseCSV(raw.replace('4,1000','2,1000')),/increase strictly/);
  assert.throws(()=>parseCSV(raw.replace('10,4000','301,4000')),/within 0–300/);
  assert.throws(()=>parseCSV(raw.replace('4,1000','4,')),/numeric cells/);
  assert.throws(()=>parseCSV(raw.replace('4,1000','4,NaN')),/numeric cells/);
  assert.throws(()=>parseCSV(raw.replace('10,4000','9,4000')),/span/);
});

test('rejects duplicate, invalid, or out-of-range runs; a tolerance change cannot refit the result',()=>{
  const x=example();
  assert.throws(()=>fit(x.runs[0],x.scenarios[0],x.runs[0].map(p=>({...p,y:p.y*1.0000000001})),x.scenarios[1]),/identical/);
  assert.throws(()=>fit([],x.scenarios[0],x.runs[1],x.scenarios[1]),/observations/);
  assert.throws(()=>fit(x.runs[0],{...x.scenarios[0],pulse:3},x.runs[1],x.scenarios[1]),/Pulse duration/);
  assert.throws(()=>search(x,0),/positive tolerance/);
  const tight=search(x,.015),wide=search(x,.55);
  assert.deepEqual(tight.fitted,wide.fitted);
  assert(wide.near_fits.n>tight.near_fits.n);
});

test('the session summary retains the two scenarios, origins and metrics without raw observations or upload names',()=>{
  const o=search();
  o.sources=[{name:'private-calibration.csv',origin:'Researcher-reported measurement'},{name:'private-held.csv',origin:'Researcher-reported simulation'}];
  const c=require('../site/transport-fit').compact(o);
  assert.deepEqual(c.fitted,o.fitted);assert.deepEqual(c.scenario_held_out,o.scenario_held_out);
  assert.equal(c.calibration_n,61);assert.equal(c.one_zone_held.n,61);
  assert.deepEqual(c.source_origins,o.sources.map(s=>s.origin));
  for(const s of ['private-','held_out_trace','calibration_observations'])assert(!JSON.stringify(c).includes(s));
});
