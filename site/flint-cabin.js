/* FLINT 1.1 cabin fire in the browser: a port of flint/chamber.cabin_fire and the rover
   responses in flint/rover.py (fans off, CO2 or N2 flood, venting).
   A panel is lit at its bottom centre; the flame front grows as a half-ellipse and every patch it
   reaches burns until its fuel is gone. Spread rate and burning flux are assumed inputs that scale
   with the oxygen in excess of the limit. With sealed-cabin chemistry on (the default), the flame
   feels the cabin's CO2 and steam through its flame temperature (flame-equivalent oxygen) and the
   limit is recomputed as the cabin pressure changes. With it off, the model is FLINT 1.1's rover
   case exactly: a fixed limit and dry oxygen. */
(() => {
  'use strict';
  const c = globalThis.FLINTCoefficients, Th = globalThis.FLINTThermo, S = globalThis.FLINTSolid;
  const R = c.R, T0 = 298.15, PSIA = c.psia;
  const MW = {O2: 31.998, N2: 28.014, CO2: 44.009, H2O: 18.015};
  const CREW = {co2: 0.04, pO2kPa: 16.0};            // as flint/rover.py
  const SPECIES = ['O2', 'N2', 'CO2', 'H2O'];

  /* Oxygen fraction of dry O2/N2 that gives this material the same flame temperature. */
  function eqO2(key, fuel, x, xC, xH) {
    if (xC + xH < 1e-7) return x;
    const m = c.materials[key];
    const T = Th.flameTemperature(fuel, {O2: x, CO2: xC, H2O: xH}, m.Tp);
    const tf = m.tf, xs = c.xs;
    if (T <= tf[0]) return xs[0];
    if (T >= tf[tf.length - 1]) return xs[xs.length - 1];
    let lo = 0, hi = tf.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tf[mid] < T) lo = mid; else hi = mid; }
    return xs[lo] + (T - tf[lo]) / (tf[hi] - tf[lo]) * (xs[hi] - xs[lo]);
  }
  const cvOf = (mol, T) => SPECIES.reduce((s, k) => s + mol[k] * (Th.cp(k, T) - R), 0);
  const total = mol => SPECIES.reduce((s, k) => s + mol[k], 0);

  /* o: {key, fuel{C,H,O,N,Hc}, areal kg/m2, area m2, V m3, P_psia, X0, g, fan m/s, fanOff s|null,
         chem bool, flood {agent, kg, at}|null, vent {to psia, at s, tau s}|null, ...model constants} */
  function simulate(o) {
    const key = o.key, fuel = o.fuel, fp = Th.fuelProps(fuel), Q = fp.Hc;
    const V = o.V, P0 = o.P_psia * PSIA, X0 = o.X0, g = o.g;
    const dt = o.dt ?? 0.5, tMax = o.tMax ?? 900, vUp = o.vUp ?? 3e-3, vLat = o.vLat ?? 0.3;
    const exRef = o.excessRef ?? 0.06, mRef = o.mFluxRef ?? 0.010, hWall = o.hWall ?? 5;
    const Awall = o.Awall ?? 6 * V ** (2 / 3), chiR = o.chiR ?? 0.3, chem = o.chem !== false;
    const side = Math.sqrt(o.area), pw = o.panelW ?? side, ph = o.panelH ?? side;
    const n0 = P0 * V / (R * T0);
    const mol = {O2: n0 * X0, N2: n0 * (1 - X0), CO2: 0, H2O: 0};
    const fanAt = t => (o.fan > 0 && (o.fanOff == null || t < o.fanOff)) ? o.fan : 0;
    const cache = new Map();
    const limitAt = (Ppsia, fan) => {
      const k = (chem ? Ppsia.toFixed(3) : 'P0') + '|' + fan;
      if (!cache.has(k)) cache.set(k, S.solve(key, g, chem ? Ppsia : o.P_psia, fan).limit);
      return cache.get(k);
    };
    let a = 0, b = 0, T = T0, t = 0, areaPrev = 0, burned = 0, out = false, floodDone = false;
    const patches = [];
    const r = {t: [], hrr: [], O2: [], CO2: [], H2O: [], T: [], P: [], Pcold: [], xeq: [], L: [], a: [], b: [], burnt: [], pO2: []};
    const ev = [];
    let notModelled = false;
    while (t < tMax) {
      if (o.flood && !floodDone && t >= o.flood.at && o.flood.kg > 0) {
        const n = o.flood.kg * 1000 / MW[o.flood.agent], cvOld = cvOf(mol, T);
        mol[o.flood.agent] += n;
        T = T0 + cvOld * (T - T0) / (cvOld + n * (Th.cp(o.flood.agent, T0) - R));
        floodDone = true;
        ev.push({t, kind: 'flood', text: o.flood.kg.toFixed(1) + ' kg of ' + o.flood.agent + ' released'});
      }
      if (o.vent && t >= o.vent.at) {
        const nt = total(mol), nTarget = o.vent.to * PSIA * V / (R * T0);
        if (nt > nTarget) {
          const frac = Math.min(dt / o.vent.tau, 1) * (1 - nTarget / nt);
          for (const k of SPECIES) mol[k] *= 1 - frac;
        }
      }
      let nt = total(mol);
      const x = mol.O2 / nt, xC = mol.CO2 / nt, xH = mol.H2O / nt;
      const fan = fanAt(t), Pc = nt * R * T0 / V / PSIA;
      const L = limitAt(Pc, fan);
      if (!Number.isFinite(L)) { notModelled = true; ev.push({t, kind: 'nm', text: 'outside the model: no flow at all'}); break; }
      const xe = chem ? eqO2(key, fuel, x, xC, xH) : x;
      if (!out && burned > 0 && xe <= L) { out = true; ev.push({t, kind: 'out', text: 'flame out: oxygen at its limit'}); }
      const f = out ? 0 : Math.max((xe - L) / exRef, 0);
      const v = vUp * f;
      a = Math.min(a + v * dt, ph);
      b = Math.min(b + vLat * v * dt, pw / 2);
      const area = 0.5 * Math.PI * a * b, dA = Math.max(area - areaPrev, 0);
      areaPrev = area;
      if (dA > 0) patches.push([o.areal * dA, dA]);
      let burn = 0, burnt = 0;
      const flux = mRef * f;
      for (const p of patches) {
        if (p[0] > 0) { const m = Math.min(p[0], flux * p[1] * dt); p[0] -= m; burn += m; }
        if (p[0] <= 1e-12) burnt += p[1];
      }
      burned += burn;
      const nf = burn / (fp.MW / 1000);
      mol.O2 -= fp.nuO2 * nf; mol.CO2 += fp.C * nf; mol.H2O += fp.H / 2 * nf; mol.N2 += fp.N / 2 * nf;
      const cv = cvOf(mol, T), hrr = burn * Q / dt;
      T += dt * ((1 - chiR) * hrr - hWall * Awall * (T - T0)) / cv;
      nt = total(mol);
      const P = nt * R * T / V;
      r.t.push(t); r.hrr.push(hrr); r.O2.push(mol.O2 / nt); r.CO2.push(mol.CO2 / nt); r.H2O.push(mol.H2O / nt);
      r.T.push(T); r.P.push(P); r.Pcold.push(nt * R * T0 / V); r.xeq.push(xe); r.L.push(L); r.a.push(a); r.b.push(b);
      r.burnt.push(burnt); r.pO2.push(P * mol.O2 / nt);
      t += dt;
    }
    const n = r.t.length, first = test => { for (let i = 0; i < n; i++) if (test(i)) return r.t[i]; return null; };
    const peak = Math.max(0, ...r.hrr), iPeak = r.hrr.indexOf(peak);
    const fuelMax = o.areal * Math.PI / 4 * pw * ph;
    let tOut = null;
    for (let i = Math.max(iPeak, 0); i < n; i++) if (r.hrr[i] < 0.01 * peak) { tOut = r.t[i]; break; }
    const outReason = notModelled ? 'nm' : !(peak > 0.5) ? 'nospread' : tOut == null ? 'burning' :
      (burned >= 0.99 * fuelMax ? 'fuel' : 'oxygen');
    if (outReason === 'nospread') tOut = 0;
    const summary = {
      t_hrr_1kW_s: first(i => r.hrr[i] >= 1e3), t_hrr_10kW_s: first(i => r.hrr[i] >= 1e4),
      t_CO2_1pct_s: first(i => r.CO2[i] >= 0.01), t_dT_10K_s: first(i => r.T[i] - T0 >= 10),
      t_mask_s: first(i => r.CO2[i] >= CREW.co2), t_hypoxia_s: first(i => r.pO2[i] / 1000 < CREW.pO2kPa),
      peak_hrr_kW: peak / 1e3, final_O2: n ? r.O2[n - 1] : X0, final_CO2: n ? r.CO2[n - 1] : 0,
      peak_T_rise_K: n ? Math.max(...r.T) - T0 : 0, peak_dP_kPa: n ? (Math.max(...r.P) - P0) / 1e3 : 0,
      final_P_psia: n ? r.Pcold[n - 1] / PSIA : o.P_psia, burned_kg: burned, fuel_kg: fuelMax,
      t_out_s: tOut, out_reason: outReason, limit_start: n ? r.L[0] : NaN, events: ev,
    };
    return {...r, summary, fuelMax, panel: {w: pw, h: ph}};
  }

  const cabinMoles = cab => cab.P_psia * PSIA * cab.V / (R * T0);
  /* Agent (kg) to add, at fixed volume and without the fire's own products, until the item's
     flame-equivalent oxygen is `margin` below its limit (flint/rover.flood_dose). */
  function floodDose(key, fuel, cab, agent = 'CO2', margin = 0.01, fan = 0) {
    const n0 = cabinMoles(cab), nO2 = n0 * cab.X0;
    const state = nAdd => {
      const nt = n0 + nAdd, P = cab.P_psia * PSIA * nt / n0;
      return {P, x: nO2 / nt, xC: agent === 'CO2' ? nAdd / nt : 0};
    };
    const gap = nAdd => {
      const s = state(nAdd), L = S.solve(key, cab.g, s.P / PSIA, fan).limit;
      if (!Number.isFinite(L)) return NaN;
      const xe = agent === 'CO2' ? eqO2(key, fuel, s.x, s.xC, 0) : s.x;
      return xe - (L - margin);
    };
    const g0 = gap(0);
    if (!Number.isFinite(g0)) return {agent, needed: null, kg: NaN};
    if (g0 <= 0) return {agent, needed: false, kg: 0};
    let hi = n0 * 0.05;
    while (gap(hi) > 0 && hi < n0 * 50) hi *= 2;
    if (gap(hi) > 0) return {agent, needed: true, kg: Infinity};
    let lo = 0;
    for (let i = 0; i < 80 && hi - lo > 1e-9 * n0; i++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) lo = mid; else hi = mid; }
    const nAdd = (lo + hi) / 2, s = state(nAdd), pO2kPa = s.P * s.x / 1000;
    return {agent, needed: true, kg: nAdd * MW[agent] / 1000, final_P_psia: s.P / PSIA, final_O2: s.x, final_CO2: s.xC,
      pO2kPa, crew_must_mask: agent === 'CO2' ? s.xC > CREW.co2 : pO2kPa < CREW.pO2kPa};
  }
  /* Cabin pressure to vent to, at constant composition, before the item's limit rises above the
     cabin oxygen (flint/rover.vent_pressure). An extrapolation below 8.2 psia. */
  function ventPressure(key, cab, margin = 0.01, fan = 0) {
    const gap = Pp => { const L = S.solve(key, cab.g, Pp, fan).limit; return Number.isFinite(L) ? (L - margin) - cab.X0 : 1; };
    if (gap(cab.P_psia) >= 0) return {needed: false, P_psia: cab.P_psia};
    let lo = 0.2, hi = cab.P_psia;
    if (gap(lo) < 0) return {needed: true, P_psia: null};
    for (let i = 0; i < 80 && hi - lo > 1e-6; i++) { const mid = (lo + hi) / 2; if (gap(mid) >= 0) lo = mid; else hi = mid; }
    const P = (lo + hi) / 2, pO2kPa = P * PSIA * cab.X0 / 1000;
    return {needed: true, P_psia: P, pO2kPa, crew_must_be_suited: pO2kPa < CREW.pO2kPa};
  }
  globalThis.FLINTCabin = {simulate, floodDose, ventPressure, eqO2, CREW, MW};
  if (typeof module !== 'undefined') module.exports = globalThis.FLINTCabin;
})();
