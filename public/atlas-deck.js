// Browse the source table index without counting grouped settings as individual burn observations.
(() => {
  'use strict';

  const accessions = new Set([107,159,69,25,26,101,39,22,20,99,106,68,102,98,100].map(n => 'PSI-'+n));
  const integer = n => n.toLocaleString('en-US');
  const e = (tag, text, cls) => {
    const el = document.createElement(tag);
    if (text != null) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const makeLink = (text, href, cls) => {
    const a = e('a', text, cls); a.href = href;
    if (href.startsWith('https://')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  };
  const action = (text, click, cls='ghost') => {
    const b = e('button',text,cls); b.type='button'; b.onclick=click; return b;
  };
  const linkStudy = (route,id) => '#'+route+'?study='+encodeURIComponent(id);
  const asset = path => (window.FF.assetBase || '')+path;
  const select = (items, selected='') => {
    const result=e('select');
    for (const [value,text] of items) { const opt=e('option',text); opt.value=value; result.append(opt); }
    result.value=selected;
    return result;
  };
  const field = (title,control) => {
    const label=e('label',null,'field');
    control.setAttribute('aria-label',title);
    label.append(e('span',title),control);
    return label;
  };
  const rowKind = (id, cells, observation) => {
    if (observation) return observation.observation_type === 'smoke observation' ? 'Smoke observation' : 'Normalized test record';
    switch (id) {
      case 'PSI-26': return 'Maintenance';
      case 'PSI-39': return 'Repeated source record';
      case 'PSI-98':
      case 'PSI-99': return /^note\s/i.test(cells[0]) ? 'Table note' : 'Flow or camera record';
      case 'PSI-107': return 'Burner setting';
      case 'PSI-68': return 'Candidate conditions';
      case 'PSI-102': return 'Material settings';
      case 'PSI-22': return cells[1].trim() ? 'Test-day summary' : 'Continuation of settings';
      default: return 'Test-day summary';
    }
  };
  const number = value => value == null || String(value).trim()==='' || !Number.isFinite(Number(value)) ? null : Number(value);
  const short = value => Number(value.toFixed(2)).toString();
  const sourceID = (s, index, csvRow) => s.accession+':'+(index+1)+':'+csvRow;
  function indexArchive(data) {
    const studies = data.investigations.filter(s => accessions.has(s.accession));
    const normalized=new Map(data.tests.map(r=>[r.record_id,r]));
    const rows=[];
    for (const study of studies) {
      study.tables.forEach((table,tableIndex)=>{
        const native=data.rawTables[table.file];
        if (!native || !native.length) throw Error('Source table unavailable: '+table.file);
        for (let i=1;i<native.length;i++) {
          const cells=native[i];
          if (!cells.some(c=>c.trim())) continue;
          const id=sourceID(study,tableIndex,i+1), obs=normalized.get(id);
          const lo=number(obs?.o2_low_pct),hi=number(obs?.o2_high_pct);
          // Do not put a range midpoint into the chart as an observed concentration.
          const point=lo!==null && lo===hi ? lo : null;
          const bucket=point!==null ? (point<20?'low':point<30?'mid':'high') : lo!==null && hi!==null ? 'range' : 'other';
          rows.push({id,study,table,csvRow:i+1,cells,headers:native[0],obs,lo,hi,bucket,kind:rowKind(study.accession,cells,obs)});
        }
      });
    }
    return {studies,rows};
  }
  let cachedData, cached;
  function archive() {
    if(cachedData!==window.FF) {cached=indexArchive(window.FF);cachedData=window.FF;}
    return cached;
  }
  const bucketLabels = {
    high:'≥30% O₂', mid:'20 to <30% O₂', low:'<20% O₂',
    range:'Reported interval', other:'No individual ambient value'
  };
  function scopeOf(r) {
    if(r.lo!==null && r.hi!==null) {
      const value=r.lo===r.hi ? short(r.lo) : short(r.lo)+'–'+short(r.hi);
      return value+'%'+(r.obs?.o2_qualifier?.includes('approx')?' (approx.)':'');
    }
    if(r.obs?.direction==='inverse')return 'Burner O₂ only';
    return '—';
  }
  function exportAtlas(rows) {
    const keys=['record_id','accession','table_file','source_row_header_is_1','source_doi','dataset_version','table_sha256','nasa_table_url','source_record_type','nominal_platform','material','ambient_o2_low_pct','ambient_o2_high_pct','oxygen_qualifier','burner_o2_pct','pressure_psia','native_fields_json'];
    const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';
    const body=rows.map(r=>[r.id,r.study.accession,r.table.file,r.csvRow,r.study.doi,r.study.version,r.table.sha256,r.table.url,r.kind,r.study.platform,r.obs?.material,r.lo,r.hi,r.obs?.o2_qualifier,r.obs?.o2_burner_pct,r.obs?.pressure_psia,JSON.stringify(r.headers.map((h,i)=>[h,r.cells[i]]))]);
    const csv=[keys,...body].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const anchor=e('a');anchor.href=url;anchor.download='first-fire-source-atlas.csv';anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function header(kind,title,description) {
    const h=e('header',null,'pagetitle atlas-heading');
    h.append(e('span',kind,'eyebrow'),e('h1',title),e('p',description,'sub'));
    return h;
  }
  function atlasNav(active) {
    const nav=e('nav',null,'atlas-nav');nav.setAttribute('aria-label','Archive tools');
    for (const [name,href] of [['Atlas','#atlas'],['Compass','#compass'],['Passports','#passports']]) {
      const a=makeLink(name,href);if(name===active)a.setAttribute('aria-current','page');nav.append(a);
    }
    return nav;
  }
  function tableHead(headers) {
    const head=e('thead'),tr=e('tr');
    for (const text of headers){const th=e('th',text);th.scope='col';tr.append(th);}
    head.append(tr);
    return head;
  }
  function downloadLink(table) {
    const a=makeLink('Download original CSV',asset(table.file));a.download='';return a;
  }
  function showRow(root,r,trigger) {
    const d=e('dialog',null,'atlas-dialog');
    const top=e('div',null,'atlas-row-top'),heading=e('h2',r.study.name+' · row '+r.csvRow);
    heading.id='atlas-row-title';d.setAttribute('aria-labelledby',heading.id);
    top.append(e('span',r.id,'eyebrow'),action('Close',()=>d.close()));
    d.append(top,heading,e('p',r.kind+' · '+r.table.file.split('/').pop()+' · header counted as row 1','small'));
    if(r.obs?.quality_notes)d.append(e('p',r.obs.quality_notes,'note'));
    const dl=e('dl',null,'atlas-raw');
    r.headers.forEach((h,i)=>{dl.append(e('dt',h.trim()),e('dd',r.cells[i]?.trim() || '—'));});
    const links=e('div',null,'atlas-links');
    links.append(makeLink('Dataset DOI','https://doi.org/'+r.study.doi),makeLink('NASA source CSV',r.table.url),downloadLink(r.table),makeLink('Investigation passport',linkStudy('passports',r.study.accession)),makeLink('Link to this row','#atlas?record='+encodeURIComponent(r.id)));
    if(r.obs)links.append(makeLink('Compare these conditions in Compass','#compass?record='+encodeURIComponent(r.id)));
    links.prepend(action('Use this record in investigation',()=>{
      document.dispatchEvent(new CustomEvent('ff-research-result',{detail:investigationResult(r)}));
      d.close();
      location.hash='#awareness';
    },'btn'));
    d.append(dl,links);root.append(d);
    d.addEventListener('close',()=>{d.remove();if(trigger?.isConnected)trigger.focus();},{once:true});
    d.addEventListener('click',event=>{if(event.target===d){const b=d.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)d.close();}});
    d.showModal();
  }
  function sourceField(row, pattern) {
    const index=row.headers.findIndex(h=>pattern.test(h.trim()));
    return index<0 ? '' : (row.cells[index] || '').trim();
  }
  // Keep instrument displays, mass flow and velocities in their own measurement contexts.
  function conditionValues(row) {
    const o=row.obs || {};
    const present=value=>value!=null && value!=='';
    const item=(text,key=text)=>text ? {text:String(text),key:String(key)} : null;
    const combined=values=>values.filter(Boolean).join(' · ');
    const dim=o.initial_diameter_mm ? 'Initial droplet diameter '+o.initial_diameter_mm+' mm' : '';
    const geometry=combined(row.headers.flatMap((header,i)=>/^(sample|samle) (thickness|length|width)|^nozzle \(mm\)|^burner size|^initial droplet diameter/i.test(header.trim()) && row.cells[i]?.trim() ? [header.trim().replace(/^Samle/i,'Sample')+': '+row.cells[i].trim()] : []));
    const material=o.material || sourceField(row,/^(fuel|fuel sample material|sample material|sample \(fuel type\)|fuel type|sample type|material)$/i);
    const specimen=geometry || dim || (/\b(rod|sphere|slab|sheet|film|cylinder|cone|strip|wick|fabric)\b/i.test(material)?'Specimen description: '+material:'');
    let flow='';
    if(present(o.flow_cm_s)) flow=(row.study.accession==='PSI-101'?'Smoke-source inlet':'Imposed airflow')+' '+o.flow_cm_s+' cm/s'+(o.direction?' · '+o.direction:'');
    else if(present(o.oxygen_flow_mg_s))flow='Burner oxygen mass flow '+o.oxygen_flow_mg_s+' mg/s';
    else if(present(o.fan_display)||present(o.air_display))flow=combined([present(o.fan_display)&&'Fan display '+o.fan_display,present(o.air_display)&&'Air display '+o.air_display]);
    const endpoints=[];
    if(row.obs){
      if(o.outcome)endpoints.push(o.outcome);
      if(o.termination_code)endpoints.push('Termination code '+o.termination_code);
      const duration=sourceField(row,/^burn time/i);
      if(duration)endpoints.push('Burn time '+(present(o.burn_time_s)?o.burn_time_s+' s':duration));
      if(present(o.visible_extinction_diameter_mm))endpoints.push('Visible extinction diameter '+o.visible_extinction_diameter_mm+' mm');
      if(present(o.smoke_heating_s))endpoints.push('Smoke heating '+o.smoke_heating_s+' s');
      if(present(o.smoke_aging_s))endpoints.push('Smoke aging '+o.smoke_aging_s+' s');
      const length=sourceField(row,/^\?-g burn length/i);
      if(length)endpoints.push('Orbital burn length '+length);
    }
    const ambient=row.lo!==null && row.hi!==null ? item(scopeOf(row)+' · '+o.o2_qualifier,[row.lo,row.hi,o.o2_qualifier].join('|')) : null;
    const pressure=present(o.pressure_psia)?item(o.reported_pressure+' '+o.reported_pressure_unit+' (≈'+short(Number(o.pressure_psia))+' psia)',[o.reported_pressure,o.reported_pressure_unit].join('|')):null;
    return {
      material:item(material),geometry:item(specimen),ambient,
      burner:present(o.o2_burner_pct)?item(o.o2_burner_pct+'% at burner inlet'):null,
      pressure,flow:item(flow),platform:item(row.study.platform+' · nominal orbital microgravity'),
      endpoint:item(endpoints.join(' · ')),type:item(row.kind)
    };
  }
  const comparisonLabels={material:'Fuel or specimen',geometry:'Geometry or dimensions',ambient:'Chamber O₂',burner:'Burner O₂',pressure:'Absolute pressure',flow:'Flow or instrument setting',platform:'Platform and gravity regime',endpoint:'Recorded outcome or timing',type:'Record type'};
  function investigationResult(row){
    const {endpoint,type,...fields}=conditionValues(row);
    const conditions=Object.fromEntries(Object.entries(fields).map(([key,value])=>[comparisonLabels[key],value?.text??null]));
    const boundary=row.obs
      ? [row.obs.quality_notes, 'The observation describes this specimen, setting and recorded endpoint. Transfer to a different atmosphere or gravity needs separate evidence.'].filter(Boolean).join(' ')
      : row.kind+'. This source row has no individual normalized observation. It cannot establish what happened to an individual specimen.';
    const record={
      kind:'archived evidence',id:row.id,accession:row.study.accession,sourceRow:row.csvRow,
      sourceFile:row.table.file,sourceURL:row.table.url,doi:row.study.doi,conditions,
      endpoint:endpoint?.text??null,boundary,recordType:type.text,tableSHA256:row.table.sha256
    };
    const summary=row.obs ? [type.text,conditions['Fuel or specimen'],record.endpoint??'Endpoint unavailable in this row'].filter(Boolean).join(' · ') : boundary;
    return {tool:'atlas',title:row.study.name+' · '+row.id,summary,record};
  }
  function compareRecords(a,b){
    const left=conditionValues(a),right=conditionValues(b);
    const fields=Object.keys(comparisonLabels).map(id=>{
      const x=left[id],y=right[id];
      const status=!x||!y?'Incomplete':x.key===y.key?'Same entry':'Different entries';
      return {id,label:comparisonLabels[id],left:x?.text,right:y?.text,status};
    });
    let interpretation='Check the specimen shape, flow location and recorded endpoint before choosing a follow-up test. Matching entries describe only these two rows.';
    if(!a.obs || !b.obs)interpretation='At least one selection has no individual observation in the normalized release. Inspect its original row before treating a setting, summary or note as an outcome.';
    else if((left.ambient&&right.burner)||(left.burner&&right.ambient))interpretation='One oxygen value describes the chamber and the other describes the burner feed. Choose two rows reporting chamber oxygen to compare atmospheres.';
    else if([a,b].some(r=>r.obs.observation_type==='smoke observation') && a.obs.observation_type!==b.obs.observation_type)interpretation='Smoke-source heating and aging describe how an aerosol sample was prepared. Find a detector measurement before inferring alarm performance.';
    else if(a.id===b.id)interpretation='Both selections point to the same source row. Choose a second record to look for a change in conditions.';
    return {fields,interpretation};
  }
  function comparisonPanel(root,studies,rows,params){
    const panel=e('details',null,'panel atlas-compare');
    const title=e('summary','Compare two source records');panel.append(title);
    const byId=new Map(rows.map(r=>[r.id,r]));
    const normal='PSI-159:1:2',inverse='PSI-159:2:2';
    const pair=[byId.get(params.get('left')) || byId.get(normal),byId.get(params.get('right')) || byId.get(inverse)];
    const explicit=byId.has(params.get('left'))&&byId.has(params.get('right'));
    const buttons=e('div',null,'atlas-compare-examples'),selectors=e('div',null,'atlas-compare-selectors'),output=e('div',null,'atlas-compare-results');
    const share=makeLink('Permalink to this pair','');
    const studiesSorted=studies.slice().sort((a,b)=>a.name.localeCompare(b.name));
    function choose(index,row){pair[index]=row;renderSelection();draw();}
    function renderSelection(){
      selectors.replaceChildren();
      for(const [i,record] of pair.entries()){
        const letter=i===0?'A':'B';
        const set=e('fieldset');set.append(e('legend','Record '+letter));
        const study=select(studiesSorted.map(s=>[s.accession,s.name]),record.study.accession);
        const candidates=rows.filter(r=>r.study===record.study);
        const recordSelect=select(candidates.map(r=>[r.id, r.id+' · '+(r.obs?((r.obs.test_id||'')+' '+(r.obs.material||'')).trim():r.kind)]),record.id);
        study.onchange=()=>{choose(i,rows.find(r=>r.study.accession===study.value));selectors.querySelectorAll('fieldset')[i].querySelector('select').focus();};
        recordSelect.onchange=()=>{pair[i]=byId.get(recordSelect.value);draw();};
        const original=action('Inspect original row '+letter,()=>showRow(root,pair[i],original),'atlas-row-link');
        set.append(field('Investigation '+letter,study),field('Source row '+letter,recordSelect),original);
        selectors.append(set);
      }
    }
    function draw(){
      const {fields,interpretation}=compareRecords(...pair);
      const grid=e('table',null,'atlas-compare-table'),body=e('tbody');
      grid.setAttribute('aria-label','Recorded conditions for the selected source rows');
      grid.append(tableHead(['Condition','Record A','Record B']));
      for(const value of fields){
        const tr=e('tr'),th=e('th',value.label);th.scope='row';th.append(e('small',value.status));
        tr.append(th,e('td',value.left || 'Unavailable here'),e('td',value.right || 'Unavailable here'));body.append(tr);
      }
      grid.append(body);
      const summary=e('p',interpretation,'atlas-compare-note');summary.setAttribute('role','status');
      const notes=e('div',null,'atlas-compare-footnotes');
      pair.forEach((r,i)=>{
        const cited=r.cells.flatMap((value,column)=>value.trim()?[value,r.headers[column]]:[]).join(' ');
        const refs=new Set(Array.from(cited.matchAll(/\bnote\s+(\d+)\b/gi),m=>m[1]));
        for(const ref of refs){
          const original=rows.find(other=>other.table===r.table && new RegExp('^Note\\s+'+ref+'\\b','i').test(other.cells[0]));
          if(!original||original===r)continue;
          const line=e('p');line.append(e('b','Record '+(i?'B':'A')+' · '),document.createTextNode(original.cells[0]+' '));
          const link=action('See row '+original.csvRow,()=>showRow(root,original,link),'atlas-row-link');line.append(link);notes.append(line);
        }
      });
      output.replaceChildren(summary,grid,notes);
      share.href='#atlas?'+new URLSearchParams({left:pair[0].id,right:pair[1].id});
    }
    function preset(left,right){pair[0]=byId.get(left);pair[1]=byId.get(right);renderSelection();draw();}
    buttons.append(e('span','Try a pair'),action('Chamber and burner oxygen',()=>preset(normal,inverse)),action('Silicone and a PMMA–Nomex assembly',()=>preset('PSI-99:1:3','PSI-99:1:8')));
    panel.append(e('p','Choose two NASA table rows. Each column preserves where a quantity was measured and which outcome the source recorded.','atlas-explain'),buttons,selectors,output,share);
    let initialized=false;
    const initialize=()=>{if(!initialized){initialized=true;renderSelection();draw();}};
    panel.addEventListener('toggle',()=>{if(panel.open)initialize();});
    if(explicit){initialize();panel.open=true;requestAnimationFrame(()=>panel.scrollIntoView({block:'start'}));}
    return panel;
  }
  function renderAtlas(root, params=new URLSearchParams()) {
    if(params.get('mode')==='rank'){
      const panel=e('div',null,'atlas-compass');
      root.replaceChildren(header('The Gap','Habitat compass','Pick a habitat and a test subject to rank records by gravity, ambient oxygen and pressure.'),atlasNav('Compass'),panel);
      window.renderExplorer(panel,params);
      return;
    }
    const {studies,rows}=archive();
    const target=rows.find(r=>r.id===params.get('record'));
    const initialStudy=target?.study.accession || params.get('study');
    const study=select([['','All 15 investigations'],...studies.map(s=>[s.accession,s.name])],studies.some(s=>s.accession===initialStudy)?initialStudy:'');
    const query=e('input');query.type='search';query.placeholder='Test ID, material or source text';query.value=params.get('q')||'';
    const controls=e('div',null,'atlas-controls');controls.append(field('Investigation',study),field('Search source records',query));
    const map=e('section',null,'panel atlas-map'), list=e('section',null,'panel atlas-list');
    const counts=e('p',null,'atlas-counts');
    counts.append(e('b',integer(rows.length)),document.createTextNode(' source records'),e('b',String(studies.length)),document.createTextNode(' investigations'),e('b',String(studies.reduce((n,s)=>n+s.tables.length,0))),document.createTextNode(' NASA tables'));
    const subtitle='Explore the orbital archive and the lunar conditions the planned FM² burns would test.';
    root.replaceChildren(header('The Gap','Combustion atlas',subtitle),atlasNav('Atlas'),counts,controls,map,comparisonPanel(root,studies,rows,params),list);
    const preset=params.get('preset');
    const habitat=window.FFCompassPreset(preset);
    let active=habitat && !target ? {regime:habitat.world,bucket:habitat.oxygen<20?'low':habitat.oxygen<30?'mid':'high'} : null,page=0;
    function filtered() {
      const words=query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
      return rows.filter(r=>(!study.value || r.study.accession===study.value) && (!words.length || words.every(w=>[r.id,r.study.name,r.kind,r.obs?.test_id,r.obs?.material,...r.cells].join(' ').toLowerCase().includes(w))));
    }
    function selectBucket(bucket,regime) {
      active={bucket,regime};page=0;draw();
      list.scrollIntoView({block:'nearest'});
      list.querySelector('h2').focus({preventScroll:true});
    }
    function draw() {
      const pool=filtered();
      map.replaceChildren(e('h2','Atmosphere by gravity'));
      const caption=e('p','Choose a cell to inspect its source rows. Gravity columns identify the platform. An individual test can supply an oxygen value or interval. Grouped conditions and missing values have their own row.','atlas-explain');
      const table=e('table',null,'atlas-matrix'), body=e('tbody');
      const levels=window.FF.forecast.mission.initial_oxygen_pct;
      table.setAttribute('aria-label','Source record count by starting ambient oxygen and platform');
      table.append(tableHead(['Starting oxygen','Orbit','Moon','Mars','Earth']));
      [...table.querySelectorAll('thead th')].slice(1).forEach((th,i)=>th.append(e('small',['nominal 0 g','0.165 g','0.38 g','1 g'][i])));
      for (const [key,bucketLabel] of Object.entries(bucketLabels)) {
        const tr=e('tr'),th=e('th',bucketLabel);th.scope='row';tr.append(th);
        const count=pool.filter(r=>r.bucket===key).length;
        for(const [name,n] of [['Orbit',count],['Moon',0],['Mars',0],['Earth',0]]) {
          const td=e('td'),b=action(integer(n),()=>selectBucket(key,name),'atlas-cell');
          b.setAttribute('aria-label',name+', '+bucketLabel+', '+integer(n)+' source rows');
          b.setAttribute('aria-pressed',String(active?.bucket===key&&active.regime===name));
          if(n){b.classList.add('atlas-filled');b.style.setProperty('--strength',String(.13+.60*Math.sqrt(n/(pool.length||1))));}
          if(name==='Moon' && (key==='high'||key==='mid')){
            const planned=levels.filter(x=>(x>=30?'high':'mid')===key);
            b.append(e('small','◇ '+planned.join(' · '),'atlas-plan'));
            b.setAttribute('aria-label',b.getAttribute('aria-label')+'. Planned FM² starts at '+planned.join(' and ')+' percent oxygen.');
          }
          td.append(b);tr.append(td);
        }
        body.append(tr);
      }
      table.append(body);
      const reference=e('div',null,'atlas-reference');
      reference.append(e('strong','◇ Planned FM² starts'),e('span','Lunar habitat reference · 34% O₂ at 8.2 psia'),makeLink('Inspect the forecast →','#forecast'));
      map.append(caption,table,reference);
      const filteredRows=active ? (active.regime==='Orbit'?pool.filter(r=>r.bucket===active.bucket):[]) : pool;
      list.replaceChildren();
      const heading=e('h2','Source records');heading.tabIndex=-1;
      const top=e('div',null,'atlas-list-head');const save=action('Download CSV',()=>exportAtlas(filteredRows));save.disabled=!filteredRows.length;top.append(heading,save);list.append(top);
      if(active){
        const row=e('div',null,'atlas-filter-summary');
        row.append(e('strong',active.regime+' · '+bucketLabels[active.bucket]),action('Clear cell',()=>{active=null;page=0;draw();}));
        row.append(makeLink('Rank the '+active.regime+' reference scenario in Compass','#compass?preset='+active.regime.toLowerCase()));
        list.append(row);
      }
      const total=filteredRows.length,pages=Math.max(1,Math.ceil(total/12));page=Math.min(page,pages-1);
      const status=e('p',total?'Showing '+integer(page*12+1)+'–'+integer(Math.min((page+1)*12,total))+' of '+integer(total)+' source records.':'No source records in this selection.','small');status.setAttribute('role','status');list.append(status);
      if(!total)return;
      const raw=e('table',null,'atlas-record-table'),tb=e('tbody');
      raw.append(tableHead(['Investigation / row','Type of record','Ambient O₂']));
      for(const row of filteredRows.slice(page*12,page*12+12)){
        const tr=e('tr'),td=e('td'),b=action(row.study.name+' · '+row.csvRow,()=>showRow(root,row,b),'atlas-row-link');
        b.setAttribute('aria-label','Inspect '+row.id);td.append(b,e('small',row.id));
        tr.append(td,e('td',row.kind),e('td',scopeOf(row)));tb.append(tr);
      }
      raw.append(tb);list.append(raw);
      const pageNav=e('div',null,'atlas-pager');
      const navigate=step=>{page+=step;draw();headingFocus();};
      function headingFocus(){const h=list.querySelector('h2');h.focus({preventScroll:true});list.scrollIntoView({block:'start'});}
      const prev=action('Previous',()=>navigate(-1)),next=action('Next',()=>navigate(1));prev.disabled=page===0;next.disabled=page===pages-1;
      pageNav.append(prev,e('span','Page '+(page+1)+' of '+pages),next);list.append(pageNav);
    }
    study.onchange=query.oninput=()=>{active=null;page=0;draw();};
    draw();
    if(target)showRow(root,target);
  }
  function renderPassports(root,params=new URLSearchParams()){
    const {studies,rows}=archive();
    const ordered=studies.slice().sort((a,b)=>a.name.localeCompare(b.name));
    const extra=window.FF.investigations.filter(s=>!accessions.has(s.accession));
    const id=params.get('study');
    const selected=[...ordered,...extra].find(s=>s.accession===id) || ordered.find(s=>s.accession==='PSI-107');
    const options=select([...ordered,...extra].map(s=>[s.accession,s.name+' · '+s.accession]),selected.accession);
    options.onchange=()=>{location.hash=linkStudy('passports',options.value);};
    const nav=e('div',null,'atlas-pass-controls');nav.append(field('Investigation',options),action('Print passport',()=>window.print()));
    const article=e('article',null,'panel atlas-passport'), info=e('div',null,'atlas-pass-title');
    info.append(e('span',selected.accession+' · version '+selected.version,'eyebrow'),e('h2',selected.name),e('p',selected.title));
    article.append(info,e('p',selected.summary,'atlas-summary'));
    const countSource=selected.tables.reduce((n,t)=>n+window.FF.rawTables[t.file].slice(1).filter(c=>c.some(x=>x.trim())).length,0);
    const obs=rows.filter(r=>r.study.accession===selected.accession && r.obs);
    const dl=e('dl',null,'atlas-facts');
    for(const [name,value] of [['Source records',integer(countSource)],['Normalized observations',integer(selected.rows)],['Platform',selected.platform],['Reuse terms',selected.license || 'See NASA dataset']]){
      const item=e('div');item.append(e('dt',name),e('dd',value));dl.append(item);
    }
    article.append(dl);
    if(selected.hardware)article.append(e('h3','Experimental hardware'),e('p',selected.hardware));
    article.append(e('h3','Reading the records'),e('p',selected.coverage));
    if(obs.length)article.append(e('p',integer(obs.filter(r=>r.lo!=null).length)+' observations report a starting ambient O₂ value or interval. '+integer(obs.filter(r=>number(r.obs.pressure_psia)!==null).length)+' report usable absolute pressure.'));
    const sources=e('div',null,'atlas-links');sources.append(makeLink('NASA investigation',selected.url),makeLink('DOI '+selected.doi,'https://doi.org/'+selected.doi));
    article.append(e('h3','Source files'),sources);
    for(const t of selected.tables){
      const detail=e('details',null,'atlas-table-source'),links=e('div',null,'atlas-links');
      detail.append(e('summary',t.name),e('p','SHA-256 '+t.sha256,'atlas-digest'));
      links.append(downloadLink(t),makeLink('Versioned NASA download',t.url));detail.append(links);article.append(detail);
    }
    if(accessions.has(selected.accession))article.append(makeLink('Inspect all '+integer(countSource)+' source records →',linkStudy('atlas',selected.accession),'atlas-deeper'));
    else article.append(e('p','This investigation is part of the extended FIRST FIRE catalog.','footnote'));
    root.replaceChildren(header('The Audit','Investigation passports','Check what each investigation measured, what its records support and where the original tables live.'),atlasNav('Passports'),nav,article);
  }
  if(typeof window!=='undefined'){
    window.FFAtlasEvidence={archive,compareRecords,investigationResult};
    window.renderDeckAtlas=renderAtlas;
    window.renderPassports=renderPassports;
  }
  if(typeof module!=='undefined' && module.exports)module.exports={indexArchive,scopeOf,compareRecords,investigationResult};
})();
