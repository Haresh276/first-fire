import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectPart, setEnvironment, simulate } from './model.mjs';

function fixture(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const catalog = fixture('../parts.json');
const schema = fixture('../scenario.schema.json');
const lunar = fixture('../examples/lunar-cellulose.json');
const lunarPE = fixture('../examples/lunar-pe.json');
const marsPE = fixture('../examples/mars-night-pe.json');

function run(scenario = lunar, conditions = {}) {
  return simulate({ ...scenario, conditions: { ...scenario.conditions, ...conditions } }, catalog, schema);
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Number.isFinite(actual), 'Expected a finite result, got ' + actual);
  assert.ok(Math.abs(actual - expected) <= tolerance, 'Expected ' + expected + ', got ' + actual);
}

test('the published A/B examples attribute only the coupon change to the material', () => {
  assert.deepEqual(lunar.conditions, lunarPE.conditions);
  assert.deepEqual({ ...lunar.parts, material: 'pe' }, lunarPE.parts);
  const a = run(lunar);
  const b = run(lunarPE);
  for (const group of ['mobility', 'power', 'thermal', 'air', 'tracer', 'suppression']) {
    assert.deepEqual(a[group], b[group], group);
  }
  close(a.coupon.netChemicalPotentialKJ, 152);
  close(b.coupon.netChemicalPotentialKJ, 434);
  close(a.coupon.stoichiometricO2Mol, 0.370048291302015);
  close(b.coupon.stoichiometricO2Mol, 1.069366222285592);
  assert.ok(a.sourceIds.includes('stock-cellulose'));
  assert.ok(b.sourceIds.includes('stock-pe'));
  assert.ok(!b.sourceIds.includes('stock-cellulose'));
});

test('the published changed-conditions case changes loads, cabin inventories and detector timing', () => {
  const moon = run(lunarPE);
  const mars = run(marsPE);
  assert.deepEqual(mars.coupon, moon.coupon);
  close(mars.mobility.massKg, 1660);
  close(mars.mobility.staticSupportN, 6158.6);
  close(mars.power.generationW, 0);
  close(mars.power.endWh, 1000);
  close(moon.power.endWh, 2800);
  close(mars.air.initialO2KPa, 19.2236);
  close(moon.air.initialO2KPa, 21);
  assert.ok(mars.thermal.netLongwaveOutW > moon.thermal.netLongwaveOutW);
  assert.ok(mars.air.accessLossMol > moon.air.accessLossMol);
  assert.ok(moon.tracer.thresholdTimeWithDelayS > 0);
  assert.equal(mars.tracer.thresholdTimeWithDelayS, null);
  assert.equal(mars.resultClass, 'simulation');
  assert.equal(mars.compatibility, 'unverified');
});

test('every catalog part can be selected in its own slot without overwriting other user settings', () => {
  const before = structuredClone(lunar);
  for (const part of catalog.parts) {
    const trial = selectPart(lunar, part.slot, part.id, catalog);
    assert.deepEqual(trial.parts, { ...lunar.parts, [part.slot]: part.id });
    assert.deepEqual(trial.conditions, { ...lunar.conditions, ...part.assumedSettings });
    const result = run(trial);
    for (const id of part.sourceIds) assert.ok(result.sourceIds.includes(id));
    assert.equal(result.sourceIds.length, new Set(result.sourceIds).size);
    assert.equal(result.compatibility, 'unverified');
  }
  assert.deepEqual(lunar, before);
  assert.throws(() => selectPart(lunar, 'power', 'open-deck', catalog));
});

test('mass is invariant across worlds, while weight and supported wheel loads change with gravity', () => {
  const conditions = { chassisKg: 100, hardwareKg: 200, payloadKg: 30, crew: 2, personKg: 85, wheels: 4 };
  for (const [world, g] of Object.entries({ Moon: 1.62, Mars: 3.71, Earth: 9.80665, Orbit: 0 })) {
    const scenario = setEnvironment(lunar, world, 'night');
    const { mobility } = run(scenario, conditions);
    close(mobility.massKg, 500);
    close(mobility.idealSupportAccelerationMs2, g);
    close(mobility.staticSupportN, 500 * g);
    if (world === 'Orbit') assert.equal(mobility.staticLoadPerWheelN, null);
    else close(mobility.staticLoadPerWheelN, 125 * g);
  }
  assert.equal(lunar.conditions.phase, 'day');
});

