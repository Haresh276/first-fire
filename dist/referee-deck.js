/* Local claim checks. Registry reviews bind the claim, excerpt, page and publisher file hash. */
(() => {
  'use strict';
  const labelFor={supported:'Supported',contradicted:'Contradicted',insufficient:'Insufficient support'};
  const normalize=s=>s.normalize('NFKC').replace(/\u00ad/g,'').trim().split(/\s+/u).filter(Boolean);
  const hex=buffer=>Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,'0')).join('');
  async function digest(text){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}
  function receipts(){return globalThis.FFRefereeReviews;}
  function archive(){return globalThis.FF;}
  function sourceFor(key){
    const anchor=archive().evidence.anchors[key], doc=archive().evidence.documents[anchor.document];
    const locator=anchor.page?'PDF page '+anchor.page:'Section '+anchor.section_id;
    const url=new URL(doc.canonical_url||doc.url);
    url.hash=anchor.page?'page='+anchor.page:anchor.section_id;
    return {anchor,doc,title:doc.title,url:url.href,locator,id:key};
  }
  async function exactMatch(anchor,quote){
    const words=normalize(quote);
    if(!words.length||words.length>250)return false;
    const hashes=await Promise.all(words.map(digest));
    return anchor.tokens.some((h,i)=>h===hashes[0]&&hashes.every((value,j)=>value===anchor.tokens[i+j]));
  }
  function step(state,reason){return {state,reason};}
  function quantitative(key,claim,quote,context){
    // Only measurements with a typed quantity, unit and retrievable operands are supported.
    const number=String.raw`[+−-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+−-]?\d+)?`;
    const values=claim.match(new RegExp(number,'g'))||[];
    const value=token=>Number(token.replaceAll('−','-'));
    const durations=claim.match(new RegExp('('+number+')\\s*(seconds?|minutes?|milliseconds?|hours?)\\b','i'));
    const percent=claim.match(new RegExp('('+number+')\\s*%'));
    if(values.length>1 && context?.numeric!=='sample-id')return step('unavailable','This claim contains more than one numerical assertion. Check each quantity separately.');
    if(key==='luci34'&&durations){
      const measured=quote.match(/~\s*(\d+(?:\.\d+)?)\s+seconds sooner/);
      if(!measured)return step('unavailable','A duration with its direction is required in the verified excerpt.');
      const toSeconds={second:1,minute:60,millisecond:.001,hour:3600};
      const given=value(durations[1])*toSeconds[durations[2].toLowerCase().replace(/s$/,'')];
      if(Math.abs(given-Number(measured[1]))>1e-6)return step('fail','The source gives about '+measured[1]+' seconds. The stated '+durations[0]+' corresponds to '+given+' seconds.');
      const earthFirst=/\b(?:earlier|sooner) at Earth gravity than at partial gravity\b/i.test(claim);
      const reversed=/\b(?:earlier|sooner) at partial gravity than at Earth gravity\b/i.test(claim);
      if(reversed)return step('fail','The cited comparison places the earlier extinction at Earth gravity.');
      if(!earthFirst)return step('unavailable','The registered comparison needs the extinction direction and both gravity conditions.');
      const endpoint=new RegExp('^(?:the )?(?:fabric )?flame (?:went out|extinguished) (?:about )?'+number+'\\s*(?:seconds?|minutes?|milliseconds?|hours?) (?:earlier|sooner) at Earth gravity than at partial gravity\\.?$','i');
      if(!endpoint.test(claim))return step('unavailable','The registered LUCI quantity is time to extinction of the fabric flame. A different specimen or endpoint requires its own source.');
      return step('pass','The comparison reports about '+measured[1]+' seconds. The stated '+durations[0]+' agrees after unit conversion.');
    }
    if(key==='sameS8'&&percent){
      const ratio=quote.match(/(\d+)\/(\d+) of the Teflon tests/);
      if(!ratio||!Number(ratio[2]))return step('unavailable','The verified excerpt must give the fraction for Teflon smoke.');
      if(/\b(?:Kapton|silicone|Nomex)\b/i.test(claim))return step('fail','The two-thirds fraction belongs to Teflon smoke. The source gives a separate bound for Kapton.');
      const missed=new RegExp('^the ISS detector (?:would have )?missed (?:about )?'+number+'\\s*% of (?:the )?Teflon smoke tests\\.?$','i');
      if(!missed.test(claim))return step('unavailable','This registered fraction pairs the ISS detector, missed alarms and Teflon smoke tests.');
      const recomputed=100*Number(ratio[1])/Number(ratio[2]);
      const correct=Math.abs(value(percent[1])-recomputed)<=.05;
      return step(correct?'pass':'fail',ratio[1]+' ÷ '+ratio[2]+' × 100 = '+recomputed.toFixed(1)+'%. The claim gives '+percent[1]+'%.');
    }
    if(key==='fm25'&&percent&&/ignit/i.test(claim)){
      const source=quote.match(/Start at (\d+)%/), levels=archive().forecast.burns.map(b=>Number(b.oxygen_pct));
      if(!source)return step('unavailable','Use a quotation that gives the starting oxygen for this burn.');
      if(!/% (?:starting |initial )?oxygen\b/i.test(claim))return step('unavailable','The design value refers to starting oxygen by volume. The claim must identify that quantity.');
      return step(levels.includes(+source[1])&&value(percent[1])===+source[1]?'pass':'fail','Starting oxygen in the design and the four-burn register is '+source[1]+'%. The claim gives '+percent[1]+'%.');
    }
    if(key==='fm25'&&/\bfour\b|\b\d+ (?:planned )?(?:burns|tests)\b/i.test(claim)){
      const count=archive().forecast.burns.length;
      const n=/\bfour\b/i.test(claim)?4:Number(claim.match(/\b(\d+) (?:planned )?(?:burns|tests)\b/i)?.[1]);
      return step(n===count?'pass':'fail','The experiment register contains '+count+' separately identified planned burns.');
    }
    if(context?.numeric==='sample-id'&&/sample 2-7/.test(claim))return step('na','2-7 identifies the specimen. The claim reports no numerical measurement.');
    if(values.length||/\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[a-z]+teen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|half|thirds?|twice|double)\b/i.test(claim)){
      if(key==='sameS8'&&/over half (?:of )?(?:the )?Kapton/i.test(claim)&&/over half of the Kapton/i.test(quote))return step('pass','The same lower bound, over one half, appears in the detector results.');
      return step('unavailable','No registered calculation covers every numerical assertion in this statement.');
    }
    return step('na','This statement gives no numerical measurement or calculation.');
  }
  function scopeCheck(key,claim){
    if(key==='fm25'){
      if(/already|has (?:already )?(?:observed|demonstrated)|(?:proved|observed|measured) (?:on|in) the moon/i.test(claim))return step('fail','The cited page describes planned tests. It contains no lunar flight outcome.');
      if(/\b(?:observed|confirmed|measured|burned|burnt|ignited|demonstrated|proved|extinguished)\b/i.test(claim)&&!/\b(?:planned|expected|anticipated|might|hypothetical|would|could)\b/i.test(claim))return step('unavailable','This page supplies design assumptions. A past-tense flight result needs a separate source.');
    }
    if(/(?:safe for (?:any|all)|fireproof|guarantee[sd]?|certif(?:ied|ies) safe)/i.test(claim))return step('fail','This source cannot establish an unrestricted safety claim.');
    return step('pass','No registered scope conflict detected.');
  }
  const modelRevision='fe99b998d5f23bdf292de21462a3dd01d8020487';
  const assets=[
    ['vocab.txt','07eced375cec144d27c900241f3e339478dec958f92fddbc551f295c992038a3'],
    ['onnx/model_quantized.onnx','1dc36bc1f41b1d1da9e8f28f69f8dc6fa316410b2cde057756ddfb7083a48021']
  ];
  let nliPromise;
  async function publicAsset(name,hash){
    const url='https://huggingface.co/Xenova/mobilebert-uncased-mnli/resolve/'+modelRevision+'/'+name;
    let cache=null;
    try{cache=await globalThis.caches?.open('first-fire-nli-'+modelRevision);}catch{}
    const cached=await cache?.match(url);
    let bytes=cached?await cached.arrayBuffer():null;
    if(bytes&&hex(await crypto.subtle.digest('SHA-256',bytes))===hash)return bytes;
    const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw Error('Could not download the browser model.');
    bytes=await response.arrayBuffer();
    if(hex(await crypto.subtle.digest('SHA-256',bytes))!==hash)throw Error('The model download failed its checksum.');
    try{await cache?.put(url,new Response(bytes));}catch{}
    return bytes;
  }
  async function loadModel(){
    if(!nliPromise)nliPromise=(async()=>{
      const [ort,vocab,model]=await Promise.all([import('./vendor/referee/ort.wasm.min.mjs'),...assets.map(([file,hash])=>publicAsset(file,hash))]);
      ort.env.wasm.numThreads=1;
      ort.env.wasm.wasmPaths=new URL('vendor/referee/',document.baseURI).href;
      const session=await ort.InferenceSession.create(model,{executionProviders:['wasm']});
      const words=new TextDecoder().decode(vocab).trimEnd().split(/\r?\n/);
      return {ort,session,vocab:new Map(words.map((word,i)=>[word,i]))};
    })().catch(err=>{nliPromise=null;throw err;});
    return nliPromise;
  }
  function wordPieces(text,vocab){
    const out=[];
    for(const token of text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().match(/[a-z0-9]+|[^\s\p{C}]/gu)||[]){
      let pos=0;const parts=[];
      while(pos<token.length){
        let end=token.length,id;
        while(end>pos){id=vocab.get((pos?'##':'')+token.slice(pos,end));if(id!==undefined)break;end--;}
        if(end===pos){parts.splice(0,parts.length,vocab.get('[UNK]'));break;}
        parts.push(id);pos=end;
      }
      out.push(...parts);
    }
    return out;
  }
  async function infer(quote,claim){
    const {ort,session,vocab}=await loadModel();
    const prem=wordPieces(quote,vocab),hyp=wordPieces(claim,vocab);
    if(prem.length+hyp.length+3>512)throw Error('Shorten the quotation or claim to fit the model input.');
    const cls=vocab.get('[CLS]'),sep=vocab.get('[SEP]');
    const ids=[cls,...prem,sep,...hyp,sep];
    const types=ids.map((_,i)=>i<prem.length+2?0:1);
    const values={input_ids:ids,attention_mask:ids.map(()=>1),token_type_ids:types};
    const inputs=Object.fromEntries(session.inputNames.map(name=>[name,new ort.Tensor('int64',BigInt64Array.from(values[name],BigInt),[1,ids.length])]));
    const output=await session.run(inputs);const tensor=output[session.outputNames[0]];
    const logits=Array.from(tensor.data);
    for(const value of Object.values(inputs))value.dispose();
    for(const value of Object.values(output))value.dispose();
    if(logits.length!==3||!logits.every(Number.isFinite))throw Error('Unusable model result.');
    const winner=logits.indexOf(Math.max(...logits));
    return ['supported','insufficient','contradicted'][winner];
  }
  async function evaluate(key,quote,claim,{live=false}={}){
    const src=sourceFor(key), binding=await digest(JSON.stringify([key,src.doc.sha256,quote,claim]));
    const reviewed=receipts().cases.find(r=>r.binding===binding);
    const exact=await exactMatch(src.anchor,quote);
    const quotation=step(exact?'pass':'fail',exact?'The ordered words match the cited page fingerprint.':'The quoted wording does not occur at the cited location.');
    const scope=scopeCheck(key,claim);
    const numeric=quantitative(key,claim,quote,reviewed);
    let semantic=step('unavailable','This wording has no saved independent review. Enable the on-device model to test a new claim.');
    if(!exact)semantic=step('unavailable','Check the source quotation first.');
    else if(live){
      try{
        const verdict=await infer(quote,claim);
        semantic=step(verdict==='supported'?'pass':'fail','MobileBERT MNLI, evaluated here against your excerpt. Verdict: '+labelFor[verdict].toLowerCase()+'.');
      }catch(error){semantic=step('unavailable','Model unavailable. '+error.message);}
    } else if(reviewed){
      semantic=step(reviewed.verdict==='supported'?'pass':'fail','Gemma 3 1B reviewed this exact statement against the pinned source page. Verdict: '+labelFor[reviewed.verdict].toLowerCase()+'.');
    }
    const checks=[quotation,semantic,numeric,scope];
    const certified=checks.every(s=>s.state==='pass'||s.state==='na');
    const state=certified?'supported':checks.some(s=>s.state==='fail')?'rejected':'unverified';
    return {state,quotation,semantic,numeric,scope,src};
  }
  function el(tag,text,cls){
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  }
  function link(text,url){
    const a=el('a',text);a.href=url;
    if(url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}
    return a;
  }
  function button(text,action,cls='ghost'){
    const b=el('button',text,cls);b.type='button';b.onclick=action;return b;
  }
  function field(text,control){const label=el('label',text,'field');label.append(control);return label;}
  function describe(result){
    const body=el('div',undefined,'rf-report');
    const heading={supported:'Source supports this claim',rejected:'Claim withheld',unverified:'Evidence check incomplete'}[result.state];
    body.append(el('h3',heading));
    for(const [name,item] of [['Quotation',result.quotation],['Independent model',result.semantic],['Number check',result.numeric]]){
      const row=el('div',undefined,'rf-check'), verdict={pass:'Passed',fail:'Failed',na:'Not applicable',unavailable:'Unverified'}[item.state];
      const title=el('strong',name+' · '+verdict);
      row.dataset.state=item.state;row.append(title,el('p',item.reason));body.append(row);
    }
    if(result.scope.state==='fail')body.append(el('p',result.scope.reason,'note'));
    body.append(link(result.src.title+' · '+result.src.locator+' ↗',result.src.url));
    return body;
  }
  async function deviceInfo(nav=globalThis.navigator){
    const ram=Number(nav.deviceMemory)||null;
    const cores=Number(nav.hardwareConcurrency)||null;
    let free=null;
    try{const storage=await nav.storage?.estimate();if(storage&&Number.isFinite(storage.quota)&&Number.isFinite(storage.usage))free=storage.quota-storage.usage;}catch{}
    const wasm=typeof WebAssembly==='object';
    return {limited:!wasm||(ram!==null&&ram<=2)||(cores!==null&&cores<=2)||(free!==null&&free<65e6)||Boolean(nav.connection?.saveData),
      ram,cores,free,webGPU:Boolean(nav.gpu),wasm};
  }
  function route(question){
    const q=question.normalize('NFKC').toLowerCase();
    if(/\b(?:fake quote|check (?:a|this|my) (?:quote|claim)|canary|referee|errors (?:log|page))\b/.test(q))return ['Referee','#referee','Test the quoted wording, its interpretation and any supported calculation.'];
    if(/\b(?:rover|chassis|wheelbase|battery pack|sandbox)\b/.test(q))return ['Rover sandbox','#physics?mode=rover','Choose a cabin, chassis and power configuration to model a sealed compartment.'];
    if(/\b(?:hospital|gaganyaan|mine ventilation|submarine|aircraft cabin)\b/.test(q))return ['At Home','#earth','Inspect the transfer limits and original Earth-application sources.'];
    if(/\b(?:flame temperature|adiabatic|sealed.cabin|mass balance|heat release|co2 production|physics lab)\b/.test(q))return ['Physics lab','#physics','Set the atmosphere, fuel and compartment size for a model calculation.'];
    if(/\b(?:rulebook|audit (?:a|the) rule|fire.safety rules?)\b/.test(q))return ['Rulebook','#rulebook','Look up a rule, its source and the evidence for transferring it across gravity regimes.'];
    if(/\b(?:passport|passports)\b/.test(q))return ['Investigation passports','#passports','Open an investigation’s sampling conditions and source tables.'];
    if(/\b(?:closest|nearest|rank(?:ing)?)\b.*\b(?:habitat|lunar|atmosphere|oxygen)|\bcompass\b/.test(q))return ['Compass','#compass','Set the target habitat and compare its conditions with experimental records.'];
    if(/\b(?:atlas|coverage map|map (?:all|the) (?:burns|experiments|investigations))\b/.test(q))return ['Atlas','#atlas','Explore coverage by gravity and starting atmosphere.'];
    if(/\b(?:fm2|lunar burn|moon burn|synergy pro|brier)\b/.test(q))return ['FM² forecast','#forecast','Examine the four planned burns, assumed threshold and hypothetical scoring.'];
    return null;
  }
  function forecastAnswer(message,previousTurns=[]) {
    const question=message.normalize('NFKC').toLowerCase();
    const explicit=/\b(?:fm2|lunar (?:burn|fabric)|synergy pro)\b/.test(question);
    const resumed=previousTurns.at(-1)?.evidenceKind==='calculation' && /^(?:and |then |what (?:about|if) |at |with |use |set )/.test(question);
    if(!explicit&&!resumed)return null;
    if(!resumed&&!/\b(?:probabilit(?:y|ies)|odds|chance|predict\w*|forecast|likely|calculate|calculat(?:e|ion))\b/.test(question))return null;
    if(/\b(?:actual|observed|confirmed|measured|already|crew|brier|length|distance|temperature|speed|certif\w*|safe|ignition|ignite|mars|earth|partial pressure|mass fraction|preregister\w*|timestamp\w*|digest|hash|hashes|proposal|submission)\b/.test(question))return null;
    const data=archive()?.forecast, engine=globalThis.FFForecastMath;
    if(!data||!engine)return null;
    const levels=data.burns.map(b=>b.oxygen_pct), low=levels.at(-1), high=levels[0];
    const hint=()=>({answer:'Give one planned starting oxygen level ('+levels.join('%, ')+'%) for the chance of sustained spread after power-off. You can also specify a mean limit of 22–30% and a standard deviation of 0.5–4 percentage points.',status:'limited',sources:[],mode:'navigation',evidenceKind:'input-needed'});
    const values={};
    const assumption=/\b(mean(?: (?:oxygen )?(?:limit|threshold))?|mu|μ|sigma|σ|sd|standard deviation)\s*(?:=|:|of|at|to|is)?\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:%|percent(?:age)?(?: points?)?)?/gu;
    let rest=question.replace(assumption,(_,key,value)=>{
      const field=/^mean|^mu$|^μ$/u.test(key)?'mean':'sigma';
      values[field]=field in values?NaN:Number(value);
      return ' ';
    }).replace(/\bfm2\b|\bo2\b/gu,' ');
    // Unicode Greek parameter names have no ASCII word boundary.
    rest=rest.replace(/([μσ])\s*(?:=|:|of|at|to|is)?\s*([-+]?(?:\d+(?:\.\d+)?|\.\d+))\s*%?/gu,(_,key,val)=>{
      const field=key==='μ'?'mean':'sigma';values[field]=field in values?NaN:Number(val);return ' ';
    });
    if(/\b(?:mean|sigma|mu|sd|standard deviation|psia|pressure|voltage|chamber volume|humidity|helium)\b|[μσ]/u.test(rest))return hint();
    const inherited=resumed?previousTurns.at(-1).calculation:null;
    const m=values.mean??inherited?.mean??data.model.mu_o2_pct;
    const sd=values.sigma??inherited?.sigma??data.model.sigma_pp;
    if(!Number.isFinite(m)||m<22||m>30||!Number.isFinite(sd)||sd<.5||sd>4)return hint();
    const matches=[...rest.matchAll(/([-+]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:%|percent\b)/g)];
    const leftover=rest.replace(/([-+]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:%|percent\b)/g,' ');
    if(matches.length>1||/\d|\bignit\w*\b/.test(leftover))return hint();
    const x=matches.length?Number(matches[0][1]):inherited?.oxygen;
    if(!levels.includes(x)||x<low||x>high)return hint();
    const p=engine.probability(x,m,sd), chance=engine.modelPercent(p);
    const z=Number(((x-m)/sd).toFixed(3));
    const source=sourceFor('fm25');
    return {answer:'At '+x+'% starting oxygen, the threshold model gives a '+chance+' chance of sustained spread after the igniter switches off. [1]'+
      '\n\nUsing mean limit μ = '+m+'% O₂ and standard deviation σ = '+sd+' percentage points, P(spread) = Φ(('+x+' − '+m+') / '+sd+') = Φ('+z+'). [1]'+
      '\n\nNASA specifies the starting atmosphere for a planned test. The percentage above is a model calculation. [2]',
      status:'answered',evidenceKind:'calculation',mode:'calculator',calculation:{oxygen:x,mean:m,sigma:sd},
      sources:[{id:'forecast:formula',title:'FIRST FIRE forecast method',url:'#report/forecast',locator:'Reproduce the illustrative model · normal threshold CDF'},
      {id:source.id,title:source.title,url:source.url,locator:source.locator}]};
  }
  function preferences(owner){
    const panel=window.FFReaderDevice.preferences(owner);
    panel.append(window.FFReaderDevice.devicePanel());
    return panel;
  }
  const faq=[
    ['nomex',/\bnomex\b.*\bignit|\bignit\w*\b.*\bnomex\b/i],
    ['acrylic',/\b(?:saffire|sample 2-7)\b.*\b(?:which (?:part|material)|pmma|acrylic)\b/i],
    ['flex-155',/\b(?:flex[- ]?155|c03h201)\b/i],
    ['flex-120',/\b(?:flex[- ]?120|c12h201)\b/i],
    ['extinction',/\b(?:sibal|luci)\b.*\b(?:45|longer|extinct\w*|duration|sooner)\b/i],
    ['teflon',/\bteflon\b.*\b(?:miss\w*|smoke|detect\w*)|\b(?:miss\w*|detect\w*)\b.*\bteflon\b/i],
    ['kapton',/\bkapton\b.*\b(?:miss\w*|smoke|detect\w*)|\b(?:miss\w*|detect\w*)\b.*\bkapton\b/i],
    ['burner',/\b(?:cfi[- ]?g|inverse burner)\b.*\b(?:sequence|first|before|order)\b/i],
    ['velocity',/\blunar.gravity\b.*\b(?:flow )?velocity\b/i],
    ['plastic',/\bpolycarbonate\b.*\b(?:extinction|gravity|limit)|\bextinction\b.*\bpolycarbonate/i],
    ['lunar',/\b(?:fm2|lunar|synergy)\b.*25\s*%.*\bignit\w*/i],
    ['lunar-design',/\b(?:fm2|lunar)\b.*\b(?:how many|number of)\b.*\b(?:burns|tests)\b|how many (?:burns|tests)\b.*\b(?:fm2|moon|lunar)\b/i]
  ];
  const comparableURL=url=>String(url||'').split('#')[0];
  const bareSource=({id,title,url,locator})=>({id,title,url,locator});
  function withheld(answer,reason='I don’t have a source that verifies an answer to that question. Try an experiment name and the measurement you need.') {
    return {mode:answer.mode,model:answer.model,answer:reason,status:'abstained',sources:[],evidenceKind:'withheld'};
  }
  async function archivedReading(message,answer) {
    const collection=archive(), all=globalThis.FFRefereePassages||[], paragraphs=[],sources=[];
    function append(text,source) {
      if(!text||!source||paragraphs.some(p=>p.text===text))return;
      let index=sources.findIndex(s=>s.id===source.id&&s.url===source.url);
      if(index<0){index=sources.push(bareSource(source))-1;}
      paragraphs.push({text,index});
    }
    // Local service supplies IDs. Only text and locators independently reconstructed here may be displayed.
    for(const cited of answer.sources||[]) {
      const pinned=all.find(p=>p.id===cited.id&&p.url===cited.url&&p.locator===cited.locator);
      if(pinned&&answer.answer.includes(pinned.text))append(pinned.text,pinned);
      if(collection?.incidents?.sources[cited.id]?.url===cited.url) {
        for(const record of collection.incidents.records)for(const facts of Object.values(record.facts))for(const fact of facts) {
          if(fact.source===cited.id&&answer.answer.includes(fact.text))append(fact.text,collection.incidents.sources[cited.id]);
        }
      }
      const id=cited.id?.match(/:(PSI-\d+:\d+:\d+)$/)?.[1];
      const row=id&&(collection?.tests||[]).find(r=>r.record_id===id&&r.source_url===cited.url);
      if(row) {
        const fields=[['material','Material'],['instrument_id','Instrument ID'],['o2_initial_pct','Initial ambient oxygen (%)'],['o2_final_pct','Final ambient oxygen (%)'],['o2_burner_pct','Burner oxygen (%)'],['fuel_ambient_initial_pct','Initial ambient fuel (%)'],['reported_pressure','Source pressure ('+(row.reported_pressure_unit||'unreported unit')+')'],['flow_cm_s','Flow (cm/s)'],['burn_time_s','Recorded duration (s)'],['oxygen_flow_mg_s','Oxygen flow (mg/s)'],['hot_ignition','Hot ignition'],['termination_code','Termination'],['outcome','Reported outcome'],['initial_diameter_mm','Initial droplet diameter (mm)'],['visible_extinction_diameter_mm','Visible-extinction diameter (mm)']];
        const values=fields.filter(([key])=>row[key]).map(([key,name])=>name+' '+row[key]);
        append(row.accession+' test '+row.test_id+', '+row.gravity_regime+'. '+values.join(' · '),{id:row.record_id,title:'NASA PSI · '+row.test_id,url:row.source_url,locator:row.source_file+', CSV row '+row.source_row});
      }
    }
    const c=collection?.cases?.find(c=>c.id===answer.caseId);
    if(c&&answer.mode==='archive') {
      const source={id:c.id,title:'FIRST FIRE case notes · '+c.short,url:'#case/'+c.id,locator:c.sources[0].locator};
      const field=answer.item==='next'?'next':answer.item==='limits'?'limit':'record';
      if(answer.answer.includes(c[field]))append((field==='next'?'Suggested next test\n':'')+c[field],source);
      if(paragraphs.length) {
        const cited=c.sources[0];
        sources.push(bareSource({id:cited.anchor||c.id+':publication',...cited}));
      }
    }
    if(!paragraphs.length)return withheld(answer);
    const measurements=/\b(?:seconds?|minutes?|duration|how long|temperature|heat release|pressure|mass flow|spread (?:speed|rate))\b/i;
    if(measurements.test(message)) {
      const wanted=[[/seconds?|minutes?|duration|how long/i,/seconds?|minutes?|duration|\b(?:s|ms)\b/i],[/temperature/i,/temperature|kelvin|degrees/i],[/pressure/i,/pressure|psia|atm|bar/i],[/heat release/i,/heat release|kilowatt|\bkW\b/i],[/mass flow/i,/mass flow|mg\/s|kg\/s/i],[/spread (?:speed|rate)/i,/mm\/s|cm\/s|spread (?:speed|rate)/i]];
      if(wanted.some(([asked,measured])=>asked.test(message)&&!paragraphs.some(p=>measured.test(p.text)))) {
        return {...answer,status:'abstained',evidenceKind:'withheld',answer:'The retrieved records do not establish that measurement for the conditions in your question.',sources:sources.map(bareSource)};
      }
    }
    const isMission=sources.some(s=>s.id?.startsWith('apollo'));
    // The optional WebGPU model can choose the lead only from independently reconstructed evidence.
    // It cannot introduce text or drop associated source conditions from the response.
    const readerModel=globalThis.FFReaderDevice;
    let selected=null;
    if(readerModel?.isModelReady()){
      const candidates=paragraphs.map((p,i)=>({id:String(i+1),text:p.text}));
      selected=await readerModel.selectEvidence(message,candidates);
      const index=candidates.findIndex(c=>c.id===selected);
      if(index>0)paragraphs.unshift(paragraphs.splice(index,1)[0]);
    }
    const body=paragraphs.map(({text,index})=>text+' ['+(index+1)+']').join('\n\n');
    return {...answer,status:'limited',evidenceKind:isMission?'mission-note':'archive-note',answer:body,sources,...(selected?{selection:{provider:'WebLLM',model:'SmolLM2-360M-Instruct-q4f32_1-MLC',leadSource:sources[paragraphs[0].index].id}}:{})};
  }
  function withinQuestion(item,q) {
    if(/\b(?:next|why|safer?|certify|minutes?|kilowatts?|temperature|compare|percentage points|what if|how fast|pressure|velocity at|melt|alarm time|cause|caused)\b/i.test(q))return false;
    if(/\b(?:diameter|size|instrument|camera|denominator|observations?|indicators?|plateau|how (?:much|many) (?:heat|energy)|what (?:evidence|measurements?)|which (?:signals?|measurements?)|where|when)\b/i.test(q))return false;
    const digits=q.match(/\d+(?:\.\d+)?/g)||[];
    const allow={
      nomex:['2','7'],acrylic:['2','7'],'flex-155':['155','03','201'],'flex-120':['120','12','201'],
      extinction:['1','45'],teflon:[],kapton:[],burner:[],plastic:[],velocity:[],
      lunar:['2','25'],'lunar-design':['2']
    };
    if(!digits.every(n=>(allow[item.id]||[]).includes(n)))return false;
    if(/^flex-/.test(item.id)&&!/cool.?flame|vapor|visible|extinguish|extinction|what happened|what did.*(?:show|find)|tell me about/i.test(q))return false;
    if(item.id==='nomex'&&/\b(?:earth|moon|lunar|mars|ground|future|always|all materials)\b/i.test(q))return false;
    if(item.id==='lunar'&&/observed|did .*ignite|actual|flight result/i.test(q))return false;
    return true;
  }
  async function checkedReply(message,answer){
    if(answer.status==='abstained'){
      const known=archive()?.incidents?.messages||{};
      const guard=Object.values(known).find(t=>typeof t==='string'&&t===answer.answer);
      return guard?{...withheld(answer),answer:guard}:withheld(answer);
    }
    if(!archive()?.tests?.length && answer.sources.some(s=>/:(PSI-\d+:\d+:\d+)$/.test(s.id||''))) {
      try{await globalThis.FFLoadAsset?.('observation-rows.js');}catch{/* Fall back to any other archived passages. */}
    }
    if(!receipts()||!archive()?.evidence||!globalThis.crypto?.subtle)return archivedReading(message,answer);
    const q=message.normalize('NFKC');
    if(/\b(?:invent|fabricate|make up)\b/i.test(q)&&/\b(?:observed|denominator|measurement|reported count)\b/i.test(q))return withheld(answer,'I cannot establish a count, denominator or measurement by inventing it. An observed result needs a published record for that subset.');
    if (/\bapollo\b/i.test(q) && /\b(?:nomex|saffire|flex[- ]?\d*|sibal|luci|teflon|rover|gaganyaan|hospital|fm2)\b/i.test(q)) {
      return withheld(answer,'I don’t have a source that establishes that comparison. Ask about either case individually to see its documented conditions.');
    }
    const match=faq.find(([,pattern])=>pattern.test(q));
    if(!match)return archivedReading(message,answer);
    const item=receipts().cases.find(c=>c.id===match[0]);
    if(!withinQuestion(item,q))return archivedReading(message,answer);
    const src=sourceFor(item.anchor);
    if(!answer.sources.some(s=>[src.doc.url,src.doc.canonical_url].filter(Boolean).some(u=>comparableURL(s.url)===comparableURL(u))))return archivedReading(message,answer);
    const result=await evaluate(item.anchor,item.quote,item.claim);
    if(result.quotation.state!=='pass')return withheld(answer);
    const source={id:item.anchor,title:src.title,url:src.url,locator:src.locator};
    if(result.state!=='supported'){
      return {...answer,status:'limited',evidenceKind:'quote-only',answer:'“'+item.quote+'” [1]',sources:[source],reviewId:item.id};
    }
    if(item.id==='acrylic'&&/\bnomex\b/i.test(q)){
      const companion=receipts().cases.find(c=>c.id==='nomex');
      const extra=await evaluate(companion.anchor,companion.quote,companion.claim);
      if(extra.state==='supported'&&companion.anchor===item.anchor) {
        return {...answer,answer:item.claim+' [1]\n\n'+companion.claim+' [1]',evidenceKind:'checked',sources:[source],reviewIds:[item.id,companion.id]};
      }
    }
    let text=item.claim+' [1]';
    if(globalThis.FFAwareness?.level?.()==='advanced')text+='\n\nSource language: “'+item.quote+'” [1]';
    return {...answer,answer:text,evidenceKind:'checked',sources:[source],reviewId:item.id};
  }
  function proof(id){
    const entry=receipts()?.cases.find(c=>c.id===id);
    if(!entry)return null;
    const details=el('details',undefined,'rf-proof'),summary=el('summary','Check this answer');
    details.append(summary);
    let rendered=false;
    details.ontoggle=async()=>{
      if(!details.open||rendered)return;
      rendered=true;
      try{const res=await evaluate(entry.anchor,entry.quote,entry.claim);details.append(describe(res));}
      catch{details.append(el('p','The source receipt could not be checked in this browser.'));}
    };
    return details;
  }
  const casesFor=()=>receipts().cases.filter(c=>!c.fixture);
  async function publicErrors(box){
    box.replaceChildren(el('p','Rechecking the public evidence…'));
    const rows=el('div',undefined,'rf-errors');
    for(const item of receipts().cases){
      const result=await evaluate(item.anchor,item.quote,item.claim);
      if(result.state==='supported')continue;
      const card=el('details');
      card.append(el('summary',item.claim),el('p',item.fixture?'Published challenge claim':'Archived candidate paraphrase','footnote'),describe(result));rows.append(card);
    }
    const first=receipts().cases[0];
    const bad='Despite this significant heating load, the fabric was ignited.';
    const canary=await evaluate(first.anchor,bad,first.claim);
    const swapped=el('details');
    swapped.append(el('summary','Planted quotation with a missing “not”'),el('blockquote',bad),describe(canary));
    rows.prepend(swapped);
    const duration=receipts().cases.find(item=>item.id==='extinction');
    const altered=duration.claim.replace('45 seconds','45 minutes');
    const unitCheck=await evaluate(duration.anchor,duration.quote,altered);
    const unit=el('details');
    unit.append(el('summary','Planted unit change · 45 seconds becomes 45 minutes'),el('blockquote',altered),describe(unitCheck));
    rows.append(unit);
    box.replaceChildren(el('h2','Public error log'),el('p','These are the rejected and unresolved candidates from this published release, including deliberate counterexamples. Each entry replays its checks. Visitor submissions stay on their device.'),rows);
  }
  function renderDeckReferee(root,params=new URLSearchParams()){
    root.replaceChildren();
    const header=el('header',undefined,'pagetitle');
    header.append(el('span','Evidence audit','eyebrow'),el('h1','The Referee'),el('p','Verify a quotation, test the claim it supports, and check any reported quantity.','sub'));
    const nav=el('nav',undefined,'rf-nav');nav.setAttribute('aria-label','Referee views');
    const errors=params?.get?.('view')==='errors';
    for(const [text,href,selected] of [['Check a claim','#referee',!errors],['Public error log','#referee?view=errors',errors]]){
      const a=link(text,href);a.className=selected?'btn':'ghost';if(selected)a.setAttribute('aria-current','page');nav.append(a);
    }
    root.append(header,nav);
    if(!receipts()||!archive()?.evidence){root.append(el('p','This copy is missing the source receipts or independent review file.'));return;}
    if(errors){
      const log=el('section',undefined,'section panel stack');root.append(log);
      if(globalThis.FFEvidenceDesk)root.append(globalThis.FFEvidenceDesk.auditPanel());
      publicErrors(log).catch(()=>log.replaceChildren(el('p','Could not verify the public fixtures in this browser.')));return;
    }
    const layout=el('div',undefined,'rf-layout section'), form=el('form',undefined,'panel stack'), aside=el('aside',undefined,'panel stack');
    const selector=el('select');
    const known=casesFor();
    for(const item of known){const o=el('option',sourceFor(item.anchor).locator+' · '+item.claim);o.value=item.id;selector.append(o);}
    const quote=el('textarea'), claim=el('textarea');quote.maxLength=1400;claim.maxLength=700;
    const notice=el('p','','footnote');notice.setAttribute('role','status');
    const status=el('p','Select a statement to inspect its source.','footnote');
    const results=el('div');results.setAttribute('aria-live','polite');
    const live=el('input');live.type='checkbox';
    const toggle=el('label',undefined,'rf-live');toggle.append(live,document.createTextNode('Run a new review on this device'));
    const dev=el('p','','footnote');
    const advanced=el('details');advanced.append(el('summary','Custom claim review'),toggle,
      el('p','The first run fetches about 38 MB of pinned MobileBERT and browser runtime files. Only public model assets are requested. Your words stay here.','footnote'),dev);
    deviceInfo().then(info=>{
      const why=info.limited?'Light mode is preferred on this device. Saved reviews work without downloading weights.':'Saved reviews work offline. Enable the model to test an edited claim against the exact excerpt.';
      const hardware=[info.ram?info.ram+' GB approximate memory':'memory unreported',info.webGPU?'WebGPU interface present':'WebGPU interface unavailable',info.free!==null?Math.floor(info.free/1e6)+' MB available storage':'storage unreported'];
      dev.textContent=why+' '+hardware.join(' · ')+'.';
      if(globalThis.FFAwareness?.tier?.()==='lite'){live.disabled=true;dev.textContent+=' Lite uses saved reviews. Select Standard or Pro for a new model review.';}
      if(!info.wasm||location.protocol==='file:'){live.disabled=true;dev.textContent+=' Live inference requires WebAssembly and an HTTP(S) site.';}
    });
    let revision=0;
    function clear(){
      revision++;results.replaceChildren();notice.textContent='';delete notice.dataset.match;
    }
    function restore(){
      clear();
      const item=known.find(i=>i.id===selector.value), src=sourceFor(item.anchor);
      quote.value=item.quote;claim.value=item.claim;
      status.replaceChildren(link(src.title+' · '+src.locator+' ↗',src.url));
    }
    const check=el('button','Run all checks','btn');check.type='submit';
    const wording=button('Check wording',async()=>{
      clear();const version=revision;
      const item=known.find(i=>i.id===selector.value);
      try{const yes=await exactMatch(sourceFor(item.anchor).anchor,quote.value);if(version!==revision)return;notice.dataset.match=yes?'yes':'no';notice.textContent=yes?'Exact wording found on the cited page.':'No exact occurrence on the cited page.';}
      catch{if(version===revision)notice.textContent='Could not read the source receipt in this browser.';}
    });
    form.onsubmit=async e=>{
      e.preventDefault();clear();
      const version=revision,item=known.find(i=>i.id===selector.value);
      if(!quote.value.trim()||!claim.value.trim()){notice.textContent='Enter both a quotation and a claim.';return;}
      notice.textContent=live.checked?'Loading the local reviewer and checking the passage…':'Checking the published review and source…';
      try{
        const result=await evaluate(item.anchor,quote.value.trim(),claim.value.trim(),{live:live.checked});
        if(version!==revision)return;
        notice.dataset.match=result.quotation.state==='pass'?'yes':'no';notice.textContent='';
        results.append(describe(result));
      }catch{if(version===revision)notice.textContent='Unable to complete the checks. Try a secure browser or localhost.';}
    };
    selector.onchange=restore;quote.oninput=claim.oninput=live.onchange=clear;
    const buttons=el('div',undefined,'actions');buttons.append(check,wording,button('Restore example',restore));
    form.append(el('h2','Inspect a statement'),field('Source and example',selector),status,field('Quotation to verify',quote),field('Claim to test',claim),advanced,buttons,notice,results);
    const canary=button('Test the planted quote',()=>{
      selector.value='nomex';restore();live.checked=false;quote.value='Despite this significant heating load, the fabric was ignited.';form.requestSubmit();
    },'ghost');
    aside.append(el('h2','Try to break it'),el('p','Removing one word reverses the meaning of the Saffire-II report. Run the altered quotation through the same checks.'),canary,
      el('h3','What a pass means'),el('p','The source contains the quoted words. A second model supports the submitted interpretation. Registered calculations must agree on quantities and units. A claim outside the measured conditions still needs new evidence.'),
      el('p','Saved verdicts use Gemma 3 1B on the pinned page. New on-device verdicts use MobileBERT on your excerpt. These classifiers can disagree or miss a false claim.','footnote'),link('Inspect the public error log →','#referee?view=errors'));
    layout.append(form,aside);root.append(layout);restore();
    const chatDraft=params?.get?.('draft')==='1'&&globalThis.FFEvidenceDesk?.getDraft();
    if(chatDraft){
      const entry=known.find(r=>r.anchor===chatDraft.key);
      if(entry){selector.value=entry.id;restore();}
      quote.value=chatDraft.quote;claim.value=chatDraft.claim;
      notice.textContent=entry?'Quotation and interpretation brought over from chat.':'Choose the intended source, then enter or edit the quotation and interpretation.';
    }
  }
  globalThis.renderDeckReferee=renderDeckReferee;
  globalThis.FFDeckReferee={route,preferences,deviceInfo,forecastAnswer,checkedReply,proof,evaluate,wordPieces,quantitative,exactMatch};
})();
