// Reconstruct two exposure groups from pre-ignition FLEX measurements, then read their outcomes.
(() => {
  'use strict';
  const accession = 'PSI-69';
  const sourceReport = 'https://ntrs.nasa.gov/citations/20150023456';
  const defaults = Object.freeze({
    exposure:'oxygen', fuel:'Methanol', low:15, high:21, held:14.7, gravity:0,
    diameter:0.35, pressure:0.5, oxygen:0.25, co2:0, helium:0, sameDay:false
  });
  const finite = value => value != null && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const fmt = (value, digits=2) => Number.isFinite(value) ? Number(value.toFixed(digits)).toString() : 'Unreported';
  const signed = (value,digits=2) => (value>0?'+':'')+fmt(value,digits);
  const units = {oxygen:'% O₂',pressure:'psia'};
  const heldVariable = exposure => exposure==='oxygen' ? 'pressure' : 'oxygen';
  const mean = xs => xs.reduce((a,b)=>a+b,0)/xs.length;
  const near = (a,b,width) => Math.abs(a-b)<=width+1e-8;
  const testDate = x => {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(x||'');
    if(!match) return '';
    return [match[3].padStart(4,'20'), match[1].padStart(2,'0'), match[2].padStart(2,'0')].join('-');
  };
  function checked(p) {
    if(!['oxygen','pressure'].includes(p.exposure) || !['Heptane','Methanol'].includes(p.fuel)) throw Error('Choose a listed exposure and fuel.');
    const bounds={low:[0,100],high:[0,100],held:[0,100],pressure:[0.01,5],oxygen:[0.01,5],diameter:[0.01,3],co2:[0,100],helium:[0,100]};
    for(const [key,[min,max]] of Object.entries(bounds)){
      if(!Number.isFinite(p[key]) || p[key]<min || p[key]>max) throw Error('Check the allowed range for '+key+'.');
    }
    if(![0,0.165,0.38].includes(p.gravity)) throw Error('Choose a listed gravity setting.');
    if(p.high<=p.low) throw Error('Setting B must exceed setting A.');
    if(p.high-p.low<=2*p[p.exposure]+1e-8) throw Error('The two exposure windows overlap. Separate the settings or reduce their tolerance.');
    if((p.exposure==='pressure' && p.low<=0)||(p.exposure==='oxygen' && p.held<=0)) throw Error('Absolute pressure must be positive.');
    const richest=p.exposure==='oxygen'?p.high:p.held;
    if(richest+p.co2+p.helium>100+1e-8) throw Error('Oxygen, carbon dioxide and helium exceed 100% together.');
  }
  function prepare(rows) {
    const source=rows.filter(r=>r.accession===accession);
    const counts=new Map();
    for(const r of source) counts.set(r.instrument_id,(counts.get(r.instrument_id)||0)+1);
    return source.map(r=>({
      row:r,id:r.record_id,test:r.test_id,run:r.instrument_id,day:testDate(r.test_date),
      unique:Boolean(r.instrument_id) && counts.get(r.instrument_id)===1,
      fuel:r.material, gravity:finite(r.gravity_g), oxygen:finite(r.o2_initial_pct),
      pressure:finite(r.pressure_psia), diameter:finite(r.initial_diameter_mm),
      n2:finite(r.nitrogen_initial_pct), co2:finite(r.co2_initial_pct), helium:finite(r.helium_initial_pct)
    })).sort((a,b)=>Number(a.row.source_row)-Number(b.row.source_row));
  }
  function cohorts(records,p) {
    checked(p);
    const low=[],high=[],counts={}; const held=heldVariable(p.exposure);
    let eligible=records.filter(x=>x.fuel===p.fuel);
    counts.fuel=eligible.length;
    eligible=eligible.filter(x=>x.gravity!==null && near(x.gravity,p.gravity,0.005));
    counts.gravity=eligible.length;
    eligible=eligible.filter(x=>x.unique && x.day && x.oxygen!==null && x.pressure!==null && x.pressure>0 && x.diameter!==null && x.diameter>0 &&
      x.n2!==null && x.co2!==null && x.helium!==null && [x.oxygen,x.n2,x.co2,x.helium].every(v=>v>=0 && v<=100));
    counts.measured=eligible.length;
    // N2 is the balance when O2 is varied. Preserve the printed mixture.
    eligible=eligible.filter(x=>near(x.oxygen+x.n2+x.co2+x.helium,100,0.5) && near(x.co2,p.co2,0.01) && near(x.helium,p.helium,0.01));
    counts.mixture=eligible.length;
    eligible=eligible.filter(x=>near(x[held],p.held,p[held]));
    counts.held=eligible.length;
    for(const x of eligible){
      if(near(x[p.exposure],p.low,p[p.exposure])) low.push(x);
      if(near(x[p.exposure],p.high,p[p.exposure])) high.push(x);
    }
    return {low,high,counts};
  }

  // Unit-capacity minimum-cost maximum flow. A residual back-edge lets a later run
  // replace an earlier match, including when greedy nearest-neighbour loses coverage.
  function assign(low,high,edgeCost) {
    const end=low.length+high.length+1, graph=Array.from({length:end+1},()=>[]);
    function add(a,b,cost) {
      const forward={to:b,cap:1,cost,rev:graph[b].length};
      const reverse={to:a,cap:0,cost:-cost,rev:graph[a].length};
      graph[a].push(forward);graph[b].push(reverse);return forward;
    }
    low.forEach((_,i)=>add(0,i+1,0));
    high.forEach((_,j)=>add(1+low.length+j,end,0));
    const allowed=[];
    low.forEach((a,i)=>high.forEach((b,j)=>{
      const cost=edgeCost(a,b);
      if(cost!==null) allowed.push({a,b,cost,edge:add(i+1,1+low.length+j,cost)});
    }));
    while(true){
      const distance=Array(end+1).fill(Infinity), previous=Array(end+1);
      distance[0]=0;
      for(let pass=0;pass<end;pass++){
        let changed=false;
        for(let u=0;u<end;u++){
          if(!Number.isFinite(distance[u])) continue;
          graph[u].forEach((edge,k)=>{
            if(edge.cap && distance[u]+edge.cost<distance[edge.to]-1e-12){
              distance[edge.to]=distance[u]+edge.cost;previous[edge.to]=[u,k];changed=true;
            }
          });
        }
        if(!changed) break;
      }
      if(!previous[end]) break;
      for(let v=end;v!==0;){
        const [u,k]=previous[v],edge=graph[u][k];
        edge.cap=0;graph[v][edge.rev].cap=1;v=u;
      }
    }
    return {edges:allowed.length,pairs:allowed.filter(x=>!x.edge.cap).map(({a,b,cost})=>({a,b,cost}))};
  }
  function match(records,p) {
    const groups=cohorts(records,p),held=heldVariable(p.exposure);
    const result=assign(groups.low,groups.high,(a,b)=>{
      const diameter=Math.abs(a.diameter-b.diameter),heldDelta=Math.abs(a[held]-b[held]);
      if(diameter>p.diameter+1e-8 || heldDelta>p[held]+1e-8 || (p.sameDay && a.day!==b.day)) return null;
      return diameter/p.diameter+heldDelta/p[held];
    });
    return {...groups,...result};
  }
  const outcomes = {
    time:{name:'Reported burn time',unit:'s',key:'burn_time_s'},
    diameter:{name:'Diameter at visible extinction',unit:'mm',key:'visible_extinction_diameter_mm'}
  };
  function endpoint(x,kind) {
    if(kind==='diameter' && x.row.outcome!=='Extinction') return null;
    return finite(x.row[outcomes[kind].key]);
  }
  function measure(pairs,kind) {
    const deltas=pairs.map(({a,b})=>{
      const x=endpoint(a,kind),y=endpoint(b,kind);
      return x!==null && y!==null ? y-x : null;
    });
    const xs=deltas.filter(x=>x!==null);
    return {deltas,n:xs.length,average:xs.length?mean(xs):null,sameEnd:pairs.filter(({a,b})=>a.row.outcome===b.row.outcome).length};
  }
  function byDate(records,p,kind) {
    const groups=cohorts(records,p);
    const days=[...new Set([...groups.low,...groups.high].map(x=>x.day))].sort();
    return days.map(day=>{
      const pairs=match(records.filter(x=>x.day!==day),p).pairs;
      const {n,average}=measure(pairs,kind);
      return {omitted_day:day,pairs:pairs.length,usable_endpoint_pairs:n,mean_difference:average};
    });
  }
  function changes(records,p) {
    const variants=[
      ['Halve diameter tolerance',{diameter:Math.max(0.01,p.diameter/2)}],
      ['Halve pressure tolerance',{pressure:Math.max(0.01,p.pressure/2)}],
      ['Halve oxygen tolerance',{oxygen:Math.max(0.01,p.oxygen/2)}],
      [p.sameDay?'Allow different test days':'Require the same test day',{sameDay:!p.sameDay}],
      [p.gravity===0?'Change to lunar gravity':'Change to orbital gravity',{gravity:p.gravity===0?0.165:0}]
    ];
    return variants.map(([label,delta])=>({label,settings:delta,pairs:match(records,{...p,...delta}).pairs.length}));
  }
  function diameterSensitivity(records,protocol,kind,unmasked) {
    const source = run => ({id:run.id,test:run.test,row:Number(run.row.source_row)});
    const rows = [];
    for (const diameter of [0.05,0.10,0.20,0.35,0.70]) {
      for (const sameDay of [false,true]) {
        const {pairs} = match(records,{...protocol,diameter,sameDay});
        const cell = {diameter_mm:diameter,same_day:sameDay,matched_pairs:pairs.length,
          sources:pairs.map(({a,b})=>({A:source(a),B:source(b)}))};
        if (unmasked) {
          const {n,average} = measure(pairs,kind);
          cell.usable_endpoint_pairs=n;
          cell.mean_b_minus_a=average;
        }
        rows.push(cell);
      }
    }
    return rows;
  }
  function sensitivityLink(protocol,kind,unmasked) {
    const query=new URLSearchParams({...protocol,view:'sensitivity',endpoint:kind});
    if(unmasked)query.set('reveal','1');
    return '#transfer-lab?'+query;
  }
  function followUp(result,p) {
    const {counts,low,high,pairs}=result,held=heldVariable(p.exposure);
    if(!counts.gravity)return 'All FLEX records in this archive are orbital. Run the same fuel and gas mixture at the selected gravity in both exposure groups. Measure initial droplet diameter and the termination category for each burn.';
    if(!counts.mixture)return 'Obtain complete pre-ignition gas composition for this fuel and diluent choice. Record oxygen, nitrogen, carbon dioxide and helium in each run before comparing the two settings.';
    if(!low.length||!high.length)return 'Collect runs at '+(!low.length&&!high.length?'both requested settings':!low.length?'setting A':'setting B')+', keeping '+held+' near '+fmt(p.held)+' '+units[held]+'. Use the same initial diameter and diluent fractions in both groups.';
    if(!pairs.length)return 'Both exposure bands contain flights, but their recorded controls do not overlap within the chosen limits. Repeat the two settings with matched initial diameter and '+held+(p.sameDay?' on the same test day.':'.');
    return 'Repeat both settings on fresh '+p.fuel.toLowerCase()+' droplets with the same initial diameter, diluent and '+held+'. Alternate the exposure order within each test day and record both the duration and how the burn ended.';
  }
  const protocolMethod='Within PSI-69, require fuel and nominal gravity, complete run identity, day, size, pressure and initial O₂/N₂/CO₂/He; exclude duplicated instrument IDs and gas totals outside 100 ±0.5 percentage points. Hold CO₂ and He within 0.01 point of the request. Filter both exposure arms and the held variable before reading outcomes. Maximize disjoint pairs, then minimize total |Δdiameter| / diameter tolerance + |Δheld| / held-variable tolerance. Bounds include their endpoints. Ties follow original source-row order.';
  function receipt(x,study) {
    const table=study.tables.find(t=>t.file===x.row.source_file);
    return {id:x.id,source_row:Number(x.row.source_row),test:x.test,instrument:x.run,date:x.day,accession,
      study_version:study.version,table_sha256:table.sha256,source_file:table.file,table_url:table.url,doi:study.doi,
      fuel:x.fuel,gravity_g:x.gravity,ambient_oxygen_pct:x.oxygen,nitrogen_pct:x.n2,co2_pct:x.co2,helium_pct:x.helium,
      pressure_psia:x.pressure,source_pressure:x.row.reported_pressure,source_pressure_unit:x.row.reported_pressure_unit,initial_diameter_mm:x.diameter};
  }
  function exportRecord(records,study,p,result,kind,unmasked){
    const record={format:'FIRST-FIRE-FLEX-match-v1',created_utc:new Date().toISOString(),settings:{...p},method:protocolMethod,
      source:{doi:study.doi,url:study.url,report:sourceReport},filters:{...result.counts,A:result.low.length,B:result.high.length,eligible_links:result.edges},
      pairs:result.pairs.map(({a,b,cost})=>({A:receipt(a,study),B:receipt(b,study),control_distance:cost})),
      sensitivity:changes(records,p),next_measurement:followUp(result,p),outcomes_revealed:unmasked};
    if(unmasked){
      record.endpoint=outcomes[kind];record.observed=measure(result.pairs,kind);
      record.day_sensitivity=byDate(records,p,kind);
      result.pairs.forEach(({a,b},i)=>{for(const [arm,x] of [['A',a],['B',b]]) record.pairs[i][arm].observed={ending:x.row.outcome,burn_time_s:finite(x.row.burn_time_s),visible_extinction_diameter_mm:finite(x.row.visible_extinction_diameter_mm)};});
    }
    return record;
  }
  function settingsFrom(params) {
    const p={...defaults};
    for(const key of Object.keys(p)){
      if(!params.has(key))continue;
      const text=params.get(key);
      p[key]=typeof p[key]==='number'?finite(text):key==='sameDay'?text==='true':text;
    }
    try{checked(p);return p;}catch{return {...defaults};}
  }
  const E=(tag,text,cls)=>{
    const el=document.createElement(tag);if(text!=null) el.textContent=text;if(cls) el.className=cls;return el;
  };
  function link(label,href,cls) {
    const a=E('a',label,cls);a.href=href;
    if(href.startsWith('https://')){a.target='_blank';a.rel='noopener noreferrer';}return a;
  }
  function button(text,action,cls='ghost'){
    const b=E('button',text,cls);b.type='button';b.onclick=action;return b;
  }
  const oxygenPresets = {exposure:'oxygen',low:15,high:21,held:14.7};
  const pressurePresets = {exposure:'pressure',low:10.4,high:14.7,held:30};
  function render(root,params=new URLSearchParams()) {
    const data=window.FF,study=data.investigations.find(s=>s.accession===accession);
    const records=prepare(data.tests);
    const showSweep=params.get('view')==='sensitivity';
    let p=settingsFrom(params),selected=0,unmasked=showSweep && params.get('reveal')==='1',kind='time';
    if(showSweep && Object.hasOwn(outcomes,params.get('endpoint')))kind=params.get('endpoint');
    const saved=window.FFResearchSession?.active?.()
      ?window.FFResearchSession.previous('transfer-lab')?.record
      :window.FFAwareness?.previous?.('transfer-lab');
    if(!showSweep && saved?.settings && !Object.keys(defaults).some(key=>params.has(key))) {
      try {
        const restored=Object.fromEntries(Object.keys(defaults).map(key=>[key,saved.settings[key]]));
        checked(restored);
        if(typeof restored.sameDay==='boolean'){
          p=restored;
          unmasked=saved.outcomes_revealed===true;
          if(Object.hasOwn(outcomes,saved.endpoint))kind=saved.endpoint;
        }
      }catch{/* A prior session may have used a different protocol version. */}
    }
    let result=match(records,p);
    const panel=E('div',null,'tl-page');
    const crumb=E('div',null,'breadcrumb');crumb.append(link('Research desk','#home'),E('span','/'),'Comparison');
    const head=E('header',null,'tl-title');head.append(E('h1','Transfer Lab'),E('p','Build a matched comparison from NASA’s FLEX droplet burns. Set the conditions first, then inspect how each pair ended.'));
    const bench=E('div',null,'tl-bench'),side=E('section',null,'tl-protocol'),workspace=E('div',null,'tl-work');
    const sideTitle=E('h2','Matching protocol');
    const form=E('form',null,'tl-form'),fields={};form.noValidate=true;
    const title=(s)=>E('h2',s);
    function field(key,label,options) {
      const l=E('label',null,'tl-field'),name=E('span',label);l.append(name);let c;
      if(options){c=E('select');for(const [value,text] of options){const o=E('option',text);o.value=value;c.append(o);}}
      else{c=E('input');c.type='number';c.step='any';}
      c.name=key;c.required=true;l.append(c);fields[key]={c,name};return l;
    }
    const exposure=field('exposure','Variable to change',[['oxygen','Initial chamber oxygen'],['pressure','Absolute pressure']]);
    const values=E('div',null,'tl-two');
    values.append(field('low','Setting A'),field('high','Setting B'));
    const heldField=field('held','Held pressure');
    const fuel=field('fuel','Droplet fuel',[['Methanol','Methanol'],['Heptane','Heptane']]);
    const g=field('gravity','Target gravity',[['0','Orbit · nominal 0 g'],['0.165','Moon · 0.165 g'],['0.38','Mars · 0.38 g']]);
    const extra=E('details',null,'tl-extra');extra.append(E('summary','Tolerances and diluent'));
    const fine=E('div',null,'tl-two');
    fine.append(field('diameter','Diameter gap (mm)'),field('pressure','Pressure tolerance (psia)'),field('oxygen','Oxygen tolerance (points)'),field('co2','CO₂ (%)'),field('helium','He (%)'));
    const day=E('label',null,'tl-check'),box=E('input');box.type='checkbox';box.name='sameDay';fields.sameDay={c:box};
    day.append(box,'Pair only runs from the same UTC date');extra.append(fine,day);
    const msg=E('p',null,'tl-status');msg.setAttribute('role','status');
    const submit=E('button','Apply protocol','btn');submit.type='submit';
    form.append(exposure,values,heldField,fuel,g,extra,submit,msg);
    const source=E('p',null,'tl-source');source.append(link('NASA FLEX · PSI-69','https://doi.org/'+study.doi),' · ',link('Methods and hardware',sourceReport));
    const sweepPanel=E('section',null,'tl-card tl-sweep');
    side.append(sideTitle,form,source);bench.append(side,workspace);panel.append(crumb,head);
    if(showSweep)panel.append(sweepPanel);
    else head.append(link('Compare five droplet-size tolerances',sensitivityLink(p,kind,unmasked),'tl-sweep-entry'));
    panel.append(bench);root.replaceChildren(panel);
    function updateLabels(){
      const oxy=fields.exposure.c.value==='oxygen';
      fields.low.name.textContent='A · '+(oxy?'oxygen (%)':'pressure (psia)');
      fields.high.name.textContent='B · '+(oxy?'oxygen (%)':'pressure (psia)');
      fields.held.name.textContent=oxy?'Held pressure (psia)':'Held chamber oxygen (%)';
    }
    function showInputs() {
      for(const [k,{c}] of Object.entries(fields)){
        if(k==='sameDay')c.checked=p[k];else c.value=String(p[k]);
      }
      updateLabels();
    }
    showInputs();
    fields.exposure.c.addEventListener('change',()=>{
      const next=fields.exposure.c.value==='oxygen'?oxygenPresets:pressurePresets;
      for(const [key,val] of Object.entries(next))fields[key].c.value=val;
      updateLabels();
    });
    form.addEventListener('input',()=>{msg.textContent='Edits pending. Apply to update the comparison.';});
    form.onsubmit=ev=>{
      ev.preventDefault();const proposed={};
      for(const [k,{c}] of Object.entries(fields)){
        proposed[k]=typeof defaults[k]==='number'?finite(c.value):k==='sameDay'?c.checked:c.value;
      }
      try{checked(proposed);}catch(error){msg.textContent=error.message+' The results still show the applied protocol.';return;}
      p=proposed;result=match(records,p);selected=0;unmasked=false;msg.textContent='Protocol applied.';draw();
    };
    function receiptLink(x){return link('FLEX-'+x.test+' · row '+x.row.source_row,'#atlas?record='+encodeURIComponent(x.id));}
    function showSensitivity(cells){
      const h=title('How sensitive is the FLEX comparison?');
      h.tabIndex=-1;
      const unit=outcomes[kind].unit;
      const table=E('table',null,'tl-grid');
      const caption=E('caption',p.fuel+' · '+fmt(p.low)+' vs '+fmt(p.high)+' '+units[p.exposure]+' · '+fmt(p.held)+' '+units[heldVariable(p.exposure)]+' · '+fmt(p.gravity,3)+' g');
      const header=E('thead'),labels=E('tr');
      for(const label of ['Size gap','Any test day','Same UTC date']){
        const th=E('th',label);th.scope='col';labels.append(th);
      }
      header.append(labels);const body=E('tbody');
      for(let i=0;i<cells.length;i+=2){
        const tr=E('tr'),gap=E('th',cells[i].diameter_mm.toFixed(2)+' mm');gap.scope='row';tr.append(gap);
        for(const cell of cells.slice(i,i+2)){
          const n=cell.matched_pairs,td=E('td'),active=p.diameter===cell.diameter_mm && p.sameDay===cell.same_day;
          const pick=button(n+' '+(n===1?'pair':'pairs'),()=>{
            p={...p,diameter:cell.diameter_mm,sameDay:cell.same_day};
            result=match(records,p);selected=0;showInputs();msg.textContent='Selected matrix rule applied.';
            draw();sweepPanel.querySelector('[aria-pressed="true"]').focus({preventScroll:true});
          },'tl-pick');
          pick.setAttribute('aria-pressed',String(active));
          pick.setAttribute('aria-label','Inspect '+pick.textContent+' at '+cell.diameter_mm.toFixed(2)+' mm, '+(cell.same_day?'same UTC date':'any test day'));
          td.append(pick);
          if(unmasked && n){
            td.append(E('strong',cell.usable_endpoint_pairs?signed(cell.mean_b_minus_a)+' '+unit:'Endpoint unavailable','tl-grid-mean'));
            if(cell.usable_endpoint_pairs!==n)td.append(E('span',cell.usable_endpoint_pairs+' of '+n+' with endpoint','tl-grid-note'));
          }
          if(n){
            const sources=E('div',null,'tl-row-links');
            for(const {A,B} of cell.sources){
              const pair=link(A.test+' ↔ '+B.test,'#atlas?'+new URLSearchParams({left:A.id,right:B.id}));
              pair.setAttribute('aria-label','Compare FLEX tests '+A.test+' and '+B.test+', source rows '+A.row+' and '+B.row);sources.append(pair);
            }
            if(n>4){const more=E('details');more.append(E('summary','Open '+n+' run pairs'),sources);td.append(more);}
            else td.append(sources);
          }
          tr.append(td);
        }
        body.append(tr);
      }
      table.append(caption,header,body);
      const note=E('p',unmasked?'Means show the difference in '+outcomes[kind].name.toLowerCase()+' (setting B minus A) among pairs with both measurements. These archived differences cannot establish a causal effect.':'The counts and NASA test IDs use pre-ignition conditions only. Reveal the endpoint to compare the means.');
      const actions=E('div',null,'actions');
      actions.append(button(unmasked?'Mask outcomes':'Reveal outcomes across rules',()=>{
        unmasked=!unmasked;draw();sweepPanel.querySelector('h2').focus({preventScroll:true});
      },'btn'),link('Link to this comparison',sensitivityLink(p,kind,unmasked),'ghost'));
      sweepPanel.replaceChildren(h,E('p','Vary the allowed gap in initial droplet diameter. Select a pair count to apply the rule, or open two test IDs to inspect the NASA rows.'),actions,table,note);
    }
    function draw() {
      workspace.replaceChildren();
      const sweep=showSweep?diameterSensitivity(records,p,kind,unmasked):null;
      if(sweep)showSensitivity(sweep);
      else head.querySelector('.tl-sweep-entry').href=sensitivityLink(p,kind,unmasked);
      const banner=E('section',null,'tl-summary');
      const heading=E('div',null,'tl-heading');
      heading.append(E('span','FLEX · '+p.fuel+' · '+fmt(p.gravity,3)+' g'),title(fmt(p.low)+' → '+fmt(p.high)+' '+units[p.exposure]));
      const sub=E('p','Held at '+fmt(p.held)+' '+units[heldVariable(p.exposure)]+', with '+fmt(p.co2)+'% CO₂ and '+fmt(p.helium)+'% helium. Nitrogen supplies the balance.');
      const metrics=E('div',null,'tl-metrics');
      for(const [n,label] of [[result.low.length,'A runs'],[result.high.length,'B runs'],[result.pairs.length,'matched pairs']]){
        const m=E('div');m.append(E('b',String(n)),E('span',label));metrics.append(m);
      }
      banner.append(heading,sub,metrics);
      const detail=E('details',null,'tl-audit'),sum=E('summary','Inspect eligibility');detail.append(sum);
      const tally=E('dl',null,'tl-counts');
      const countLabels={fuel:'Runs with this fuel',gravity:'At selected gravity',measured:'Complete identity and measurements',mixture:'Requested gas mixture and closure',held:'Held variable within tolerance'};
      for(const [k,n] of Object.entries(result.counts))tally.append(E('dt',countLabels[k]),E('dd',String(n)));
      tally.append(E('dt','Possible pairings inside all tolerances'),E('dd',String(result.edges)));detail.append(tally);
      const card=E('section',null,'tl-card');
      if(result.pairs.length){
        const area=E('div',null,'tl-section-head');
        area.append(title('Matched flight records'));
        const select=E('select');select.setAttribute('aria-label','Inspect matched pair');
        result.pairs.forEach(({a,b},i)=>{const o=E('option','Pair '+(i+1)+' · '+a.test+' / '+b.test);o.value=String(i);select.append(o);});
        select.value=String(selected);select.onchange=()=>{selected=Number(select.value);showPair();};area.append(select);
        const pairBox=E('div');
        function showPair(){
          const {a,b}=result.pairs[selected],table=E('table',null,'tl-pair');
          table.append(E('caption','Matched pre-ignition conditions'));
          const th=E('thead'),hdr=E('tr');for(const label of ['Recorded field','Setting A','Setting B']){const col=E('th',label);col.scope='col';hdr.append(col);}th.append(hdr);table.append(th);
          const tb=E('tbody');
          const detailRows=[
            ['Source',receiptLink(a),receiptLink(b)],['Run ID',a.run,b.run],['UTC date',a.day,b.day],
            ['Chamber O₂ (%)',fmt(a.oxygen),fmt(b.oxygen)],['Pressure (psia)',fmt(a.pressure,3),fmt(b.pressure,3)],
            ['Droplet diameter (mm)',fmt(a.diameter),fmt(b.diameter)],['CO₂ / He / N₂ (%)',[a.co2,a.helium,a.n2].join(' / '),[b.co2,b.helium,b.n2].join(' / ')]
          ];
          if(unmasked)detailRows.push(['Run ending',a.row.outcome,b.row.outcome],[outcomes[kind].name+' ('+outcomes[kind].unit+')',fmt(endpoint(a,kind)),fmt(endpoint(b,kind))]);
          for(const [name,x,y] of detailRows){const tr=E('tr'),col=E('th',name);col.scope='row';tr.append(col);for(const v of [x,y]){const cell=E('td');cell.append(v);tr.append(cell);}tb.append(tr);}
          table.append(tb);pairBox.replaceChildren(table,link('Compare both original rows ↗','#atlas?'+new URLSearchParams({left:a.id,right:b.id})));
        }
        showPair();card.append(area,pairBox);
      }else{
        card.append(title('No matched pairs'),E('p',!result.low.length||!result.high.length?'At least one exposure group has no eligible rows. Inspect the filters below to see the point where coverage ends.':'The runs in the two groups do not meet the pairwise tolerances.'));
      }
      card.append(detail);workspace.append(banner,card);
      if(result.pairs.length){
        const section=E('section',null,'tl-card tl-outcomes');section.append(title('Observed outcomes'));
        const live=E('div');live.tabIndex=-1;
        function showOutcome(){
          live.replaceChildren();
          if(!unmasked){
            live.append(E('p','The matching uses initial conditions. Reveal the recorded endings and burn times for these exact pairs.'),
              button('Reveal outcomes',()=>{unmasked=true;draw();workspace.querySelector('.tl-outcomes h2').focus({preventScroll:true});},'btn'));
          }else{
            const select=E('select');select.setAttribute('aria-label','Measured endpoint');
            for(const [key,ep] of Object.entries(outcomes)){const o=E('option',ep.name+' ('+ep.unit+')');o.value=key;select.append(o);}
            select.value=kind;select.onchange=()=>{kind=select.value;draw();workspace.querySelector('[aria-label="Measured endpoint"]').focus({preventScroll:true});};
            const measured=measure(result.pairs,kind),unit=outcomes[kind].unit;
            live.append(select);
            if(measured.n){
              const value=E('p',null,'tl-value');value.append(E('b',signed(measured.average)+' '+unit),' average B − A');live.append(value);
              live.append(E('p',measured.n+' of '+result.pairs.length+' pairs supply this endpoint on both sides. '+measured.sameEnd+' pairs share the same reported ending.'));
              if(kind==='time')live.append(E('p','Completion, disruption and extinction can end a timed burn. Their mix affects this descriptive difference.'));
              else live.append(E('p','This endpoint uses pairs in which both runs ended in extinction and both diameters were recorded. Subsequent cool-flame combustion may continue.'));
              const graph=E('div',null,'tl-plot');graph.setAttribute('aria-label','Individual pair differences, setting B minus A');
              const max=Math.max(0.01,...measured.deltas.map(x=>Math.abs(x??0)));
              measured.deltas.forEach((delta,i)=>{
                const row=E('div',null,'tl-plot-row'),track=E('span',null,'tl-track');track.setAttribute('aria-hidden','true');
                if(delta!==null){const dot=E('i');dot.style.left=(50+delta/max*47)+'%';track.append(dot);}
                row.append(E('span','Pair '+(i+1)),track,E('strong',delta===null?'No endpoint':signed(delta)+' '+unit));graph.append(row);
              });
              live.append(graph);
              const days=byDate(records,p,kind),usable=days.filter(d=>d.mean_difference!==null);
              const stability=E('details',null,'tl-audit');
              stability.append(E('summary','Remove one test day at a time'));
              if(usable.length){const averages=usable.map(d=>d.mean_difference);stability.append(E('p','After omitting each eligible day and rematching, the mean ranges from '+signed(Math.min(...averages))+' to '+signed(Math.max(...averages))+' '+unit+' across '+usable.length+' of '+days.length+' omissions. This range describes date sensitivity.'));}
              else stability.append(E('p','Removing one date leaves no complete endpoint comparisons.'));
              const dates=E('ul');for(const day of days){dates.append(E('li',day.omitted_day+' · '+day.pairs+' pairs · '+(day.mean_difference===null?'endpoint unavailable':signed(day.mean_difference)+' '+unit)));}stability.append(dates);live.append(stability);
            }else live.append(E('p','No selected pair supplies this endpoint on both sides. The original measurements and endings remain available in the row inspector.'));
          }
        }
        showOutcome();section.querySelector('h2').tabIndex=-1;section.append(live);workspace.append(section);
      }
      const sensitivity=E('section',null,'tl-card'),rows=E('div',null,'tl-sensitivity');sensitivity.append(title('Sensitivity to the protocol'),E('p','Change one constraint at a time and recompute all pairs.'));
      for(const variant of changes(records,p)){
        const line=E('div');line.append(E('span',variant.label),E('strong',variant.pairs+' '+(variant.pairs===1?'pair':'pairs')));rows.append(line);
      }
      sensitivity.append(rows);workspace.append(sensitivity);
      const end=E('section',null,'tl-plan');
      end.append(title('Next measurement'),E('p',followUp(result,p)));
      const methods=E('details',null,'tl-audit');methods.append(E('summary','Read the matching method'),E('p',protocolMethod),E('p','Nominal gravity must agree within 0.005 g. Experimental days may share hardware or operator conditions. These orbital droplet runs cannot establish a causal oxygen response or a lunar fabric forecast.'));
      const actions=E('div',null,'actions');
      actions.append(button('Download study JSON',()=>{
        const payload=exportRecord(records,study,p,result,kind,unmasked);
        if(sweep)payload.diameter_sensitivity=sweep;
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}));
        const a=link('Download',url);a.download='first-fire-FLEX-matched-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
      }), link('Link to this protocol',showSweep?sensitivityLink(p,kind,unmasked):'#transfer-lab?'+new URLSearchParams(p),'ghost'));
      end.append(methods,actions);workspace.append(end);
      const observed=unmasked?measure(result.pairs,kind):null;
      const summary=result.pairs.length+' matched pairs at '+fmt(p.low)+' and '+fmt(p.high)+' '+units[p.exposure]+'. '+
        (observed ? (observed.n?'Average B minus A was '+signed(observed.average)+' '+outcomes[kind].unit+' in '+observed.n+' usable pairs.':'No complete pairs for this endpoint.') : 'Outcomes are masked.');
      document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{
        tool:'transfer-lab',title:'FLEX matched comparisons',summary,
        record:{settings:{...p},outcomes_revealed:unmasked,endpoint:unmasked?kind:null,observed,
          ...(sweep?{diameter_sensitivity:sweep}:{}),
          matched_source_ids:result.pairs.map(({a,b})=>[a.id,b.id]),counts:result.counts,table_sha256:study.tables[0].sha256,
          doi:study.doi,table_url:study.tables[0].url,source_rows_count_header_as_one:true,
          scope:'Orbital FLEX droplets. Controlled archival differences are descriptive. Observation days may share conditions.',next_measurement:followUp(result,p)}
      }}));
    }
    draw();
  }
  window.FFTransferLab={render,prepare,match,assign,measure,byDate,changes,diameterSensitivity,exportRecord,settingsFrom,defaults,checked};
})();
