/* One tab holds the research question, the user's preferences and the latest result from each instrument. */
(() => {
  'use strict';
  const key = 'first-fire.investigation-desk.v1';
  const trials=typeof window==='undefined'?require('./trial-comparison.js'):window.FFTrialComparison;
  const levels = {beginner:'Beginner', undergraduate:'Undergraduate', advanced:'Advanced'};
  const display = {auto:'Automatic', lite:'Lite', standard:'Standard', pro:'Pro'};
  const tools = {
    atlas:{name:'Atlas evidence', kind:'Archived observation', url:'#atlas'},
    'rover-design':{name:'Modular rover designer', kind:'Engineering simulation', url:'#rover-design'},
    physics:{name:'Rover and cabin', kind:'Simulation', url:'#physics?mode=rover'},
    'transfer-lab':{name:'Matched FLEX experiments', kind:'Archive comparison', url:'#transfer-lab'},
    'transport-lab':{name:'Tracer transport', kind:'Simulation', url:'#transport-lab'},
    'design-lab':{name:'FM² experiment design', kind:'Hypothetical result', url:'#design-lab'},
    chat:{name:'Archive question', kind:'Archive calculation', url:'#chat'}
  };
  const initial = () => ({version:1, active:false, question:'', level:'undergraduate', display:'auto', reference:'concurrent', referenceOrigin:'catalogue preview', notes:'', trialComparison:null, records:{}, lastTool:null});
  const saffire = {
    concurrent:{burn:'S1', row:'PSI-98:1:2', speed:1.8, flow:'with the airflow'},
    opposed:{burn:'S2', row:'PSI-98:1:3', speed:1.3, flow:'against the airflow'}
  };
  const study = 'https://doi.org/10.60555/0t15-1z43';
  const publication = 'https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21';
  const signed = '9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3';
  const descriptions = {
    beginner:'Choose a question and follow a fire experiment into a rover model. A measurement is what an instrument recorded. A simulation shows what happens under the conditions you choose.',
    undergraduate:'Trace a source row, select an imposed flame-front speed and change a cabin condition. Save the assumptions alongside the calculated oxygen, energy and flame travel.',
    advanced:'Track the accession, measured endpoint and source conditions separately from model inputs. Inspect the imposed propagation law, oxygen budget and synthetic-surrogate residual before transferring a result.'
  };
  function automatic(nav) {
    const ram = Number(nav?.deviceMemory), cores = Number(nav?.hardwareConcurrency);
    if (nav?.connection?.saveData || (ram > 0 && ram <= 2) || (cores > 0 && cores <= 2))
      return {tier:'lite', reason:'The browser reports data saving or limited processing capacity.'};
    if (ram >= 8 && cores >= 8)
      return {tier:'pro', reason:'The browser reports at least 8 GB of memory and eight logical cores.'};
    return {tier:'standard', reason:'The browser reports typical capacity or does not expose enough hardware information.'};
  }
  function freshInvestigation(state) {
    return {...initial(),active:true,level:state.level,display:state.display};
  }
  function restore(raw) {
    const fresh = initial();
    if (raw?.version !== 1 || !raw.records || typeof raw.records !== 'object') return fresh;
    const records = {};
    for (const [name,item] of Object.entries(raw.records)) {
      if (Object.hasOwn(tools,name) && item?.record && typeof item.summary === 'string') records[name]=item;
    }
    return {...fresh, records, trialComparison:trials.restore(raw.trialComparison), active:raw.active === true, level:Object.hasOwn(levels,raw.level)?raw.level:fresh.level,
      display:Object.hasOwn(display,raw.display)?raw.display:fresh.display, reference:Object.hasOwn(saffire,raw.reference)?raw.reference:fresh.reference,
      referenceOrigin:['source selector','Atlas pin'].includes(raw.referenceOrigin)?raw.referenceOrigin:'catalogue preview',
      question:typeof raw.question==='string'?raw.question.slice(0,480):'', notes:typeof raw.notes==='string'?raw.notes.slice(0,1600):'',
      lastTool:Object.hasOwn(records,raw.lastTool)?raw.lastTool:null};
  }
  function capture(state, detail) {
    if (!detail || !Object.hasOwn(tools,detail.tool)) return false;
    if (detail.invalid || detail.valid===false) {
      if (!Object.hasOwn(state.records,detail.tool)) return false;
      delete state.records[detail.tool];
      if (state.lastTool===detail.tool) state.lastTool=Object.keys(state.records).at(-1)||null;
      return true;
    }
    if (!detail.record || typeof detail.record!=='object' || typeof detail.summary!=='string') return false;
    if (!state.active && !['physics','atlas','rover-design'].includes(detail.tool)) return false;
    if (detail.tool==='atlas') {
      const direction=Object.keys(saffire).find(name=>saffire[name].row===detail.record.id);
      if(direction) {state.reference=direction;state.referenceOrigin='Atlas pin';}
      else if(state.referenceOrigin==='Atlas pin') state.referenceOrigin='catalogue preview';
    }
    state.active=true;
    delete state.records[detail.tool];
    state.records[detail.tool]={questionAtCapture:state.question,title:detail.title || tools[detail.tool].name, summary:detail.summary,record:detail.record};
    state.lastTool=detail.tool;
    return true;
  }
  function recommendation(state) {
    const question=state.question.toLowerCase();
    const record=state.records[state.lastTool]?.record;
    const physics = state.records.physics?.record;
    const pinnedReference=state.lastTool==='atlas' && Object.keys(saffire).find(name=>saffire[name].row===record?.id);
    const suggestion=(tool,action,reason,url=tools[tool].url)=>({tool,action,reason,url});
    if (/airlock|suitport|wheel|solar panel|radiator|crew consumption|crew oxygen|rover parts|modular rover|hybrid rover|assemble.*rover|custom rover|chassis load|rover design|crew access/.test(question) || (!question && state.lastTool==='rover-design'))
      return suggestion('rover-design','Open the modular rover designer','Change a part or mission condition and inspect the resulting mass, power, thermal and atmosphere budgets.');
    if (/smoke|tracer|sensor|detector|mixing|ventilat|leak/.test(question) && !/rover|chassis/.test(question))
      return suggestion('transport-lab','Test tracer transport','Vary the exchange between compartments and compare the remote sensor signal.');
    if (/next burn|lunar test|threshold|forecast|fm[²2]|probabilit/.test(question))
      return suggestion('design-lab','Plan the next oxygen test','Choose a hypothetical result and inspect the next recommended oxygen setting.');
    if (/flex|droplet|methanol|matched|heptane/.test(question) && !/how many|count|average of all/.test(question))
      return suggestion('transfer-lab','Match flight experiments','Choose eligible orbital droplet pairs before comparing recorded outcomes.');
    if (/how many|count|average of all/.test(question))
      return suggestion('chat','Query the archive','Open the question with its archive fields and inspect the rows behind the answer.','#chat?q='+encodeURIComponent(state.question));
    if (/rover|cabin|material|fabric|strip|front|spread|battery|heat/.test(question) || pinnedReference || (state.lastTool==='physics' && physics))
      {
        if(pinnedReference) return suggestion('physics','Use the pinned Saffire-I run','Apply the published speed for '+record.id+' to a rover scenario. The resulting travel is simulated.','#physics?mode=rover&reference='+pinnedReference);
        if(physics) return suggestion('physics','Change one cabin condition','Your latest trial stopped at '+(physics.outputs?.state || 'the selected time')+'. Vary one input and inspect the change in front travel and wet oxygen.');
        return suggestion('physics','Open the rover model','Choose a cabin and material, then set the imposed front speed. You can also transfer a published speed using the source selector below.');
      }
    if (state.lastTool==='atlas') return suggestion('atlas','Inspect the pinned source','Check the experiment gas, specimen and endpoint before using this record in a model.','#atlas?record='+encodeURIComponent(record.id));
    return suggestion('atlas','Choose a source observation','Begin with a recorded experiment. Use “Use this record in investigation” to keep the conditions and source together.');
  }
  function exportState(state,nav) {
    const effective=state.display==='auto'?automatic(nav).tier:state.display;
    const ref=saffire[state.reference];
    return {schema:'first-fire.investigation.v1',question:state.question,readerLevel:state.level,
      device:{preference:state.display,effectiveTier:effective},selectedReference:{selectionOrigin:state.referenceOrigin,direction:state.reference,sourceRow:ref.row,
      measuredSpeedMmS:ref.speed,sourceURL:study,publicationURL:publication,locator:'NASA Saffire-I results, slide 21',
      transferLimit:'Flight rates were measured in orbit on SIBAL fabric at 20 cm/s forced flow. A rover run uses an imposed input.'},
      trialComparison:trials.exportComparison(state.trialComparison),
      results:state.records,lastTool:state.lastTool,decision:state.notes,nextAction:recommendation(state),signedForecastSHA256:signed};
  }
  const core={initial,automatic,restore,capture,recommendation,exportState,freshInvestigation};
  if (typeof module!=='undefined' && module.exports) module.exports=core;
  if (typeof window==='undefined') return;
  let state=initial(), persisted=true;
  try {state=restore(JSON.parse(sessionStorage.getItem(key)));} catch {}
  function save() {try {sessionStorage.setItem(key,JSON.stringify(state));persisted=true;} catch {persisted=false;}}
  const tier=()=>state.display==='auto'?automatic(navigator).tier:state.display;
  const level=()=>state.level;
  const E=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
  function link(text,href,cls='inlinebtn') {const a=E('a',text,cls);a.href=href;return a;}
  function field(text,control) {const box=E('label',text,'field');box.append(control);return box;}
  function select(options,value) {
    const control=E('select');
    for(const [key,title] of Object.entries(options))control.add(new Option(title,key));
    control.value=value;return control;
  }
  function section(title) {const box=E('section',null,'panel aw-panel');box.append(E('h2',title));return box;}
  const labelize=s=>s.replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2');
  function receipts(box,r) {
    const sources=Array.isArray(r.sources)?r.sources:[r.sourceURL,r.table_url,r.source].filter(Boolean);
    const seen=new Set();
    for (const src of sources) {
      const url=typeof src==='string'?src:src?.url;
      if (!url || !/^https?:\/\//i.test(url) || seen.has(url))continue;
      seen.add(url);
      const a=link(typeof src==='object'?(src.title || src.label || 'Open source'):'Open source record',url);
      a.target='_blank';a.rel='noopener noreferrer';
      box.append(a);
    }
  }
  function recordCard(tool,entry) {
    const r=entry.record, card=E('article',null,'aw-record');
    card.append(E('span',tools[tool].kind,'eyebrow'),E('h3',entry.title),E('p',entry.summary));
    const origin=E('p',entry.questionAtCapture?'Question at capture · '+entry.questionAtCapture:'Captured before a research question was entered.','aw-origin');
    if(entry.questionAtCapture!==state.question)origin.classList.add('aw-earlier');
    card.append(origin);
    if(tool==='atlas') card.append(E('p',[r.id,r.sourceFile,r.sourceRow?'CSV row '+r.sourceRow:''].filter(Boolean).join(' · '),'aw-origin'));
    if(tool==='physics' && r.reference && saffire[r.reference]) {
      const ref=saffire[r.reference];card.append(E('p','Imposed source speed · '+ref.speed+' mm/s '+ref.flow+' · '+ref.row,'aw-origin'));
    }
    if(tool==='physics' && r.outputs && r.inputs) {
      const info=E('dl',null,'aw-metrics');
      const format=x=>Number.isFinite(x)?x.toLocaleString('en-US',{maximumFractionDigits:3}):'Unavailable';
      const pairs=[
        ['Cabin condition',r.inputs.planet+' · '+r.inputs.volume+' m³ · '+r.inputs.pressure+' kPa'],
        ['Imposed front speed',format(r.inputs.speed)+' cm/s'],
        ['Modeled front at '+r.seconds+' s',format(r.outputs.position)+' cm'],
        ['Solver O₂',format(r.outputs.oxygen)+' wet vol%'],
        ['Liquid network O₂',r.liquid?format(r.liquid.oxygenPercent)+' wet vol%':'Outside training range'],
        ['Absolute network error',r.liquid?format(r.liquid.errorPercentagePoints)+' percentage points':'Unavailable']
      ];
      for(const [name,value] of pairs)info.append(E('dt',name),E('dd',value));
      card.append(info,link('Reopen the solver and liquid model →','#physics?mode=rover'));
    }
    const boundary=r.boundary || r.scope || r.interpretation ||
      (tool==='chat'?'Archive results apply to the named fields, qualifiers and source rows.':'Check the original apparatus and recorded endpoint before transferring this result.');
    card.append(E('p',typeof boundary==='string'?boundary:JSON.stringify(boundary),'aw-boundary'));
    const detail=E('details'),summary=E('summary','Inputs, results and source record');
    detail.append(summary);
    // Render the receipt on demand. Long chat source lists and sensor traces stay out
    // of the initial layout on small devices, but every exact field is exportable.
    const build=()=>{if(detail.childNodes.length>1)return;const pre=E('pre',JSON.stringify(r,null,2));pre.tabIndex=0;detail.append(pre);};
    detail.ontoggle=()=>{if(detail.open)build();};
    if(tier()==='pro' && tool===state.lastTool){build();detail.open=true;}
    const sources=E('div',null,'actions');receipts(sources,r);
    card.append(detail,sources);return card;
  }
  function render(root) {
    if(!state.active){state.active=true;save();}
    root.replaceChildren();
    const wrap=E('div',null,'aw-desk'), header=E('header',null,'pagetitle');
    header.append(E('div','Research desk / Investigation workspace','breadcrumb'),E('h1','Your fire investigation'));
    const explanation=E('p',descriptions[level()],'sub');header.append(explanation);wrap.append(header);
    const layout=E('div',null,'aw-grid'), left=E('div',null,'aw-col'), right=E('div',null,'aw-col');layout.append(left,right);wrap.append(layout);
    const questionBox=section('Research question'), question=E('textarea');
    question.rows=2;question.maxLength=480;question.value=state.question;
    question.placeholder='How would a measured flame speed change the front position in my rover?';
    const next=E('div',null,'aw-next');
    function showNext(){
      const n=recommendation(state);
      next.replaceChildren(E('p',n.reason),link(n.action+' →',n.url,'btn'));
    }
    question.oninput=()=>{state.question=question.value;save();showNext();};
    questionBox.append(field('What do you want to investigate?',question),next);showNext();left.append(questionBox);
    const sourceBox=section('From a flight measurement to a rover');sourceBox.classList.add('aw-source');
    const source=select({concurrent:'S1 · With airflow · 1.8 mm/s',opposed:'S2 · Against airflow · 1.3 mm/s'},state.reference);
    const provenance=E('div',null,'aw-provenance');
    function showSource() {
      const ref=saffire[state.reference];
      const notes={
        beginner:'NASA measured a flame moving along fabric in orbit. Use that speed to ask how far a flame moving at the same rate would travel in your cabin.',
        undergraduate:'Saffire-I used SIBAL cotton–fiberglass fabric in 20 cm/s forced flow. Apply the measured front speed as an assumed rover input and inspect the oxygen- or strip-limited travel.',
        advanced:'NASA slide 21 supplies the measured spread rate. PSI-98 supplies the orbital test metadata. The imposed rover speed is '+(ref.speed/10).toFixed(2)+' cm/s. Transferring it across gravity, fuel or flow needs independent validation.'
      };
      provenance.replaceChildren(E('p',notes[level()]),E('p',ref.row+' · slide 21','aw-origin'));
      const sources=E('div',null,'actions');sources.append(link('Inspect source row','#atlas?record='+encodeURIComponent(ref.row)),link('NASA spread measurement ↗',publication));
      provenance.append(sources,link('Use '+ref.speed+' mm/s in rover →','#physics?mode=rover&reference='+state.reference,'btn'));
    }
    source.onchange=()=>{state.reference=source.value;state.referenceOrigin='source selector';save();showSource();showNext();};
    sourceBox.append(E('p','Choose a rate from the two published Saffire-I runs. Other pinned Atlas rows keep their own conditions and endpoints.','small'),field('Measured spread direction',source),provenance);showSource();left.append(sourceBox);
    const preferences=section('Reading and device preferences');preferences.classList.add('aw-preferences');
    const reader=select(levels,level()), device=select(display,state.display), mode=E('p',null,'small');
    reader.onchange=()=>{state.level=reader.value;save();explanation.textContent=descriptions[level()];showSource();};
    function updateDevice() {
      const t=tier();wrap.dataset.tier=t;
      const reason=state.display==='auto'?' '+automatic(navigator).reason:' You selected this mode.';
      const output={lite:'Table readouts and collapsed records reduce drawing.',standard:'The rover plots the scenario and source records open on demand.',pro:'The rover plots the scenario and the latest record opens with its full numerical inputs.'};
      mode.textContent=display[t]+' mode. '+output[t]+reason;
    }
    device.onchange=()=>{state.display=device.value;save();updateDevice();drawRecords();};
    preferences.append(field('Explanation level',reader),field('Device mode',device),mode);updateDevice();right.append(preferences);
    const results=section('Investigation record'),list=E('div',null,'aw-list');
    function drawRecords() {
      const rows=Object.entries(state.records);
      rows.sort(([a],[b])=>a===state.lastTool?-1:b===state.lastTool?1:0);
      list.replaceChildren(...rows.map(([tool,entry])=>recordCard(tool,entry)));
      if(!rows.length)list.append(E('p','Pin an Atlas row or run a lab to collect its inputs, outcome and evidence here.'));
    }
    drawRecords();results.append(list);left.append(results);
    left.append(trials.panel({current:state.records.physics,comparison:state.trialComparison,
      onChange:value=>{state.trialComparison=value;save();},
      onReopen:entry=>{state.records.physics=entry;state.lastTool='physics';save();location.hash='#physics?mode=rover';}}));
    right.append(window.FFInvestigationReplay.panel());
    const decision=section('Research decision'),notes=E('textarea');notes.rows=3;notes.maxLength=1600;notes.value=state.notes;
    notes.placeholder='What changed, and which measurement would you need next?';
    notes.oninput=()=>{state.notes=notes.value;save();};
    const download=E('button','Download investigation JSON','btn');download.type='button';
    download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(exportState(state,navigator),null,2)+'\n'],{type:'application/json'}));
      const a=link('Download',url);a.download='first-fire-investigation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    const reset=E('button','Start a fresh investigation','ghost'), resetPanel=E('div',null,'aw-reset');
    reset.type='button';reset.onclick=()=>{
      const warn=E('p','Starting again clears this tab’s question, evidence and decision. Download the current investigation first if you want to keep it.');
      const clear=E('button','Clear investigation and start again','btn'),cancel=E('button','Keep current investigation','ghost');
      clear.type='button';cancel.type='button';
      clear.onclick=()=>{state=freshInvestigation(state);save();render(root);root.querySelector('textarea')?.focus();};
      cancel.onclick=()=>{resetPanel.replaceChildren(reset);reset.focus();};
      const actions=E('div',null,'actions');actions.append(clear,cancel);
      resetPanel.replaceChildren(warn,actions);cancel.focus();
    };
    resetPanel.append(reset);
    decision.append(field('Decision and next measurement',notes),download,resetPanel,E('p',persisted?'Saved in this tab. Download a copy to keep the evidence with your decision.':'Tab storage is unavailable. Download a copy before refreshing.','small'));right.append(decision);root.append(wrap);
  }
  function guide(route) {
    document.getElementById('aw-guide')?.remove();
    if(!state.active || !Object.hasOwn(tools,route) || route==='physics')return;
    const rail=E('nav',null,'aw-guide shell');rail.id='aw-guide';rail.setAttribute('aria-label','Investigation workspace');
    rail.append(link('← Your investigation','#awareness'),E('span',state.question || 'Review the question, evidence and results.'));
    document.getElementById('content').before(rail);
  }
  document.addEventListener('ff-research-result',event=>{if(capture(state,event.detail))save();});
  window.FFAwareness={render,guide,tier,level,active:()=>state.active,previous:tool=>state.active&&Object.hasOwn(state.records,tool)?state.records[tool].record:null};
})();
