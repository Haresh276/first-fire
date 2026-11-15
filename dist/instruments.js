(() => {
  'use strict';
  const habitats = [['moon', 'Moon'], ['mars', 'Mars'], ['orbit', 'Orbit']];
  const views = [
    ['atlas', 'Atlas', 'Read the NASA records', 'Inspect the gravity and oxygen map. Open an original table row or see where the archive has a gap.'],
    ['compass', 'Compass', 'Find the closest tests', 'Rank observations against your cabin. Check which measurements support each match.'],
    ['rulebook', 'Rulebook', 'Check a fire-safety assumption', 'Trace a claim to its experiment and see what evidence would let you apply it in the selected gravity.'],
    ['rover', 'Rover sandbox', 'Try the cabin in a model', 'Choose hardware and a material. Change the cabin air and inspect the calculated energy, oxygen and material budgets.']
  ];
  function render(root, params) {
    let selected = habitats.some(([key]) => key === params.get('habitat')) ? params.get('habitat') : 'moon';
    root.innerHTML = `
      <div class="breadcrumb"><a href="#home">Research desk</a> / Mission tools</div>
      <section class="instrument-bench" aria-labelledby="instrument-title">
        <div class="instrument-brief">
          <h1 id="instrument-title">Investigate a cabin fire</h1>
          <p>Choose a cabin, find the closest experiment, then try the same conditions in a rover.</p>
          <fieldset><legend>Example habitat</legend>
            <div class="habitat-options">${habitats.map(([key, name]) => `<label><input type="radio" name="habitat" value="${key}" ${key === selected ? 'checked' : ''}><span>${name}</span></label>`).join('')}</div>
          </fieldset>
          <dl class="habitat-readings" aria-live="polite"></dl>
          <p class="habitat-note">These are example cabin settings. You can edit them in Compass.</p>
        </div>
        <figure>
          <img src="sibal.png" width="558" height="522" alt="Two edge-on views of a flame spreading along a strip of SIBAL fabric.">
          <figcaption>SIBAL fabric in simulated lunar gravity. <a href="https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/" target="_blank" rel="noopener noreferrer">NASA Glenn ↗</a></figcaption>
        </figure>
      </section>
      <nav class="instrument-views" aria-label="Cabin investigation tools">
        ${views.map(([key, name, action, body]) => `<a data-instrument="${key}"><h2>${name}</h2><strong>${action}</strong><p>${body}</p><span class="instrument-open" aria-hidden="true">→</span></a>`).join('')}
      </nav>`;
    function apply() {
      const {world, gravity, oxygen, pressure} = window.FFCompassPreset(selected);
      const cabin = new URLSearchParams({world, oxygen, psia: pressure});
      const rover = new URLSearchParams(cabin);
      rover.set('gravity', gravity);
      const routes = {atlas: '#atlas?preset=' + selected, compass: '#compass?preset=' + selected,
        rulebook: '#rulebook?' + cabin, rover: '#rover-design?' + rover};
      for (const link of root.querySelectorAll('[data-instrument]')) link.href = routes[link.dataset.instrument];
      root.querySelector('.habitat-readings').innerHTML = [
        ['Gravity', gravity + ' g'], ['Cabin oxygen', oxygen + '%'], ['Absolute pressure', pressure + ' psia']
      ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
    }
    root.querySelector('fieldset').onchange = event => {
      selected = event.target.value;
      history.replaceState(history.state, '', '#instruments?habitat=' + selected);
      apply();
    };
    apply();
  }
  window.FFInstruments = {render};
})();
