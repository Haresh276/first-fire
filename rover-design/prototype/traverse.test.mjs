import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulate } from './model.mjs';
import { createTraverse, heightAt, makeTraverseConfig, runRoute, stepTraverse } from './traverse.mjs';

function data(path) {
  return JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
}
const scenario = data('examples/lunar-cellulose.json');
const parts = data('parts.json');
const schema = data('scenario.schema.json');

function config(overrides = {}, s = scenario) {
  return makeTraverseConfig(s, simulate(s, parts, schema), overrides);
}

const straight = { throttle: 1, steer: 0 };
const pivot = { throttle: 0, steer: 1 };
const idle = { throttle: 0, steer: 0 };
const ideal = { massKg: 100, slipFraction: 0, speedMps: 2, wheelRadiusM: 0.25,
  rollingResistance: 0.1, friction: 1, efficiency: 0.5, hotelW: 0, solarW: 0 };

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, actual + ' ≠ ' + expected);
}

function verifyEnergy(state, c) {
  close(state.batteryWh + state.driveWh + state.hotelWh + state.curtailedWh, c.initialWh + state.solarWh, 1e-7);
}

test('config uses the selected assembly and charges only the selected daylight case', () => {
  const c = config();
  assert.equal(c.massKg, 1660);
  assert.equal(c.solarW, 450);
  assert.equal(c.initialWh, 3000);
  assert.equal(c.hotelW, 500);
  const dark = config({}, data('examples/mars-night-pe.json'));
  assert.equal(dark.solarW, 0);
  assert.equal(dark.world, 'Mars');
});

test('flat forward and reverse drives match path length, signed wheel angle and electrical work', () => {
  const c = config(ideal);
  const origin = createTraverse(c);
  const forward = stepTraverse(origin, straight, 2, c);
  close(forward.distanceM, 4);
  close(forward.zM, 4);
  close(forward.xM, 0);
  close(forward.wheelAngleRad, 16);
  close(forward.leftWheelAngleRad, forward.rightWheelAngleRad);
  close(forward.driveWh, (100 * 1.62 * 0.1 * 4) / (0.5 * 3600));
  verifyEnergy(forward, c);
  const reverse = stepTraverse(forward, { throttle: -1, steer: 0 }, 2, c);
  close(reverse.zM, 0);
  close(reverse.distanceM, 8);
  close(reverse.wheelAngleRad, 0);
  close(reverse.driveWh, 2 * forward.driveWh);
  verifyEnergy(reverse, c);
  assert.deepEqual(origin, createTraverse(c));
});

test('imposed longitudinal slip separates wheel odometry from displacement', () => {
  const c = config({ ...ideal, slipFraction: 0.25 });
  const s = stepTraverse(createTraverse(c), straight, 2, c);
  close(s.distanceM, 3);
  close(s.wheelAngleRad * c.wheelRadiusM, 4);
  close(s.speedMps, 1.5);
});

test('differential pivot turns on the spot and a combined command follows an arc', () => {
  const c = config({ ...ideal, turnRateRadS: Math.PI / 2, trackWidthM: 2 });
  const origin = createTraverse(c);
  const turn = stepTraverse(origin, pivot, 1, c);
  close(turn.headingRad, Math.PI / 2);
  close(turn.distanceM, 0);
  close(turn.leftWheelAngleRad, 2 * Math.PI);
  close(turn.leftWheelAngleRad, -turn.rightWheelAngleRad);
  assert.ok(turn.driveWh > 0);
  const east = stepTraverse(turn, straight, 1, c);
  close(east.xM, 2);
  close(east.zM, 0);
  const arc = stepTraverse(origin, { throttle: 1, steer: 1 }, 1, c);
  close(arc.xM, 4 / Math.PI);
  close(arc.zM, 4 / Math.PI);
  close(arc.distanceM, 2);
  close(arc.headingRad, Math.PI / 2);
});

test('a 10% grade sets the signed pose and increases uphill work by the change in potential energy', () => {
  const c = config({ ...ideal, terrain: 'grade', rollingResistance: 0 });
  const origin = createTraverse(c);
  const s = stepTraverse(origin, straight, 1, c);
  close(s.pitchRad, Math.atan(0.1));
  close(s.rollRad, 0);
  close(s.yM, s.zM * 0.1);
  close(Math.hypot(s.zM, s.yM), s.distanceM);
  close(s.driveWh, 100 * 1.62 * s.yM / (0.5 * 3600));
  const crossSlope = createTraverse(c, { headingRad: Math.PI / 2 });
  close(crossSlope.rollRad, -Math.atan(0.1));
  const reverse = stepTraverse(origin, { throttle: -1, steer: 0 }, 1, c);
  assert.ok(reverse.yM < 0);
  close(reverse.driveWh, 0);
  close(reverse.batteryWh, c.initialWh);
});

test('static traction limits lateral as well as longitudinal slip and halt before spending work', () => {
  const c = config({ ...ideal, terrain: 'grade', friction: 0.02, rollingResistance: 0 });
  for (const headingRad of [0, Math.PI / 2, Math.PI]) {
    const s = stepTraverse(createTraverse(c, { headingRad }), straight, 2, c);
    assert.equal(s.status, 'traction limit');
    close(s.distanceM, 0);
    close(s.elapsedS, 0);
  }
  const route = runRoute(c, [{ xM: 0, zM: 1 }]);
  assert.equal(route.status, 'traction limit');
  assert.equal(route.waypointsReached, 0);
});

