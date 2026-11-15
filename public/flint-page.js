(() => {
  'use strict';
  const form = document.querySelector('#solid-form');
  const c = globalThis.FLINTCoefficients;
  function displayLimit() {
    const choices = new FormData(form);
    const gravity = choices.get('gravity');
    const pressure = Number(choices.get('pressure'));
    const fan = Number(choices.get('fan')) / 100;
    const material = String(choices.get('material'));
    const result = globalThis.FLINTSolid.solve(material, gravity, pressure, fan);
    const valid = Number.isFinite(result.limit);
    document.querySelector('#solid-limit').textContent = valid ? (100 * result.limit).toFixed(2) + '% O₂' : 'Not modelled';
    document.querySelector('#solid-branch').textContent = valid ?
      c.materials[material].label + ' · ' + result.branch + ' · effective flow ' +
      (result.velocity * 100).toFixed(1) + ' cm/s' : 'In quiescent orbit, oxygen transport by diffusion falls outside FLINT.';
    const atReference = Math.abs(pressure * c.psia - c.Pref) < 1e-6;
    const validity = !valid ? 'Read the BASS and Saffire flight evidence below.' :
      atReference && fan === 0 && gravity === 'moon'
        ? 'Validated at ' + (c.Pref / c.psia).toFixed(1) + ' psia · pressure of the ICES calibration.'
        : 'Model extrapolation · gravity, pressure or fan setting outside the lunar validation.';
    document.querySelector('#solid-validity').textContent = validity;
  }
  form.addEventListener('submit', event => {event.preventDefault(); displayLimit();});
  form.addEventListener('change', displayLimit);
  displayLimit();

  const controls = document.querySelector('#atlas-form');
  const filters = Array.from(controls.querySelectorAll('[data-filter]'));
  const rows = Array.from(document.querySelectorAll('.scenario'));
  const status = document.querySelector('#atlas-status');
  const paging = document.querySelector('#atlas-paging');
  const prev = document.querySelector('#atlas-prev'), next = document.querySelector('#atlas-next');
  const size = 12;
  let matches = [], page = 0;
  function displayPage() {
    const start = page * size;
    const visible = new Set(matches.slice(start, start + size));
    for (const row of rows) {
      row.hidden = !visible.has(row);
      if (row.hidden) row.open = false;
    }
    status.textContent = matches.length ? 'Showing ' + (start + 1) + '–' + Math.min(start + size, matches.length) +
      ' of ' + matches.length + ' matching scenarios.' : 'No matching scenarios. Try a different combination or clear filters.';
    paging.hidden = matches.length <= size;
    prev.disabled = page === 0;
    next.disabled = start + size >= matches.length;
  }
  function filter() {
    const selected = filters.filter(el => el.value);
    matches = rows.filter(row => selected.every(el => row.dataset[el.dataset.filter] === el.value));
    page = 0;
    displayPage();
  }
  controls.addEventListener('change', filter);
  controls.addEventListener('reset', () => {setTimeout(filter, 0);});
  prev.addEventListener('click', () => {if (page > 0) {page--; displayPage();}});
  next.addEventListener('click', () => {if ((page + 1) * size < matches.length) {page++; displayPage();}});
  controls.hidden = false;
  filter();
})();