test('IMU comparisons require a stationary supported reading and respect orientation and tolerance', () => {
  const reading = { accelX: -0.972, accelY: 0, accelZ: 1.296, imuMode: 'stationary supported' };
  assert.equal(run().mobility.specificForceNormMs2, null);
  assert.equal(run().mobility.stationaryNormAgrees, null);
  close(run(lunar, reading).mobility.specificForceNormMs2, 1.62);
  assert.equal(run(lunar, reading).mobility.stationaryNormAgrees, true);
  const offset = { ...reading, accelX: 0, accelY: 1.8, accelZ: 0, imuTolerance: 0.1 };
  assert.equal(run(lunar, offset).mobility.stationaryNormAgrees, false);
  assert.equal(run(lunar, { ...offset, imuTolerance: 0.2 }).mobility.stationaryNormAgrees, true);
  assert.equal(run(lunar, { ...reading, imuMode: 'moving or free-falling' }).mobility.stationaryNormAgrees, null);
  assert.equal(run(setEnvironment(lunar, 'Orbit', 'day'), reading).mobility.stationaryNormAgrees, null);
});

test('PV and battery balance cover charge, curtailment, shortfall and night operation', () => {
  const c = { capacityWh: 1000, startPct: 80, loadW: 400, hours: 2, sunWm2: 500, panelM2: 4, pvEff: 0.25 };
  const { power } = run(lunar, c);
  close(power.generationW, 500);
  close(power.demandWh, 800);
  close(power.endWh, 1000);
  close(power.curtailedWh, 0);
  close(run(lunar, { ...c, startPct: 100 }).power.curtailedWh, 200);
  const night = run(lunar, { ...c, phase: 'night', loadW: 600 });
  close(night.power.generationW, 0);
  close(night.power.endWh, 0);
  close(night.power.unmetWh, 400);
  assert.ok(night.notes.some(note => /shortfall/i.test(note)));
  const battery = selectPart(lunar, 'power', 'pack-only', catalog);
  close(run(battery, c).power.generationW, 0);
  close(run(lunar, { ...c, hours: 0 }).power.endWh, 800);
});

test('radiator balance includes net infrared exchange, solar absorption and internal heat', () => {
  const c = { skinK: 300, sinkK: 200, radiatorM2: 2, projectedM2: 0.5, emissivity: 0.8, absorptivity: 0.25, sunWm2: 800, internalW: 50 };
  const { thermal } = run(lunar, c);
  close(thermal.netLongwaveOutW, 589.718939576);
  close(thermal.absorbedSunW, 100);
  close(thermal.rejectedMinusLoadW, 439.718939576);
  close(run(lunar, { ...c, phase: 'night' }).thermal.absorbedSunW, 0);
  close(run(lunar, { ...c, skinK: c.sinkK }).thermal.netLongwaveOutW, 0);
  assert.ok(run(lunar, { ...c, sinkK: 350 }).thermal.netLongwaveOutW < 0);
  const shaded = selectPart(lunar, 'thermal', 'shade', catalog);
  close(run(shaded).thermal.absorbedSunW, 0);
  close(run(shaded).power.generationW, run().power.generationW);
});

test('gas inventory, oxygen partial pressure, leak and airlock gas use have independent units', () => {
  const { air } = run();
  close(air.inventoryMol, 342.4704346979318);
  close(air.initialO2Mol, 102.74113040937954);
  close(air.initialO2KPa, 21);
  close(air.outwardLeakMol, 0.56);
  close(air.accessLossMol, 10.702201084310369);
  const lostMol = 11.262201084310369;
  close(air.replacementMixtureMol, lostMol);
  close(air.oxygenSupplyG, 283.2 + lostMol * 0.3 * 31.998);
  close(air.nitrogenSupplyG, lostMol * 0.7 * 28.014);
  const recovered = run(lunar, { recovery: 1, leakMolHrKPa: 0 }).air;
  close(recovered.replacementMixtureMol, 0);
  close(recovered.oxygenSupplyG, 283.2);
  close(run(lunar, { cycles: 0 }).air.accessLossMol, 0);
  close(run(lunar, { cycles: 2, lockM3: 3 }).air.accessLossMol, 4 * air.accessLossMol);
  const suitport = selectPart(lunar, 'access', 'suitport', catalog);
  assert.ok(run(suitport).air.accessLossMol < air.accessLossMol);
});

