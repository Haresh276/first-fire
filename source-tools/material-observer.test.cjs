const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicDir = path.join(__dirname, '../public');
const observer = require('../public/material-observer-model.js');
const { solve } = require('../public/flint-solid.js');
const report = require('../public/flint/results/core/results.json');
const sensitivity = require('../public/flint/closure-sensitivity.json');

const moon = { place: 'moon', pressurePsia: 8.2, fanCmS: 0, oxygenPct: 34 };
const evaluate = (composition, environment = {}) => observer.evaluate({ ...moon, ...environment, composition });
const near = (a, b, tolerance = 0.001) => {
  assert.ok(Number.isFinite(a) && Math.abs(a - b) < tolerance, a + ' vs ' + b);
};

test('both four-material scorecards reproduce the Python report and the comparator ranking reverses', () => {
  const cards = observer.validation();
  const alternate = {
    PMMA: [13, 12.944586], P213: [13.5, 12.410913],
    PC: [21, 17.361646], NOMEX: [24, 29.525637],
  };
  assert.equal(cards.figure13.rows.length, 4);
  assert.equal(cards.alternate.rows.length, 4);
  for (const row of cards.figure13.rows) {
    const reference = report.lunar[row.key];
    near(row.observedPct, 100 * reference.observed);
    near(row.predictedPct, 100 * reference.flint_loo);
    near(row.errorPoints, 100 * reference.loo_error);
    near(row.baselinePct, 100 * reference.straight_line_u0);
  }
  for (const row of cards.alternate.rows) {
    near(row.observedPct, alternate[row.key][0]);
    near(row.predictedPct, alternate[row.key][1]);
  }
  near(cards.figure13.modelMaePoints, report.methods['FLINT leave-one-out'].mae_pts);
  near(cards.figure13.baselineMaePoints, report.methods['Straight line to zero flow (Table 2 method, best fit)'].mae_pts);
  near(cards.alternate.modelMaePoints, report.lunar_alt_dataset_loo_mae_pts);
  near(cards.alternate.baselineMaePoints, sensitivity.alternate_straight_line_mae_pts);
  assert.ok(cards.figure13.modelMaePoints < cards.figure13.baselineMaePoints);
  assert.ok(cards.alternate.modelMaePoints > cards.alternate.baselineMaePoints);
});

test('independently refitting on the three OTHER lunar specimens gives the displayed predictions', () => {
  // Reconstruct each training fold from the published readings. The target is
  // not passed to the objective, even when checking the alternate figure set.
  for (const { rows } of Object.values(observer.validation())) {
    for (const target of rows) {
      const training = rows.filter(row => row.key !== target.key);
      function loss(logC) {
        let sum = 0;
        for (const row of training) {
          const fraction = solve(row.key, 'moon', 8.2, 0, Math.exp(logC)).limit;
          sum += Number.isFinite(fraction) ? (fraction - row.observedPct / 100) ** 2 : 1;
        }
        return sum;
      }
      const start = Math.log(0.3), step = (Math.log(60) - start) / 160;
      const grid = Array.from({ length: 161 }, (_, i) => loss(start + i * step));
      const best = grid.indexOf(Math.min(...grid));
      let lo = start + Math.max(0, best - 1) * step;
      let hi = start + Math.min(160, best + 1) * step;
      for (let i = 0; i < 35; i++) {
        const left = lo + (hi - lo) / 3, right = hi - (hi - lo) / 3;
        if (loss(left) < loss(right)) hi = right;
        else lo = left;
      }
      near(100 * solve(target.key, 'moon', 8.2, 0, Math.exp((lo + hi) / 2)).limit, target.predictedPct);
    }
  }
});

test('pure scenarios match the full-fit rover solver and distinguish fitting conditions from withheld predictions', () => {
  const result = evaluate({ NOMEX: 100 });
  assert.equal(result.status, 'reference');
  const part = result.parts[0];
  near(result.limitPct, 100 * report.gravity.NOMEX.moon);
  near(result.marginPoints, 34 - 26.37053);
  near(part.alternateLimitPct, 25.67265);
  near(part.kineticPct, 18.786347);
  near(part.thermalPct, result.limitPct);
  near(part.flowCmS, 19.212323);
  assert.equal(part.matchingObservation.observedPct, 25.6);
  assert.match(part.matchingObservation.kind, /Fitted/);
  assert.notEqual(result.limitPct, observer.validation().figure13.rows.find(row => row.key === 'NOMEX').predictedPct);
  const oxygen = evaluate({ NOMEX: 100 }, { oxygenPct: 21 });
  near(oxygen.limitPct, result.limitPct);
  assert.ok(oxygen.marginPoints < 0);
  const lowPressure = evaluate({ NOMEX: 100 }, { pressurePsia: 7 });
  assert.equal(lowPressure.parts[0].matchingObservation, null);
  assert.notEqual(lowPressure.limitPct, result.limitPct);
  assert.equal(evaluate({ PMMA: 100 }, { place: 'earth', fanCmS: 60.5 }).parts[0].matchingObservation.observedPct, 15.4);
  assert.equal(evaluate({ PMMA: 100 }, { place: 'mars' }).parts[0].matchingObservation, null);
  assert.notEqual(evaluate({ PMMA: 100 }, { place: 'earth' }).limitPct, evaluate({ PMMA: 100 }, { place: 'mars' }).limitPct);
});

