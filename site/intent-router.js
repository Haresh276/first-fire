/* F3. Route to governed tools. Only fields explicitly supplied in a question travel in the link. */
(() => {
  'use strict';
  const routes={
    record:['Experiment record','#atlas'],compare:['Compare records','#atlas'],compass:['Habitat Compass','#compass'],
    rulebook:['Test a rule','#rulebook'],forecast:['FM² forecast','#forecast'],physics:['Cabin physics','#physics'],
    incident:['Mission incident','#chat'],referee:['Verify a claim','#referee'],archive:['Archive calculation','#chat'],
    abstain:['Evidence missing','#sources']
  };
  const normalize=q=>String(q||'').normalize('NFKC').replace(/[–—−]/g,'-').toLowerCase();
  const cleanId=s=>normalize(s).replace(/[^a-z0-9]/g,'');
  const mission=/\b(?:apollo|as-204|grissom|chaffee|ed white|vassili tsibliev|jerry linenger|vika|plugs[- ]out|mir|skylab|columbia|challenger|soyuz|gemini)\b/;
  const studyName=/\b(?:luci|sibal|cfi(?:[- ]?g)?|flex(?:[- ]?(?:ii|2))?|same(?:[- ]?r)?|saffire(?:[- ]?(?:iii|ii|i|[123]))?|bass(?:[- ]?ii)?|spice|slice|acme|ices|psi[- ]?\d+)\b/;
  const measurement=/\b(?:how many|count|number of|mean|median|average|minimum|maximum|fraction|percent(?:age)?|proportion|share|missing|range)\b/;
  const specific=/\b(?:psi[- ]?\d+:\d+:\d+|\d{4,6}[a-z](?:-[a-z0-9]+)+|[a-z]\d{2}[a-z]\d{3}|\d{5}[- ]?[a-z]\d+|(?:flex|sample|run|record|row|test)[- #:]+\d+(?:-\d+)?)\b/g;
  const fieldNumber='([-+]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))';
  function units(q,key,unit,scale=1){
    const m=[...q.matchAll(new RegExp(fieldNumber+'\\s*(?:'+unit+')(?![a-z0-9])','g'))];
    return m.length===1?{[key]:Number(m[0][1])*scale}:{};
  }
  function inputFields(q,type){
    const position=/\b(?:moon|lunar)\b/.test(q)?'Moon':/\bmars|martian\b/.test(q)?'Mars':null;
    // A percentage must identify oxygen. A fuel mass fraction or the cutoff is a different field.
    const percentages=[...q.matchAll(/([-+]?\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:ambient |starting |initial )?(?:oxygen|o2)\b|\b(?:ambient |starting |initial )?(?:oxygen|o2)\s*(?:=|of|at|is|:)?\s*([-+]?\d+(?:\.\d+)?)\s*(?:%|percent)/g)];
    const inputs=percentages.length===1?{oxygen:Number(percentages[0][1]||percentages[0][2])}:{};
    const pressure=units(q,'pressure','kpa'),psia=units(q,'pressure','psia');
    if(Object.keys(pressure).length && !Object.keys(psia).length)inputs.pressure=pressure.pressure*(type==='compass'?1/6.894757293:1);
    if(Object.keys(psia).length && !Object.keys(pressure).length)inputs.pressure=psia.pressure*(type==='physics'?6.894757293:1);
    if(type==='compass'){
      Object.assign(inputs,units(q,'gravity','g(?:ravity)?'));
      if(!('gravity' in inputs)&&position)inputs.gravity=position==='Moon'?0.165:0.38;
      if(!('gravity' in inputs)&&/\b(?:orbit(?:al)?|microgravity)\b/.test(q))inputs.gravity=0;
      if(!('gravity' in inputs)&&/\bearth\b/.test(q))inputs.gravity=1;
      for(const [name,re] of [['solid',/\b(?:solid|fabric|strip|tape)\b/],['liquid',/\b(?:liquid|droplet|heptane|methanol)\b/],['gas',/\b(?:gas(?:eous)? fuel|burner)\b/],['aerosol',/\b(?:aerosol|smoke)\b/]])if(re.test(q))inputs.phase=name;
      return inputs;
    }
    if(position)inputs.planet=position;
    Object.assign(inputs,units(q,'volume','m3|cubic (?:metres?|meters?)'));
    const fuel=q.match(/\b(cellulose|polyethylene)\b/g);
    if(fuel?.length===1)inputs.fuel=fuel[0];
    Object.assign(inputs,units(q,'speed','cm/s'),units(q,'density','g/cm'),units(q,'length','cm(?!/)'));
    const cutoff=q.match(/(?:cutoff|cut-off|extinction threshold)\s*(?:at|of|=|:)?\s*(\d+(?:\.\d+)?)\s*%/);
    if(cutoff)inputs.cutoff=Number(cutoff[1]);
    const mass=q.match(/\b(\d+(?:\.\d+)?)\s*(?:g|grams?)\b(?!\s*(?:\/|gravity))/);
    if(mass)inputs.mass=Number(mass[1]);
    return inputs;
  }
  function references(q,archive){
    const studied=archive?.investigations||[];
    const studies=studied.filter(s=>new RegExp('(?:^|[^a-z0-9-])'+s.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z0-9-])','i').test(q)||q.includes(s.accession.toLowerCase()));
    const tokens=q.match(specific)||[];
    // Certain published short IDs are meaningful only after their study name. A
    // five-digit CFI-G sequence without its run suffix must remain unresolved.
    const named=/\b(?:saffire[- ]?(?:iii|ii|i|[123])|cfi[- ]?g|same[- ]?r|flex)\s+(?:sample |test |run )?(\d+(?:-\d+|[ ]?[a-z]\d+)?)\b/g;
    for(const m of q.matchAll(named))if(!tokens.some(t=>cleanId(t.replace(/^(?:flex|sample|run|record|row|test)[- #:]+/,''))===cleanId(m[1])))tokens.push(m[1]);
    const ids=[...new Set(tokens)], known=[];
    for(const token of ids){
      const compact=cleanId(token);
      const short=cleanId(token.replace(/^(?:flex|sample|run|record|row|test)[- #:]+/,''));
      const candidates=(archive?.tests||[]).filter(r=>cleanId(r.record_id)===compact||
        ((!studies.length||studies.some(s=>s.accession===r.accession)) && (cleanId(r.test_id)===short || (r.instrument_id && cleanId(r.instrument_id)===short))));
      if(candidates.length===1&&!known.includes(candidates[0].record_id))known.push(candidates[0].record_id);
    }
    return {ids,known,studies};
  }
  function intent(type,params={},extra={}){
    const [label,base]=routes[type],search=new URLSearchParams(params);
    if(type==='compass'||type==='physics')search.set('from','chat');
    return {type,label,href:base+(search.size?'?'+search:''),params,...extra};
  }
  function detect(question,previous=[],archive=globalThis.FF){
    const q=normalize(question),last=previous.at(-1),refs=references(q,archive);
    const moon=/\b(?:lunar|moon)\b/.test(q);
    const prediction=/\b(?:odds|likelihood|predictions?|preregistered|registered|locked|forecast|probabilit(?:y|ies)|brier|anticipated)\b/.test(q);
    const lunar=/\bfm[- ]?2\b|synergy pro|(?:lunar|moon) (?:fabric )?burns?|burns? on the moon|flammability of materials on the moon/.test(q) ||
      moon && /\b(?:fabric|burns?|spread|ignition|flammability|fuel strip|oxygen threshold)\b/.test(q) && prediction;
    const validating=/\b(?:audit|check|validate|verify|authenticate|fact[- ]?check|referee|word.for.word|planted|accurate|accurately|supports?|supported|genuine|verbatim)\b/.test(q) && /\b(?:quote[ds]?|claim|passage|quotation|statement|source|wording|referee)\b|["“]/.test(q);
    const sourceCheck=/\b(?:source|paper|authors?|report|passage|citation|quotation|original)\b/.test(q) &&
      /\b(?:really say|actually say|back(?:s)? up|faithful|verif(?:y|ication)|misquot(?:e|ed)|misrepresent|cherry.pick|made up|negation|entail(?:s|ment)?|support(?:ed)? by|attributed|trace .*wording)\b/.test(q);
    if(/\b(?:my|our|patient'?s?)\b.{0,40}\b(?:symptoms?|asthma|chest pain|medication|burn wound|oxygen saturation|smoke inhalation|inhaled smoke)\b|\b(?:diagnos\w*|prescri\w*|dosage|treat(?:ment)?)\b.{0,60}\b(?:patient|my|medication|smoke inhalation|burn wound)\b/.test(q))return intent('abstain',{}, {boundary:'clinical'});
    if(validating || sourceCheck || /["“].+["”].*\b(?:support|mean|prove|is true)/.test(q))return intent('referee');
    if(/\b(?:fabricate|invent|make up|ignore (?:all|previous)|certify|approve .*safe|declare .*safe)\b/.test(q))return intent('abstain',{}, {boundary:'request'});
    if(lunar && /\b(?:actually|already|observed|confirmed|measured|succeeded|so far|official results|did .*burn|flight outcomes?|empirical|returned data|results? from the (?:moon|lunar)|flight[- ]observed)\b/.test(q)&& !/\b(?:if|hypothetical|predict(?:ed)?|simulate)\b/.test(q))return intent('abstain',{},{boundary:'observations'});
    const rule=/rulebook|rule of thumb|(?:audit|test|examine|evaluate|check) (?:the |this |an? )?(?:rule|assumption)|can (?:we|i) assume|can .* stand in for|does .+ (?:mean|guarantee|prove|bound|imply)|always |can .* generalize|does .+ appl[yie]|(?:switch|turn)(?:ing)? off (?:the )?(?:fan|ventilation).*extinguish|prove .* safe/.test(q);
    const namedDomain=studyName.test(q)||/\b(?:flame|burning|smoke|detectors?|oxygen|extinction|flammab\w+|ventilation|gravity|fuel|alarm|spacecraft|fire test|ignition|ignit\w+)\b/.test(q);
    const transferQuestion=namedDomain && /\b(?:safe to (?:assume|conclude|infer|say)|reasonable to (?:assume|infer)|hold(?:s)? (?:true|for|across)|hold up|generaliz\w*|overgeneraliz\w*|stand[- ]in|surrogate for|proxy for|translate(?:s)? to|apply (?:across|to)|carry (?:over|across)|rule out|automatically|necessarily|enough to (?:prove|conclude)|counterexample|breaks? down|valid (?:assumption|inference)|can (?:we|i) (?:infer|conclude|treat|extrapolate))\b/.test(q);
    if(rule||transferQuestion)return intent('rulebook');
    if(/\bguarantee\b/.test(q))return intent('abstain',{}, {boundary:'certification'});
    const cabin=/\b(?:cabin|compartment|rover|enclosure|sandbox|sealed.box|closed volume|sealed chamber|crew module)\b/.test(q);
    const physics=/physics (?:lab|model|simulation)|mass balance|simulate|simulation|what.if|what happens if|if .*(?:burn|ignit)|heat release|consum(?:e|ed|ption)|sealed.cabin|(?:free|cabin) volume|time trace|oxygen depletion|pressure evolution|thermal history|combustion products|scrubber|carbon dioxide|co2|cubic met|\bm3\b|\bgrams?\b/.test(q);
    const habitat=/\b(?:habitat|atmosphere|compass|mission (?:conditions|profile|environment)|target environment|match(?:ing)? conditions|environmental analogue)\b/.test(q);
    const ranking=/compass|closest|nearest|rank|match|analogu?e|similar|comparable|overlap|representative|correspond|resembl|same conditions|best fit|which (?:experiment|record|test)|coverage/.test(q);
    if((cabin||/physics (?:lab|model|simulation)|mass.balance model/.test(q))&&physics&&!(habitat&&ranking))return intent('physics',inputFields(q,'physics'));
    const conditions=[/\b(?:oxygen|o2)\b/,/\b(?:kpa|psia|pressure)\b/,/\bgravity\b/].filter(rx=>rx.test(q)).length;
    const atmosphere=(habitat||cabin&&ranking) && conditions>=2;
    if((habitat||/\b(?:lunar|martian|mars|moon|orbit)\b/.test(q))&&ranking || atmosphere || /\b(?:habitat compass|compass)\b/.test(q))return intent('compass',inputFields(q,'compass'));
    if(lunar||/\bbrier|sustained.spread probability|(?:lunar|threshold) forecast|forecast\b.*(?:sustained spread|oxygen (?:limit|threshold))/.test(q)||last?.evidenceKind==='calculation'&&/^(?:and|then|what about|at |with )/.test(q))return intent('forecast');
    if(mission.test(q)||last?.intent?.type==='incident' && /^(?:who|when|why|what (?:about|caused)|how |did |and )/.test(q))return intent('incident');
    const compares=/\b(?:compare|compar(?:ison|able)|contrast|versus|vs|differ|differen(?:t|ces?)|differed|distinguish|side.by.side|alongside|next to|line up|juxtapose|what changed|which (?:fields|settings) match|in common|match .* with)\b/.test(q);
    const pair=refs.ids.length>=2||refs.studies.length>=2||studyName.test(q)&&/\b(?:between|both|two|and|versus|whereas)\b/.test(q);
    if(compares&&(pair||/\b(?:two|both) (?:records|rows|runs|tests|samples)/.test(q)||refs.studies.length>=2)&&!measurement.test(q)){
      return intent('compare',refs.known.length===2?{left:refs.known[0],right:refs.known[1]}:{},{refs});
    }
    if(globalThis.FFScienceChat?.isCandidate(q,previous) || measurement.test(q)&&/\b(?:archive|normalized|rows|records|observations|median|average)\b/.test(q))return intent('archive');
    const lookup=/\b(?:row|record|entry|notebook|archive|archived fields|source table)\b/.test(q) && /\b(?:find|show|locate|pull up|look up|retrieve|open|bring|fetch|where)\b/.test(q) && /\b(?:run|sample|test|experiment|flight|trial|specimen|study|investigation|id)\b/.test(q);
    if(refs.ids.length||refs.studies.length||studyName.test(q)||lookup||/\b(?:atlas|nomex|teflon|burner|kapton|cool flame|flammability|combustion|flame spread|fire detection)\b/.test(q)){
      const params=refs.known.length===1?{record:refs.known[0]}:refs.studies.length===1?{study:refs.studies[0].accession}:refs.ids.length?{q:refs.ids[0]}:{};
      return intent('record',params,{refs});
    }
    if(cabin&&/\b(?:model|physics|rover|sandbox)\b/.test(q))return intent('physics',inputFields(q,'physics'));
    if(last && /^(?:and |what about|why|what .*next|which source|tell me more|what was measured|how about|what did (?:they|it)|which of (?:those|them)|what changed there|repeat (?:that|it)|how was (?:that|it))/.test(q)&&last.intent&&last.intent.type!=='abstain')return intent(last.intent.type);
    return intent('abstain');
  }
  function applyInputs(key,p,root){
    if(!p||!p.size)return;
    const set=(element,value,event)=>{
      if(!element||value===undefined || value===null)return;
      if(element.tagName==='SELECT'&&![...element.options].some(o=>o.value===value))return;
      if(element.type==='number'&&!Number.isFinite(Number(value)))return;
      element.value=String(value);element.dispatchEvent(new Event(event,{bubbles:true}));
    };
    const missingChoice=(element,label)=>{
      if(!element)return;
      const empty=document.createElement('option');empty.value='';empty.textContent=label;
      element.prepend(empty);set(element,'','change');
    };
    if(key==='compass'){
      if(p.get('from')==='chat'&&!p.has('phase'))missingChoice(root.querySelector('[aria-label="Required test subject"]'),'Choose the test subject');
      if(p.get('from')==='chat')for(const [k,selector] of Object.entries({gravity:'Gravity (Earth g)',oxygen:'Ambient oxygen (%)',pressure:'Absolute pressure (psia)'})){
        if(!p.has(k))set(root.querySelector('[aria-label="'+selector+'"]'),'', 'input');
      }
      for(const [k,selector] of Object.entries({phase:'Required test subject',gravity:'Gravity (Earth g)',oxygen:'Ambient oxygen (%)',pressure:'Absolute pressure (psia)'})){
        if(p.has(k))set(root.querySelector('[aria-label="'+selector+'"]'),p.get(k),k==='phase'?'change':'input');
      }
    }
    if(key==='physics'){
      if(p.get('from')==='chat')for(const k of ['planet','fuel']){
        if(!p.has(k))missingChoice(root.querySelector('[name="'+k+'"]'),'Choose '+(k==='fuel'?'a fuel':'the surface'));
      }
      for(const k of ['planet','fuel','volume','oxygen','pressure','length','density','speed']){
        if(p.has(k))set(root.querySelector('[name="'+k+'"]'),p.get(k),['fuel','planet'].includes(k)?'change':'input');
        else if(p.get('from')==='chat'&&!['fuel','planet'].includes(k))set(root.querySelector('[name="'+k+'"]'),'', 'input');
      }
      if(p.has('cutoff')||p.get('from')==='chat')set(root.querySelector('[name="cutoff"]'),p.get('cutoff')||'', 'input');
    }
    if(key==='rulebook'&&p.has('entry')&&p.has('regime')){
      const i=Number(p.get('entry')),j=Number(p.get('regime'));
      if(Number.isInteger(i)&&Number.isInteger(j)&&i>=0&&j>=0&&j<3)root.querySelectorAll('tbody tr')[i]?.querySelectorAll('button')[j]?.click();
    }
  }
  globalThis.FFIntentRouter={routes,detect,applyInputs,intent,inputFields};
})();
