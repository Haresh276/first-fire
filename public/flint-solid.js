/* FLINT 1.1 dry oxygen/nitrogen thin-solid solver. See flint/limits.py and flint/rover.py. */
(() => {
  'use strict';
  const c = globalThis.FLINTCoefficients;
  function flameTemperature(material, x) {
    const i = Math.min(c.xs.length - 2, Math.max(0,
      Math.floor((x - c.xs[0]) / (c.xs[1] - c.xs[0]))));
    const weight = (x - c.xs[i]) / (c.xs[i + 1] - c.xs[i]);
    return material.tf[i] + weight * (material.tf[i + 1] - material.tf[i]);
  }
  function root(residual) {
    let low = c.Xmin, high = c.Xmax;
    if (residual(low) >= 0) return low;
    if (residual(high) < 0) return NaN;
    while (high - low > 1e-9) {
      const middle = (low + high) / 2;
      if (residual(middle) < 0) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  }
  function solve(materialKey, gravity, pressurePsia, fanMps, quenching = c.Ch) {
    const material = c.materials[materialKey];
    const g = typeof gravity === 'number' ? gravity : c.g[gravity];
    if (!material || !Number.isFinite(g) || g < 0 || !Number.isFinite(pressurePsia) ||
        pressurePsia <= 0 || !Number.isFinite(fanMps) || fanMps < 0) {
      throw new RangeError('Choose a known material, nonnegative gravity and flow, and positive pressure.');
    }
    const pressure = pressurePsia * c.psia;
    const b = c.buoy;
    const natural = b.u1g * g ** b.n * (c.Pref / pressure) ** b.n_p;
    const velocity = (fanMps ** b.m + natural ** b.m) ** (1 / b.m);
    if (velocity === 0) return {limit: NaN, velocity, branch: 'not modelled'};
    const kinetic = root(x => material.lnK + c.nP * Math.log(pressure / c.Pref) +
      Math.log(x) - material.Ea / (c.R * flameTemperature(material, x)) - Math.log(velocity));
    const radiated = material.eps * c.sigma * (material.Tp ** 4 - c.ambient ** 4);
    const thermal = root(x => {
      // rho * cp = P/(RT) * molar heat capacity for the dry ideal mixture.
      const capacity = pressure * (x * c.cpO2 + (1 - x) * c.cpN2) / (c.R * c.Tref);
      return quenching * Math.sqrt(c.k * capacity * velocity) *
        (flameTemperature(material, x) - material.Tp) - radiated;
    });
    const limit = Math.max(kinetic, thermal);
    return {limit, velocity, kinetic, thermal, branch: !Number.isFinite(limit) ? 'outside oxygen search range' :
      thermal > kinetic ? 'quenching (HTL)' : 'blow-off (CKL)'};
  }
  globalThis.FLINTSolid = {solve};
  if (typeof module !== 'undefined') module.exports = globalThis.FLINTSolid;
})();
