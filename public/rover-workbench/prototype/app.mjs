import { selectPart, setEnvironment, simulate } from './model.mjs';
import {mountWorkbench,driveFields} from './workbench.mjs';
import {buildDestinations,mountFinder,viewNames} from './finder.mjs';
import {mountMissionReview} from './mission-review.mjs';
import {mountFieldComparison} from './field-comparison.mjs';

const $ = id => document.getElementById(id);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const exampleFiles = [
  ['lunar-cellulose','Moon day · cellulose baseline'],
  ['lunar-pe','Moon day · polyethylene swap'],
  ['mars-night-pe','Mars night · changed conditions']
];
const partNames = {cabin:'Crew accommodation',chassis:'Chassis',wheels:'Wheel set',power:'Power supply',thermal:'Thermal control',lifeSupport:'Life support',access:'Crew access',detection:'Detection',suppression:'Suppression',material:'Material coupon',payload:'Payload'};
const partGroups = [
  ['Vehicle',['cabin','chassis','wheels','payload']],
  ['Power and cabin services',['power','thermal','lifeSupport','access']],
  ['Fire experiment',['material','detection','suppression']]
];
const metricGroups = [
  ['mobility','Mass and mobility',[
    ['massKg','Assembled mass','kg'],['staticSupportN','Total support force','N'],['staticLoadPerWheelN','Static load per wheel','N'],['idealSupportAccelerationMs2','Ideal support acceleration','m/s²'],['specificForceNormMs2','Accelerometer magnitude','m/s²'],['stationaryNormAgrees','Within assumed stationary tolerance','']
  ]],
  ['power','Electrical budget',[
    ['generationW','Solar generation','W'],['demandWh','Requested energy','Wh'],['endWh','Final stored energy','Wh'],['unmetWh','Unserved demand','Wh'],['curtailedWh','Unused surplus','Wh']
  ]],
  ['thermal','Radiator heat balance',[
    ['netLongwaveOutW','Net longwave emission','W'],['absorbedSunW','Absorbed sunlight','W'],['rejectedMinusLoadW','Heat rejection minus load','W']
  ]],
  ['air','Cabin atmosphere and crew',[
    ['inventoryMol','Initial gas inventory','mol'],['initialO2Mol','Initial oxygen','mol'],['initialO2KPa','Oxygen partial pressure','kPa'],['metabolicO2G','Crew oxygen use','g'],['metabolicCO2G','Crew CO₂ released','g'],['scrubbedCO2G','CO₂ removed','g'],['unremovedCO2G','CO₂ left to remove','g'],['outwardLeakMol','Outward leakage','mol'],['accessLossMol','Gas lost on access','mol'],['replacementMixtureMol','Mixture replacement','mol'],['oxygenSupplyG','Oxygen resupply','g'],['nitrogenSupplyG','Nitrogen resupply','g']
  ]],
  ['coupon','Prescribed material reaction',[
    ['prescribedG','Material prescribed','g'],['stoichiometricO2Mol','Oxygen needed','mol'],['netChemicalPotentialKJ','Net chemical energy available','kJ'],['inventoryCoversDemand','Initial O₂ inventory covers reaction','']
  ]],
  ['tracer','Tracer transport and detection',[
    ['sourceMgM3','Release-zone concentration at window end','mg/m³'],['remoteMgM3','Other-zone concentration at window end','mg/m³'],['atSamplingZoneMgM3','Sampling-zone concentration at window end','mg/m³'],['tracerAccountedMg','Total tracer accounted for','mg'],['thresholdTimeWithDelayS','Alarm time within window','s']
  ]],
  ['suppression','Suppression inventory',[
    ['deliveredKg','Agent delivered','kg'],['remainingKg','Agent remaining','kg'],['extinction','Extinction outcome','']
  ]],
  ['flow','Ventilation at the material',[
    ['ductSpeedMs','Mean duct speed','m/s'],['relativeDirection','Flow relative to ignition',''],['spreadRateMmS','Flame spread rate','mm/s']
  ]],
  ['sourcing','Material stock',[
    ['origin','Stock origin',''],['netG','Net coupon mass','g'],['feedG','Stock required','g'],['trimG','Trim mass','g'],['thicknessMm','Stock thickness','mm'],['qualification','Batch qualification',''],['evidenceStatus','Evidence status',''],['traceability','Traceability','']
  ]]
];
const noteForGroup = {
  mobility:'Equal static wheel loads assume level ground. Accelerometer readings require their own measurement context.',
  power:'Constant load and generation over the selected duration. A positive shortfall requires a separate allocation of available energy.',
  thermal:'Instantaneous heat balance at a prescribed radiator temperature. Positive margin means rejection exceeds the specified inputs.',
  air:'Ideal, well-mixed dry O₂/N₂ gas. Crew metabolism, gas loss and inventory are separate sizing calculations.',
  coupon:'A prescribed reaction gives an oxygen requirement and energy potential. Ignition, burning rate and time to spread require experimental data.',
  tracer:'An independent passive tracer pulse exchanges between two equal zones. A threshold crossing depends on placement, mixing and sampling delay.',
  suppression:'The calculation draws down the available agent. Extinguishment depends on the fire, agent delivery and verified performance.',
  flow:'Mean duct speed follows from the assumed flow and cross-section. The flow orientation is a geometric result. Flame spread requires a test matched to the material and boundary conditions.',
  sourcing:'Coupon procurement uses the assumed yield and declared lot. A stock reference does not confirm the chemistry of a particular batch.'
};
const format = new Intl.NumberFormat('en-US',{maximumFractionDigits:3});
let catalog, schema, sourceRows, sourceError, scenarios, baseline, state, result, selectedExample;
const fieldWidgets = new Map();
let workbench, missionReview, finder;