test('metabolic rates scale with activity, occupants and time, and removal is capped by both mass and capacity', () => {
  for (const [activity, oxygen, carbon] of [['sleep', 22.2, 26.4], ['nominal', 35.4, 41.4], ['aerobic', 239.4, 313.2]]) {
    const { air } = run(lunar, { activity, crew: 1, hours: 1, scrubGhr: 12 });
    close(air.metabolicO2G, oxygen);
    close(air.metabolicCO2G, carbon);
    close(air.scrubbedCO2G, 12);
    close(air.unremovedCO2G, carbon - 12);
  }
  const empty = run(lunar, { crew: 0 }).air;
  close(empty.metabolicO2G, 0);
  close(empty.scrubbedCO2G, 0);
  close(run().air.unremovedCO2G, 0);
  const storage = selectPart(lunar, 'lifeSupport', 'storage', catalog);
  close(run(storage, { scrubGhr: 1000 }).air.scrubbedCO2G, 0);
});

test('an inward pressure gradient withholds leak and replenishment amounts', () => {
  const earth = setEnvironment(lunar, 'Earth', 'day');
  const { air } = run(earth);
  for (const key of ['outwardLeakMol', 'accessLossMol', 'replacementMixtureMol', 'oxygenSupplyG', 'nitrogenSupplyG']) {
    assert.equal(air[key], null, key);
  }
  close(air.initialO2KPa, 21);
  const equalized = run(earth, { outsideKPa: 70 }).air;
  close(equalized.outwardLeakMol, 0);
  close(equalized.accessLossMol, 0);
});

test('an open deck has no shared gas, coupon or indoor tracer result, while external budgets still run', () => {
  const open = selectPart(lunar, 'cabin', 'open-deck', catalog);
  const result = run(open);
  for (const key of ['air', 'coupon', 'tracer']) assert.equal(result[key], null, key);
  close(result.mobility.massKg, 1660);
  close(result.power.generationW, 450);
  assert.ok(result.notes.some(note => /suit/i.test(note)));
  for (const world of ['Moon', 'Orbit']) {
    assert.throws(() => run(setEnvironment(open, world, 'day'), { outsideKPa: 1 }), /vacuum/);
  }
});

test('fuel demand and chemical potential require a characterized material; inventory coverage can fail', () => {
  const result = run(lunarPE, { pressureKPa: 30, oxygenPct: 10, volumeM3: 1, gasK: 300, reactedG: 500 });
  assert.equal(result.coupon.inventoryCoversDemand, false);
  close(result.coupon.netChemicalPotentialKJ, 21700);
  const zero = run(lunar, { reactedG: 0 }).coupon;
  close(zero.stoichiometricO2Mol, 0);
  close(zero.netChemicalPotentialKJ, 0);
  assert.equal(zero.inventoryCoversDemand, true);
  const unknown = selectPart(lunar, 'material', 'unknown', catalog);
  assert.equal(run(unknown).coupon, null);
  assert.deepEqual(run(unknown).tracer, run().tracer);
  assert.ok(run(unknown).notes.some(note => /unknown/i.test(note)));
});

test('two-zone transport conserves a prescribed impulse with and without fan exchange', () => {
  const c = { volumeM3: 10, pulseMg: 100, exchangeLs: 25, windowS: 100 };
  const { tracer } = run(lunar, c);
  close(tracer.sourceMgM3, 10 * (1 + Math.exp(-1)));
  close(tracer.remoteMgM3, 10 * (1 - Math.exp(-1)));
  close(tracer.atSamplingZoneMgM3, tracer.remoteMgM3);
  close(tracer.tracerAccountedMg, 100);
  for (const params of [{ exchangeLs: 0 }, { windowS: 0 }]) {
    const still = run(lunar, { ...c, ...params }).tracer;
    close(still.sourceMgM3, 20);
    close(still.remoteMgM3, 0);
    close(still.tracerAccountedMg, 100);
    assert.equal(still.thresholdTimeWithDelayS, null);
  }
  const empty = run(lunar, { ...c, pulseMg: 0 }).tracer;
  close(empty.remoteMgM3, 0);
  close(empty.tracerAccountedMg, 0);
  assert.equal(empty.thresholdTimeWithDelayS, null);
});

