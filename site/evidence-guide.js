/* The guide compares specific measurements in the pinned PSI release. Each
   source row counts the CSV header as row 1. Study-level joins stay explicit. */
(function (root) {
  'use strict';

  const tasks = {spread: 'Prevention', detection: 'Detection', extinction: 'Suppression'};
  const specimens = {any: 'Any specimen', fabric: 'Woven fabric', polymer: 'Polymer or insulation', droplet: 'Liquid droplet', gas: 'Gaseous burner fuel'};
  const saffireReport = 'https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf';
  const flexReport = 'https://ntrs.nasa.gov/api/citations/20150023456/downloads/20150023456.pdf';
  const smokePaper = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7918997/#F9';
  const burnerPaper = 'https://api.drum.lib.umd.edu/server/api/core/bitstreams/278c77a3-6e86-4dc5-8413-c0381ebe74a9/content#page=62';

  function nasaFile(id, file, version) {
    const params = new URLSearchParams({file: id + '_' + file, version: '1', studyVersion: String(version)});
    return 'https://psi.nasa.gov/geode-py/ws/studies/' + id + '/download?' + params;
  }

  const studies = [
    {
      id: 'PSI-98', name: 'Saffire-I', forms: ['fabric'], version: 4, table: 'SAFFIRE-1',
      finding: 'The cotton–fiberglass specimen sustained flame spread in both directions under forced flow. The team measured separate average front speeds.',
      limit: 'S1 and S2 burned the same specimen sequentially. Their difference cannot isolate a causal effect of airflow direction.',
      locator: 'S1 and S2 · CSV rows 2–3. Column J reports 420 and 70 seconds of burning. F records 20 cm/s and K the flow direction. Front speeds come from the flight report.',
      join: 'Match S1 concurrent and S2 opposed burns to the two sequences on slide 21. Preserve the shared specimen when comparing runs.',
      records: ['PSI-98:1:2', 'PSI-98:1:3'], report: saffireReport + '#page=21', reportTitle: 'Flight report, slide 21',
      local: 'index.html#atlas?record=PSI-98%3A1%3A2'
    },
    {
      id: 'PSI-99', name: 'Saffire-II', forms: ['polymer', 'fabric'], version: 5, table: 'SAFFIRE-2',
      finding: 'In sample 2-7, the upstream PMMA strip burned and the adjacent Nomex was damaged without igniting. The 140 seconds of burning belong to the assembly.',
      limit: 'These components overlapped in a 20 cm/s concurrent flow at roughly 22.1% oxygen in orbital microgravity. A different fabric or cabin needs its own test.',
      locator: '2-7 · CSV row 8. B8 names both materials, J8 gives 140 s, L8 gives their separate burn lengths and note 2 in row 14 identifies which material ignited.',
      join: 'Match sample 2-7 to Table I and its component note. The paper describes the damage to Nomex on pp. 24–25.',
      records: ['PSI-99:1:8'], report: saffireReport + '#page=25', reportTitle: 'Flight report, pp. 24–25 and Table I',
      local: 'index.html#case/saffire'
    },
    {
      id: 'PSI-25', name: 'BASS-II', forms: ['polymer', 'fabric'], version: 4, table: 'BASS-II',
      finding: 'BASS-II identifies a PMMA film and Nomex specimens with measured gas concentrations and fan settings. These rows can guide selection of a comparable solid-fuel experiment.',
      limit: 'The gas log alone gives neither a calibrated airflow at the sample nor a flame propagation or extinction threshold.',
      locator: 'B1 · row 2, 100 μm PMMA film. F1 · row 24, Nomex III. F names the specimen, H the fan display, and L–M the calibrated initial and final oxygen volume percentages.',
      join: 'Accept these test IDs for material and atmosphere. A termination time or measured front position needs a separately identified diagnostic.',
      records: ['PSI-25:1:2', 'PSI-25:1:24'], local: 'index.html#atlas?study=PSI-25'
    },
    {
      id: 'PSI-101', name: 'SAME-R', forms: ['polymer'], version: 4, table: 'SAME-R',
      finding: 'For Kapton run 75 the Shuttle detector power flag stayed off throughout its 1,246 matching records. The ISS optical instrument recorded a separate scatter signal.',
      limit: 'A zero alarm flag with the detector unpowered cannot count as a miss. Heater duration is a source setting. A rover warning time also requires a smoke arrival time and a powered threshold crossing.',
      locator: 'Kapton run 75 · CSV row 11. E11 is 8.1 cm/s inlet flow, G11 is 60 s of heating and J11 is 32 s net aging. In the original workbook, D selects run 75, B is source time, W is ISS scatter voltage, BK is Shuttle power and CN is its alarm flag.',
      join: 'Match the run number and material between the table and the workbook, sheet “Original (cut and paste)”. Keep the optical voltage and Shuttle flags on their own instruments.',
      records: ['PSI-101:1:11'], report: nasaFile('PSI-101', 'Analyzed Data_2010_238_18_kapton_run75.xls', 4), reportTitle: 'NASA run 75 telemetry workbook',
      local: 'detector.html?run=75'
    },
    {
      id: 'PSI-102', name: 'SAME', forms: ['polymer'], version: 4, table: 'SAME',
      finding: 'The published ISS light-scattering thresholds would have missed over half of the tested Kapton smoke cases and two thirds of the Teflon cases. Silicone smoke often saturated that detector.',
      limit: 'Those fractions summarize the published subsets. The setup table does not identify individual alarm outcomes. Intermittent Shuttle operation limits comparison between detector types.',
      locator: 'PSI-102 rows 2–5 give Teflon settings in cm/s, mg/min and minutes. Rows 6–7 refer back to the same settings for Kapton and silicone rubber. See Meyer et al., §3.2 and Figure 9, right panel, for responses relative to the ISS threshold.',
      join: 'Use the table to identify the material and settings studied. Figure 9 describes the flight campaign. Its aggregate findings cannot be assigned to individual settings rows.',
      records: [], report: smokePaper, reportTitle: 'Meyer et al., Figure 9',
      local: 'index.html#case/same'
    },
    {
      id: 'PSI-69', name: 'FLEX', forms: ['droplet'], version: 5, table: 'FLEX',
      finding: 'In FLEX-155, the heptane droplet measured 2.73 mm initially and 2.52 mm when its visible flame disappeared. Continued vaporization supported the investigators’ inference of cool-flame burning.',
      limit: 'This is a droplet result, not a solid-fuel suppression rating. In FLEX-120 a cloud also formed, but the ultraviolet camera supplied no images and later burning remained unresolved.',
      locator: 'FLEX-155 / C03H201 · row 156. F gives 764.9 mmHg, G–J give the ambient mole fractions (0.18 O₂, 0.67 N₂, 0.15 CO₂, 0 He), and K–L give diameters in mm. FLEX-120 / C12H201 is row 121.',
      join: 'Match both flight test numbers to Figures 159 and 124. Pressure, droplet support and dilution differ between the two runs, so they cannot isolate a diluent effect.',
      records: ['PSI-69:1:156', 'PSI-69:1:121'], report: flexReport + '#page=189', reportTitle: 'NASA report, Figure 159',
      more: {url: flexReport + '#page=154', title: 'NASA report, Figure 124'}, local: 'index.html#case/flex'
    },
    {
      id: 'PSI-68', name: 'FLEX-2', forms: ['droplet'], version: 6, table: 'Flex2',
      finding: 'FLEX-2 lists a range of initial droplet diameters, gas mixtures and pressures for each fuel. The grouped ranges locate candidate settings for follow-up.',
      limit: 'An enumerated setting establishes neither a completed run nor a measured extinction endpoint.',
      locator: 'Row 2 · iso-octane. B2 gives 1.5–5 mm. D2 and E2 list multiple oxygen mole fractions and pressures in atm.',
      join: 'Keep this row at the fuel-and-settings level until a run-specific record identifies a measured outcome.',
      records: [], local: 'index.html#atlas?study=PSI-68'
    },
    {
      id: 'PSI-159', name: 'CFI-G', forms: ['gas'], version: 1, table: 'CFI-G_Inverse Flames',
      finding: 'In inverse ethane tests A1 and A2, oxygen at 85% flowed through the burner into a chamber containing 6% ethane. A1 showed no hot ignition. A2 ignited and self-extinguished after two seconds.',
      limit: 'An 85% burner stream cannot establish the cabin oxygen level, the flammability of a fabric, or the cause of the different outcomes.',
      locator: 'Inverse table rows 18–19 · 21202 A1 and A2. H18–H19 give XO2 = 0.85 for the burner, E gives initial chamber ethane mole fraction 0.06, and N–P identify ignition, burn time in seconds and termination.',
      join: 'Match test identifiers to Table E.6 and use the inverse-flame plumbing to locate the oxygen measurement. Keep the two trials distinct.',
      records: ['PSI-159:2:18', 'PSI-159:2:19'], report: burnerPaper, reportTitle: 'Investigator dissertation, Table E.6',
      local: 'index.html#case/cfig'
    }
  ].map(s => ({...s, url: 'https://psi.nasa.gov/physci/repo/data/investigations/' + s.id,
    source: nasaFile(s.id, 'Experimental table_' + s.table + '.csv', s.version)}));

  const studyById = Object.fromEntries(studies.map(s => [s.id, s]));
  const questions = {
    spread: {
      components: {
        title: 'Which part of the PMMA–Nomex assembly burned?',
        direct: ['PSI-99'], context: ['PSI-98', 'PSI-25'],
        reason: ['Reports ignition and damage for the two components of the specified assembly.', 'Gives a fabric spread comparison for a different construction.', 'Identifies Nomex and PMMA candidates with recorded gas conditions.'],
        reject: 'PSI-159', rejection: 'An inverse gas burner exposes fuel to an oxygen stream. Its 85% value cannot answer which solid component burned.',
        next: 'Test the intended fabric assembly with its actual overlap, ignition exposure, pressure and airflow. Record ignition and damaged length for each component.'
      },
      front: {
        title: 'Did the flame spread through the large SIBAL specimen in both flow directions?',
        direct: ['PSI-98'], context: ['PSI-25'],
        reason: ['Identifies both forced-flow burn sequences on the same large SIBAL specimen.', 'Includes smaller SIBAL samples in a different apparatus.'],
        reject: 'PSI-99', rejection: 'The 140-second duration for PMMA and Nomex in 2-7 measures a different assembly and endpoint.',
        next: 'Use fresh matched SIBAL specimens in each direction. Measure front position against time under the intended airflow and gravity.'
      },
      chamber: {
        title: 'Did fabric burn in an 85% oxygen chamber?',
        direct: [], context: ['PSI-99', 'PSI-25'],
        reason: ['The fabric assembly was tested at about 22.1% oxygen.', 'The cited material rows record 22.2% initial ambient oxygen.'],
        reject: 'PSI-159', rejection: 'H18 and H19 give 85% oxygen in the burner stream. The chamber initially contained 6% ethane in nitrogen.',
        next: 'Locate a solid specimen test with a verified ambient oxygen measurement at the target concentration, pressure, geometry and flow.'
      },
      burner: {
        title: 'What happened with 85% oxygen in the burner stream?',
        direct: ['PSI-159'], context: [],
        reason: ['Matches the inverse gas geometry, measurement location and trial identifiers.'],
        reject: 'PSI-99', rejection: 'The oxygen column describes the surrounding air for a solid assembly. It cannot identify the gas fed through an inverse burner.',
        next: 'To isolate oxygen-flow effects, hold chamber composition and pressure fixed across replicated inverse-burner trials.'
      }
    },
    detection: {
      transfer: {
        title: 'Does a detector response to silicone smoke transfer to other materials?',
        direct: ['PSI-102'], context: ['PSI-101'],
        reason: ['Compares material-specific responses against the published ISS detector threshold.', 'Links a Kapton condition to separate ISS and Shuttle telemetry in a specific reflight run.'],
        reject: 'PSI-101', rejection: 'Reading the 60-second heating duration in G11 as an alarm delay substitutes smoke generation for detector response.',
        next: 'At a known inlet flow and smoke age, record particle arrival, detector power, calibrated threshold and first crossing for each material in the target cabin.'
      },
      power: {
        title: 'Did the Shuttle detector have power in Kapton run 75?',
        direct: ['PSI-101'], context: ['PSI-102'],
        reason: ['Provides the synchronized power and alarm flags for the named run.', 'Published threshold comparisons help explain why powered detector operation matters.'],
        reject: 'PSI-101', rejection: 'The ISS optical voltage in W belongs to a different instrument. It cannot establish whether the Shuttle unit in BK was powered.',
        next: 'Compare a powered run at matched aerosol conditions. Record inlet concentration, flow and the detector-specific threshold before estimating a miss rate.'
      }
    },
    extinction: {
      visible: {
        title: 'Did burning end when the heptane droplet went dark?',
        direct: ['PSI-69'], context: ['PSI-68'],
        reason: ['Links droplet diameter at visible extinction with the investigators’ post-extinction observations.', 'Lists candidate dilution and pressure ranges without identifying an extinction event.'],
        reject: 'PSI-68', rejection: 'A matrix of allowed fuel and atmosphere settings supplies no measured diameter or post-flame chemistry for an individual run.',
        next: 'Follow the same droplet past visible extinction with synchronized diameter, temperature and species measurements under a matched atmosphere.'
      },
      solids: {
        title: 'Can these measurements size suppression for a fabric-lined rover?',
        direct: [], context: ['PSI-25', 'PSI-98'],
        reason: ['Identifies solid samples and gas conditions for designing a matched test.', 'Provides a large fabric burn under forced flow. Neither sequence tested an installed suppression system.'],
        reject: 'PSI-69', rejection: 'Extinction of a free-floating heptane droplet has a different fuel geometry and endpoint from suppressing fire in a fabric-lined cabin.',
        next: 'Measure agent delivery, extinction and re-ignition for the actual fabric, cabin volume, ventilation state and ignition configuration.'
      }
    }
  };

  // Preserve the original broad endpoint and specimen API for existing callers.
  const broadOrder = {spread: ['PSI-98','PSI-99','PSI-25'], detection: ['PSI-101','PSI-102'], extinction: ['PSI-69','PSI-68','PSI-25']};
  function rank(task = 'spread', specimen = 'any') {
    if (!Object.hasOwn(tasks, task) || !Object.hasOwn(specimens, specimen)) throw new RangeError('Unknown evidence filter');
    const pool = broadOrder[task].map(id => studyById[id]);
    const fits = s => specimen === 'any' || s.forms.includes(specimen);
    return {task, specimen, direct: pool.filter(fits), related: pool.filter(s => !fits(s)), total: studies.length};
  }

  function brief(task, specimen, question) {
    if (!Object.hasOwn(questions, task) || !Object.hasOwn(questions[task], question) || !Object.hasOwn(specimens, specimen)) {
      throw new RangeError('Unknown evidence question or specimen');
    }
    const q = questions[task][question];
    const candidates = [...q.direct, ...q.context].map((id, i) => ({
      ...studyById[id], reason: q.reason[i], role: q.direct.includes(id) ? 'Direct evidence' : 'Context only'
    }));
    const fits = s => specimen === 'any' || s.forms.includes(specimen);
    const included = candidates.filter(fits).slice(0, 3);
    const lead = included.find(s => s.role === 'Direct evidence');
    const answer = lead ? lead.finding : 'This selection contains no direct measurement answering the question' +
      (specimen === 'any' ? '.' : ' for the selected specimen family (' + specimens[specimen].toLowerCase() + ').');
    return {
      schema: 'first-fire.evidence-brief.v1', selection: {task, specimen, question}, question: q.title,
      scope: 'Selected orbital microgravity experiments and reports. Transferring results to a lunar or Martian cabin needs additional measurements.',
      method: 'Curated comparison by endpoint, instrument or specimen geometry, and source completeness. Related material is shown as context.',
      status: lead ? 'Evidence found' : 'Evidence gap', answer,
      uncertainty: lead ? lead.limit : 'This gap applies to the selected evidence. It does not establish what the entire literature contains.',
      ranked: included, excludedSpecimens: candidates.filter(s => !fits(s)).map(s => ({id: s.id, name: s.name, forms: s.forms.map(f => specimens[f])})),
      rejected: {...studyById[q.reject], reason: q.rejection}, nextMeasurement: q.next
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {tasks, specimens, studies, questions, rank, brief};
  if (!root.document) return;
  const doc = root.document;
  const byId = id => doc.getElementById(id);
  const endpoint = byId('endpoint'), specimen = byId('specimen'), question = byId('question');
  if (!endpoint || !specimen || !question) return;

  function make(tag, value) {
    const el = doc.createElement(tag);
    if (value !== undefined) el.textContent = value;
    return el;
  }
  function link(url, label) {
    const a = make('a', label);
    a.href = url;
    return a;
  }
  function populate(select, entries, key) {
    select.replaceChildren();
    for (const [value, label] of entries) {
      const option = make('option', label);
      option.value = value;
      select.append(option);
    }
    select.value = entries.some(([v]) => v === key) ? key : entries[0][0];
  }
  function sourceDetails(s) {
    const details = make('details');
    details.append(make('summary', 'Trace to the original records'));
    details.append(make('p', s.locator), make('p', s.join));
    const links = make('div');
    links.className = 'record-links';
    links.append(link(s.source, 'NASA source table · study v' + s.version + ', file v1'), link(s.url, 'Investigation record'));
    if (s.report) links.append(link(s.report, s.reportTitle));
    if (s.more) links.append(link(s.more.url, s.more.title));
    details.append(links);
    return details;
  }
  function card(s, i) {
    const article = make('article');
    article.className = 'result-card';
    const fit = make('span', (i + 1) + ' · ' + s.role);
    fit.className = 'fit';
    const heading = make('h3', s.name), accession = make('span', s.id);
    accession.className = 'accession';
    heading.append(accession);
    article.append(fit, heading, make('p', s.reason), link(s.local, 'Inspect the evidence in FIRST FIRE'), sourceDetails(s));
    return article;
  }

  const params = new URLSearchParams(root.location.search);
  populate(endpoint, Object.entries(tasks), params.get('task'));
  populate(specimen, Object.entries(specimens), params.get('specimen'));
  function updateQuestions(selected) {
    populate(question, Object.entries(questions[endpoint.value]).map(([id, q]) => [id, q.title]), selected);
  }
  updateQuestions(params.get('question'));

  let active;
  function render() {
    active = brief(endpoint.value, specimen.value, question.value);
    byId('status').textContent = active.status;
    byId('answer-title').textContent = active.question;
    byId('answer').textContent = active.answer;
    byId('scope').textContent = active.scope;
    byId('uncertainty').textContent = active.uncertainty;
    byId('next').textContent = active.nextMeasurement;
    byId('count').textContent = active.ranked.length ? 'Ranked investigations (' + active.ranked.length + ')' : 'No ranked investigations';
    byId('matches').replaceChildren(...active.ranked.map(card));
    byId('excluded').textContent = active.excludedSpecimens.length
      ? 'Outside the selected specimen family: ' + active.excludedSpecimens.map(s => s.name + ' (' + s.forms.join(', ') + ')').join(', ') + '.'
      : '';
    const rejected = active.rejected;
    byId('rejection').replaceChildren(make('h3', rejected.name + ' · ' + rejected.id), make('p', rejected.reason), sourceDetails(rejected));
    byId('download-status').textContent = '';
  }
  function update() {
    render();
    const url = new URL(root.location.href);
    for (const [key, value] of Object.entries(active.selection)) url.searchParams.set(key, value);
    // Some file:// browsers disallow history updates. The brief still includes its selection.
    try { root.history.replaceState(null, '', url); } catch {}
  }
  endpoint.addEventListener('change', () => { updateQuestions(); update(); });
  specimen.addEventListener('change', update);
  question.addEventListener('change', update);
  byId('own-question').addEventListener('submit', event => {
    event.preventDefault();
    const query = byId('research-query').value.trim();
    if (query) root.location.href = 'index.html#chat?q=' + encodeURIComponent(query);
  });
  byId('download').addEventListener('click', () => {
    const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(active, null, 2) + '\n'], {type: 'application/json'}));
    const anchor = link(objectUrl, 'Evidence brief');
    anchor.download = 'first-fire-' + active.selection.question + '-' + active.selection.specimen + '.json';
    doc.body.append(anchor);
    anchor.click();
    anchor.remove();
    root.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    byId('download-status').textContent = 'Prepared ' + anchor.download + '.';
  });
  render();
})(typeof window === 'undefined' ? {} : window);
