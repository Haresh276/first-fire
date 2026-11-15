/* Sequential FM² design with a discrete shared limit and an explicit reading-error model. */
(function () {
  'use strict';
  const binWidth = 0.05;
  const slots = 2000;
  const limit = Array.from({length: slots}, (_, i) => (i + 0.5) * binWidth);
  const planned = [37, 33, 29, 25];
  const defaultSettings = {mean: 26, spread: 1.5, error: 5, low: 22, high: 30, step: 0.5, horizon: 2, objective: 'limit', target: 25};
  const schema = 'first-fire/fm2-design/1';
  const nasa = 'https://ntrs.nasa.gov/citations/20260001966';
  const method = 'https://papers.neurips.cc/paper_files/paper/2003/hash/5e6bd7a6970cd4325e587f02667f7f73-Abstract.html';
  const storageKey = 'ff-fm2-design-v1';
  const sum = values => values.reduce((a, b) => a + b, 0);
  const bounded = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;
  const half = n => Number.isInteger(n * 2);
  function validate(s, history) {
    if (!s || !bounded(s.mean, 22, 30) || !bounded(s.spread, 0.5, 4)) throw Error('Use a mean of 22–30% and a prior standard deviation of 0.5–4 points.');
    if (!bounded(s.error, 0, 25)) throw Error('Use a symmetric reading error between 0% and 25%.');
    if (!bounded(s.low, 20, 40) || !bounded(s.high, s.low, 40) || !half(s.low) || !half(s.high) || ![0.5, 1, 2, 4].includes(s.step)) throw Error('Choose a reachable range from 20 to 40% in half-point increments. The upper bound must reach the lower bound.');
    if (![1, 2].includes(s.horizon) || !['limit','burn'].includes(s.objective) || !planned.includes(s.target)) throw Error('Choose a supported design objective, target burn and planning budget.');
    if (!Array.isArray(history) || history.length > 40 || history.some(b => !b || !bounded(b.oxygen, 20, 40) || !half(b.oxygen) || !['yes','no'].includes(b.result))) throw Error('The record supports up to 40 hypothetical burns at 20–40% oxygen in half-point steps.');
  }
  function entropy(a, b) {
    return (a > 0 ? -a * Math.log2(a) : 0) + (b > 0 ? -b * Math.log2(b) : 0);
  }
  function normalize(logWeights) {
    let peak = -Infinity;
    for (const v of logWeights) if (v > peak) peak = v;
    if (!Number.isFinite(peak)) return null;
    const weights = logWeights.map(v => Math.exp(v - peak));
    const total = sum(weights);
    return weights.map(w => w / total);
  }
  function distribution(weights) {
    // Accumulate from both ends independently so that rare no-spread branches retain precision.
    const lower = new Float64Array(slots + 1), upper = new Float64Array(slots + 1);
    for (let i = 0; i < slots; i++) {
      lower[i + 1] = lower[i] + weights[i];
      upper[slots - i - 1] = upper[slots - i] + weights[slots - i - 1];
    }
    const at = x => Math.max(0, Math.min(slots, Math.round(x / binWidth)));
    return {weights, below: x => Math.min(1, lower[at(x)]), above: x => Math.min(1, upper[at(x)])};
  }
  function summarize(state) {
    const mean = sum(state.weights.map((w, i) => w * limit[i]));
    function quantile(q) {
      let c = 0;
      for (let i = 0; i < slots; i++) {
        const w = state.weights[i];
        if (w > 0 && c + w >= q) return (i + (q - c) / w) * binWidth;
        c += w;
      }
      return 100;
    }
    return {mean, median: quantile(0.5), interval80: [quantile(0.1), quantile(0.9)]};
  }
  function update(state, oxygen, result, errorRate) {
    const wantYes = result === 'yes';
    const weights = state.weights.map((w, i) => w * ((limit[i] < oxygen) === wantYes ? 1 - errorRate : errorRate));
    const total = sum(weights);
    return total > 0 ? distribution(weights.map(w => w / total)) : null;
  }
  function candidate(state, oxygen, s) {
    const e = s.error / 100, a = state.below(oxygen), b = state.above(oxygen);
    const yes = (1 - e) * a + e * b, no = e * a + (1 - e) * b;
    const information = Math.max(0, entropy(yes, no) - entropy(e, 1 - e));
    // Covariance of nested threshold indicators, evaluated as P(lower) * P(above higher).
    const cov = (1 - 2 * e) * state.below(Math.min(oxygen, s.target)) * state.above(Math.max(oxygen, s.target));
    const brier = yes && no ? (cov / yes) * (cov / no) : 0;
    return {oxygen, yes, no, information, brier, utility: s.objective === 'limit' ? information : brier};
  }
  function analyze(settings = defaultSettings, history = []) {
    validate(settings, history);
    const s = settings, e = s.error / 100;
    const base = limit.map(x => -0.5 * ((x - s.mean) / s.spread) ** 2);
    const prior = distribution(normalize(base));
    const logWeights = base.slice();
    // Log likelihoods preserve low-probability mass through long sequences.
    for (const run of history) {
      const wantYes = run.result === 'yes';
      for (let i = 0; i < slots; i++) logWeights[i] += (limit[i] < run.oxygen) === wantYes ? Math.log1p(-e) : Math.log(e);
    }
    const weights = normalize(logWeights);
    if (!weights) return {prior, conflict: true};
    const posterior = distribution(weights);
    const grid = [];
    for (let oxygen = s.low; oxygen <= s.high; oxygen += s.step) grid.push(oxygen);
    const choices = grid.map(x => candidate(posterior, x, s));
    function best(items, key) {
      return items.reduce((a, b) => b[key] > a[key] + 1e-12 || (Math.abs(a[key] - b[key]) <= 1e-12 && b.utility > a.utility + 1e-12) ? b : a);
    }
    for (const c of choices) {
      c.total = c.utility;
      c.branches = {};
      for (const result of ['yes','no']) {
        const chance = c[result];
        if (!chance) continue;
        const next = update(posterior, c.oxygen, result, e);
        if (!next) continue;
        const branch = {chance, summary: summarize(next)};
        if (s.horizon === 2) {
          const follow = best(grid.map(x => candidate(next, x, s)), 'utility');
          branch.utility = follow.utility;
          branch.oxygen = follow.utility > 1e-12 ? follow.oxygen : null;
          c.total += chance * follow.utility;
        }
        c.branches[result] = branch;
      }
    }
    const pick = best(choices, 'total');
    return {conflict:false, prior, posterior, summary:summarize(posterior), choices,
      best:pick.total > 1e-12 ? pick : null,
      forecasts:planned.map(oxygen => ({oxygen, prior:prior.below(oxygen), posterior:posterior.below(oxygen)}))};
  }
  const interview = 'https://www.nasa.gov/podcasts/houston-we-have-a-podcast/moon-material-flammability/';
  const requestFields = {
    geometry:'Specimen dimensions, mounting and airflow',
    camera:'Camera view, endpoint and frame clock',
    oxygenChannel:'Oxygen sensor, calibration and time alignment',
    earthComparator:'Earth counterpart, matching conditions and reference'
  };
  function requestInputs(raw={}) {
    if (!raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('The test request fields must be an object.');
    const fields={};
    for(const key of [...Object.keys(requestFields),'earthSupply','disposition','extinctionOxygen','receipt']) {
      if(raw[key]!==undefined && (typeof raw[key]!=='string'||raw[key].length>480)) throw Error('Invalid test request field: '+key);
      fields[key]=raw[key]??'';
    }
    fields.disposition ||= 'pending';
    if(!['','existing','new'].includes(fields.earthSupply) || !['pending','extinction','unable'].includes(fields.disposition)) throw Error('Unsupported test request status.');
    return fields;
  }
  function payloadRequest(settings,model,oxygen,raw={}) {
    const fields=requestInputs(raw);
    const candidate=model?.choices?.find(c=>c.oxygen===oxygen);
    const missing=Object.entries(requestFields).filter(([key])=>!fields[key].trim()).map(([,label])=>label);
    if(!fields.earthSupply) missing.push('Earth comparator specimen allocation');
    if(!candidate) missing.push('A reachable first test under valid model assumptions');
    const extinction=/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(fields.extinctionOxygen.trim())?Number(fields.extinctionOxygen):null;
    const assessmentErrors=[];
    if(fields.disposition==='extinction' && (extinction===null || !bounded(extinction,0,100))) assessmentErrors.push('Enter a finite flame-out oxygen percentage from 0 to 100.');
    if(fields.disposition!=='pending' && !fields.receipt.trim()) assessmentErrors.push('Identify the source frames and oxygen trace, or explain why assessment is unavailable.');
    const extra=fields.earthSupply==='new'?settings.horizon:fields.earthSupply==='existing'?0:null;
    const next={};
    for (const key of ['yes','no']) {
      const branch=candidate?.branches[key];
      const second=branch?.oxygen??null;
      next[key]={meaning:key==='yes'?'Nominal sustained spread after igniter cutoff':'Nominal absence of sustained spread after igniter cutoff',
        chance_under_model:branch?.chance??null, next_oxygen_pct:second};
    }
    return {
      inputs:fields, planning_status:missing.length?'draft':'specified_for_lab_review', missing_planning_inputs:missing,
      material:'Synergy Pro Navy fabric',target_gravity_earth_g:0.165, initial_pressure_psia:8.2,
      pressure_tolerance_psi:0.3,chamber_litres:14.4,balance_gas:'nitrogen',spread_direction:'upward',
      selected_start_oxygen_pct:candidate?.oxygen??null,model_recommended_start_oxygen_pct:model?.best?.oxygen??null,
      objective:settings.objective==='limit'?'Locate the shared sustained-spread oxygen limit':'Reduce expected Brier risk for sustained spread at '+settings.target+'% starting oxygen',
      budget:{target_gravity_specimens:settings.horizon,new_earth_specimens:extra,total_new_specimens:extra===null?null:settings.horizon+extra},
      comparator:'Matched Earth-gravity test at the same initial oxygen, pressure, material, geometry, ignition, flow and endpoint.',
      branches:next,unable_to_assess_policy:'Withhold the yes/no update when ignition hardware, conditions or evidence cannot be evaluated. A replacement consumes another specimen.',
      illustrative_readout:{state:assessmentErrors.length?'incomplete':fields.disposition,
        oxygen_at_flameout_pct:fields.disposition==='extinction'&&!assessmentErrors.length?extinction:null,
        receipt_or_reason:fields.disposition==='pending'?null:fields.receipt.trim()||null,issues:assessmentErrors},
      sources:[nasa,interview],signed_reference:'forecast-lock/fm2-v1.json'
    };
  }
  function scenarioRecord(settings, history, model, oxygen=model.best?.oxygen??null, inputs={}) {
    return {schema, kind:'hypothetical', assumptions:{...settings}, history:history.map(x=>({...x})),
      test_request:payloadRequest(settings,model,oxygen,inputs),
      design_source:nasa, design_locator:'March 2026, PDF pp. 5–6, 10–11 and 14', method_source:method,
      material:'Synergy Pro Navy', pressure_psia:8.2, chamber_litres:14.4,
      endpoint:'Self-sustained flame spread after igniter power ends', threshold_grid:{minimum:0,maximum:100,width:binWidth,placement:'midpoints',prior:'Normal density, normalized across bins'},
      likelihood:'An observation agrees with (starting oxygen > common threshold) with probability 1 - error/100. Independent, symmetric observation errors conditional on threshold.',
      objective_units:settings.objective==='limit'?'bits of expected threshold information':'expected decrease in binary Brier risk at target oxygen',
      official_outcomes:[null,null,null,null], signed_reference:'forecast-lock/fm2-v1.json',
      result:model.conflict?{state:'conflicting_hypotheses'}:{posterior:model.summary, burn_predictions:model.forecasts, recommended_oxygen:model.best?.oxygen??null, candidates:model.choices}};
  }
  function importRecord(raw) {
    if (!raw || raw.schema !== schema || raw.kind !== 'hypothetical') throw Error('Choose a FIRST FIRE hypothetical FM² design JSON record.');
    const settings = Object.fromEntries(Object.keys(defaultSettings).map(k => [k, raw.assumptions?.[k]]));
    validate(settings, raw.history);
    return {settings, history:raw.history.map(r => ({oxygen:r.oxygen, result:r.result})),
      request:requestInputs(raw.test_request?.inputs),selected:raw.test_request?.selected_start_oxygen_pct??null};
  }
  const numeric = {analyze, defaultSettings, scenarioRecord, importRecord, payloadRequest, summarize, planned};
  if (typeof module !== 'undefined' && module.exports) module.exports = numeric;
  if (typeof window === 'undefined') return;
  const number = (n, digits = 1) => Number(n.toFixed(digits)).toString();
  const percent = p => p > 0.9999 ? '>99.99%' : p < 0.0001 ? '<0.01%' : number(100 * p, 2) + '%';
  const oxygenText = x => number(x) + '% O₂';
  function selectOptions(items) {
    return items.map(([value, text]) => '<option value="'+value+'">'+text+'</option>').join('');
  }
  function densityPlot(canvas, model, s) {
    const ctx=canvas.getContext('2d');
    if(!ctx) return;
    const width=Math.max(320,Math.round(canvas.getBoundingClientRect().width||640)),height=244;
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*ratio);canvas.height=height*ratio;ctx.scale(ratio,ratio);
    const {prior,posterior,summary}=model;
    const start=Math.max(0,Math.floor(Math.min(s.mean-3.1*s.spread,summary.interval80[0]-s.spread)));
    const end=Math.min(100,Math.ceil(Math.max(s.mean+3.1*s.spread,summary.interval80[1]+s.spread)));
    const left=39,right=width-17,top=22,bottom=height-40;
    const first=Math.floor(start/binWidth),last=Math.min(slots-1,Math.ceil(end/binWidth));
    const max=Math.max(...prior.weights,...posterior.weights)*1.07;
    const X=x=>left+(x-start)/(end-start)*(right-left),Y=w=>bottom-(bottom-top)*w/max;
    ctx.font='11px system-ui';ctx.textAlign='right';ctx.fillStyle='#c1d4cd';ctx.strokeStyle='#3a504c';ctx.lineWidth=1;
    for(let j=0;j<=2;j++){
      const y=Y(j*max/2);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
      ctx.fillText(number(j*max/(2*binWidth),2),left-5,y+4);
    }
    ctx.fillStyle='rgba(107,204,181,0.12)';ctx.fillRect(X(summary.interval80[0]),top,X(summary.interval80[1])-X(summary.interval80[0]),bottom-top);
    for(const [series,color,dash] of [[prior,'#cedbd3',[4,4]],[posterior,'#68d8bb',[]]]){
      ctx.strokeStyle=color;ctx.lineWidth=2.2;ctx.setLineDash(dash);ctx.beginPath();
      for(let i=first;i<=last;i++) {
        const x=X(limit[i]),y=Y(series.weights[i]);
        if(i===first)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([2,4]);ctx.strokeStyle='#ffae75';ctx.beginPath();ctx.moveTo(X(summary.median),top);ctx.lineTo(X(summary.median),bottom);ctx.stroke();ctx.setLineDash([]);
    ctx.textAlign='center';ctx.fillStyle='#d6e3dc';
    const stride=Math.max(1,Math.ceil((end-start)/(width<420?5:8)));
    for(let x=Math.ceil(start/stride)*stride;x<=end;x+=stride){ctx.fillText(x+'%',X(x),bottom+16);}
    ctx.fillText('Oxygen limit by volume', (left+right)/2,height-3);
    ctx.textAlign='left';ctx.fillText('Probability density per percentage point',left,12);
    canvas.setAttribute('aria-label','Prior and updated density. Median '+oxygenText(summary.median)+'. Central 80% interval '+number(summary.interval80[0],2)+' to '+number(summary.interval80[1],2)+'% oxygen.');
  }
  function render(root) {
    let settings={...defaultSettings},history=[],selected=null,model=null,initialMessage='',request=requestInputs();
    const guide=window.FFResearchSession;
    const guided=guide?.active?.()===true;
    try {
      const saved=guided?guide.previous('design-lab')?.record:
        (window.FFAwareness?.previous?.('design-lab') || JSON.parse(localStorage.getItem(storageKey)));
      if(saved) ({settings,history,request,selected}=importRecord(saved));
    } catch {initialMessage='This browser could not restore the prior session.';}
    root.innerHTML='<div class="dl"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="#home">Research desk</a><span>/</span><a href="#forecast">FM² forecast</a></nav>'+
      '<header class="dl-heading"><div><h1>Experiment design lab</h1><p>Which oxygen setting would teach us the most about sustained spread? Try hypothetical burns on the same Synergy Pro Navy fabric at 8.2 psia, then plan the next specimen.</p></div>'+
      '<a href="forecast-lock/fm2-v1.json" class="dl-signed">Fixed team forecast ↗</a></header>'+
      '<div class="dl-main"><section class="dl-density" aria-labelledby="dl-density-heading"><h2 id="dl-density-heading">Where is the oxygen limit?</h2><div id="dl-metrics" class="dl-metrics"></div>'+
      '<canvas id="dl-density" role="img"></canvas><div class="dl-key"><span>Prior</span><span>Updated distribution</span><span>Median</span></div></section>'+
      '<section class="dl-recommend panel"><h2>Next experiment</h2><div id="dl-pick" aria-live="polite"></div><div id="dl-tree"></div></section></div>'+
      '<section class="dl-controls panel"><h2>Design constraints</h2><div class="dl-fields">'+
      '<label>Research objective<select data-dl="objective">'+selectOptions([['limit','Locate the oxygen limit'],['burn','Resolve a planned burn']])+'</select></label>'+
      '<label id="dl-target-label">Target burn<select data-dl="target">'+selectOptions(planned.map((x,i)=>[x,'Burn '+(i+1)+' · '+oxygenText(x)]))+'</select></label>'+
      '<label>Specimens to plan<select data-dl="horizon">'+selectOptions([[1,'One specimen'],[2,'Two, with a follow-up']])+'</select></label>'+
      '<label>Reading error<select data-dl="error">'+selectOptions([0,2,5,10,15,25].map(x=>[x,x+'%']))+'</select></label></div>'+
      '<details><summary>Prior and reachable oxygen settings</summary><div class="dl-fields">'+
      [['mean','Prior mean (% O₂)',22,30,0.1],['spread','Prior SD (points)',0.5,4,0.1],['low','Minimum (% O₂)',20,40,0.5],['high','Maximum (% O₂)',20,40,0.5]].map(([k,l,a,b,step])=>'<label>'+l+'<input type="number" data-dl="'+k+'" min="'+a+'" max="'+b+'" step="'+step+'"></label>').join('')+
      '<label>Oxygen step<select data-dl="step">'+selectOptions([0.5,1,2,4].map(x=>[x,x+' points']))+'</select></label></div>'+
      '<p>Settings start at the minimum and advance by the chosen step. Changing the prior or reading error reanalyses every entry. Reachability limits apply to future tests.</p></details><p id="dl-alert" role="alert"></p></section>'+
      '<div class="dl-main dl-lower"><section class="panel dl-trial"><h2>Try a hypothetical result</h2><p>Choose a reachable setting. Record whether spread continued beyond the igniter after power ended.</p>'+
      '<label>Trial oxygen<select id="dl-trial-setting"></select></label><p id="dl-predict"></p><div class="dl-actions"><button type="button" class="dl-primary" id="dl-yes">Spread sustained</button><button type="button" class="ghost" id="dl-no">No sustained spread</button></div>'+
      '<div id="dl-history"></div><button type="button" class="dl-link" id="dl-undo">Undo last trial</button></section>'+
      '<section class="panel dl-burns"><h2>Four planned burns</h2><p>Chances of sustained spread under the shared limit. Each hypothetical observation can update all four burns.</p><div id="dl-burn-values"></div></section></div>'+
      '<section class="panel dl-candidates"><h2>Compare achievable designs</h2><p id="dl-utility-explanation"></p><div id="dl-ranking"></div></section>'+
      '<section class="panel dl-repro"><h2>Payload lab test request</h2><p>Prepare a hypothetical follow-up for a payload engineer. The selected trial setting above determines the requested starting oxygen. The lab compares an upward burn of Synergy Pro Navy in a 14.4 L chamber at 8.2 ± 0.3 psia, nitrogen balance, with a matched Earth-gravity test.</p><p id="dl-request-plan"></p><p id="dl-request-branches"></p>'+
      '<details id="dl-request-fields"><summary>Edit specimen, camera and comparator details</summary><div class="dl-fields dl-request-grid">'+
      Object.entries(requestFields).map(([key,label])=>'<label>'+label+'<textarea rows="2" maxlength="480" data-request="'+key+'"></textarea></label>').join('')+
      '<label>Earth comparator specimens<select data-request="earthSupply">'+selectOptions([['','Choose allocation'],['existing','Use documented existing Earth runs'],['new','Allocate one new Earth specimen per target specimen']])+'</select></label></div>'+
      '<h3>Rehearse the readout</h3><p>Practice recording an endpoint for this oxygen setting. These entries stay outside the model history and flight-outcome fields. Sample exhaustion, commanded shutdown or a missing oxygen trace cannot supply oxygen at natural flame-out.</p>'+
      '<div class="dl-fields dl-request-grid"><label>Flame-out readout<select data-request="disposition">'+selectOptions([['pending','Awaiting a run'],['extinction','Illustrative natural flame-out'],['unable','Unable to assess']])+'</select></label>'+
      '<label id="dl-extinction-label">Illustrative O₂ at flame-out (% by volume)<input type="text" inputmode="decimal" maxlength="24" data-request="extinctionOxygen"></label>'+
      '<label id="dl-receipt-label">Camera frame, oxygen trace and time, or reason assessment failed<textarea rows="2" maxlength="480" data-request="receipt"></textarea></label></div></details>'+
      '<p id="dl-request-status" role="status"></p><p><a href="'+nasa+'" target="_blank" rel="noopener">NASA FM² design</a> · <a href="'+interview+'" target="_blank" rel="noopener">Investigators on Sierra Lobo hardware and matched Earth tests</a></p>'+
      '<p>Download the request in the design JSON or reopen it here to continue editing offline.</p><div class="dl-actions">'+
      '<button type="button" class="ghost" id="dl-export">Export design JSON</button><button type="button" class="ghost" id="dl-import">Import design JSON</button><input id="dl-file" type="file" accept=".json,application/json" hidden><button type="button" class="dl-link" id="dl-reset">Reset scenario</button></div><p id="dl-session" role="status"></p>'+
      '<details><summary>Model, scope and sources</summary><p>The limit is shared across runs on matched specimens. The prior assigns weights to 0.05-point bins from 0 to 100% using a normal density. The plotted 80% interval spans the 10th and 90th percentiles. The expected gain in bits is the entropy of the possible reading minus its assumed error entropy.</p>'+
      '<p>Reading error is an illustrative chance of reversing a yes/no classification, independent across specimens given the limit. It covers observation error only. Material variability, ignition failure and changes in flow require separate models. Use only nominal, interpretable burns in this exercise.</p>'+
      '<p>The target-burn objective minimizes the expected Brier risk p(1−p) for whether the common limit lies below the target oxygen. Two specimens allow a different second setting after each first result, including a repeat when useful. All trials have equal assumed cost. Ties favor immediate gain, then lower oxygen.</p>'+
      '<p>The four NASA design atmospheres are 37%, 33%, 29% and 25% oxygen in a 14.4 L sealed chamber. Additional settings in this lab are hypothetical follow-up designs. The signed forecast uses a continuous prior. This lab approximates it numerically and has its own reading-error assumption.</p>'+
      '<p><a href="'+nasa+'" target="_blank" rel="noopener">NASA experimental design, PDF pp. 5–6 and 10–11 ↗</a> · <a href="'+method+'" target="_blank" rel="noopener">Paninski, information-based experiment design ↗</a></p></details></section></div>';
    const get=id=>root.querySelector('#dl-'+id);
    const fields=[...root.querySelectorAll('[data-dl]')];
    const message=get('session');
    const requestControls=[...root.querySelectorAll('[data-request]')];
    function fillRequest() {
      for(const field of requestControls) field.value=request[field.dataset.request];
    }
    function clearReadout() {
      request.disposition='pending';request.extinctionOxygen='';request.receipt='';
      fillRequest();
    }
    function renderRequest() {
      const r=payloadRequest(settings,model,selected,request),budget=r.budget;
      const start=r.selected_start_oxygen_pct===null?'Starting oxygen unavailable':oxygenText(r.selected_start_oxygen_pct)+' starting oxygen';
      const count=budget.new_earth_specimens===null?'Earth allocation pending':budget.new_earth_specimens+' new Earth specimens, '+budget.total_new_specimens+' new specimens total';
      get('request-plan').textContent=start+' · Target '+r.target_gravity_earth_g+' g · '+budget.target_gravity_specimens+' target specimen'+(budget.target_gravity_specimens===1?'':'s')+' · '+count+'. Objective: '+r.objective+'.';
      const follow=key=>r.branches[key].next_oxygen_pct===null?'no second setting assigned':oxygenText(r.branches[key].next_oxygen_pct);
      get('request-branches').textContent=(settings.horizon===2?'If spread sustains: '+follow('yes')+'. If it does not: '+follow('no')+'. ':'One specimen is available at target gravity. ')+r.unable_to_assess_policy;
      get('extinction-label').hidden=request.disposition!=='extinction';
      get('receipt-label').hidden=request.disposition==='pending';
      get('request-status').textContent=(r.missing_planning_inputs.length?'Draft. Open planning fields: '+r.missing_planning_inputs.join(', ')+'.':'Planning fields complete for lab review.')+' '+r.illustrative_readout.issues.join(' ');
    }
    const units=()=>settings.objective==='limit'?'bits':'Brier risk';
    const utility=x=>settings.objective==='limit'?number(x,3):number(x,4);
    function fillControls(){
      for(const f of fields){
        const val=settings[f.dataset.dl];
        if(f.tagName==='SELECT'&&![...f.options].some(o=>o.value===String(val)))f.add(new Option(String(val)+(f.dataset.dl==='error'?'%':''),String(val)));
        f.value=String(val);
      }
    }
    function save(){
      // A guided design is already captured in this tab by emitResult().
      if(!model||guided)return;
      try{localStorage.setItem(storageKey,JSON.stringify({schema,kind:'hypothetical',assumptions:settings,history,test_request:{inputs:request,selected_start_oxygen_pct:selected}}));}
      catch{message.textContent='Browser storage is unavailable. Export the record to keep this scenario.';}
    }
    function displayHistory(){
      const box=get('history');
      box.replaceChildren();
      if(history.length){
        const title=document.createElement('h3');title.textContent='Trial history';box.append(title);
        const table=document.createElement('ol');
        for(const h of history){
          const row=document.createElement('li'),result=document.createElement('span');
          row.textContent=oxygenText(h.oxygen);result.textContent=h.result==='yes'?'Sustained':'Did not sustain';row.append(result);table.append(row);
        }
        box.append(table);
      }
      get('undo').hidden=history.length===0;
    }
    function choose(x) {
      if(selected!==null && selected!==x) clearReadout();
      selected=x;
      get('trial-setting').value=String(x);
      const row=model?.choices?.find(r=>r.oxygen===x);
      get('predict').textContent=row?'Chance of observing “sustained” at this setting: '+percent(row.yes)+'.':'';
    }
    function emitResult() {
      const ready=!!model && !model.conflict;
      const recommended=ready && model.best;
      const summary=ready ? 'After '+history.length+' hypothetical trial'+(history.length===1?'':'s')+', the median oxygen limit is '+number(model.summary.median,2)+'%.'+(recommended?' The next design starts at '+oxygenText(recommended.oxygen)+'.':' No reachable setting offers measurable gain.') : 'This hypothetical design has no current estimate.';
      const record={schema,kind:'hypothetical',test_request:payloadRequest(settings,model,selected,request),assumptions:{...settings},history:history.map(r=>({...r})),official_outcomes:[null,null,null,null],state:model?.conflict?'conflicting_hypotheses':ready?'modeled':'invalid',median:ready?model.summary.median:null,interval80:ready?model.summary.interval80:null,recommendation:recommended?{oxygen:recommended.oxygen,utility:recommended.total,units:units()}:null,scope:'Scenario for nominal tests of matched fabric using a shared limit and symmetric reading error.'};
      document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{tool:'design-lab',title:'FM² experiment design',summary,record,valid:ready,invalid:!ready}}));
    }
    function redraw(pickRecommended=false) {
      get('target-label').hidden=settings.objective!=='burn';
      get('alert').textContent='';
      try{model=analyze(settings,history);}catch(error){model=null;get('alert').textContent=error.message;}
      const ready=!!model&&!model.conflict;
      get('density').hidden=!ready;get('export').disabled=!model;
      get('yes').disabled=get('no').disabled=!ready||history.length>=40;
      get('trial-setting').disabled=!ready;get('undo').disabled=!history.length;
      get('utility-explanation').textContent=settings.objective==='limit'?'Expected information about the shared limit, in bits. A two-specimen plan averages the best second test over the first reading.':'Expected reduction in Brier risk at '+oxygenText(settings.target)+'. A larger reduction makes the selected burn easier to classify.';
      displayHistory();
      if(!ready){
        const unclear=model?.conflict?'These outcomes conflict under a zero-error threshold. Undo a trial or allow reading error to examine both observations.':'Complete the design constraints to recalculate this scenario.';
        get('pick').textContent=unclear;get('metrics').textContent='No current estimate.';get('predict').textContent='';get('tree').replaceChildren();get('burn-values').replaceChildren();get('ranking').replaceChildren();get('trial-setting').replaceChildren();renderRequest();emitResult();return;
      }
      const summary=model.summary;
      get('metrics').innerHTML='<div><span>Median limit</span><b>'+number(summary.median,2)+'<small>% O₂</small></b></div><div><span>Central 80% interval</span><b>'+number(summary.interval80[0],2)+'–'+number(summary.interval80[1],2)+'<small>%</small></b></div>';
      densityPlot(get('density'),model,settings);
      const best=model.best;
      get('pick').innerHTML=best?'<div class="dl-next">'+number(best.oxygen)+'<small>% O₂</small></div><p>'+utility(best.total)+' '+units()+' expected across '+(settings.horizon===2?'two specimens':'one specimen')+'.</p>':'<p>Reachable settings offer negligible information for this objective. Widen the reachable range or choose a different target.</p>';
      get('tree').innerHTML=best?'<div class="dl-branches">'+['yes','no'].map(r=>{
        const b=best.branches[r];const label=r==='yes'?'If spread sustains':'If spread stops';
        if(!b)return '<div><strong>'+label+'</strong><p>Zero probability in this scenario.</p></div>';
        const follow=settings.horizon===2?(b.oxygen===null?'No informative second setting':'Next test at '+oxygenText(b.oxygen)):'Median limit '+oxygenText(b.summary.median);
        return '<div><strong>'+label+'</strong><span>'+percent(b.chance)+' of readings</span><b>'+follow+'</b></div>';
      }).join('')+'</div>':'';
      get('trial-setting').innerHTML=selectOptions(model.choices.map(c=>[c.oxygen,oxygenText(c.oxygen)+(c===best?' · recommended':'')]));
      const nextSelected=pickRecommended||!model.choices.some(r=>r.oxygen===selected)?best?.oxygen??model.choices[0].oxygen:selected;
      choose(nextSelected);renderRequest();emitResult();
      get('burn-values').innerHTML='<table><thead><tr><th>Burn / O₂</th><th>Prior</th><th>Updated</th></tr></thead><tbody>'+model.forecasts.map((b,i)=>'<tr><th>'+ (i+1)+' · '+oxygenText(b.oxygen)+'</th><td>'+percent(b.prior)+'</td><td><b>'+percent(b.posterior)+'</b></td></tr>').join('')+'</tbody></table>';
      const ranked=model.choices.slice().sort((a,b)=>b.total-a.total||b.utility-a.utility||a.oxygen-b.oxygen);
      const highest=ranked[0].total;
      get('ranking').innerHTML='<table><thead><tr><th>Test O₂</th><th>First test</th>'+(settings.horizon===2?'<th>Adaptive pair</th>':'')+'<th>Relative gain</th></tr></thead><tbody>'+
        ranked.map(r=>'<tr><th>'+oxygenText(r.oxygen)+'</th><td>'+utility(r.utility)+'</td>'+(settings.horizon===2?'<td>'+utility(r.total)+'</td>':'')+'<td><meter aria-label="Relative expected gain at '+r.oxygen+' percent oxygen" min="0" max="'+(highest||1)+'" value="'+r.total+'"></meter></td></tr>').join('')+'</tbody></table>';
    }
    function setResult(result) {
      if(!model||model.conflict||!model.choices.some(r=>r.oxygen===selected)||history.length>=40)return;
      const last=selected;history.push({oxygen:last,result});clearReadout();redraw(true);save();
      message.textContent='Added hypothetical trial '+history.length+' at '+oxygenText(last)+'.';
    }
    for(const f of fields){
      f.addEventListener(f.tagName==='SELECT'?'change':'input',()=>{
        const k=f.dataset.dl;settings[k]=k==='objective'?f.value:(f.value===''?NaN:Number(f.value));
        redraw(true);save();
      });
    }
    get('trial-setting').onchange=e=>{choose(Number(e.target.value));renderRequest();emitResult();save();};
    for(const field of requestControls) {
      field.addEventListener(field.tagName==='SELECT'?'change':'input',()=>{
        const key=field.dataset.request;
        if(key==='disposition'&&field.value!==request.disposition) {
          request.extinctionOxygen='';request.receipt='';
        }
        request[key]=field.value;
        if(key==='disposition')fillRequest();
        renderRequest();emitResult();save();
      });
    }
    get('yes').onclick=()=>setResult('yes');get('no').onclick=()=>setResult('no');
    get('undo').onclick=()=>{history.pop();clearReadout();redraw(true);save();message.textContent='Last hypothetical trial removed.';};
    get('reset').onclick=()=>{settings={...defaultSettings};history=[];request=requestInputs();selected=null;fillControls();fillRequest();redraw(true);save();message.textContent='Default design restored.';};
    get('export').onclick=()=>{
      if(!model)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify(scenarioRecord(settings,history,model,selected,request),null,2)+'\n'],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='first-fire-fm2-design.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    };
    const file=get('file');get('import').onclick=()=>file.click();
    file.onchange=async()=>{
      const chosen=file.files[0];file.value='';if(!chosen)return;
      try{
        if(chosen.size>500000)throw Error('Choose a design record under 500 KB.');
        const data=importRecord(JSON.parse(await chosen.text()));
        if(!root.contains(message))return;
        settings=data.settings;history=data.history;request=data.request;selected=data.selected;fillControls();fillRequest();redraw(false);save();message.textContent='Design imported and recalculated.';
      }catch(e){message.textContent=e instanceof SyntaxError?'The selected file does not contain valid JSON.':e.message;}
    };
    fillControls();fillRequest();redraw(false);message.textContent=initialMessage;
    if(document.fonts?.ready)document.fonts.ready.then(()=>{if(root.contains(message)&&model&&!model.conflict)densityPlot(get('density'),model,settings);});
  }
  window.FFDesignLab={render,...numeric};
})();
