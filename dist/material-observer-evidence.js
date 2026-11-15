/* Ideal mass balance and measured Saffire-II comparisons for the material observer. */
(() => {
  'use strict';
  const formulas = {
    PMMA: [5, 8, 2, 0], PC: [16, 14, 3, 0],
    NOMEX: [14, 10, 2, 2], CELLULOSE: [6, 10, 5, 0]
  };
  const flightSetup = '/material-observer.html?mix=CELLULOSE:75,FIBERGLASS:25&place=orbit&pressure=14.5&oxygen=22.1&fan=20';
  const flightRows = [
    { sample: '2-5', burnSeconds: 145, lengthCm: 29, spreadMmS: 2.1 },
    { sample: '2-6', burnSeconds: 115, lengthCm: 29, spreadMmS: 2.6 }
  ];

  function oxygenDemand(composition) {
    let grams = 0, total = 0;
    for (const [key, percent] of Object.entries(composition)) {
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
      total += percent;
      if (percent === 0 || key === 'FIBERGLASS') continue;
      // P213 contains both adhesive and backing in unspecified proportions.
      if (!Object.hasOwn(formulas, key)) return null;
      const [c, h, o, n] = formulas[key];
      const molarMass = 12.011*c + 1.008*h + 15.999*o + 14.007*n;
      const oxygenMoles = c + h/4 - o/2;
      grams += percent/100 * 31.998*oxygenMoles / molarMass;
    }
    return Math.abs(total - 100) < 0.00001 ? grams : null;
  }

  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function link(text, href) {
    const node = element('a', text);
    node.href = href;
    return node;
  }

  function flightReplay() {
    const panel = element('fieldset', '');
    panel.className = 'sibal-replay';
    panel.append(element('legend', 'Reconstruct flame travel along the two flight specimens'),
      element('p', 'Move the time slider to see how far the flame front would travel at each measured average speed. This constant-speed reconstruction starts when spread begins. It does not simulate ignition or show flight video.'));
    const timeLabel = element('label', 'Time since spread began');
    const time = document.createElement('input');
    time.id = 'sibal-elapsed'; time.type = 'range'; time.min = '0';
    time.max = String(Math.max(...flightRows.map(row => row.burnSeconds)));
    time.step = '1'; time.value = '60';
    timeLabel.htmlFor = time.id;
    const elapsed = element('span', '');
    elapsed.className = 'sibal-elapsed';
    timeLabel.append(elapsed);
    const tracks = element('div', '');
    tracks.className = 'sibal-tracks';
    const views = flightRows.map(row => {
      const figure = element('figure', '');
      const caption = element('figcaption', 'Sample ' + row.sample + ' · ' + row.spreadMmS + ' mm/s');
      const strip = element('div', '');
      strip.className = 'sibal-strip';
      strip.setAttribute('aria-hidden', 'true');
      strip.append(element('span', ''));
      const scale = element('div', '');
      scale.className = 'sibal-scale'; scale.setAttribute('aria-hidden', 'true');
      scale.append(element('span', '0 cm'), element('span', row.lengthCm + ' cm'));
      const value = element('strong', '');
      figure.append(caption, strip, scale, value); tracks.append(figure);
      return {row, strip, value};
    });
    function scrub() {
      const seconds = Number(time.value);
      elapsed.textContent = seconds + ' s';
      const readings = views.map(({row, strip, value}) => {
        const cm = Math.min(row.lengthCm, seconds * row.spreadMmS / 10);
        strip.style.setProperty('--front', 100 * cm / row.lengthCm + '%');
        value.textContent = cm.toFixed(1) + ' cm';
        return 'Sample ' + row.sample + ', ' + cm.toFixed(1) + ' centimetres';
      });
      time.setAttribute('aria-valuetext', seconds + ' seconds. ' + readings.join('. '));
    }
    time.addEventListener('input', scrub); scrub();
    panel.append(timeLabel, time, tracks, element('p', 'The orange edge marks the reconstructed front. Both tracks stop at the recorded burn length of 29 cm.'));
    const label = element('label', 'Distance along the 29 cm SIBAL strip ');
    const distance = document.createElement('input');
    distance.type = 'range'; distance.min = '0'; distance.max = '29'; distance.step = '1'; distance.value = '15';
    const readout = element('output', '');
    label.append(distance);
    panel.append(label, readout);
    const update = () => {
      const cm = Number(distance.value);
      const times = flightRows.map(row => cm * 10 / row.spreadMmS);
      readout.textContent = cm + ' cm takes about ' + Math.round(Math.min(...times)) + '–' + Math.round(Math.max(...times)) + ' s at the two measured speeds.';
      distance.setAttribute('aria-valuetext', cm + ' centimetres');
    };
    distance.addEventListener('input', update);
    update();
    return panel;
  }

  function render(container, scenario) {
    const { composition, place, pressurePsia, fanCmS, oxygenPct } = scenario;
    const demand = oxygenDemand(composition);
    container.replaceChildren(element('h2', 'Oxygen required if the specimen burns completely'));
    if (demand === null) {
      container.append(element('p', 'This recipe includes a constituent with an unknown chemical formula or adhesive fraction. Its oxygen demand cannot be calculated from these inputs.'));
    } else {
      container.append(element('p', 'Complete combustion of 1 g of this recipe would consume ' +
        demand.toFixed(2) + ' g of oxygen. The actual amount depends on how much material burns and how much char remains.'));
      const details = element('details', '');
      details.append(element('summary', 'How the mass balance works'),
        element('p', 'For each repeat unit CₐHᵦO𝚌N𝚍, complete oxidation to CO₂, H₂O and N₂ takes a + b/4 − c/2 moles of O₂. We convert that to grams of O₂ per gram of polymer, then weight by the dry mass fraction. Uncoated glass fibre contributes zero. This calculation assumes neat polymers with no finishes or additives.'));
      container.append(details);
    }
    container.append(element('h2', 'What burned in orbit?'));
    const sibal = composition.CELLULOSE === 75 && composition.FIBERGLASS === 25;
    const matchedSettings = sibal && place === 'orbit' && Math.abs(pressurePsia - 14.5) < 0.1 &&
      Math.abs(oxygenPct - 22.1) < 0.05 && Math.abs(fanCmS - 20) < 0.05;
    const introduction = matchedSettings ? 'Your nominal recipe and cabin settings match the flight reference. Compare the weave, specimen geometry and exposure before transferring the result.' :
      sibal ? 'Your recipe matches the published dry mass fractions. The two runs below describe the flight conditions, so changing the cabin does not change their measured values.' :
      'NASA flew a woven fabric made of 75% cotton and 25% glass fibre by mass. It gives a measured comparison for a composite with known construction.';
    container.append(element('p', introduction));
    const table = element('table', '');
    table.append(element('caption', 'Saffire-II on Cygnus · about 22.1% oxygen, 100 kPa and 20 cm/s airflow along the flame'));
    const head = table.createTHead().insertRow();
    for (const title of ['NASA sample', 'Burn time', 'Burn length', 'Spread rate']) {
      const th = element('th', title); th.scope = 'col'; head.append(th);
    }
    const body = table.createTBody();
    for (const row of flightRows) {
      const tr = body.insertRow();
      const label = element('th', row.sample); label.scope = 'row'; tr.append(label);
      for (const value of [row.burnSeconds + ' s', row.lengthCm + ' cm', row.spreadMmS + ' mm/s']) {
        tr.insertCell().textContent = value;
      }
    }
    container.append(table);
    if (matchedSettings) {
      container.append(element('p', 'For another strip of the same weave and geometry in these conditions, the two runs give a reference mean of 2.35 mm/s. Using either run to predict the other misses by 0.5 mm/s. Two repeats cannot establish a statistical prediction interval.'), flightReplay());
    }
    const sources = element('p', '');
    const preset = new URL(flightSetup, location.href);
    const originTool = new URLSearchParams(location.search).get('from');
    if (['gravity-lab', 'rover-case', 'physics', 'rover'].includes(originTool)) preset.searchParams.set('from', originTool);
    sources.append(link('Load the flight recipe and settings', preset.pathname + preset.search), ' · ',
      link('NASA table and run IDs', '/data/raw/PSI-99-experimental.csv'), ' · ',
      link('Flight report', 'https://ntrs.nasa.gov/citations/20170008805'), ' · ',
      link('Fabric composition', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6907022/'));
    container.append(sources);
    if (composition.PMMA > 0 || composition.NOMEX > 0) {
      const comparison = element('p', 'Construction also matters. In sample 2-7 the 5 cm acrylic starter burned, but the adjacent Nomex fabric never ignited during the 140-second event. ');
      comparison.append(link('Inspect the NASA photographs and specimen layout', '/140-second-fire.html'));
      container.append(comparison);
    }
  }
  globalThis.MaterialEvidence = { render, oxygenDemand, flightRows };
  if (typeof module !== 'undefined') module.exports = globalThis.MaterialEvidence;
})();
