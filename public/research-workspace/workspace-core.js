/* Native disclosure links remain usable while the desk's scientific tools load. */
(() => {
  'use strict';
  const explore = document.getElementById('workspace-explore');
  const summary = explore.querySelector('summary');
  const current = document.getElementById('ff-current-module');
  const links = Array.from(document.querySelectorAll('.ff-shell-header [data-nav], .ff-shell-footer [data-nav]'));
  const groups = Array.from(explore.querySelectorAll('.ff-shell-group'), group => Array.from(group.querySelectorAll('a')));
  const ordered = groups.flat();
  const aliases = {case:'cases', designs:'cases', acrylic:'cases', report:'sources', 'code-review':'sources',
    coverage:'data', errors:'referee', quotes:'referee', rover:'physics'};
  const names = {home:'Research desk', search:'Evidence search', claim:'Check a claim', coverage:'Archive coverage',
    'archive-audit':'Archive audit', 'materials-lab':'Materials Lab', 'master-physics':'Cabin physics',
    'vehicle-designer':'Vehicle designer', 'flame-tracking':'Flame tracking', quotes:'Quotation referee'};

  function setView(key, params, heading) {
    const module = aliases[key] || key;
    const rover = key === 'rover' || (key === 'physics' && params.get('mode') === 'rover');
    const match = links.find(link => link.dataset.nav === module &&
      (module !== 'physics' || link.hash.includes('?mode=rover') === rover));
    links.forEach(link => {
      if (link === match) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const label = match?.querySelector('span')?.textContent || match?.textContent.trim();
    let view = names[key] || label || heading || 'Page not found';
    if ((key === 'case' || key === 'report') && heading) view = heading;
    if (key === 'data' && params.get('study')) view += ' · ' + params.get('study');
    // The brand is the shell's single home link; breadcrumb trails still name their origin.
    document.querySelectorAll('#content .breadcrumb a[href="#home"]').forEach(link => {
      const origin = document.createElement('span');
      origin.textContent = link.textContent;
      link.replaceWith(origin);
    });
    current.textContent = view;
    current.title = view;
    explore.open = false;
  }

  function readLocation() {
    const [path, query] = location.hash.slice(1).split('?');
    setView(path.split('/')[0] || 'home', new URLSearchParams(query));
  }

  explore.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Escape' && explore.open) {
      event.preventDefault();
      explore.open = false;
      summary.focus();
      return;
    }
    const link = event.target.closest('a');
    const index = ordered.indexOf(link);
    const group = groups.findIndex(items => items.includes(link));
    let next;
    if (event.target === summary) {
      if (event.key === 'ArrowDown') next = ordered[0];
      if (event.key === 'ArrowUp') next = ordered[ordered.length - 1];
    } else if (index >= 0) {
      if (event.key === 'Home') next = ordered[0];
      if (event.key === 'End') next = ordered[ordered.length - 1];
      if (event.key === 'ArrowDown') next = ordered[(index + 1) % ordered.length];
      if (event.key === 'ArrowUp') next = ordered[(index - 1 + ordered.length) % ordered.length];
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const adjacent = groups[(group + offset + groups.length) % groups.length];
        next = adjacent[Math.min(groups[group].indexOf(link), adjacent.length - 1)];
      }
    }
    if (next) {
      event.preventDefault();
      explore.open = true;
      next.focus();
    }
  });

  function closeOutside(event) {
    if (explore.open && !explore.contains(event.target)) explore.open = false;
  }
  document.addEventListener('pointerdown', closeOutside);
  document.addEventListener('focusin', closeOutside);
  explore.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    explore.open = false;
    if (link.target === '_blank') summary.focus();
    else if (link.getAttribute('href').startsWith('#')) document.getElementById('content').focus({preventScroll:true});
  });
  window.FFShellNav = {setView};
  window.addEventListener('hashchange', readLocation);
  readLocation();
})();

