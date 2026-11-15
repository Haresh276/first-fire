/* Compute archive statistics in the browser. Queries compile to typed predicates over versioned rows. */
(() => {
  'use strict';
  const clean = s => String(s ?? '').normalize('NFKC').replace(/[–—−]/g,'-').replace(/₂/g,'2').toLowerCase().replace(/\s+/g,' ').trim();
  const numeric = v => v !== null && v !== undefined && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  const format = v => new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(v);
  const quantities = [
    ['o2_burner_pct','burner oxygen','%', /(?:burner(?:[- ](?:stream|feed))?|oxidizer[- ]stream|jet)[- ](?:oxygen|o2)(?: (?:fraction|concentration|percentage|percent))?|(?:oxygen|o2)(?: (?:fraction|concentration|percentage|percent))? (?:in|at|of) (?:the )?(?:burner|jet)(?: stream)?/],
    ['o2_final_pct','final ambient oxygen','%',/(?:final|ending|end[- ]of[- ]burn)(?: (?:ambient|chamber))? (?:oxygen|o2)(?: (?:level|concentration|fraction|percent))?|(?:oxygen|o2) at (?:the )?end/],
    ['o2_initial_pct','initial ambient oxygen','%',/(?:(?:initial|starting|start|ambient|chamber)(?: (?:initial|starting|ambient|chamber))? (?:oxygen|o2)|(?:oxygen|o2) (?:in (?:the )?chamber|at (?:the )?(?:beginning|start)))(?: (?:fraction|concentration|level|content|percentage|percent))?/],
    ['visible_extinction_diameter_mm','visible extinction diameter','mm',/(?:visible[- ]flame |visible |flame )?extinction (?:droplet )?diameters?|(?:droplet )?diameters? (?:at|upon) (?:visible[- ]flame |visible |flame )?extinction/],
    ['initial_diameter_mm','initial droplet diameter','mm',/(?:initial|starting)(?: (?:droplet|drop))? diameters?|(?:initial|starting) (?:droplet|drop) sizes?|(?:droplet|drop) diameters? at (?:ignition|the start)/],
    ['smoke_heating_s','smoke heating time','s',/(?:smoke[- ]|sample[- ])?heating (?:time|duration)s?/],
    ['smoke_aging_s','smoke aging time','s',/(?:smoke[- ])?ag(?:e?ing|e) (?:time|duration)s?/],
    ['burn_time_s','burn duration','s',/(?:burn(?:ing)?|flame) (?:duration|time)s?|time (?:spent )?burning/],
    ['pressure_psia','absolute pressure','psia',/(?:(?:initial|absolute|chamber|ambient|total|gas) )*pressures?/],
    ['oxygen_flow_mg_s','oxygen delivery rate','mg/s',/(?:oxygen|o2) (?:mass )?(?:flow|delivery)(?: rates?)?/],
    ['flow_cm_s','flow velocity','cm/s',/(?:(?:smoke[- ]source|inlet|source|forced|imposed|air|gas) )?(?:airflow|air flow|flow)(?: (?:velocity|velocities|speeds?|rates?))?|inlet (?:velocity|speed)/],
    ['helium_initial_pct','initial helium','%',/(?:initial |starting )?(?:helium|he) (?:fraction|percentage|percent)|helium/],
    ['co2_initial_pct','initial carbon dioxide','%',/(?:initial |starting )?(?:carbon dioxide|co2)(?: (?:fraction|percentage|percent))?/],
    ['nitrogen_initial_pct','initial nitrogen','%',/(?:initial |starting )?(?:nitrogen|n2)(?: (?:fraction|percentage|percent))?/],
    ['gravity_g','nominal gravity','g',/(?:nominal |recorded )?(?:gravity|gravities)/]
  ];
  const fields = Object.fromEntries(quantities.map(([key,label,unit,rx]) => [key,{label,unit,rx}]));
  const groups = {
    study:[
      ['PSI-159',/cfi[- ]?g/],['PSI-69',/flex(?:[- ]?i(?!i))?/],['PSI-68',/flex[- ]?(?:2|ii)/],
      ['PSI-25',/bass[- ]?(?:ii|2)/],['PSI-26',/bass(?:[- ]?(?:i|1))?/],
      ['PSI-39',/cfi/],['PSI-101',/same[- ]?(?:r|reflight)/],['PSI-102',/same/],
      ['PSI-100',/saffire[- ]?(?:iii|3)/],['PSI-99',/saffire[- ]?(?:ii|2)/],['PSI-98',/saffire[- ]?(?:i|1)/],
      ['PSI-107',/spice/],['PSI-106',/slice/],['PSI-20',/bre/],['PSI-22',/e[- ]field/]
    ],
    material:[
      ['methanol',/methanol/],['heptane',/(?:n-)?heptane/],['kapton',/kapton/],['teflon',/teflon/],
      ['silicone',/silicone(?: rubber)?/],['pyrell',/pyrell/],['lampwick',/lampwick/],['butane',/butane/],
      ['propane',/propane/],['ethane',/ethane/],['pmma',/pmma/],['c12h26',/c12h26/],
      ['pmma & nomex',/pmma (?:&|and) nomex/]
    ],
    phase:[['liquid',/(?:liquid(?:[- ]fuel)?|droplet)(?: phase)?/],['solid',/solid(?:[- ]fuel)?(?: phase)?/],['gas',/(?:gas(?:eous)?(?:[- ]fuel)?|gas[- ]burner)(?: phase)?/],['aerosol',/(?:aerosols?|smoke)(?: observations?)?/]],
    direction:[['normal',/normal/],['inverse',/inverse/],['concurrent',/concurrent(?:[- ]flow)?/],['opposed',/opposed(?:[- ]flow)?/]],
    outcome:[['extinction',/extinction|extinguished/],['completion',/completion|completed/],['disruption',/disruption|disrupted/],['hot ignition: yes',/hot ignition(?: of)? (?:yes|succeeded|successful)|successful hot ignition/],['hot ignition: no',/hot ignition(?: of)? (?:no|failed)|failed hot ignition/],['hot ignition: flash',/(?:hot ignition(?: of)? )?flash/]]
  };
  const grammar=new Set((
    'a an the what which please show give tell me us how can you get find calculate compute could list provide is are was were did does do '+
    'we there have has had having with of on in from within among across by all only entire whole normalized archived archive catalogue catalog '+
    'dataset data table tables source nasa psi experimental experiment experiments investigation investigations observation observations row rows '+
    'record records tests test runs run samples sample entries entry cases case as for to during compare compares each vs versus and both into '+
    'count counts number numbers total many at no without missing unreported unavailable absent lack lacks lacked lacking report reports reported '+
    'recorded measured present available known blank value values field fields numeric numerical per reach reached end ended outcome outcomes '+
    'took place returned include including listed group grouped median average mean minimum max min maximum longest shortest smallest largest '+
    'highest lowest range span fraction percentage proportion share percent now those these their them then about instead out much time spent '+
    'results exact exactly material label fuel phase whose it underlying selection').split(/\s+/));
  const groupKey={study:'accession',material:'material',phase:'phase',direction:'direction',outcome:'outcome'};
  // build_data.py stores normalized numbers to eight decimal places; compare in the published units.
  const sameNumber=(a,b)=>Math.abs(a-b)<=5.1e-9;
  const compare={'>':(x,a)=>x>a&&!sameNumber(x,a),'>=':(x,a)=>x>a||sameNumber(x,a),
    '<':(x,a)=>x<a&&!sameNumber(x,a),'<=':(x,a)=>x<a||sameNumber(x,a),'=':sameNumber,
    'between':(x,a,b)=>(x>a||sameNumber(x,a))&&(x<b||sameNumber(x,b))};
  const unitToken='(?:percentage points?|percent(?:age)?|%|mmhg|kpa|psia|psi|bar|atm(?:ospheres?)?|millimet(?:er|re)s?|centimet(?:er|re)s?|mm|cm/s|mm/s|m/s|mg/s|cm|seconds?|secs?|minutes?|mins?|s|g)';
  const unitNames={percent:'%',percentage:'%','percentage point':'%','percentage points':'%',psi:'psia',atmosphere:'atm',atmospheres:'atm',second:'s',seconds:'s',sec:'s',secs:'s',minute:'min',minutes:'min',mins:'min',millimeters:'mm',millimeter:'mm',millimetres:'mm',millimetre:'mm',centimeters:'cm',centimeter:'cm',centimetres:'cm',centimetre:'cm'};
  const scale={psia:{psia:1,kpa:0.14503773773,bar:14.503773773,atm:14.6959487755,mmhg:14.6959487755/760},'%':{'%':1},s:{s:1,min:60},mm:{mm:1,cm:10},'cm/s':{'cm/s':1,'mm/s':0.1,'m/s':100},'mg/s':{'mg/s':1},g:{g:1}};
  const operatorPattern='(?:at least|no less than|not less than|greater than or equal to|at most|no more than|not more than|less than or equal to|greater than|more than|above|over|higher than|exceeding|less than|lower than|below|under|fewer than|equal to|exactly|at|>=|<=|>|<|=)';
  function operator(s) {
    if(/^(at least|no less|not less|greater than or|>=)/.test(s))return '>=';
    if(/^(at most|no more|not more|less than or|<=)/.test(s))return '<=';
    if(/^(greater|more|above|over|higher|exceed|>)/.test(s))return '>';
    if(/^(less|lower|below|under|fewer|<)/.test(s))return '<';
    return '=';
  }
  const actions=[
    ['median',/\bmedian\b/],['mean',/\b(?:mean|average)\b/],['min',/\b(?:min(?:imum)?|smallest|lowest|shortest)\b/],
    ['max',/\b(?:max(?:imum)?|largest|highest|longest)\b/],['range',/\b(?:range|span|min(?:imum)? (?:and|to) max(?:imum)?)\b/],
    ['fraction',/\b(?:percentage|fraction|proportion|share|what percent) (?:of|have|had|are|is|lack|were|with)\b/],['count',/\b(?:count|how many|number of|tally|total(?: number)? of)\b/]
  ];
  const reminder='Try “How many FLEX heptane rows have a reported burn duration?” or “Compare mean burn duration for methanol and heptane in FLEX.”';
  const scopeWords=/\b(?:psi[- ]?\d+|flex|bass|saffire|cfi|same-r|normalized|archiv(?:e|ed)|observations?|rows?|records?|experiments?|runs?|droplets?|smoke|methanol|heptane|kapton|teflon|burn duration)\b/;
  const followWords=/^(?:and |of those\b|among those\b|for those\b|what about\b|how about\b|now\b|instead\b|only\b|within those\b|which of (?:those|them)\b)/;
  function isCandidate(question,previous=[]) {
    const q=clean(question);
    if(/\b(?:fm2|apollo|mir|gemini|challenger|columbia|soyuz)\b/.test(q) && !/\b(?:rows?|normalized)\b/.test(q))return false;
    const quant=actions.some(([,rx])=>rx.test(q))||/\bcompare\b/.test(q);
    return (quant && scopeWords.test(q)) || (followWords.test(q) && !!previous.at(-1)?.analysis?.plan);
  }
  function clarification(message) {return {status:'abstained',mode:'calculation',evidenceKind:'archive-clarification',answer:message,sources:[],analysis:null};}
  function parse(q,previous,archive) {
    if(/\b(?:fabricate|pretend|ignore|invent|override|assume all|make up|system prompt|disregard|regardless of|xor|except|excluding|standard deviation|variance|weighted mean|uncertainty|confidence interval|correlation|survival|caused|causal|risk|probability|guarantee|certif\w*|safe(?:ty)?|predict\w*|hypothetical|maximum safe|lunar|on the moon|on mars|mimic|fahrenheit|temperature|heat.release|spread rate|alarm time|time to alarm|sensor accuracy)\b/.test(q))return {error:'This request needs a different measurement, inference or assumption. The row calculator can describe recorded conditions and outcomes. '+reminder};
    const prev=followWords.test(q)?previous.at(-1)?.analysis?.plan:null;
    let text=q;
    let op=actions.find(([,rx])=>rx.test(text))?.[0] || (prev?.op);
    const wantsCompare=/\b(?:compare|versus|vs\.?)\b/.test(q);
    if(!op && wantsCompare && /\b(?:counts?|how many|number|rows|records)\b/.test(q))op='count';
    const statOps=actions.filter(([k,rx])=>['mean','median','min','max','range'].includes(k)&&rx.test(text)).map(([k])=>k);
    if(/\bmin(?:imum)? (?:and|to) max(?:imum)?\b/.test(q))op='range';
    else if(statOps.length>1)return {error:'Choose one statistic for each question. The calculator supports a count, mean, median, minimum, maximum or range.'};
    if(!op)return {error:'Which statistic should I compare? '+reminder};
    const category={study:[],material:[],phase:[],direction:[],outcome:[]};
    const add=(type,v)=>{if(!category[type].includes(v)) category[type].push(v);};
    const literalNames=[...text.matchAll(/["“]([^"”]{1,140})["”]/g)];
    for(const literal of literalNames) {
      const value=clean(literal[1]);
      if(!archive.tests.some(row=>clean(row.material)===value))return {error:'No normalized material label matches “'+literal[1]+'”. Open the Atlas for the specimen wording.'};
      add('material',value);text=text.replace(literal[0],' ');
    }
    const named=text.match(/\bpsi[- ]?(\d+)\b/g)||[];
    for(const raw of named){add('study','PSI-'+raw.match(/\d+/)[0]);text=text.replace(raw,' ');}
    const fieldsFound=[];
    for(const [k,,,p] of quantities){
      const marker=String.fromCharCode(97+fieldsFound.length);
      const re=new RegExp('\\b(?:'+p.source+')\\b','gi');
      if(re.test(text)){re.lastIndex=0;text=text.replace(re,' {'+marker+'} ');fieldsFound.push(k);}
    }
    if(/\b(?:oxygen|o2)\b/.test(text)){
      return {error:'Which oxygen field do you mean: initial ambient oxygen, final ambient oxygen, or oxygen delivered by the burner? They describe different physical locations or times.'};
    }
    if(/\bdiameters?\b/.test(text))return {error:'Choose initial droplet diameter or visible extinction diameter. The two measurements use the same units at different points during a run.'};
    // Match the longest study/material names first so a nested alias cannot capture part of a name.
    for(const [type, entries] of Object.entries(groups)){
      const hits=[];
      for(const [v,re] of entries){
        const rx=new RegExp('\\b(?:'+re.source+')\\b','gi');
        for(const m of text.matchAll(rx))hits.push({start:m.index,end:m.index+m[0].length,v});
      }
      hits.sort((a,b)=>a.start-b.start || b.end-a.end);
      let end=0, built='';
      for(const hit of hits){
        if(hit.start<end)continue;
        add(type,hit.v);built+=text.slice(end,hit.start)+' ';end=hit.end;
      }
      text=built+text.slice(end);
    }
    const keys=Object.keys(category);
    for(const k of keys){if(!category[k].length && prev?.category?.[k])category[k]=[...prev.category[k]];}
    // A question about source-table rows has a larger denominator than the harmonized observation table.
    if(/\b(?:raw|original|source[- ]table) (?:csv |table )?(?:rows?|records?)\b/.test(q))
      return {error:'The Atlas includes raw table records such as flow checks and table notes. The calculator counts normalized observations. Specify that count or open the Atlas for the source table.'};
    let comparison=null;
    const multi=keys.filter(k=>category[k].length>1);
    if(multi.length){
      if(multi.length!==1 || category[multi[0]].length!==2 || !wantsCompare)return {error:'I found more than one group. Ask for a comparison of two named materials, studies, phases, directions or outcomes, with one shared statistic.'};
      comparison=multi[0];
    }else if(wantsCompare)return {error:'Please name the two groups to compare and the statistic to calculate.'};
    const unknownStudy=category.study.find(s=>!archive.investigations.some(x=>x.accession===s));
    if(unknownStudy)return {error:'The catalog has no '+unknownStudy+' record. Check the accession before calculating a statistic.'};
    for(const id of category.study){
      const catalog=archive.investigations.find(x=>x.accession===id);
      if(catalog && Number(catalog.rows)===0)return {error:catalog.name+' is cataloged, but this release has no normalized observation rows for it. An archive count cannot establish how many physical tests took place.',source:catalog};
    }
    const predicates=[],used=new Set();
    const raw='(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))';
    const unit='(?:\\s*('+unitToken+')(?![a-z]))?';
    const cond=new RegExp('(?:\\bbetween\\s+'+raw+unit+'\\s+(?:and|to)\\s+'+raw+unit+'|('+operatorPattern+')\\s*'+raw+unit+')','gi');
    const where=[...text.matchAll(cond)];
    let invalid='';
    // Bind a comparator to its adjacent quantity, or to a quantity implied uniquely by its unit.
    for(const m of where){
      const before=text.slice(0,m.index),after=text.slice(m.index+m[0].length);
      const left=before.match(/\{([a-z])\}\s*(?:(?:is|was|of|were|values?|measured|recorded)\s+)*$/),right=after.match(/^\s*(?:of\s+)?\{([a-z])\}/);
      const u1=m[2]||m[4]||m[7],u2=m[4]||m[2];
      let k=left?fieldsFound[left[1].charCodeAt(0)-97]:right?fieldsFound[right[1].charCodeAt(0)-97]:null;
      const unitName=u=>unitNames[u]||u;
      if(!k && u1){
        const implied=Object.keys(fields).filter(key=>scale[fields[key].unit][unitName(u1)]!==undefined);
        if(implied.length===1)k=implied[0];
      }
      if(!k){invalid='Identify the measurement for each numerical filter, such as “initial ambient oxygen above 21%”.';break;}
      const conversion=(n,u)=>{const factor=u?scale[fields[k].unit][unitName(u)]:1;return factor===undefined?NaN:Number(n)*factor;};
      const p=m[1]!==undefined?{field:k,op:'between',a:conversion(m[1],u1),b:conversion(m[3],u2)}:{field:k,op:operator(m[5]),a:conversion(m[6],u1)};
      if(!Number.isFinite(p.a)||(p.op==='between'&&(!Number.isFinite(p.b)||p.b<p.a))){invalid='The filter has inconsistent units or reversed bounds. Use '+fields[k].label+' in '+fields[k].unit+'.';break;}
      if(fields[k].unit==='%' && (p.a<0 || p.a>100 || (p.b!==undefined && (p.b<0 || p.b>100)))){invalid='Oxygen and gas-volume percentages must fall between 0 and 100. State the concentration as a percentage.';break;}
      predicates.push(p);used.add(k);
    }
    if(invalid)return {error:invalid};
    text=text.replace(cond,' ');
    if(/\b(?:at least|at most|greater than|less than|below|above|between|under|over|equal to)\b|[<>]=?/.test(text))
      return {error:'One of the numerical conditions is incomplete. Give a field, comparison and value, for example “absolute pressure below 12 psia”.'};
    const missing=/\b(?:missing|unreported|without|absent|unavailable|lack(?:ing|s|ed)?|unknown|blank|not (?:recorded|reported|measured)|no (?:reported |recorded |measured )?)\b/;
    const present=/\b(?:available|present|known|numeric|numerical|have|had|report(?:s|ed)?|recorded|measured|with)\b/;
    for(let i=0;i<fieldsFound.length;i++){
      const k=fieldsFound[i],mrk='{'+String.fromCharCode(97+i)+'}',pos=text.indexOf(mrk);
      const prefix=text.slice(0,pos),suffix=text.slice(pos+3);
      const left=prefix.split(/[{},]|\band\b/).at(-1),right=suffix.split(/[{},]|\band\b/)[0];
      const isMissing=missing.test(left)||missing.test(right);
      const isCount=op==='count'||op==='fraction';
      if(isMissing || (isCount && !used.has(k) && (present.test(left)||present.test(right)))){
        predicates.push({field:k,op:isMissing?'missing':'present'});used.add(k);
      }
    }
    let target=null;
    const initialFields=fieldsFound.filter(k=>!used.has(k));
    if(!['count','fraction'].includes(op)){
      target=initialFields.length===1?initialFields[0]:fieldsFound.length===1?fieldsFound[0]:!fieldsFound.length?prev?.target:null;
      if(!target)return {error:'Choose a single measured quantity for that statistic, such as absolute pressure or initial droplet diameter.'};
    }else if(initialFields.length){return {error:'Should I count rows with a recorded '+fields[initialFields[0]].label+', rows missing it, or rows within a numerical range?'};
    }else if(op==='fraction'&&!predicates.length)return {error:'Which condition defines the numerator of the fraction? For example, ask which percentage of FLEX rows have a recorded absolute pressure.'};
    if(/\b(?:not|except|without|no)\b/.test(text)&&!predicates.some(p=>p.op==='missing'))return {error:'Please express the requested exclusion as a named group or an explicit measurement condition.'};
    // An unparsed condition must never disappear from a computed result.
    const rest=text.replace(/\{[a-z]\}/g,' ').replace(/[?.,:;!()'"]/g,' ').trim().split(/\s+/).filter(w=>w && !grammar.has(w));
    if(rest.length || /\bor\b/.test(text))return {error:'I could not bind every requested condition to an archive field. Specify an investigation, material and measurement, with units for numerical filters. '+reminder};
    const inherited=prev?(prev.predicates||[]).filter(p=>!predicates.some(x=>x.field===p.field)):[];
    return {op,target,category,predicates:[...inherited,...predicates],comparison};
  }

  function matchesCategories(row,category) {
    return Object.keys(groupKey).every(type=>!category[type].length || category[type].some(value=>clean(row[groupKey[type]])===clean(value)));
  }
  function matchesPredicate(row,p) {
    const v=numeric(row[p.field]);
    if(p.op==='missing')return v===null;
    if(p.op==='present')return v!==null;
    return v!==null && compare[p.op](v,p.a,p.b);
  }
  function statistic(op,values) {
    if(!values.length)return null;
    if(op==='mean')return values.reduce((a,b)=>a+b,0)/values.length;
    const sorted=values.slice().sort((a,b)=>a-b);
    if(op==='min')return sorted[0];
    if(op==='max')return sorted.at(-1);
    if(op==='range')return [sorted[0],sorted.at(-1)];
    return (sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2;
  }
  function measure(rows,plan) {
    const used=rows.filter(r=>plan.predicates.every(p=>matchesPredicate(r,p)));
    const values=plan.target?used.map(r=>numeric(r[plan.target])).filter(v=>v!==null):[];
    const reported=plan.target?values.length:used.length;
    const value=plan.op==='fraction'?(rows.length?100*used.length/rows.length:null):plan.op==='count'?used.length:statistic(plan.op,values);
    return {n:used.length,base:rows.length,reported,missing:used.length-reported,value,unit:plan.target?fields[plan.target].unit:plan.op==='fraction'?'%':'rows',rows:used.map(r=>r.record_id)};
  }
  function provenance(rows,archive){
    const tables=new Map();
    for(const row of rows){
      const table=archive.investigations.find(s=>s.accession===row.accession)?.tables?.find(t=>t.file===row.source_file);
      if(!tables.has(row.source_file))tables.set(row.source_file,{id:row.source_file,title:(table?.name||row.source_file).replace(/\.csv$/i,''),url:row.source_url,doi:row.doi,hash:table?.sha256||'',lines:[]});
      tables.get(row.source_file).lines.push(Number(row.source_row));
    }
    return [...tables.values()].map(t=>({...t,locator:'NASA PSI · '+t.doi+' · '+t.lines.length+' selected source rows. '+(t.lines.length<=12?'CSV rows '+t.lines.join(', '):'All original row numbers are in the calculation receipt.')}));
  }
  const label=(s,archive)=>archive.investigations.find(c=>c.accession===s)?.name || s;
  function describe(plan,archive) {
    const selected=Object.entries(plan.category).filter(([,v])=>v.length).map(([k,v])=>v.map(x=>label(x,archive)).join(' / ')+(k==='material'?' (exact material label)':''));
    const filters=plan.predicates.map(p=>fields[p.field].label+' '+(p.op==='present'?'reported':p.op==='missing'?'missing':p.op==='between'?'between '+format(p.a)+' and '+format(p.b)+' '+fields[p.field].unit:p.op+' '+format(p.a)+' '+fields[p.field].unit));
    return [...selected,...filters].join(' · ')||'All normalized archive observations';
  }
  function resultText(a,plan){
    if(plan.op==='count')return format(a.value)+' normalized observation '+(a.value===1?'row matches.':'rows match.');
    if(plan.op==='fraction')return a.value===null?'The denominator has no eligible rows, so a percentage is unavailable.':format(a.value)+'% meet the requested condition ('+a.n+' of '+a.base+' rows).';
    if(a.value===null)return 'No numeric '+fields[plan.target].label+' was available among '+a.n+' matching rows.';
    const v=Array.isArray(a.value)?a.value.map(format).join('–'):format(a.value);
    return ({mean:'Mean',median:'Median',min:'Minimum',max:'Maximum',range:'Range of'})[plan.op]+' '+fields[plan.target].label+' is '+v+' '+a.unit+' across '+a.reported+' of '+a.n+' matching rows ('+a.missing+' missing).';
  }
  function answer(question,previous=[],archive=window.FF){
    if(!isCandidate(question,previous))return null;
    if(!Array.isArray(archive.tests)||!Array.isArray(archive.investigations))return clarification('The normalized archive is unavailable. Reopen the research chat to load the versioned observations.');
    const plan=parse(clean(question),previous,archive);
    if(plan.error){
      const reply=clarification(plan.error);
      if(plan.source)reply.sources.push({title:plan.source.name,url:plan.source.url,locator:'NASA PSI investigation catalog',id:plan.source.accession});
      return reply;
    }
    const base=archive.tests.filter(r=>matchesCategories(r,plan.category));
    const result=measure(base,plan);result.plan=plan;
    const groups=plan.comparison?plan.category[plan.comparison].map(v=>({label:label(v,archive),...measure(base.filter(r=>clean(r[groupKey[plan.comparison]])===clean(v)),plan)})):[];
    result.groups=groups;
    const selectedIds=new Set(result.rows),matched=base.filter(r=>selectedIds.has(r.record_id));
    let evidence=provenance(plan.op==='fraction'||!matched.length?base:matched,archive);
    if(!evidence.length){
      const scope=plan.category.study.length?archive.investigations.filter(c=>plan.category.study.includes(c.accession)):archive.investigations.filter(c=>c.rows);
      evidence=scope.map(c=>({id:c.accession,title:c.name,url:c.url,locator:'Investigation inventory · '+c.rows+' normalized rows · '+c.doi}));
    }
    const refs=evidence.map((_,i)=>'['+(i+1)+']').join(' ');
    const lines=[groups.length?groups.map(g=>g.label+' — '+resultText(g,plan)).join('\n'):resultText(result,plan),'Selection: '+describe(plan,archive)+'. '+refs];
    if(plan.comparison && !['count','fraction'].includes(plan.op))lines.push('These are descriptive summaries over the recorded conditions. Other experimental settings may differ between the groups.');
    if(!matched.length)lines.push('The selection returned no matching normalized row. The source inventory includes other tables and unnormalized records.');
    if(plan.target==='o2_initial_pct'||plan.predicates.some(p=>p.field==='o2_initial_pct'))lines.push('Initial ambient oxygen uses a reported scalar at the start. A source interval or a burner-stream reading occupies a different field.');
    if(plan.target==='flow_cm_s'&&base.some(r=>r.phase==='aerosol')&&base.some(r=>r.phase!=='aerosol'))return clarification('The selected rows mix smoke-source inlet velocity with imposed flow in combustion experiments. Choose a single investigation before aggregating these measurements.');
    if(plan.target==='flow_cm_s'&&base.some(r=>r.phase==='aerosol'))lines.push('SAME-R measured flow at the smoke source inlet.');
    if(plan.target==='burn_time_s'&&matched.some(r=>r.quality_notes?.includes('approximate')))lines.push('The source flags one or more burn durations as approximate.');
    const sources=evidence.map(({id,title,url,locator})=>({id,title,url,locator}));
    return {mode:'calculation',evidenceKind:'archive-calculation',status:result.value===null||!matched.length?'limited':'answered',answer:lines.join('\n\n'),sources,analysis:result};
  }
  function receipt(question,previous,archive){
    const result=answer(question,previous,archive);
    if(!result?.analysis)return null;
    const ids=new Set(result.analysis.rows);
    const scope=archive.tests.filter(r=>matchesCategories(r,result.analysis.plan.category));
    const read=scope.filter(r=>ids.has(r.record_id));
    const p=result.analysis.plan;
    const keys=[...new Set([p.target,...p.predicates.map(v=>v.field)].filter(Boolean))];
    return {format:'FIRST FIRE archive calculation v1',question,selection:describe(p,archive),result:result.analysis,
      sources:provenance(scope,archive),rows:read.map(r=>({id:r.record_id,source_file:r.source_file,source_row:Number(r.source_row),measured:Object.fromEntries(keys.map(k=>[k,r[k]])),material:r.material,accession:r.accession}))};
  }
  window.FFScienceChat={isCandidate,answer,receipt};
})();
