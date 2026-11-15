const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../site/flint-coefficients.js');
require('../site/flint-thermo.js');
require('../site/flint-solid.js');
const K = require('../site/flint-cabin.js');
const rover = require('../flint-engine/results/rover/rover_case.json');
const FUEL = {PMMA: {C: 5, H: 8, O: 2, N: 0}, P213: {C: 5, H: 8, O: 2, N: 0}, PC: {C: 16, H: 14, O: 3, N: 0}, NOMEX: {C: 14, H: 10, O: 2, N: 2}};
const AREA = {PMMA: [0.6, 3.57], P213: [0.3, 0.40], PC: [1.2, 2.40], NOMEX: [0.8, 0.45]};
const cab = {V: rover.rover.volume_m3, P_psia: rover.rover.P_psia, X0: rover.rover.X_O2, g: 0.1654};
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

test('with sealed-cabin chemistry off the browser cabin fire is the Python rover case', () => {
  for (const r of rover.responses) {
    const [area, areal] = AREA[r.material];
    const s = K.simulate({key: r.material, fuel: FUEL[r.material], areal, area, ...cab, fan: 0, chem: false}).summary, p = r.timeline;
    for (const k of ['t_hrr_1kW_s', 't_hrr_10kW_s', 't_CO2_1pct_s', 't_dT_10K_s']) assert.equal(s[k], p[k], r.material + ' ' + k);
    for (const k of ['peak_hrr_kW', 'final_O2', 'final_CO2', 'peak_T_rise_K', 'peak_dP_kPa']) assert.ok(rel(s[k], p[k]) < 1e-6, r.material + ' ' + k + ': ' + s[k] + ' vs ' + p[k]);
    assert.ok(Math.abs(s.limit_start - p.limit_used) < 1e-6);
  }
});
test('flood doses and vent pressures match the Python rover responses', () => {
  for (const r of rover.responses) {
    const co2 = K.floodDose(r.material, FUEL[r.material], cab, 'CO2'), n2 = K.floodDose(r.material, FUEL[r.material], cab, 'N2'), v = K.ventPressure(r.material, cab);
    assert.ok(rel(co2.kg, r.co2.kg) < 1e-3, r.material + ' CO2 ' + co2.kg + ' vs ' + r.co2.kg);
    assert.ok(rel(n2.kg, r.n2.kg) < 1e-3, r.material + ' N2');
    assert.equal(co2.crew_must_mask, r.co2.crew_must_mask); assert.equal(n2.crew_must_mask, r.n2.crew_must_mask);
    assert.ok(Math.abs(v.P_psia - r.vent.P_psia) < 1e-3, r.material + ' vent'); assert.equal(v.crew_must_be_suited, r.vent.crew_must_be_suited);
  }
});
test('the flame feels its own exhaust: sealed-cabin chemistry never burns more than dry oxygen', () => {
  for (const m of Object.keys(FUEL)) {
    const [area, areal] = AREA[m];
    const base = {key: m, fuel: FUEL[m], areal, area, ...cab, fan: 0};
    const dry = K.simulate({...base, chem: false}), wet = K.simulate({...base, chem: true});
    assert.ok(wet.summary.burned_kg <= dry.summary.burned_kg + 1e-9, m);
    wet.xeq.forEach((x, i) => assert.ok(x <= wet.O2[Math.max(0, i - 1)] + 1e-9 || i === 0));
  }
});
test('responses work in the expected direction and orbit without fans is outside the model', () => {
  const base = {key: 'PMMA', fuel: FUEL.PMMA, areal: 3.57, area: 0.6, ...cab, fan: 0.1, fanOff: 10, chem: true};
  const none = K.simulate(base).summary, dose = K.floodDose('PMMA', FUEL.PMMA, cab, 'CO2');
  const flood = K.simulate({...base, flood: {agent: 'CO2', kg: dose.kg, at: 30}}).summary;
  assert.ok(flood.burned_kg < 0.2 * none.burned_kg);
  assert.ok(flood.t_mask_s != null && flood.t_mask_s <= 30.5, 'a CO2 flood makes the cabin air unbreathable');
  const orbit = K.simulate({...base, g: 0, fanOff: 0}).summary;
  assert.equal(orbit.out_reason, 'nm');
});
