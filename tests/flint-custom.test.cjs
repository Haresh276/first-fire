const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../site/flint-coefficients.js');
const Th = require('../site/flint-thermo.js');
const S = require('../site/flint-solid.js');
const F = require('../site/flint-custom.js');
const c = globalThis.FLINTCoefficients;
const FUELS = {PMMA: {C: 5, H: 8, O: 2}, PC: {C: 16, H: 14, O: 3}, NOMEX: {C: 14, H: 10, O: 2, N: 2}};

test('browser flame temperature reproduces the Python tables FLINT ships', () => {
  for (const [key, fuel] of Object.entries(FUELS)) {
    const m = c.materials[key], tf = Th.tfTable(fuel, m.Tp, c.xs);
    tf.forEach((v, i) => assert.ok(Math.abs(v - m.tf[i]) < 1e-6, key + ' at ' + c.xs[i] + ': ' + v + ' vs ' + m.tf[i]));
  }
});
test('a library preset built in the Material Lab predicts exactly what the library does', () => {
  for (const p of F.PRESETS.filter(q => q.lib)) {
    const b = F.build(p);
    assert.equal(b.status, 'nasa');
    F.register('T_' + p.id, b);
    for (const g of ['moon', 'mars', 'earth']) {
      assert.ok(Math.abs(S.solve('T_' + p.id, g, 8.2, 0).limit - S.solve(p.lib, g, 8.2, 0).limit) < 1e-9, p.id + ' ' + g);
    }
  }
});
test('one Earth test calibrates the blow-off constant and is reproduced', () => {
  const x = S.solve('PMMA', 'earth', 8.2, 0).limit;
  const b = F.build({...F.PRESETS[0], lib: undefined, name: 'Acrylic retest', test: {x, P: 8.2, u: 0}});
  F.register('CAL', b);
  assert.equal(b.status, 'tested');
  assert.ok(Math.abs(b.mat.lnK - c.materials.PMMA.lnK) < 1e-6);
  assert.ok(Math.abs(b.test.reproduced - x) < 1e-9);
  assert.equal(b.test.quenchAbove, false);
  assert.ok(Math.abs(S.solve('CAL', 'moon', 8.2, 0).limit - S.solve('PMMA', 'moon', 8.2, 0).limit) < 1e-6);
  // A forced-flow test at a different pressure is also reproduced exactly.
  const b2 = F.build({...F.PRESETS[5], test: {x: 0.2, P: 10.2, u: 40}}); F.register('CAL2', b2);
  assert.ok(Math.abs(b2.test.reproduced - 0.2) < 1e-6, String(b2.test.reproduced));
});
test('blends conserve the chemistry and a blend of one material is that material', () => {
  const self = F.build(F.blend([{spec: F.PRESETS[0], w: 0.4}, {spec: F.PRESETS[0], w: 0.6}]));
  F.register('SELF', self);
  assert.ok(Math.abs(S.solve('SELF', 'moon', 8.2, 0).limit - S.solve('PMMA', 'moon', 8.2, 0).limit) < 2e-5);
  const mix = F.blend([{spec: F.PRESETS[2], w: 0.7}, {spec: F.PRESETS[3], w: 0.3}]);
  assert.ok(Math.abs(Th.fuelProps(mix).MW - 100) < 0.01, 'pseudo-formula is per 100 g');
  const pc = Th.fuelProps(F.PRESETS[2]), nx = Th.fuelProps(F.PRESETS[3]);
  assert.ok(Math.abs(mix.Hc - (0.7 * pc.Hc + 0.3 * nx.Hc)) < 2, 'heat of combustion mixes by mass');
  assert.equal(F.build({C: 0, H: 0, O: 2, N: 0}).status, 'invalid');
});
test('orbit without a fan is reported as outside the model, never as a number', () => {
  F.register('PCX', F.build(F.PRESETS[2]));
  const r = F.predict('PCX', 8.2, 0, 0.34);
  assert.equal(r[0].v, 'nm'); assert.ok(Number.isNaN(r[0].limit));
  assert.ok(Number.isFinite(F.predict('PCX', 8.2, 0.1, 0.34)[0].limit));
});
