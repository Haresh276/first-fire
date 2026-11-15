const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
for (const file of ['flint-coefficients', 'flint-solid', 'rover-fire-data', 'rover-fire-model'])
  require('../site/'+file+'.js');
const {inventory} = globalThis.RoverFireData;
const M = globalThis.RoverFireModel;
const source = JSON.parse(readFileSync(path.join(__dirname, '../flint-engine/results/rover/rover_case.json')));
const cabin=source.rover;
const item=key=>inventory.find(it=>it.material===key);
const result=key=>source.responses.find(r=>r.material===key);
const row=key=>source.items.find(r=>r.material===key);
const near=(actual,expected,tolerance)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,
  `Expected ${actual} to be within ${tolerance} of FLINT's ${expected}`);

test('Nomex limit with fans off in the nominal cabin',()=>{
  near(100*M.limit(cabin,item('NOMEX')).limit,100*row('NOMEX').loc_fans_off,0.1);
});
test('PMMA has distinct fans-on and fans-off limits',()=>{
  near(100*M.limit(cabin,item('PMMA'),cabin.fan_m_s).limit,100*row('PMMA').loc_fans_on,0.1);
  near(100*M.limit(cabin,item('PMMA')).limit,100*row('PMMA').loc_fans_off,0.1);
});
test('The Earth air preset reproduces the Python burning inventory',()=>{
  const earth=source.trade.find(p=>p.atmosphere==='Earth sea level');
  const calculated=M.trade(cabin,inventory).find(p=>p.atmosphere===earth.atmosphere);
  assert.equal(calculated.count,earth.items_that_burn);assert.equal(calculated.modelled,earth.of);
});
test('CO2 flooding reproduces the nominal Nomex mass and crew consequence',()=>{
  const dose=M.floodDose(cabin,item('NOMEX'),'CO2');
  near(dose.kg,result('NOMEX').co2.kg,0.1);assert.equal(dose.crew_must_mask,result('NOMEX').co2.crew_must_mask);
});
test('Nitrogen flooding reproduces the nominal Nomex mass and oxygen partial pressure',()=>{
  const dose=M.floodDose(cabin,item('NOMEX'),'N2');
  near(dose.kg,result('NOMEX').n2.kg,0.1);near(dose.pO2_kPa,result('NOMEX').n2.pO2_kPa,1e-5);
});
test('Venting reproduces the Nomex pressure and suit condition',()=>{
  const vent=M.ventPressure(cabin,item('NOMEX'));
  near(vent.P_psia,result('NOMEX').vent.P_psia,0.1);assert.equal(vent.crew_must_be_suited,result('NOMEX').vent.crew_must_be_suited);
});
test('Burning the PMMA cover reproduces the FLINT time to 10 kW and all other timeline fields',()=>{
  const {summary,trace}=M.timeline(cabin,item('PMMA'));
  near(summary.t_hrr_10kW_s,result('PMMA').timeline.t_hrr_10kW_s,1);
  for (const [key,v] of Object.entries(summary)) near(v,result('PMMA').timeline[key],1e-5);
  assert.ok(trace.length>1 && trace.at(-1).t>trace[0].t);
});
test('Non-flammable, uncalibrated and diffusion-only states remain distinct',()=>{
  const unknown={...item('PMMA'), material:'OTHER'};
  assert.equal(M.assess(cabin,unknown)[0].burns,null);
  const orbit={...cabin,gravity:'orbit'};
  assert.equal(M.assess(orbit,item('PMMA'))[1].burns,null);
  assert.ok(Number.isFinite(M.assess(orbit,item('PMMA'))[0].limit));
  assert.equal(M.timeline(orbit,item('PMMA')),null);
  const earth=source.trade[0];
  assert.equal(M.assess({...cabin,P_psia:earth.P_psia,X_O2:earth.X_O2},item('NOMEX'))[1].burns,false);
});
test('Changing the cabin volume scales gas mass and reruns the sealed-cabin balance',()=>{
  const small={...cabin,volume_m3:cabin.volume_m3/2};
  near(M.floodDose(small,item('NOMEX'),'CO2').kg,result('NOMEX').co2.kg/2,1e-3);
  assert.ok(M.timeline(small,item('PMMA')).summary.t_CO2_1pct_s < result('PMMA').timeline.t_CO2_1pct_s);
});

test('Earth still air and Mars predictions do not inherit the lunar validation label',()=>{
  assert.equal(M.validity(cabin),M.validated);
  assert.equal(M.validity(cabin,cabin.fan_m_s),M.extrapolated);
  for(const gravity of ['mars','earth','orbit']){
    assert.equal(M.validity({...cabin,gravity}),M.extrapolated);
  }
  assert.equal(M.validity({...cabin,P_psia:source.trade[0].P_psia}),M.extrapolated);
});
