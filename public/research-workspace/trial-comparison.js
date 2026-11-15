/* Compare two captured, single-compartment Physics Lab runs. */
(() => {
  'use strict';

  const schema = 'first-fire.cabin-comparison.v1';
  const conditions = {
    planet: ['Surface', ''], fuel: ['Strip material', ''],
    pressure: ['Initial absolute pressure', 'kPa'], oxygen: ['Initial oxygen', 'vol%'],
    volume: ['Free cabin volume', 'm³'], cutoff: ['Assumed oxygen cutoff', 'vol%'],
    length: ['Strip length', 'cm'], density: ['Linear fuel loading', 'g/cm'],
    speed: ['Imposed front speed', 'cm/s'], chassisMass: ['Chassis mass', 'kg'],
    capacity: ['Battery capacity', 'Wh'], power: ['Applied electrical load', 'W']
  };
  const endpoints = {
    position: ['Front travel', 'cm'], oxygen: ['Wet oxygen', 'wet vol%', 'percentage points'],
    co2: ['Wet carbon dioxide', 'wet vol%', 'percentage points'],
    water: ['Water vapor', 'wet vol%', 'percentage points'], burned: ['Fuel consumed', 'g'],
    chemical: ['Combustion heat', 'kJ'], electrical: ['Electrical heat', 'kJ'],
    energy: ['Total heat', 'kJ'], chassisWeightN: ['Chassis weight', 'N'],
    idealFlameK: ['Ideal flame-zone temperature', 'K']
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function usable(entry) {
    const r = entry?.record;
    return r?.kind === 'simulated' && object(r.inputs) && object(r.outputs) &&
      finite(r.seconds) && r.seconds >= 0 && finite(r.outputs.position);
  }
  function snapshot(entry, now = new Date().toISOString()) {
    if (!usable(entry)) throw new TypeError('Open a valid Physics Lab result first.');
    return {tool:'physics', capturedAt:now, entry:copy(entry)};
  }
  function validSnapshot(s) {
    return s?.tool === 'physics' && typeof s.capturedAt === 'string' && usable(s.entry);
  }
  function restore(raw) {
    if (raw?.schema !== schema || !validSnapshot(raw.baseline)) return null;
    return {schema, baseline:copy(raw.baseline), trial:validSnapshot(raw.trial) ? copy(raw.trial) : null};
  }
  function freeze(entry) {
    return {schema, baseline:snapshot(entry), trial:null};
  }
  function capture(comparison, entry) {
    if (!validSnapshot(comparison?.baseline)) throw new TypeError('Freeze a baseline first.');
    return {schema, baseline:comparison.baseline, trial:snapshot(entry)};
  }

  function compare(baseline, trial) {
    const before = baseline.entry.record, after = trial.entry.record;
    const changes = [], unsupported = new Set();
    for (const [key, [label, unit]] of Object.entries(conditions)) {
      const a = before.inputs[key], b = after.inputs[key];
      const text = key === 'planet' || key === 'fuel';
      if (text ? !(typeof a === 'string' && a && typeof b === 'string' && b) : !finite(a) || !finite(b)) {
        unsupported.add(label);
        continue;
      }
      if (a !== b) changes.push({field:key, label, unit, baseline:a, trial:b});
    }
    for (const key of [...Object.keys(before.inputs), ...Object.keys(after.inputs)]) {
      if (!Object.hasOwn(conditions,key)) unsupported.add(key);
    }
    for (const field of ['schema','solverVersion','modelVersion']) {
      if (before[field] !== after[field]) unsupported.add(field);
    }
    const timeChanged = before.seconds !== after.seconds;
    const measurements = Object.entries(endpoints).map(([field,[label,unit,deltaUnit = unit]]) => {
      const a = before.outputs[field], b = after.outputs[field];
      const nativeA = before.units?.[field] || unit, nativeB = after.units?.[field] || unit;
      const unitsMatch = nativeA === unit && nativeB === unit;
      if (!unitsMatch) unsupported.add(label+' units');
      return {field, label, unit, deltaUnit, baseline:finite(a) ? a : null, trial:finite(b) ? b : null,
        baselineUnit:nativeA, trialUnit:nativeB, delta:unitsMatch && finite(a) && finite(b) ? b-a : null};
    });
    const type = unsupported.size ? 'unsupported' : timeChanged ? 'different-times' :
      changes.length === 0 ? 'same-inputs' : changes.length === 1 ? 'single-input' : 'multiple-inputs';
    const boundaries = {
      unsupported:'Some fields or units cannot be matched across these receipts. Inspect the original values before interpreting the differences.',
      'different-times':'These samples occur at different elapsed times. Match the clock on both trials to isolate a changed model input.',
      'same-inputs':'The model inputs and elapsed time match. Design names, evidence attribution and network availability can differ independently.',
      'single-input':'One recorded solver input changed at a common elapsed time. The differences show the response of this cabin model to that input.',
      'multiple-inputs':'Several solver inputs changed together. Repeat the comparison with a single input changed to isolate its modeled effect.'
    };
    return {type, changes, timeChanged, baselineSeconds:before.seconds, trialSeconds:after.seconds,
      unsupportedFields:[...unsupported], measurements, interpretation:boundaries[type],
      domain:'The front speed is imposed. These scenario differences do not validate flame behavior in a flight vehicle.'};
  }
  function exportComparison(comparison) {
    const saved = restore(comparison);
    if (!saved) return null;
    const analysis = saved.trial ? compare(saved.baseline,saved.trial) : null;
    return {...saved, analysis};
  }
  const core = {freeze, capture, compare, restore, exportComparison};
  if (typeof module !== 'undefined' && module.exports) module.exports=core;
  if (typeof window === 'undefined') return;

  const make = (tag,text) => {const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;};
  function action(label, handler, cls='ghost') {
    const b=make('button',label);b.type='button';b.className=cls;b.onclick=handler;return b;
  }
  function value(n,unit) {
    if (n === null || n === undefined) return 'Unavailable';
    const label=typeof n === 'number' ? n.toLocaleString('en-US',{maximumSignificantDigits:5}) : String(n);
    return unit ? label+' '+unit : label;
  }
  function resultTable(rows) {
    const box=make('div');box.className='trial-table-wrap';
    const table=make('table'),caption=make('caption','Calculated differences at the selected times');
    table.append(caption);
    const head=table.createTHead().insertRow();
    for(const name of ['Output','Baseline','Trial','Trial − baseline']) {
      const h=make('th',name);h.scope='col';head.append(h);
    }
    const body=table.createTBody();
    for(const item of rows) {
      const row=body.insertRow(),label=make('th',item.label);label.scope='row';row.append(label);
      const delta=item.delta!==null && item.delta>0 ? '+'+value(item.delta,item.deltaUnit) : value(item.delta,item.deltaUnit);
      row.append(make('td',value(item.baseline,item.baselineUnit)),make('td',value(item.trial,item.trialUnit)),make('td',delta));
    }
    box.append(table);return box;
  }
  function describe(snapshot) {
    const r=snapshot.entry.record;
    return [r.designName || 'Cabin trial',r.inputs.planet,r.inputs.fuel,value(r.inputs.volume,'m³'),value(r.seconds,'s')].join(' · ');
  }
  function download(pair) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(pair,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='first-fire-cabin-comparison.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function panel({current, comparison, onChange, onReopen}) {
    let frozen=restore(comparison);
    const root=make('section');root.className='panel aw-panel trial-comparison';
    const title=make('h2','Compare two cabin trials');
    const status=make('p');status.setAttribute('role','status');status.className='small';
    const body=make('div');body.className='trial-body';
    root.append(title,body,status);
    function update(next,message,focusText) {
      frozen=next;onChange(next);draw();
      status.textContent=message;
      if(focusText) Array.from(body.querySelectorAll('button')).find(b=>b.textContent===focusText)?.focus();
    }
    function showSnapshot(host,snap,label) {
      const line=make('div');line.className='trial-snapshot';
      line.append(make('strong',label),make('span',describe(snap)));
      line.append(action('Reopen '+label.toLowerCase(),()=>onReopen(copy(snap.entry))));
      host.append(line);
      const r=snap.entry.record;
      const note=make('p');note.className='small';
      const receipt=Array.isArray(r.sources) && r.sources.find(s=>s?.row);
      if(r.reference && receipt){
        note.append('Speed imposed from '+receipt.row+' · '+r.reference+' flow');
        if(/^https?:\/\//i.test(receipt.url)){
          const source=make('a','Source table');source.href=receipt.url;source.target='_blank';source.rel='noopener noreferrer';
          note.append(' · ',source);
        }
      }else note.append('Speed entered in the model');
      if(r.outputs.state) note.append(' · '+r.outputs.state);
      host.append(note);
    }
    function draw() {
      body.replaceChildren();
      if(!frozen) {
        body.append(make('p','Freeze one completed cabin result, change a condition in Physics Lab, then capture the second trial.'));
        const save=action('Freeze current trial as baseline',()=>update(freeze(current),'Baseline frozen.','Reopen baseline'),'btn');
        save.disabled=!usable(current);body.append(save);
        if(!usable(current)){
          const go=make('a','Open Physics Lab →');go.href='#physics?mode=rover';go.className='inlinebtn';body.append(go);
        }
        return;
      }
      showSnapshot(body,frozen.baseline,'Baseline');
      const nextLabel=frozen.trial ? 'Replace trial with current result' : 'Capture current result for comparison';
      const save=action(nextLabel,()=>update(capture(frozen,current),'Comparison saved.','Reopen trial'),'btn');
      save.disabled=!usable(current);
      const go=make('a','Change a condition in Physics Lab →');go.href='#physics?mode=rover';go.className='inlinebtn';
      const actions=make('div');actions.className='actions';actions.append(go,save);body.append(actions);
      if(frozen.trial) {
        showSnapshot(body,frozen.trial,'Trial');
        const result=compare(frozen.baseline,frozen.trial);
        body.append(make('p',result.interpretation));
        const changes=make('ul');
        for(const field of result.changes) changes.append(make('li',field.label+' · '+value(field.baseline,field.unit)+' → '+value(field.trial,field.unit)));
        if(result.timeChanged) changes.append(make('li','Elapsed time · '+value(result.baselineSeconds,'s')+' → '+value(result.trialSeconds,'s')));
        if(result.unsupportedFields.length) changes.append(make('li','Unmatched fields · '+result.unsupportedFields.join(', ')));
        if(changes.childElementCount) body.append(changes);
        body.append(resultTable(result.measurements),make('p',result.domain));
        body.append(action('Download paired trials JSON',()=>download(exportComparison(frozen))));
      }
      body.append(action('Clear comparison',()=>update(null,'Comparison cleared.','Freeze current trial as baseline')));
    }
    draw();return root;
  }
  window.FFTrialComparison={...core,panel};
})();