test('an ideal threshold alarm respects physical crossing time, location, delay and the observation window', () => {
  const c = { volumeM3: 10, pulseMg: 100, exchangeLs: 25, thresholdMgM3: 5, delayS: 5, windowS: 75 };
  close(run(lunar, c).tracer.thresholdTimeWithDelayS, 74.31471805599453);
  assert.equal(run(lunar, { ...c, windowS: 74 }).tracer.thresholdTimeWithDelayS, null);
  assert.equal(run(lunar, { ...c, thresholdMgM3: 10, windowS: 900 }).tracer.thresholdTimeWithDelayS, null);
  for (const zone of ['crew space', 'equipment bay']) {
    const local = run(lunar, { ...c, exchangeLs: 0, ignition: zone, sensor: zone, windowS: 5 }).tracer;
    close(local.thresholdTimeWithDelayS, 5);
    close(local.atSamplingZoneMgM3, 20);
  }
  const swapped = run(lunar, { ...c, ignition: 'crew space', sensor: 'equipment bay' }).tracer;
  close(swapped.thresholdTimeWithDelayS, 74.31471805599453);
  const absent = selectPart(lunar, 'detection', 'no-detector', catalog);
  const undetected = run(absent, c).tracer;
  assert.equal(undetected.thresholdTimeWithDelayS, null);
  close(undetected.remoteMgM3, run(lunar, c).tracer.remoteMgM3);
});

test('discharge conserves agent mass, caps delivered mass at stock and makes no extinction claim', () => {
  for (const [dischargeS, deliveredKg, remainingKg] of [[0, 0, 2], [15, 0.6, 1.4], [100, 2, 0]]) {
    const result = run(lunar, { agentKg: 2, agentGps: 40, dischargeS }).suppression;
    close(result.deliveredKg, deliveredKg);
    close(result.remainingKg, remainingKg);
    assert.equal(result.extinction, null);
  }
  const absent = selectPart(lunar, 'suppression', 'no-agent', catalog);
  close(run(absent, { agentKg: 20 }).suppression.deliveredKg, 0);
});

test('stock yield accounts for trim while source and user-entered lot remain independent of qualification', () => {
  const cut = { reactedG: 12, yieldPct: 50, thicknessMm: 0.4, lotId: '  trial-17  ' };
  const { sourcing } = run(lunar, cut);
  close(sourcing.netG, 12);
  close(sourcing.feedG, 24);
  close(sourcing.trimG, 12);
  close(sourcing.thicknessMm, 0.4);
  assert.equal(sourcing.evidenceStatus, 'vendor analogue only');
  assert.equal(sourcing.traceability, 'user-entered lot: trial-17');
  assert.equal(sourcing.qualification, null);
  for (const stockOrigin of ['reclaimed stock', 'lunar feedstock', 'Martian feedstock']) {
    const trial = run(lunar, { ...cut, stockOrigin, yieldPct: 100, lotId: '' }).sourcing;
    assert.equal(trial.origin, stockOrigin);
    assert.equal(trial.evidenceStatus, 'unverified source or process');
    assert.equal(trial.traceability, 'lot unknown');
    assert.equal(trial.qualification, null);
    close(trial.feedG, trial.netG);
    close(trial.trimG, 0);
  }
  const unknown = selectPart(lunar, 'material', 'unknown', catalog);
  assert.equal(run(unknown, cut).sourcing.evidenceStatus, 'unverified source or process');
});

test('the entry point rejects missing, unknown, nonfinite, out-of-range and contradictory conditions', () => {
  assert.throws(() => run({ ...lunar, version: '0.1' }), /version/);
  assert.throws(() => run({ ...lunar, name: '' }), /name/);
  assert.throws(() => run({ ...lunar, parts: { ...lunar.parts, cabin: 'bad' } }), /cabin/);
  assert.throws(() => run(lunar, { extra: 1 }), /unknown/);
  assert.throws(() => run(lunar, { projectedM2: 1.1, radiatorM2: 1 }), /area/);
  assert.throws(() => setEnvironment(lunar, 'Sun', 'night'));
  assert.throws(() => setEnvironment(lunar, 'Moon', 'summer'));
  for (const [key, rule] of Object.entries(schema.properties.conditions.properties)) {
    const missing = structuredClone(lunar);
    delete missing.conditions[key];
    assert.throws(() => simulate(missing, catalog, schema), new RegExp(key));
    if (rule.enum) {
      assert.throws(() => run(lunar, { [key]: 'unrecognized' }), new RegExp(key));
      continue;
    }
    if (rule.type === 'string') {
      assert.throws(() => run(lunar, { [key]: 0 }), new RegExp(key));
      assert.throws(() => run(lunar, { [key]: 'a'.repeat(rule.maxLength + 1) }), new RegExp(key));
      continue;
    }
    const badValues = [null, '0', NaN, Infinity, rule.minimum - 1, rule.maximum + 1];
    if (rule.type === 'integer') badValues.push(rule.minimum + 0.5);
    for (const value of badValues) {
      assert.throws(() => run(lunar, { [key]: value }), new RegExp(key));
    }
  }
});
