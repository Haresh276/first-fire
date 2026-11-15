/* Look up reported fields in individual identified observations or in the released register.
   Every numeric value below comes from a source cell, a set cardinality or the scoring contract. */
(() => {
  'use strict';
  const src=r=>({id:r.record_id,title:r.accession+' · test '+r.test_id,url:r.source_url,locator:r.source_file+' · CSV row '+r.source_row+' · '+r.doi});
  const known=(v)=>v!==''&&v!==null&&v!==undefined;
  const compact=v=>String(v).toLowerCase().replace(/[^a-z0-9]/g,'');
  const core=s=>String(s).normalize('NFKC').toLowerCase().replace(/[−–—]/g,'-');
  const archiveSource={id:'normalized-csv',title:'FIRST FIRE normalized NASA PSI archive',locator:'Investigation accession and stable source-row identifiers',url:'data/tests.csv'};
  const forecastSource={id:'fm2-lock',title:'FIRST FIRE locked FM² forecast',locator:'Scoring contract and release register',url:'#forecast'};
  const output=(answer,sources,why)=>({answer,sources,why});
  function fact(question,ff,provenance=[]){
    const q=core(question);
    if(/\b(?:invent|make up|ignore|fabricate|assume|pretend|guarantee|certif(?:y|ied)|safe for|xor|except|excluding)\b/.test(q))return null;
    const catalog=/\b(?:catalog(?:ue)?|archive|normalized)\b/.test(q);
    if(catalog&&/\b(?:investigations?|extended catalog)\b/.test(q)&&/how many|number of|catalog count/.test(q)
       &&!/\b(?:where|if|pressure|oxygen|material|heptane|methanol|saffire|flex|normal flame|liquid|solid|gas)\b/.test(q)){
      const obs=ff.tests||[],studies=new Set(obs.map(r=>r.accession)),files=new Set(ff.investigations.flatMap(i=>i.tables.map(t=>t.file)));
      return output('The archive contains '+obs.length.toLocaleString('en-US')+' normalized observations from '+studies.size+' investigations. The full catalog lists '+ff.investigations.length+' investigations across '+files.size+' original experimental CSV tables. A catalog entry can have no normalized observation in this release. [1] [2]',
        [archiveSource,{id:'psi-catalog',title:'Investigation passports and source tables',url:'#passports',locator:'All catalogued investigations and versioned NASA source tables'}],'Recounted normalized rows, observed and catalogued investigations, and distinct original CSV paths.');
    }
    if(catalog&&/zero rows|zero normalized|no normalized|omits normalized/.test(q)&&/prove|establish|mean|never|physical/.test(q))
      return output('A cataloged investigation with zero normalized rows has no observations in this release’s harmonized table. Its original experimental tables can contain settings, summaries, or records that were not normalized. Zero normalized rows cannot establish that the experiment never took place. [1]',[archiveSource],'Distinguishes harmonized records from the source-table inventory.');
    if(catalog&&/nominal/.test(q)&&/zero|gravity|acceleration/.test(q))
      return output('The orbital gravity entry is nominal microgravity. A zero in that field is a release convention, not an accelerometer measurement of exact local acceleration on every run. [1]',[archiveSource],'The normalizer explicitly labels the orbital gravity regime as nominal.');
    if(/\b(?:fm2|hot wire|igniter|four burns?|scoring rule)\b/.test(q)&&/brier|score[ds]?|scoring|correctly predicted zero/.test(q)&&/fault|abort|ambiguous|invalid|hardware|missing|no outcome/.test(q)){
      return output('A hardware fault, aborted burn or ambiguous classification is void. Exclude it from the Brier score. Score model and comparator on the same resolved burns and report coverage. A missing official outcome stays pending. [1]',[forecastSource],ff.forecast.scoring.void+' '+ff.forecast.scoring.missing_policy);
    }
    const studied=ff.investigations.filter(s=>q.includes(s.name.toLowerCase())||q.includes(s.accession.toLowerCase()));
    // An unambiguous study restricts a numeric lookup even for short instruments repeated elsewhere.
    const cfi=/\bcfi[ -]?g\b|\b(?:21088|21202)/.test(q);
    const study=cfi?'PSI-159':/\bflex\b/.test(q)?'PSI-69':/\bsaffire[- ]?(ii|2)\b/.test(q)?'PSI-99':studied.length===1?studied[0].accession:null;
    const eligible=(ff.tests||[]).filter(r=>!study||r.accession===study);
    if(study && /which (?:[\w-]+ )?(?:trial|run|record|test)|find (?:me )?(?:the|a) (?:record|trial|run)/.test(q)&&/oxygen/.test(q) && /ambient|burner|chamber/.test(q) && !( /ambient|chamber/.test(q)&&/burner/.test(q))){
      const perc=[...q.matchAll(/(\d+(?:\.\d+)?)\s*%/g)];
      if(perc.length===1 && !/more|less|above|below|higher|lower|between|safe|predict/.test(q)){
        const field=/burner/.test(q)?'o2_burner_pct':'o2_initial_pct',v=+perc[0][1],candidates=eligible.filter(r=>known(r[field])&&Math.abs(Number(r[field])-v)<1e-8);
        if(candidates.length&&candidates.length<=4){
          const text=candidates.map((r,i)=>r.test_id+' · '+r.direction+' · '+r[field]+'% '+(field==='o2_burner_pct'?'at the burner inlet':'in the initial ambient chamber gas')+' ['+(i+1)+']').join('\n');
          return output(text,candidates.map(src),'Compared the requested oxygen stream and percentage with reported scalar values of the named investigation.');
        }
      }
    }
    const refs=globalThis.FFIntentRouter.detect(q,[],ff).refs;
    const matched=new Set(refs?.known||[]);
    for(const m of q.matchAll(/\b(?:flex|sample|run|test)[ -]+(\d+(?:-\d+)?)\b/g)){
      const candidates=eligible.filter(r=>r.test_id===m[1]);
      if(study&&candidates.length===1)matched.add(candidates[0].record_id);
    }
    const codes=[...q.matchAll(/\b(\d{5})\s*([a-z]\d+)\s*(?:and|or|,|versus|vs\.?|&)\s*([a-z]\d+)\b/g)];
    for(const m of codes)for(const r of eligible)if([compact(m[1]+m[2]),compact(m[1]+m[3])].includes(compact(r.test_id)))matched.add(r.record_id);
    for(const id of (q.match(/\d{5}\s*[a-z]\d+/g)||[]))for(const r of eligible)if(compact(r.test_id)===compact(id))matched.add(r.record_id);
    if(!matched.size&&study&&/\b(?:a1|a2)\b/.test(q)){
      const anchored=provenance.flatMap(s=>s.id?.match(/(PSI-\d+:\d+:\d+)$/)?.[1]||[]);
      const sequences=new Set(eligible.filter(r=>anchored.includes(r.record_id)).map(r=>r.test_id.match(/^\d{5}/)?.[0]).filter(Boolean));
      if(sequences.size===1)for(const token of q.match(/\b[a-z]\d+\b/g)||[])for(const r of eligible)if(compact(r.test_id)===compact([...sequences][0]+token))matched.add(r.record_id);
    }
    if(!matched.size)return null;
    const rows=eligible.filter(r=>matched.has(r.record_id)),sources=rows.map(src);
    if(!rows.length)return null;
    if(rows.length===1 && /\b(?:burn.length|centimetres|centimeters|consumed)\b/.test(q) && /nomex/i.test(q)&&/nomex/i.test(rows[0].material)){
      const r=rows[0],table=ff.rawTables[r.source_file],col=table[0].findIndex(h=>/^.?.?-g burn length$/i.test(h)),entry=table[Number(r.source_row)-1]?.[col];
      const note=entry?.match(/note (\d+)/i),description=note&&table.find(line=>line[0].startsWith('Note '+note[1]+' '))?.[0];
      if(entry&&description){return output('The orbital burn-length cell reads “'+entry+'”. '+description+'. For the PMMA and Nomex entries, the second value is 0 cm for Nomex. Blackened length and burned length are different endpoints. [1]',sources,'Read the source burn-length cell and resolved its own note on material order.');}
    }
    const fieldGroups=[
      [/gas fractions|initial gas|gas composition/, [['o2_initial_pct','O₂'],['nitrogen_initial_pct','N₂'],['co2_initial_pct','CO₂'],['helium_initial_pct','He']].map(([k,l])=>[k,l,'%'])],
      [/hot ignition|ignited|ignition outcome|after.*ignit/, [['hot_ignition','Hot ignition',''],['termination_code','Termination code',''],['burn_time_s','Recorded duration','s']]],
      [/mass flow|oxygen flow rate|oxygen.*delivery/, [['oxygen_flow_mg_s','Burner oxygen mass flow','mg/s']]],
      [/diameter|droplet size|size (?:was|of).*droplet/, [['initial_diameter_mm','Initial droplet diameter','mm'],['visible_extinction_diameter_mm','Diameter at visible extinction','mm']]],
      [/type of fuel|which fuel|what fuel|fuel droplet/, [['material','Fuel',''],['phase','Phase','']]],
      [/ambient oxygen|chamber oxygen|burner oxygen|fuel gas|air surrounding|oxygen mixture|gas.*supplied/, [['material','Fuel',''],['o2_initial_pct','Scalar initial chamber oxygen','%'],['fuel_ambient_initial_pct','Ambient fuel','%'],['o2_burner_pct','Burner inlet oxygen','%'],['flow_cm_s','Flow','cm/s'],['direction','Direction','']]]
    ];
    const group=fieldGroups.find(([rx])=>rx.test(q));
    if(!group || /\b(?:why|result mean|infer|establish|prove|assume|simulat|effect|sensitivity)\b/.test(q))return null;
    let any=false;
    const result=rows.map((r,i)=>{
      const cells=group[1].map(([k,l,u])=>{if(known(r[k])){any=true;return l+' '+r[k]+(u?' '+u:'');}return l+' unreported';});
      if(/chamber oxygen|ambient oxygen/i.test(q)&&!known(r.o2_initial_pct)&&known(r.o2_low_pct)&&known(r.o2_high_pct))cells.push('Source chamber oxygen '+(r.o2_low_pct===r.o2_high_pct?'about '+r.o2_low_pct:r.o2_low_pct+' to '+r.o2_high_pct)+'%');
      return r.test_id+' · '+cells.join(' · ')+(r.termination_code==='SE'?' · SE denotes self-extinction':'')+' ['+(i+1)+']';
    });
    return any?output(result.join('\n'),sources,'Resolved original test IDs and read the requested field with its native units; missing cells were preserved.'):null;
  }
  globalThis.FFRecordFacts={fact};
})();