;
/* Directions for the research workspace. Chat renders these as ordinary links. */
(() => {
  'use strict';

  // An entry names a destination supported by both versions of the workspace.
  // Aliases describe places or actions. A question merely mentioning one is
  // left to the research assistant.
  const destinations = [
    ['#home', 'Research desk', 'Return to the workspace homepage.', ['home', 'homepage', 'main page', 'dashboard']],
    ['#session', 'Guided investigation', 'Start with a question, then follow the guided investigation.', ['guided onboarding', 'guided session', 'onboarding', 'get started', 'start an investigation', 'start a guided investigation']],
    ['#awareness', 'Saved investigation', 'Reopen the question and evidence you saved in this browser.', ['saved investigations', 'my investigation', 'my saved work', 'resume my investigation', 'return to my investigation']],
    ['#cases', 'Case library', 'Browse the case studies and their evidence.', ['cases', 'case studies', 'research cases', 'browse the cases']],
    ['#earth', 'Earth applications', 'Explore how the research relates to fire on Earth.', ['at home', 'earth applications']],
    ['#atlas', 'Evidence Atlas', 'Inspect the original measurement and its source row.', ['atlas', 'source rows', 'nasa source rows', 'original measurements', 'inspect a source row', 'look up a record']],
    ['#compass', 'Habitat Compass', 'Find records with conditions close to your proposed cabin atmosphere.', ['compass', 'match a cabin atmosphere', 'match my cabin atmosphere', 'match a habitat', 'compare cabin atmospheres']],
    ['#passports', 'Material passports', 'Review the evidence for a material and the conditions it covers.', ['passports', 'material passport']],
    ['#rulebook', 'Rulebook', 'Check the evidence behind a cabin design rule.', ['mission rulebook', 'test a rule', 'design rules']],
    ['#data', 'Data explorer', 'Filter the experimental records by investigation or search the rows.', ['data', 'data browser', 'explore the data', 'filter records', 'browse data', 'search nasa data']],
    ['#data?mode=rank', 'Compare mission conditions', 'Rank records by how closely their conditions match yours.', ['rank records', 'rank experiments', 'compare mission conditions']],
    ['#referee', 'Evidence referee', 'Check a claim or quotation against its cited source.', ['referee', 'verify a quote', 'check a quotation', 'verify a claim']],
    ['#forecast', 'FM² forecast', 'Read the four lunar burn forecasts and their assumptions.', ['fm2', 'forecast', 'lunar forecast', 'fm2 forecast', 'four lunar forecasts', 'forecast lab', 'view the lunar forecast']],
    ['#physics', 'Physics Lab', 'Change cabin conditions and inspect the simulated response.', ['physics', 'cabin physics', 'cabin simulator', 'simulate a cabin', 'change cabin conditions', 'cabin physics lab']],
    ['#design-lab', 'Experiment design', 'Try hypothetical burns and choose the next oxygen setting.', ['experiment design lab', 'design lab', 'plan a burn', 'design an experiment', 'design the next burn', 'choose the next oxygen level']],
    ['#transport-lab', 'Tracer transport', 'Follow a tracer release and watch the sensor respond.', ['tracer transport lab', 'transport lab', 'tracer lab', 'model a sensor response', 'follow a tracer release']],
    ['#transfer-lab', 'Matched experiments', 'Match two droplet tests and inspect the conditions they share.', ['transfer lab', 'matched experiment lab', 'compare droplet tests', 'compare droplet burns', 'match two experiments']],
    ['#physics?mode=rover', 'Rover sandbox', 'Open Physics Lab in rover mode to change cabin conditions.', ['rover mode', 'rover physics', 'rover cabin', 'rover simulator', 'simulate a rover cabin']],
    ['#rover-design', 'Rover design lab', 'Choose rover components and inspect the resulting design.', ['rover design', 'rover components', 'rover builder', 'design a rover', 'build a rover', 'choose rover components']],
    ['rover-workbench/prototype/index.html#workbench', '3D rover workbench', 'Inspect and adjust the rover in the 3D workbench.', ['3d rover', '3d workbench', 'rover workbench', '3d rover builder', 'build a rover in 3d']],
    ['judge-lab.html', 'Rover fire experiment', 'Compare two rover cabin fire trials and review the flight evidence.', ['rover experiment', 'run the rover experiment', 'rover fire lab']],
    ['detector.html', 'Detector signals', 'Compare the optical signal, instrument power and alarm flag from an ISS test.', ['detector signal', 'detector tool', 'check a detector signal', 'check a quiet detector']],
    ['evidence-guide.html', 'Choose a NASA investigation', 'Find studies that tested your material and measured the outcome you need.', ['nasa investigation guide', 'nasa evidence guide', 'investigation guide', 'choose a fire experiment', 'choose a nasa study']],
    ['technical-manual.html', 'Technical manual', 'Read the technical manual for the models and their implementation.', ['technical documentation', 'technical guide', 'technical docs']],
    ['tools.html', 'Tool directory', 'Browse or search the workspace tools by name and task.', ['search tools', 'available tools', 'all tools', 'tool list', 'list of tools', 'tool finder']],
    ['#study', 'Blind test', 'Open the blind evaluation and its practice material.', ['blind evaluation', 'evaluation lab', 'blind study', 'run a blind test']],
    ['#benchmark', 'Chat benchmark', 'Review the benchmark questions, answers and checks.', ['benchmark', 'chat evaluation', 'chat benchmarks']],
    ['#sources', 'Sources and methods', 'Find the publications, data downloads and methods behind the desk.', ['sources', 'methods', 'sources & methods', 'references', 'source library', 'download the records']],
    ['#guide', 'User guide', 'Read instructions for using the research workspace.', ['guide', 'user manual', 'documentation', 'docs', 'instructions']],
    ['#coverage', 'Archive coverage', 'See which experimental conditions the archive includes.', ['coverage', 'coverage map']],
    ['#claim', 'Check a claim', 'Compare a claim with its experimental conditions.', ['claim checker', 'claim workbench']],
    ['#chat', 'Research chat', 'Ask a question about the archive.', ['chat', 'research assistant']]
  ];

  const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[’']/g, "'").replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const byName = new Map();
  const byHref = new Map();
  for (const [href, label, answer, aliases] of destinations) {
    const destination = {href, label, answer};
    byHref.set(href, destination);
    for (const name of [label, ...aliases]) byName.set(normalize(name), destination);
  }

  function response(items, answer) {
    return {answer:answer || items[0].answer, links:items.map(({label, href}) => ({label, href}))};
  }

  function choices(hrefs, answer) {
    return response(hrefs.map(href => byHref.get(href)), answer);
  }

  // CSV row 1 is the header. These pinned Atlas tables have continuous nonempty
  // rows 2 through the listed last row, including settings without normalized
  // observations. The checksum binds each range to its published source file.
  const publishedAtlasTables = {
    'PSI-20': [['4aa5d3f98708ceacced5c620d46858b9965f8d4d941b203229f46467d53e5ab7', 19]],
    'PSI-22': [['69090c357b83ae38d161d29001d1d32b40fd77b13324ca6585ee990cdceef524', 33]],
    'PSI-25': [['71e792bf6b5fb5ea620c5dd70fbbac05515992e12aefcf5dff47312caa48c042', 130]],
    'PSI-26': [['ccfc3c54d948b64a1c5d2596a63c7c8019e51df0c91a1d62f039f48fa28c300f', 123]],
    'PSI-39': [['fb898e28762353aa132c16b886dbd207a024b1dd3c9bed5928d70d8036d2ec7e', 88]],
    'PSI-68': [['cc57ad1bd9977aa13e7ac6c3aa618303012686e232b36c052c6a9f1a74e5f528', 9]],
    'PSI-69': [['37c88ce8ae9391b7544ff630a45ce87543d04d317cdbfbed104fe7d5c27e1b96', 275]],
    'PSI-98': [['c01f29c62455f0a3b512290ab85e5687ecded326733189f002f580368402308d', 5]],
    'PSI-99': [['3c24390b9ef86f3d1ebaab911a1a3cc95a8759aebf42062371370e6d4b31b8ac', 16]],
    'PSI-100': [['4d3c717ec20dd0247db670b2784a9fd7d746788bc54a936f80693e48eb8cd117', 3]],
    'PSI-101': [['87164b7dc9168a4273c159f7a9f23699afbd06ad97b77974377e79b9bf8a3bef', 110]],
    'PSI-102': [['268d1e121d2f211b124407dd32b9475617bd269ede2c2d1749441da3e949a2af', 9]],
    'PSI-106': [['89ef980810ca6d9aa8be817b42e36cd2adff23f5e9058361b5a33d18b4363f4d', 13]],
    'PSI-107': [['fb0d7e60cf5367afb429089e9901d27288f78038efd26c8de1db4fbe04117136', 470]],
    'PSI-159': [['d95a621c3fbd27d204dd32ed29fa17d68f2b779d6a523cde8479ed7ebaa5251a', 180], ['d4d44f8b9896936728748e34d1b6ad0812032a92fa5289599b708c138e3a9b39', 155]],
  };

  function atlasHasRecord(id, study) {
    const [accession, tableNumber, rowNumber] = id.split(':');
    const atlas = window.FFAtlasEvidence;
    if (window.FF?.rawTables && atlas) return atlas.archive().rows.some(row => row.id === id);
    const table = publishedAtlasTables[accession]?.[Number(tableNumber) - 1];
    return Boolean(table &&
      (!study || study.tables?.[Number(tableNumber) - 1]?.sha256 === table[0]) &&
      id === accession + ':' + Number(tableNumber) + ':' + Number(rowNumber) &&
      Number(rowNumber) >= 2 && Number(rowNumber) <= table[1]);
  }

  // Never copy arbitrary URLs or labels supplied by a user or a saved session.
  function allowedLink(value) {
    const href = typeof value === 'string' ? value.replace(/^index\.html#/, '#') : '';
    const exact = byHref.get(href);
    if (exact) return exact;
    if (href === '#rover') return byHref.get('#physics?mode=rover');
    const caseId = href.match(/^#case\/(sibal|saffire|flex|same|cfig|ices|fm2)(?:\/(evidence|designs|brief))?$/);
    if (caseId) return {label:'Case library · ' + caseId[1].toUpperCase(), href, answer:'Open the case to inspect its evidence.'};
    if (href.length > 240) return null;
    const split = href.indexOf('?');
    const route = href.split('?')[0];
    if (split < 0 || !['#atlas', '#data'].includes(route)) return null;
    const params = new URLSearchParams(href.slice(split + 1));
    const entries = Array.from(params);
    if (entries.length !== 1) return null;
    const [name, id] = entries[0];
    const isStudy = name === 'study' && /^PSI-\d{1,5}$/.test(id);
    const isRecord = route === '#atlas' && name === 'record' && /^PSI-\d{1,5}(?::\d{1,8}){2}$/.test(id);
    if (!isStudy && !isRecord) return null;
    const archive = window.FF;
    const accession = id.split(':')[0];
    const study = archive?.investigations?.find(item => item.accession === accession);
    if (Array.isArray(archive?.investigations) && !study) return null;
    // Known catalog accessions include studies with no normalized Atlas rows.
    if (!archive?.investigations && !Object.hasOwn(publishedAtlasTables,accession) &&
        !['PSI-10','PSI-21','PSI-23','PSI-115'].includes(accession)) return null;
    if (route === '#atlas' && !Object.hasOwn(publishedAtlasTables, accession)) return null;
    if (isRecord && !atlasHasRecord(id, study)) return null;
    return {...byHref.get(route), label:byHref.get(route).label + ' · ' + id,
      href:route + '?' + name + '=' + encodeURIComponent(id)};
  }

  const lead = /^(?:(?:can|could|would) you (?:please )?)?(?:(?:take|bring|send|point|direct|guide) me to|(?:go|navigate|jump|switch|head|return) to|open|launch|visit|start|show me(?: the way to)?|link me to|give me (?:a|the) link to|help me find|find|access|use)\s+/i;
  const directions = /^(?:(?:where|how) (?:can|do|would|should) i|(?:can|could) i|where (?:is|are)|how (?:can|do) we|i(?: want|'d like| need) to|which (?:tool|lab|module|page) (?:lets me|can i use to|should i use to))\s+/;
  const simpleFollowup = /^(?:(?:(?:open|show me|go to|take me to|link me to) )?(?:it|that(?: one| tool| lab| page| record)?|there|the (?:first|second|third|last) one)|take me there|how do i get there|where can i (?:see|check|find|inspect) (?:it|that|that record|those records|those results))$/;

  function linksFrom(turn) {
    const candidates = turn?.links?.length ? turn.links : turn?.sources;
    const links = new Map();
    for (const link of Array.isArray(candidates) ? candidates : []) {
      const destination = allowedLink(link?.href || link?.url) ||
        (/^PSI-\d{1,5}$/.test(link?.id) ? allowedLink('#data?study=' + link.id) : null);
      if (destination) links.set(destination.href, destination);
      if (links.size === 4) break;
    }
    return [...links.values()];
  }

  function selectPrevious(query, turns, latest) {
    if (!latest.length) return null;
    const selection = query.replace(/^(?:and |no[, ]+)?(?:i (?:meant|wanted) )?/, '');
    const named = selection.match(/^(?:(?:open|show me|go to|take me to|link me to) )?(?:the )?([\w ]{1,40}) (?:one|option)$/);
    if (!simpleFollowup.test(selection) && !named) return null;
    const which = named?.[1] === 'that' ? '' : named?.[1];
    let choices = latest;
    // Only walk backward through replies that selected from the same menu.
    // A new task or a science turn starts its own context.
    if (which && choices.length === 1) {
      const selections = new Set([choices[0].href]);
      for (let i = turns.length - 1; i > 0; i--) {
        const question = normalize(turns[i]?.question).replace(/[?.!]+$/, '');
        if (!turns[i]?.links?.length || !/(?:\b(?:one|option)|^(?:open it|take me there))$/.test(question)) break;
        const preceding = linksFrom(turns[i - 1]);
        if (!preceding.length) break;
        if (preceding.length > 1) {
          if ([...selections].every(href => preceding.some(item => item.href === href))) choices = preceding;
          break;
        }
        selections.add(preceding[0].href);
      }
    }
    if (!which) return choices.length === 1 ? response(choices) : response(choices, 'Which destination did you mean?');
    const position = {first:0, second:1, third:2, fourth:3, last:choices.length - 1}[which];
    if (typeof position === 'number') return choices[position] ? response([choices[position]]) : response(choices, 'Choose one of these destinations.');
    const words = which.split(' ');
    const matches = choices.filter(item => words.every(word => normalize(item.label).split(' ').includes(word)));
    return matches.length === 1 ? response(matches) : null;
  }

  function goalDestination(task, priorLinks) {
    const goal = task.replace(/^(?:(?:can|could|would) you (?:please )?)?(?:help me |show me how to )?/, '');
    if (/^(?:find|look up|see|inspect|view|browse|access) (?:the )?(?:source |raw |original )?(?:data|records?|measurements?) (?:from|for|behind) (?:this|that|the last) (?:experiment|study|run|result)$/.test(goal)) {
      const records = priorLinks.filter(link => /^#(?:atlas|data)(?:[?]|$)/.test(link.href));
      return records.length ? response(records, 'Open the cited experimental data.') : response([byHref.get('#data')]);
    }
    const rules = [
      ['rover-workbench/prototype/index.html#workbench', /^(?:design|build|model|assemble|inspect|adjust|see|open)\b/, /\brover\b/, /\b(?:3d|3 d|three dimensional)\b/],
      ['#session', /^(?:walk|guide|take|lead) me through\b/, /\b(?:first|new|guided|starting)\b/, /\binvestigation\b/],
      ['technical-manual.html', /^(?:read|find|look up|see|review|browse)\b/, /\b(?:equations?|assumptions?|implementation)\b/, /\bmodels?\b/],
      ['#forecast', /^(?:get to|find|read|see|open|view|explore)\b/, /\b(?:predictions?|forecasts?)\b/, /\b(?:moon|lunar|fm2)\b/],
      ['#sources', /^(?:see|read|find|look up|check)\b/, /\b(?:data|records?|sources?|publications?)\b/, /\b(?:came from|provenance|source list|were published)\b/],
      ['#referee', /^(?:check|verify|validate|test)\b/, /\b(?:quote|quotation)\b/, /\b(?:source|original|cited|verbatim)\b/],
      ['#transfer-lab', /^(?:compare|match|pair) (?:two |2 |similar |matched )?droplet\b/, /\b(?:burns?|experiments?|trials?|tests?)\b/, /\b(?:under|with) (?:similar|matched|the same) conditions\b|\b(?:two|2|pair|match)\b/],
      ['#transport-lab', /^(?:model|simulate|trace|track|visualize|follow)\b/, /\b(?:smoke|tracer|aerosol)\b/, /\b(?:compartments?|cabins?|sensors?|transport|release|dispersion|airflow)\b/],
      ['judge-lab.html', /^(?:simulate|model|run|try|recreate|test)\b/, /\b(?:fire|flame|burn|combustion)\b/, /\brover\b/],
      ['#design-lab', /^(?:plan|choose|design|pick|select|set up)\b/, /\b(?:oxygen|o2)\b/, /\b(?:tests?|burns?|experiments?|trials?|next setting|next level)\b/],
      ['#physics', /^(?:change|set|adjust|vary|raise|lower|alter|simulate)\b/, /\b(?:oxygen|o2|pressure|ventilation|atmosphere)\b/, /\b(?:rover|cabin|habitat|compartment)\b/]
    ];
    for (const [href, action, subject, setting] of rules) {
      if (!action.test(goal) || !subject.test(goal) || !setting.test(goal)) continue;
      if (href === '#referee' && /["“”]|:\s/.test(goal)) continue;
      if (href === '#transfer-lab' && /\b(?:mean|median|maximum|minimum|average|duration|diameter|rate|width|count)\b/.test(goal)) continue;
      if (href === 'judge-lab.html') return choices([href, '#physics?mode=rover'],
        'Run the rover fire experiment to compare flame travel between two trials. The rover sandbox lets you change the cabin conditions.');
      const destination = href === '#physics' && /\brover\b/.test(goal) ? '#physics?mode=rover' : href;
      return response([byHref.get(destination)]);
    }
    return null;
  }

  function resolve(text, priorTurns = []) {
    if (typeof text !== 'string' || !text.trim() || text.length > 500) return null;
    const spoken = text.trim().replace(/[?.!]+$/, '').replace(/^please\s+|[, ]+please$/gi, '').trim();
    const query = normalize(spoken)
      .replace(/^(?:i'm (?:new here|a beginner)|i am new here)[.,! ]+/, '')
      .replace(/[, ]+(?:for me|if possible|please)$/, '');
    const turns = Array.isArray(priorTurns) ? priorTurns : [];
    const priorLinks = linksFrom(turns.at(-1));
    const selection = selectPrevious(query, turns, priorLinks);
    if (selection) return selection;
    if (/^(?:which|what) (?:nasa |iss |spacecraft )?(?:smoke )?detector (?:study|investigation|experiment|case) (?:would you|should i|can i) (?:check|consult|read|open|look at|start with)(?: first)?$/.test(query)) {
      return response([{label:'SAME smoke detector study', href:'#case/same/evidence'}],
        'Start with SAME. The study compares signals from two smoke detectors with their alarm thresholds.');
    }
    if (/^(?:where (?:do|can|should) i (?:start|begin)|how (?:do|can) i get started|what should i do first)$/.test(query)) {
      return response([byHref.get('#session')]);
    }
    const directHref = allowedLink(spoken.replace(lead, ''));
    if (directHref) return response([directHref]);
    const task = query.replace(directions, '')
      .replace(/^if (?:i|we) (.+?),? (?:where|how) (?:do|can|should) (?:i|we) (?:try|test|simulate) (?:that|this|it)$/, '$1')
      .replace(/[.!?,]+\s*(?:where (?:do|can|should) i (?:start|begin)|which (?:tool|lab|module|page) should i (?:use|open))$/, '');
    let target = task.replace(lead, '');
    target = target.replace(/^(?:get to|find|access|use|see|view|browse|run|try)\s+/, '')
      .replace(/^(?:the|a|an)\s+/, '').replace(/\s+(?:page|module|tool)$/, '');
    // Bare names and action phrases must match in full. Scientific requests
    // such as "show me why the forecast changes" continue to the normal chat.
    const exact = byName.get(target) || byName.get(task) || byName.get(query);
    if (exact) return response([exact]);
    const goal = goalDestination(task, priorLinks);
    if (goal) return goal;
    const navigationRequest = lead.test(query) || directions.test(query);
    if (/^(?:rover|rover tools?)$/.test(target)) {
      return choices(['#physics?mode=rover', '#rover-design', 'rover-workbench/prototype/index.html#workbench'], 'Use the sandbox for cabin physics, the design lab for components, or the workbench for the 3D rover.');
    }
    if (/^(?:labs|simulation labs|analysis labs|simulations|lab)$/.test(target)) {
      return choices(['#forecast', '#physics', '#design-lab', '#transport-lab'], 'Which part of the experiment would you like to work on?');
    }
    if (/^(?:help|navigation|directions|tools|workspace tools|what can i do here|(?:what|which) tools (?:are there|are available|can i use)|list (?:all |the )?tools)$/.test(target)) {
      return choices(['tools.html', '#session'], 'Search the tool directory by task, or start with a guided investigation.');
    }
    if (/^compare (?:two |2 )?(?:experiments|records|trials)$/.test(target)) {
      return choices(['#atlas', '#transfer-lab'], 'In Evidence Atlas, choose two NASA rows to compare. For droplet burns, Matched experiments lets you pair tests by their conditions.');
    }
    if (!navigationRequest) return null;
    const row = target.match(/^(?:(?:record|row|atlas record|source row) )?psi\s*(\d{1,5}):(\d{1,8}):(\d{1,8})$/);
    if (row) {
      const destination = allowedLink('#atlas?record=PSI-' + row.slice(1).join(':'));
      return destination ? response([destination]) : response([byHref.get('#atlas')], 'I couldn’t find that record in the source index. Search the available records in Evidence Atlas.');
    }
    const study = target.match(/^(?:(?:(?:raw|original|archived|source) )?(?:data|records|measurements|study|investigation|data explorer)(?: for| from)? )?psi\s*(\d{1,5})$/);
    if (study) {
      const destination = allowedLink('#data?study=PSI-' + study[1]);
      return destination ? response([destination]) : response([byHref.get('#data')], 'That study is not in the archive. Browse the studies in Data explorer.');
    }
    if (/^(?:(?:please |can you |could you )?(?:open|launch|navigate to|take me to|go to|switch to|link me to)\s+|where is (?:the )?.*\b(?:tool|lab|page|workbench)\b)/.test(query)) {
      return response([byHref.get('tools.html')], 'I couldn’t identify that destination. Search the tool directory by name or task.');
    }
    return null;
  }

  window.FFDirections = Object.freeze({resolve, isDestination:href => Boolean(allowedLink(href))});
})();

;
// Only a workspace served by the local Python service can use the installed model.
(() => {
  'use strict';
  const model = 'qwen3.8:27b';
  if (!['http:', 'https:'].includes(location.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;

  let available = false;
  let lastProbe = 0;

  function detect(info) {
    available = info?.ready === true && info.workspace_context === true && info.model === model;
    lastProbe = Date.now();
    return available;
  }

  async function ready(signal) {
    if (Date.now() - lastProbe < 15000) return available;
    const response = await fetch('/api/health', {signal, cache: 'no-store', credentials: 'omit', redirect:'error'});
    return detect(response.ok && response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : null);
  }

  function safeSource(source) {
    if (typeof source?.title !== 'string' || typeof source.url !== 'string') return false;
    if (/^#[\w/?=&%.-]+$/.test(source.url)) return true;
    try {
      const url = new URL(source.url);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch { return false; }
  }

  async function explain(message, turns, archive, signal) {
    try {
      if (!await ready(signal)) return archive;
      const history = turns.slice(-6).flatMap(turn => [
        {role:'user', content:turn.question.slice(0, 4000)},
        {role:'assistant', content:turn.answer.slice(0, 4000)}
      ]);
      const response = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit',
        redirect:'error', cache:'no-store', signal,
        body:JSON.stringify({message, history, caseId:archive.caseId})
      });
      if (!response.ok) return archive;
      const result = await response.json();
      if (result.model !== model || result.method !== 'local grounded synthesis' ||
          !['answered','limited'].includes(result.status) || !result.usage?.inferences ||
          !Array.isArray(result.citations) || !result.citations.length ||
          !result.citations.every(safeSource) || !result.synthesis_receipt ||
          typeof result.answer !== 'string' || !result.answer.trim()) return archive;
      return {...archive, answer:result.answer, sources:result.citations, status:result.status,
        synthesizedBy:model, model, mode:'local', latency:result.elapsed_ms};
    } catch (error) {
      if (signal.aborted) throw error;
      return archive;
    }
  }

  window.FFQwen = {explain, detect};
})();

;
/* Chat is local to this tab. Text from users, imported storage and responses only enters text nodes. */
(() => {
  'use strict';

  const STORAGE_KEY = 'first-fire.chat.v1';
  const MAX_MESSAGE = 2000;
  const MAX_HISTORY = 12;
  const EXAMPLES = [
    ['Materials', 'Did the Nomex ignite in Saffire-II sample 2-7?', 'saffire'],
    ['Archive calculation', 'Compare mean burn duration for methanol and heptane in FLEX.', 'flex'],
    ['Lunar forecast', 'Have any of the four FM² burns been observed on the Moon?', 'fm2']
  ];
  const SUBJECTS = {
    sibal: /\b(?:sibal|luci)\b/i,
    saffire: /\b(?:saffire[ -]?(?:ii|2)\b|nomex|2-7\b)/i,
    flex: /\b(?:flex(?:-\d+)?|heptane|c03h201|c12h201)\b/i,
    same: /\b(?:[Ss]ame-[Rr]|SAME(?:-R)?|[Kk]apton|KAPTON|[Tt]eflon|TEFLON)\b/,
    cfig: /\b(?:cfi[ -]?g|21202|21088a1)\b/i,
    ices: /\b(?:ices|p213|polycarbonate)\b/i,
    fm2: /\bfm(?:2\b|²)|synergy pro navy/i
  };
  const RESPONSE_STATUSES = new Set(['answered', 'limited', 'abstained']);
  let stopPreviousView;
  let memory;
  let navigationDraft;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(label, onClick, className) {
    const control = node('button', label, className);
    control.type = 'button';
    control.addEventListener('click', onClick);
    return control;
  }

  function link(label, url, className) {
    const anchor = node('a', label, className);
    anchor.href = url;
    return anchor;
  }

  function sourceURL(raw) {
    if (typeof raw !== 'string') return null;
    if (/^#(?:case\/[\w-]+(?:\/[\w-]+)?|data(?:\?[^\s]*)?|report\/[\w-]+|physics(?:\?mode=rover)?|referee(?:\?view=errors)?|atlas|compass|passports|rulebook|earth|forecast|sources|acrylic|study|guide|benchmark)$/.test(raw)) return raw;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null;
    } catch { return null; }
  }

  function normalizeSource(source) {
    if (!source || typeof source.title !== 'string') return null;
    const url = sourceURL(source.url);
    return url && {id: String(source.id || ''), title: source.title.slice(0,350), locator: String(source.locator || '').slice(0,1600), url};
  }

  function safeDirections(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && typeof item.label === 'string' && item.label.trim() &&
      typeof item.href === 'string' && window.FFDirections?.isDestination(item.href));
  }

  // A receipt or explanation still refers to its original turn. Stop at the
  // first other turn so a new question never inherits an unrelated citation.
  function evidenceHistory(context) {
    let end = context.length;
    while (end && context[end - 1].evidenceFollowup === true) end--;
    return end === context.length ? context : context.slice(0, end);
  }

  function evidenceTurn(context) {
    return evidenceHistory(context).at(-1);
  }

  function previousCase(context) {
    const turn = evidenceTurn(context);
    if (!turn || turn.status === 'abstained' || !turn.sources?.length || turn.mode === 'calculation') return;
    const cases = window.FF?.cases || [];
    if (turn.caseId) return cases.find(item => item.id === turn.caseId);
    // Older saved replies and service responses may have citations without a case ID.
    const cited = cases.filter(item => turn.sources.some(source =>
      source.url === '#case/' + item.id || item.sources.some(publication => publication.url === source.url)));
    if (cited.length === 1) return cited[0];
    const named = cited.filter(item => SUBJECTS[item.id]?.test(turn.question));
    if (named.length === 1) return named[0];
  }

  function detailRequest(text) {
    const q = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/^(?:please |(?:can|could|would) you (?:please )?)/, '');
    const referent = /\b(?:this|that|the|previous|same|its) (?:experiment|study|investigation|test|case|result|setup|procedure|finding)s?\b|\b(?:it|that|this|they|those)\b/;
    const expansion = /\b(?:detailed|detail|details|elaborate|expand|explain|describe|walk me through|tell me more|say more|what happened|how (?:did|was|were))\b/;
    return /^(?:tell me more|go on|continue|say more|(?:please )?elaborate|more details?(?: please)?|(?:explain|expand|go) (?:further|deeper)|what happened|how so)$/.test(q)
      || (referent.test(q) && expansion.test(q) && /\b(?:it|them|that|this|experiment|study|investigation|test|case|result|setup|procedure|findings?|conducted|performed|work|done|happen|detail|details|more|further|depth|please)$/.test(q));
  }

  // These are the project's source-backed passage records. Each paragraph keeps
  // its own publication and locator, including distinct flight and ground sources.
  const nomexFiber = {
    id:'saffire:fiber', title:'DuPont · Technical guide for Nomex fiber',
    url:'https://www.dupont.com/content/dam/dupont/amer/us/en/personal-protection/public/documents/en/Nomex%28R%29%20Fiber%20Technical%20Guide.pdf',
    locator:'Section I, printed p. 1, “What is Nomex?” and “Molecular structure of Nomex fiber.”',
    text:'Nomex is a family of heat-resistant fibers. Its meta-aramid polymer gives the fiber its flame resistance. One familiar use is protective clothing for firefighters.'
  };
  function caseReading(subject, fields) {
    const passages = [nomexFiber, ...(window.FFRefereePassages || [])];
    const sources = [];
    const paragraphs = [];
    for (const field of fields) {
      const passage = passages.find(item => item.id === subject.id + ':' + field);
      if (!passage) continue;
      const source = normalizeSource(passage);
      if (!source) continue;
      let index = sources.findIndex(item => item.url === source.url && item.locator === source.locator);
      if (index < 0) index = sources.push(source) - 1;
      paragraphs.push(passage.text + ' [' + (index + 1) + ']');
    }
    if (!paragraphs.length) return;
    return {caseId:subject.id, mode:'archive', evidenceKind:'archive-note', status:'limited',
      answer:subject.short + (subject.id === 'saffire' ? ' · sample 2-7' : ' · ' + subject.title) + '\n\n' + paragraphs.join('\n\n'), sources};
  }

  function contextualReading(message, history) {
    const q = message.trim().replace(/[.!?]+$/, '');
    const subjects = (window.FF?.cases || []).filter(item => SUBJECTS[item.id]?.test(q));
    if (subjects.length === 1 && subjects[0].id === 'saffire' && /^(?:(?:can|could|would) you (?:please )?)?(?:what is|what[’']s|tell me about|explain(?: to me)?(?: about)?|describe) (?:the )?nomex(?: (?:fabric|material))?$/i.test(q)) {
      return caseReading(subjects[0], ['fiber','time']);
    }
    // A new named experiment or run must be resolved on its own terms.
    if (subjects.length || /\b(?:PSI[- ]?\d+|(?:run|sample|test)\s+\d+|Apollo|Mir|BASS|ACME|Saffire)\b/i.test(q)) return;
    const subject = previousCase(history);
    if (detailRequest(q)) {
      if (subject) {
        const fields = subject.id === 'saffire' ? ['record','time','reason','ground'] : ['record','reason','limit'];
        return caseReading(subject, fields);
      }
      const turn = evidenceTurn(history);
      if (turn?.sources?.length && turn.status !== 'abstained') {
        const pinned = (window.FFRefereePassages || []).filter(p => turn.sources.some(s => s.id === p.id && s.url === p.url));
        const more = pinned.filter(p => !turn.answer.includes(p.text)).map(p => {
          const index = turn.sources.findIndex(s => s.id === p.id && s.url === p.url);
          return p.text + ' [' + (index + 1) + ']';
        });
        return {mode:'archive', status:turn.status, evidenceKind:turn.evidenceKind === 'archive-calculation' ? 'calculation-explanation' : 'archive-note',
          evidenceFollowup:true, sources:turn.sources,
          answer:[explainEvidence(turn), ...more].join('\n\n')};
      }
      return {mode:'conversation', status:'limited', sources:[],
        answer:'Which experiment would you like me to explain? Give me its name, sample number, or the material NASA tested.'};
    }
    if (!subject) return;
    if (/^(?:(?:and|so) )?(?:(?:what (?:are|were) (?:its|the|its main)|any) (?:limitations?|caveats?)|where does (?:that|this) apply)$/i.test(q)) return caseReading(subject,['limit']);
    if (subject.id === 'saffire' && /^(?:(?:and|so) )?(?:how long did (?:it|the (?:material|fabric|test|sample|experiment|burn)) (?:burn|last)|what was (?:its|the) (?:burn )?duration|what (?:actually )?(?:caught fire|burned|ignited))$/i.test(q)) return caseReading(subject,['time']);
  }

  function selectedRowLinks(analysis) {
    const rows = analysis.rows;
    const representatives = Array.isArray(analysis.groups) ? analysis.groups.map(group => group?.rows?.[0]) : [];
    const links = [];
    const seen = new Set();
    for (const id of representatives.concat(rows)) {
      if (links.length === 4) break;
      if (typeof id !== 'string' || !/^PSI-\d{1,5}(?::\d{1,8}){2}$/.test(id) || seen.has(id)) continue;
      if (representatives.includes(id) && !rows.includes(id)) continue;
      seen.add(id);
      links.push({label:id, href:'#atlas?record=' + encodeURIComponent(id)});
    }
    return safeDirections(links);
  }

  function explainEvidence(turn) {
    if (turn.status === 'abstained') return 'The archive did not verify an answer to that question.';
    if (turn.evidenceKind === 'lunar-outcome' && /0 verified lunar burn outcomes out of 4/i.test(turn.answer)) {
      return 'The project lists four planned burns. Its outcome register has no verified result for any of them yet, so we don’t know how many sustained a flame. [1]';
    }
    if (turn.evidenceKind === 'archive-calculation') {
      return turn.answer.replace(/([\d.,]+)% meet the requested condition \((\d+) of (\d+) rows\)\./g, '$2 of the $3 archive rows met the condition ($1%).')
        .replace(/Selection: /g, 'Records checked: ')
        .replace(/normalized observation rows?/gi, match => match.endsWith('rows') ? 'archive rows' : 'archive row')
        .replace(/Mean /g, 'Average ').replace(/descriptive summaries over the recorded conditions/g, 'summaries of what the archive recorded');
    }
    if (turn.evidenceKind === 'quote-only') return 'The available source supports the quoted passage. The desk could not verify a fuller interpretation. [1]';
    // Preserve numbers, restrictions and citations in claims without a hand-written gloss.
    return turn.answer.replace(/\bPMMA\b(?! \()/g, 'PMMA (acrylic)').replace(/\bvisible extinction\b/gi, 'the point when the visible flame went out');
  }

  function conversationReply(message, context) {
    const intent = message.trim().replace(/[.!?]+$/, '').toLowerCase().replace(/’/g, "'");
    if (/^(?:(?:hello|hey|hi)(?: there| first fire)?|help(?: me)?|(?:can|could|would) you help(?: me)?|i need help|how (?:does this|do you) work|what can (?:i ask|you do))$/.test(intent)) {
      return {status:'answered', mode:'conversation', sources:[],
        answer:'I can look up a NASA fire experiment, compare measurements or help you find a tool. Which experiment or cabin condition are you interested in?'};
    }
    if (/^(?:thanks|thank you)(?: so much)?$/.test(intent)) {
      return {status:'answered', mode:'conversation', evidenceFollowup:true, sources:[], answer:'You’re welcome.'};
    }
    if (/^(?:are you (?:a (?:real )?(?:person|human)|an? (?:ai|bot))|who are you)$/.test(intent)) {
      return {status:'answered', mode:'conversation', sources:[], answer:'I’m FIRST FIRE’s research assistant. I can look up published experiments and measurements in this workspace.'};
    }
    const turn = evidenceTurn(context);
    const pageRequest = /^(?:which|what) page(?: of (?:the|that|this) (?:report|paper|study))?(?: (?:can|could|should) i (?:read|check|look at)| is (?:this|that) on)?$/.test(intent);
    const sourceNumber = /^(?:(?:open|show(?: me)?|explain) )?(?:source|citation|reference)\s*(?:#|number )?\[?(\d+)\]?$/.exec(intent);
    const sourceRequest = pageRequest || !!sourceNumber || /^(?:sources?|citations?|references?|(?:please )?cite (?:your|the) sources?|(?:show(?: me)?|give me|can i see|where (?:can|do) i (?:find|see|check)|can you (?:show me|give me)) (?:the |your )?(?:sources?|citations?|references?|paper|report|rows?|data|records?|evidence)(?: (?:for|behind|from) (?:that|this|those|the)(?: (?:result|answer|calculation|number|experiment|rows|results))?)?|what(?:'s| is) (?:the|your) source|where did (?:that|this) come from|where can i check that|which (?:source|page)|what page(?: is (?:that|this) on)?)$/.test(intent);
    const plainRequest = /^(?:(?:can|could|would) you )?(?:(?:explain|say|put|summarize|rephrase) (?:that|this|it|your (?:answer|result)) (?:more simply|in (?:plain english|plain language|simple(?:r)? (?:terms|words)))|(?:in )?(?:plain english|simpler terms)(?: please)?|what does (?:that|this) mean)$/.test(intent);
    if ((sourceRequest || plainRequest) && turn && turn.mode !== 'navigation' && turn.mode !== 'conversation') {
      const sources = Array.isArray(turn.sources) ? turn.sources.map(normalizeSource).filter(Boolean) : [];
      const reply = {status:turn.status, mode:'conversation', evidenceFollowup:true, sources};
      if (plainRequest) return {...reply, answer:explainEvidence(turn)};
      if (sourceNumber) {
        const index = Number(sourceNumber[1]) - 1;
        const source = sources[index];
        return {...reply, answer:source ? source.title + ' [' + (index + 1) + ']. ' + source.locator :
          'That answer has ' + sources.length + ' cited ' + (sources.length === 1 ? 'source.' : 'sources.')};
      }
      if (turn.status === 'abstained') {
        return {...reply, answer:sources.length ? 'I couldn’t verify an answer. The related records below are leads for further reading.' : 'I couldn’t verify an answer or identify a supporting record for that question.'};
      }
      if (turn.evidenceKind === 'archive-calculation' && Array.isArray(turn.analysis?.rows)) {
        const links = selectedRowLinks(turn.analysis);
        const count = turn.analysis.rows.length;
        const answer = !count ? 'No normalized observations matched this selection.' : links.length < count
          ? 'The selection contains ' + count + ' archive rows. These are ' + links.length + ' examples. The calculation receipt on the original answer includes the full selection.'
          : 'Open the selected archive ' + (count === 1 ? 'row' : 'rows') + ' to inspect the recorded values.';
        return {...reply, answer, links};
      }
      if (sources.length) {
        const primary = sources.findIndex(source => source.url.startsWith('https:'));
        const index = /\bpage\b/.test(intent) && primary >= 0 ? primary : 0;
        const source = sources[index];
        return {...reply, answer:'The answer cites ' + source.title + ' [' + (index + 1) + '].' + (source.locator ? '\n\n' + source.locator : '')};
      }
      return {...reply, answer:'That reply did not cite a source.'};
    }
    const directions = window.FFDirections?.resolve(message, context);
    if (!directions?.answer) return null;
    return {status:'answered', mode:'navigation', sources:[], answer:directions.answer,
      links:safeDirections(directions.links)};
  }

  function newThread() {
    return {id: globalThis.crypto?.randomUUID?.() || String(Date.now()) + String(Math.random()).slice(2), turns: []};
  }

  function readStore() {
    if (memory) return memory;
    let data;
    try { data = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { /* private browsing */ }
    const threads = [];
    if (data?.version === 1 && Array.isArray(data.threads)) {
      for (const thread of data.threads) {
        if (typeof thread?.id !== 'string' || !Array.isArray(thread.turns)) continue;
        thread.turns = thread.turns.filter(t => typeof t?.question === 'string' && typeof t.answer === 'string')
          .map(t => ({...t, sources: Array.isArray(t.sources) ? t.sources.map(normalizeSource).filter(Boolean) : []}));
        if (thread.turns.length) threads.push(thread);
      }
    }
    if (threads.some(thread => thread.id === data?.current)) {
      return memory = {current:data.current, threads};
    }
    const first = newThread();
    threads.push(first);
    return memory = {current: first.id, threads};
  }

  function questionTitle(text) {
    return text.length > 58 ? text.slice(0,55).replace(/\s+\S*$/, '') + '…' : text;
  }

  function localOrigin() {
    return ['http:', 'https:'].includes(location.protocol) && ['127.0.0.1','localhost','[::1]'].includes(location.hostname);
  }

  async function checkService() {
    if (!localOrigin()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/health', {cache:'no-store', credentials:'omit', signal:controller.signal});
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
      const info = await response.json();
      if (window.FFQwen?.detect(info)) return null;
      return info.ready === true && typeof info.model === 'string' ? info : null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  function history(turns) {
    return turns.slice(-MAX_HISTORY / 2).flatMap(t => [
      {role:'user', content:t.question.slice(0,4000)},
      {role:'assistant', content:t.answer.slice(0,4000)}
    ]);
  }

  async function askService(message, turns, signal) {
    const response = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit', cache:'no-store',
      body:JSON.stringify({message, history:history(turns)}), signal
    });
    if (!response.ok) throw Error('The local service returned HTTP ' + response.status + '.');
    const answer = await response.json();
    if (!RESPONSE_STATUSES.has(answer.status) || typeof answer.answer !== 'string' || !answer.answer.trim() || !Array.isArray(answer.citations)) {
      throw Error('The local service returned an unreadable answer.');
    }
    return {
      answer:answer.answer, status:answer.status, sources:answer.citations.map(normalizeSource).filter(Boolean),
      mode:'local', model:typeof answer.model === 'string' ? answer.model : '', latency:answer.elapsed_ms
    };
  }

  function excerpt(caseData, item, answer) {
    return {
      answer, status:'limited', mode:'archive', model:'Stored case excerpt', caseId:caseData.id,
      sources:[...caseData.sources.slice(0,2),{title:'Open the '+caseData.short+' case',url:'#case/'+caseData.id,locator:'FIRST FIRE case notes'}]
        .map(s=>normalizeSource({...s,id:s.id || caseData.id})).filter(Boolean), item
    };
  }

  // Use the published mission records and the same intent patterns as chat/incidents.py.
  function incidentReply(question, previousTurns) {
    const data = window.FF?.incidents;
    if (!data) return null;
    const normal = text => text.normalize('NFKD').toLowerCase().replace(/[–−]/g, '-').trim();
    const test = (pattern, q) => new RegExp(pattern).test(q);
    const full = (pattern, q) => test('^(?:' + pattern + ')$', q);
    const matching = q => data.records.filter(record => test(record.match, q));
    const removeNames = (q, records) => records.reduce((text, record) =>
      text.replace(new RegExp('(?:' + record.match + ")(?:[’']s)?", 'g'), ' ').trim(), q);
    const intents = q => Object.keys(data.intents).filter(key => test(data.intents[key], q));
    const followup = q => test(data.reference, q) || (full(data.followup, q) && intents(q).length > 0);
    function earlier() {
      for (const turn of [...previousTurns].reverse()) {
        const q = normal(turn.question);
        if (test(data.research, q)) break;
        const records = matching(q);
        if (records.length) return test(data.unknown_named, removeNames(q, records)) ? [] : records;
        if (test(data.unknown_named, q) || !followup(q)) break;
      }
      return [];
    }
    function abstain(reason, name = '') {
      return {status:'abstained', answer:data.messages[reason].replace('{name}', name), sources:[], mode:'archive'};
    }
    const q = normal(question);
    let records = matching(q);
    const rest = removeNames(q, records);
    const extraSubjects=records.length && /\b(?:nomex|saffire|flex-?\d*|gas burner|hospital|rover|gaganyaan|mercury|sibal|luci|teflon|synergy pro|fm2)\b/i.test(q);
    if(extraSubjects)return abstain('mixed');
    if (test(data.research, q)) return records.length ? abstain('mixed') : null;
    if (test(data.unknown_named, rest)) return abstain('unknown');
    const comparePrevious = records.length > 0 && test(data.compare_reference, q);
    if (comparePrevious) records = [...new Set([...earlier(), ...records])];
    if (!records.length && followup(q)) records = earlier();
    if (!records.length) {
      if (test(data.unknown, q)) return abstain(/\bapollo\b/.test(q) ? 'ambiguous' : 'unknown');
      return null;
    }
    const facets = intents(rest.replace(/\s+/g, ' ').trim());
    if (!facets.length && records.length > 1 && (comparePrevious || test(data.compare, q))) facets.push('comparison');
    if (!facets.length && (full(data.overview, rest) || comparePrevious)) facets.push('overview');
    const paragraphs = new Set();
    const sources = new Map();
    for (const record of records) {
      if (!facets.length || facets.some(key => !record.facts[key])) return abstain('unsupported', record.name);
      for (const key of facets) {
        for (const fact of record.facts[key]) {
          if (!sources.has(fact.source)) sources.set(fact.source, normalizeSource(data.sources[fact.source]));
          const number = Array.from(sources.keys()).indexOf(fact.source) + 1;
          paragraphs.add(fact.text + ' [' + number + ']');
        }
      }
    }
    return {answer:[...paragraphs].join('\n\n'), status:'answered', sources:[...sources.values()], mode:'archive'};
  }

  // Translate only surface forms of existing archive predicates. Unbound nouns, units,
  // negations and conjunctions must reach the strict parser so it can ask for clarification.
  const digits=['zero','one','two','three','four','five','six','seven','eight','nine','ten',
    'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens=['twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const smallNumber=digits.join('|');
  const writtenNumber='(?:'+tens.join('|')+')(?:[ -](?:'+digits.slice(1,10).join('|')+'))?|'+smallNumber+'|an?';
  const measuredUnits='(?:minutes?|mins?|seconds?|secs?|millimet(?:er|re)s?|centimet(?:er|re)s?|percent(?:age)?|percentage points?|atmospheres?|psia|kpa|mmhg|bar|mm|cm|mg/s|cm/s|mm/s|m/s|atm|g)\\b|%';
  const writtenWithUnit=new RegExp('\\b('+writtenNumber+')(?=\\s+(?:'+measuredUnits+'))','gi');
  const archiveRowNoun='(?:rows?|records?|observations?|runs?|entries|samples?|tests?)';
  const membership=new RegExp('\\b('+archiveRowNoun+')\\s+(?:that\\s+|which\\s+)?(?:use[sd]?|using|contain(?:s|ed)?|containing)\\s+','gi');
  const accessionOrStudy='(?:PSI[- ]?\\d+|[\\w]+(?:-[\\w]+)*)';
  const studyContains=new RegExp('\\b(?:does|did|do)\\s+(?:the\\s+)?('+accessionOrStudy+')\\s+(?:contain|include|have|hold)\\b','gi');
  function calculatorInput(question) {
    function translate(clause) {
      return clause
        .replace(/\b(PSI[- ]?\d+|[a-z][\w-]*)\s+study\b/gi,(original,name)=>{
          const lower=name.toLowerCase().replace(/^psi[- ]?/,'psi-');
          return window.FF?.investigations?.some(i=>[i.name,i.accession].some(s=>s.toLowerCase()===lower))?name:original;
        })
        .replace(/\b(?:belong(?:s|ed|ing)?\s+to|(?:are|were|is)\s+part\s+of)\b/gi,'in')
        .replace(studyContains,'in $1')
        .replace(membership,'$1 with ')
        .replace(/\b(?:using|used)\s+(?:the\s+)?(?:fuel|material)\b/gi,'with material')
        .replace(/\b(normal|inverse)[- ]flames?\b(?!\s+(?:duration|time|extinction|diameter))/gi,'$1')
        .replace(/\bdroplets\b/gi,'droplet')
        .replace(/\b(?:(?:does|did|do)\s+not|never)\s+exceed\b/gi,'at most')
        .replace(/\bexceed(?:s|ed|ing)?\b/gi,'above')
        .replace(writtenWithUnit,match=>{
          const words=match.toLowerCase().split(/[ -]/);
          if(words[0]==='a'||words[0]==='an')return '1';
          const ten=tens.indexOf(words[0]);
          return String(ten<0?digits.indexOf(words[0]):(ten+2)*10+(words[1]?digits.indexOf(words[1]):0));
        });
    }
    // Quoted specimen labels are data: preserving punctuation and spelling is essential for an exact match.
    return question.split(/("[^"]*"|“[^”]*”)/).map((part,i)=>i%2?part:translate(part)).join('');
  }

  const groupReference=/\b(?:those|these|them|their|its|it|(?:that|this|the (?:previous|same)) (?:study|group|subset|selection|set|investigation|samples?|runs?|tests?|observations?|records?|rows?))\b/i;
  const quantifier=/\b(?:how many|count|number of|total|percent(?:age)?|share|fraction|proportion|mean|median|average|range|lowest|highest|smallest|largest|maximum|minimum)\b/i;
  function archiveRequest(question,prior) {
    const input=calculatorInput(question);
    const plain=input.replace(/"[^"]*"|“[^”]*”/g,'');
    const follow=/^(?:and\b|of those\b|among those\b|for those\b|what about\b|how about\b|within those\b|which of (?:those|them)\b)/i.test(plain);
    const scoped=groupReference.test(plain) && (quantifier.test(plain) || (follow && !!prior?.analysis?.plan));
    if(!scoped)return {input};
    if(prior?.evidenceKind!=='archive-calculation' || !Array.isArray(prior.analysis?.rows))return {input,missingScope:true};
    const resolved=input.split(/("[^"]*"|“[^”]*”)/).map((clause,i)=>i%2?clause:
      clause.replace(/\b(?:that|this|the (?:previous|same)) (?:study|group|subset|selection|set|investigation|samples?|runs?|tests?|observations?|records?|rows?)\b/gi,'those')
        .replace(/\bits\b/gi,'their')).join('');
    return {input:/^of those\b/i.test(resolved)?resolved:'Of those, '+resolved,scope:true};
  }

  // The previous numerator is the population for "of those". This also preserves
  // the denominator of a new percentage when a previous selection used a numeric limit.
  function selectedArchive(prior,archive) {
    const ids=new Set(prior.analysis.rows);
    return {...archive,tests:archive.tests.filter(row=>ids.has(row.record_id))};
  }

  function observedLunarOutcome(question, previous, forecast) {
    if(!forecast || !Array.isArray(forecast.burns))return null;
    const q=question.normalize('NFKC').toLowerCase();
    if (/\b(?:igniter|hardware)\b/.test(q) && /\b(?:scor(?:e|ed|ing)|classif(?:y|ied|ication)|count(?:s|ed)? as)\b/.test(q)) return null;
    const explicit=/\bfm[- ]?2\b|flammability of materials on the moon|(?:lunar|moon) (?:surface )?(?:fabric )?(?:burns?|tests?)|burns? on the moon|synergy pro navy/.test(q);
    const mentionsOutcome=/\b(?:succeed(?:ed)?|fail(?:ed)?|success(?:es|ful)?|outcomes?|results?|burned|sustained|spread|resolved|completed|(?:been|were|are) (?:observed|reported|verified|confirmed))\b/.test(q);
    const resumed=previous.at(-1)?.evidenceKind==='lunar-outcome' && mentionsOutcome &&
      /^(?:and |how many|what (?:share|percent|fraction|rate)|what about|of those|have any|did any)/.test(q);
    if(!explicit && !resumed)return null;
    if(/\b(?:hypothetical(?:ly)?|simulate[d]?|suppos(?:e|ing)|imagine|if|what if|assuming|brier|assume)\b/.test(q))return null;
    const observation=/\b(?:observed|actual(?:ly)?|measured|verified|confirmed|completed|already|succeeded|failed|flew|flown|so far|to date|in reality|results? (?:are|were|available)|did .*?(?:burn|spread|happen)|have .*?(?:burned|sustained|spread|reported|returned))\b/.test(q);
    const rate=/\b(?:success rate|observed rate|fraction|percentage|percent|share|proportion)\b/.test(q);
    const predictive=/\b(?:predict(?:ed|ion)?|forecast|expects?|expected|estimate[d]?|chance|odds|model|likely)\b/.test(q);
    if(!observation && (!rate || predictive))return null;
    if(!observation && !/\b(?:success|successes|successful|succeed|failed|failure|burned|completed|sustain(?:ed)?)\b/.test(q))return null;
    const resolved=forecast.burns.filter(b=>b.outcome===true || b.outcome===false || b.outcome==='yes' || b.outcome==='no');
    const yes=resolved.filter(b=>b.outcome===true || b.outcome==='yes').length;
    const sources=[{id:'fm2-outcomes',title:'FIRST FIRE · public FM² outcome register',url:'#forecast',locator:'Release dated '+forecast.as_of+' · recorded outcomes for the four planned burns'}];
    const design=forecast.sources.find(s=>s.id==='lpsc-slides');
    if(design)sources.push(normalizeSource(design));
    let answer='The '+forecast.as_of+' release records '+resolved.length+' verified lunar burn outcomes out of '+forecast.burns.length+' planned FM² tests. [1]';
    if(!resolved.length)answer+=' With zero resolved tests, the observed success fraction is undefined. There is no measured success percentage to report. [1]';
    else answer+=' Of those '+resolved.length+' resolved tests, '+yes+' sustained spread ('+(100*yes/resolved.length).toFixed(2)+'%). [1]';
    if(design)answer+='\n\nNASA’s experiment design specifies the planned starting atmospheres. The published predictions can be compared with official outcomes once those outcomes are recorded. [2]';
    return {mode:'archive',evidenceKind:'lunar-outcome',status:resolved.length?'answered':'limited',answer,sources};
  }

  const caseFollowups = {
    saffire:/^(?:(?:what|which) (?:material|part)(?: actually)? (?:burned|ignited)|why did (?:it|the (?:fabric|nomex)) turn black)\??$/i,
    sibal:/\b(?:aircraft|parabola)\b.*\b(?:same|that) extinction delay\b|\bboth of those runs\b.*\boxygen\b.*\bconstant\b/i,
    same:/\bmicrograph\b.*\bsample 56\b.*\balarm\b/i,
    cfig:/\bA2 run\b.*\b(?:both|too)\b/i,
    ices:/\bboth materials[’']? (?:ground )?limits\b.*\bsame amount\b/i
  };

  async function askArchive(question, previousTurns) {
    const incident = incidentReply(question, previousTurns);
    if (incident) return incident;
    const knownCases = window.FF?.cases || [];
    const selected = knownCases.filter(c => SUBJECTS[c.id]?.test(question));
    let carried = false;
    const referenced = previousCase(previousTurns);
    if (!selected.length && referenced && (caseFollowups[referenced.id]?.test(question) || /^(?:(?:and|then|so)\b\s*)?(?:what (?:would|should|did|is|are|was|were) (?:we|they|the limit|its|the next)|what next|why (?:did|does|was|is) (?:it|that|this|the (?:sample|fabric))\b|which source|what limits|what (?:does|would) (?:it|that|this)|tell me more|could (?:it|this)|what was measured)/i.test(question))) {
      selected.push(referenced);
      carried=true;
    }
    if (selected.length === 1) {
      const subject = selected[0];
      const heading = (carried ? 'Continuing with ' : 'From the archived case on ') + subject.short + '.';
      if (/\bnext\b(?!\s+to\b)|reanalysis|what (?:should|would|could) (?:we|they) test/i.test(question)) return excerpt(subject,'next',heading+'\n\nSuggested next test\n'+subject.next);
      if (/caveat|limitations?|limits|boundar|transfer|apply (?:it|this)/i.test(question)) return excerpt(subject,'limits',heading+'\n\nLimits of this comparison\n'+subject.limit);
      return excerpt(subject,'case',heading+'\n\nRecorded finding\n'+subject.record+'\n\nCase interpretation\n'+subject.decision);
    }
    if (!window.FFSearch) throw Error('The search index is missing from this copy of the dashboard.');
    const found = await window.FFSearch.search(question);
    const candidates = found.items.filter(item=>item.matches > 0 && item.score >= 0.36).slice(0,3);
    const sources = candidates.map(item=>normalizeSource({id:item.url,title:item.title,url:item.url,locator:item.lead})).filter(Boolean);
    return {
      answer:sources.length ? 'These archive records share terms with your question. Check the material, conditions and measurement in each source before drawing a conclusion.' : 'I could not identify an applicable case in the archive. Try an investigation, material or run identifier, or open the Data explorer to inspect individual records.',
      status:'abstained', sources, mode:'archive', model:'Archive search'
    };
  }

  // Citation actions use the same URL validation as the source list.
  function showAnswer(turn, index, retry, earlier) {
    const article = node('article', undefined, 'ffchat-reply');
    article.tabIndex = -1;
    article.setAttribute('aria-label', 'FIRST FIRE answer');
    const byline = node('div', undefined, 'ffchat-byline');
    const mark = node('img');
    mark.src = 'icon.svg';
    mark.alt = '';
    mark.width = 24;
    mark.height = 24;
    byline.append(mark, node('span', 'First Fire'));
    if (turn.synthesizedBy === 'qwen3.8:27b') byline.append(node('small', 'Qwen 3.8 27B · local'));

    const sources = node('details', undefined, 'ffchat-sources');
    const sourceLinks = [];
    if (turn.sources.length) {
      const label = turn.status === 'abstained' ? 'Related records' : 'Sources';
      sources.append(node('summary', label + ' (' + turn.sources.length + ')'));
      const list = node('ol');
      for (const source of turn.sources) {
        const anchor = link(source.title, source.url);
        if (!source.url.startsWith('#')) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
        }
        const item = node('li');
        item.append(anchor);
        if (source.locator) item.append(node('small', source.locator));
        list.append(item);
        sourceLinks.push(anchor);
      }
      sources.append(list);
    }

    const body = node('div', undefined, 'ffchat-answer-text');
    for (const paragraph of turn.answer.split(/\n\s*\n/)) {
      const p = node('p');
      for (const part of paragraph.split(/(\[\d+\])/)) {
        const citation = /^\[(\d+)\]$/.exec(part);
        const source = citation && sourceLinks[Number(citation[1]) - 1];
        if (source) {
          const reference = button(part, () => {
            sources.open = true;
            source.focus();
          }, 'ffchat-cite');
          reference.setAttribute('aria-label', 'Show source ' + citation[1]);
          p.append(reference);
        } else {
          p.append(document.createTextNode(part));
        }
      }
      body.append(p);
    }
    const actions = node('div', undefined, 'ffchat-answer-actions');
    if (sourceLinks.length) actions.append(sources);
    if(turn.evidenceKind==='archive-calculation') {
      const receiptButton=button('Download calculation',async()=>{
        receiptButton.disabled=true;
        try {
          await window.FFLoadChatEvidence();
          if(!Array.isArray(window.FF.tests))await window.FFLoadAsset('observation-rows.js');
          const history=evidenceHistory(earlier);
          const prior=history.at(-1);
          const archive=turn.previousSelection?selectedArchive(prior,window.FF):window.FF;
          const record=window.FFScienceChat.receipt(turn.calculationInput || turn.question,history,archive);
          if(!record)throw Error('Calculation unavailable');
          record.question=turn.question;
          if(turn.calculationInput)record.calculation_input=turn.calculationInput;
          if(turn.previousSelection || (prior?.analysis?.plan && /^(?:and |of those|among those|for those|what about|how about|now\b|instead\b|only\b|within those|which of (?:those|them))/i.test(turn.question))){
            record.previous_question=prior.question;
            if(turn.previousSelection)record.previous_selection={count:prior.analysis.rows.length,row_ids:prior.analysis.rows};
          }
          const uri=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
          const download=document.createElement('a');
          download.href=uri;download.download='first-fire-archive-calculation.json';download.click();
          setTimeout(()=>URL.revokeObjectURL(uri),1000);
        } catch {
          receiptButton.textContent='Could not open the archive. Retry download';
        } finally {receiptButton.disabled=false;}
      },'ffchat-quiet');
      actions.append(receiptButton);
    }
    const retryButton = button('Retry answer', () => retry(index), 'ffchat-quiet ffchat-retry');
    retryButton.title = 'Get a new answer in a separate chat';
    actions.append(retryButton);
    const provenance={
      'checked':'Checked against the cited experiment',
      'calculation':'Calculated with the FM² threshold model',
      'archive-calculation':'Calculated from NASA observation rows',
      'archive-clarification':'Archive calculation needs clarification',
      'lunar-outcome':'FM² observed outcome register',
      'input-needed':'Forecast inputs needed',
      'quote-only':'Source excerpt · interpretation withheld',
      'archive-note':'Supplementary archive notes · independent claim review unavailable',
      'mission-note':'Mission history summary · independent claim review unavailable',
      'withheld':'Insufficient verified evidence'
    }[turn.evidenceKind];
    article.append(byline);
    if(provenance) article.append(node('p',provenance,'rf-evidence-label'));
    const destinations = safeDirections(turn.links);
    if (destinations.length) {
      const list = node('ul', undefined, 'ffchat-destinations');
      for (const destination of destinations) {
        const item = node('li');
        const anchor = link(destination.label, destination.href);
        if (!destination.href.startsWith('#')) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.setAttribute('aria-label', destination.label + ' (opens in a new tab)');
          const icon = node('span', ' ↗');
          icon.setAttribute('aria-hidden', 'true');
          anchor.append(icon);
        }
        item.append(anchor);
        list.append(item);
      }
      body.append(list);
    }
    article.append(body, actions);
    for (const review of turn.reviewIds || (turn.reviewId ? [turn.reviewId] : [])) {
      const proof = window.FFDeckReferee?.proof(review);
      if (proof) article.append(proof);
    }
    const engine = window.FFDeckReferee?.route(turn.question);
    if (engine && !turn.links) article.append(link('Open '+engine[0]+' →', engine[1], 'rf-continue'));
    return article;
  }

  window.renderChat = function renderChat(root, {embedded = false} = {}) {
    stopPreviousView?.();
    const state = readStore();
    let thread = state.threads.find(t => t.id === state.current);
    let mode;
    let healthTask;
    const startHealth = () => healthTask ||= checkService().then(info=>{mode=info?'local':'archive';});
    let request;
    let editing = null;
    let stopped = false;
    let persistenceWarning = '';

    const shell = node('section', undefined, embedded ? 'ffchat ff-master-chat' : 'ffchat');
    shell.setAttribute('aria-labelledby', 'ffchat-title');
    const top = node('header', undefined, 'ffchat-toolbar');
    const title = node(embedded ? 'h2' : 'h1', 'Research chat', embedded ? 'ffchat-sr' : undefined);
    title.id = 'ffchat-title';
    const tools = node('div', undefined, 'ffchat-tools');
    const historyWrap = node('div', undefined, 'ffchat-history');
    const recent = node('section', undefined, 'ffchat-recent');
    recent.id = 'ffchat-recent';
    recent.setAttribute('aria-label', 'Chat history');
    recent.hidden = true;
    const historyButton = button('History', () => toggleHistory(recent.hidden), 'ffchat-tool ffchat-history-toggle');
    historyButton.setAttribute('aria-controls', recent.id);
    historyButton.setAttribute('aria-expanded', 'false');
    historyWrap.append(historyButton, recent);
    const add = button('New chat', startNew, 'ffchat-tool ffchat-new');
    tools.append(historyWrap, add);
    top.append(title, tools);

    const desk = node('div', undefined, 'ffchat-desk');
    const welcome = node('div', undefined, 'ffchat-welcome');
    if (!embedded) {
      const welcomeCopy = node('div');
      welcomeCopy.append(node('h2', 'What would you like to know?'),
        node('p', 'Explore NASA’s fire experiments, spacecraft incidents, and lunar forecasts.'));
      const photo = node('img');
      photo.src = 'sibal.png';
      photo.alt = 'Two flames spreading along fabric in a NASA Glenn drop-tower experiment.';
      photo.width = 558;
      photo.height = 522;
      const figure = node('figure');
      figure.append(photo, node('figcaption', 'SIBAL experiment · NASA Glenn'));
      welcome.append(welcomeCopy, figure);
    }

    const exchange = node('div', undefined, 'ffchat-exchange');
    exchange.setAttribute('role', 'log');
    exchange.setAttribute('aria-live', 'off');
    exchange.setAttribute('aria-label', 'Messages');
    const form = node('form', undefined, 'ffchat-form');
    const editNotice = node('div', undefined, 'ffchat-branch');
    const label = node('label', 'Your question', 'ffchat-sr');
    label.htmlFor = 'ffchat-question';
    const input = node('textarea');
    input.id = label.htmlFor;
    input.autocomplete = 'off';
    input.rows = 1;
    input.maxLength = MAX_MESSAGE;
    input.placeholder = 'Ask a question…';
    const hint = node('span', 'Enter to send. Shift and Enter for a new line.', 'ffchat-sr');
    hint.id = 'ffchat-input-hint';
    input.setAttribute('aria-describedby', hint.id);
    const send = node('button', embedded ? undefined : 'Send', 'ffchat-send');
    if (embedded) {
      send.setAttribute('aria-label', 'Send');
      send.title = 'Send question';
    }
    send.type = 'submit';
    const cancel = button('Stop reply', () => {
      if (request) {
        request.userStopped = true;
        request.controller.abort();
      }
    }, 'ffchat-send ffchat-stop');
    const composer = node('div', undefined, 'ffchat-composer');
    composer.append(label, hint, input, send, cancel);
    const feedback = node('div', undefined, 'ffchat-feedback');
    feedback.setAttribute('role', 'status');
    const error = node('div', undefined, 'ffchat-error');
    error.setAttribute('role', 'alert');
    form.append(editNotice, composer, error, feedback);
    if (!embedded) desk.append(welcome);
    desk.append(exchange, form);

    const starters = node('section', undefined, 'ffchat-starters');
    starters.setAttribute('aria-labelledby', 'ffchat-starters-title');
    const startersTitle = node('h2', 'Try a question');
    startersTitle.id = 'ffchat-starters-title';
    if (embedded) startersTitle.classList.add('ffchat-sr');
    const suggestions = node('div', undefined, 'ffchat-suggestions');
    const examples = embedded ? [
      ['Materials', 'Did the Nomex in Saffire-II ignite?'],
      ['Find a tool', 'Take me to the rover sandbox']
    ] : EXAMPLES;
    for (const [topic, question] of examples) {
      const starter = button('', () => sendMessage(question), 'ffchat-example');
      if (!embedded) starter.append(node('small', topic));
      starter.append(node('span', question));
      suggestions.append(starter);
    }
    starters.append(startersTitle, suggestions);
    shell.append(top, desk, starters);
    if (!embedded) {
      const prefs=node('details',undefined,'rf-preferences');
      const summary=node('summary','Reading preferences');
      prefs.append(summary); shell.append(prefs);
      prefs.addEventListener('toggle',async()=>{
        if(!prefs.open)return;
        try {
          await window.FFLoadAsset('referee-deck.js');
          if(!prefs.isConnected || !prefs.open)return;
          const rendered=window.FFDeckReferee.preferences(question=>{updateInput(question);input.focus();});
          rendered.open=true;
          const focused=prefs.contains(document.activeElement);
          prefs.replaceWith(rendered);
          if(focused)rendered.querySelector('summary').focus();
        }catch{summary.textContent='Reading preferences unavailable. Close and reopen to retry.';}
      });
    }
    root.replaceChildren(shell);

    function isActive() { return !stopped && shell.isConnected; }

    function save() {
      state.current = thread.id;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({version:1, current:state.current, threads:state.threads.filter(t => t.turns.length)}));
        persistenceWarning = '';
      } catch {
        persistenceWarning = 'Tab storage is unavailable. Reloading may clear this chat.';
      }
    }

    function resizeInput() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    }

    function updateInput(text) {
      input.value = text;
      resizeInput();
    }

    function clearEdit() {
      editing = null;
      editNotice.hidden = true;
      editNotice.replaceChildren();
    }

    function toggleHistory(open) {
      recent.hidden = !open;
      historyButton.setAttribute('aria-expanded', String(open));
    }

    function threadTitle(t) {
      const original = state.threads.find(other => other.id !== t.id && other.turns[0]?.question === t.turns[0]?.question);
      if (original) {
        const difference = t.turns.findIndex((turn, i) => original.turns[i]?.question !== turn.question);
        if (difference > 0) return questionTitle(t.turns[difference].question);
      }
      return questionTitle(t.turns[0].question);
    }

    function drawHistory() {
      const conversations = state.threads.filter(t => t.turns.length).slice().reverse();
      historyButton.disabled = !conversations.length || !!request;
      const list = node('ul');
      for (const conversation of conversations) {
        const item = node('li');
        const title = threadTitle(conversation);
        const control = button(title, () => switchThread(conversation), 'ffchat-history-link');
        if (conversation.revision) control.append(node('small', 'Reply ' + conversation.revision));
        if (conversation.id === thread.id) control.setAttribute('aria-current', 'true');
        item.append(control);
        list.append(item);
      }
      recent.replaceChildren(node('h2', 'Chat history'), list);
    }

    function switchThread(next) {
      if (request) return;
      thread = next;
      toggleHistory(false);
      clearEdit();
      error.replaceChildren();
      feedback.textContent = '';
      updateInput('');
      save();
      draw();
      if (next.turns.length) focusReply();
    }

    function startNew() {
      if (request) return;
      let empty = state.threads.find(t => !t.turns.length);
      if (!empty) {
        empty = newThread();
        state.threads.push(empty);
      }
      switchThread(empty);
      input.focus();
    }

    function beginEdit(index) {
      editing = index;
      editNotice.hidden = false;
      editNotice.replaceChildren(node('span', 'Your edit will open in a new chat.'),
        button('Cancel edit', () => {
          clearEdit();
          updateInput('');
          input.focus();
        }, 'ffchat-quiet'));
      updateInput(thread.turns[index].question);
      input.focus();
    }

    function userBubble(text, index) {
      const article = node('article', undefined, 'ffchat-question');
      article.setAttribute('aria-label', 'Your message');
      article.append(node('p', text));
      if (index !== undefined) {
        const edit = button('Edit question', () => beginEdit(index), 'ffchat-edit ffchat-quiet');
        article.append(edit);
      }
      return article;
    }

    function retry(index) {
      if (request) return;
      sendMessage(thread.turns[index].question, index, true);
    }

    function draw() {
      const turns = request?.context || thread.turns;
      const isEmpty = !turns.length && !request;
      welcome.hidden = !isEmpty;
      starters.hidden = !isEmpty;
      exchange.hidden = isEmpty;
      desk.classList.toggle('ffchat-fresh', isEmpty);
      exchange.replaceChildren();
      turns.forEach((turn, i) => {
        exchange.append(userBubble(turn.question, i), showAnswer(turn, i, retry, turns.slice(0,i)));
      });
      if (request) {
        exchange.append(userBubble(request.message), node('p', 'Looking for evidence…', 'ffchat-wait'));
        for (const control of exchange.querySelectorAll('.ffchat-edit,.ffchat-retry')) control.disabled = true;
      }
      add.disabled = !!request || isEmpty;
      cancel.hidden = !request;
      send.hidden = !!request;
      input.readOnly = !!request;
      input.placeholder = thread.turns.length ? 'Ask a follow-up…' :
        (embedded ? 'Ask about fire or find a tool…' : 'Ask a question…');
      drawHistory();
      top.hidden = embedded && !request && historyButton.disabled && add.disabled;
      if (embedded) resizeInput();
    }

    function focusReply() {
      const reply = exchange.querySelector('.ffchat-reply:last-child');
      if (!reply) return;
      reply.focus({preventScroll:true});
      const position = reply.getBoundingClientRect();
      if (position.top < 0 || position.top > window.innerHeight - 100) {
        reply.scrollIntoView({block:'start', behavior:'instant'});
      }
    }

    function saveBranch(context, retrying) {
      const fork = newThread();
      if (retrying) {
        fork.retryRoot = thread.retryRoot || thread.id;
        fork.revision = 2 + state.threads.filter(t => t.retryRoot === fork.retryRoot).length;
      }
      fork.turns = context;
      state.threads.push(fork);
      thread = fork;
    }

    async function researchReply(message, context, working) {
      await window.FFLoadChatEvidence();
      if(working.controller.signal.aborted || !isActive())throw Error('Stopped');
      // The published detector performance is a reported figure. Row counts
      // and user-specified thresholds still belong to the archive calculator.
      const publishedDetector = /\b(?:fraction|proportion|percentage|share)\b/i.test(message)
        && /\bteflon\b/i.test(message) && /\b(?:light[ -]scattering|ISS)\b/i.test(message)
        && /\b(?:alarm threshold|below threshold|missed|failed to detect)\b/i.test(message)
        && !/\b(?:rows?|records?|normalized|kapton)\b|\d/i.test(message);
      const history = evidenceHistory(context);
      const priorCase = history.at(-1);
      const reading = contextualReading(message, history);
      if (reading) return reading;
      const saffireMaterial = priorCase?.caseId === 'saffire' && priorCase.status !== 'abstained'
        && /^(?:what|which) (?:material|part)(?: actually)? (?:burned|ignited)\??$/i.test(message);
      const engine = window.FFDeckReferee?.route(message);
      const archiveQuery=archiveRequest(message,priorCase);
      const quantitative = archiveQuery.missingScope || window.FFScienceChat?.isCandidate(archiveQuery.input,history);
      const toolRequest = engine && !quantitative && /^(?:open|use|launch|take me to|show me the|where (?:can|do) i (?:find|open|use))\b/i.test(message);
      let answer;
      const observation=!toolRequest && observedLunarOutcome(message,history,window.FF?.forecast);
      const calculation=observation || (!toolRequest && window.FFDeckReferee?.forecastAnswer(message,history));
      if (calculation) {
        answer=calculation;
      } else if(!publishedDetector && archiveQuery.missingScope) {
        answer={mode:'calculation',evidenceKind:'archive-clarification',status:'abstained',sources:[],
          answer:'Which group of archive rows do you mean? Name an investigation, material or selection to establish the denominator.'};
      } else if(!publishedDetector && quantitative) {
        if(!Array.isArray(window.FF.tests))await window.FFLoadAsset('observation-rows.js');
        const prior=priorCase;
        const archive=archiveQuery.scope?selectedArchive(prior,window.FF):window.FF;
        answer=window.FFScienceChat.answer(archiveQuery.input,history,archive);
        if(answer.analysis && archiveQuery.input!==message)answer.calculationInput=archiveQuery.input;
        if(answer.analysis && archiveQuery.scope){
          answer.previousSelection=true;
          const matches=prior.analysis.rows.length;
          answer.answer+='\n\nThis calculation starts with the '+matches+' matching '+(matches===1?'row':'rows')+' in your previous result.';
        }
      } else if (toolRequest) {
        answer = {answer:engine[2], status:'limited', sources:[], mode:'navigation'};
      } else {
        await startHealth();
        if(working.controller.signal.aborted || !isActive())throw Error('Stopped');
        answer = mode === 'local'
          ? await askService(message, context, working.controller.signal)
          : await askArchive(message, context);
        if (window.FFDeckReferee && !working.controller.signal.aborted) {
          const reviewQuestion = saffireMaterial ? 'Saffire-II sample 2-7: which material burned?' : message;
          answer = await window.FFDeckReferee.checkedReply(reviewQuestion, answer);
        }
      }
      return answer;
    }

    async function sendMessage(raw, branchIndex = editing, retrying = false) {
      if (request || !isActive()) return;
      const message = raw.trim();
      if (!message || message.length > MAX_MESSAGE) {
        error.textContent = !message ? 'Enter a question to send.' : 'Shorten your question to 2,000 characters.';
        input.focus();
        return;
      }
      toggleHistory(false);
      error.replaceChildren();
      feedback.textContent = '';
      updateInput('');
      editNotice.hidden = true;
      const context = thread.turns.slice(0, branchIndex === null ? undefined : branchIndex);
      const working = {controller:new AbortController(), message, context, userStopped:false};
      request = working;
      draw();
      cancel.focus({preventScroll:true});
      const timer = setTimeout(() => working.controller.abort(), 150000);
      try {
        if (working.controller.signal.aborted || !isActive()) throw Error('Stopped');
        const conversational = conversationReply(message, context);
        let answer = conversational || await new Promise((resolve,reject)=>{
          const signal=working.controller.signal;
          const abort=()=>reject(new Error('Stopped'));
          signal.addEventListener('abort',abort,{once:true});
          researchReply(message,context,working).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
        });
        const signal = working.controller.signal;
        const unverifiedSearch = answer.status === 'abstained' && answer.model === 'Archive search' &&
          !/\b(?:fabricate|invent|make up|pretend|certif(?:y|ication)|safe(?:ty)?|guarantee|actual outcome|temperature|heat release|alarm time|time to alarm|spread rate|flow threshold)\b/i.test(message);
        if (!conversational && ['archive','local'].includes(answer.mode) &&
            (unverifiedSearch || (answer.status !== 'abstained' && answer.sources?.length)) &&
            !['lunar-outcome','calculation-explanation'].includes(answer.evidenceKind)
            && localOrigin() && window.FFQwen?.explain && !signal.aborted) {
          try {
            answer = await window.FFQwen.explain(message, context, answer, signal) || answer;
          } catch {
            // The archive evidence is still readable if the local model disconnects.
          }
        }
        if (working.controller.signal.aborted || !isActive()) throw Error('Stopped');
        if (branchIndex !== null) saveBranch(context, retrying);
        thread.turns.push({question:message, ...answer});
        if(answer.evidenceKind==='archive-calculation') {
          document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{
            tool:'chat',title:'Archive question',summary:message+' — '+answer.answer.split('\n')[0],
            record:{question:message,answer:answer.answer,sources:answer.sources,analysis:answer.analysis}
          }}));
        } else {
          document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{tool:'chat',invalid:true}}));
        }
        clearEdit();
        save();
        feedback.classList.toggle('ffchat-sr', !persistenceWarning);
        feedback.textContent = persistenceWarning || 'Answer ready.';
      } catch (problem) {
        if (!isActive()) return;
        if (branchIndex !== null) beginEdit(branchIndex);
        updateInput(message);
        feedback.classList.remove('ffchat-sr');
        if (working.userStopped) {
          feedback.textContent = 'Reply stopped. You can edit or resend your question.';
        } else {
          const message = working.controller.signal.aborted ? 'The reply timed out.' : 'The reply could not be loaded.';
          error.append(node('span', message + ' Send your question again.'));
          if (mode === 'local') {
            error.append(button('Search saved records', () => {
              mode = 'archive';
              sendMessage(input.value, branchIndex, retrying);
            }, 'ffchat-quiet'));
          }
        }
      } finally {
        clearTimeout(timer);
        if (request === working) {
          request = null;
          if (isActive()) {
            const restoreFocus = !document.getElementById('workspace-explore')?.open &&
              (shell.contains(document.activeElement) || document.activeElement === document.body);
            draw();
            if (restoreFocus) {
              if (!input.value) focusReply();
              else input.focus();
            }
          }
        }
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      sendMessage(input.value);
    });
    input.addEventListener('input', resizeInput);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229 &&
          !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        sendMessage(input.value);
      }
    });
    function outsideHistory(event) {
      if (!recent.hidden && !historyWrap.contains(event.target)) toggleHistory(false);
    }
    function escapeHistory(event) {
      if (event.key === 'Escape' && !recent.hidden) {
        event.preventDefault();
        toggleHistory(false);
        historyButton.focus();
      }
    }
    function onHashChange() {
      const route = location.hash.slice(1).split('?')[0] || 'home';
      if (route !== (embedded ? 'home' : 'chat')) stop();
    }
    function stop() {
      if (stopped) return;
      navigationDraft = request ? null : {threadId:thread.id, text:input.value, editing};
      stopped = true;
      if (stopPreviousView === stop) stopPreviousView = undefined;
      request?.controller.abort();
      document.removeEventListener('pointerdown', outsideHistory);
      document.removeEventListener('focusin', outsideHistory);
      document.removeEventListener('keydown', escapeHistory);
      window.removeEventListener('hashchange', onHashChange);
    }
    stopPreviousView = stop;
    document.addEventListener('pointerdown', outsideHistory);
    document.addEventListener('focusin', outsideHistory);
    document.addEventListener('keydown', escapeHistory);
    window.addEventListener('hashchange', onHashChange);
    clearEdit();
    if (navigationDraft?.threadId === thread.id) {
      if (navigationDraft.editing !== null) beginEdit(navigationDraft.editing);
      updateInput(navigationDraft.text);
      navigationDraft = null;
    }
    const suggested=new URLSearchParams(location.hash.split('?')[1]||'').get('q');
    if(!embedded && suggested?.trim()) {
      clearEdit();
      updateInput(suggested.slice(0,MAX_MESSAGE));
    }
    draw();
    if(thread.turns.some(t=>t.evidenceKind && t.mode!=='conversation')) {
      window.FFLoadChatEvidence().then(()=>{if(isActive())draw();}).catch(()=>{});
    }
    return stop;
  };
})();

;
'use strict';

window.FFDeskHome = function (root) {
  root.innerHTML = `
    <section class="ff-cinema-home" aria-labelledby="ff-title">
      <div class="ff-cinema-lead">
        <p class="ff-cinema-topic">Spacecraft fire research</p>
        <h1 id="ff-title">Flame in <span>Freefall</span></h1>
        <p class="ff-cinema-description">Ask about a NASA fire experiment or find a lab to test an idea.</p>
      </div>
      <div data-home-chat></div>
      <figure class="earth-figure ff-cinema-earth">
        <div class="earth-disc">
          <img class="earth-poster" src="earth-poster.webp" width="720" height="720" alt="Sunlight over Earth" fetchpriority="high">
          <canvas class="earth-surface" aria-hidden="true"></canvas>
        </div>
        <figcaption class="earth-credit"><a href="https://svs.gsfc.nasa.gov/3615/" aria-label="Earth imagery from NASA’s Scientific Visualization Studio" target="_blank" rel="noopener noreferrer">Earth imagery · NASA / SVS</a></figcaption>
        <button class="earth-toggle" type="button" hidden>Pause rotation</button>
      </figure>
    </section>`;
  const figure=root.querySelector('.earth-figure');
  let disposed=false,stop;
  window.FFLoadAsset('earth.js').then(()=>{
    if(!disposed && figure.isConnected)stop=window.FFEarth?.mount(figure);
  }).catch(()=>{}); // The NASA poster remains available without rotation.
  return ()=>{disposed=true;stop?.();};
};

;
(() => {
'use strict';
const root=document.getElementById('content');
let FF, cases;
const workspace = window.FFWorkspace;
if (!window.FFShellNav) {
 workspace.fail('A file needed by the research desk did not load. Check your connection or open the complete offline edition.');
 return;
}

const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const out=(url,label)=>/^https?:\/\//i.test(url||'')?'<a href="'+attr(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>':esc(label);
const tagColor={sibal:'gold',saffire:'rose',flex:'blue',same:'',cfig:'blue',ices:'gold',fm2:'rose'};
const cardLabel={sibal:'Flame spread',saffire:'Ignition',flex:'Suppression',same:'Detection',cfig:'Atmosphere',ices:'Materials',fm2:'Forecast'};
const assetPage='https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/';
const PSI=i=>'https://psi.nasa.gov/physci/repo/data/investigations/PSI-'+i;
const linkbtn=(href,label,cls='ghost')=>'<a class="'+cls+'" href="'+attr(href)+'">'+esc(label)+'</a>';
const crumb=label=>'<div class="breadcrumb"><a href="#home">Research desk</a><span>/</span>'+esc(label)+'</div>';
function head(title,sub='',label=''){return '<div class="pagetitle">'+(label?'<span class="eyebrow">'+esc(label)+'</span>':'')+'<h1>'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+'</div>';}
const findCase=id=>FF.cases.find(c=>c.id===id);
const badge=(c)=>'<span class="tag '+tagColor[c.id]+'">'+esc(cardLabel[c.id])+'</span>';
function sourceList(sources){return sources.map(s=>'<div class="sourceitem">'+out(s.url,s.title)+'<small>'+esc(s.locator||s.supports||'')+'</small>'+(s.quote?'<blockquote>“'+esc(s.quote)+'”</blockquote>':'')+'</div>').join('');}
function cards(items){return '<div class="casegrid">'+items.map(c=>'<a class="card casecard" href="#case/'+c.id+'"><div class="topline">'+badge(c)+'<span class="catalognum">'+esc(c.short)+'</span></div><h3>'+esc(c.title)+'</h3><p>'+esc(c.question)+'</p><span aria-hidden="true" class="arrow">↗</span></a>').join('')+'</div>';}
function searchForm(q=''){return '<form class="searchform" id="query"><input type="search" aria-label="Search research evidence" name="q" maxlength="250" placeholder="Try “smoke from wire insulation”" value="'+attr(q)+'" required><button class="btn" type="submit">Search <span aria-hidden="true">↗</span></button></form>';}
function bindSearch(){const f=root.querySelector('#query');if(f) f.onsubmit=e=>{e.preventDefault();const q=f.q.value.trim();if(q)location.hash='search?q='+encodeURIComponent(q);};}
function home() {
 const disposeEarth = window.FFDeskHome(root);
 const disposeChat = window.renderChat(root.querySelector('[data-home-chat]'), {embedded:true});
 return () => { disposeChat(); disposeEarth?.(); };
}
function library(){
 root.innerHTML=crumb('Cases')+head('Research cases','Follow a claim from a NASA measurement to a research decision. Each case includes six ranked design options.')+cards(cases)+'<div class="section callout"><strong>Prospective case study</strong> · <a href="#case/fm2">Four planned FM² burns</a></div><div class="section panel"><span class="eyebrow">Architecture review</span><h2>Which design fits each decision?</h2><p>Review the recommended approach across the six cases, then open the full ranking and acceptance checks.</p><div class="actions" style="margin-top:12px">'+linkbtn('#designs','Compare design decisions →','btn')+'</div></div>';
}
const sourceAlias=(c,i)=>c.sources[i]?.url;
const recordURL=(study,q)=>'#data?study='+encodeURIComponent(study)+'&q='+encodeURIComponent(q);
// Each change of question changes the evidential ranking. Observation labels, sources and endpoints are kept together.
function comparisons(c){
 const s=c.sources[0].url;
 const book={
 sibal:[
 ['How long did visible burning persist?','LUCI fabric observations','The long-duration test and its ground comparison observed visible extinction. In simulated lunar gravity it occurred about 45 seconds later.','Aircraft, day 2 / parabola 29','The fabric still burned at 20 seconds. Its lifetime in that run is at least the observation window.',s,sourceAlias(c,1)],
 ['How fast did the flame base spread early?','Aircraft, day 2 / parabola 29','A 5 cm strip burned downward at about 0.86 mm/s at lunar-equivalent gravity.','LUCI flight','The fitted base speed was 0.92 mm/s. This comparison addresses early spread in air.',sourceAlias(c,1),s.replace('#page=34','#page=19')]],
 saffire:[
 ['Did the Nomex ignite?','Saffire-II / sample 2-7','The fabric was damaged and blackened; investigators report no fabric ignition under these conditions.','Assembled sample / duration','The reported 140 s applies to the composite test. The upstream acrylic burned.',s,recordURL('PSI-99','2-7')],
 ['What burned in the assembly?','Saffire-II / component outcome','The upstream acrylic (PMMA) was consumed, exposing the adjacent Nomex to its flame.','Surface appearance','Blackening and burning are separate observations. The investigator report resolves the component outcome.',recordURL('PSI-99','2-7'),s]],
 flex:[
 ['Does the record support later cool-flame burning?','FLEX-155 / C03H201','The investigators interpreted the post-visible vaporization, plateau and cloud as evidence of cool-flame burning.','FLEX-120 / C12H201','The investigators described the cool-flame evidence as inconclusive. A cloud on its own cannot settle the question.',s,sourceAlias(c,1)],
 ['What was observed at visible extinction?','FLEX-155 / C03H201','The droplet measured 2.52 mm at visible extinction, down from 2.73 mm initially. The table lists a 2.7 s burn time.','Later chemical endpoint','A precise time at which all combustion stopped would require sufficient time-resolved diagnostics.',recordURL('PSI-69','C03H201'),s]],
 same:[
 ['Which material warrants a missed-alarm test?','Teflon / ISS light-scattering detector','Two-thirds of the Teflon tests fell below the ISS alarm threshold in the reported experiment.','Silicone rubber','A strong detector signal on silicone-rubber smoke does not establish sensitivity to Teflon smoke.',s,s],
 ['Can one sample determine detector reliability?','SAME-R / Teflon sample 56','The sample record describes the material and operating conditions. Figure 10 shows microscopy.','Detector response / Figure 9','Use the threshold comparison across tests for a statement about performance. A micrograph does not supply a per-run alarm verdict.',recordURL('PSI-101','PSI-101:1:74'),s]],
 cfig:[
 ['Which oxygen value describes the chamber?','Normal flame / 21088A1','This row reports 39.39% ambient oxygen. Its fuel and geometry still limit transfer to a fabric fire.','Inverse flame / 21202 A1','The 85% entry describes the burner stream. Ethane was present in the chamber.',recordURL('PSI-159','21088A1'),recordURL('PSI-159','21202 A1')],
 ['Did both inverse tests ignite?','Inverse flame / 21202 A2','Hot ignition was recorded, followed by self-extinction after 2 seconds.','Inverse flame / 21202 A1','The record reports no hot ignition despite the same 85% burner oxygen. The oxygen delivery rates differed.',recordURL('PSI-159','21202 A2'),recordURL('PSI-159','21202 A1')]],
 ices:[
 ['What happened to the P213 tape boundary?','P213 / lunar versus forced-flow extrapolation','The lunar extinction oxygen limit fell below the 1-g forced-flow extrapolation in this study.','Polycarbonate / ground measurements','The reported lunar extinction oxygen concentration lay above the WSTF measurements for this material. The Earth comparator differs.',s,sourceAlias(c,1)],
 ['Is Table 2 a direct lunar measurement?','Table 2 / engineering extrapolation','The table gives conservative calculated changes under its extrapolation assumptions.','Short partial-gravity tests','The centrifuge runs observe the flame over seconds. The local buoyant speed in lunar gravity remains uncertain.',sourceAlias(c,1),sourceAlias(c,4)]],
 fm2:[
 ['What has been observed on the Moon?','FM² / observed outcomes','No official lunar burn outcome is recorded in this edition.','FM² / design expectation','NASA’s qualitative expectations and the teaching model can be compared before any outcome is scored.',s,'#forecast'],
 ['Which probabilities belong to NASA?','LPSC / qualitative statement','The slides describe expected burn behavior. They do not publish a numeric probability vector.','Illustrative model','The four model probabilities follow from an assumed mean limiting oxygen of 26% and spread of 1.5 percentage points.',s,'#forecast']]};
 return book[c.id];
}
function actionLink(url){return url?.startsWith('#')?linkbtn(url,'Inspect record →','inlinebtn'):out(url,'Open source');}
const caseQuestions = new Map();
function comparisonState(c) {
  if (!caseQuestions.has(c.id)) {
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('first-fire:case-question:' + c.id)) || {}; } catch {}
    caseQuestions.set(c.id, {
      mode: saved.mode === 'custom' ? 'custom' : 'suggested',
      preset: Number.isInteger(saved.preset) ? saved.preset : 0,
      draft: typeof saved.draft === 'string' ? saved.draft.slice(0, 1000) : '',
      submitted: typeof saved.submitted === 'string' ? saved.submitted.slice(0, 1000) : ''
    });
  }
  return caseQuestions.get(c.id);
}
function saveComparison(c, state) {
  try { sessionStorage.setItem('first-fire:case-question:' + c.id, JSON.stringify(state)); } catch {}
}
function customSource(source) {
  const link = source.url?.startsWith('#')
    ? linkbtn(source.url, source.title, 'inlinebtn')
    : out(source.url, source.title);
  return '<div class="sourceitem">' + link +
    (source.locator ? '<small>' + esc(source.locator) + '</small>' : '') + '</div>';
}
function compare(c) {
  const host = root.querySelector('#comparison');
  const rows = comparisons(c);
  const state = comparisonState(c);
  host.innerHTML = `
    <span class="eyebrow">Evidence comparison</span><h2>Choose the question</h2>
    <div class="question-modes" role="group" aria-label="Question type">
      <button type="button" data-mode="suggested" aria-controls="suggested-questions">Suggested questions</button>
      <button type="button" data-mode="custom" aria-controls="custom-question">Ask your own question</button>
    </div>
    <div id="suggested-questions">
      <label class="field">Research question<select id="compare-q"></select></label>
      <div id="pair" class="grid2"></div>
    </div>
    <div id="custom-question" hidden>
      <form class="case-question-form">
        <label class="field" for="case-question-input">Your question about ${esc(c.short)}</label>
        <textarea id="case-question-input" rows="2" maxlength="1000" required></textarea>
        <button class="btn" type="submit">Find evidence</button>
      </form>
      <div id="case-question-result" aria-live="polite" aria-atomic="true"></div>
    </div>`;
  const selector = host.querySelector('#compare-q');
  rows.forEach(([question], i) => selector.add(new Option(question, String(i))));
  selector.selectedIndex = rows[state.preset] ? state.preset : 0;
  function drawPair() {
    const row = rows[selector.selectedIndex];
    host.querySelector('#pair').innerHTML = [1, 3].map((n, i) => `
      <div class="panel"><span class="eyebrow">${i ? 'Comparison' : 'Primary evidence'}</span>
      <h3>${esc(row[n])}</h3><p>${esc(row[n + 1])}</p><div class="actions">${actionLink(row[5 + i])}</div></div>`).join('');
  }
  selector.onchange = () => {
    state.preset = selector.selectedIndex;
    saveComparison(c, state);
    drawPair();
  };
  drawPair();

  const input = host.querySelector('#case-question-input');
  const result = host.querySelector('#case-question-result');
  input.value = state.draft;
  function drawResult() {
    const question = input.value.trim();
    if (!state.submitted || question !== state.submitted) {
      result.replaceChildren();
      delete result.dataset.status;
      return;
    }
    const answer = window.FFCaseQuestions.ask(c, question, rows);
    result.dataset.status = answer.status;
    result.innerHTML = (answer.message ? '<p>' + esc(answer.message) + '</p>' : '') + answer.entries.map(entry => `
      <article class="case-answer">
        <span class="eyebrow">${esc(entry.label)}</span><h3>${esc(entry.title)}</h3>
        <p>${esc(entry.text)}</p>${entry.sources.map(customSource).join('')}
      </article>`).join('');
    if (answer.status === 'gap') {
      const search = document.createElement('a');
      search.className = 'inlinebtn';
      search.href = '#search?q=' + encodeURIComponent(question);
      search.textContent = 'Search all evidence →';
      result.append(search);
    }
  }
  input.oninput = () => {
    input.setCustomValidity('');
    state.draft = input.value;
    saveComparison(c, state);
    drawResult();
  };
  host.querySelector('.case-question-form').onsubmit = event => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.setCustomValidity('Enter a question.');
      input.reportValidity();
      return;
    }
    state.draft = input.value;
    state.submitted = input.value.trim();
    saveComparison(c, state);
    drawResult();
  };
  drawResult();
  const modes = host.querySelectorAll('.question-modes button');
  function showMode() {
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    host.querySelector('#suggested-questions').hidden = state.mode !== 'suggested';
    host.querySelector('#custom-question').hidden = state.mode !== 'custom';
  }
  modes.forEach(button => {
    button.onclick = () => {
      state.mode = button.dataset.mode;
      saveComparison(c, state);
      showMode();
      if (state.mode === 'custom') input.focus();
    };
  });
  showMode();
}
function fileExport(name,body,type='text/plain'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function notesKey(c){return 'first-fire:note:v1:'+c.id;}
function getNotes(c){try{return JSON.parse(localStorage.getItem(notesKey(c)))||{};}catch{return {};}}
function renderCase(id,view='evidence'){
 const c=findCase(id);if(!c){notFound();return;}
 if(!['evidence','designs','brief'].includes(view))view='evidence';
 root.innerHTML=crumb('Cases / '+c.short)+head(c.title,c.question,c.short+' / '+cardLabel[id])+
 '<nav class="tabs" aria-label="Case sections">'+[['evidence','Evidence'],['designs','Six design options'],['brief','My research brief']].map(([v,l])=>'<a href="#case/'+id+(v==='evidence'?'':'/'+v)+'" '+(view===v?'aria-current="page"':'')+'>'+l+'</a>').join('')+'</nav><div id="casebody"></div>';
 const body=root.querySelector('#casebody');
 if(view==='evidence'){
 body.innerHTML='<div class="record"><div class="stack"><div class="panel"><span class="eyebrow">'+(id==='fm2'?'Planned experiment':'Observed record')+'</span><p>'+esc(c.record)+'</p></div><div class="panel" id="comparison"></div><div class="callout"><span class="eyebrow">Research decision</span><h3>'+esc(c.decision)+'</h3><p style="margin-top:9px">'+esc(c.reason)+'</p></div><div class="panel"><h3>What limits this conclusion?</h3><p>'+esc(c.limit)+'</p><h3 style="margin-top:21px">What to test next</h3><p>'+esc(c.next)+'</p></div></div><aside class="aside"><div class="panel"><span class="eyebrow">Source file</span><h3>Read the evidence</h3><p class="footnote">Source checked · '+esc(c.human_review)+'</p>'+sourceList(c.sources)+'</div><a class="panel toolcard" href="#case/'+id+'/designs"><span class="eyebrow">Ranked first</span><h3>'+esc(c.options[0].name)+' ↗</h3><p>'+esc(c.options[0].mechanism)+'</p></a></aside></div>';compare(c);
 }else if(view==='designs'){
 body.innerHTML='<div class="record"><div class="panel"><span class="eyebrow">Architecture review</span><h2>Six ways to handle this case</h2><p class="sub" style="margin:10px 0 16px">Ranked by fit to the decision, traceability to the original record and feasibility with the available data. The ranking is a design judgment.</p><ol class="optionlist">'+c.options.map(o=>'<li><div><h3>'+esc(o.name)+'</h3><p>'+esc(o.mechanism)+'</p><p><strong>Trade-off.</strong> '+esc(o.tradeoff)+'</p><p><strong>Acceptance check.</strong> '+esc(o.proof)+'</p></div></li>').join('')+'</ol></div><aside class="panel"><span class="eyebrow">Recommended design</span><h3>'+esc(c.options[0].name)+'</h3><p>'+esc(c.options[0].proof)+'</p><div class="actions" style="margin-top:12px">'+linkbtn('#case/'+id+'/brief','Write a brief →','btn')+'</div></aside></div>';
 }else{
 const note=getNotes(c);
 const activeQuestion = comparisonState(c);
 const sourceQuestion = activeQuestion.mode === 'custom' ? activeQuestion.submitted : '';
 const selectedQuestion = sourceQuestion && sourceQuestion !== note.sourceQuestion
   ? sourceQuestion : note.question || c.question;
 body.innerHTML='<div class="record"><div class="panel"><h2>My research brief</h2><p class="sub" style="margin:10px 0 16px">Record your interpretation and next test. Save on this browser or download a copy with the original citations.</p><form id="brief" class="answerform"><label class="field">Research question<textarea name="question" rows="2" maxlength="1000">'+esc(selectedQuestion)+'</textarea></label>'+[['decision','Your decision'],['limit','What limits this result?'],['next','Next measurement or reanalysis']].map(([k,l])=>'<label class="field">'+l+'<textarea name="'+k+'" maxlength="6000">'+esc(note[k]||'')+'</textarea></label>').join('')+'<div class="actions"><button class="btn" type="submit">Save on this device</button><button class="ghost" type="button" id="exportbrief">Download brief</button></div><span role="status" id="briefmsg"></span></form></div><aside class="panel"><h3>What to check</h3><p>'+esc(c.check)+'</p>'+sourceList(c.sources)+'</aside></div>';
 const f=body.querySelector('#brief'), values=()=>Object.fromEntries(new FormData(f));f.onsubmit=e=>{e.preventDefault();try{localStorage.setItem(notesKey(c),JSON.stringify({...values(), sourceQuestion}));f.querySelector('#briefmsg').textContent='Saved on this device.';}catch{f.querySelector('#briefmsg').textContent='Local saving is unavailable. Download your brief instead.';}};
 f.querySelector('#exportbrief').onclick=()=>{const v=values();fileExport('FIRST-FIRE-'+c.id+'-brief.txt',[c.short+' — '+c.title,v.question,'My decision: '+v.decision,'Limit: '+v.limit,'Next action: '+v.next,'Case interpretation (team review pending): '+c.decision,...c.sources.map(s=>s.title+' · '+s.locator+'\n'+s.url)].join('\n\n'));};
 }
}
async function searchPage(q){
 root.innerHTML=crumb('Evidence search')+head('Find evidence','Search the reviewed cases and investigation descriptions. Use the data explorer for individual NASA row IDs.')+'<div class="panel stack">'+searchForm(q)+'<div class="chips">'+['wire insulation smoke','burner oxygen','visible flame extinction'].map(t=>'<a class="chip" href="#search?q='+encodeURIComponent(t)+'">'+esc(t)+'</a>').join('')+'</div></div><div id="matches" class="section" aria-live="polite"></div>';bindSearch();const box=root.querySelector('#matches');const tools=document.createElement('section');tools.className='ff-tools-result';box.before(tools);window.FFToolDirectory?.showMatches(tools,q);if(!q)return;box.textContent='Searching the local evidence index…';const {items,semantic}=await window.FFSearch.search(q);if(!box.isConnected)return;
 box.innerHTML='<div class="sectionhead"><div><span class="eyebrow">'+(semantic?'Semantic + keyword retrieval':'Keyword retrieval')+'</span><h2>'+esc(items.length?'Evidence matches':'No close matches')+'</h2></div></div>'+(items.length?'<div class="panel">'+items.map(d=>'<div class="result"><span class="tag">'+esc(d.type)+'</span><h3><a href="'+attr(d.url)+'">'+esc(d.title)+'</a></h3><p>'+esc(d.lead)+'</p></div>').join('')+'</div>':'<p>Try a material, investigation name or a shorter question.</p>')+'<p class="statusline" style="margin-top:10px">A related result may not answer your question. Open its source and check the material, conditions and measured endpoint.</p>';
}
const reports={
 'track-fit':['What belongs in the judging demo','Challenge criteria, evidence boundaries and the reasons for the chosen instruments.'],
 'transport-fit':['Fit a sensor trace','Estimate exchange and sensor lag on one run and compare both models on a second run.'],
 'science-chat-audit':['Independent archive chat evaluation','Sixty-four questions, the displayed replies, original scores and failures.'],
 'advanced-methods':['Research instruments','Matching experiments, measuring sensor delay, updating a threshold and independently evaluating archive queries.'],
 'science-chat':['Archive calculations in chat','Supported operations, source receipts and measured benchmark results.'],
 'code-review':['Source code audit','Repository-level readings, validation gaps and the changes made to FIRST FIRE.'],
 'referee-replay':['Evidence checks on 100 archived chat answers','What the evidence gate changed and where it still misses the question.'],
 'challenge-projects':['Challenge project review','Public repositories, Word documents, and the comparisons they prompted in FIRST FIRE.'],
 'chat-models':['Chat model selection','Small local transformer candidates, selection trials and the Grok migration plan.'],
 'world-model':['Physics simulation design','Sealed-compartment calculations, liquid-network test errors and the proposed validation with measured sensor traces.'],
 'chat-adversarial':['Ten conversations with the first model','Read the attack prompts, ordinary follow-ups, actual answers and two failures.'],
 'chat-benchmark':['100-question chat benchmark','Frozen questions, source checks, scoring limits and failure analysis.'],
 review:['Research review','What the six studies establish, what breaks a comparison, and where evidence ends.'],
 data:['Data audit','Where the NASA rows came from and why some investigations remain catalog-only.'],
 forecast:['Forecast method','The fixed team predictions, their signed timestamp, the assumed travel model and the scoring rules.'],
 evaluation:['Blind-test protocol','How to run the two arms, protect the answer key and compare results.'],
 search:['Search retrieval checks','Reproduce the public-case queries and compare retrieval methods.'],
 submission:['Challenge handoff','Project description, a demonstration sequence, credits and remaining entrant actions.']
};
function designReview(){root.innerHTML=crumb('Cases / Design decisions')+head('Design decisions','Compare the recommended approach for each case. Open the ranking to see the five alternatives, their trade-offs and how to check them.','Architecture review')+'<div class="panel">'+FF.cases.map((c,i)=>'<div class="result"><span class="tag '+tagColor[c.id]+'">'+esc(c.short)+(i===6?' · prospective':'')+'</span><h3>'+esc(c.options[0].name)+'</h3><p>'+esc(c.options[0].mechanism)+'</p><p><strong>Acceptance check.</strong> '+esc(c.options[0].proof)+'</p><a class="inlinebtn" href="#case/'+c.id+'/designs">See all six options →</a></div>').join('')+'</div>';}
function sources(){
 const rr=FF.resources;
 root.innerHTML=crumb('Sources & methods')+head('Sources & methods','Follow the trail from the Space Apps brief to each research decision.','Research notebook')+
 '<div class="toolsgrid">'+[['#designs','Compare design decisions','Review the six ranked approaches per case and the test each one must pass.'],['#coverage','Map the data','See what the normalized archive covers and which conditions have no transferable rows.'],['#referee','Check a quotation','Test exact wording against a specific page before interpreting it.'],['demo.html','Project walkthrough','Follow the project story in a short presentation.']].map(([u,t,d])=>'<a class="panel toolcard" href="'+u+'"><h3>'+t+' ↗</h3><p>'+d+'</p></a>').join('')+'</div>'+
 '<section class="section"><div class="sectionhead"><div><span class="eyebrow">Methods library</span><h2>Read the research</h2></div></div><div class="panel">'+Object.entries(reports).filter(([k])=>['review','data','world-model','advanced-methods','transport-fit','forecast','evaluation','answer-verification','master-physics','track-fit'].includes(k)&&FF.research.some(r=>r.name===k)).map(([k,[title,desc]])=>'<div class="result"><h3><a href="#report/'+k+'">'+title+' →</a></h3><p>'+desc+'</p></div>').join('')+'</div></section>'+
 '<div class="record section"><section class="panel"><span class="eyebrow">Original brief</span><h2>Challenge resources</h2><p>All ten resources listed by the '+out(rr.source_url+'?tab=resources','Flame in Freefall challenge')+'. General background and primary experiments have different roles in this project.</p><ol class="readlist">'+rr.resources.map(s=>'<li>'+out(s.url,s.title)+'</li>').join('')+'</ol></section>'+
 '<aside class="panel"><span class="eyebrow">Offline release</span><h2>Download the records</h2><ul class="readlist">'+[['data/tests.csv','Normalized NASA observations (CSV)'],['data/investigations.json','Source catalogue, DOIs & file hashes'],['data/cases.json','Research decisions and ranked designs'],['data/forecast.json','Forecast assumptions and snapshot'],['data/challenge-resources.json','Official challenge resource index'],['data/evidence/pages.json','Page-level quotation receipts'],['forecast-lock/fm2-v1.json','Timestamped team forecast'],['first-fire-demo.mp4','30-second project film'],['checksums.json','Release file checksums'],['first-fire-user-manual.pdf','User manual (PDF)'],['first-fire-demo.pdf','Six-slide project demonstration (PDF)']].map(([u,t])=>'<li><a href="'+u+'" download>'+t+'</a></li>').join('')+'</ul></aside></div>'+
 '<section class="panel section"><h2>What search does</h2><p>A local English-language index combines keyword matching and semantic similarity. It searches six reviewed cases, the FM² study and nineteen investigation summaries. It does not generate research findings or assign safety ratings. The Data explorer searches individual records.</p><p>The semantic model is '+out('https://huggingface.co/minishlab/potion-base-2M','Model2Vec potion-base-2M')+' (revision 389b9f6), distributed locally under its <a href="licenses/model-LICENSE.txt">MIT license</a>. Its compact English tokenizer is optimized for this corpus. If the model cannot load, the results say “Keyword retrieval.”</p><p>Photo: NASA Glenn, SIBAL fabric in a drop-tower centrifuge, from the '+out(assetPage,'FM² project page')+'. Barlow Condensed and DM Sans: SIL Open Font License. FIRST FIRE software: <a href="licenses/software.txt">MIT</a>. NASA and third-party materials retain their own terms. This is an independent challenge project.</p></section>';
}
function report(id){
 const doc=FF.research.find(r=>r.name===id);if(!doc){notFound();return;}
 root.innerHTML=crumb('Sources & methods / '+(reports[id]?.[0]||id))+'<div class="actions docactions">'+linkbtn('#sources','← All sources')+'<a class="ghost" href="research/'+attr(doc.file)+'" download>Download report</a></div><article class="panel prose">'+window.marked.parse(doc.text)+'</article>';
 root.querySelectorAll('.prose a').forEach(a=>{const raw=a.getAttribute('href');if(raw.startsWith('../dist/'))a.setAttribute('href',raw.slice(8));else if(raw.startsWith('../data/'))a.setAttribute('href',raw.slice(3));else if(raw.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}else if(reports[raw.replace(/\.md$/,'')])a.href='#report/'+raw.replace(/\.md$/,'');});
}
function notFound(){root.innerHTML=crumb('Unknown page')+head('Page not found','This link does not point to a page in this edition.')+linkbtn('#home','Return to the research desk','btn');}
let disposeForecast;
const scripts = new Map();
function loadScript(name) {
 if(scripts.has(name)) return scripts.get(name);
 const task = new Promise((resolve,reject) => {
   const asset = document.createElement('script');
   asset.src=name;
   function failed() {
     clearTimeout(timer);
     asset.onload=asset.onerror=null;
     scripts.delete(name);
     asset.remove();
     reject(new Error('Could not load '+name));
   }
   const timer=setTimeout(failed,30000);
   asset.onload=()=>{clearTimeout(timer);resolve();};
   asset.onerror=failed;
   document.head.append(asset);
 });
 scripts.set(name,task);
 return task;
}
function loadAll(names) {return Promise.all(names.map(loadScript));}
const scienceFiles=['search.js','forecast-ui.js','referee-reviews.js','referee-passages.js','referee-deck.js','science-chat.js'];
async function loadRecords() {
 await loadScript('records.js');
 if(!window.FF?.cases)throw Error('The research records are unavailable.');
 if(!FF){FF=window.FF;cases=FF.cases.filter(c=>c.id!=='fm2');}
}
async function loadGuides() {
 await Promise.all([loadScript('research-session.js'),loadAll(['trial-comparison.js','investigation-replay.js']).then(()=>loadScript('awareness.js'))]);
}
window.FFLoadAsset=loadScript;
window.FFLoadChatEvidence=async()=>{
 await Promise.all([loadRecords(),loadAll(scienceFiles),loadGuides()]);
 if(!window.FFScienceChat || !window.FFDeckReferee || !window.FFSearch || !window.FFRefereeReviews || !window.FFRefereePassages || !window.FFForecastMath)throw Error('The research tools are unavailable.');
};
async function route(first=false) {
 const visit=workspace.start(first);
 if (!visit) return;
 try {
  await workspace.stylesheetReady;
  if(workspace.pending(visit)) await renderRoute(first, visit);
 } catch (error) {
  if (workspace.pending(visit)) workspace.fail('A file or tool could not open. Retry to reload this view with the same link.');
 }
}
async function renderRoute(first, visit) {
 if(disposeForecast){disposeForecast();disposeForecast=null;}
 const raw=location.hash.slice(1),breakAt=raw.indexOf('?'),path=(breakAt<0?raw:raw.slice(0,breakAt)).split('/'),p=new URLSearchParams(breakAt<0?'':raw.slice(breakAt+1)),key=path[0]||'home';
 if ((key === 'home' || key === 'chat') && (!window.renderChat || !window.FFDirections)) {
   workspace.fail('The research chat could not load. Check your connection and retry, or choose another tool from Explore.');
   return;
 }
 const chat=key==='home' || key==='chat';
 const routeFiles={
   atlas:['explorer.js','atlas-deck.js'],compass:['explorer.js','atlas-deck.js'],passports:['explorer.js','atlas-deck.js'],data:['explorer.js'],
   forecast:['forecast-ui.js'],rulebook:['mission-desk.js'],earth:['mission-desk.js'],referee:scienceFiles,errors:scienceFiles,
   benchmark:scienceFiles,study:['search.js'],claim:['search.js'],search:['search.js'],awareness:['atlas-deck.js'],
   case:['explorer.js','atlas-deck.js'],coverage:['explorer.js','atlas-deck.js'],quotes:['explorer.js','atlas-deck.js']
 };
 if(!chat){
   const opening=document.createElement('p');
   opening.className='ff-shell-opening';
   opening.setAttribute('role','status');
   const destination=document.getElementById('ff-current-module').textContent;
   opening.textContent='Opening '+destination+'…';
   root.replaceChildren(opening);
   await Promise.all([loadRecords(),loadGuides(),loadAll(routeFiles[key]||[])]);
   if(!workspace.pending(visit))return;
 } else {
   let guided=false;
   try{guided=!!(sessionStorage.getItem('first-fire.judge-session.v1') || sessionStorage.getItem('first-fire.investigation-desk.v1'));}catch{}
   if(guided)loadGuides().then(()=>{if(key===(location.hash.slice(1).split('?')[0]||'home')){window.FFResearchSession.guide();window.FFAwareness.guide(key);}}).catch(()=>{});
 }
 const deferredTools = {
   study: 'study.js', benchmark: 'benchmark-ui.js', acrylic: 'acrylic.js', guide: 'guide.js',
   claim: 'claim.js', case: 'case-questions.js', search: 'tool-directory.js',
   quotes: 'workbench.js', coverage: 'workbench.js', report: 'vendor/marked.js', forecast: 'spread-scene.js'
 };
 const bundles=deferredTools[key] ? [deferredTools[key]] : [];
 if(['atlas','compass','passports','data','coverage'].includes(key))bundles.push('observation-rows.js');
 if(key==='transfer-lab')bundles.push('observation-rows.js','transfer-lab.js');
 if(key==='archive-audit')bundles.push('archive-audit-data.js','archive-audit.js');
 if(key==='design-lab')bundles.push('design-lab.js');
 if(key==='rover-design')bundles.push('rover-model.js','rover-integration.js');
 if(key==='transport-lab')bundles.push('transport-lab.js','transport-fit.js');
 if(key==='code-review')bundles.push('code-review-readings.js','code-review.js');
 if(['physics','rover'].includes(key)){
  if(window.FFAwareness?.tier?.()!=='lite')bundles.push('cabin-liquid-weights.js');
  bundles.push('physics-lab.js');
 }
 if(bundles.length){
  for (const asset of bundles) {
   if (!workspace.pending(visit)) return;
   await loadScript(asset);
  }
  if (!workspace.pending(visit)) return;
 }
 if(key==='atlas'||key==='compass'){if(key==='compass')p.set('mode','rank');window.renderDeckAtlas(root,p);}
 else if(key==='archive-audit')window.FFArchiveAudit.render(root);
 else if(key==='session')window.FFResearchSession.render(root);
 else if(key==='awareness')window.FFAwareness.render(root);
 else if(key==='rover-design')window.FFRoverDesign.render(root);
 else if(key==='transfer-lab')window.FFTransferLab.render(root,p);
 else if(key==='design-lab')window.FFDesignLab.render(root);
 else if(key==='transport-lab')disposeForecast=window.FFTransportLab.render(root);
 else if(key==='code-review')window.renderCodeReview(root,p);
 else if(key==='passports')window.renderPassports(root,p);
 else if(key==='rulebook')window.FFMissionDesk.rulebook(root);
 else if(key==='earth')window.FFMissionDesk.earth(root,p);
 else if(key==='referee'||key==='errors'){if(key==='errors')p.set('view','errors');window.renderDeckReferee(root,p);}
 else if(key==='physics'||key==='rover'){if(key==='rover')p.set('mode','rover');window.renderPhysicsLab(root,p);}
 else if(key==='home')disposeForecast=home();else if(key==='chat'){root.replaceChildren();disposeForecast=window.renderChat(root);}else if(key==='benchmark'){root.replaceChildren();window.renderBenchmark(root);}else if(key==='cases')library();else if(key==='designs')designReview();else if(key==='case')renderCase(path[1],path[2]);else if(key==='search')await searchPage(p.get('q')||'');
 else if(key==='sources')sources();else if(key==='report')report(path[1]);else if(key==='forecast')disposeForecast=window.renderForecast(root);
 else if(key==='data'){root.innerHTML=crumb('Data explorer')+head('Data explorer','Inspect original NASA rows or rank records by how closely their conditions match your question.','Physical Sciences Informatics')+'<div id="explorer" class="stack"></div><div class="section actions">'+linkbtn('#coverage','View coverage map →')+linkbtn('#report/data','Read the data audit →')+'</div>';window.renderExplorer(root.querySelector('#explorer'),p);}
 else if(key==='claim'){root.innerHTML=crumb('Check a claim')+head('Check a claim','Find a related experiment, compare it with your question, and decide which conclusion the evidence supports.','Research workbench')+'<div id="claimtool"></div>';window.renderClaim(root.querySelector('#claimtool'));}
 else if(key==='acrylic'){root.innerHTML=crumb('Guided exercise / Acrylic')+head('Does acrylic spread faster on Earth?','Change the oxygen conditions, shape or endpoint and see whether an Earth-to-orbit comparison still holds.','Guided exercise')+'<div id="acrylictool"></div>';window.renderAcrylic(root.querySelector('#acrylictool'));}
 else if(key==='study'){root.innerHTML=crumb('Blind test')+head('Blind test','Compare FIRST FIRE with ordinary search using the same research questions and time limits.','Evaluation lab')+'<div id="study"></div><div class="section actions">'+linkbtn('#report/evaluation','Read the protocol →')+linkbtn('#guide','Open the user guide →')+'</div>';window.renderStudy(root.querySelector('#study'));}
 else if(key==='guide'){root.innerHTML=crumb('User guide')+window.FFGuide;root.querySelectorAll('a[href^="index.html#"]').forEach(a=>a.setAttribute('href',a.getAttribute('href').slice(10)));}
 else if(key==='coverage'||key==='quotes'){root.innerHTML=crumb('Sources & methods / '+(key==='coverage'?'Coverage map':'Quotation referee'))+head(key==='coverage'?'Coverage map':'Quotation referee',key==='coverage'?'Explore which archive rows can answer a question about the surrounding atmosphere.':'Check whether the exact words occur on the cited page or section.','Evidence tools')+'<div id="workbench"></div>';window.FFWorkbench[key==='quotes'?'referee':key](root.querySelector('#workbench'));}
 else notFound();
 if (!workspace.pending(visit)) return;
 window.FFShellNav?.setView(key, p, root.querySelector('h1')?.textContent);
 window.FFResearchSession?.guide();
 window.FFAwareness?.guide(key);
 const title=root.querySelector('h1')?.textContent||'Research desk';document.title=(key==='home'?'Research desk':title)+' · FIRST FIRE';
 workspace.ready(visit, document.getElementById('ff-current-module').textContent || title);
 if(!first){root.focus({preventScroll:true});window.scrollTo(0,0);}
}
window.addEventListener('hashchange',()=>route(false));route(true);
})();

