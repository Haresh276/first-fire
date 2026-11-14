'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('../site/physics-lab.js');
require('../site/cabin-liquid-weights.js');
const model=globalThis.FFCabinLiquid;
function near(actual,expected,tol=1e-8){assert.ok(Math.abs(actual-expected)<=tol,actual+' differs from '+expected);}
const s={...p.defaults};
test('element conservation, wet gas composition, heat and material inventory',()=>{
  for(const fuel of Object.keys(p.fuels)){
    const cfg={...s,fuel}, c=p.chemistry(fuel);
    const n0=cfg.pressure*1000*cfg.volume/(8.31446261815324*300);
    for(const v of p.run(cfg).trace){
      const extent=v.burned/c.molarMass, nt=n0+c.deltaMoles*extent;
      const n2=nt*(100-v.oxygen-v.co2-v.water)/100;
      near(n2,n0*(1-cfg.oxygen/100));
      near(v.oxygen*nt/100+c.oxygen*extent,n0*cfg.oxygen/100);
      near(v.co2*nt/100,extent*c.carbon);
      near(v.water*nt/100,extent*c.water);
      near(v.chemical,v.burned*c.heat);
      near(v.position,v.burned/cfg.density);
      assert(v.oxygen>=cfg.cutoff-1e-12 && v.position<=cfg.length+1e-12);
    }
  }
});
test('low oxygen, zero-speed, finite fuel and electrical cutoff',()=>{
  const low=p.atTime({...s,oxygen:15,power:2000,capacity:.5},120);
  near(low.oxygen,15);near(low.burned,0);near(low.energy,1.8);assert.equal(low.state,'Oxygen cutoff');
  const still=p.atTime({...s,speed:0},120);near(still.position,0);assert.equal(still.state,'Front stationary');
  const limited=p.atTime({...s,volume:1,pressure:30,oxygen:21,cutoff:20,density:10,speed:2},120);
  near(limited.oxygen,20);assert.equal(limited.state,'Oxygen cutoff');
  const spent=p.atTime({...s,length:10,speed:2},120);near(spent.position,10);assert.equal(spent.state,'End of strip');
  assert.equal(p.run({...s,planet:'Mars'}).chassisWeight,s.chassisMass*3.71);
  assert.throws(()=>p.atTime({...s,volume:NaN},5),RangeError);assert.throws(()=>p.atTime(s,-1),RangeError);
});
test('temperature responds to oxygen and respects fit bounds',()=>{
  const a=p.flameTemperature(21,'cellulose'),b=p.flameTemperature(34,'cellulose');
  assert(a.kelvin>1800 && a.kelvin<2700);
  assert(b.kelvin>a.kelvin);
  assert.deepEqual(p.flameTemperature(100,'polyethylene'),{kelvin:null,above:3500});
  assert.throws(()=>p.flameTemperature(0,'cellulose'),RangeError);
});
test('surrogate starts at measured initial input and rejects extrapolation',()=>{
  const guess=p.liquidPrediction(s,model);
  assert.equal(guess.length,61);near(guess[0],s.oxygen);
  assert(guess.every(x=>Number.isFinite(x) && x<=s.oxygen && x>=s.cutoff));
  assert.equal(p.liquidPrediction({...s,pressure:35},model),null);
  assert.equal(model.benchmark.testRuns,160);
  assert(model.benchmark.mae<model.benchmark.constantMae);
});

test('Saffire-I flow comparison converts published mm/s to cm/s and preserves all limits',()=>{
  const base={...p.defaults},pair=p.compareReferenceSpeeds(base,60);
  near(pair.concurrent.position,10.8);near(pair.opposed.position,7.8);
  near(pair.concurrent.position-pair.opposed.position,3);
  assert(pair.concurrent.chemical>pair.opposed.chemical);
  assert(pair.concurrent.oxygen<pair.opposed.oxygen);
  near(base.speed,p.defaults.speed);
  const stopped=p.compareReferenceSpeeds({...base,cutoff:30,oxygen:29},60);
  near(stopped.concurrent.position,0);near(stopped.opposed.position,0);
  const ended=p.compareReferenceSpeeds({...base,length:10},120);
  near(ended.concurrent.position,10);near(ended.opposed.position,10);
  assert.throws(()=>p.compareReferenceSpeeds(base,-1),RangeError);
});
