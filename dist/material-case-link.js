/* Transfer the current atmosphere and dry mass recipe between the two case studies and the observer. */
(() => {
  'use strict';
  const model = globalThis.MaterialObserver;
  const query = new URLSearchParams(location.search);
  const places = ['earth', 'moon', 'mars', 'orbit'];
  const known = new Set(model.materials.map(material => material.key));
  let imported = null;
  if (query.has('mix') || query.get('observer') === '1') {
    const mix = query.get('mix') || (query.get('material') || 'PMMA') + ':100';
    const composition = {};
    let valid = true;
    for (const entry of mix.split(',')) {
      const fields = entry.split(':');
      const [key, mass] = fields;
      if (fields.length !== 2 || !known.has(key) || !mass?.trim() || Object.hasOwn(composition, key)) { valid = false; break; }
      composition[key] = Number(mass);
    }
    const scenario = { composition, place: query.get('place'), pressurePsia: Number(query.get('pressure')),
      oxygenPct: Number(query.get('oxygen')), fanCmS: Number(query.get('fan')) };
    if (valid && ['place', 'pressure', 'oxygen', 'fan'].every(key => query.has(key) && query.get(key).trim())) {
      try {
        model.evaluate(scenario);
        imported = { ...scenario, name: (query.get('name') || '').slice(0, 120),
          construction: (query.get('construction') || '').slice(0, 240) };
      } catch { /* A malformed hand-written link leaves the ordinary case available. */ }
    }
  }

  function update(scenario, source, candidate = imported) {
    const button = document.getElementById('screen-material');
    const result = document.getElementById('screen-result');
    const recipe = candidate?.composition || scenario.composition;
    const mix = Object.entries(recipe).filter(([, n]) => n > 0).map(([key,n]) => key + ':' + n).join(',');
    try {
      const screened = model.evaluate({ ...scenario, composition: recipe });
      const params = new URLSearchParams({ from: source, mix, place: scenario.place,
        pressure: scenario.pressurePsia, oxygen: scenario.oxygenPct, fan: scenario.fanCmS });
      if (candidate?.name) params.set('name', candidate.name);
      if (candidate?.construction) params.set('construction', candidate.construction);
      button.href = '/material-observer.html?' + params;
      button.hidden = false;
      const ingredients = screened.parts.map(part => part.label + ' ' + part.massPct + '%').join(', ');
      if (screened.limitPct !== null) {
        result.textContent = ingredients + ' by mass. At the selected airflow, FLINT estimates a sustained-spread limit of ' +
          screened.limitPct.toFixed(1) + '% oxygen. The cabin is ' + Math.abs(screened.marginPoints).toFixed(1) +
          ' percentage points ' + (screened.marginPoints >= 0 ? 'above' : 'below') + ' that estimate.';
      } else {
        result.textContent = ingredients + ' by mass. This case has no calibrated whole-specimen spread threshold. Compare the constituents or record a burn observation for this construction.';
      }
    } catch {
      button.hidden = true;
      button.removeAttribute('href');
      result.textContent = !places.includes(scenario.place) ? 'Choose an Orbit, Moon, Mars or Earth preset to compare a material in that location.' :
        'This atmosphere is outside the material observer’s screening range. Open the observer to choose supported settings.';
    }
  }
  globalThis.MaterialCaseLink = { imported, update };
})();
