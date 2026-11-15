(() => {
  'use strict';

  const paper = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5760683/';
  const summary = 'https://ntrs.nasa.gov/api/citations/20210011385/downloads/TM-20210011385.pdf';
  const panel = 'https://ntrs.nasa.gov/api/citations/20210017785/downloads/ICES-2021-218.pdf';
  const luci = 'https://ntrs.nasa.gov/api/citations/20250010653/downloads/ASGSR%202025-LUCI-Ferkul-Presentation-v2-20250010653.pdf';
  const rodFigures = [
    ['Link et al. · spread rates by oxygen and diameter, Fig. 8', paper + '#Fig8'],
    ['NASA BASS-II report · tested combinations, PDF pp. 57–59', summary + '#page=57']
  ];
  const panelFigures = [
    ['Saffire V · specimen and atmosphere, Figs. 6–7, p. 4', panel + '#page=4'],
    ['Saffire V · edge speeds, Fig. 15, p. 10', panel + '#page=10']
  ];

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function makeSelect(label, key, choices, selected) {
    const field = element('label', label, 'field');
    const select = element('select');
    select.name = key;
    choices.forEach(([value, title]) => {
      const option = element('option', title);
      option.value = value;
      select.append(option);
    });
    select.value = selected;
    field.append(select);
    return { field, select };
  }

  function result(title, finding, limit, next, sources) {
    return { title, finding, limit, next, sources };
  }

  function rodResult(geometry, oxygen, endpoint) {
    if (oxygen === 'enriched') {
      return result('The rod study ends below 26.9% oxygen',
        'The BASS-II rod study compared opposed flame spread on Earth and on the ISS at up to approximately 21% oxygen. The 26.9% experiment used a ribbed panel in a different spacecraft.',
        'Changing diameter to rib width changes the surfaces that receive heat. The panel also had a different pressure and airflow.',
        endpoint === 'spread'
          ? 'Compare rods of the selected diameter at 26.9% oxygen and the same pressure. Measure flame-front motion and local opposed flow at each gravity.'
          : 'Use the selected rod diameter, pressure and oxygen fraction. Record igniter performance, first visible flame and survival after heating ends.',
        [rodFigures[1], panelFigures[0]]);
    }
    if (endpoint === 'ignition') {
      return result('An ignition threshold needs a separate measurement',
        'The BASS-II rate comparisons track the flame front on rods after an igniter established a flame. Figure 8 plots front speed against oxygen concentration.',
        'A positive spread rate establishes that a flame existed in that run. It gives neither the minimum energy for ignition nor the chance that a new rod will ignite.',
        'For the selected diameter and oxygen fraction, record delivered ignition energy and local airflow. Repeat the attempts and score first ignition separately from survival after the heat source is removed.',
        [rodFigures[0], ['NASA BASS-II report · ignition and flow sequence, PDF p. 56', summary + '#page=56']]);
    }
    if (oxygen === 'low') {
      return result('Flames still spread on the ISS near 17.5% oxygen',
        'All three rod diameters have flight measurements near 17.5% oxygen. The NASA report found no Earth spread below 19% in its tests without added radiant heating.',
        'Gravity changes the flow experienced by the flame. Even with a similar fan setting, buoyancy on Earth can supply a much stronger local flow. The measured oxygen values carry uncertainty.',
        'Compare spread and extinction on the same rod at several closely spaced oxygen settings. Record local flow, oxygen uncertainty and any added heating.',
        [rodFigures[0], ['Link et al. · flight symbols and ground fits, Fig. 7', paper + '#Fig7'], rodFigures[1]]);
    }
    if (geometry === 'small') {
      return result('The small rod lacks a flight measurement near 21%',
        'The 6.35 mm flight series in this analysis reaches only about 19% oxygen. Figure 8(a) shows why the near-air gravity comparison for larger rods cannot simply be assigned to this diameter.',
        'A curve drawn between or beyond experimental symbols supplies no additional observation. Figure 7 explicitly distinguishes flight measurements from fitted ground curves.',
        'Measure the 6.35 mm black cast rod near 21% oxygen in orbit. Match the ground pressure, sample preparation and imposed flow, then document the local flow in both tests.',
        [rodFigures[0], ['Link et al. · ground fits and flight symbols, Fig. 7', paper + '#Fig7'], rodFigures[1]]);
    }
    return result('Near 21%, the larger rods spread faster on Earth',
      'For the 9.53 mm and 12.7 mm rods, Earth and ISS observations cover oxygen levels near 21%. Figure 8(b,c) shows the higher ground rates in those conditions.',
      'The direction depends on oxygen and airflow. Buoyancy contributes to the flow on Earth. The 6.35 mm flight series has no corresponding near-21% point.',
      'Compare the same diameter across oxygen levels. Read each plotted marker and its test conditions before using a fitted or connecting line.',
      rodFigures);
  }

  function panelResult(oxygen, endpoint) {
    if (oxygen !== 'enriched') {
      const setting = oxygen === 'low' ? '17.5%' : '21%';
      return result('This ribbed panel was tested at 26.9% oxygen',
        'Saffire V studied this specimen on the orbiting Cygnus spacecraft at 76.1 kPa and 26.9% oxygen. The rod measurements at lower oxygen used a different geometry and apparatus.',
        'The panel flight supplies no direct ' + setting + ' result for this specimen. Edges on a ribbed surface can spread flame at a different rate from the surrounding flat areas.',
        'For a ' + setting + ' comparison, keep the rib widths, surface preparation, pressure and opposed flow fixed. ' +
          (endpoint === 'spread' ? 'Track the flame base separately on each edge and flat region.' : 'Record igniter continuity and energy, then time the first flame and its survival.'),
        [panelFigures[0], panelFigures[1], rodFigures[0]]);
    }
    if (endpoint === 'ignition') {
      return result('Downstream ignition was observed on the panel',
        'Figure 9 records the downstream ignition in the opposed-flow test. The earlier upstream attempt failed, apparently because the igniter lost electrical contact.',
        'The upstream failure leaves the concurrent-flow ignition question unresolved. One successful opposed-flow attempt cannot yield an ignition probability.',
        'Verify electrical continuity and delivered power at each end. Repeat both orientations and score hardware validity before counting ignition outcomes.',
        [['Saffire V · upstream attempt and heating protocol, p. 5', panel + '#page=5'],
         ['Saffire V · opposed-flow ignition sequence, Fig. 9, p. 6', panel + '#page=6']]);
    }
    return result('The flame advanced along the rib edges',
      'In the Saffire V opposed-flow test the narrowest rib, 1 mm wide, reached up to 0.88 mm/s. The authors generally found slower propagation along wider ribs.',
      'This speed describes the flame base on one rib. Residue from a previous cotton burn disturbed flow across part of the specimen. The spread varied across the panel.',
      'Repeat the rib-width series with a clean upstream flow path. Track edge and flat-region spread separately at each flow setting.',
      [panelFigures[0], panelFigures[1], ['Saffire V · flow disturbance, Fig. 12, p. 8', panel + '#page=8']]);
  }

  function lunarResult(geometry, oxygen, endpoint) {
    const specimen = geometry === 'panel' ? 'ribbed panel' : 'selected rod diameter';
    const setting = { low: '17.5%', air: '21%', enriched: '26.9%' }[oxygen];
    const finding = endpoint === 'spread'
      ? 'LUCI measured the tip of a flame moving along a 4 mm acrylic rod in centrifugally simulated lunar gravity. The fitted tip speeds were 1.5 mm/s in flight and 4.0 mm/s on Earth. The flame base had no steady speed in the flight run.'
      : 'LUCI burned a 4 mm acrylic rod in simulated lunar gravity. Its report tracks an established flame. The measured tip motion gives no threshold energy or probability of ignition.';
    return result('LUCI offers a different rod comparison', finding,
      'LUCI used an upward-spreading flame in air at normal pressure. It supplies no matched result here for the ' + specimen + ' at ' + setting + ' oxygen. The rotating chamber also deflected the flame.',
      'For the ' + specimen + ', reproduce the chosen oxygen fraction and pressure in a partial-gravity comparison. ' +
        (endpoint === 'spread' ? 'Measure front position, tip position and gas velocity separately.' : 'Verify the heat source and repeat attempts with measured ignition energy.'),
      [['LUCI · apparatus and materials, PDF pp. 12–17', luci + '#page=12'],
       ['LUCI · unsteady flame base, PDF p. 20', luci + '#page=20'],
       ['LUCI · Earth and partial-gravity tip speeds, PDF p. 36', luci + '#page=36']]);
  }

  // Both sections are original diagrams. The rib count is reduced for legibility.
  function schematic(geometry) {
    const isPanel = geometry === 'panel';
    const figure = element('figure');
    figure.style.margin = '0';
    const drawing = isPanel
      ? '<path d="M35 84h26V70h5v14h28V70h10v14h28V70h18v14h26V70h25v14h30v19h-30v14h-25v-14h-26v14h-18v-14h-28v14H94v-14H66v14h-5v-14H35Z" fill="#b6d7ce" stroke="#195d54" stroke-width="2"/><path d="M141 68V42h38" fill="none" stroke="#963c1d" stroke-width="1.5"/><text x="181" y="45">Rib</text><text x="39" y="141">Ribs on both faces</text>'
      : '<path d="M60 70h132v37H60Z" fill="#b6d7ce" stroke="#195d54" stroke-width="2"/><ellipse cx="192" cy="88.5" rx="11" ry="18.5" fill="#cce8df" stroke="#195d54" stroke-width="2"/><ellipse cx="60" cy="88.5" rx="11" ry="18.5" fill="#7fb3a7" stroke="#195d54" stroke-width="2"/><path d="M34 70v37m-5-37h10m-10 37h10" stroke="#963c1d" fill="none" stroke-width="2"/><text x="30" y="134">Diameter</text>';
    const label = isPanel ? 'Cross-section of the ribbed PMMA panel' : 'Black cast PMMA rod, side view';
    figure.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + label +
      '" viewBox="0 0 265 158" width="265" height="158" style="display:block;width:100%;max-width:325px;height:auto;background:#edf2ec;border-radius:4px" font-family="system-ui,sans-serif" font-size="14" fill="#23342e">' +
      '<title>' + label + '</title>' + drawing + '</svg>';
    const caption = isPanel
      ? 'Partial cross-section. Saffire V used 3 mm-high ribs of widths from 1 to 10 mm on both faces of a 10 mm panel.'
      : 'BASS-II used black cast acrylic rods. Diameter is measured across the circular face.';
    figure.append(element('figcaption', caption + ' Schematic, not to scale.', 'footnote'));
    return figure;
  }

  window.renderAcrylic = function renderAcrylic(root) {
    const controls = element('section', '', 'panel stack');
    controls.append(element('h2', 'Choose a comparison'));
    const geometry = makeSelect('Acrylic specimen', 'geometry', [
      ['large', '9.53 or 12.7 mm rod'], ['small', '6.35 mm rod'], ['panel', 'Ribbed panel']
    ], 'large');
    const oxygen = makeSelect('Oxygen by volume', 'oxygen', [
      ['air', 'Near 21%'], ['low', 'Near 17.5%'], ['enriched', '26.9%']
    ], 'air');
    const endpoint = makeSelect('Measurement', 'endpoint', [
      ['spread', 'Flame spread'], ['ignition', 'Ignition']
    ], 'spread');
    const gravity = makeSelect('Gravity question', 'gravity', [
      ['lab', 'Earth and orbital evidence'], ['lunar', 'Simulated lunar gravity']
    ], 'lab');
    const diagram = element('div');
    controls.append(geometry.field, oxygen.field, endpoint.field, gravity.field, diagram);

    const output = element('section', '', 'panel stack');
    const verdict = element('h2');
    verdict.setAttribute('aria-live', 'polite');
    verdict.setAttribute('aria-atomic', 'true');
    const finding = element('p');
    const limit = element('p');
    const next = element('p');
    const references = element('ul', '', 'readlist');
    output.append(element('span', 'Evidence for this selection', 'eyebrow'), verdict, finding,
      element('h3', 'Where the comparison ends'), limit, element('h3', 'Next measurement'), next,
      element('h3', 'Read the original figures'), references);
    function update() {
      const specimen = geometry.select.value;
      let answer;
      if (gravity.select.value === 'lunar') {
        answer = lunarResult(specimen, oxygen.select.value, endpoint.select.value);
      } else if (specimen === 'panel') {
        answer = panelResult(oxygen.select.value, endpoint.select.value);
      } else {
        answer = rodResult(specimen, oxygen.select.value, endpoint.select.value);
      }
      diagram.replaceChildren(schematic(specimen));
      verdict.textContent = answer.title;
      finding.textContent = answer.finding;
      limit.textContent = answer.limit;
      next.textContent = answer.next;
      references.replaceChildren();
      answer.sources.forEach(([text, href]) => {
        const item = element('li');
        const link = element('a', text + ' ↗');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        item.append(link);
        references.append(item);
      });
    }
    controls.addEventListener('change', update);
    const layout = element('div', '', 'workgrid');
    layout.style.gridTemplateColumns = 'repeat(auto-fit,minmax(min(100%, 310px),1fr))';
    layout.append(controls, output);
    root.replaceChildren(layout);
    update();
  };
})();
