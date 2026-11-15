/* Load after flint-coefficients.js and flint-solid.js in the browser. */
(() => {
  'use strict';
  const commonJS = typeof module !== 'undefined' && module.exports;
  if (commonJS) require('./flint-coefficients.js');
  const solver = commonJS ? require('./flint-solid.js') : globalThis.FLINTSolid;

  // ICES-2025-392. Inputs transcribed in flint-engine/flint/data.py from the
  // source figures, not NASA-tabulated values. Duct points are [fan cm/s, O₂ %].
  // ch and chAlt are flint.calibrate.validate(use_alt=False/True).loo[key][2].
  // Each fit excludes that specimen's lunar reading. The solver takes the fitted
  // constant and environmental conditions only; observations are used for scoring.
  const reference = {
    PMMA: {
      label: 'Acrylic sheet (PMMA)', figure13: 13.1, alternate: 13.0,
      ch: 4.181889565226462, chAlt: 4.282200492618106,
      duct: [[60.5, 15.4], [80, 17.8], [104, 18.0], [143.6, 17.9]],
    },
    P213: {
      label: 'P213 glass tape with acrylic adhesive', figure13: 13.7, alternate: 13.5,
      ch: 4.181889565226515, chAlt: 4.282200492615239,
      duct: [[60.5, 15.0], [80.2, 16.2], [100.3, 16.6], [144, 17.8]],
    },
    PC: {
      label: 'Polycarbonate sheet', figure13: 20.1, alternate: 21.0,
      ch: 4.292978952291626, chAlt: 4.549147731609884,
      duct: [[60.5, 19.6], [80, 21.2], [100.9, 22.0], [144.8, 23.2]],
    },
    NOMEX: {
      label: 'Nomex hook-and-loop fastener', figure13: 25.6, alternate: 24.0,
      ch: 3.951219164315651, chAlt: 3.7929451774913385,
      duct: [[60.5, 21.0], [80, 21.3], [100.9, 21.2], [145.3, 21.2]],
    },
  };
  const materials = Object.freeze([
    ...Object.entries(reference).map(([key, data]) => ({ key, label: data.label })),
    { key: 'CELLULOSE', label: 'Dry cotton (cellulose)' },
    { key: 'FIBERGLASS', label: 'Uncoated glass fibre' },
    { key: 'OTHER', label: 'Other or unspecified constituent' },
  ].map(Object.freeze));
  const bounds = Object.freeze({
    pressurePsia: Object.freeze([7, 14.7]),
    fanCmS: Object.freeze([0, 145.3]),
    oxygenPct: Object.freeze([0, 100]),
  });
  const places = Object.freeze(['earth', 'moon', 'mars', 'orbit']);
  // flint.calibrate.validate(use_alt=True).Ch_all, using the individual figures.
  const alternateFullFit = 4.282200492618101;

  function numberIn(value, low, high, name) {
    if (!Number.isFinite(value) || value < low || value > high) {
      throw new RangeError(name + ' must be a finite number from ' + low + ' to ' + high + '.');
    }
  }

  // The straight-line comparison is the intercept of the ordinary least-squares
  // fit to the specimen's four Earth-duct limits versus forced flow. This is
  // the comparison from the research report, not a NASA certification margin.
  function zeroFlowIntercept(duct) {
    const meanX = duct.reduce((sum, point) => sum + point[0], 0) / duct.length;
    const meanY = duct.reduce((sum, point) => sum + point[1], 0) / duct.length;
    let covariance = 0, variance = 0;
    for (const [x, y] of duct) {
      covariance += (x - meanX) * (y - meanY);
      variance += (x - meanX) ** 2;
    }
    return meanY - meanX * covariance / variance;
  }

  function oxygenPercent(fraction) {
    return Number.isFinite(fraction) ? 100 * fraction : null;
  }

  // Compare each independent prediction to the held-out simulated-lunar point.
  // This does not use the all-data fit returned by the calculator's default.
  function scoreFigures(reading) {
    const rows = Object.entries(reference).map(([key, sample]) => {
      const coefficient = reading === 'figure13' ? sample.ch : sample.chAlt;
      const predictedPct = oxygenPercent(solver.solve(key, 'moon', 8.2, 0, coefficient).limit);
      const observedPct = sample[reading];
      const baselinePct = zeroFlowIntercept(sample.duct);
      return { key, label: sample.label, observedPct, predictedPct, baselinePct, errorPoints: predictedPct - observedPct };
    });
    const mae = method => rows.reduce((sum, row) => sum + Math.abs(row[method] - row.observedPct), 0) / rows.length;
    return { rows, modelMaePoints: mae('predictedPct'), baselineMaePoints: mae('baselinePct') };
  }

  function validation() {
    return { figure13: scoreFigures('figure13'), alternate: scoreFigures('alternate') };
  }

  function referenceMatch(sample, place, pressurePsia, fanCmS) {
    if (pressurePsia !== 8.2) return null;
    if (place === 'moon' && fanCmS === 0) {
      return { kind: 'Fitted lunar-gravity reference', observedPct: sample.figure13, alternateObservedPct: sample.alternate };
    }
    if (place === 'earth') {
      const measurement = sample.duct.find(([fan]) => Math.abs(fanCmS - fan) < 1e-8);
      if (measurement) return { kind: 'Earth duct calibration point', observedPct: measurement[1] };
    }
    return null;
  }

  function component(material, massPct, place, pressurePsia, fanCmS, oxygenPct) {
    const part = { ...material, massPct, limitPct: null, marginPoints: null, alternateLimitPct: null,
      branch: null, flowCmS: null, kineticPct: null, thermalPct: null, matchingObservation: null };
    const sample = reference[material.key];
    if (!sample) return part;
    // Use the same full-data fit as the rover and fire lab for live scenarios.
    // Independent predictive performance is evaluated only by validation().
    const result = solver.solve(material.key, place, pressurePsia, fanCmS / 100);
    const alt = solver.solve(material.key, place, pressurePsia, fanCmS / 100, alternateFullFit);
    part.limitPct = oxygenPercent(result.limit);
    part.alternateLimitPct = oxygenPercent(alt.limit);
    part.marginPoints = part.limitPct === null ? null : oxygenPct - part.limitPct;
    part.branch = result.branch;
    part.flowCmS = result.velocity * 100;
    part.kineticPct = oxygenPercent(result.kinetic);
    part.thermalPct = oxygenPercent(result.thermal);
    part.matchingObservation = referenceMatch(sample, place, pressurePsia, fanCmS);
    return part;
  }

  /**
   * Screen dry thin reference specimens in an oxygen/nitrogen cabin, with flow
   * assisting spread. composition maps material keys to dry mass percentages
   * totalling 100. All limitPct values are oxygen mole percentages. marginPoints
   * is cabin oxygen minus the limit, in percentage points. A positive margin
   * favors sustained spread under the model; it is not ignition probability.
   */
  function evaluate(options) {
    if (!options || typeof options !== 'object') throw new RangeError('Provide a composition and cabin conditions.');
    const { composition, place, pressurePsia, fanCmS, oxygenPct } = options;
    if (!places.includes(place)) throw new RangeError('Choose Earth, Moon, Mars or orbit.');
    numberIn(pressurePsia, ...bounds.pressurePsia, 'Absolute cabin pressure (psia)');
    numberIn(fanCmS, ...bounds.fanCmS, 'Assisting fan speed (cm/s)');
    numberIn(oxygenPct, ...bounds.oxygenPct, 'Cabin oxygen (%)');
    if (!composition || typeof composition !== 'object' || Array.isArray(composition)) {
      throw new RangeError('Provide constituent mass percentages.');
    }
    let total = 0;
    for (const [key, massPct] of Object.entries(composition)) {
      if (!materials.some(item => item.key === key)) throw new RangeError('Unknown constituent ' + key + '.');
      numberIn(massPct, 0, 100, key + ' mass (%)');
      total += massPct;
    }
    if (Math.abs(total - 100) > 1e-6) throw new RangeError('Constituent mass percentages must total 100%.');
    const parts = materials.filter(item => Object.hasOwn(composition, item.key) && composition[item.key] > 0)
      .map(item => component(item, composition[item.key], place, pressurePsia, fanCmS, oxygenPct));
    const limits = parts.filter(part => part.limitPct !== null).map(part => part.limitPct);
    const single = parts.length === 1 && limits.length === 1;
    let status = 'unmodelled';
    let basis = 'No supported specimen prediction';
    let note = 'The selected composition has no calibrated FLINT reference with a finite threshold at these conditions.';
    if (place === 'orbit' && fanCmS === 0) {
      note = 'In orbit with fans off, gas can reach the flame by diffusion. The thin-solid flow model does not calculate a threshold for this case.';
    } else if (single) {
      status = 'reference';
      basis = parts[0].matchingObservation?.kind ?? 'Extrapolation from tested specimen conditions';
      note = 'The scenario uses FLINT’s full calibration for the tested specimen construction in dry oxygen and nitrogen. The scorecard tests prediction separately by withholding one lunar-gravity specimen at a time.';
    } else if (limits.length) {
      status = 'components-only';
      basis = 'Separate reference specimens';
      note = 'Each threshold belongs to a separate specimen. Layers, adhesive, coating and contact can change how the assembly burns. A spread threshold for the mixture requires a test of that construction.';
    }
    return { status, basis, note, place, pressurePsia, fanCmS, oxygenPct, parts,
      limitPct: single ? parts[0].limitPct : null,
      marginPoints: single ? parts[0].marginPoints : null,
      componentSpanPct: limits.length >= 2 ? [Math.min(...limits), Math.max(...limits)] : null };
  }

  const api = Object.freeze({ materials, places, bounds, validation, evaluate });
  globalThis.MaterialObserver = api;
  if (commonJS) module.exports = api;
})();
