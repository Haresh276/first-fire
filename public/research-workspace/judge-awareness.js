/* Decisions for the interactive judging experiment. The UI owns inputs and session storage.
   No policy decision modifies a measured rate or the output of either physical model. */
(() => {
  'use strict';
  const deviceTools = typeof module === 'object' && module.exports ? require('./reader-device.js') : window.FFReaderDevice;
  if (typeof module === 'object' && module.exports) require('./intent-router.js');
  const publication = 'https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21';
  const catalogue = 'https://doi.org/10.60555/0t15-1z43';
  const sources = {
    concurrent: {row:'PSI-98:1:2', run:'S1', speed:1.8},
    opposed: {row:'PSI-98:1:3', run:'S2', speed:1.3}
  };
  const guidance = {
    beginner:'Compare how far the front travels and how much oxygen is left. The cabin calculation starts with the speed you give it.',
    undergraduate:'Compare the front distance in centimetres and the wet oxygen fraction at the same time. Cabin volume and pressure determine the initial gas inventory.',
    advanced:'Inspect the imposed front speed, available fuel and oxygen cutoff. Wet oxygen includes product water vapour in the gas denominator. A different gravity or fuel requires a new spread measurement.'
  };
  const routes = {
    trial: {label:'Cabin and rover model', action:'Explore the current trial', href:'judge-lab.html', reason:'The question changes a design assumption, a cabin condition or a front rate.'},
    evidence: {label:'Flight evidence', action:'Inspect the NASA record', href:'index.html#atlas', reason:'The question asks what an orbital experiment measured.'},
    detector: {label:'Smoke transport', action:'Open the transport lab', href:'index.html#transport-lab', reason:'Tracer exchange between compartments and the sensor location govern this question.'},
    matched: {label:'Matched experiments', action:'Compare flight experiments', href:'index.html#transfer-lab', reason:'The question compares recorded droplet experiments under matching conditions.'},
    forecast: {label:'Lunar experiment design', action:'Open the experiment design lab', href:'index.html#design-lab', reason:'The question concerns a future lunar test or a hypothetical update.'},
    archive: {label:'Archive calculation', action:'Open the archive query', href:'index.html#chat', reason:'The question requests a count or aggregate over experiment records.'},
    compass: {label:'Habitat conditions',action:'Find matching experiments',href:'index.html#compass',reason:'The question ranks flight observations against target conditions.'},
    rulebook: {label:'Transfer of a rule',action:'Audit the proposed rule',href:'index.html#rulebook',reason:'The question tests whether a rule transfers across experimental conditions.'},
    referee: {label:'Source verification',action:'Check the claim',href:'index.html#referee',reason:'The question asks whether a source supports a statement.'},
    incident: {label:'Historical incident',action:'Look up the incident record',href:'index.html#chat',reason:'The question refers to a documented spacecraft incident.'},
    compare: {label:'Record comparison',action:'Compare experiment records',href:'index.html#atlas',reason:'The question asks how two archived experiments compare.'},
    prediction: {label:'Locked lunar forecast',action:'Inspect the published forecast',href:'index.html#forecast',reason:'The question asks for the prospective probability of a lunar outcome.'},
    unknown: {label:'Evidence needed', action:'Search the experiment records', href:'index.html#atlas', reason:'No supported instrument answers this question as written. Identify a measurable quantity and an applicable experiment.'}
  };
  function matchIntent(question, general) {
    const q = question.normalize('NFKC').toLowerCase();
    if (!q) return 'trial';
    // Quoting an unsupported claim for verification differs from asserting it as a result.
    if (general?.type === 'referee' || /\b(exact|verbatim) quot(?:e|ation)\b/.test(q)) return 'referee';
    const lunar = /\b(moon|lunar|fm[²2])\b/.test(q);
    if (/\b(certif\w*|approved for flight|flight.?ready|safe to (?:fly|inhabit|use)|safe for (?:flight|crew|astronauts))\b/.test(q)) return 'unknown';
    if (lunar && /\b(actually|observed|confirmed|official results?|already|measured on the moon|did .+ burn)\b/.test(q)) return 'unknown';
    if (general?.boundary === 'observations') return 'unknown';
    if (['incident','compass','compare'].includes(general?.type)) return general.type;
    const fireDomain = /\b(fire|smoke|oxygen|fan|flame|flammability|ventilation|burn|combustion|spread|spacecraft|microgravity|lunar|moon|rulebook|detector|ignition|fabric)\b/.test(q);
    if (fireDomain && (general?.type === 'rulebook' || /\bdoes .+ guarantee .+\b/.test(q))) return 'rulebook';
    const aggregate = /\b(how many|count|mean|median|average|minimum|maximum|range|fraction of|percentage of)\b/.test(q);
    if (aggregate && /\b(archive|rows?|records?|tests?|samples?|droplets?|observations?|experiments?|saffire|flex|psi-\d+|normalized)\b/.test(q)) return 'archive';
    if (general?.type === 'record' && /\b(row|atlas|notebook|original|data entry|record|look up|cite)\b/.test(q)) return 'evidence';
    if (/\b(smoke|tracer|detectors?|sensors?|aerosol|inter.?zone)\b/.test(q)) return 'detector';
    if (/\b(methanol|heptane|droplets?|flex|paired runs?|matched pairs?)\b/.test(q)) return 'matched';
    if (/\bbrier\b/.test(q)) return 'prediction';
    if (/\b(next|plan|design|hypothetical|update)\b/.test(q) && /\b(lunar|fm.?2|burn|oxygen threshold)\b/.test(q)) return 'forecast';
    if (general?.type === 'forecast' || lunar && /\b(forecast|threshold|probability|chance)\b/.test(q) || fireDomain && /\bforecast\b/.test(q)) return 'prediction';
    if ((general?.type === 'physics' || /\b(sealed pod|closed cabin)\b/.test(q)) && /\b(volume|size|mass|pressure|oxygen|fire|flame|burn\w*|fuel|change|simulate|model|solver|temperature|heat|spread|strip|planet|material|front|energy|power|speed|seconds?)\b/.test(q)) return 'trial';
    if (/^(?:rover|cabin)(?: (?:model|trial|sandbox))?\??$/.test(q) || /\b(chassis mass|strip length|fuel mass|front travel|oxygen cutoff|battery power)\b/.test(q)) return 'trial';
    if (/\b(?:what if|change|vary|simulate|set|switch|double|halve)\b/.test(q) && /\b(front|time|rate|speed|flow|material|oxygen|pressure|volume|cellulose|polyethylene)\b/.test(q)) return 'trial';
    if (general?.type === 'record' || /\b(saffire|sibal|psi[- ]?\d+|atlas|orbital (?:run|observation|measurement)|nasa (?:record|measur\w+))\b/.test(q)) return 'evidence';
    return 'unknown';
  }
  function chooseIntent(context) {
    const question = typeof context.question === 'string' ? context.question.trim().slice(0,480) : '';
    const manual = Object.hasOwn(routes,context.intentOverride);
    const general = question && !manual ? globalThis.FFIntentRouter?.detect(question,[],context.archive) : null;
    const id = manual ? context.intentOverride : matchIntent(question,general);
    const decision = {id,...routes[id],manual};
    if (manual) decision.reason = 'You selected this instrument for the question.';
    else if (!question) decision.reason = 'The current experiment links a flight measurement to a rover scenario.';
    if (['compass','compare','rulebook'].includes(id) && general?.type === id) decision.href = 'index.html'+general.href;
    if (id === 'compare') {
      const rows = [...new Set(question.toUpperCase().match(/\bPSI-\d+:\d+:\d+\b/g) || [])];
      if (rows.length === 2) decision.href = 'index.html#atlas?' + new URLSearchParams({left:rows[0],right:rows[1]});
    }
    if ((id === 'archive' || id === 'incident') && question) decision.href += '?q=' + encodeURIComponent(question);
    if (id === 'evidence') {
      const explicitRow = question.toUpperCase().match(/\bPSI-\d+:\d+:\d+\b/);
      if (explicitRow) decision.href += '?record=' + encodeURIComponent(explicitRow[0]);
      else if (/\bsaffire[- ]?(?:i|1)\b/i.test(question) && /\b(concurrent|opposed)\b/i.test(question)) {
        const direction = /\bopposed\b/i.test(question) ? 'opposed' : 'concurrent';
        decision.href += '?record=' + encodeURIComponent(sources[direction].row);
      }
    }
    return decision;
  }
  function devicePolicy(context) {
    const auto = deviceTools.chooseTier(context.navigator || {}, context.signals || {});
    const manual = ['lite','standard','pro'].includes(context.display);
    const tier = manual ? context.display : auto.tier;
    return {tier,reason:manual ? 'You selected '+tier+' mode.' : auto.reason,
      showPlot:tier !== 'lite',expandDetails:tier === 'pro',deferSurrogate:tier === 'lite',
      allowMotion:tier !== 'lite' && context.reducedMotion !== true};
  }
  function evidencePolicy(context) {
    const source = Object.hasOwn(sources,context.reference) ? sources[context.reference] : null;
    // A manually entered rate may happen to equal a measured one. Provenance requires both the selection and the number.
    const attributed = Boolean(source && Number.isFinite(context.speedMmS) && Math.abs(source.speed-context.speedMmS) < 1e-9);
    const withheld = context.valid === false || Boolean(context.limit);
    const result = {kind:withheld ? 'withheld' : 'simulated',attributed:attributed && !withheld,row:null,sourceURL:null,catalogueURL:null,
      claim:'The judge supplied the front speed. The cabin model uses that assumption to calculate the result.',
      nextMeasurement:'Measure front position over time on fresh specimens in the proposed material, atmosphere, gravity and flow.'};
    if (withheld) {
      result.claim = context.valid === false ? 'Correct the invalid input before interpreting the trial.' : String(context.limit);
      result.nextMeasurement = 'Establish the missing condition or choose a case supported by both the design and cabin models.';
    } else if (attributed) {
      Object.assign(result,{row:source.row,sourceURL:publication,catalogueURL:catalogue,
        claim:'Saffire-I '+source.run+' supplies the '+source.speed+' mm/s orbital rate. Rover travel and cabin oxygen are calculated for the selected conditions.',
        nextMeasurement:'Test fresh matched specimens in both flow directions and counterbalance the order. The Saffire-I directions were tested in sequence on one specimen.'});
    }
    return result;
  }
  function statePolicy(context, fields) {
    if (context.valid === false) return {phase:'invalid', nextAction:'Correct the input',reason:'The trial has an invalid model input.'};
    if (context.limit) return {phase:'withheld', nextAction:'Resolve the missing condition',reason:String(context.limit)};
    if (!context.hasBaseline) return {phase:'baseline',nextAction:'Save this trial as the baseline',reason:'A baseline keeps the inputs, source and clock together for comparison.'};
    if (fields.length > 1) return {phase:'multi-change',nextAction:'Isolate one change',reason:fields.length+' inputs differ from baseline A. This difference combines their effects.'};
    if (fields.length === 1) {
      let nextAction = 'Inspect the result, then record the comparison';
      let reason = 'Only '+fields[0]+' differs from baseline A.';
      if (context.outcome === 'Oxygen cutoff') { nextAction = 'Inspect the starting oxygen inventory'; reason += ' The solver reached its oxygen cutoff.'; }
      if (context.outcome === 'End of strip') { nextAction = 'Inspect the available strip length'; reason += ' The front reached the end of the strip.'; }
      if (context.outcome === 'Front stationary') { nextAction = 'Inspect the imposed front speed'; reason += ' The modeled front stayed still.'; }
      return {phase:'single-change',nextAction,reason};
    }
    if (Number.isFinite(context.comparisonCount) && context.comparisonCount > 0) {
      return {phase:'identical',nextAction:'Vary one condition',reason:'The current inputs match baseline A. Repeating these inputs checks reproducibility.'};
    }
    return {phase:'ready',nextAction:'Change one condition',reason:'Baseline A is available. Choose a flow direction, material, cabin condition or time to investigate.'};
  }
  function evaluate(context = {}) {
    const level = Object.hasOwn(guidance,context.level) ? context.level : 'undergraduate';
    const reader = {level,guidance:guidance[level]};
    const device = devicePolicy(context);
    const intent = chooseIntent(context);
    const evidence = evidencePolicy(context);
    const fields = Array.isArray(context.changedFields) ? [...new Set(context.changedFields.filter(f => typeof f === 'string' && f.trim()))] : [];
    const state = statePolicy(context,fields);
    const clock = Number.isFinite(context.elapsedSeconds) && context.elapsedSeconds >= 0 ? ' at '+context.elapsedSeconds+' s' : '';
    const stateObservation = (context.restored ? 'Restored trial' : 'Current trial') + clock + (context.hasBaseline ? ' · baseline available' : ' · no baseline');
    let deviceResponse = device.showPlot ? 'Show the time series.' : 'Show numerical readouts. Defer the liquid model until requested.';
    if (device.expandDetails) deviceResponse += ' Expand the detailed record.';
    const layers = [
      {id:'user',label:'Reader',observed:level,response:reader.guidance},
      {id:'intent',label:'Question',observed:(intent.manual ? 'Selected instrument' : 'Detected intent')+' · '+intent.label,response:intent.reason},
      {id:'state',label:'Experiment state',observed:stateObservation,response:state.reason+' '+state.nextAction+'.'},
      {id:'device',label:'Device',observed:device.tier+' · '+device.reason,response:deviceResponse},
      {id:'evidence',label:'Evidence',observed:evidence.row || (evidence.kind === 'withheld' ? 'Unsupported scenario' : 'User-specified rate'),response:evidence.claim}
    ];
    return {reader,device,intent,state,evidence,layers};
  }
  const api = {evaluate};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.FFJudgeAwareness = api;
})();
