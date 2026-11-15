/* FLINT 1.1 custom materials in the browser.
   Build a thin-solid material from its chemistry (or a blend), calibrate its blow-off constant on
   one Earth fire test, and register it with the browser solver (flint-solid.js).
   Flame temperatures come from flint-thermo.js, the port of flint/thermo.py. */
(() => {
  'use strict';
  const c = globalThis.FLINTCoefficients, Th = globalThis.FLINTThermo, S = globalThis.FLINTSolid;
  const lib = c.materials;
  const KINETICS = {
    PMMA: {label: 'Acrylic-like', Ea: lib.PMMA.Ea, lnK: lib.PMMA.lnK},
    PC: {label: 'Polycarbonate-like', Ea: lib.PC.Ea, lnK: lib.PC.lnK},
    NOMEX: {label: 'Nomex-like', Ea: lib.NOMEX.Ea, lnK: lib.NOMEX.lnK},
  };
  // Library entries carry NASA's calibration; the others are starting points with typical values.
  const PRESETS = [
    {id: 'PMMA', name: 'Acrylic (PMMA)', use: 'windows and display covers', C: 5, H: 8, O: 2, N: 0, Tp: 618, eps: 0.9, kin: 'PMMA', lib: 'PMMA'},
    {id: 'P213', name: 'P213 cable tape', use: 'wiring and stowage', C: 5, H: 8, O: 2, N: 0, Tp: 618, eps: 0.9, kin: 'PMMA', lib: 'P213'},
    {id: 'PC', name: 'Polycarbonate', use: 'equipment housings', C: 16, H: 14, O: 3, N: 0, Tp: 700, eps: 0.9, kin: 'PC', lib: 'PC'},
    {id: 'NOMEX', name: 'Nomex (aramid)', use: 'Velcro, suits and bags', C: 14, H: 10, O: 2, N: 2, Tp: 750, eps: 0.9, kin: 'NOMEX', lib: 'NOMEX'},
    {id: 'CELL', name: 'Cotton or paper', use: 'clothing, paper and wipes', C: 6, H: 10, O: 5, N: 0, Tp: 600, eps: 0.9, kin: 'PMMA'},
    {id: 'PE', name: 'Polyethylene', use: 'bags, packaging and wire jackets', C: 2, H: 4, O: 0, N: 0, Tp: 680, eps: 0.9, kin: 'PMMA'},
    {id: 'PA66', name: 'Nylon 6,6', use: 'straps, ties and fabric', C: 12, H: 22, O: 2, N: 2, Tp: 700, eps: 0.9, kin: 'PC'},
    {id: 'PI', name: 'Kapton polyimide', use: 'wire insulation and film', C: 22, H: 10, O: 5, N: 2, Tp: 830, eps: 0.9, kin: 'NOMEX'},
    {id: 'PEEK', name: 'PEEK', use: 'connectors and brackets', C: 19, H: 12, O: 3, N: 0, Tp: 850, eps: 0.9, kin: 'NOMEX'},
  ];
  const WORLDS = [['orbit', 'Orbit', 0], ['moon', 'Moon', 0.1654], ['mars', 'Mars', 0.3794], ['earth', 'Earth', 1]];
  const BAND = 0.017;   // FLINT's leave-one-out model error on NASA's lunar tests, as a fraction of oxygen

  function tfAt(mat, x) {
    const i = Math.min(c.xs.length - 2, Math.max(0, Math.floor((x - c.xs[0]) / (c.xs[1] - c.xs[0]))));
    const w = (x - c.xs[i]) / (c.xs[i + 1] - c.xs[i]);
    return mat.tf[i] + w * (mat.tf[i + 1] - mat.tf[i]);
  }
  /* Effective flow (m/s): buoyant flow at gravity g and pressure P plus a forced breeze, as rover.PBuoyancy. */
  function flow(g, Ppsia, fan) {
    const b = c.buoy, nat = b.u1g * g ** b.n * (c.Pref / (Ppsia * c.psia)) ** b.n_p;
    return ((fan || 0) ** b.m + nat ** b.m) ** (1 / b.m);
  }
  const num = (v, d) => (v === '' || v == null || !Number.isFinite(+v)) ? d : +v;
  function clean(spec) {
    const s = {...spec};
    for (const k of ['C', 'H', 'O', 'N']) s[k] = Math.max(0, num(s[k], 0));
    s.Tp = Math.min(1200, Math.max(400, num(s.Tp, 650)));
    s.eps = Math.min(1, Math.max(0.05, num(s.eps, 0.9)));
    s.kin = KINETICS[s.kin] ? s.kin : 'PMMA';
    s.Hc = s.Hc ? num(s.Hc, null) : null;
    return s;
  }
  function samePreset(s) {
    const p = PRESETS.find(q => q.lib && q.lib === s.lib);
    return !!p && ['C', 'H', 'O', 'N', 'Tp', 'eps'].every(k => Math.abs(p[k] - s[k]) < 1e-9) && !s.Hc && s.Ea == null && s.lnK == null;
  }
  /* Returns {spec, fuel, mat, status, test}. status: nasa | tested | borrowed | blend | invalid. */
  function build(raw) {
    const s = clean(raw), fuel = Th.fuelProps({C: s.C, H: s.H, O: s.O, N: s.N, Hc: s.Hc});
    if (!(s.C + s.H > 0) || !(fuel.nuO2 > 0) || !(fuel.Hc > 0)) return {spec: s, fuel, status: 'invalid', mat: null};
    const kin = KINETICS[s.kin];
    const Ea = s.Ea != null ? +s.Ea : kin.Ea;
    const nasa = samePreset(s);
    const tf = nasa ? lib[s.lib].tf.slice() : Th.tfTable({C: s.C, H: s.H, O: s.O, N: s.N, Hc: s.Hc}, s.Tp, c.xs);
    let lnK = s.lnK != null ? +s.lnK : (nasa ? lib[s.lib].lnK : kin.lnK);
    let status = nasa ? 'nasa' : (s.blend ? 'blend' : 'borrowed');
    const mat = {label: s.name || 'Custom material', lnK, Ea, Tp: s.Tp, eps: s.eps, tf};
    let test = null;
    if (s.test && Number.isFinite(+s.test.x) && +s.test.x > 0.03 && +s.test.x < 0.98) {
      const P = num(s.test.P, 8.2), u = flow(1, P, num(s.test.u, 0) / 100), x = +s.test.x;
      mat.lnK = Math.log(u) - c.nP * Math.log(P * c.psia / c.Pref) - Math.log(x) + Ea / (c.R * tfAt(mat, x));
      status = 'tested';
      test = {x, P, u};
    }
    return {spec: s, fuel, mat, status, test};
  }
  function register(key, built) {
    if (!built || !built.mat) return null;
    lib[key] = built.mat;
    if (built.test) {
      const r = S.solve(key, 1, built.test.P, Math.max(0, num(built.spec.test.u, 0)) / 100);
      built.test.reproduced = r.limit;
      built.test.quenchAbove = r.thermal > built.test.x + 1e-4;
    }
    return key;
  }
  function verdict(limit, cabinX) {
    if (!Number.isFinite(limit)) return 'nm';
    const m = cabinX - limit;
    return m > BAND ? 'burns' : (m < -BAND ? 'out' : 'close');
  }
  function predict(key, Ppsia, fan, cabinX) {
    return WORLDS.map(([id, name, g]) => {
      if (g === 0 && !(fan > 0)) return {id, name, g, limit: NaN, branch: 'not modelled', v: 'nm', u: 0};
      const r = S.solve(key, g, Ppsia, fan);
      return {id, name, g, limit: r.limit, branch: r.branch, v: verdict(r.limit, cabinX), u: r.velocity};
    });
  }
  function uCurve(key, Ppsia, n = 90, lo = 0.003, hi = 3) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = lo * (hi / lo) ** (i / (n - 1)), r = S.solve(key, 0, Ppsia, u);
      out.push({u, limit: r.limit, kinetic: r.kinetic, thermal: r.thermal});
    }
    return out;
  }
  /* Blend by mass: parts = [{spec, w}] with w fractions. Composition per 100 g of blend. */
  function blend(parts, name) {
    const ok = parts.filter(p => p.w > 0 && p.spec);
    const W = ok.reduce((a, p) => a + p.w, 0);
    if (!ok.length || !(W > 0)) return null;
    const el = {C: 0, H: 0, O: 0, N: 0};
    let Hc = 0, Tp = 0, eps = 0, Ea = 0, lnK = 0;
    for (const p of ok) {
      const w = p.w / W, b = build(p.spec);
      if (!b.mat) return null;
      for (const k of Object.keys(el)) el[k] += w * b.spec[k] * 100 / b.fuel.MW;
      Hc += w * b.fuel.Hc; Tp += w * b.spec.Tp; eps += w * b.spec.eps; Ea += w * b.mat.Ea; lnK += w * b.mat.lnK;
    }
    const r = v => Math.round(v * 1e4) / 1e4;
    return {name: name || ok.map(p => Math.round(100 * p.w / W) + '% ' + (p.spec.name || 'material')).join(' + '),
      C: r(el.C), H: r(el.H), O: r(el.O), N: r(el.N), Hc: Math.round(Hc), Tp: Math.round(Tp), eps: r(eps),
      Ea: Math.round(Ea), lnK: r(lnK), kin: 'PMMA', blend: ok.map(p => ({name: p.spec.name, w: r(p.w / W)})),
      use: 'blend by mass'};
  }
  function formula(s) {
    const f = (sym, n) => n > 0 ? sym + (Math.abs(n - 1) < 1e-9 ? '' : (+n.toFixed(2)).toString()) : '';
    return f('C', s.C) + f('H', s.H) + f('O', s.O) + f('N', s.N);
  }
  globalThis.FLINTCustom = {KINETICS, PRESETS, WORLDS, BAND, build, register, predict, uCurve, blend, flow, verdict, formula, tfAt};
  if (typeof module !== 'undefined') module.exports = globalThis.FLINTCustom;
})();
