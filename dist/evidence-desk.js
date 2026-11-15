/* All live chat completions pass through this gate before display. Source excerpts,
   model outputs and measured data have distinct verification requirements. */
(() => {
  'use strict';
  const version='master-v1.1';
  const replyConfidence=globalThis.FFReplyCalibration || (typeof require==='function'?require('./reply-calibration.js'):null);
  const replyConfidenceFit=globalThis.FFReplyCalibrationFit || (typeof require==='function'?require('./reply-calibration-fit.js'):null);
  const pass=reason=>({state:'pass',reason}), na=reason=>({state:'na',reason}), fail=reason=>({state:'fail',reason});
  const limited=reason=>({state:'unavailable',reason});
  const base={beginner:1,intermediate:1,advanced:.70,complex:.65,challenge:.55};
  const noFigures='The archive does not establish this for those conditions. Name the experiment, the measured endpoint and the source record you want to check.';
  const sourceRow=r=>({id:r.record_id,title:r.accession+' · '+r.test_id,url:r.source_url,locator:r.source_file+' · CSV row '+r.source_row+' · DOI '+r.doi});
  const clarify=answer=>({mode:'navigation',evidenceKind:'input-needed',status:'limited',sources:[],answer});
  const decline=answer=>({mode:'archive',evidenceKind:'withheld',status:'abstained',sources:[],answer:answer||noFigures});
  const typed=(answer,sources,tool)=>({status:'answered',mode:'calculator',answer,sources,evidenceKind:'tool-calculation',tool});
  const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
  function level(q){
    if(/\b(?:counterfactual|confound|uncertainty|causal|calibrat|brier|denominator|invalid|transfer|certif)/i.test(q))return 'challenge';
    if(/\b(?:compare|difference|matched|quantile|median|extrapolat|joint|recompute)/i.test(q))return 'complex';
    if(/\b(?:pressure|cutoff|heat release|extinction|diameter|probability|oxygen limit|density|interpret)/i.test(q))return 'advanced';
    if(/\b(?:how|why|which|when|where)\b/i.test(q))return 'intermediate';
    return 'beginner';
  }
  function confidence(difficulty,c,matches){
    const rate=base[difficulty]??.65;
    const spatial=[.35,.55,.75,1][Math.min(3,Math.max(0,matches))];
    if(c.scope.state!=='pass'||c.quote.state==='fail'||c.quantity.state==='fail'||c.quantity.state==='unavailable'){
      return {label:'Not established',value:null,difficulty,rate,match:matches,factors:[],reason:c.scope.state!=='pass'?c.scope.reason:c.quote.state==='fail'?c.quote.reason:c.quantity.reason};
    }
    const interpretation=c.interpretation.state==='pass'||c.interpretation.state==='na'?1:.7;
    const factors=[['Benchmark base · '+difficulty,rate],['Source check',1],['Interpretation',interpretation],['Quantity',1],['Gravity, oxygen, pressure',spatial]];
    const value=rate*interpretation*spatial;
    return {label:value>=.8?'High':value>=.5?'Medium':'Low',value,difficulty,rate,match:matches,factors,
      reason:c.interpretation.reason+' Matched environmental fields: '+matches+' of 3.'};
  }
  function ruleFor(q){
    const rules=globalThis.FFMissionDesk?.rules||[];
    const topic=[['ices',/earth|ground.test|pass.*test/i],['sibal',/fan|ventilat|flow.*off/i],['saffire',/coupon|scale|size|small.*large/i],
      ['flex',/visible|lights?.?out|invisible/i],['same',/detector|smoke|alarm/i],['cfig',/burner|jet|gas stream/i]];
    return topic.map(([id,rx])=>rx.test(q)&&rules.find(r=>r.id===id)).find(Boolean);
  }
  function toolAnswer(intent,q,ff){
    const p=intent.params||{};
    if(intent.type==='forecast' && /\binterval\b/i.test(q) && /\b(?:threshold|oxygen limit|signed|published|locked)\b/i.test(q)){
      const {mu_o2_pct:mean,sigma_pp:sd}=ff.forecast.model,z=1.2815515655446004;
      if(/\b(?:99|95|90|50)\s*%|hypothetical|\bif\b/i.test(q))return clarify('The preregistered threshold interval uses its published assumptions. Open the forecast to enter a different scenario.');
      return typed('The signed forecast uses a central 80% model interval for the unknown oxygen threshold. With mean '+mean+'% oxygen and standard deviation '+sd+' percentage points, the bounds are '+(mean-z*sd).toFixed(2)+'% and '+(mean+z*sd).toFixed(2)+'% oxygen. [1]\n\nThese are assumptions about a future measurement. They describe the forecast distribution.',
        [{id:'fm2-lock',title:'FIRST FIRE signed FM² forecast',url:'#forecast',locator:'Locked threshold model and timestamp receipt'}],{type:'forecast',params:p,matches:0});
    }
    if(intent.type==='compass'){
      const all=['gravity','oxygen','pressure','phase'];
      if(!all.every(k=>p[k]!==undefined)||p.gravity<0||p.gravity>3||p.oxygen<0||p.oxygen>100||p.pressure<=0||p.pressure>100)
        return clarify('Give the gravity, ambient oxygen, absolute pressure and test subject (solid, liquid, gas or smoke) to rank habitat evidence. Open Compass to enter any missing conditions.');
      const eligible=ff.tests.filter(r=>r.phase===p.phase&&!(r.phase==='gas'&&r.direction==='inverse'));
      const joint=globalThis.FFJointCoverage(eligible,[p.gravity,p.oxygen,p.pressure]);
      const ranked=globalThis.FFRankInvestigations(eligible,[p.gravity,p.oxygen,p.pressure],[1,1,1]).slice(0,3);
      const sources=[{id:'compass-source',title:'Normalized NASA PSI observation table',url:'data/tests.csv',locator:'Full population for the phase selection, excluding inverse gas burners.'},...ranked.map(c=>sourceRow(c.r))];
      let text='At '+p.gravity+' g, '+p.oxygen+'% ambient oxygen and '+Number(p.pressure.toFixed(4))+' psia, '+joint.matches.length+' of '+eligible.length+' eligible '+p.phase+' rows match all three conditions. '+(eligible.length-joint.complete)+' lack at least one required field. [1]\n\nThe tolerances are ±0.02 g, ±1 oxygen percentage point and ±0.5 psia.';
      if(ranked.length)text+='\n\nClosest row per investigation, with equal weights · '+ranked.map((c,i)=>c.r.record_id+' ('+c.known+' known fields; scaled distance '+c.score.toFixed(3)+') ['+(i+2)+']').join(' · ');
      return typed(text,sources,{type:'compass',params:p,matches:joint.matches.length?3:0});
    }
    if(intent.type==='compare'||intent.type==='record'){
      if(intent.type==='record'&&!p.record)return null;
      if(intent.type==='compare'&&(!p.left||!p.right))return clarify('Give two distinct row identifiers to compare their recorded material, gas, flow and endpoint. You can select both rows in the Atlas.');
      const rows=globalThis.FFAtlasEvidence?.archive().rows||[];
      const chosen=(intent.type==='compare'?[p.left,p.right]:[p.record]).map(id=>rows.find(r=>r.id===id));
      if(chosen.some(r=>!r))return clarify('At least one row could not be resolved. Choose its investigation and exact source-row identifier in the Atlas.');
      const sources=chosen.map(r=>({id:r.id,title:r.study.name+' · '+r.id,url:r.table.url,locator:r.table.name+' · CSV row '+r.csvRow+' · DOI '+r.study.doi}));
      if(intent.type==='record'){
        const {record}=globalThis.FFAtlasEvidence.investigationResult(chosen[0]);
        const body=Object.entries(record.conditions).filter(([,v])=>v).map(([k,v])=>k+' · '+v);
        return typed(chosen[0].id+' · '+record.recordType+' [1]\n\n'+body.join('\n')+'\nRecorded endpoint · '+(record.endpoint||'unreported')+' [1]',sources,{type:'record',params:p,matches:0});
      }
      const pair=globalThis.FFAtlasEvidence.compareRecords(...chosen);
      const output=pair.fields.map(f=>f.label+' · '+f.status+(f.status==='Same entry'?' · '+f.left:' · '+(f.left??'unreported')+' / '+(f.right??'unreported')));
      return typed(p.left+' [1] compared with '+p.right+' [2]\n\n'+output.join('\n')+'\n\n'+pair.interpretation,sources,{type:'compare',params:p,matches:0});
    }
    if(intent.type==='rulebook'){
      const r=ruleFor(q);
      if(!r)return clarify('Which rule would you like to test? Open the Rulebook to select its material, ventilation, scale, extinction, detector or oxygen assumption.');
      const regime=/mars|martian/i.test(q)?2:/lunar|moon/i.test(q)?1:0;
      intent.href='#rulebook?entry='+globalThis.FFMissionDesk.rules.indexOf(r)+'&regime='+regime;
      const c=ff.cases.find(c=>c.id===r.id),s=r.source?{title:r.source[0],url:r.source[1],locator:r.domain}:c?.sources?.[0];
      return typed(r.q+'\n\nOrbit · '+r.scope[0]+'\nMoon gravity · '+r.scope[1]+'\nMars gravity · '+r.scope[2]+' [1]\n\nThe verdicts are the published FIRST FIRE rule inventory. Open the entry to inspect its experiment and next measurement.',s?[s]:[],{type:'rulebook',params:p,matches:0});
    }
    if(intent.type==='physics'){
      const engine=globalThis.FFPhysics;
      if(!engine)return clarify('Open Physics Lab to load the cabin solver and the inputs from this question.');
      const needed=['fuel','planet','volume','oxygen','pressure','cutoff','length','density','speed'];
      if(!needed.every(k=>p[k]!==undefined))return clarify('To run a sealed-cabin calculation, specify fuel, surface, volume, starting oxygen, pressure, oxygen cutoff, strip length, fuel per centimetre and spread speed. Open Physics Lab to complete the inputs from your question.');
      const s={...engine.defaults,...p,power:0,capacity:0};
      if(engine.validate(s))return clarify(engine.validate(s));
      const final=engine.run(s).final;
      return typed('After '+final.time+' seconds, the sealed-box model gives '+final.oxygen.toFixed(3)+'% oxygen and '+final.co2.toFixed(3)+'% carbon dioxide. [1]\n\nInputs · '+Object.entries(p).map(([k,v])=>k+' = '+v).join(' · ')+'\nFixed configuration · no electrical heat; initial gas temperature 300 K. The front speed is supplied. These are scenario outputs.',
        [{id:'physics-equations',title:'FIRST FIRE cabin model and equations',url:'#physics',locator:'Closed-cabin gas and energy balance · source in physics-lab.js'}],{type:'physics',params:p,matches:0});
    }
    return null;
  }
  function missionItems(q,turn,previous){
    let keys=[...new Set((turn.sources||[]).map(s=>s.id?.split(':')[0]).filter(k=>k==='apollo1'||k==='apollo13'))];
    if(!keys.length)return [];
    const facets=[['crew',/who|crew members?|names?/i],['cause',/cause|ignite|start(?:ed)?|ignition|why/i],['changes',/chang|redesign|improv/i],['escape',/escap|hatch|rescu|surviv|lifeboat/i],['atmosphere',/atmosphere|pure oxygen|cabin pressure/i]];
    const facet=facets.find(([,r])=>r.test(q))?.[0]||'overview';
    return (globalThis.FFMissionReceipts||[]).filter(i=>keys.includes(i.source.id.split(':')[0])&&i.facets.includes(facet));
  }
  let submittedDraft;
  async function checkSubmitted(q,intent){
    const phrases=[...q.matchAll(/["“]([^"”]+)["”]/g)].map(m=>m[1]);
    if(!phrases.length)return clarify('Provide the exact source words in quotation marks and state the interpretation to test. The Referee can also search its pinned example passages.');
    const reversed=phrases.length>=2&&/\b(?:claim|interpretation|statement)\s*[:=]?\s*$/i.test(q.split(/["“]/)[0]);
    const quote=phrases[reversed?1:0];
    const claim=(reversed?phrases[0]:phrases[1])||q.split(/["”]/).at(-1)?.replace(/^\s*(?:[,;:.—-]\s*)?(?:(?:this |my |the )?claim(?: is)?|does (?:this|it) (?:mean|support)|(?:this )?(?:means|supports?))\s*[:=]?\s*/i,'').replace(/\?$/,'').trim();
    if(!claim)return clarify('What interpretation do you want me to check against that quotation? Enter the quotation and the claim as two quoted passages.');
    const matches=[];
    for(const [key,anchor] of Object.entries(globalThis.FF.evidence.anchors)){
      if(await globalThis.FFDeckReferee.exactMatch(anchor,quote))matches.push(key);
    }
    submittedDraft={quote,claim,key:matches[0]};intent.href='#referee?draft=1';
    if(matches.length!==1)return decline(matches.length?'The quotation occurs at multiple pinned locations. Open the Referee and specify the intended original.':'I could not match those exact words to a pinned source page. Open the Referee to select the original and check its wording.');
    return {mode:'archive',status:'limited',evidenceKind:'submitted-claim',sources:[],answer:'',submission:{key:matches[0],quote,claim}};
  }
  async function replayPassages(turn) {
    if (!globalThis.FFChatPassages && globalThis.FFLoadAsset) await globalThis.FFLoadAsset('chat-passages.js');
    const registry = globalThis.FFChatPassages, receipt = turn.passageReceipt;
    if (!registry || !receipt || receipt.version !== registry.version || !Array.isArray(receipt.ids)) return null;
    const ids = receipt.ids, sources = turn.sources;
    if (!ids.length || ids.length > 3 || new Set(ids).size !== ids.length || !Array.isArray(sources) || sources.length !== ids.length) return null;
    const paragraphs = [], canonical = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i], source = sources[i];
      if (typeof id !== 'string' || !Object.hasOwn(registry.docs, id) || !source) return null;
      const doc = registry.docs[id];
      const url = doc.url.startsWith('https://') ? new URL(doc.url).href : doc.url;
      if (source.id !== id || (source.url !== url && source.url !== doc.url) || source.title !== doc.title || source.locator !== doc.locator) return null;
      paragraphs.push(doc.text + ' [' + (i + 1) + ']');
      canonical.push({id, title:doc.title, url, locator:doc.locator});
    }
    if (receipt.scopeNote !== undefined) {
      if (!Object.hasOwn(registry.scopeNotes, receipt.scopeNote)) return null;
      paragraphs.push(registry.scopeNotes[receipt.scopeNote]);
    }
    const answer = paragraphs.join('\n\n');
    return turn.answer === answer ? {answer, sources:canonical} : null;
  }
  const cardinalWords=['one','two','three','four','five','six','seven','eight','nine','ten'];
  const fractionUnits={half:2,halves:2,third:3,quarter:4,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10};
  function numericSpelling(text) {
    return text.normalize('NFKC').replace(/−/g,'-').replace(/–/g,' ').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'')
      .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)[ -](half|halves|thirds?|quarters?|fourths?|fifths?|sixths?|sevenths?|eighths?|ninths?|tenths?)\b/gi,(_,n,d)=>{
        const unit=d.toLowerCase();return (1+cardinalWords.indexOf(n.toLowerCase()))+'/'+(fractionUnits[unit]||fractionUnits[unit.replace(/s$/,'')]);
      });
  }
  function numericTokens(text) {
    return numericSpelling(text).match(/(?<![\p{L}\p{N}_.])[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?(?![\p{L}\p{N}_])/gu) || [];
  }
  function statedFractions(text) {
    return [...numericSpelling(text).matchAll(/(?<![\p{L}\p{N}_.])(\d+)\s*\/\s*(\d+)(?![\p{L}\p{N}_]|\.\d)/gu)].filter(m=>Number(m[2])!==0).map(m=>Number(m[1])/Number(m[2]));
  }
  function replayOperation(node, observed, depth=0) {
    const same=(a,b)=>Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
    if(depth>20)throw Error('Expression exceeds depth limit');
    if(typeof node==='number' && Number.isFinite(node) &&
       ([0,1,2,10,100,1000,60].includes(node)||observed.some(x=>same(node,x)))) return node;
    if(!Array.isArray(node)||node.length<2||node.length>3)throw Error('Unsupported operation');
    const [op,a,b]=node,x=replayOperation(a,observed,depth+1);
    if(node.length===2){
      if(op==='neg')return -x;
      if(op==='abs')return Math.abs(x);
      if(op==='sqrt')return Math.sqrt(x);
      if(op==='normalcdf'){
        const z=Math.abs(x),t=1/(1+.2316419*z);
        const tail=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
        return x>=0?1-tail:tail;
      }
    }else{
      const y=replayOperation(b,observed,depth+1);
      if(op==='+')return x+y;
      if(op==='-')return x-y;
      if(op==='*')return x*y;
      if(op==='/')return x/y;
      if(op==='**'&&Math.abs(y)<=8)return x**y;
    }
    throw Error('Unsupported operation');
  }
  async function replaySynthesis(q,turn) {
    if(!globalThis.FFChatPassages && globalThis.FFLoadAsset)await globalThis.FFLoadAsset('chat-passages.js');
    const registry=globalThis.FFChatPassages,receipt=turn.synthesisReceipt;
    if(!registry || receipt?.version!=='ff-synthesis-1' || !Array.isArray(receipt.ids) ||
       !Array.isArray(receipt.blocks)|| !receipt.blocks.length || receipt.blocks.length>3) return null;
    if(new Set(receipt.ids).size!==receipt.ids.length || receipt.ids.length>10 ||
       !Array.isArray(turn.sources)||turn.sources.length!==receipt.ids.length)return null;
    const docs=[],sources=[];
    for(let i=0;i<receipt.ids.length;i++){
      const id=receipt.ids[i],s=turn.sources[i];
      if(typeof id!=='string'||!Object.hasOwn(registry.docs,id)||!s)return null;
      const d=registry.docs[id],url=d.url.startsWith('https://')?new URL(d.url).href:d.url;
      if(s.id!==id||s.title!==d.title||s.locator!==d.locator||(s.url!==url&&s.url!==d.url))return null;
      docs.push(d);sources.push({id,title:d.title,locator:d.locator,url});
    }
    const output=[];let operations=0;
    for(const block of receipt.blocks){
      if(typeof block.text!=='string'||block.text.length>1400||!block.text.length||
         /\[\d+\]|https?:\/\//.test(block.text)||!Array.isArray(block.refs)||
         !Array.isArray(block.calculations)||block.calculations.length>5||block.refs.length>6||
         (turn.status!=='abstained'&&!block.refs.length)||new Set(block.refs).size!==block.refs.length||
         block.refs.some(n=>!Number.isInteger(n)||n<0||n>=docs.length))return null;
      const evidence=[q,...block.refs.flatMap(i=>[docs[i].text,docs[i].title,docs[i].locator,receipt.ids[i]])];
      const support=evidence.join(' '),ratios=statedFractions(support),obs=[...numericTokens(support).map(Number),...ratios];
      const outcomes=block.calculations.map(calc=>replayOperation(calc,obs));
      if(outcomes.some(num=>!Number.isFinite(num)||Math.abs(num)>1e12))return null;
      operations+=outcomes.length;
      if(statedFractions(block.text).some(f=>![...ratios,...outcomes].some(n=>Math.abs(f-n)<=1e-9*Math.max(1,Math.abs(f),Math.abs(n)))))return null;
      for(const t of numericTokens(block.text)){
        const v=Number(t),precision=t.includes('.')&&!/[eE]/.test(t)?t.split('.')[1].length:0,radius=.50000001*10**(-precision);
        if(obs.some(n=>Math.abs(n-v)<=1e-9*Math.max(1,Math.abs(v),Math.abs(n))))continue;
        if(!outcomes.some(n=>Math.abs(n-v)<=radius+1e-7)&&!obs.some(n=>Math.abs(n-v)<=radius&&Math.abs(n-v)<.005*Math.max(1,Math.abs(n))))return null;
      }
      output.push(block.text+block.refs.map(i=>' ['+(i+1)+']').join(''));
    }
    const answer=output.join('\n\n');
    return answer===turn.answer?{answer,sources,operations}:null;
  }
  async function gate(q,turn,prior=[],intent={},opts={}){
    const c={quote:limited('No source receipt attached.'),interpretation:limited('No independent review for this wording.'),
      quantity:na('No numerical measurement was proposed.'),scope:fail('No research conclusion was established.')};
    const ff=globalThis.FF;
    let answer={...turn},matches=0;
    const ids=turn.reviewIds||[turn.reviewId].filter(Boolean);
    const reviews=globalThis.FFRefereeReviews?.cases||[];
    function reject(reason){answer=decline(reason);c.scope=fail(reason);}
    try {
      const canReview=['checked','quote-only','archive-note'].includes(turn.evidenceKind) && turn.status!=='abstained' && turn.item!=='next';
      if(canReview&&!Array.isArray(ff.tests)&&globalThis.FFLoadAsset)await globalThis.FFLoadAsset('observation-rows.js');
      const record=canReview && globalThis.FFRecordFacts?.fact(q,ff,turn.sources);
      const registered=canReview && await globalThis.FFReviewedSources?.reviewed(q,turn,ff);
      if(turn.evidenceKind==='grounded-synthesis'){
        const replay=await replaySynthesis(q,turn);
        if(!replay){
          c.quote=fail('The source, rendering or numerical receipt failed replay.');reject(noFigures);
        }else {
          answer={...turn,answer:replay.answer,sources:replay.sources};
          c.quote=replay.sources.length?pass('Citations match the archive. The prose is a model synthesis, not a quotation.'):na('No source claim was made.');
          c.quantity=replay.operations?pass('Recomputed '+replay.operations+' expression(s) from numbers in the question or cited records.'):na('No new arithmetic result was reported.');
          c.interpretation=limited('A local transformer wrote this interpretation. The citations and arithmetic were checked, but their scientific relevance was not independently graded.');
          c.scope=turn.status==='abstained'?limited('The model identified missing evidence.'):pass('The question was answered using the listed archive records.');
        }
      }else if(turn.evidenceKind==='bound-passages'){
        const reconstructed = await replayPassages(turn);
        if(!reconstructed){
          c.quote=fail('The answer or citation differs from the versioned passage in this release.');
          reject(noFigures);
        }else{
          answer={...turn,...reconstructed};
          c.quote=pass('The complete displayed text and each citation match the published FIRST FIRE passage snapshot.');
          c.interpretation=limited('This is a sourced summary or source-row transcription. Agreement with the snapshot does not independently validate an interpretation.');
          c.quantity=na('Only values already present in the cited passage are displayed. No new quantity was calculated.');
          c.scope=pass('The passage and locator identify the conditions and endpoint it describes.');
        }
      }else if(record){
        answer={...turn,status:'answered',evidenceKind:'archive-row',answer:record.answer,sources:record.sources,reviewIds:[],reviewId:undefined};
        c.quote=pass('Matched the pinned source table, release inventory or registered forecast protocol.');c.quantity=pass(record.why);
        c.interpretation=na('Structured data or a direct release rule.');c.scope=pass('Only the identified observations, fields and release definitions apply.');
      }else if(registered){
        const allChecked=registered.ratings.every(r=>r.supported);
        answer={...turn,evidenceKind:allChecked?'checked':'quote-only',status:allChecked?'answered':'limited',answer:registered.answer,sources:registered.sources,
          reviewedSourceIds:registered.ratings.map(r=>r.id),reviewIds:[],reviewId:undefined};
        c.quote=pass('Original wording was found on the pinned publisher page. The exact claim, quotation, page and file binding matched on replay.');
        c.interpretation=allChecked?pass('Gemma 3 1B independently supported each displayed interpretation on its complete source page.'):limited('A model review did not endorse one or more interpretations. Only the original wording is shown for those passages.');
        c.quantity=registered.ratings.some(r=>r.numeric.state==='pass')?pass('Checked each measured quantity or registered table-cell conversion against its bound publisher excerpt.'):na('The source claim gives no measured quantity.');
        c.scope=pass('Answer restricted to the experiment or proposed design on the cited page.');
      }else if(turn.evidenceKind==='submitted-claim'){
        const {key,quote,claim}=turn.submission, result=await globalThis.FFDeckReferee.evaluate(key,quote,claim);
        Object.assign(c,{quote:result.quotation,interpretation:result.semantic,quantity:result.numeric,scope:result.scope});
        if(c.quote.state!=='pass'||c.scope.state!=='pass'||['fail','unavailable'].includes(c.quantity.state))reject(noFigures);
        else{const ok=c.interpretation.state==='pass';answer={...turn,status:ok?'answered':'limited',evidenceKind:ok?'checked':'quote-only',
          answer:ok?claim+' [1]':'“'+quote+'” [1]',sources:[{id:key,title:result.src.title,url:result.src.url,locator:result.src.locator}]};}
      }else if(turn.evidenceKind==='archive-calculation'){
        const priorTurn=prior.at(-1),ids=turn.previousSelection&&priorTurn?.analysis?.rows;
        const set=ids&&new Set(ids);
        const archive=set?{...ff,tests:ff.tests.filter(r=>set.has(r.record_id))}:ff;
        const replay=globalThis.FFScienceChat.answer(turn.calculationInput||q,prior,archive);
        const receipt=globalThis.FFScienceChat.receipt(turn.calculationInput||q,prior,archive);
        const suffix=set?'\n\nThis calculation starts with the '+ids.length+' matching rows in your previous result.':'';
        const same=replay?.analysis && JSON.stringify(replay.analysis)===JSON.stringify(turn.analysis) && replay.answer+suffix===turn.answer;
        const source=receipt && receipt.rows.every(r=>r.id&&r.source_file&&r.source_row)&&receipt.sources.every(s=>/^[0-9a-f]{64}$/.test(s.hash));
        if(!same||!source){c.quantity=fail('The replay or its row locators differed.');reject(noFigures);}
        else{c.quote=pass('Row identifiers and NASA table fingerprints resolved. No publisher quotation is asserted.');c.interpretation=na('Deterministic row selection and arithmetic; no model interpretation.');c.quantity=pass('Replayed the scoped operation, row membership, denominators and units.');c.scope=pass('Describes the specified normalized archive rows.');}
      }else if(turn.evidenceKind==='calculation'){
        const replay=globalThis.FFDeckReferee.forecastAnswer(turn.forecastInput||q,prior);
        if(!replay||JSON.stringify(replay.calculation)!==JSON.stringify(turn.calculation)||replay.answer!==turn.answer){c.quantity=fail('Threshold model arithmetic differed on replay.');reject(noFigures);}
        else {c.quote=pass('The design register supplies the planned starting atmosphere.');c.interpretation=na('A threshold-model projection; independent interpretation is inapplicable.');c.quantity=pass('Recomputed the normal threshold CDF from starting oxygen, mean and spread.');c.scope=pass('Illustrative probability under stated assumptions.');}
      }else if(turn.evidenceKind==='lunar-outcome'){
        const n=ff.forecast.burns.filter(b=>[true,false,'yes','no'].includes(b.outcome)).length;
        if(!turn.answer.includes(n+' verified lunar burn outcomes out of '+ff.forecast.burns.length)){c.quantity=fail('The reported outcome count differs from the register.');reject(noFigures);}
        else {c.quote=pass('Release outcome register and NASA design are linked.');c.quantity=pass('Recounted resolved entries in the dated release.');c.interpretation=na('Direct register count.');c.scope=n?pass('Only resolved outcomes are counted.'):fail('No resolved lunar result is available for an observed success fraction.');}
      }else if(turn.evidenceKind==='tool-calculation'){
        const replay=toolAnswer(intent,q,ff);
        if(!replay||replay.answer!==turn.answer||JSON.stringify(replay.sources)!==JSON.stringify(turn.sources)){c.quantity=fail('The engine or source selection differed on replay.');reject(noFigures);}
        else{c.quote=pass('The tool was reconstructed from the linked source or versioned model.');c.quantity=pass('Replayed the engine with the displayed inputs.');c.interpretation=na('Structured engine output.');c.scope=pass(turn.tool.type==='physics'?'Model scenario only.':'Limited to the referenced records and conditions.');matches=turn.tool.matches||0;}
      }else if(ids.length&&['checked','quote-only'].includes(turn.evidenceKind)){
        const rows=ids.map(id=>reviews.find(r=>r.id===id)).filter(Boolean);
        if(rows.length!==ids.length)throw Error('Unregistered review');
        const results=await Promise.all(rows.map(r=>globalThis.FFDeckReferee.evaluate(r.anchor,r.quote,r.claim)));
        for(const [key,field] of [['quote','quotation'],['interpretation','semantic'],['quantity','numeric'],['scope','scope']]){
          c[key]=results.map(r=>r[field]).find(s=>s.state==='fail')||results.map(r=>r[field]).find(s=>s.state==='unavailable')||results[0][field];
        }
        if(c.quote.state!=='pass'||c.scope.state!=='pass'||['fail','unavailable'].includes(c.quantity.state))reject(noFigures);
        else {const quoteOnly=c.interpretation.state!=='pass';answer={...turn,evidenceKind:quoteOnly?'quote-only':'checked',answer:rows.map(r=>(quoteOnly?'“'+r.quote+'”':r.claim)+' [1]').join('\n\n')};}
      }else if(turn.evidenceKind==='mission-note'||(intent.type==='incident'&&turn.status!=='abstained')){
        const items=missionItems(q,turn,prior);
        if(!items.length)reject('I don’t have a source excerpt for that incident and question.');
        else{
          const valid=await Promise.all(items.map(async i=>await hash(i.source.id+'\n'+i.quote)===i.quoteSHA256));
          if(!valid.every(Boolean))reject(noFigures);
          else{
            const sources=[...new Map(items.map(i=>[i.source.id,i.source])).values()];
            const quotes=items.map(i=>'“'+i.quote+'” ['+(sources.findIndex(s=>s.id===i.source.id)+1)+']');
            answer={...turn,status:'limited',evidenceKind:'mission-note',answer:quotes.join('\n\n'),sources};
            c.quote=pass('Exact NASA excerpts were matched to the downloaded HTML. The bound excerpt digest was checked again.');
            c.quantity=na('Mission identifiers and historical dates identify the original record. Numerical source language is quoted verbatim; no new measurement is calculated.');
            c.scope=pass('Direct NASA mission history.');c.interpretation=limited('Direct quotation only; no independent historical interpretation is asserted.');
          }
        }
      }else if(turn.evidenceKind==='archive-note'){
        const fromRow=(turn.sources||[]).map(s=>ff.tests?.find(r=>r.record_id===s.id&&r.source_url===s.url)).filter(Boolean);
        // A structured NASA row can be reproduced field by field. Its stored narrative
        // never introduces an additional measurement.
        if(fromRow.length){
          const sources=fromRow.map(sourceRow);
          const fields=[['material','Material'],['outcome','Recorded outcome'],['instrument_id','Instrument ID'],['o2_initial_pct','Initial chamber oxygen (%)'],['o2_burner_pct','Burner oxygen (%)'],['pressure_psia','Absolute pressure (psia)'],['burn_time_s','Duration (s)'],['initial_diameter_mm','Initial diameter (mm)'],['visible_extinction_diameter_mm','Visible extinction diameter (mm)']];
          answer={...turn,evidenceKind:'archive-row',answer:fromRow.map((r,i)=>r.accession+' test '+r.test_id+'. '+fields.filter(([k])=>r[k]!==null&&r[k]!==undefined&&r[k]!=='').map(([k,label])=>label+' '+r[k]).join(' · ')+' ['+(i+1)+']').join('\n\n'),sources};
          c.quote=pass('Matched the source-table URL and stable row identifier.');c.quantity=pass('Values and units reconstructed from the normalized observation.');c.interpretation=na('Direct record lookup.');c.scope=pass('Only this row and its measured fields are shown.');
        }else if(turn.caseId&&turn.item==='next'){
          const study=ff.cases?.find(i=>i.id===turn.caseId);
          if(!study||!turn.answer.includes(study.next))reject(noFigures);
          else{answer={...turn,evidenceKind:'research-plan',answer:'Suggested next test from FIRST FIRE: “'+study.next+'” [1]',sources:[{id:study.id,title:'FIRST FIRE research brief',url:'#case/'+study.id,locator:'Next experiment · team proposal'}]};
            c.quote=pass('The proposal matches the versioned case brief.');c.quantity=na('Any input specifications belong to the proposed protocol.');c.interpretation=limited('Team-authored proposal; no new experimental outcome is asserted.');c.scope=pass('Research planning only.');}
        }else{
        const docs=ff.evidence?.documents||{};
        const samePage=(a,b)=>String(a).split('#')[0].split('?')[0]===String(b).split('#')[0].split('?')[0];
        const candidates=reviews.filter(r=>!r.fixture&&r.verdict==='supported' && (turn.sources||[]).some(s=>{
          const d=docs[ff.evidence.anchors[r.anchor]?.document];return d && (samePage(s.url,d.url)||samePage(s.url,d.canonical_url));}));
        const terms=s=>new Set(String(s).toLowerCase().match(/[a-z]{3,}/g)?.filter(t=>!['the','what','from','that','for','with','how','was','does','did','which','where','are','this','has','can','had'].includes(t))||[]);
        const wanted=terms(q), best=candidates.map(r=>({r,n:[...terms(r.claim+' '+r.quote+' '+r.id)].filter(t=>wanted.has(t)).length})).sort((a,b)=>b.n-a.n)[0];
        if(!best||best.n<2){c.quote=fail('No matching original-page quotation was established for this question.');reject('I don’t have a verified source quotation for that specific question. Open the cited archive or ask about a test identifier and measured endpoint.');}
        else{
          const r=best.r,checked=await globalThis.FFDeckReferee.evaluate(r.anchor,r.quote,r.claim);
          if(checked.quotation.state!=='pass')reject(noFigures);
          else {
            const quantitative=globalThis.FFDeckReferee.quantitative(r.anchor,r.claim,r.quote,r);
            if(['fail','unavailable'].includes(quantitative.state))reject(noFigures);
            else {c.quote=checked.quotation;c.quantity=quantitative;c.scope=pass('Quoted as recorded in this experiment.');answer={...turn,status:'limited',evidenceKind:'quote-only',reviewId:r.id,answer:'“'+r.quote+'” [1]',sources:[{id:r.anchor,title:checked.src.title,url:checked.src.url,locator:checked.src.locator}]};}
          }
        }
        }
      }else if(turn.status==='abstained'||['input-needed','archive-clarification'].includes(turn.evidenceKind)||turn.mode==='navigation'){
        c.quote=na('No factual claim is displayed.');c.interpretation=na('No interpretation was asserted.');c.scope=limited('The question requires a missing record, explicit inputs or a supported scope.');
      }else{c.quote=fail('Unrecognized answer path has no verified receipt.');reject(noFigures);}
    }catch{c.quote=fail('The required evidence or calculation could not be verified in this environment.');reject(noFigures);}
    if(c.scope.state==='pass'&&!matches&&globalThis.FFIntentRouter){
      const p=globalThis.FFIntentRouter.inputFields(q.normalize('NFKC').toLowerCase(),'compass');
      const rows=(answer.sources||[]).map(s=>ff.tests?.find(r=>s.id===r.record_id&&s.url===r.source_url)).filter(Boolean);
      for(const r of rows){
        const within=(field,requested,delta)=>requested!==undefined && r[field]!==null && r[field]!==undefined && r[field]!=='' && Math.abs(Number(r[field])-Number(requested))<=delta;
        matches=Math.max(matches,Number(within('gravity_g',p.gravity,.02))+Number(within('o2_initial_pct',p.oxygen,1))+Number(within('pressure_psia',p.pressure,.5)));
      }
    }
    const difficulty=opts.level||level(q);
    answer.verification={release:version,checks:c,confidence:confidence(difficulty,c,matches)};
    if(replyConfidence && replyConfidenceFit){
      answer.verification.calibration=replyConfidence.predict(q,answer,replyConfidenceFit,opts.confidenceEnvironment);
    }
    return answer;
  }
  const localErrors=[];
  function remember(question,turn){
    if(!turn.verification)return;
    const {checks,confidence}=turn.verification;
    if(!['limited','abstained'].includes(turn.status)&&!Object.values(checks).some(c=>c.state==='fail'||c.state==='unavailable'))return;
    localErrors.push({release:version,question,displayed:turn.answer,proposal:turn.submission?.claim||null,checks,
      intent:turn.intent?.type||'abstain',label:confidence.label});
  }
  function el(tag,value){const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;}
  function panel(turn){
    const v=turn.verification,c=v.confidence,box=el('details');box.className='ff-chat-evidence';
    const estimate=v.calibration;
    if(estimate?.showPercentage && Number.isFinite(estimate.probability)){
      box.dataset.strictPassProbability=String(estimate.probability);
      box.dataset.confidenceModel=estimate.model;
      box.append(el('summary','Evidence checks · '+(5*Math.round(20*estimate.probability))+'% reply confidence'));
      box.append(el('p','This estimates the chance that the whole reply would pass a benchmark check for content, sources and appropriate handling of the question. It also scores decisions to withhold an answer. The estimate comes from earlier local chat results.'));
    }else{
      box.append(el('summary','Evidence checks'));
      if(estimate?.reason==='insufficient-calibration-data')box.append(el('p','There are too few reliable examples of this kind of reply to show a confidence percentage.'));
    }
    const list=el('dl');
    const names={quote:'Source',interpretation:'Interpretation',quantity:'Quantity',scope:'Scope'};
    for(const [key,step] of Object.entries(v.checks)){list.append(el('dt',names[key]),el('dd',step.state+' · '+step.reason));}
    box.append(list);
    if(c.factors.length)box.append(el('p','Evidence coverage · '+c.reason));
    const audit=el('a','Inspect calibration and errors');audit.href='#referee?view=errors';box.append(audit,' · ');
    const report=el('a','Report an error');report.target='_blank';report.rel='noopener noreferrer';
    report.href='https://github.com/Haresh276/first-fire/issues/new?'+new URLSearchParams({title:'FIRST FIRE evidence review · '+(turn.intent?.label||'chat'),
      body:'Release '+version+'\nIntent '+(turn.intent?.type||'unknown')+'\nChecks '+Object.entries(v.checks).map(([k,s])=>k+'='+s.state).join(', ')+'\n\nWhat did you expect?\n\nYou may add your question or a public source here before submitting.'});
    box.append(report);return box;
  }
  function auditPanel(){
    const section=el('section');section.className='panel stack section';section.append(el('h2','Evidence scores and release history'));
    if(replyConfidenceFit?.ready){
      section.append(el('p','Chat estimates the chance that the complete reply would satisfy the answer rubric. Its calibration uses '+replyConfidenceFit.n+' earlier development questions, including decisions to abstain.'));
      const method=el('a','How reply confidence is estimated and tested');method.href='#report/reply-confidence';section.append(method);
    }
    const data=globalThis.FFEvidenceRelease;
    if(data){
      section.append(el('h3','Earlier evidence-factor scores'));
      section.append(el('p',data.method));
      const table=el('table'),header=table.createTHead().insertRow();
      for(const title of ['Set','Evidence label','Answers','Mean score','Post-gate passes','Original passes']){const h=el('th',title);h.scope='col';header.append(h);}
      const body=table.createTBody();
      for(const row of data.bins){const tr=body.insertRow();for(const v of [row.set,row.label,row.n,row.mean==null?'—':row.mean.toFixed(2),row.gatePassed+'/'+row.n+' ('+(100*row.gatePassed/row.n).toFixed(0)+'%)',row.passed+'/'+row.n])tr.insertCell().textContent=v;}
      const wrap=el('div');wrap.className='tablewrap';wrap.append(table);section.append(wrap,el('p',data.result.replace('Live scores retain the published evidence factors.','This release used those factors.')));
      const all=el('a','Download the 124 decisions, post-gate outcomes, refitted bins and fingerprints');all.href='evidence-calibration.json';all.download='first-fire-evidence-calibration.json';section.append(all);
      const series=el('details');series.append(el('summary','Versioned public errors ('+data.errors.length+')'));
      for(const entry of data.errors){
        const d=el('details');d.className='ff-error-item';d.append(el('summary',entry.id+' · '+entry.status+' · '+entry.question),
          el('p','Release '+entry.release+' · '+entry.failed.join(', ')),el('p','Proposed answer · '+entry.proposal),el('p','Displayed · '+entry.displayed));
        const replay=el('a','Open question in chat');replay.href='#chat?q='+encodeURIComponent(entry.question);d.append(replay);
        const historical=(entry.supersedes||entry.id).split('-').at(-1),raw=data.replayInputs?.[historical];
        if(raw){
          const check=el('button','Replay recorded proposal');check.type='button';check.className='ghost';
          const result=el('p');result.setAttribute('role','status');
          check.onclick=async()=>{
            check.disabled=true;
            try{
              if(!globalThis.FF.tests)await globalThis.FFLoadAsset('observation-rows.js');
              const prior=[],route=globalThis.FFIntentRouter.detect(entry.question,prior);
              const proposed=globalThis.FFDeckReferee.forecastAnswer(entry.question,prior)||await globalThis.FFDeckReferee.checkedReply(entry.question,{mode:'local',answer:entry.proposal,...raw});
              const audited=await gate(entry.question,proposed,prior,route);
              result.textContent=(audited.answer===entry.displayed?'Matches the recorded display. ':'Current release displays a different result. ')+audited.answer;
            }catch{result.textContent='The stored inputs or evidence could not be replayed.';}
            finally{check.disabled=false;}
          };d.append(' ',check,result);
        }
        series.append(d);
      }
      section.append(series);
    }
    const privateLog=el('details');privateLog.append(el('summary','This tab’s withheld or limited answers ('+localErrors.length+')'));
    privateLog.append(el('p','Visitor questions stay in this tab. Use Report an error to open a sanitized issue draft. You choose what to submit.'));
    for(const [i,row] of localErrors.entries()){
      const d=el('details');d.append(el('summary','Entry '+(i+1)+' · '+row.question),el('p','Release '+row.release+' · '+row.displayed));
      if(row.proposal)d.append(el('p','Proposed claim · '+row.proposal));
      d.append(el('p',Object.entries(row.checks).map(([k,v])=>k+' '+v.state).join(' · ')));privateLog.append(d);
    }
    section.append(privateLog);return section;
  }
  globalThis.FFEvidenceDesk={version,level,confidence,gate,toolAnswer,clarify,decline,checkSubmitted,panel,remember,auditPanel,getDraft:()=>submittedDraft};
})();
