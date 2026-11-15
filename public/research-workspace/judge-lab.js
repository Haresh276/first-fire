/* Standalone evidence-to-rover experiment. The two engines own all scientific calculations. */
(() => {
  'use strict';

  const engine = window.FFJudgeExperiment;
  const awareness = window.FFJudgeAwareness;
  const get = id => document.getElementById(id);
  if (!engine || !awareness) {
    get('startup').textContent = 'The experiment could not load. Reload this page or open the NASA archive from the menu.';
    return;
  }
  const question = 'How far does the flame travel in a rover cabin when airflow reverses?';
  const schema = 'first-fire.coupled-trial.v1';
  const storageKey = 'first-fire.coupled-lab.v1';
  const fields = {flow:'airflow direction',time:'model time',cabin:'enclosure',oxygen:'initial oxygen',volume:'cabin volume',world:'surface gravity',material:'test material',speedMmS:'imposed speed',couponMassG:'coupon mass'};
  const metrics = {
    positionCm: {label:'Flame-front travel',unit:'cm',digits:2},
    chemicalKJ: {label:'Heat from material consumed',unit:'kJ',digits:3},
    couponKJ: {label:'Energy in the full coupon',unit:'kJ',digits:2},
    oxygenPct: {label:'Cabin oxygen at readout',unit:'%',changeUnit:'pp',digits:4},
    initialO2KPa: {label:'Initial oxygen partial pressure',unit:'kPa',digits:3},
    supportN: {label:'Static rover support load',unit:'N',digits:2}
  };
  const primaryFor = {world:'supportN',material:'chemicalKJ',oxygen:'initialO2KPa',volume:'oxygenPct',couponMassG:'couponKJ'};
  const physicalIds = Object.keys(engine.defaults).filter(id => id !== 'speedMmS' && id !== 'flow');
  const numericIds = new Set(['oxygen','time','volume','couponMassG']);
  const formFields = ['level','display','question'];
  let state, comparison, policy, dirtyField, restored = false, neuralLoaded, neuralRequested = false;
  let lastPresentation, lastClockAnnouncement, requestVersion = 0;
  const clean = () => ({baseline:{...engine.defaults},current:{...engine.defaults},level:'beginner',display:'auto',question,intentOverride:'auto',edits:[],baselineFrozen:false});
  const make = (tag,text) => { const element=document.createElement(tag); if(text!=null) element.textContent=text; return element; };
  const number = (value,digits) => value.toLocaleString('en-US',{maximumFractionDigits:digits});
  function valueLabel(n, definition, delta=false) {
    if (n === null) return 'Withheld';
    const sign = delta && n !== 0 ? (n>0?'＋':'−') : '';
    const unit = delta && definition.changeUnit || definition.unit;
    return sign + number(Math.abs(n),definition.digits) + (unit==='%'?'':' ') + unit;
  }
  function checkState(input) {
    if (!input || typeof input!=='object' || !input.current || !input.baseline) throw Error('Incomplete trial settings.');
    engine.run(input.current);
    engine.run(input.baseline);
    const next = clean();
    next.current={...engine.defaults,...input.current}; next.baseline={...engine.defaults,...input.baseline};
    if (typeof input.question==='string') next.question=input.question.slice(0,340);
    if (['beginner','undergraduate','advanced'].includes(input.level)) next.level=input.level;
    if (['auto','lite','standard','pro'].includes(input.display)) next.display=input.display;
    if (Array.from(get('intent-override').options).some(option=>option.value===input.intentOverride)) next.intentOverride=input.intentOverride;
    next.baselineFrozen=input.baselineFrozen===true;
    if (Array.isArray(input.edits)) next.edits=input.edits.slice(-40).filter(row => row &&
      typeof row.at==='string' && row.at.length<=32 && typeof row.field==='string' && Object.hasOwn(fields,row.field) &&
      [row.from,row.to].every(v=>v===null||Number.isFinite(v)||(typeof v==='string'&&v.length<=60)));
    return next;
  }
  function save() {
    try { sessionStorage.setItem(storageKey,JSON.stringify({schema,state})); } catch { /* Downloads remain available. */ }
  }
  try {
    const saved=JSON.parse(sessionStorage.getItem(storageKey));
    if (saved?.schema===schema) { state=checkState(saved.state); restored=true; }
  } catch { /* A new trial remains usable after an incompatible session or disabled storage. */ }
  state ||= clean();
  Object.assign(state,window.FFJudgeReader?.preferences?.()||{});
  function setControls() {
    for (const id of physicalIds) { if(get(id)) get(id).value=state.current[id]; }
    document.querySelectorAll('input[name="flow"]').forEach(radio => {
      radio.checked=state.current.flow===radio.value;
      radio.disabled=state.current.speedMmS!==null;
    });
    get('speed-mode').value=state.current.speedMmS===null?'published':'custom';
    get('custom-speed-field').hidden=state.current.speedMmS===null;
    get('custom-speed').value=state.current.speedMmS??(state.current.flow==='concurrent'?1.8:1.3);
    for(const id of formFields) get(id).value=state[id];
    get('clock').textContent=state.current.time+' s';
    get('intent-override').value=state.intentOverride;
  }

  function restoreInputs() {
    get('input-message').hidden=true;
    get('freeze').disabled=false; get('download').disabled=false;
  }
  function change(field,value) {
    const proposed={...state.current,[field]:value};
    let next;
    try { next=engine.compare(state.baseline,proposed); } catch(error) {
      get('input-message').textContent=error.message+' Results still show the last valid settings.';
      get('input-message').hidden=false;
      get('freeze').disabled=true; get('download').disabled=true;
      get('live-summary').textContent=get('input-message').textContent;
      return;
    }
    const before=state.current[field];
    if(before!==value) {
      state.edits.push({at:new Date().toISOString(),field,from:before,to:value});
      state.edits=state.edits.slice(-40);
    }
    state.current=proposed; dirtyField=field; restored=false;
    comparison=next;
    // An invalid, uncommitted numeric field is reset to its preceding valid setting.
    setControls(); restoreInputs(); render(); save();
  }
  function getPolicy() {
    const current=comparison.current;
    return awareness.evaluate({
      level:state.level,display:state.display,navigator:window.navigator,signals:window.FFReaderDevice?.signals?.()||{},
      reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true,question:state.question,intentOverride:state.intentOverride,
      reference:state.current.speedMmS===null?state.current.flow:'custom',
      speedMmS:current.rateBasis?.speedMmS??state.current.speedMmS,elapsedSeconds:state.current.time,
      changedFields:comparison.changed.map(key=>fields[key]),hasBaseline:true,comparisonCount:state.edits.length,
      valid:true,limit:current.status==='modeled'?'':current.explanation,outcome:current.state,restored
    });
  }
  function showReceipts() {
    const list=get('receipt-list'), receipts=new Map();
    for (const [trial, result] of [['baseline',comparison.baseline],['current',comparison.current]]) {
      for (const row of result.sources) {
        const key = row.id+'|'+row.locator;
        if (!receipts.has(key)) receipts.set(key,{row, trials:[]});
        receipts.get(key).trials.push(trial);
      }
    }
    list.replaceChildren();
    for (const {row,trials} of receipts.values()) {
      const item=make('li'), a=make('a',row.title), info=make('small',trials.join(' and ')+' · '+row.id+' · '+row.locator);
      a.href=row.url; a.target='_blank'; a.rel='noopener noreferrer'; item.append(a,info);
      if(row.localUrl) {
        const csv=make('a','Open original CSV'), local=make('small');
        csv.href=row.localUrl; local.append(csv); item.append(local);
      }
      list.append(item);
    }
    get('claim').textContent=policy.evidence.claim;
    get('boundary').textContent=comparison.current.boundary;
    get('measurement').textContent=policy.evidence.nextMeasurement;
  }

  function drawChart() {
    if(!policy.device.showPlot) return;
    const canvas=get('trace'), rect=canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(rect.width*ratio); canvas.height=Math.round(rect.height*ratio);
    const c=canvas.getContext('2d'); if(!c) return;
    c.scale(ratio,ratio);
    const traces=[comparison.baseline.trace,comparison.current.trace];
    const xMax=Math.max(1,state.current.time,state.baseline.time);
    const yMax=Math.max(1,...traces.flat().map(s=>s.position));
    const x0=48,y0=17,right=rect.width-21,bottom=rect.height-23;
    const x=t=>x0+(right-x0)*t/xMax, y=n=>bottom-(bottom-y0)*n/yMax;
    c.lineWidth=1; c.font='11px system-ui'; c.fillStyle='#435950';
    for(const factor of [0,.5,1]) {
      const n=yMax*factor;
      c.strokeStyle='#c9d4c9'; c.beginPath(); c.moveTo(x0,y(n)); c.lineTo(right,y(n)); c.stroke();
      c.textAlign='right'; c.fillText(number(n,2)+' cm',x0-6,y(n)+3);
    }
    c.textAlign='center'; c.fillText('0 s',x0,bottom+16); c.fillText(xMax+' s',right,bottom+16);
    function line(points,color,dash,width) {
      if(!points.length)return;
      c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();
      points.forEach((sample,i)=>i?c.lineTo(x(sample.time),y(sample.position)):c.moveTo(x(sample.time),y(sample.position)));
      c.stroke();c.setLineDash([]);
      const end=points[points.length-1];
      c.beginPath();c.arc(x(end.time),y(end.position),width+1,0,Math.PI*2);
      c.fillStyle=color;c.fill();
    }
    line(traces[1],'#ad421e',[],3.5);
    line(traces[0],'#345957',[5,5],1.8);
    const identical=state.current.time===state.baseline.time && comparison.current.metrics.positionCm!==null &&
      traces[0].length===traces[1].length && traces[0].every((p,i)=>p.position===traces[1][i].position);
    get('trace-message').textContent=identical?'Both flame paths overlap.':
      traces.some(rows=>!rows.length)?'Only trials with a supported cabin and material have a flame path.':'';
  }

  function renderNumbers() {
    const rows=[];
    for(const [key,metric] of Object.entries(metrics)) {
      const row=make('tr'), th=make('th',metric.label); th.scope='row';
      row.append(th,make('td',valueLabel(comparison.baseline.metrics[key],metric)),make('td',valueLabel(comparison.current.metrics[key],metric)),
        make('td',valueLabel(comparison.deltas[key],metric,true)));
      rows.push(row);
    }
    get('metric-body').replaceChildren(...rows);
  }
  function presentPolicy() {
    get('interpretation').textContent=policy.reader.guidance;
    get('intent-result').textContent=policy.intent.label+'. '+policy.intent.reason;
    const route=get('intent-action');
    route.textContent=policy.intent.action+' →';
    route.href=policy.intent.id==='trial'?'#conditions':policy.intent.href;
    get('next-step').textContent=policy.state.nextAction+' '+policy.state.reason;
    const pick=dirtyField&&comparison.changed.includes(dirtyField)?dirtyField:comparison.changed.at(-1);
    const step=get('apply-next'), phase=policy.state.phase;
    if (phase==='multi-change') {
      step.textContent='Compare only '+fields[pick];
      step.onclick=()=>{
        const isolated={...state.baseline,[pick]:state.current[pick]};
        const check=engine.compare(state.baseline,isolated);
        for (const field of comparison.changed.filter(key=>key!==pick)) state.edits.push({at:new Date().toISOString(),field,from:state.current[field],to:isolated[field]});
        state.edits=state.edits.slice(-40);state.current=isolated;comparison=check;dirtyField=pick;setControls();restoreInputs();render();save();
        get('current-value').setAttribute('tabindex','-1');get('current-value').focus();
      };
    } else if (phase==='withheld') {
      step.textContent='Review missing input';
      step.onclick=()=>{get('rover-settings').open=true;get(comparison.current.status==='open-cabin'?'cabin':'material').focus();};
    } else if (phase==='single-change') {
      step.textContent='Inspect the source records';
      step.onclick=()=>{get('sources').open=true;get('sources').querySelector('summary').focus();};
    } else {
      step.textContent=state.current.speedMmS===null?'Try the opposite airflow':'Inspect the imposed speed';
      step.onclick=()=>{if(state.current.speedMmS===null){change('flow',state.current.flow==='concurrent'?'opposed':'concurrent');document.querySelector('input[name="flow"]:checked').focus();}else{get('rover-settings').open=true;get('custom-speed').focus();}};
    }
    const layers=get('layer-list'); layers.replaceChildren();
    for(const layer of policy.layers) {
      const row=make('div'), expl=make('dd',layer.response); expl.append(make('small',layer.observed)); row.append(make('dt',layer.label),expl); layers.append(row);
    }
    const tier=policy.device.tier;
    get('trace-panel').hidden=!policy.device.showPlot;
    if (tier!==lastPresentation) {
      get('numbers').open=!policy.device.showPlot || policy.device.expandDetails;
      get('sources').open=!!policy.device.expandDetails;
      lastPresentation=tier;
    }
  }

  function loadWeights() {
    if (!neuralLoaded) {
      neuralLoaded=new Promise((resolve,reject)=>{
        if (window.FFCabinLiquid) {resolve(window.FFCabinLiquid); return;}
        const script=make('script');
        script.src='cabin-liquid-weights.js';
        script.onload=()=>window.FFCabinLiquid?resolve(window.FFCabinLiquid):reject(Error('Missing liquid model weights.'));
        script.onerror=()=>{script.remove();reject(Error('Could not load the liquid model.'));};
        document.head.append(script);
      }).catch(error=>{neuralLoaded=null;throw error;});
    }
    return neuralLoaded;
  }
  async function showNeural() {
    const version=++requestVersion, result=comparison.current;
    const target=get('neural-result'), run=get('neural-run');
    run.hidden=true;
    if (!result.physicsInputs) {target.textContent='A modeled, sealed cabin and characterized material are needed to estimate oxygen.';return;}
    if(policy.device.deferSurrogate && !neuralRequested) {
      target.textContent='Lite mode runs the physical model. Request the neural estimate to check its training range and compare oxygen.';run.hidden=false;return;
    }
    const domain=Object.entries(window.FFPhysics.trainingDomain).filter(([id,[lo,hi]])=>result.physicsInputs[id]<lo||result.physicsInputs[id]>hi);
    if(domain.length) {
      target.textContent=domain.some(([id])=>id==='density')?
        'The coupon gives '+number(result.physicsInputs.density,3)+' g/cm of strip. The liquid model covers 0.5–5 g/cm. Try a 20 g coupon on this 40 cm strip.':
        'Outside the liquid model’s training range for '+domain.map(([key])=>key).join(', ')+'. The numerical cabin model remains available.';
      return;
    }
    target.textContent='Checking the trained oxygen model…';
    try {
      const weights=await loadWeights(); if(version!==requestVersion)return;
      const curve=window.FFPhysics.liquidPrediction(result.physicsInputs,weights);
      if(!curve) {target.textContent='This case falls outside the trained oxygen model.';return;}
      const step=window.FFPhysics.interval, second=Math.floor(state.current.time/step)*step;
      const estimate=curve[second/step], physicsValue=window.FFPhysics.atTime(result.physicsInputs,second).oxygen;
      target.textContent='At '+second+' s the liquid model estimates '+number(estimate,4)+'% oxygen. The physical model gives '+number(physicsValue,4)+'%, a difference of '+number(Math.abs(physicsValue-estimate),4)+' percentage points. Training used synthetic cabin runs.'+
        (second!==state.current.time?' The neural model reports every '+step+' seconds.':'');
    } catch(error){if(version===requestVersion){target.textContent=error.message;run.hidden=false;}}
  }

  function render() {
    comparison ||= engine.compare(state.baseline,state.current);
    policy=getPolicy();
    const last=dirtyField && comparison.changed.includes(dirtyField)?dirtyField:comparison.changed.at(-1);
    const primary=primaryFor[last]||'positionCm', definition=metrics[primary];
    const b=comparison.baseline,c=comparison.current;
    get('metric-title').textContent=definition.label;
    get('baseline-value').textContent=valueLabel(b.metrics[primary],definition);
    get('current-value').textContent=valueLabel(c.metrics[primary],definition);
    const difference=comparison.deltas[primary];
    get('delta-value').textContent=difference===null?'Comparison withheld':valueLabel(difference,definition,true);
    get('delta-note').textContent=difference===null?'':difference===0?'change from baseline':'from baseline';
    get('trial-clock').textContent=state.baseline.time===state.current.time?
      state.current.time+' s':'Baseline '+state.baseline.time+' s · Current '+state.current.time+' s';
    get('finding').textContent=!comparison.changed.length && c.status==='modeled'?
      'Select the other airflow direction to compare the two published rates at this time.':c.explanation;
    get('condition-count').textContent=comparison.changed.length? 'Changed '+comparison.changed.map(id=>fields[id]||id).join(', '):'Same inputs in both trials';
    renderNumbers();presentPolicy();showReceipts();drawChart();showNeural();
    const announcement=definition.label+'. Baseline '+get('baseline-value').textContent+', current '+get('current-value').textContent+'. '+get('delta-value').textContent+' '+get('delta-note').textContent+'.';
    clearTimeout(lastClockAnnouncement);
    lastClockAnnouncement=setTimeout(()=>{get('live-summary').textContent=announcement;},200);
  }

  function receipt(trial) {
    return {settings:trial.settings,physicallyModeledInputs:trial.physicsInputs,status:trial.status,modelState:trial.state,
      metrics:trial.metrics,sources:trial.sources,imposedRate:trial.rateBasis,boundary:trial.boundary,roverModelSHA256:trial.modelSHA256};
  }
  function archive() {
    return {schema,created:new Date().toISOString(),state,units:Object.fromEntries(Object.entries(metrics).map(([key,spec])=>[key,spec.unit])),
      baseline:receipt(comparison.baseline),current:receipt(comparison.current),deltas:comparison.deltas,changed:comparison.changed,
      nextMeasurement:policy.evidence.nextMeasurement,effectiveDeviceMode:policy.device.tier,decisionTrace:policy.layers};
  }
  function download() {
    const blob=new Blob([JSON.stringify(archive(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=make('a');
    a.href=url;a.download='first-fire-rover-comparison.json';document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    get('file-status').textContent='Comparison downloaded. Replay it here to verify both trials.';
  }
  function matches(a,b) {
    if (a===b) return true;
    if(typeof a==='number' && typeof b==='number')return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b));
    if (!a || !b || typeof a!=='object' || typeof b!=='object' || Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length && keys.every(k=>Object.hasOwn(b,k) && matches(a[k],b[k]));
  }
  async function replay(file) {
    if(!file)return;
    try {
      if(file.size>2000000)throw Error('The comparison file exceeds 2 MB.');
      const data=JSON.parse(await file.text());
      if(data.schema!==schema)throw Error('Choose a FIRST FIRE rover comparison file.');
      const next=checkState(data.state), check=engine.compare(next.baseline,next.current);
      if(!matches(data.baseline,receipt(check.baseline)) || !matches(data.current,receipt(check.current)) ||
        !matches(data.deltas,check.deltas) || !matches(data.changed,check.changed) ||
        !matches(data.units,Object.fromEntries(Object.entries(metrics).map(([key,spec])=>[key,spec.unit])))) {
        throw Error('Recorded inputs, results or source records differ from this rerun. The current experiment is unchanged.');
      }
      state=next;comparison=check;dirtyField=null;restored=true;neuralRequested=false;
      setControls();restoreInputs();render();save();
      get('file-status').textContent='Replay verified. Both trials, their differences, model fingerprint and source records match.';
    } catch(error){get('file-status').textContent='File not applied. '+error.message;}
    get('import').value='';
  }

  for(const id of physicalIds) {
    const element=get(id);
    if(!element)throw Error('Missing experiment control '+id);
    const event=id==='time'?'input':'change';
    element.addEventListener(event,()=>change(id,numericIds.has(id)?element.valueAsNumber:element.value));
  }
  document.querySelectorAll('input[name="flow"]').forEach(r=>r.addEventListener('change',()=>{if(r.checked)change('flow',r.value);}));
  get('speed-mode').onchange=()=>change('speedMmS',get('speed-mode').value==='custom'?get('custom-speed').valueAsNumber:null);
  get('custom-speed').onchange=()=>change('speedMmS',get('custom-speed').valueAsNumber);
  get('freeze').onclick=()=>{
    state.baseline={...state.current}; state.baselineFrozen=true; dirtyField=null; comparison=null; render();save();
    get('file-status').textContent='Current settings saved as the new baseline.';
    get('live-summary').textContent='Baseline updated. Both trials now use the same settings.';
  };
  for(const id of ['level','display'])get(id).onchange=()=>{
    state[id]=get(id).value; if(id==='display')neuralRequested=false;
    window.FFJudgeReader?.share?.({level:state.level,display:state.display});render();save();
  };
  get('intent-override').onchange=()=>{state.intentOverride=get('intent-override').value;render();save();};
  get('question-form').onsubmit=event=>{
    event.preventDefault();state.question=get('question').value.trim();state.intentOverride='auto';get('intent-override').value='auto';render();save();
    get('intent-action').focus();
  };
  get('intent-action').addEventListener('click',()=>window.FFJudgeReader?.share?.({level:state.level,display:state.display,question:state.question}));
  get('download').onclick=download;
  get('open-file').onclick=()=>get('import').click();
  get('import').onchange=()=>replay(get('import').files[0]);
  get('neural-run').onclick=()=>{neuralRequested=true;showNeural();};
  get('reset').onclick=()=>{
    const previous=state;
    state=clean();state.level=previous.level;state.display=previous.display;
    dirtyField=null;comparison=null;neuralRequested=false;restored=false;setControls();restoreInputs();render();save();
    get('file-status').textContent='Baseline and current trial reset. Your reading and device preferences are retained.';
  };
  setControls();get('startup').hidden=true;get('lab').hidden=false;render();
  new ResizeObserver(()=>{if(policy)drawChart();}).observe(get('trace-panel'));
  window.FFReaderDevice?.measure?.().then(()=>{if(state.display==='auto')render();}).catch(()=>{});
})();