test('reserve crossing occurs at a fractional step; solar curtailment balances a full battery', () => {
  const c = config({ ...ideal, rollingResistance: 0, capacityWh: 10, initialWh: 2,
    reservePct: 10, hotelW: 3600, solarW: 0 });
  const s = stepTraverse(createTraverse(c), straight, 1.5, c);
  assert.equal(s.status, 'battery reserve');
  close(s.elapsedS, 1);
  close(s.distanceM, 2);
  close(s.hotelWh, 1);
  close(s.batteryWh, 1);
  verifyEnergy(s, c);
  assert.deepEqual(stepTraverse(s, straight, 1, c), s);
  const route = runRoute(c, [{ xM: 0, zM: 2 }], { dtS: 1 });
  assert.equal(route.status, 'route complete');
  assert.equal(route.waypointsReached, 1);
  const full = config({ ...ideal, capacityWh: 2, initialWh: 2, solarW: 3600 });
  const charged = stepTraverse(createTraverse(full), idle, 2, full);
  close(charged.solarWh, 2);
  close(charged.curtailedWh, 2);
  verifyEnergy(charged, full);
});

test('orbit withholds wheel driving and standby budgets from this surface-only simulator', () => {
  const orbit = structuredClone(scenario);
  orbit.conditions.world = 'Orbit';
  const c = config({}, orbit);
  const s = stepTraverse(createTraverse(c), straight, 2, c);
  assert.equal(s.status, 'orbital free fall');
  close(s.elapsedS, 0);
  close(s.distanceM, 0);
  assert.equal(runRoute(c, [{ xM: 3, zM: 1 }]).status, 'orbital free fall');
});

test('replay of the same configuration, starting pose and goals is identical', () => {
  const c = config({ ...ideal, terrain: 'rolling' });
  const goals = [{ xM: 5, zM: 0 }, { xM: 5, zM: 8 }, { xM: 0, zM: -2 }];
  const options = { start: { xM: -1, zM: 0, headingRad: -0.5 }, dtS: 0.25 };
  const a = runRoute(c, goals, options);
  const replay = JSON.parse(JSON.stringify({ c, goals, options }));
  assert.deepEqual(a, runRoute(replay.c, replay.goals, replay.options));
  assert.equal(a.status, 'route complete');
  assert.equal(a.waypointsReached, 3);
  assert.ok(Math.hypot(a.state.xM, a.state.zM + 2) <= 0.15);
  assert.deepEqual(a.track.at(-1), a.state);
  assert.ok(a.track.every((s, index) => index === 0 || s.elapsedS > a.track[index - 1].elapsedS));
  verifyEnergy(a.state, c);
  const early = runRoute(c, goals, { ...options, maxTimeS: 0.38 });
  close(early.state.elapsedS, 0.38);
  assert.equal(early.status, 'time limit');
});

test('LOLA elevations interpolate relative to the centre; only lunar routes can use the coverage', () => {
  const c = config({ ...ideal, terrain: 'lola', friction: 2 });
  close(heightAt(0, 0, 'lola'), 0);
  assert.notEqual(heightAt(80, 0, 'lola'), 0);
  close(heightAt(40, 0, 'lola'), heightAt(80, 0, 'lola') / 2);
  const atEdge = createTraverse(c, { xM: 2560, zM: 0, headingRad: Math.PI / 2 });
  const attempt = stepTraverse(atEdge, straight, 2, c);
  assert.equal(attempt.status, 'map boundary');
  close(attempt.xM, 2560);
  close(attempt.distanceM, 0);
  assert.throws(() => runRoute(c, [{ xM: 2561, zM: 0 }]), /coverage/);
  assert.throws(() => config({ terrain: 'lola' }, data('examples/mars-night-pe.json')), /lunar/);
});

test('nonfinite values, impossible capacities, oversized timesteps and route requests fail explicitly', () => {
  const c = config();
  const s = createTraverse(c);
  assert.throws(() => config({ terrain: 'unknown' }));
  assert.throws(() => config({ unsupported: true }));
  assert.throws(() => config({ initialWh: 5000, capacityWh: 1 }));
  assert.throws(() => stepTraverse(s, { throttle: NaN, steer: 0 }, 1, c));
  assert.throws(() => stepTraverse(s, straight, 2.1, c));
  assert.throws(() => stepTraverse({ ...s, xM: Infinity }, straight, 1, c));
  assert.throws(() => runRoute(c, []));
  assert.throws(() => runRoute(c, [{ xM: NaN, zM: 0 }]));
  assert.throws(() => runRoute(c, Array(65).fill({ xM: 0, zM: 0 })));
  assert.throws(() => runRoute(c, [{ xM: 1, zM: 0 }], { dtS: 0.05, maxTimeS: 86400 }));
  assert.deepEqual(stepTraverse(s, straight, 0, c), s);
});
