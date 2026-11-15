// Pure calculations. No navigation, persistence, simulator adapter or network access.
const R = 8.31446261815324;
const SIGMA = 5.670374419e-8;
const gravity = { Moon: 1.62, Mars: 3.71, Earth: 9.80665, Orbit: 0 };
// Engineering cases, not site weather. The exterior K is a longwave radiant sink.
const environments = {
  Moon: { outsideKPa: 0, sunWm2: 900, day: 245, night: 100 },
  Mars: { outsideKPa: 0.636, sunWm2: 450, day: 235, night: 185 },
  Earth: { outsideKPa: 101.325, sunWm2: 700, day: 295, night: 275 },
  Orbit: { outsideKPa: 0, sunWm2: 1361, day: 225, night: 180 }
};
const crewRates = {sleep: [0.37, 0.44], nominal: [0.59, 0.69], aerobic: [3.99, 5.22]};
const fuels = {
  cellulose: { massGmol: 162.141, oxygenMol: 6, netKJg: 15.2 },
  polyethylene: { massGmol: 14.027, oxygenMol: 1.5, netKJg: 43.4 }
};

export function setEnvironment(s, world, phase) {
  if (!Object.hasOwn(environments, world) || !['day','night'].includes(phase)) throw RangeError('Unknown environment');
  const env = environments[world];
  return {...s, conditions: {...s.conditions, world, phase, outsideKPa: env.outsideKPa,
    sunWm2: env.sunWm2, sinkK: env[phase]}};
}

export function selectPart(s, slot, id, catalog) {
  const part = catalog.parts.find(p => p.slot === slot && p.id === id);
  if (!part) throw RangeError('Unknown part for ' + slot);
  return {...s, parts: {...s.parts, [slot]: id}, conditions: {...s.conditions, ...part.assumedSettings}};
}

// The schema is intentionally limited to the object, enum, range and string rules used here.
function validate(value, rule, path) {
  if (Object.hasOwn(rule,'const') && value !== rule.const) throw RangeError(path + ' has an unsupported version');
  if (rule.enum && !rule.enum.includes(value)) throw RangeError(path + ' has an unknown choice');
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw TypeError(path + ' must be an object');
    for (const key of rule.required) {
      if (!Object.hasOwn(value,key)) throw RangeError(path + '.' + key + ' is missing');
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(rule.properties, key)) throw RangeError(path + '.' + key + ' is unknown');
      validate(value[key], rule.properties[key], path + '.' + key);
    }
  }
  if (rule.type === 'string' && (typeof value !== 'string' || value.length < (rule.minLength ?? 0) || value.length > (rule.maxLength ?? Infinity))) throw RangeError(path + ' is invalid');
  if (['number','integer'].includes(rule.type) && (!Number.isFinite(value) || value < rule.minimum || value > rule.maximum || (rule.type === 'integer' && !Number.isInteger(value)))) {
    throw RangeError(path + ' must be ' + rule.type + ' in [' + rule.minimum + ', ' + rule.maximum + '] ' + rule.unit);
  }
}

function mobility(c) {
  const massKg = c.chassisKg + c.hardwareKg + c.payloadKg + c.crew*c.personKg;
  const g = gravity[c.world];
  const hasGround = c.world !== 'Orbit';
  const norm = c.imuMode === 'no reading' ? null : Math.hypot(c.accelX, c.accelY, c.accelZ);
  const comparable = hasGround && c.imuMode === 'stationary supported';
  return {massKg, idealSupportAccelerationMs2: g, staticSupportN: massKg*g,
    staticLoadPerWheelN: hasGround ? massKg*g/c.wheels : null, specificForceNormMs2: norm,
    stationaryNormAgrees: comparable ? Math.abs(norm-g) <= c.imuTolerance : null};
}

