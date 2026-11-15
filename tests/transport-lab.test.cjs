const {test}=require('node:test'),assert=require('node:assert/strict');
const {simulate,defaults,fitMixing,mixingTime}=require('../site/transport-lab.js');
test('closed partition isolates the remote sensor and conserves all injected mass',()=>{
 const s=simulate({...defaults,exchange:0});assert.equal(s.cross,null);assert.equal(s.peak,0);assert.ok(Math.abs(s.final.a*defaults.sourceVolume-500)<1e-8);
});
test('sealed exchange follows the analytic step response; sensor lag and exhaust preserve mass',()=>{
 const config={...defaults,vent:0,lag:0};const run=simulate(config),t=100,k=config.exchange/1000*(1/config.sourceVolume+1/config.remoteVolume),m=1000*config.release;
 const diff=m/(config.pulse*config.sourceVolume)*(-Math.expm1(-k*config.pulse))/k*Math.exp(-k*(t-config.pulse));
 const cb=(m-config.sourceVolume*diff)/(config.sourceVolume+config.remoteVolume);
 assert.ok(Math.abs(run.points[t].sensor-cb)<.04);
 const vent=simulate(defaults),fine=simulate(defaults,.05);
 assert.ok(vent.final.removed>0 && vent.cross>0);assert.ok(vent.points.every(o=>o.a>=0&&o.b>=0&&Math.abs(o.residual)<1e-8));
 assert.ok(Math.abs(vent.cross-fine.cross)<.2);assert.ok(Math.abs(vent.peak-fine.peak)<.05);
});
test('two-zone fitted repeat predictions use only their assigned calibration time',()=>{
 for(const time of [174,206,451,532])assert.ok(Math.abs(mixingTime(fitMixing(time))-time)<1e-8);
 assert.throws(()=>simulate({...defaults,exchange:NaN}));assert.throws(()=>simulate({...defaults,pulse:2.6}));
});