test('no weighted average, fabricated mixture limit or bound on mixture burning', () => {
  const all = evaluate({ P213: 40, PC: 60 });
  assert.equal(all.status, 'components-only');
  assert.equal(all.limitPct, null);
  assert.equal(all.marginPoints, null);
  near(all.componentSpanPct[0], 12.410913);
  near(all.componentSpanPct[1], 18.932740);
  assert.deepEqual(all.parts.map(part => part.massPct), [40, 60]);
  assert.deepEqual(all.componentSpanPct, evaluate({ P213: 90, PC: 10 }).componentSpanPct);
  const mixed = evaluate({ PC: 66.5, OTHER: 33.5 });
  assert.equal(mixed.parts[1].limitPct, null);
  assert.equal(mixed.componentSpanPct, null);
  for (const composition of [{ CELLULOSE: 75, FIBERGLASS: 25 }, { FIBERGLASS: 100 }, { OTHER: 100 }]) {
    const unmodelled = evaluate(composition);
    assert.equal(unmodelled.status, 'unmodelled');
    assert.equal(unmodelled.limitPct, null);
    assert.equal(unmodelled.marginPoints, null);
    assert.ok(unmodelled.parts.every(part => part.limitPct === null));
  }
});

test('quiescent orbit withholds its threshold; forced flow supports an explicitly extrapolated comparison', () => {
  const still = evaluate({ PC: 100 }, { place: 'orbit' });
  assert.equal(still.status, 'unmodelled');
  assert.match(still.note, /diffusion/);
  assert.equal(still.parts[0].flowCmS, 0);
  const vented = evaluate({ PC: 100 }, { place: 'orbit', fanCmS: 10 });
  assert.equal(vented.status, 'reference');
  assert.ok(Number.isFinite(vented.limitPct));
  assert.match(vented.basis, /Extrapolation/);
  near(vented.parts[0].flowCmS, 10);
});

test('rejects invalid units, unsupported inputs and incomplete recipes', () => {
  for (const recipe of [{}, null, [], { BAD: 100 }, { PMMA: '100' }, { PMMA: Infinity },
    { PMMA: -1, PC: 101 }, { PMMA: 99 }, { PMMA: 100, PC: 0.1 }]) {
    assert.throws(() => evaluate(recipe), RangeError);
  }
  for (const setting of [{ pressurePsia: 0 }, { pressurePsia: 15 }, { fanCmS: -1 },
    { fanCmS: Infinity }, { oxygenPct: null }, { oxygenPct: 100.01 }, { place: 'venus' }]) {
    assert.throws(() => evaluate({ PMMA: 100 }, setting), RangeError);
  }
  const thirds = evaluate({ PMMA: 100 / 3, PC: 100 / 3, P213: 100 / 3, OTHER: 0 });
  assert.equal(thirds.parts.length, 3);
  assert.equal(evaluate({ PMMA: 100 }, { oxygenPct: 0 }).status, 'reference');
});

test('browser side-effect scripts expose the same API and label all material choices', () => {
  const browser = vm.createContext({});
  for (const file of ['flint-coefficients.js', 'flint-solid.js', 'material-observer-model.js']) {
    vm.runInContext(fs.readFileSync(path.join(publicDir, file), 'utf8'), browser, { filename: file });
  }
  const model = browser.MaterialObserver;
  assert.deepEqual(Array.from(model.materials, item => item.key), ['PMMA', 'P213', 'PC', 'NOMEX', 'CELLULOSE', 'FIBERGLASS', 'OTHER']);
  assert.ok(model.materials.every(item => item.label.length > 0));
  near(model.evaluate({ ...moon, composition: { PMMA: 100 } }).limitPct, evaluate({ PMMA: 100 }).limitPct);
});
