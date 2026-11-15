// Review data are kept in the mounted view. Only an explicit download writes a package.
const metrics = [
  ['mobility.massKg','Assembled mass','kg'],
  ['mobility.staticLoadPerWheelN','Static load per wheel','N'],
  ['power.generationW','Solar generation','W'],
  ['power.demandWh','Requested energy','Wh'],
  ['power.endWh','Stored energy at interval end','Wh'],
  ['power.unmetWh','Unserved demand','Wh'],
  ['thermal.rejectedMinusLoadW','Radiator rejection margin','W'],
  ['air.initialO2KPa','Cabin oxygen partial pressure','kPa'],
  ['air.oxygenSupplyG','Required oxygen supply','g'],
  ['air.unremovedCO2G','CO₂ left to remove','g'],
  ['air.accessLossMol','Gas lost on access','mol'],
  ['coupon.stoichiometricO2Mol','Oxygen for prescribed reaction','mol'],
  ['coupon.netChemicalPotentialKJ','Coupon chemical potential','kJ'],
  ['flow.ductSpeedMs','Duct mean speed','m/s'],
  ['flow.relativeDirection','Forced-flow orientation',''],
  ['flow.spreadRateMmS','Predicted flame spread','mm/s'],
  ['tracer.thresholdTimeWithDelayS','Detector alarm within window','s'],
  ['suppression.deliveredKg','Suppression agent delivered','kg'],
  ['suppression.extinction','Extinction outcome',''],
  ['sourcing.qualification','Stock qualification','']
];
const traverseMetrics = [
  ['state.distanceM','Distance travelled','m'],
  ['state.elapsedS','Elapsed time','s'],
  ['state.speedMps','Current speed','m/s'],
  ['state.driveWh','Drive energy','Wh'],
  ['state.hotelWh','Base-load energy','Wh'],
  ['state.solarWh','Solar energy generated','Wh'],
  ['state.curtailedWh','Solar energy curtailed','Wh'],
  ['state.batteryWh','Charge remaining','Wh'],
  ['waypointsReached','Waypoints reached','waypoints'],
  ['status','Run status',''],
  ['mode','Driving mode','']
];
const gapReasons = {
  'mobility.staticLoadPerWheelN':'No wheel contact in this case',
  'flow.spreadRateMmS':'Requires a matched material test',
  'tracer.thresholdTimeWithDelayS':'No alarm recorded within the window',
  'suppression.extinction':'Extinction requires a matched discharge test',
  'sourcing.qualification':'Lot qualification is unverified',
  'air.oxygenSupplyG':'Gas replenishment unavailable for this pressure gradient',
  'air.accessLossMol':'Access losses unavailable for this pressure gradient'
};
const at = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
const cleanLabel = value => String(value ?? '').trim().slice(0,100);
const numberFormat = new Intl.NumberFormat(undefined,{maximumSignificantDigits:5});
function valueAt(obj, path) {
  const value=at(obj,path);
  return typeof value === 'number' && !Number.isFinite(value) ? null : value ?? null;
}
function available(value) { return value !== null && value !== undefined; }
function display(value) {
  if (typeof value === 'number') return numberFormat.format(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
export function captureReview(scenario, result, traverse) {
  if (!scenario || !result) return null;
  return structuredClone({ scenario, result, traverse:traverse ?? null });
}
function gap(snapshot, path, run) {
  if (!snapshot) return 'No design captured';
  if (run) return snapshot.traverse ? 'Unavailable in this run' : 'No traverse recorded';
  const group=path.split('.')[0];
  if (['air','coupon','flow','tracer'].includes(group) && snapshot.result?.air === null) return 'Open deck';
  if (group === 'coupon' && snapshot.result?.coupon === null) return 'Material chemistry unknown';
  return gapReasons[path] ?? 'Unavailable in this case';
}
function row(a,b,[path,label,unit],run=false) {
  const root=run ? 'traverse' : 'result';
  const left=valueAt(a?.[root],path), right=valueAt(b?.[root],path);
  const numeric=typeof left === 'number' && typeof right === 'number';
  return {path, label, unit, a:left, b:right, delta:numeric ? right-left : null,
    changed:left !== right, aGap:available(left) ? null : gap(a,path,run), bGap:available(right) ? null : gap(b,path,run)};
}
function changedInputs(a,b) {
  if (!a || !b) return [];
  const changes=[];
  for (const group of ['parts','conditions','customNames']) {
    const left=a.scenario[group] ?? {}, right=b.scenario[group] ?? {};
    for (const key of new Set([...Object.keys(left),...Object.keys(right)])) {
      if (left[key] !== right[key]) changes.push({group,key,a:left[key] ?? null,b:right[key] ?? null});
    }
  }
  return changes;
}
function traverseBasis(a,b) {
  if (!a?.traverse || !b?.traverse) return 'Two traverse samples are needed to compare drive energy.';
  const fields=[['state.distanceM','travelled distances'],['state.elapsedS','elapsed times']];
  const different=[];
  for (const [path,label] of fields) {
    const x=valueAt(a.traverse,path),y=valueAt(b.traverse,path);
    if (typeof x !== 'number' || typeof y !== 'number') return 'Distance or elapsed time is missing from the traverse comparison.';
    if (Math.abs(x-y)>1e-8) different.push(label);
  }
  return different.length ? 'The runs have different '+different.join(' and ')+'. Energy totals cover those respective runs.' :
    'The two samples cover equal distance and elapsed time. Route, terrain and settings may still differ.';
}
export function compareReview(a,b) {
  return {engineering:metrics.map(m=>row(a,b,m)), traverse:traverseMetrics.map(m=>row(a,b,m,true)),
    changedInputs:changedInputs(a,b),traverseBasis:traverseBasis(a,b)};
}
function agencies(index) {
  return new Map([[index?.lead ?? 'NASA','United States · National Aeronautics and Space Administration'],
    ...Object.entries(index?.partners ?? {})]);
}
const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function researchRows(index,{agency='',query='',evidenceClass=''}={}) {
  const labels=agencies(index);
  const tokens=normalize(query).trim().split(/\s+/u).filter(Boolean);
  return (index?.sources ?? []).filter(s => {
    if (agency && s.agency !== agency || evidenceClass && s.evidenceClass !== evidenceClass) return false;
    const searchable=[s.agency, labels.get(s.agency), s.id,s.title,s.role,s.evidenceClass,s.conditions,s.supports,s.limits,s.locator,
      ...(s.quantities ?? []).map(q=>[q.quantity,q.value,q.unit].join(' '))].map(normalize).join(' ');
    return tokens.every(token=>searchable.includes(token));
  });
}
const teamClasses=['measurement','specification','experiment','mission description','engineering reference'];
function requiredText(value,label) {
  if (typeof value!=='string' || !value.trim()) throw new Error('Enter '+label+'.');
  return value.trim();
}
function teamSourceFields(draft) {
  const organization=requiredText(draft.organization,'the source organization');
  const title=requiredText(draft.title,'the source title');
  const url=webLink(requiredText(draft.url,'a source URL'));
  if(!url)throw new Error('Enter a complete HTTP or HTTPS source URL.');
  if(!teamClasses.includes(draft.evidenceClass))throw new Error('Choose an evidence class.');
  if(!Array.isArray(draft.quantities))throw new Error('Supply a list of quantities.');
  const quantities=draft.quantities.map(q=>{
    const quantity=requiredText(q?.quantity,'a name for each quantity');
    if(typeof q.value!=='number' || !Number.isFinite(q.value))throw new Error('Enter a finite number for '+quantity+'.');
    return {quantity,value:q.value,unit:requiredText(q.unit,'units for '+quantity)};
  });
  return {organization,title,url,locator:requiredText(draft.locator,'a page, table or section'),
    evidenceClass:draft.evidenceClass,quantities,conditions:requiredText(draft.conditions,'the collection or test conditions'),
    supports:requiredText(draft.supports,'the claim this source supports'),
    limits:requiredText(draft.limits,'the limitations'),origin:'user-supplied',verification:'unverified'};
}
export function createTeamEvidence(index) {
  const usedIds=new Set((index?.sources??[]).map(s=>s.id));
  const entries=new Map();let next=1;
  return {
    add(draft) {
      const fields=teamSourceFields(draft);
      while(usedIds.has('team-'+next))next++;
      const id='team-'+next++;usedIds.add(id);entries.set(id,{id,...fields});return id;
    },
    remove(id) {return entries.delete(id);},
    records() {return structuredClone([...entries.values()]);}
  };
}
export function createReviewPackage({team,baseline,current,index,catalog,pinned=[],teamEvidence=[],createdAt=new Date().toISOString()}) {
  if (!current) throw new Error('A valid current design is required.');
  const referenced=new Set([...(baseline?.result?.sourceIds ?? []),...(current.result.sourceIds ?? []),...pinned]);
  const usedIds=new Set([baseline,current].filter(Boolean).flatMap(snapshot=>Object.values(snapshot.scenario.parts ?? {})));
  const evidence=(index?.sources ?? []).filter(s=>referenced.has(s.id));
  const found=new Set(evidence.map(s=>s.id));
  const occupied=new Set((index?.sources??[]).map(s=>s.id));
  const submitted=teamEvidence.map(record=>{
    if(!/^team-[1-9]\d*$/.test(record.id)||occupied.has(record.id))throw new Error('Invalid or duplicate team evidence ID.');
    occupied.add(record.id);return {id:record.id,...teamSourceFields(record)};
  });
  return structuredClone({format:'first-fire.design-review',version:1,createdAt,team:cleanLabel(team),
    baseline:baseline ?? null,current,comparison:compareReview(baseline,current),
    comparisonDefinition:'Delta = current B minus captured A. Inputs, static interval totals and traverse totals retain their separate scopes.',
    sourceIndexAsOf:index?.asOf ?? null,selectedEvidenceIds:[...new Set(pinned)],evidence,teamEvidence:submitted,
    missingEvidenceIds:[...referenced].filter(id=>!found.has(id)),
    selectedParts:(catalog?.parts ?? []).filter(p=>usedIds.has(p.id)), compatibility:'unverified'});
}
function webLink(url) {
  try { const u=new URL(url); return ['https:','http:'].includes(u.protocol) ? u.href : null; } catch {return null;}
}
function localLink(path) {
  if (typeof path !== 'string' || !/^evidence\/files\/[\w.-]+$/u.test(path)) return null;
  return new URL('../'+path,import.meta.url).href;
}
function node(tag,text,cls) {
  const n=document.createElement(tag); if (text !== undefined) n.textContent=text; if (cls) n.className=cls; return n;
}
function action(label,callback) {
  const b=node('button',label); b.type='button'; b.addEventListener('click',callback); return b;
}
function field(label,control) {
  const n=node('label',label); n.append(control); return n;
}
function select(options) {
  const control=node('select');
  for (const [value,label] of options) {const o=node('option',label); o.value=value;control.append(o);}
  return control;
}
function details(label,open=false) {
  const box=node('details',undefined,'mr-fold');box.open=open;box.append(node('summary',label));return box;
}
function table(headings,rows) {
  const el=node('table'),head=node('thead'),tr=node('tr');el.append(head);head.append(tr);
  for (const h of headings) {const cell=node('th',h);cell.scope='col';tr.append(cell);}
  const body=node('tbody');
  for (const data of rows) {
    const line=node('tr');for (const [i,v] of data.entries()) {const cell=node(i===0?'th':'td',v);if(i===0)cell.scope='row';line.append(cell);}
    body.append(line);
  }
  el.append(body);const wrap=node('div',undefined,'mr-table');wrap.append(el);return wrap;
}
function metricTable(rows) {
  const show=(value,reason)=>available(value)?display(value):reason;
  return table(['Quantity','A','Current B','B − A'],rows.map(r=>[
    r.label+(r.unit?' ('+r.unit+')':''),show(r.a,r.aGap),show(r.b,r.bGap),
    r.delta !== null ? (r.delta>0?'+':'')+display(r.delta) : !available(r.a)||!available(r.b)?'—':r.changed?'Changed':'Same'
  ]));
}
function evidenceLink(label,url) {
  const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function paragraph(title,value) {
  const p=node('p');p.append(node('strong',title+' '),document.createTextNode(String(value)));return p;
}
function evidenceCard(record,pinned,onPin) {
  const card=details(record.title);
  card.classList.add('mr-record');
  const b=node('div',undefined,'mr-record-body');
  b.append(node('p',record.id+' · '+record.evidenceClass+' · '+record.role,'mr-meta'),
    paragraph('Scope',record.supports),paragraph('Conditions',record.conditions));
  const data=record.quantities ?? [];
  if(data.length) {
    const label=record.evidenceClass==='measurement'?'Reported measurements':'Reported quantities';
    b.append(node('h4',label));
    const ul=node('ul');for(const q of data)ul.append(node('li',q.quantity+' · '+q.value+' '+q.unit));b.append(ul);
  } else b.append(node('p','No applicable numeric quantity is extracted in this record.','mr-meta'));
  b.append(paragraph('Limits',record.limits),paragraph('Location in source',record.locator));
  const links=node('div',undefined,'mr-links');
  const url=webLink(record.url),local=localLink(record.localFile);
  if(url)links.append(evidenceLink('Primary source',url));if(local)links.append(evidenceLink('Archived file',local));
  const cb=node('input');cb.type='checkbox';cb.checked=pinned.has(record.id);
  cb.addEventListener('change',()=>onPin(record.id,cb.checked));
  const pin=node('label');pin.append(cb,document.createTextNode(' Include in export'));links.append(pin);b.append(links);card.append(b);return card;
}
function teamEvidencePanel(store) {
  const panel=node('section',undefined,'mr-team-evidence');
  const heading=node('h3','Team evidence'),list=node('div'),message=node('p',undefined,'mr-status');
  message.setAttribute('role','status');
  const addBox=details('Add team evidence'),form=node('form',undefined,'mr-team-form');
  const grid=node('div',undefined,'mr-team-fields');
  function input(label,type='text') {
    const control=node(type==='textarea'?'textarea':'input');
    if(type!=='textarea')control.type=type;
    control.required=true;
    grid.append(field(label,control));return control;
  }
  const org=input('Source organization'),title=input('Source title'),url=input('Source URL','url');
  const locator=input('Page, table or section');
  const klass=select(teamClasses.map(v=>[v,v]));klass.value='engineering reference';grid.append(field('Reported evidence class',klass));
  const conditions=input('Collection or test conditions','textarea'),supports=input('What the source supports','textarea');
  const limits=input('Limitations','textarea');
  const quantities=node('fieldset',undefined,'mr-team-quantities');quantities.append(node('legend','Reported quantities (optional)'));
  const rows=node('div');
  const addQuantity=action('Add quantity',()=>{
    const row=node('div',undefined,'mr-quantity-row');
    function qField(label,key,type='text') {
      const control=node('input');control.type=type;control.name=key;control.required=true;
      if(type==='number')control.step='any';
      row.append(field(label,control));return control;
    }
    const first=qField('Quantity','quantity');qField('Value','value','number');qField('Unit','unit');
    row.append(action('Remove quantity',()=>{row.remove();addQuantity.focus();}));rows.append(row);first.focus();
  });
  quantities.append(rows,addQuantity);
  const submit=node('button','Save team evidence');submit.type='submit';
  const formMessage=node('p',undefined,'mr-status');formMessage.setAttribute('role','status');
  form.append(grid,quantities,formMessage,submit);addBox.append(form);
  function render() {
    list.replaceChildren();
    for (const record of store.records()) {
      const item=details(record.organization+' · '+record.title);
      const body=node('div',undefined,'mr-record-body');
      body.append(node('p',record.id+' · User-supplied · Unverified · '+record.evidenceClass,'mr-meta'),
        paragraph('Scope',record.supports),paragraph('Conditions',record.conditions),paragraph('Limits',record.limits),
        paragraph('Location in source',record.locator));
      if(record.quantities.length){
        const ul=node('ul');for(const q of record.quantities)ul.append(node('li',q.quantity+' · '+q.value+' '+q.unit));body.append(ul);
      }
      const links=node('div',undefined,'mr-links');
      links.append(evidenceLink('Open supplied source',record.url),action('Remove record',()=>{
        store.remove(record.id);render();message.textContent='Removed '+record.title+' from the review.';
        addBox.querySelector('summary').focus();
      }));body.append(links);item.append(body);list.append(item);
    }
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const values=[...rows.children].map(row=>({
      quantity:row.querySelector('[name=quantity]').value,value:row.querySelector('[name=value]').valueAsNumber,unit:row.querySelector('[name=unit]').value
    }));
    try {
      store.add({organization:org.value,title:title.value,url:url.value,locator:locator.value,evidenceClass:klass.value,
        conditions:conditions.value,supports:supports.value,limits:limits.value,quantities:values});
    } catch(error){formMessage.textContent=error.message;return;}
    message.textContent='Included '+title.value.trim()+' in this review.';
    formMessage.textContent='';form.reset();klass.value='engineering reference';rows.replaceChildren();
    render();addBox.open=false;addBox.querySelector('summary').focus();
  });
  panel.append(heading,node('p','Add primary sources from any organization to the exported review. Team entries are user-supplied and unverified.','mr-meta'),
    message,list,addBox);
  return panel;
}
function download(pkg) {
  const blob=new Blob([JSON.stringify(pkg,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=node('a');a.href=url;a.download='rover-design-review.json';document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export function mountMissionReview(root,{catalog,sourceIndex,getScenario,getResult,getTraverse=()=>null}) {
  const index=sourceIndex, pinned=new Set(),teamSources=createTeamEvidence(sourceIndex);let baseline=null;
  const read=()=>{const scenario=getScenario(),result=getResult();return scenario && result ? {scenario,result,traverse:getTraverse() ?? null}:null;};
  const panel=node('section',undefined,'mission-review');
  const intro=node('header',undefined,'mr-intro');
  intro.append(node('h2','Design review'),node('p','Save one design, change the rover, then compare engineering budgets and drive runs.'));
  const teamInput=node('input');teamInput.type='text';teamInput.maxLength=100;teamInput.autocomplete='off';teamInput.placeholder='Team or project name';
  const status=node('p',undefined,'mr-status');status.setAttribute('role','status');
  const actionRow=node('div',undefined,'mr-actions');
  const save=action('Save current as A',()=>{
    const current=read();if(!current)return;
    baseline=captureReview(current.scenario,current.result,current.traverse);update();
    status.textContent='Saved '+baseline.scenario.name+' as A.';
  });
  const share=action('Export review JSON',()=>{
    const current=read();if(!current)return;
    download(createReviewPackage({team:teamInput.value,baseline,current,index,catalog,pinned:[...pinned],teamEvidence:teamSources.records()}));
    status.textContent='Downloaded the design review package.';
  });
  actionRow.append(save,share);
  const toolbar=node('div',undefined,'mr-toolbar');toolbar.append(field('Team / agency label (optional)',teamInput),actionRow);
  const cards=node('div',undefined,'mr-pair');
  const makeCase=caption=>{const box=node('article');const name=node('h3'),meta=node('p');box.append(node('small',caption),name,meta);cards.append(box);return {name,meta};};
  const aCase=makeCase('A · Saved baseline'), bCase=makeCase('B · Current design');
  const changed=details('Changed inputs'),engine=details('Engineering changes',true),traverse=details('Traverse comparison');
  const inputsBody=node('div'),engineBody=node('div'),runBody=node('div');
  const metricFilter=select([['changes','Changed quantities'],['all','All engineering quantities']]);
  const metricControls=node('div',undefined,'mr-metric-controls');
  metricControls.append(field('Comparison rows',metricFilter));
  metricFilter.addEventListener('change',update);
  changed.append(inputsBody);engine.append(metricControls,engineBody);traverse.append(runBody);
  panel.append(intro,toolbar,cards,status,engine,changed,traverse,teamEvidencePanel(teamSources));
  const library=node('section',undefined,'mr-library');library.append(node('h2','Agency research'),node('p','Search the source records by agency, instrument, measurement or test condition.'));
  const names=agencies(index),records=index?.sources ?? [];
  const codes=[...names.keys(),...new Set(records.map(s=>s.agency).filter(id=>!names.has(id)))];
  const agency=select([['','All agencies and sources'],...codes.map(c=>[c,names.has(c)?c+' · '+names.get(c):c])]);
  const category=select([['','All evidence classes'],...[...new Set(records.map(s=>s.evidenceClass))].sort().map(t=>[t,t])]);
  const search=node('input');search.type='search';search.placeholder='e.g. wheel, Jezero, 20 cm/s';
  const filters=node('div',undefined,'mr-filters');
  filters.append(field('Find evidence',search),field('Agency or institution',agency),field('Evidence class',category));
  const matches=node('p',undefined,'mr-count');matches.setAttribute('role','status');
  const groups=node('div',undefined,'mr-groups');
  library.append(filters,matches,groups);panel.append(library);root.replaceChildren(panel);
  function renderResearch() {
    const hits=researchRows(index,{agency:agency.value,query:search.value,evidenceClass:category.value});
    matches.textContent=index ? hits.length+' of '+records.length+' source records' : 'The source index is unavailable.';
    groups.replaceChildren();
    for (const code of codes) {
      const groupRecords=hits.filter(r=>r.agency===code);if(!groupRecords.length)continue;
      const caption=names.has(code)?code+' · '+names.get(code):code;
      const group=details(caption+' ('+groupRecords.length+')',Boolean(agency.value)||hits.length<=5);
      for(const r of groupRecords)group.append(evidenceCard(r,pinned,(id,add)=>{if(add)pinned.add(id);else pinned.delete(id);}));
      groups.append(group);
    }
    if (!hits.length && index) groups.append(node('p','No matching records. Change the search or filters.'));
  }
  function update() {
    const current=read();save.disabled=!current;share.disabled=!current;
    save.textContent=baseline?'Replace A with current':'Save current as A';
    function show(target,snap,empty) {
      target.name.textContent=snap?.scenario?.name ?? empty;
      target.meta.textContent=snap ? [snap.scenario.conditions?.world,snap.scenario.conditions?.phase,
        snap.traverse?.state?'Traverse sample captured':'No traverse sample'].filter(Boolean).join(' · ') : '';
    }
    show(aCase,baseline,'No baseline saved');show(bCase,current,'Correct the current design inputs');
    const comparison=compareReview(baseline,current);
    metricControls.hidden=!baseline||!current;
    if (!baseline || !current) {
      engineBody.replaceChildren(node('p',!current?'Current results are unavailable until the design inputs are valid.':'Save A to start comparing engineering results.'));
    } else {
      const shown=metricFilter.value==='all'?comparison.engineering:comparison.engineering.filter(r=>r.changed || r.aGap!==r.bGap);
      engineBody.replaceChildren(shown.length?metricTable(shown):node('p','The engineering quantities match. Select all engineering quantities to inspect the values and gaps.'));
    }
    const inputs=comparison.changedInputs;
    inputsBody.replaceChildren(inputs.length?table(['Input','A','Current B'],inputs.map(r=>[r.group+'.'+r.key,r.a ?? 'Unset',r.b ?? 'Unset'])):
      node('p',!baseline?'Save a baseline to compare inputs.':!current?'Current design unavailable.':'The assembly and input values match.'));
    runBody.replaceChildren(node('p',comparison.traverseBasis));
    if(baseline?.traverse||current?.traverse)runBody.append(metricTable(comparison.traverse));
  }
  search.addEventListener('input',renderResearch);agency.addEventListener('change',renderResearch);category.addEventListener('change',renderResearch);
  renderResearch();update();return {update};
}