function electrical(c, kinds, sun) {
  const pvW = kinds.power === 'solar' ? sun*c.panelM2*c.pvEff : 0;
  const initialWh = c.capacityWh*c.startPct/100;
  const balanceWh = initialWh + (pvW-c.loadW)*c.hours;
  return {generationW: pvW, demandWh: c.loadW*c.hours, endWh: Math.max(0,Math.min(c.capacityWh,balanceWh)),
    unmetWh: Math.max(0,-balanceWh), curtailedWh: Math.max(0,balanceWh-c.capacityWh)};
}

function thermal(c, sun) {
  const emittedNetW = c.emissivity*SIGMA*c.radiatorM2*(c.skinK**4-c.sinkK**4);
  const absorbedSunW = c.absorptivity*c.projectedM2*sun;
  return {netLongwaveOutW: emittedNetW, absorbedSunW, rejectedMinusLoadW: emittedNetW-absorbedSunW-c.internalW};
}

function atmosphere(c, kinds) {
  const inventoryMol = c.pressureKPa*1000*c.volumeM3/(R*c.gasK);
  const x = c.oxygenPct/100;
  const dp = c.pressureKPa-c.outsideKPa;
  const [o2,co2] = crewRates[c.activity];
  const metabolicO2G = c.crew*c.hours*60*o2;
  const metabolicCO2G = c.crew*c.hours*60*co2;
  const scrubbedG = kinds.lifeSupport === 'scrubber' ? Math.min(metabolicCO2G,c.scrubGhr*c.hours) : 0;
  const outward = dp >= 0;
  const leakMol = outward ? c.leakMolHrKPa*dp*c.hours : null;
  const accessMol = outward ? dp*1000*c.lockM3*c.cycles*(1-c.recovery)/(R*c.gasK) : null;
  const mixtureLossMol = outward ? leakMol+accessMol : null;
  return {inventoryMol, initialO2Mol: inventoryMol*x, initialO2KPa: c.pressureKPa*x,
    metabolicO2G, metabolicCO2G, scrubbedCO2G: scrubbedG, unremovedCO2G: metabolicCO2G-scrubbedG,
    outwardLeakMol: leakMol, accessLossMol: accessMol, replacementMixtureMol: mixtureLossMol,
    oxygenSupplyG: outward ? metabolicO2G + mixtureLossMol*x*31.998 : null,
    nitrogenSupplyG: outward ? mixtureLossMol*(1-x)*28.014 : null};
}

function coupon(c, fuel, air) {
  if (!Object.hasOwn(fuels,fuel)) return null;
  const f = fuels[fuel];
  const requestedO2Mol = c.reactedG*f.oxygenMol/f.massGmol;
  return {prescribedG: c.reactedG, stoichiometricO2Mol: requestedO2Mol,
    netChemicalPotentialKJ: c.reactedG*f.netKJg, inventoryCoversDemand: requestedO2Mol <= air.initialO2Mol};
}

// Exact closed, two equal well-mixed volumes with symmetric exchange after an impulse.
// Detector is an ideal threshold plus pure delay. Concentrations refer to passive tracer.
function tracer(c, kinds) {
  const mean = c.pulseMg/c.volumeM3;
  const rate = 4*c.exchangeLs/1000/c.volumeM3;
  const decay = Math.exp(-rate*c.windowS);
  const sourceMgM3 = mean*(1+decay);
  const remoteMgM3 = mean*(1-decay);
  const colocated = c.ignition === c.sensor;
  let crossingS = null;
  if (colocated && 2*mean >= c.thresholdMgM3) crossingS = 0;
  if (!colocated && rate > 0 && c.thresholdMgM3 < mean) crossingS = -Math.log1p(-c.thresholdMgM3/mean)/rate;
  const arrival = crossingS === null ? null : crossingS+c.delayS;
  const alarmS = kinds.detection !== 'none' && arrival !== null && arrival <= c.windowS ? arrival : null;
  return {sourceMgM3, remoteMgM3, atSamplingZoneMgM3: colocated ? sourceMgM3 : remoteMgM3,
    tracerAccountedMg: (sourceMgM3+remoteMgM3)*c.volumeM3/2, thresholdTimeWithDelayS: alarmS};
}

