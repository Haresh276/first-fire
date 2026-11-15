const {test}=require('node:test'),assert=require('node:assert/strict');
const m=require('../site/master-physics.js'),original=require('../site/physics-lab.js');
const {FFMasterEquilibrium:grid}=globalThis;
const near=(a,b,eps=1e-9)=>assert(Math.abs(a-b)<=eps,[a,b,eps].join(' '));

test('B15 dry sealed cabin exactly reproduces original inventory and heat, including a short fuel cap and cutoff',()=>{
 for(const fuel of ['cellulose','polyethylene']){
  for(const overrides of [{},{density:10,volume:1,oxygen:22,cutoff:18}]){
   const s={...original.defaults,...overrides,fuel};
   const ref=original.atTime(s,120),f=m.simulateCabin(s).final;
   near(f.oxygenPct,ref.oxygen);near(f.co2Pct,ref.co2);near(f.heatKJ,ref.chemical);near(f.positionCm,ref.position);
  }
 }
 const f=m.simulateCabin({fuelMassG:4}).final;near(f.positionCm,2);near(f.heatKJ,60.8);
});
test('24 h life support holds declared control band and mass budgets close even with finite resources',()=>{
 const opts={crew:2,speed:0,duration:86400,oxygen:21,pressure:101.325,support:true};
 const run=m.simulateCabin(opts);assert(run.withinBand);
 near(run.crewO2G,2*0.59*1440,1e-6);near(run.crewCO2G,2*.69*1440,1e-6);
 near(run.scrubbedG,run.crewCO2G,1e-6);assert(run.makeupG>0);
 const failed=m.simulateCabin({...opts,oxygenTankG:2,scrubCapacityG:3});
 near(failed.makeupG,2);near(failed.scrubbedG,3);assert(!failed.withinBand);assert(failed.final.co2Pct>1);
});
test('energy closes to 0.1%, gas temperature responds to wall loss, pressure is independently reconstructible',()=>{
 for(const s of [{},{support:true,crew:3,power:100,capacity:8,batteryOffAtS:24},{wallTemperatureK:200},{wallUA:0,wallTemperatureK:500}]){
  const r=m.simulateCabin(s),f=r.final;
  const lhs=f.heatKJ+f.crewHeatKJ+f.batteryKJ;
  near(lhs,f.storedKJ+f.wallKJ+f.removedGasSensibleKJ,Math.max(.001,lhs*.001));
  const n=Object.values(r.moles).reduce((x,y)=>x+y,0);near(f.pressureKpa,n*8.31446261815324*f.temperatureK/r.scenario.volume/1000,1e-8);
  assert(r.energyResidualPercent<.1);
 }
 const ad=m.simulateCabin({wallUA:0}).final,cooled=m.simulateCabin({wallUA:100}).final;
 assert(ad.temperatureK>cooled.temperatureK && ad.pressureKpa>cooled.pressureKpa);near(ad.wallKJ,0);
});
test('zero-oxygen, battery shutoff, inert species and zero-ignition paths work',()=>{
 const s={diluent:'He',oxygen:0,speed:1,wallUA:0,support:false,power:55,batteryOffAtS:10.5};
 const h=m.simulateCabin(s),n=m.simulateCabin({...s,diluent:'N2'});near(h.final.heatKJ,0);near(h.final.batteryKJ,.5775);near(h.final.oxygenPct,0);
 assert(h.moles.helium>0 && h.moles.nitrogen===0 && h.final.temperatureK>n.final.temperatureK);
 assert.equal(m.simulateCabin({speed:0}).final.positionCm,0);assert.throws(()=>m.simulateCabin({diluent:'air'}));
});
test('all ten independent Cantera points pass 2% and table declines extrapolation',()=>{
 assert.equal(grid.spot_checks.length,10);
 for(const x of grid.spot_checks){const t=m.equilibrium(x.fuel,x.oxygen_pct,x.pressure_kpa);
 near(t,x.interpolated_k,1e-5);assert(Math.abs(t-x.reference_k)/x.reference_k<.02);}
 for(const f of ['cellulose','polyethylene']){near(m.equilibrium(f,40,110),grid.kelvin[f].at(-1).at(-1));assert.throws(()=>m.equilibrium(f,75,60));}
 assert.throws(()=>m.equilibrium('PMMA',21,100));
});
test('thin-fuel scaling, thermal regime gate and analytic tracer washout',()=>{
 const base=m.spread();assert(base.mmPerSecond>=.18 && base.mmPerSecond<=13);
 near(m.spread({thicknessMM:base.properties.thicknessMM*2}).mmPerSecond,base.mmPerSecond*.5);
 for(const regime of ['quench','blowoff','unknown'])assert.equal(m.spread({regime}).mmPerSecond,null);
 const d=m.decayCheck();near(d.analytic,20*Math.exp(-.015/8*300));assert(d.maxPercent<.02);
 const fine=m.decayCheck(8,15,20,300,.1);assert(fine.maxPercent<d.maxPercent);
});
test('second-generation recurrent release gate is scored against the stronger structured lookup on held-out runs',()=>{
 const b=require('../data/master-physics/surrogate.json');
 assert.equal(b.partitions.test*b.steps_per_run,9600);assert.equal(b.partitions.train,640);
 assert(b.liquid.training_parameters>0 && b.plain_rnn.training_parameters>0);
 assert.equal(b.decision,b.liquid.mae_pp<b.structured_lookup.mae_pp?'retain':'drop');
 assert(b.structured_lookup.mae_pp<.002);assert.equal(b.decision,'drop');
});
test('three completed NIST FDS runs have source files that match their hashes and a gate evaluated on every time sample',()=>{
 require('../site/master-fds-data');
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
 const ref=globalThis.FFMasterFDS;assert.equal(ref.cases.length,3);assert.equal(ref.release,'FDS 6.11.1');
 for(const c of ref.cases){
  assert.equal(c.trace.length,46);assert.equal(c.trace.at(-1).time_s,45);
  near(c.max_abs_pp,Math.max(...c.trace.map(p=>Math.abs(p.balance_oxygen_pct-p.fds_oxygen_pct))));
  assert(c.max_abs_pp<=ref.tolerance_pp);assert(c.max_abs_pp<c.hold_constant_max_pp);
  for(const [name,digest] of Object.entries(c.hashes)){
   const data=fs.readFileSync(path.join(__dirname,'../data/master-physics/fds',name));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),digest);
  }
 }
 near(ref.cases[1].trace.at(-1).fds_oxygen_pct-ref.cases[2].trace.at(-1).fds_oxygen_pct,.001679,1e-8);
});
test('measured opposed calibration exposes the mismatch when transferred to the concurrent run',()=>{
 const f=m.saffireCheck();near(f.calibratedFactor*f.rawOpposedMMs,1.3);
 assert.equal(f.observedConcurrentMMs,1.8);assert(f.errorMMs<-.4);
 assert.equal(m.spread({flowCmS:.1}).mmPerSecond,null);
});
