import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectPart, setEnvironment, simulate } from './model.mjs';

function read(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}

const inputs = read('../scenario.schema.json');
const outputs = read('../result.schema.json');
const parts = read('../parts.json');
const base = read('../examples/lunar-cellulose.json');

// Check the exact JSON Schema vocabulary used by this result contract with no npm install.
// A new assertion keyword fails closed until this checker implements its semantics.
const supported = new Set([
  '$schema', 'title', 'description', 'unit', 'type', 'const', 'enum', 'minLength',
  'maxLength', 'minimum', 'items', 'uniqueItems', 'properties', 'required', 'additionalProperties'
]);

function check(value, rule, path = 'result') {
  for (const key of Object.keys(rule)) assert.ok(supported.has(key), path + ' unsupported schema keyword ' + key);
  if (Object.hasOwn(rule, 'const')) assert.equal(value, rule.const, path);
  if (rule.enum) assert.ok(rule.enum.includes(value), path + ' enum');
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (rule.type) assert.ok([rule.type].flat().includes(type), path + ' expected ' + rule.type);
  if (type === 'number') {
    assert.ok(Number.isFinite(value), path + ' finite');
    if (Object.hasOwn(rule, 'minimum')) assert.ok(value >= rule.minimum, path + ' minimum');
  }
  if (type === 'string') {
    const length = Array.from(value).length;
    if (Object.hasOwn(rule, 'minLength')) assert.ok(length >= rule.minLength, path + ' minLength');
    if (Object.hasOwn(rule, 'maxLength')) assert.ok(length <= rule.maxLength, path + ' maxLength');
  }
  if (type === 'array') {
    if (rule.items) value.forEach((item, index) => check(item, rule.items, path + '[' + index + ']'));
    if (rule.uniqueItems) assert.equal(new Set(value.map(item => JSON.stringify(item))).size, value.length, path + ' uniqueItems');
  }
  if (type === 'object') {
    for (const key of rule.required ?? []) assert.ok(Object.hasOwn(value, key), path + '.' + key + ' required');
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(rule.properties ?? {}, key)) check(item, rule.properties[key], path + '.' + key);
      else assert.notEqual(rule.additionalProperties, false, path + '.' + key + ' is outside the contract');
    }
  }
}

function run(scenario, conditions = {}) {
  const result = simulate({ ...scenario, conditions: { ...scenario.conditions, ...conditions } }, parts, inputs);
  check(result, outputs);
  return result;
}

test('every published result matches its input example and the result schema', () => {
  const saved = read('../examples/results.json');
  const names = ['lunar-cellulose', 'lunar-pe', 'mars-night-pe'];
  assert.deepEqual(Object.keys(saved).sort(), names);
  for (const name of names) {
    const computed = run(read('../examples/' + name + '.json'));
    check(saved[name], outputs);
    assert.deepEqual(saved[name], computed, name + ' must be reproducible');
  }
});

test('the schema covers open deck, unknown material, absent sensor, ingress and free fall', () => {
  const open = run(selectPart(base, 'cabin', 'open-deck', parts));
  for (const key of ['air', 'flow', 'tracer', 'coupon']) assert.equal(open[key], null, key);
  const unknown = run(selectPart(base, 'material', 'unknown', parts));
  assert.equal(unknown.coupon, null);
  assert.ok(unknown.air && unknown.tracer && unknown.flow);
  assert.equal(run(selectPart(base, 'detection', 'no-detector', parts)).tracer.thresholdTimeWithDelayS, null);
  const earth = run(setEnvironment(base, 'Earth', 'day'));
  assert.equal(earth.air.oxygenSupplyG, null);
  const orbit = run(setEnvironment(base, 'Orbit', 'night'));
  assert.equal(orbit.mobility.staticLoadPerWheelN, null);
  assert.equal(orbit.mobility.stationaryNormAgrees, null);
});

test('flow orientation follows the ignition end and the sign-free volumetric flow-to-area ratio', () => {
  // 20 L/s across 0.1 m² is 0.2 m/s. Reversing the fan changes alignment alone.
  const c = { exchangeLs: 20, sectionM2: 0.1, fanFrom: 'end A', igniteAt: 'end A' };
  for (const fanFrom of ['end A', 'end B']) {
    for (const igniteAt of ['end A', 'end B']) {
      const { flow } = run(base, { ...c, fanFrom, igniteAt });
      assert.equal(flow.ductSpeedMs, 0.2);
      assert.equal(flow.relativeDirection, fanFrom === igniteAt ? 'concurrent' : 'opposed');
      assert.equal(flow.spreadRateMmS, null);
    }
  }
  assert.deepEqual(run(base, { ...c, exchangeLs: 0 }).flow,
    { ductSpeedMs: 0, relativeDirection: 'no forced flow', spreadRateMmS: null });
  assert.equal(run(base, { ...c, sectionM2: 0.2 }).flow.ductSpeedMs, 0.1);
});

test('numeric results carry units, and incompatible result shapes or unsupported claims fail validation', () => {
  for (const group of Object.values(outputs.properties)) {
    for (const field of Object.values(group.properties ?? {})) {
      if ([field.type].flat().includes('number')) assert.ok(field.unit, field.description);
    }
  }
  const result = run(base);
  const mutations = [
    r => { delete r.air; },
    r => { delete r.power.unmetWh; },
    r => { r.power.endWh = '4000 Wh'; },
    r => { r.thermal.netLongwaveOutW = NaN; },
    r => { r.tracer.tracerAccountedMg = -1; },
    r => { r.flow.relativeDirection = 'either'; },
    r => { r.flow.spreadRateMmS = 0.5; },
    r => { r.suppression.extinction = true; },
    r => { r.sourcing.qualification = true; },
    r => { r.sourceIds.push(r.sourceIds[0]); },
    r => { r.undeclared = 1; }
  ];
  for (const mutate of mutations) {
    const bad = structuredClone(result);
    mutate(bad);
    assert.throws(() => check(bad, outputs), assert.AssertionError);
  }
});
