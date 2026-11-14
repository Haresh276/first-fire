/* Local NASA PSI observation explorer. Numeric fields preserve the source measurement's scope. */
(() => {
  'use strict';
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const num = v => v == null || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
  const fmt = v => num(v) === null ? '—' : Number(v).toLocaleString('en-US', {maximumFractionDigits: 4});
  const button = (label, run, cls = 'btn ghost') => {
    const b = node('button', label, cls); b.type = 'button'; b.onclick = run; return b;
  };
  const link = (label, href, download = false) => {
    const a = node('a', label); a.href = href;
    if (download) a.download = ''; else if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  };
  const asset = path => (window.FF.assetBase || '') + path;
  const join = (el, children) => children.forEach((c, i) => { if (i) el.append(' · '); el.append(c); });
  function control(parent, title, element) {
    const outer = node('label', undefined, 'field'); element.setAttribute('aria-label', title);
    outer.append(node('span', title), element); parent.append(outer);
    return element;
  }
  function select(choices, value) {
    const el = node('select'); choices.forEach(([v, label]) => { const o = node('option', label); o.value = v; el.append(o); });
    el.value = value; return el;
  }
  function input(type, value, extra = {}) {
    const e = node('input'); e.type = type; e.value = value; Object.assign(e, extra); return e;
  }
  function grid() { return node('div', undefined, 'grid2'); }
  function region(parent, heading) {
    const section = node('section', undefined, 'panel stack');
    section.append(node('h3', heading)); parent.append(section); return section;
  }
  function wrapTable(table) {
    const w = node('div'); w.style.overflowX = 'auto'; w.append(table); return w;
  }
  function details(title, open = false) {
    const d = node('details'); d.append(node('summary', title)); d.open = open; return d;
  }
  const phases = [['solid','Solid fuel'],['liquid','Liquid droplet'],['gas','Gas burner'],['aerosol','Smoke aerosol']];
  const scopes = [['ambient','Ambient O₂ at test start or reported range'],['burner','O₂ in burner stream'],['final','Final ambient O₂']];
  function oxygen(r, scope) {
    if (scope === 'ambient') {
      const start = num(r.o2_initial_pct);
      if (start !== null) return [start, start];
      const lo = num(r.o2_low_pct), hi = num(r.o2_high_pct);
      return lo === null || hi === null ? null : [lo, hi];
    }
    const x = num(scope === 'burner' ? r.o2_burner_pct : r.o2_final_pct);
    return x === null ? null : [x, x];
  }
  const rangeText = vals => !vals ? '—' : vals[0] === vals[1] ? fmt(vals[0]) + '%' : fmt(vals[0]) + '–' + fmt(vals[1]) + '%';
  const cmpText = (a, b) => String(a || '').localeCompare(String(b || ''), 'en', {numeric:true});
  function exportRows(rows) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const escape = x => '"' + String(x ?? '').replace(/"/g, '""') + '"';
    const csv = [keys, ...rows.map(r => keys.map(k => r[k]))].map(line => line.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv + '\r\n'], {type:'text/csv;charset=utf-8'}));
    const a = link('Download selection', url, true); a.download = 'first-fire-filtered-observations.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const fieldLabels = {
    accession:'PSI accession',test_id:'Source test ID',record_id:'Snapshot record ID',source_row:'CSV row (header = 1)',
    material:'Material or fuel',phase:'Research subject',gravity_g:'Nominal gravity (g)',gravity_regime:'Gravity regime',
    o2_initial_pct:'Initial ambient O₂ (%)',o2_final_pct:'Final ambient O₂ (%)',o2_burner_pct:'Burner O₂ (%)',
    o2_low_pct:'Ambient range low (%)',o2_high_pct:'Ambient range high (%)',o2_qualifier:'Ambient O₂ definition',
    pressure_psia:'Pressure (psia)',flow_cm_s:'Airflow or smoke inlet (cm/s)',burn_time_s:'Reported burn duration (s)',
    outcome:'Reported endpoint or ignition',quality_notes:'Interpretation notes',observation_type:'Unit of observation',
    instrument_id:'Instrument record ID',fuel_ambient_initial_pct:'Ambient fuel at start (%)',oxygen_flow_mg_s:'O₂ delivery rate (mg/s)',
    hot_ignition:'Hot ignition',termination_code:'Termination code (SE = self-extinguished, FT = flow terminated)',
    initial_diameter_mm:'Initial droplet diameter (mm)',visible_extinction_diameter_mm:'Diameter at visible extinction (mm)',
    direction:'Flow direction or flame configuration',material_detail:'Sample or observation detail',fan_display:'Fan display (native units)',
    air_display:'Air display (native units)',test_date:'Source date',test_time:'Source time (GMT)',nitrogen_initial_pct:'Initial ambient N₂ (%)',
    co2_initial_pct:'Initial ambient CO₂ (%)',helium_initial_pct:'Initial ambient He (%)',smoke_heating_s:'Smoke heating duration (s)',
    smoke_aging_s:'Net smoke aging time (s)',reported_pressure:'Native pressure value',reported_pressure_unit:'Native pressure unit'
  };
  function rawDetails(target, r, inv) {
    target.replaceChildren();
    const heading = node('h3', inv.name + ' · ' + r.test_id);
    heading.tabIndex = -1; target.append(heading);
    const links = node('p');
    join(links, [link('NASA dataset DOI', 'https://doi.org/' + r.doi),link('Original NASA table (local CSV)', asset(r.source_file), true),link('Versioned NASA download', r.source_url)]);
    target.append(links, node('p', 'Source row ' + r.source_row + ' (header = 1) · ' + r.record_id));
    if (r.quality_notes) target.append(node('p', r.quality_notes, 'note'));
    const original = window.FF.rawTables?.[r.source_file] || window.FF.rawTables?.[r.source_file.split('/').pop()];
    const nativeRow = original?.[Number(r.source_row) - 1];
    if (Array.isArray(nativeRow) && Array.isArray(original[0])) {
      const d = details('Original NASA row', true), t = node('table'), body = node('tbody');
      original[0].forEach((name, i) => { const tr = node('tr'), th = node('th', String(name).trim()); th.scope = 'row';
        tr.append(th, node('td', nativeRow[i] || '—')); body.append(tr); });
      t.append(body); d.append(wrapTable(t)); target.append(d);
    }
    const normalized = details('Fields used by FIRST FIRE', !nativeRow), t = node('table'), body = node('tbody');
    for (const [k, label] of Object.entries(fieldLabels)) {
      if (r[k] == null || r[k] === '') continue;
      const line = node('tr'), th = node('th', label); th.scope='row'; line.append(th, node('td', String(r[k]))); body.append(line);
    }
    t.append(body); normalized.append(wrapTable(t)); target.append(normalized);
    heading.focus({preventScroll:true}); target.scrollIntoView({block:'nearest'});
  }

  function explorer(root, params = new URLSearchParams()) {
    const rows = window.FF.tests, studies = window.FF.investigations;
    const byId = new Map(studies.map(s => [s.accession, s]));
    let mode = params.get('mode') === 'rank' ? 'rank' : 'data';
    const initialStudy = byId.has(params.get('study')) ? params.get('study') : '';
    const state = {study:initialStudy,q:params.get('q') || '',phase:'',scope:'ambient',min:'',max:'',sort:'accession',ascending:true,page:0};
    const ranking = {preset:'moon',phase:'solid',g:'0.165',o:'34',p:'8.2',wg:'1',wo:'1',wp:'1',material:''};
    root.replaceChildren();
    const nav = node('div');
    const bData = button('Observations', () => { mode='data'; show(); });
    const bRank = button('Rank for a habitat', () => { mode='rank'; show(); });
    nav.append(bData, ' ', bRank);
    const content = node('div', undefined, 'stack'); root.append(nav, content);
    function show() {
      content.replaceChildren();
      [bData,bRank].forEach((b,i) => { const on = i === (mode==='rank'?1:0); b.className = on?'btn':'btn ghost'; b.setAttribute('aria-pressed',String(on)); });
      if (mode === 'rank') drawRank(); else drawData();
    }
    function catalogue() {
      const d = details('Investigation catalogue (' + studies.length + ')');
      for (const s of studies) {
        const card = details(s.name + ' · ' + s.accession + ' · ' + s.rows + ' normalized records');
        card.append(node('p', s.title + '. ' + s.summary), node('p', s.coverage), node('p', [s.platform,s.hardware].filter(Boolean).join(' · ')));
        const links=node('p');
        join(links, [link('NASA DOI', 'https://doi.org/'+s.doi), ...s.tables.map((t,i)=>link('Raw table '+(i+1),asset(t.file),true))]);
        card.append(links,button('View investigation',()=>{state.study=s.accession;state.page=0;state.q='';state.phase='';state.min='';state.max='';mode='data';show();}));d.append(card);
      }
      return d;
    }
    function drawData() {
      const section = region(content, 'Explore experiment records');
      section.append(node('p', rows.length.toLocaleString()+' observations from '+new Set(rows.map(r=>r.accession)).size+' investigations. The catalogue includes every investigation reviewed.'));
      const controls = grid(); section.append(controls);
      const q = control(controls,'Search ID, material or endpoint',input('search',state.q,{placeholder:'e.g. C03H201 or SIBAL'}));
      const study = control(controls,'Investigation',select([['','All investigations'],...studies.map(s=>[s.accession,s.name+' · '+s.accession])],state.study));
      const phase = control(controls,'Test subject',select([['','All subjects'],...phases],state.phase));
      const scope = control(controls,'Oxygen field',select(scopes,state.scope));
      const min = control(controls,'Minimum O₂ (%)',input('number',state.min,{min:'0',max:'100',step:'any',placeholder:'Any'}));
      const max = control(controls,'Maximum O₂ (%)',input('number',state.max,{min:'0',max:'100',step:'any',placeholder:'Any'}));
      const activeInfo = node('div'), report = node('p'); report.setAttribute('role','status'); report.setAttribute('aria-live','polite');
      const results = node('div'), detail = node('div'), paging=node('div');
      section.append(activeInfo,report,results,paging,detail);
      content.append(catalogue());
      const refresh = () => { Object.assign(state,{q:q.value,study:study.value,phase:phase.value,scope:scope.value,min:min.value,max:max.value,page:0}); table(); };
      [q,min,max].forEach(el=>el.addEventListener('input',refresh)); [study,phase,scope].forEach(el=>el.addEventListener('change',refresh));
      function table() {
        activeInfo.replaceChildren(); detail.replaceChildren(); paging.replaceChildren(); results.replaceChildren();
        const s=byId.get(state.study);
        if(s){const c=node('div',undefined,'note');c.append(node('strong',s.name+' · '+s.title),node('p',s.coverage));
          const links=node('p');join(links,[link('NASA DOI', 'https://doi.org/'+s.doi),...s.tables.map((t,i)=>link('Original table '+(i+1),asset(t.file),true))]); c.append(links);activeInfo.append(c);}
        const lo=num(state.min),hi=num(state.max);
        if (!min.validity.valid || !max.validity.valid || (lo!==null && hi!==null && lo>hi)) { report.textContent='Enter an oxygen interval from 0 to 100%, with minimum no larger than maximum.'; return; }
        const terms=state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const filtered=rows.filter(r=>{
          if((state.study && r.accession!==state.study)||(state.phase && r.phase!==state.phase))return false;
          const o=oxygen(r,state.scope); if((lo!==null||hi!==null)&&(!o||(lo!==null && o[1]<lo)||(hi!==null && o[0]>hi)))return false;
          const searchable=[r.record_id,r.accession,byId.get(r.accession)?.name,r.test_id,r.instrument_id,r.material,r.phase,r.outcome,r.direction].join(' ').toLowerCase();
          return terms.every(x=>searchable.includes(x));
        });
        const sortVal=(r,k)=>k==='oxygen'?oxygen(r,state.scope)?.[0]??null:k==='pressure_psia'?num(r[k]):r[k];
        filtered.sort((a,b)=>{const av=sortVal(a,state.sort),bv=sortVal(b,state.sort);
          if(av==null||bv==null)return av==null&&bv==null?cmpText(a.record_id,b.record_id):av==null?1:-1;
          const diff=typeof av==='number'&&typeof bv==='number'?av-bv:cmpText(av,bv);return diff*(state.ascending?1:-1)||cmpText(a.record_id,b.record_id);});
        const pages=Math.max(1,Math.ceil(filtered.length/15));state.page=Math.min(state.page,pages-1);
        report.textContent=filtered.length.toLocaleString()+' matching records'+(filtered.length?' · page '+(state.page+1)+' of '+pages:'')+'.';
        if(!filtered.length){results.append(node('p',s && !s.rows ? s.coverage : 'No observations meet these filters.')); return;}
        const t=node('table'),head=node('thead'),hr=node('tr'),body=node('tbody');
        const cols=[['accession','Investigation'],['test_id','Test / run'],['material','Material'],['oxygen','O₂ (%)'],['pressure_psia','psia'],['phase','Subject']];
        cols.forEach(([key,label])=>{const th=node('th');th.scope='col';if(key===state.sort)th.setAttribute('aria-sort',state.ascending?'ascending':'descending');
          const b=button(label+(key===state.sort?(state.ascending?' ↑':' ↓'):''),()=>{state.ascending=state.sort===key?!state.ascending:true;state.sort=key;state.page=0;table();},'');
          b.style.cssText='font:inherit;color:inherit;background:none;border:0;padding:0;text-align:left;cursor:pointer';th.append(b);hr.append(th);});head.append(hr);t.append(head);
        filtered.slice(state.page*15,(state.page+1)*15).forEach(r=>{
          const tr=node('tr'),id=node('td'),b=button(r.test_id,()=>rawDetails(detail,r,byId.get(r.accession)),'');
          b.setAttribute('aria-label','Open '+r.accession+' '+r.test_id+' source row '+r.source_row);id.append(b);
          tr.append(node('td',byId.get(r.accession).name),id,node('td',r.material||'Unreported'),node('td',rangeText(oxygen(r,state.scope))),
            node('td',fmt(r.pressure_psia)),node('td',r.phase));body.append(tr);});
        t.append(body);results.append(wrapTable(t));
        const prev=button('Previous',()=>{state.page--;table();}),next=button('Next',()=>{state.page++;table();});
        prev.disabled=state.page===0;next.disabled=state.page>=pages-1;
        paging.append(prev,' ',next,' ',button('Export filtered CSV',()=>exportRows(filtered)));
      }
      table();
    }
    function drawRank() {
      const controls=region(content,'Rank evidence for a habitat');
      controls.append(node('p','Find the closest recorded conditions for a test subject. Each investigation is represented by its closest eligible observation.'));
      const form=grid(); controls.append(form);
      const presets={
        moon:['Lunar habitat','0.165','34','8.2'],
        mars:['Mars surface · illustrative atmosphere','0.38','34','8.2'],
        orbit:['Orbit · Earth-like cabin','0','21','14.7'],
        earth:['Earth reference','1','21','14.7'],
        custom:['Custom conditions']
      };
      const preset=control(form,'Scenario',select(Object.entries(presets).map(([k,v])=>[k,v[0]]),ranking.preset));
      const phase=control(form,'Required test subject',select(phases,ranking.phase));
      const g=control(form,'Gravity (Earth g)',input('number',ranking.g,{min:'0',max:'3',step:'any'}));
      const o=control(form,'Ambient oxygen (%)',input('number',ranking.o,{min:'0',max:'100',step:'any'}));
      const p=control(form,'Absolute pressure (psia)',input('number',ranking.p,{min:'0.01',max:'100',step:'any'}));
      const material=control(form,'Required material text (optional)',input('search',ranking.material,{placeholder:'e.g. SIBAL'}));
      const advanced=details('Weights and distance calculation');controls.append(advanced);
      advanced.append(node('p','Each difference is divided by a chosen comparison step: 0.165 g, 5 oxygen percentage points or 2 psia. The distance is the square root of the weighted mean of squared differences over available fields. An oxygen interval contributes zero distance when it contains the target. These scales express a ranking preference.'));
      const weights=grid(); advanced.append(weights);
      const weightOpts=[['0.5','½×'],['1','1×'],['2','2×'],['4','4×']];
      const wg=control(weights,'Gravity weight',select(weightOpts,ranking.wg));
      const wo=control(weights,'Oxygen weight',select(weightOpts,ranking.wo));
      const wp=control(weights,'Pressure weight',select(weightOpts,ranking.wp));
      const report=node('p');report.setAttribute('aria-live','polite');
      const ranks=node('div'),sensitivity=node('div'),detail=node('div');controls.append(report,ranks,sensitivity,detail);
      const save=()=>Object.assign(ranking,{preset:preset.value,phase:phase.value,g:g.value,o:o.value,p:p.value,
        wg:wg.value,wo:wo.value,wp:wp.value,material:material.value});
      preset.onchange=()=>{const v=presets[preset.value];if(v.length>1){g.value=v[1];o.value=v[2];p.value=v[3];}save();draw();};
      [g,o,p].forEach(e=>e.addEventListener('input',()=>{preset.value='custom';save();draw();}));
      material.oninput=()=>{save();draw();};
      [phase,wg,wo,wp].forEach(e=>e.onchange=()=>{save();draw();});
      function draw() {
        detail.replaceChildren();ranks.replaceChildren();sensitivity.replaceChildren();
        if([g,o,p].some(e=>num(e.value)===null||!e.validity.valid)){report.textContent='Enter valid gravity, oxygen and positive absolute pressure.';return;}
        const target=[Number(g.value),Number(o.value),Number(p.value)], w=[Number(wg.value),Number(wo.value),Number(wp.value)];
        const mat=material.value.trim().toLowerCase();
        const phaseRows=rows.filter(r=>r.phase===phase.value && (!mat||r.material.toLowerCase().includes(mat)));
        // Inverse CFI-G reports burner oxygen. A supporting pressure value alone cannot turn it into a cabin test.
        const eligible=phaseRows.filter(r=>!(r.phase==='gas' && r.direction==='inverse'));
        const excluded=phaseRows.length-eligible.length;
        report.textContent=eligible.length.toLocaleString()+' eligible observations. '+
          (excluded?excluded+' inverse burner observations excluded from atmospheric ranking. ':'')+
          'Complete conditions rank first, followed by coverage of two and then one of the three fields. Every ranked gravity value is nominal orbital microgravity.';
        const calc=(weights)=>{
          const best=new Map();
          eligible.forEach(r=>{
            const oxy=oxygen(r,'ambient'), grav=num(r.gravity_g),press=num(r.pressure_psia);
            const terms=[grav===null?null:Math.abs(grav-target[0])/0.165,
                         oxy===null?null:Math.max(oxy[0]-target[1],target[1]-oxy[1],0)/5,
                         press===null?null:Math.abs(press-target[2])/2];
            let sum=0,weightSum=0,known=0;
            terms.forEach((v,i)=>{if(v!==null){sum+=weights[i]*v*v;weightSum+=weights[i];known++;}});
            if(!known)return;
            const candidate={r,known,score:Math.sqrt(sum/weightSum),terms};
            if(!best.has(r.accession)||compare(candidate,best.get(r.accession))<0)best.set(r.accession,candidate);
          });
          return [...best.values()].sort(compare);
        };
        function compare(a,b){return b.known-a.known || a.score-b.score || cmpText(a.r.record_id,b.r.record_id);}
        const list=calc(w);
        if(!list.length){ranks.append(node('p','No eligible records. Try another material or test subject.'));return;}
        const t=node('table'),thead=node('thead'),tr=node('tr');['Rank','Closest source row','Recorded material','Gravity · ambient O₂ · pressure','Coverage','Distance'].forEach(v=>{const th=node('th',v);th.scope='col';tr.append(th);});thead.append(tr);t.append(thead);
        const tbody=node('tbody');
        list.forEach((c,i)=>{
          const r=c.r,row=node('tr'),td=node('td'),b=button(byId.get(r.accession).name+' · '+r.test_id,()=>rawDetails(detail,r,byId.get(r.accession)),'');
          td.append(b);
          const vals=[fmt(r.gravity_g)+' g',rangeText(oxygen(r,'ambient')),num(r.pressure_psia)===null?'—':fmt(r.pressure_psia)+' psia'].join(' · ');
          const missing=c.terms.map((v,j)=>v===null?['gravity','oxygen','pressure'][j]:null).filter(Boolean);
          row.append(node('td',i+1),td,node('td',r.material||'Unreported'),node('td',vals),
            node('td',c.known+'/3'+(missing.length?' · missing '+missing.join(', '):'')),node('td',c.score.toFixed(3)));tbody.append(row);
        });t.append(tbody);ranks.append(wrapTable(t));
        const base=list.slice(0,3).map(c=>c.r.accession);
        const changes=['gravity','oxygen','pressure'].map((name,axis)=>{
          const varied=w.map((value,j)=>j===axis?2*value:value);const variant=calc(varied).slice(0,3).map(c=>c.r.accession);
          return 'Double '+name+' weight: '+(variant.join('|')===base.join('|')?'same order':variant.map(k=>byId.get(k).name).join(' → '));
        });
        const d=details('Sensitivity of the first '+base.length+' ranks',true);d.append(node('p',changes.join('. ')+'.'),
          node('p','Ranks use the selected material or phase and available conditions. Sample size, orientation, ventilation and the definition of the measured endpoint require review before transferring a finding.'));
        sensitivity.append(d);
      }
      draw();
    }
    show();
  }
  window.renderExplorer=explorer;
})();
