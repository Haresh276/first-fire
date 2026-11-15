import './flint-coefficients.js';
import './flint-solid.js';
import './material-observer-model.js';

const model = globalThis.MaterialObserver;
const psiToKpa = 6.894757;
const decimal = value => Number(value.toFixed(2)).toString();
const worldName = place => place[0].toUpperCase() + place.slice(1);
const storageKey = from => 'first-fire.material-screen.return.' + from;

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function readSelection(params) {
  if (!params.has('mix') && !params.has('material')) return null;
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length || (params.has('mix') && params.has('material'))) {
    throw new RangeError('Use one value per setting and specify either a material or a mix.');
  }
  if (!params.has('mix')) return {[params.get('material')]: 100};
  const result = Object.create(null);
  for (const entry of params.get('mix').split(',')) {
    const pair = entry.split(':');
    if (pair.length !== 2 || !pair[1].trim() || Object.hasOwn(result, pair[0])) {
      throw new RangeError('The composition link contains an invalid or repeated component.');
    }
    result[pair[0]] = Number(pair[1]);
  }
  return result;
}

function receive(params) {
  const composition = readSelection(params);
  if (!composition) return null;
  // A recipe may arrive without a cabin. Its component names and percentages still need validation.
  const read = (key, fallback) => {
    if (!params.has(key)) return fallback;
    const raw = params.get(key).trim();
    return raw ? Number(raw) : NaN;
  };
  const environment = {place:params.get('place') ?? 'moon', pressurePsia:read('pressure',8.2),
    oxygenPct:read('oxygen',34), fanCmS:read('fan',0)};
  model.evaluate({...environment, composition});
  const name = (params.get('name') || '').trim().slice(0,120);
  const construction = (params.get('construction') || '').trim().slice(0,240);
  return {composition, name, construction, environment:params.has('place') ? environment : null};
}

