/* Connect the rover's gas volume, material and airflow to a prescribed-front cabin trial. */
(() => {
  'use strict';
  const inNode = typeof module === 'object' && !!module.exports;
  const physics = inNode ? require('./physics-lab.js') : globalThis.FFPhysics;
  const defaults = Object.freeze({
    material: 'cellulose', flow: 'concurrent', cabin: 'sealed', oxygen: 30,
    world: 'Moon', time: 50, volume: 16, speedMmS: null, couponMassG: 10
  });
  const partId = {cellulose: 'cellulose', polyethylene: 'pe', unknown: 'unknown'};
  const airflowRows = {
    concurrent: {id: 'PSI-98:1:2', sample: 'S1', row: 2, oxygen: '21.5–21.7%', duration: 420},
    opposed: {id: 'PSI-98:1:3', sample: 'S2', row: 3, oxygen: 'about 21.5%', duration: 70}
  };
  const boundary = 'Ignition, sustained spread and flight qualification need separate measurements.';
  const fields = Object.keys(defaults);

  function settingsFor(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw TypeError('Expected trial settings.');
    for (const key of Object.keys(input)) {
      if (!Object.hasOwn(defaults, key)) throw RangeError('Unknown trial setting: ' + key);
    }
    const settings = {...defaults, ...input};
    const choices = {material: Object.keys(partId), flow: Object.keys(airflowRows), cabin: ['sealed', 'open'], world: ['Moon', 'Mars']};
    for (const [key, options] of Object.entries(choices)) {
      if (!options.includes(settings[key])) throw RangeError('Choose a supported ' + key + '.');
    }
    const ranges = {volume: physics.ranges.volume, oxygen: physics.ranges.oxygen, time: [0, physics.horizon],
      couponMassG: [physics.ranges.density[0] * physics.defaults.length, 50]};
    if (settings.speedMmS !== null) ranges.speedMmS = physics.ranges.speed.map(value => 10 * value);
    for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
      const value = settings[key];
      if (!Number.isFinite(value) || value < minimum || value > maximum) {
        throw RangeError(key + ' must be a number from ' + minimum + ' to ' + maximum + '.');
      }
    }
    if (!Number.isInteger(settings.time)) throw RangeError('Use a whole number of seconds.');
    return settings;
  }

  function roverFor(settings, data, rover) {
    const base = data.examples['lunar-cellulose'];
    let scenario = rover.setEnvironment(base, settings.world, 'day');
    scenario = rover.selectPart(scenario, 'cabin', settings.cabin === 'sealed' ? 'mobile-hab' : 'open-deck', data.catalog);
    scenario = rover.selectPart(scenario, 'material', partId[settings.material], data.catalog);
    // FFPhysics uses a fixed 300 K. Match this in the rover before solving the shared gas inventory.
    return {...scenario, name: 'FIRST FIRE | ' + settings.world + ' cabin experiment', conditions: {
      ...scenario.conditions, volumeM3: settings.volume, oxygenPct: settings.oxygen, gasK: 300, reactedG: settings.couponMassG,
      fanFrom: settings.flow === 'concurrent' ? 'end A' : 'end B', igniteAt: 'end A'
    }};
  }

  function source(data, id) {
    const item = data.sources.find(row => row.id === id);
    if (!item) throw Error('Missing rover source: ' + id);
    return {id: item.id, title: item.title, url: item.url, locator: item.locator, boundary: item.limits};
  }

  function measuredRate(data, direction) {
    const row = airflowRows[direction];
    const table = source(data, 'psi-saffire');
    const report = source(data, 'flow-measurement');
    const speedMmS = physics.saffireSpeeds[direction];
    return {
      speedMmS, kind: 'orbital-analogue', sourceRow: row.id, observedDurationS: row.duration,
      sources: [
        {...table, id: row.id, title: 'Saffire-I ' + row.sample + ' · ' + direction + ' flow',
          locator: 'Original CSV row ' + row.row + ' · SIBAL fabric · 20 cm/s air · ' + row.oxygen + ' O₂ · ' + row.duration + ' s',
          localUrl: 'data/raw/PSI-98-experimental.csv', atlasUrl: 'index.html#atlas?record=' + encodeURIComponent(row.id),
          boundary: 'S2 used the material remaining after S1. The CSV records the conditions of each burn.'},
        {...report, url: report.url + '#page=21', locator: 'Slide 21 and Table I on PDF page 29 · ' + speedMmS + ' mm/s in microgravity',
          boundary: 'The reported front speed supplies a prescribed input to this trial.'}
      ]
    };
  }

  function traceTo(inputs, time) {
    const trace = [];
    for (let second = 0; second < time; second += physics.interval) trace.push(physics.atTime(inputs, second));
    trace.push(physics.atTime(inputs, time));
    return trace;
  }

  function run(input = {}) {
    const settings = settingsFor(input);
    const data = globalThis.FFRoverData;
    const rover = globalThis.FFRoverModel;
    const scenario = roverFor(settings, data, rover);
    const result = rover.simulate(scenario, data.catalog, data.schema);
    const surface = source(data, settings.world === 'Moon' ? 'moon-env' : 'mars-env');
    const metrics = {
      positionCm: null, chemicalKJ: null, couponKJ: result.coupon?.netChemicalPotentialKJ ?? null,
      oxygenPct: null, supportN: result.mobility.staticSupportN, initialO2KPa: result.air?.initialO2KPa ?? null
    };
    const record = {
      settings, scenario, metrics, modelSHA256: data.modelSHA256, sources: [surface], boundary,
      physicsInputs: null, rateBasis: null, trace: [], state: null
    };
    if (!result.air) return {...record, status: 'open-cabin',
      explanation: 'An open crew deck has no shared atmosphere. The sealed-cabin calculation is unavailable. The rover still computes its surface load.'};
    if (!result.coupon) return {...record, status: 'unknown-material',
      explanation: 'The rover has a sealed atmosphere. Enter a material with a known chemical formula and heat of combustion to calculate strip consumption and heat.'};

    const rate = settings.speedMmS === null
      ? measuredRate(data, result.flow.relativeDirection)
      : {speedMmS: settings.speedMmS, kind: 'user-imposed', sourceRow: null, observedDurationS: null, sources: []};
    // Spread length and coupon mass describe the same strip in both models.
    const stripCm = physics.defaults.length;
    const conditions = scenario.conditions;
    const inputs = {
      ...physics.defaults, fuel: data.catalog.parts.find(p => p.id === scenario.parts.material && p.slot === 'material').kind,
      planet: conditions.world, chassisMass: conditions.chassisKg, volume: conditions.volumeM3, pressure: conditions.pressureKPa,
      oxygen: conditions.oxygenPct, speed: rate.speedMmS / 10, length: stripCm, density: result.coupon.prescribedG / stripCm,
      power: 0, capacity: 0
    };
    const heatSource = {
      id: 'NBS-TN-1128:table-1', title: 'NBS Technical Note 1128 · fuel chemistry',
      url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf',
      locator: 'Table 1 · ' + physics.fuels[inputs.fuel].name + ' · net heat ' + physics.chemistry(inputs.fuel).heat + ' MJ/kg',
      boundary: 'The energy calculation uses a reference fuel composition. Testing would establish the properties of a particular rover material.'
    };
    const trace = traceTo(inputs, settings.time);
    const end = trace[trace.length - 1];
    Object.assign(metrics, {positionCm: end.position, chemicalKJ: end.chemical, oxygenPct: end.oxygen});
    let explanation = rate.kind === 'user-imposed'
      ? 'The trial uses the front speed you entered.'
      : 'The rover fan selects the ' + result.flow.relativeDirection + ' orbital reference. The cabin model applies its measured speed to the strip.';
    if (rate.observedDurationS !== null && settings.time > rate.observedDurationS) {
      explanation += ' The clock extends past the original ' + rate.observedDurationS + ' s burn.';
    }
    if (end.state === 'Oxygen cutoff') explanation += ' The model stops consuming fuel at the assumed ' + inputs.cutoff + '% oxygen cutoff.';
    if (end.state === 'Front stationary') explanation += ' A zero front speed gives zero travel and chemical heat.';
    if (end.state === 'End of strip') explanation += ' The front has consumed the full ' + stripCm + ' cm strip.';
    const transfer = rate.kind === 'orbital-analogue'
      ? 'The orbital study used cotton–fiberglass. Applying its rate to a different material, atmosphere or gravity is an assumption.'
      : 'The imposed front speed is a user assumption.';
    return {...record, status: 'modeled', state: end.state, explanation, trace, physicsInputs: inputs,
      boundary: transfer + ' ' + boundary,
      sources: [...rate.sources, heatSource, surface],
      rateBasis: {kind: rate.kind, speedMmS: rate.speedMmS, sourceRow: rate.sourceRow, observedDurationS: rate.observedDurationS}};
  }

  function compare(aSettings, bSettings) {
    const baseline = run(aSettings);
    const current = run(bSettings);
    const deltas = {};
    for (const [key, after] of Object.entries(current.metrics)) {
      const before = baseline.metrics[key];
      deltas[key] = before === null || after === null ? null : after - before;
    }
    return {baseline, current, deltas, changed: fields.filter(key => baseline.settings[key] !== current.settings[key])};
  }

  const api = {defaults, run, compare};
  if (inNode) module.exports = api;
  else globalThis.FFJudgeExperiment = api;
})();