async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error('Could not load ' + path + ' (' + response.status + ')');
  return response.json();
}
function report(message='', isError=false) {
  $('status').textContent=message;
  $('status').classList.toggle('error',isError);
}
function fmt(value) {
  if (typeof value === 'number') {
    if (value !== 0 && Math.abs(value) < 0.001) return value.toExponential(2);
    return format.format(value);
  }
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
}
function currentPart(slot) {
  return catalog.parts.find(p => p.slot===slot && p.id===state.parts[slot]);
}
function showView(scroll=false) {
  const available=Object.keys(viewNames);
  const destination=finder.resolve(location.hash),view=destination.view;
  document.body.dataset.view=view;
  workbench?.visible(view==='workbench');
  if(view==='review')missionReview?.update();
  for (const v of available) $(v).hidden = v!==view;
  for (const link of $('views').children) {
    if (link.dataset.view === view) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if(location.hash!=='#workspace') finder.apply(destination,scroll);
}
function setEdited() {
  $('example').value='';
}
function renderParts() {
  const container=$('parts');container.replaceChildren();
  for (const [title,slots] of partGroups) {
    const group=el('article',undefined,'part-group'), grid=el('div',undefined,'part-grid'), header=el('header');
    header.append(el('h3',title));group.append(header,grid);
    for (const slot of slots) {
      const part=currentPart(slot), card=el('div',undefined,'part');
      const select=el('select'), label=el('label',partNames[slot]);select.id='part-'+slot;label.htmlFor=select.id;
      for (const p of catalog.parts.filter(p=>p.slot===slot)) select.add(new Option(p.title,p.id));
      select.value=part.id;
      select.addEventListener('change',()=>{
        state=selectPart(state,slot,select.value,catalog);
        if (state.customNames?.[slot]) {
          const names={...state.customNames};delete names[slot];state.customNames=names;
        }
        setEdited(); renderParts(); syncFields(); renderOutput(); $(select.id).focus({preventScroll:true});
      });
      label.append(select);card.append(label,el('p',part.origin+' · '+part.scope,'role'));
      const assumptions=Object.entries(part.assumedSettings).map(([k,v])=>{
        const field=schema.properties.conditions.properties[k];
        return field.title+' '+fmt(v)+(field.unit?' '+field.unit:'');
      });
      if (assumptions.length) card.append(el('p','Selection sets '+assumptions.join(', ')+'.','assumption'));
      if (schema.properties.customNames) {
        const alias=el('input'), aliasLabel=el('label','Custom part name','custom');
        const spec=schema.properties.customNames.properties?.[slot] ?? schema.properties.customNames.additionalProperties ?? {};
        alias.type='text';alias.maxLength=spec.maxLength||80;alias.id='alias-'+slot;aliasLabel.htmlFor=alias.id;
        alias.value=state.customNames?.[slot]||'';
        alias.addEventListener('input',()=>{
          const names={...state.customNames};
          if(alias.value)names[slot]=alias.value;else delete names[slot];
          if(Object.keys(names).length)state.customNames=names;else delete state.customNames;
          setEdited();renderOutput();
        });
        aliasLabel.append(alias);card.append(aliasLabel);
      }
      if (part.sourceIds.length) {
        const link=el('a','View source evidence','evidence-jump');link.href='#evidence/'+slot;
        card.append(link);
      }
      grid.append(card);
    }
    container.append(group);
  }
}
function buildFields() {
  const groups=new Map();
  for (const [key,spec] of Object.entries(schema.properties.conditions.properties)) {
    if (!groups.has(spec.group)) {
      const box=el('details',undefined,'box'), grid=el('div',undefined,'field-grid');box.open=!groups.size;
      box.append(el('summary',spec.group),grid);$('fields').append(box);groups.set(spec.group,grid);
    }
    const field=el('div',undefined,'field'), label=el('label',spec.title), input=el(spec.enum?'select':'input');
    input.id='field-'+key;label.htmlFor=input.id;
    if (spec.unit) label.append(el('span',' · '+spec.unit,'unit'));
    if (spec.enum) {for (const value of spec.enum) input.add(new Option(value,value));}
    else if (spec.type==='string') { input.type='text';if(spec.maxLength)input.maxLength=spec.maxLength; }
    else {input.type='number';input.min=spec.minimum;input.max=spec.maximum;input.step=spec.type==='integer'?'1':'any';input.required=true;}
    input.addEventListener(spec.enum?'change':'input',()=>{
      const value=spec.enum || spec.type==='string' ? input.value : input.valueAsNumber;
      if (key==='world'||key==='phase') {
        state=setEnvironment(state,key==='world'?value:state.conditions.world,key==='phase'?value:state.conditions.phase);
        syncFields();
      } else state.conditions={...state.conditions,[key]:value};
      setEdited();renderOutput();
    });
    label.append(input);field.append(label);groups.get(spec.group).append(field);fieldWidgets.set(key,input);
  }
}
function syncFields() {
  for (const [key,widget] of fieldWidgets) widget.value=state.conditions[key]??'';
}
function unavailable(group,key) {
  if (key==='extinction' || key==='qualification') return 'Unverified';
  if (key==='spreadRateMmS') return 'Withheld · no matched test';
  if (group==='air') return 'Ingress outside model';
  if (key==='thresholdTimeWithDelayS') return currentPart('detection').kind==='none'?'No detector':'No alarm in window';
  if (key==='specificForceNormMs2') return 'No reading';
  if (key==='stationaryNormAgrees') return 'No stationary comparison';
  if (key==='staticLoadPerWheelN') return 'No ground contact';
  return 'Unavailable';
}
function renderSummary() {
  const summary=$('summary');summary.replaceChildren();
  const items=[['Environment',state.conditions.world,state.conditions.phase],['Total vehicle mass',fmt(result.mobility.massKg),'kg'],['Final stored energy',fmt(result.power.endWh),'Wh'],['Coupon energy potential',result.coupon?fmt(result.coupon.netChemicalPotentialKJ):'Unavailable',result.coupon?'kJ':'']];
  for (const [title,value,unit] of items) {
    const box=el('div',undefined,'stat'), number=el('strong',value+' ');number.append(el('small',unit));
    box.append(el('span',title),number);summary.append(box);
  }
}
function renderMetrics() {
  const notes=$('notes'), list=el('ul');notes.replaceChildren();notes.className='notes';
  for (const n of result.notes) list.append(el('li',n));notes.append(list);
  const container=$('metrics');container.replaceChildren();container.className='data-grid';
  for (const [key,title,rows] of metricGroups) {
    if (!(key in result)) continue;
    const block=el('article',undefined,'metrics-group'),header=el('header');
    const heading=el('h3',title);heading.id='result-'+key;header.append(heading);block.append(header);
    if (!result[key]) {
      const why=currentPart('cabin').kind==='open' ? 'Unavailable on an open crew deck. This calculation requires a shared cabin atmosphere.' : 'Unavailable for an uncharacterized material. The reaction chemistry and specific energy are unknown.';
      block.append(el('p',why));container.append(block);continue;
    }
    const table=el('table'),thead=table.createTHead().insertRow(), body=table.createTBody();
    for(const heading of ['Quantity','This case','Change']) thead.append(el('th',heading));
    for (const [quantity,label,unit] of rows) {
      if (!(quantity in result[key])) continue;
      const value=result[key][quantity],reference=baseline[key]?.[quantity],row=body.insertRow();
      const display=value==null?unavailable(key,quantity):fmt(value)+(unit?' '+unit:'');
      const diff=typeof value==='number' && typeof reference==='number'?value-reference:null;
      const delta=diff===null?'—':(diff>0?'+':'')+fmt(diff)+(unit?' '+unit:'');
      row.insertCell().textContent=label;row.insertCell().textContent=display;row.insertCell().textContent=delta;
    }
    block.append(table,el('p',noteForGroup[key]));container.append(block);
  }
}
function renderEvidence() {
  const container=$('sources');container.replaceChildren();
  if (sourceError) container.append(el('p',sourceError,'error-detail'));
  for (const slot of Object.keys(state.parts)) {
    const p=currentPart(slot),box=el('article',undefined,'evidence-card'),header=el('header'),body=el('div',undefined,'body');
    box.id='evidence-'+slot;const title=el('h3',state.customNames?.[slot]||p.title);
    title.append(el('small',' · '+partNames[slot]));header.append(title);
    body.append(el('strong',p.origin,'section-label'),el('p',p.scope+' Interface compatibility is unverified.'));
    for (const id of p.sourceIds) {
      const r=sourceRows?.find(s=>s.id===id), section=el('div',undefined,'source');
      if (!r) section.append(el('p','Source entry unavailable: '+id));
      else {
        const a=el('a',r.title);a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';
        section.append(a,el('p',r.locator),el('p',(r.evidenceClass||'Source')+' · '+(r.supports||r.role||'')));
        if(r.limits)section.append(el('p','Limitations: '+r.limits));
        const detail=el('details',undefined,'reference-detail');
        detail.append(el('summary','Source record'));
        if(r.role)detail.append(el('p',(r.agency ? r.agency+' · ' : '')+r.role));
        if(r.conditions)detail.append(el('p',r.conditions));
        if(r.quantities?.length) {
          const list=el('ul');
          for(const q of r.quantities) list.append(el('li',q.quantity+' · '+q.value+' '+q.unit));
          detail.append(list);
        }
        section.append(detail);
      }
      body.append(section);
    }
    if(!p.sourceIds.length)body.append(el('p','Team assumptions supply the parameters for this concept.'));
    box.append(header,body);container.append(box);
  }
}
let refreshMaterialScreen;
function renderOutput() {
  try { result=simulate(state,catalog,schema); }
  catch (error) {
    result=null;refreshMaterialScreen?.();report('Check the scenario: '+error.message,true);$('export').disabled=true;
    $('summary').replaceChildren(el('p','Correct the highlighted input or scenario constraint to calculate results.','stat'));
    $('metrics').replaceChildren();$('notes').textContent='Results unavailable until the scenario is valid.';
    renderEvidence();workbench?.update(state,null);missionReview?.update();finder?.refreshPart();return;
  }
  refreshMaterialScreen?.();
  report();$('export').disabled=false;renderSummary();renderMetrics();renderEvidence();
  workbench?.update(state,result);if(document.body.dataset.view==='review')missionReview?.update();
  finder?.refreshPart();
}
function loadScenario(s,exampleKey) {
  simulate(s,catalog,schema);
  state=structuredClone(s);$('name').value=state.name;
  if(exampleKey)selectedExample=exampleKey;
  $('example').value=exampleKey||'';renderParts();syncFields();renderOutput();
}
async function init() {
  let sourceIndex;
  [catalog,schema,sourceIndex,...scenarios]=await Promise.all([
    json('../parts.json'),json('../scenario.schema.json'),
    json('../sources.json').catch(error=>{sourceError=error.message+'. Reload when the source index is available.';return null;}),
    ...exampleFiles.map(([id])=>json('../examples/'+id+'.json'))
  ]);
  sourceRows=sourceIndex?.sources;baseline=simulate(scenarios[0],catalog,schema);
  const custom=new Option('Custom design','');custom.disabled=true;$('example').add(custom);
  for (const [id,title] of exampleFiles) $('example').add(new Option(title,id));
  $('example').addEventListener('change',()=>{
    const index=exampleFiles.findIndex(([id])=>id===$('example').value);
    if(index>=0)loadScenario(scenarios[index],exampleFiles[index][0]);
  });
  $('reset').addEventListener('click',()=>loadScenario(scenarios[exampleFiles.findIndex(([id])=>id===selectedExample)],selectedExample));
  $('name').addEventListener('input',()=>{state.name=$('name').value;setEdited();renderOutput();});
  $('import').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async()=>{
    const f=$('file').files[0];if(!f)return;
    try {loadScenario(JSON.parse(await f.text()),null);report('Imported '+f.name+'.');}
    catch(error){report('Import failed: '+error.message,true);}
    $('file').value='';
  });
  $('export').addEventListener('click',()=>{
    if(!result)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)+'\n'],{type:'application/json'}));
    const a=el('a');a.href=url;a.download=(state.name.replace(/[^\p{L}\p{N}]+/gu,'-').slice(0,65)||'rover-scenario')+'.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  });
  const [routeReference,lunarMap]=await Promise.all([json('../terrain/jezero-route.json'),json('../terrain/lola.json')]);
  workbench=mountWorkbench({catalog,sources:sourceRows,jezero:routeReference,lola:lunarMap,
    changeCondition:(key,value)=>{state={...state,conditions:{...state.conditions,[key]:value}};setEdited();syncFields();renderOutput();},
    changeEnvironment:(world,phase)=>{state=setEnvironment(state,world,phase);setEdited();syncFields();renderOutput();},
    changePart:(slot,id)=>{
      state=selectPart(state,slot,id,catalog);
      if(state.customNames?.[slot]){const names={...state.customNames};delete names[slot];state.customNames=names;}
      setEdited();renderParts();syncFields();renderOutput();
    },
    checkScenario:s=>simulate(s,catalog,schema),
    loadScenario:s=>loadScenario(s,null)
  });
  buildFields();loadScenario(scenarios[0],exampleFiles[0][0]);
  if (location.pathname.split('/').at(-3)==='rover-workbench') {
    $('main-site').closest('nav').hidden=false;
    const key='first-fire.rover-workbench.scenario.v1';
    try {
      const pending=sessionStorage.getItem(key);
      if (pending) {
        sessionStorage.removeItem(key);
        loadScenario(JSON.parse(pending),null);
        report('Opened the design from the research desk.');
      }
    } catch (error) {
      report('The saved design could not be opened. The lunar example is loaded.',true);
    }
  }
  mountFieldComparison($('field-panel'),{getTraverse:()=>workbench.snapshot()});
  missionReview=mountMissionReview($('review-panel'),{catalog,sourceIndex:sourceIndex||{sources:[],partners:{}},getScenario:()=>state,getResult:()=>result,getTraverse:()=>workbench.snapshot()});
  finder=mountFinder(buildDestinations({catalog,schema,partNames,metricGroups,driveFields}),{
    getSelectedPart:slot=>state.parts[slot],
    onInstall:(slot,id)=>{
      const select=$('part-'+slot);select.value=id;select.dispatchEvent(new Event('change'));
    }
  });
  const screen=el('section','Loading cabin material screening…','control-note');
  $('tool-fire').append(screen);
  import('../../material-screening.mjs').then(({mountMaterialScreen,roverEnvironment})=>{
    refreshMaterialScreen=mountMaterialScreen(screen,{
      from:'rover',fixedFan:true,params:new URLSearchParams(location.search),
      read:()=>roverEnvironment(state,result),snapshot:()=>state
    });
  }).catch(()=>{screen.textContent='The material screening model could not load.';});
  $('lab').hidden=false;showView();window.addEventListener('hashchange',()=>showView(true));
}
init().catch(error=>report('Unable to open the lab. '+error.message+'. Serve the rover-design folder over local HTTP to load the JSON files.',true));