function storedDesign(from) {
  try {
    const key = storageKey(from);
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function physicsReturn(form, trial, saved, physics) {
  if (saved?.inputs && !physics.validate(saved.inputs)) {
    for (const [name, value] of Object.entries(saved.inputs)) form.elements.namedItem(name).value = value;
    for (const [name,value] of Object.entries(saved.parts || {})) {
      const control = form.elements.namedItem(name);
      if (control && typeof value === 'string') control.value = value;
    }
  }
  if (!trial) return '';
  const world = worldName(trial.place);
  const settings = {planet:world, oxygen:trial.oxygenPct, pressure:Number((trial.pressurePsia * psiToKpa).toFixed(7))};
  const fits = (key, value) => value >= physics.ranges[key][0] && value <= physics.ranges[key][1];
  if (!(world in physics.gravity) || !fits('oxygen',settings.oxygen) || !fits('pressure',settings.pressure)) {
    return 'Recipe imported. The linked atmosphere is outside this cabin simulator. The screen below uses the conditions shown in this lab.';
  }
  for (const [key,value] of Object.entries(settings)) form.elements.namedItem(key).value = value;
  return 'Observer recipe and cabin conditions imported.';
}

export function roverReturn(scenario, trial, saved, data, rover) {
  let target = scenario;
  if (saved) {
    try { rover.simulate(saved,data.catalog,data.schema); target = saved; } catch { /* use the existing design */ }
  }
  if (!trial) return {scenario:target,message:''};
  const conditions = target.conditions;
  const world = worldName(trial.place);
  try {
    const next = world === conditions.world ? structuredClone(target) : rover.setEnvironment(structuredClone(target),world,conditions.phase);
    next.conditions.pressureKPa = trial.pressurePsia * psiToKpa;
    next.conditions.oxygenPct = trial.oxygenPct;
    // Convert local duct velocity to the rover model's volume exchange in L/s.
    next.conditions.exchangeLs = trial.fanCmS * 10 * next.conditions.sectionM2;
    const result = rover.simulate(next,data.catalog,data.schema);
    return {scenario:next,message:result.air ? 'Observer recipe and cabin conditions imported.' : 'Recipe imported. This design has an open deck.'};
  } catch {
    return {scenario:target,message:'Recipe imported. The linked conditions are outside the rover model. The screen uses the current design.'};
  }
}

export function roverEnvironment(scenario, result) {
  if (!result) return {unavailable:'Complete the rover conditions to compare cabin materials.'};
  if (!result.air) return {unavailable:'Choose a sealed cabin to screen interior materials in its atmosphere.'};
  const c = scenario.conditions;
  return {place:c.world.toLowerCase(),oxygenPct:c.oxygenPct,pressurePsia:Number((c.pressureKPa / psiToKpa).toFixed(6)),
    fanCmS:result.flow.ductSpeedMs * 100, opposed:result.flow.relativeDirection === 'opposed'};
}

export function mountMaterialScreen(panel,{from, read, snapshot, apply, params, fixedFan = false}) {
  panel.replaceChildren();
  const heading = element('h2','Cabin material screening');
  const intro = element('p',from === 'rover' ? 'Compare a thin cabin lining at the current duct speed and with the fan off. The rover’s coupon and tracer calculations use their own material and flow inputs.' :
    'Compare a thin lining in the starting cabin atmosphere. The burning strip above supplies a separate oxygen history at its prescribed speed.');
  const choice = element('select');
  const picker = element('label','Screening material ');
  picker.append(choice);
  panel.append(heading,intro,picker);
  let composition = {NOMEX:100};
  let importedSpecimen;
  let fan = 0;
  const notice = element('p');
  notice.setAttribute('role','status');
  try {
    const incoming = receive(params);
    if (incoming) {
      importedSpecimen = incoming;
      composition = incoming.composition;
      fan = incoming.environment?.fanCmS || 0;
      notice.textContent = apply?.(incoming.environment,storedDesign(from)) || '';
    }
  } catch (err) {
    composition = null;
    notice.textContent = 'Could not import the material selection. ' + err.message;
  }
  for (const m of model.materials) choice.add(new Option(m.label,m.key));
  if (!composition) {
    const empty = new Option('Choose a material to start a new screen','',false,true);
    empty.disabled = true;
    choice.add(empty);
  } else if (Object.keys(composition).length === 1) choice.value = Object.keys(composition)[0];
  else { choice.add(new Option('Imported composition','RECIPE')); choice.value='RECIPE'; }
  const forced = element('input');
  if (!fixedFan) {
    forced.type='number'; forced.min='0'; forced.max='145.3'; forced.step='any'; forced.value=fan;
    const label=element('label','Screening fan speed (cm/s) '); label.append(forced); panel.append(label);
  }
  const result = element('div');
  const link = element('a','Edit this composition in the Material Observer');
  link.className='inlinebtn';
  link.addEventListener('click',() => {try {sessionStorage.setItem(storageKey(from),JSON.stringify(snapshot()));} catch { /* the URL still carries the material and atmosphere */ }});
  panel.append(notice,result,link);
  function update() {
    const env=read();
    result.replaceChildren();
    link.removeAttribute('href');
    link.textContent='Edit this composition in the Material Observer';
    if (!composition) return;
    if (!env || env.unavailable) {result.append(element('p',env?.unavailable || 'Complete the cabin conditions to screen a material.')); return;}
    const inputs={place:env.place,pressurePsia:env.pressurePsia,oxygenPct:env.oxygenPct,fanCmS:fixedFan ? env.fanCmS : forced.valueAsNumber,composition};
    const comparisonFan = inputs.fanCmS === 0 ? 20 : 0;
    let active,comparison;
    try {
      active=model.evaluate(inputs);comparison=model.evaluate({...inputs,fanCmS:comparisonFan});
    } catch(err) {result.append(element('p','This case is outside the material screen. '+err.message));return;}
    const url=new URL('./material-observer.html',import.meta.url);
    const query=new URLSearchParams({place:inputs.place,pressure:String(inputs.pressurePsia),oxygen:String(inputs.oxygenPct),fan:String(inputs.fanCmS),from});
    const entries=Object.entries(composition).filter(([,pct])=>pct>0);
    if (importedSpecimen?.composition === composition) {
      if (importedSpecimen.name) query.set('name',importedSpecimen.name);
      if (importedSpecimen.construction) query.set('construction',importedSpecimen.construction);
    }
    if(entries.length===1)query.set('material',entries[0][0]);
    else query.set('mix',entries.map(([key,pct])=>key+':'+pct).join(','));
    if(env.opposed){
      query.set('fan','0');
      link.textContent='Edit the fan-off comparison in the Material Observer';
    }
    url.search=query; link.href=url.href;
    const label=key=>model.materials.find(m=>m.key===key)?.label || key;
    const scope=element('p',worldName(env.place)+' · '+decimal(inputs.pressurePsia)+' psia · '+decimal(inputs.oxygenPct)+'% starting oxygen · '+decimal(inputs.fanCmS)+' cm/s forced flow.');
    result.append(scope);
    if (env.opposed) result.append(element('p','The rover’s fan opposes the flame direction. FLINT is calibrated for assisting flow. Only the fan-off comparison is shown for this design.'));
    if (entries.length>1) result.append(element('p','Each row screens a component on its own. The blend needs its own flame-spread measurement.'));
    const rows=element('tbody'),table=element('table');
    table.append(element('caption','Oxygen needed for flame spread (% by volume)'));
    const header=element('tr');
    for(const title of ['Material','Mass share','Current flow',comparisonFan ? 'Fan at 20 cm/s' : 'Fan off']){const th=element('th',title);th.scope='col';header.append(th);}
    const thead=element('thead');thead.append(header);table.append(thead,rows);
    const scored=[];
    for(const [key,pct] of entries){
      const a=active.parts.find(part=>part.key===key), b=comparison.parts.find(part=>part.key===key);
      const current=env.opposed ? null : a?.limitPct;
      const row=element('tr');const name=element('th',label(key));name.scope='row';row.append(name,element('td',decimal(pct)+'%'),element('td',Number.isFinite(current)?decimal(current)+'%':'Unavailable'),element('td',Number.isFinite(b?.limitPct)?decimal(b.limitPct)+'%':'Unavailable'));rows.append(row);
      if(Number.isFinite(current))scored.push({key,limit:current});
    }
    result.append(table);
    if (!env.opposed && active.status==='unmodelled') result.append(element('p',active.note));
    if (!env.opposed && scored.length && active.parts.every(part=>!part.matchingObservation)) {
      result.append(element('p','No matching calibration measurement at these settings. The component limits are extrapolations.'));
    }
    scored.sort((a,b)=>a.limit-b.limit);
    if(scored.length){
      const first=scored[0],margin=inputs.oxygenPct-first.limit;
      const lunarCheck=inputs.place==='moon' && Math.abs(inputs.pressurePsia-8.2)<0.001 && inputs.fanCmS===0;
      const decision=lunarCheck && Math.abs(margin)<=1.7?'The starting oxygen is within 1.7 percentage points of this threshold. Repeat the test on both sides of the estimate.':
        (margin>0?'The starting oxygen is '+decimal(margin)+' points above this threshold.':'The starting oxygen is '+decimal(-margin)+' points below this threshold.');
      result.append(element('p',(scored.length>1?'Of the components with estimates, '+label(first.key)+' can sustain spread at the lowest oxygen. ':label(first.key)+': ')+decision));
      if(env.trace && entries.length===1){
        const crossed=env.trace.find(row=>row.oxygen <= first.limit);
        result.append(element('p',crossed?.time===0 ? 'The strip simulation starts at or below this reference level.' : crossed ? 'The separate cabin-strip simulation reaches this oxygen level by '+crossed.time+' s.' : 'The separate cabin-strip simulation stays above this oxygen level through '+env.trace.at(-1).time+' s.'));
      }
    }
    if(entries.length>1 || !scored.length) result.append(element('p','Test a specimen of the actual assembly at its intended thickness, oxygen, pressure and airflow. A constituent threshold cannot establish the assembly’s fire limit.'));
    else result.append(element('p','Test a specimen at the intended thickness and cabin conditions. The threshold is a model estimate for a thin solid in dry oxygen and nitrogen.'));
  }
  choice.onchange=()=>{
    composition=choice.value==='RECIPE'?importedSpecimen.composition:{[choice.value]:100};
    notice.textContent='';
    update();
  };
  forced.oninput=update;
  update();
  return update;
}
