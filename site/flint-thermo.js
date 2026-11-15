/* FLINT 1.1 thermochemistry in the browser: a port of flint/thermo.py.
   Sensible enthalpies from NIST-JANAF (Chase, 1998), interpolated with the same monotone
   cubic (PCHIP) rule SciPy uses. Burke-Schumann flame-sheet temperature, no dissociation.
   Heat of combustion from Huggett's 13.1 MJ per kg of O2 when none is given. */
(() => {
  'use strict';
  const T = [298.15, 500, 1000, 1500, 2000, 2500, 3000, 3500];
  const H = { // kJ/mol, H(T) - H(298.15)
    N2: [0, 5.912, 21.463, 38.405, 56.137, 74.305, 92.715, 111.27],
    O2: [0, 6.088, 22.707, 40.600, 59.175, 78.375, 98.013, 118.06],
    CO2: [0, 8.305, 33.397, 61.705, 91.439, 121.926, 152.862, 184.0],
    H2O: [0, 6.922, 26.000, 48.151, 72.689, 98.964, 126.549, 154.9],
  };
  const HUGGETT = 13.1e6, MW_O2 = 31.998;
  function edge(h0, h1, m0, m1) {
    let d = ((2 * h0 + h1) * m0 - h0 * m1) / (h0 + h1);
    if (Math.sign(d) !== Math.sign(m0)) d = 0;
    else if (Math.sign(m0) !== Math.sign(m1) && Math.abs(d) > 3 * Math.abs(m0)) d = 3 * m0;
    return d;
  }
  function pchip(x, y) {
    const n = x.length, h = [], m = [], d = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) { h.push(x[i + 1] - x[i]); m.push((y[i + 1] - y[i]) / h[i]); }
    for (let k = 1; k < n - 1; k++) {
      if (Math.sign(m[k - 1]) !== Math.sign(m[k]) || m[k] === 0 || m[k - 1] === 0) { d[k] = 0; continue; }
      const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
      d[k] = (w1 + w2) / (w1 / m[k - 1] + w2 / m[k]);
    }
    d[0] = edge(h[0], h[1], m[0], m[1]);
    d[n - 1] = edge(h[n - 2], h[n - 3], m[n - 2], m[n - 3]);
    const seg = t => { let i = 0; if (t >= x[n - 1]) i = n - 2; else if (t > x[0]) while (t > x[i + 1]) i++; return i; };
    const f = t => {
      const i = seg(t), s = (t - x[i]) / h[i], s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h[i] * d[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h[i] * d[i + 1];
    };
    f.slope = t => {
      const i = seg(t), s = (t - x[i]) / h[i], s2 = s * s;
      return ((6 * s2 - 6 * s) * y[i] + (-6 * s2 + 6 * s) * y[i + 1]) / h[i] + (3 * s2 - 4 * s + 1) * d[i] + (3 * s2 - 2 * s) * d[i + 1];
    };
    return f;
  }
  const HS = {};
  for (const k of Object.keys(H)) HS[k] = pchip(T, H[k].map(v => v * 1e3));
  const hSens = (species, t) => HS[species](t);
  const cp = (species, t) => HS[species].slope(t);   // J/(mol K), as thermo.cp_species

  function fuelProps(f) {
    const C = +f.C || 0, Hy = +f.H || 0, O = +f.O || 0, N = +f.N || 0;
    const MW = 12.011 * C + 1.008 * Hy + 15.999 * O + 14.007 * N;
    const nuO2 = C + Hy / 4 - O / 2;
    const r = nuO2 * MW_O2 / MW;
    const Hc = f.Hc ? +f.Hc : HUGGETT * r;
    return {C, H: Hy, O, N, MW, nuO2, r, Hc, cpVap: 1800};
  }
  /* atm: {O2, CO2, H2O} mole fractions; nitrogen is the remainder. Ambient at 298.15 K. */
  function flameTemperature(fuel, atm, Tfuel = 600) {
    const f = fuelProps(fuel), xO2 = atm.O2;
    if (!(xO2 > 0) || !(f.nuO2 > 0)) return 298.15;
    const xCO2 = atm.CO2 || 0, xH2O = atm.H2O || 0, xN2 = 1 - xO2 - xCO2 - xH2O;
    const nAmb = f.nuO2 / xO2;
    const n = {CO2: f.C + nAmb * xCO2, H2O: f.H / 2 + nAmb * xH2O, N2: f.N / 2 + nAmb * xN2};
    const q = f.Hc * f.MW / 1000 + f.cpVap * f.MW / 1000 * (Tfuel - 298.15);
    const g = t => n.CO2 * hSens('CO2', t) + n.H2O * hSens('H2O', t) + n.N2 * hSens('N2', t) - q;
    let lo = 298.15, hi = 9000;
    if (g(hi) < 0) return hi;
    for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (g(mid) < 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /* Oxygen fraction of a dry O2/N2 mixture that gives the same flame temperature as atm. */
  function equivalentO2(fuel, atm, Tfuel = 600) {
    const target = flameTemperature(fuel, atm, Tfuel);
    let lo = 0.02, hi = 0.8;
    if (flameTemperature(fuel, {O2: lo}, Tfuel) >= target) return lo;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (flameTemperature(fuel, {O2: mid}, Tfuel) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function tfTable(fuel, Tp, xs) { return xs.map(x => flameTemperature(fuel, {O2: x}, Tp)); }
  globalThis.FLINTThermo = {hSens, cp, fuelProps, flameTemperature, equivalentO2, tfTable};
  if (typeof module !== 'undefined') module.exports = globalThis.FLINTThermo;
})();
