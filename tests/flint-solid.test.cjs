const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
require('../site/flint-coefficients.js');
const {solve} = require('../site/flint-solid.js');
const report = require('../flint-engine/results/core/results.json');
const rover = require('../flint-engine/results/rover/rover_case.json');
const read = pathName => fs.readFileSync(path.join(root, pathName));
const tol = 1e-6;

function close(actual, expected, context) {
  assert.ok(Math.abs(actual - expected) <= tol, context + ': ' + actual + ' vs ' + expected);
}
test('browser solver reproduces the Python Earth, Moon, Mars, orbit and held-out lunar predictions', () => {
  for (const [key, expected] of Object.entries(report.gravity)) {
    for (const [field, gravity, fan] of [
      ['moon','moon',0], ['mars','mars',0], ['earth_quiescent','earth',0], ['orbit_10cms','orbit',0.1]
    ]) {
      close(solve(key, gravity, rover.rover.P_psia, fan).limit, expected[field], key + ' ' + field);
    }
    const lunar = report.lunar[key];
    const hidden = solve(key,'moon',rover.rover.P_psia,0,lunar.Ch_used);
    close(hidden.limit, lunar.flint_loo, key + ' leave-one-out');
    assert.equal(hidden.branch, lunar.branch);
  }
});
test('browser pressure scaling reproduces the Python atmosphere trade and fans-on limits', () => {
  for (const row of rover.trade) {
    for (const [key, margin] of Object.entries(row.margins)) {
      close(solve(key,'moon',row.P_psia,0).limit, row.X_O2 - margin / 100, key + ' ' + row.atmosphere);
    }
  }
  for (const row of rover.items) {
    close(solve(row.material,rover.rover.gravity,rover.rover.P_psia,rover.rover.fan_m_s).limit,
      row.loc_fans_on, row.item);
    assert.equal(solve(row.material,'moon',rover.rover.P_psia,0).branch, row.branch_fans_off);
  }
});
test('quiescent orbit withholds an oxygen limit, while invalid inputs are rejected', () => {
  const quiescent = solve('PC','orbit',rover.rover.P_psia,0);
  assert.ok(Number.isNaN(quiescent.limit));
  assert.equal(quiescent.branch,'not modelled');
  for (const args of [['bad','moon',8,0],['PC','luna',8,0],['PC',-1,8,0],['PC','moon',0,0],['PC','moon',8,-1]]) {
    assert.throws(() => solve(...args), RangeError);
  }
});
