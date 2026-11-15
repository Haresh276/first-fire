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