function localFlow(c) {
  const ductSpeedMs=c.exchangeLs/(1000*c.sectionM2);
  let relativeDirection='no forced flow';
  if (ductSpeedMs>0) relativeDirection=c.fanFrom===c.igniteAt ? 'concurrent' : 'opposed';
  return {ductSpeedMs,relativeDirection,spreadRateMmS:null};
}

function discharge(c, kind) {
  const stock = kind === 'none' ? 0 : c.agentKg;
  const deliveredKg = Math.min(stock,c.agentGps*c.dischargeS/1000);
  return {deliveredKg, remainingKg: stock-deliveredKg, extinction: null};
}

function stockBudget(c, material) {
  const feedG = c.reactedG/(c.yieldPct/100);
  const vendorAnalogue = c.stockOrigin === 'Earth supplier' && Object.hasOwn(fuels,material);
  return {origin:c.stockOrigin, netG:c.reactedG, feedG, trimG:feedG-c.reactedG, thicknessMm:c.thicknessMm,
    evidenceStatus:vendorAnalogue ? 'vendor analogue only' : 'unverified source or process',
    traceability:c.lotId.trim() ? 'user-entered lot: '+c.lotId.trim() : 'lot unknown',
    qualification:null};
}

export function simulate(s, catalog, schema) {
  validate(s,schema,'scenario');
  const c=s.conditions;
  if (['Moon','Orbit'].includes(c.world) && c.outsideKPa !== 0) throw RangeError('Moon and Orbit require a vacuum exterior in this model');
  if (c.projectedM2 > c.radiatorM2) throw RangeError('Sun-facing radiator area exceeds its emitting area');
  const kinds={}, sourceIds=new Set();
  for (const [slot,id] of Object.entries(s.parts)) {
    const p=catalog.parts.find(row=>row.slot===slot && row.id===id);
    if (!p) throw RangeError('Part catalogue has no ' + slot + '/' + id);
    kinds[slot]=p.kind;
    for (const source of p.sourceIds) sourceIds.add(source);
  }
  const sun=c.phase==='day' ? c.sunWm2 : 0;
  const closed=kinds.cabin==='sealed';
  sourceIds.add('thermal-method');
  sourceIds.add('materials-method');
  const environmentSource={Moon:'moon-env',Mars:'mars-env',Orbit:'orbit-env'}[c.world];
  if (environmentSource) sourceIds.add(environmentSource);
  if (closed) {
    for (const id of ['crew-method','access-method','fire-method','psi-saffire','flow-measurement']) sourceIds.add(id);
  }
  const air=closed ? atmosphere(c,kinds) : null;
  const power=electrical(c,kinds,sun);
  const notes=['Independent sizing cases. All hybrid interfaces are unverified.'];
  if (!closed) notes.push('Open deck. Crew suits need separate gas and protection budgets.');
  if (closed && c.pressureKPa<c.outsideKPa) notes.push('External ingress is outside the loss model. Gas replacement totals are unavailable.');
  if (c.world==='Orbit') notes.push('Ideal orbital free fall. Wheel contact loads do not apply.');
  if (kinds.material==='unknown') notes.push('Material composition and net heat are unknown.');
  if (power.unmetWh>0) notes.push('Electricity shortfall. Requested powered functions require a separate resource allocation.');
  return {version:'1.0', name:s.name, resultClass:'simulation', compatibility:'unverified',
    sourceIds:[...sourceIds], mobility:mobility(c),power,thermal:thermal(c,sun),air,
    coupon:closed ? coupon(c,kinds.material,air) : null, tracer:closed ? tracer(c,kinds) : null,
    flow:closed ? localFlow(c) : null,
    suppression:discharge(c,kinds.suppression), sourcing:stockBudget(c,kinds.material), notes};
}
