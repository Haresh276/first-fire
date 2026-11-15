(() => {
  'use strict';
  const model = window.MaterialObserver;
  const el = id => document.getElementById(id);
  if (!model) {
    el('screen-label').textContent = 'Reference model unavailable';
    el('screen-note').textContent = 'Reload the page or open the FLINT methods below.';
    return;
  }
  const catalog = new Map(model.materials.map(m => [m.key, m.label]));
  const workspacePath = el('physics-link').getAttribute('href').split('#')[0];
  const places = {moon:'Moon', earth:'Earth', orbit:'Orbital freefall', mars:'Mars'};
  const outcomes = {sustained:'Flame kept spreading', extinguished:'Flame went out', unclear:'Inconclusive'};
  const storageKey = 'first-fire.material-observer.v1';
  let log = {scenarios:[], observations:[]};
  let analysis, editing = null, writable = true, invalidLink = '';
  const num = value => Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '—';
  const tag = (name, text, cls) => {
    const node = document.createElement(name);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  function button(text, handler, label) {
    const b = tag('button', text, 'plain');
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', handler);
    return b;
  }
  function setStatus(text) { el('log-status').textContent = text; }
  function validRecord(record) {
    const setup = record?.setup;
    return setup && typeof record.id === 'string' && typeof setup.name === 'string' &&
      typeof setup.construction === 'string' && setup.composition && typeof setup.composition === 'object' &&
      Object.hasOwn(places, setup.place) && [setup.fanCmS, setup.pressurePsia, setup.oxygenPct].every(Number.isFinite);
  }
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed.observations) || !Array.isArray(parsed.scenarios) ||
        !parsed.scenarios.every(validRecord) || !parsed.observations.every(r => validRecord(r) &&
          Object.hasOwn(outcomes,r.outcome) && Number.isFinite(r.measured))) throw Error();
      log = parsed;
    }
  } catch {
    writable = false;
    setStatus('Browser storage is unavailable or the saved format could not be read. Export any new entries to keep them.');
  }
  function persist(message) {
    if (writable) {
      try { localStorage.setItem(storageKey, JSON.stringify(log)); }
      catch { writable = false; }
    }
    setStatus(message + (writable ? '' : ' This session cannot save to browser storage. Export the JSON to keep your changes.'));
  }
  function makeIngredient(key, pct) {
    const row = tag('div', undefined, 'ingredient');
    const select = tag('select');
    select.setAttribute('aria-label','Reference material');
    for (const [id, label] of catalog) select.add(new Option(label,id));
    select.value = key;
    const weight = tag('input');
    weight.type = 'number'; weight.min = '0'; weight.max = '100'; weight.step = 'any'; weight.value = pct;
    weight.setAttribute('aria-label','Mass percentage of ' + catalog.get(key));
    select.addEventListener('change', () => {
      weight.setAttribute('aria-label','Mass percentage of ' + catalog.get(select.value));
      refresh();
    });
    weight.addEventListener('input', refresh);
    const remove = button('×', () => {
      row.remove(); refresh(); el('add-material').focus();
    }, 'Remove ingredient');
    remove.className = 'remove';
    row.append(select,weight,remove); el('ingredients').append(row);
  }
  function setComposition(composition) {
    el('ingredients').replaceChildren();
    for (const [key,pct] of Object.entries(composition)) makeIngredient(key,pct);
  }
  function numberField(id) {
    const input = el(id);
    if (input.value === '' || !input.validity.valid) {
      throw Error('Check ' + input.labels[0].textContent.trim().toLowerCase() + ' (' + input.min + ' to ' + input.max + ').');
    }
    return input.valueAsNumber;
  }
  function setup() {
    const weightRows = Array.from(el('ingredients').children);
    const total = weightRows.reduce((sum,row) => sum + (row.querySelector('input').valueAsNumber || 0),0);
    el('total').textContent = 'Total ' + num(total) + '%';
    el('add-material').disabled = weightRows.length >= catalog.size;
    weightRows.forEach(row => { row.querySelector('button').disabled = weightRows.length === 1; });
    const composition = {};
    for (const row of weightRows) {
      const key = row.querySelector('select').value, pct = row.querySelector('input').valueAsNumber;
      if (Object.hasOwn(composition,key)) throw Error('Each ingredient can appear once. Combine duplicate percentages.');
      if (!(pct > 0 && pct <= 100)) throw Error('Enter a positive mass percentage for every ingredient.');
      composition[key] = pct;
    }
    if (Math.abs(total - 100) > 0.00001) throw Error('Adjust the percentages to total 100%.');
    return {name:el('specimen-name').value.trim(), construction:el('construction').value.trim(), composition,
      place:el('place').value, pressurePsia:numberField('pressure'), fanCmS:numberField('fan'), oxygenPct:numberField('oxygen')};
  }
  function params(s) {
    const qs = new URLSearchParams({place:s.place,pressure:s.pressurePsia,oxygen:s.oxygenPct,fan:s.fanCmS,observer:'1'});
    if(s.name) qs.set('name',s.name);
    if(s.construction) qs.set('construction',s.construction);
    const entries = Object.entries(s.composition);
    if (entries.length === 1) qs.set('material',entries[0][0]);
    else qs.set('mix',entries.map(([k,p]) => k + ':' + p).join(','));
    return qs;
  }
  function setInputs(s) {
    el('specimen-name').value = s.name; el('construction').value = s.construction;
    setComposition(s.composition); el('place').value = s.place;
    el('pressure').value = s.pressurePsia; el('oxygen').value = s.oxygenPct; el('fan').value = s.fanCmS;
  }
  // Starting a reference case keeps the path back to the originating simulator.
  const originTool = new URLSearchParams(location.search).get('from');
  if (['gravity-lab','rover-case','physics','rover'].includes(originTool)) {
    for (const link of document.querySelectorAll('[data-case-example]')) {
      const url = new URL(link.href); url.searchParams.set('from', originTool); link.href = url.href;
    }
  }
  function initialSetup() {
    const q = new URLSearchParams(location.search);
    const s = {name:'Panel A', construction:'', composition:{PMMA:60, NOMEX:40}, place:'moon', pressurePsia:8.2, oxygenPct:34, fanCmS:0};
    if(q.get('name')) s.name=q.get('name').slice(0,120);
    if(q.get('construction')) s.construction=q.get('construction').slice(0,240);
    const problem='This link contains an invalid recipe or cabin setting. Use the example recipe to start a new calculation.';
    const keys=['place','pressure','oxygen','fan','mix','material'];
    if(keys.some(k=>q.getAll(k).length>1) || (q.has('mix')&&q.has('material'))) invalidLink=problem;
    const incoming = q.get('mix');
    if (q.has('mix')) {
      const parts = incoming.split(',').map(pair => pair.split(':'));
      if (parts.every(pair => pair.length===2 && catalog.has(pair[0]) && pair[1].trim() && Number.isFinite(+pair[1])) &&
        new Set(parts.map(([k]) => k)).size === parts.length)
        s.composition = Object.fromEntries(parts.map(([k,v]) => [k,+v]));
      else invalidLink=problem;
    } else if (catalog.has(q.get('material'))) s.composition = {[q.get('material')]:100};
    else if(q.has('material')) invalidLink=problem;
    if (Object.hasOwn(places,q.get('place'))) s.place=q.get('place');
    else if(q.has('place')) invalidLink=problem;
    for (const [query,key] of [['pressure','pressurePsia'],['oxygen','oxygenPct'],['fan','fanCmS']]) {
      const v=q.get(query);
      if(v !== null) {if(v.trim() && Number.isFinite(+v)) s[key]=+v;else invalidLink=problem;}
    }
    return s;
  }
  function statusText(r) {
    if (r.status==='reference' && Number.isFinite(r.limitPct)) return num(r.limitPct) + '% oxygen';
    return r.status==='components-only' ? 'Mixture limit unknown' : 'No modeled threshold';
  }
  function showScreen(r,s) {
    el('screen-label').textContent = statusText(r);
    el('screen-note').textContent = r.status==='reference' && Number.isFinite(r.limitPct) ?
      'Predicted minimum oxygen for sustained flame spread in the selected reference specimen.' : r.note;
    const parts=el('parts'); parts.replaceChildren();
    for (const p of r.parts) {
      const row=tag('div',undefined,'part'), head=tag('div',undefined,'part-head');
      head.append(tag('strong',p.label),tag('span',num(p.massPct)+'% by mass')); row.append(head);
      if (Number.isFinite(p.limitPct)) {
        const track=tag('div',undefined,'track'), bar=tag('span'), line=tag('i');
        track.setAttribute('aria-hidden','true'); bar.style.width=p.limitPct+'%'; line.style.left=s.oxygenPct+'%';
        track.append(bar,line);row.append(track,tag('p','Reference threshold '+num(p.limitPct)+'% oxygen. Cabin '+num(s.oxygenPct)+'% ('+
          num(Math.abs(p.marginPoints))+' percentage points '+(p.marginPoints<0?'below':p.marginPoints>0?'above':'from the threshold')+').'));
        if(p.matchingObservation) row.append(tag('p',p.matchingObservation.kind+' · NASA plot reading '+num(p.matchingObservation.observedPct)+'% oxygen.'));
      } else row.append(tag('p','No FLINT spread threshold for this ingredient at these conditions.'));
      parts.append(row);
    }
    el('screen-scope').textContent='Bars use the full-data fit for each reference specimen. The white mark shows cabin oxygen on a 0–100% scale. A new blend or construction needs its own burn tests.';
    const query=params(s).toString();
    el('physics-link').href=workspacePath+'#physics?'+query;
    el('rover-link').href=workspacePath+'#rover-design?'+query;
    const origin = new URLSearchParams(location.search).get('from');
    const standalone = {'gravity-lab':['fire-lab.html','Return to the gravity fire lab'], 'rover-case':['rover-fire-case.html','Return to the rover fire case']};
    if(Object.hasOwn(standalone,origin)) {
      const [page,label] = standalone[origin];
      el('return-tool').textContent=label;el('return-tool').href=page+'?'+query;el('return-tool').hidden=false;
    }
    window.MaterialEvidence?.render(el('material-evidence'),s);
  }
  function refresh() {
    const links=[el('physics-link'),el('rover-link')];
    el('input-status').textContent='';
    el('reset-link').hidden=!invalidLink;
    try {
      if(invalidLink) throw Error(invalidLink);
      const s=setup(), r=model.evaluate(s);analysis={s,r};showScreen(r,s);
      links.forEach(a=>a.removeAttribute('aria-disabled'));
    } catch (error) {
      analysis=null;el('input-status').textContent=error.message || 'Check the specimen and test conditions.';
      el('screen-label').textContent='Check the inputs';el('screen-note').textContent='Complete the recipe and conditions to recalculate.';
      el('parts').replaceChildren();el('screen-scope').textContent='';el('material-evidence').replaceChildren();
      links.forEach(a=>{a.removeAttribute('href');a.setAttribute('aria-disabled','true')});
      el('return-tool').hidden=true;
    }
    el('save-scenario').disabled=!analysis;
    el('save-observation').disabled=!analysis;
    renderRange();
  }
  function newTable(caption,columns) {
    const table=tag('table'), row=tag('tr');
    table.append(tag('caption',caption));
    for(const text of columns) {const th=tag('th',text);th.scope='col';row.append(th);}
    table.createTHead().append(row);table.createTBody();
    return table;
  }
  function addRow(table,values) {
    const row=table.tBodies[0].insertRow();
    for(const value of values) {
      const cell=row.insertCell();
      if(value instanceof Node) cell.append(value);else cell.textContent=value;
    }
  }
  function showValidation() {
    const data=model.validation(), primary=data.figure13, alt=data.alternate;
    const container=el('validation-values');
    const table=newTable('Drop-tower results from the primary figure, with each material held out in turn. Values are oxygen %.',
      ['NASA reference specimen','NASA plot','FLINT','Straight line']);
    for(const row of primary.rows) addRow(table,[row.label,num(row.observedPct),num(row.predictedPct),num(row.baselinePct)]);
    container.replaceChildren(table,tag('p','Average absolute error using Figure 13: '+num(primary.modelMaePoints)+' percentage points for FLINT and '+
      num(primary.baselineMaePoints)+' for the straight line. Using the alternate figure readings, FLINT scores '+num(alt.modelMaePoints)+
      ' points and the line scores '+num(alt.baselineMaePoints)+'. The choice of figures changes the ranking.'));
  }
  function recipe(composition) {
    return Object.entries(composition).map(([k,p])=>(catalog.get(k)||k)+' '+num(p)+'%').join(', ');
  }
  function settings(s) {return places[s.place]+', '+num(s.pressurePsia)+' psia, '+num(s.fanCmS)+' cm/s fan';}
  function summarize(r) {
    return {status:r.status,limitPct:r.limitPct,marginPoints:r.marginPoints,
      references:r.parts.map(p=>({key:p.key,limitPct:p.limitPct,marginPoints:p.marginPoints}))};
  }
  function renderScenarios() {
    el('compare-empty').hidden=!!log.scenarios.length;
    const out=el('comparison');out.replaceChildren();
    if(!log.scenarios.length) return;
    const table=newTable('Saved model scenarios',['Specimen and composition','Environment','Cabin oxygen','Screening result','']);
    for(const record of log.scenarios) {
      const s=record.setup;const first=tag('span',s.name+' · '+recipe(s.composition));
      const result=tag('div',statusText(record.model));
      if(record.model.status!=='reference') {
        const refs=record.model.references.filter(p=>Number.isFinite(p.limitPct)).map(p=>(catalog.get(p.key)||p.key)+' '+num(p.limitPct)+'%');
        if(refs.length) result.append(tag('p','Separate reference limits: '+refs.join(', '),'small'));
      }
      addRow(table,[first,settings(s),num(s.oxygenPct)+'%',result,button('Remove',()=>{
        log.scenarios=log.scenarios.filter(r=>r.id!==record.id);
        persist('Scenario removed.');renderScenarios();
      },'Remove saved scenario '+s.name)]);
    }
    out.append(table);
  }
  function signature(s) {
    const normalize=text=>text.trim().toLocaleLowerCase('en');
    return JSON.stringify([normalize(s.name),normalize(s.construction),s.place,s.pressurePsia,s.fanCmS,
      Object.entries(s.composition).sort(([a],[b])=>a.localeCompare(b))]);
  }
  function renderRange() {
    const out=el('observed-range');
    if(!analysis || !analysis.s.name || !analysis.s.construction) {
      out.textContent='Add the specimen name and construction or test specimen ID to compare observations.';return;
    }
    const key=signature(analysis.s);
    const matching=log.observations.filter(o=>signature(o.setup)===key);
    const stops=matching.filter(o=>o.outcome==='extinguished').map(o=>o.measured);
    const spreads=matching.filter(o=>o.outcome==='sustained').map(o=>o.measured);
    const stop=stops.length?Math.max(...stops):null, spread=spreads.length?Math.min(...spreads):null;
    const text=[];
    if(stop!==null) text.push('Highest oxygen where the flame went out: '+num(stop)+'%.');
    if(spread!==null) text.push('Lowest oxygen where it kept spreading: '+num(spread)+'%.');
    if(stop!==null&&spread!==null) text.push(stop<spread?'The observations bracket a possible transition between those two values.':
      'These observations overlap. They do not establish a single threshold. Check the specimen setup and repeat the tests.');
    else if(stop!==null||spread!==null) text.push('A test with the other outcome is needed to bracket a possible transition.');
    else text.push(matching.length?'Only inconclusive outcomes have been recorded.':'No matching burn observations yet.');
    out.textContent=text.join(' ');
  }
  function resetObservationForm() {
    editing=null;el('observation-form').reset();el('save-observation').textContent='Save observation';el('cancel-edit').hidden=true;
  }
  function renderObservations() {
    const list=el('observation-list');list.replaceChildren();
    for(const o of log.observations.slice().reverse()) {
      const article=tag('article',undefined,'record');
      article.append(tag('h3',o.setup.name+' · '+num(o.measured)+'% oxygen'),
        tag('p',outcomes[o.outcome]+' · '+settings(o.setup)),
        tag('p',o.setup.construction+' · '+recipe(o.setup.composition),'small'),
        tag('p','Source: '+o.source,'small'));
      if(o.notes) article.append(tag('p',o.notes));
      const controls=tag('div',undefined,'actions');
      controls.append(button('Edit',()=>{
        setInputs(o.setup);refresh();editing=o.id;
        el('measured').value=o.measured;el('outcome').value=o.outcome;el('notes').value=o.notes;el('source').value=o.source;
        el('save-observation').textContent='Update observation';el('cancel-edit').hidden=false;el('measured').focus();
      },'Edit observation for '+o.setup.name+' at '+num(o.measured)+'%'),button('Delete',()=>{
        log.observations=log.observations.filter(r=>r.id!==o.id);if(editing===o.id) resetObservationForm();
        persist('Observation deleted.');renderObservations();renderRange();
      },'Delete observation for '+o.setup.name+' at '+num(o.measured)+'%'));
      article.append(controls);list.append(article);
    }
  }
  el('add-material').addEventListener('click',()=>{
    const rows=Array.from(el('ingredients').querySelectorAll('select'),s=>s.value);
    const next=[...catalog.keys()].find(k=>!rows.includes(k));
    if(next) {makeIngredient(next,'');refresh();el('ingredients').lastElementChild.querySelector('input').focus();}
  });
  for(const id of ['oxygen','fan','pressure','place','specimen-name','construction']) el(id).addEventListener('input',refresh);
  function requireName() {
    if(analysis?.s.name) return true;
    el('specimen-name').reportValidity();el('specimen-name').focus();return false;
  }
  function newId() {return typeof crypto.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
  el('reset-link').addEventListener('click',()=>{
    const url=new URL(location.href);
    for(const key of ['mix','material','place','pressure','oxygen','fan','name','construction']) url.searchParams.delete(key);
    history.replaceState(null,'',url);invalidLink='';setInputs(initialSetup());refresh();
  });
  el('save-scenario').addEventListener('click',()=>{
    if(!analysis || !requireName())return;
    log.scenarios.push({id:newId(),savedAt:new Date().toISOString(),setup:analysis.s,model:summarize(analysis.r)});
    persist('Scenario saved for comparison.');renderScenarios();
    el('compare-heading').scrollIntoView({block:'nearest'});
  });
  el('cancel-edit').addEventListener('click',resetObservationForm);
  el('observation-form').addEventListener('submit',event=>{
    event.preventDefault();
    if(!analysis || !requireName())return;
    if(!analysis.s.construction || !el('source').value.trim()) {
      setStatus('Add a specimen ID or construction and a source so this test can be traced.');
      el(analysis.s.construction?'source':'construction').focus();return;
    }
    const record={id:editing||newId(),savedAt:new Date().toISOString(),setup:analysis.s,
      measured:el('measured').valueAsNumber,outcome:el('outcome').value,source:el('source').value.trim(),notes:el('notes').value.trim()};
    const index=log.observations.findIndex(o=>o.id===editing);
    if(index>=0)log.observations[index]=record;else log.observations.push(record);
    resetObservationForm();persist('Burn observation saved.');renderObservations();renderRange();
  });
  el('export-data').addEventListener('click',()=>{
    const report={schema:'first-fire.material-observer.v1',exportedAt:new Date().toISOString(),
      units:{composition:'mass percent',oxygen:'percent by volume',pressure:'psia',fan:'cm/s'},
      activeScreen:analysis?{setup:analysis.s,model:summarize(analysis.r)}:null,
      modelScope:'Reference specimen thresholds only. Component thresholds do not establish a mixture limit. Observations are entered by the user.',
      validation:model.validation(),...log};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
    const a=tag('a');a.href=url;a.download='first-fire-material-observer.json';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Exported the active screen, saved scenarios and observed burns.');
  });
  setInputs(initialSetup());showValidation();renderScenarios();renderObservations();refresh();
})();
