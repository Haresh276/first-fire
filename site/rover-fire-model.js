/* Browser implementation of the rover and cabin_fire calculations in FLINT 1.1.
 * The fitted dry-solid limits are shared with the FLINT page. All thermochemical
 * data, model defaults and reference results come from export_rover_case.py. */
(() => {
  'use strict';
  const data = globalThis.RoverFireData;
  const {constants: c, simulation: sim, reference} = data;
  const defaultCabin = reference.rover;
  const validated = 'Validated at 8.2 psia';
  const extrapolated = 'Model extrapolation';

  function validity(cabin, fan = 0) {
    return cabin.P_psia === defaultCabin.P_psia && cabin.gravity === defaultCabin.gravity && fan === 0
      ? validated : extrapolated;
  }
  function limit(cabin, item, fan = 0, pressure = cabin.P_psia) {
    if (!(item.material in data.fuels) || cabin.gravity === 'orbit' && fan === 0)
      return {limit: NaN, branch: 'Not modelled'};
    return globalThis.FLINTSolid.solve(item.material, cabin.gravity, pressure, fan);
  }
  function assess(cabin, item) {
    const source = reference.items.find(row => row.material === item.material);
    const on = limit(cabin, item, cabin.fan_m_s);
    const off = limit(cabin, item);
    if (source && cabin.P_psia === defaultCabin.P_psia && cabin.gravity === defaultCabin.gravity) {
      off.limit = source.loc_fans_off;
      off.branch = source.branch_fans_off;
      if (cabin.fan_m_s === defaultCabin.fan_m_s) on.limit = source.loc_fans_on;
    }
    return [on, off].map(row => ({
      ...row, margin: (cabin.X_O2 - row.limit) * 100,
      burns: Number.isFinite(row.limit) ? cabin.X_O2 > row.limit : null
    }));
  }
  function trade(cabin, inventory) {
    return reference.trade.map(preset => {
      const conditions = {...cabin, P_psia:preset.P_psia, X_O2:preset.X_O2};
      const rows = inventory.map(item => {
        if (cabin.gravity === defaultCabin.gravity && Object.hasOwn(preset.margins,item.material)) {
          const margin = preset.margins[item.material];
          return {margin, burns:margin>0};
        }
        return assess(conditions,item)[1];
      });
      const modelled = rows.filter(row => row.burns !== null);
      return {...preset, conditions, rows, count:modelled.filter(row => row.burns).length,
              modelled:modelled.length};
    });
  }
  // JANAF enthalpy and its derivative using the exact SciPy PCHIP coefficients.
  function gasProperty(species, T, derivative = false) {
    let i = data.knots.length-2;
    while (i > 0 && T < data.knots[i]) i--;
    const dT = T - data.knots[i];
    const [a,b,d,e] = data.enthalpy[species][i];
    return derivative ? (3*a*dT + 2*b)*dT+d : ((a*dT+b)*dT+d)*dT+e;
  }
  function bisect(residual, lo, hi) {
    const sign = Math.sign(residual(lo));
    if (sign === 0) return lo;
    if (sign === Math.sign(residual(hi))) return NaN;
    for (let n = 0; n < 55; n++) {
      const mid = (lo+hi)/2;
      if (Math.sign(residual(mid)) === sign) lo = mid;
      else hi = mid;
    }
    return (lo+hi)/2;
  }
  function equivalentOxygen(fuel, oxygen, dioxide) {
    if (dioxide === 0) return oxygen;
    const ambient = fuel.oxygen / oxygen;
    const energy = fuel.mw/1000 * (fuel.heat+fuel.cp*(fuel.pyrolysis-c.ambient));
    const products = fuel.products;
    const base = T => Object.entries(products).reduce((sum,[k,mol]) => sum+mol*gasProperty(k,T), 0);
    const balance = T => base(T) + ambient * (
      dioxide*gasProperty('CO2',T) + (1-oxygen-dioxide)*gasProperty('N2',T)
    ) - energy;
    const temperature = bisect(balance, c.ambient, 9000); // thermo.flame_temperature bracket
    // Dry air supplies N2 + stoichiometric O2. Equate its product enthalpy at the
    // same flame temperature; the dilution term is linear in moles of nitrogen.
    const nitrogen = (energy-base(temperature))/gasProperty('N2',temperature);
    return fuel.oxygen/(fuel.oxygen+nitrogen);
  }
  function floodDose(cabin, item, agent) {
    if (!Number.isFinite(limit(cabin, item).limit)) return null;
    const initial = cabin.P_psia*c.psia*cabin.volume_m3/(c.gas*c.ambient);
    function state(added) {
      const total = initial+added;
      const oxygen = initial*cabin.X_O2/total;
      const dioxide = agent === 'CO2' ? added/total : 0;
      const pressure = cabin.P_psia*total/initial;
      return {pressure, oxygen, dioxide, pO2:pressure*c.psia*oxygen/1000};
    }
    function gap(added) {
      const a = state(added);
      return equivalentOxygen(data.fuels[item.material],a.oxygen,a.dioxide)
          - (limit(cabin,item,0,a.pressure).limit-c.margin);
    }
    if (gap(0) <= 0) return {needed:false, kg:0};
    let hi = initial*0.05;
    while (gap(hi)>0 && hi<initial*50) hi*=2; // rover.flood_dose bracket
    const added = bisect(gap,0,hi);
    if (!Number.isFinite(added) || Math.abs(gap(added))>1e-4) return null;
    const a = state(added);
    return {needed:true, kg:added*c.mw[agent]/1000, final_P_psia:a.pressure,
            final_O2:a.oxygen, final_CO2:a.dioxide, pO2_kPa:a.pO2,
            crew_must_mask: agent === 'CO2' ? a.dioxide>c.co2_mask : a.pO2<c.hypoxia};
  }
  function ventPressure(cabin,item) {
    if (!Number.isFinite(limit(cabin,item).limit)) return null;
    function residual(pressure) {
      const L = limit(cabin,item,0,pressure).limit;
      return Number.isFinite(L) ? L-c.margin-cabin.X_O2 : 1;
    }
    if (residual(cabin.P_psia)>=0) return {needed:false,P_psia:cabin.P_psia};
    const pressure = bisect(residual,0.2,cabin.P_psia); // rover.vent_pressure lower bound
    if (!Number.isFinite(pressure)) return null;
    const pO2 = pressure*c.psia*cabin.X_O2/1000;
    return {needed:true,P_psia:pressure,pO2_kPa:pO2,crew_must_be_suited:pO2<c.hypoxia};
  }
  function isReference(cabin,item) {
    const it = data.inventory.find(i=>i.material===item.material);
    return it && it.area_m2===item.area_m2 && it.areal_density===item.areal_density &&
      ['gravity','P_psia','X_O2','volume_m3'].every(k=>cabin[k]===defaultCabin[k]);
  }
  function responses(cabin,item) {
    if (isReference(cabin,item)) return reference.responses.find(r=>r.material===item.material);
    return {co2:floodDose(cabin,item,'CO2'),n2:floodDose(cabin,item,'N2'),vent:ventPressure(cabin,item)};
  }
  // chamber.cabin_fire: well-mixed sealed cabin and a half-elliptical burning panel.
  // Its limit and all response thresholds use fans OFF, even if the comparison fan is on.
  function timeline(cabin,item) {
    const L = assess(cabin,item)[1].limit;
    if (!Number.isFinite(L)) return null;
    const fuel = data.fuels[item.material];
    const {dt} = sim;
    const V = cabin.volume_m3, P0 = cabin.P_psia*c.psia, side = Math.sqrt(item.area_m2);
    const n0 = P0*V/(c.gas*c.ambient), wallArea = 6*V**(2/3);
    const mol = {O2:n0*cabin.X_O2, N2:n0*(1-cabin.X_O2), CO2:0, H2O:0};
    const total = () => mol.O2+mol.N2+mol.CO2+mol.H2O;
    const patches=[], trace=[];
    let T = c.ambient, height=0, width=0, previousArea=0;
    const summary = {t_hrr_1kW_s:null,t_hrr_10kW_s:null,t_CO2_1pct_s:null,t_dT_10K_s:null,
                     peak_hrr_kW:0,peak_T_rise_K:0,peak_dP_kPa:0};
    for (let t=0;t<sim.t_max;t+=dt) {
      const f = Math.max(0,(mol.O2/total()-L)/sim.excess_ref);
      const speed = sim.v_up_ref*f;
      height = Math.min(height+speed*dt,side);
      width = Math.min(width+sim.v_lat_ratio*speed*dt,side/2);
      const area = Math.PI/2*height*width, increment = area-previousArea;
      if (increment>0) patches.push({mass:item.areal_density*increment,area:increment});
      previousArea=area;
      let burned=0;
      for (const patch of patches) {
        if (patch.mass<=0) continue;
        const amount=Math.min(patch.mass,sim.m_flux_ref*f*patch.area*dt);
        burned+=amount; patch.mass-=amount;
      }
      const fuelMoles=burned/(fuel.mw/1000);
      mol.O2-=fuelMoles*fuel.oxygen;
      for (const [key,amount] of Object.entries(fuel.products)) mol[key]+=fuelMoles*amount;
      const cv=Object.entries(mol).reduce((v,[key,m])=>v+m*(gasProperty(key,T,true)-c.gas),0);
      const watts=burned*fuel.heat/dt;
      T+=dt*((1-sim.chi_r)*watts-sim.h_wall*wallArea*(T-c.ambient))/cv;
      const nt=total(), P=nt*c.gas*T/V;
      const row={t,heat:watts/1000,co2:100*mol.CO2/nt,temperature:T,pressure:P/c.psia};
      trace.push(row);
      if (row.heat>=1 && summary.t_hrr_1kW_s===null) summary.t_hrr_1kW_s=t;
      if (row.heat>=10 && summary.t_hrr_10kW_s===null) summary.t_hrr_10kW_s=t;
      if (row.co2>=1 && summary.t_CO2_1pct_s===null) summary.t_CO2_1pct_s=t;
      if (T-c.ambient>=10 && summary.t_dT_10K_s===null) summary.t_dT_10K_s=t;
      summary.peak_hrr_kW=Math.max(summary.peak_hrr_kW,row.heat);
      summary.peak_T_rise_K=Math.max(summary.peak_T_rise_K,T-c.ambient);
      summary.peak_dP_kPa=Math.max(summary.peak_dP_kPa,(P-P0)/1000);
    }
    summary.final_O2=mol.O2/total(); summary.final_CO2=mol.CO2/total();
    return {trace,summary};
  }
  globalThis.RoverFireModel={validity,validated,extrapolated,assess,trade,limit,floodDose,
                             ventPressure,responses,timeline,isReference};
})();
