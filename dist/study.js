/* Offline research tasks. Only participant files supply unpublished cases. */
(() => {
  'use strict';
  const STORE = 'first-fire.study.v1';
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  function button(text, operation, cls = 'btn') {
    const node = el('button', text, cls);
    node.type = 'button'; node.onclick = operation;
    return node;
  }
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2, '0')).join('');
  const cleanId = x => typeof x === 'string' && /^[\w.-]{1,80}$/.test(x);
  const actions = {reanalyze:'Reanalyze existing measurements',new_test:'Collect a new test',other_material:'Test another material',other:'Other'};
  const owns = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const hasAction = o => owns(o,'next_action');
  const validAction = o => (!hasAction(o) && !owns(o,'action_reason')) ||
    (hasAction(o) && (o.next_action==='' || owns(actions,o.next_action)) && typeof o.action_reason==='string');
  const attemptedAction = o => hasAction(o) && (o.next_action!=='' || o.action_reason.trim()!=='');
  const actionFields = o => hasAction(o) ? {next_action:o.next_action,action_reason:o.action_reason} : {};
  const words = x => typeof x === 'string' && x.trim().length > 0;
  function demand(test, message) { if (!test) throw new Error(message); }
  function validatePack(pack) {
    demand(pack && pack.version === 1 && cleanId(pack.study_id), 'Use version 1 and a short study_id.');
    demand(Number.isInteger(pack.time_limit_s) && pack.time_limit_s >= 30 && pack.time_limit_s <= 1800, 'Choose a time limit of 30–1,800 seconds.');
    demand(Array.isArray(pack.cases) && pack.cases.length === 6, 'A study requires six cases.');
    demand(pack.cases.every(c => c && cleanId(c.id) && words(c.prompt) && Object.keys(c).every(k => ['id','prompt'].includes(k))), 'Participant cases may contain only id and prompt. Keep the answer key separate.');
    demand(new Set(pack.cases.map(c => c.id)).size === 6, 'Each case needs its own ID.');
    demand(Object.keys(pack).every(k => ['version','study_id','time_limit_s','cases'].includes(k)), 'Participant pack has unexpected fields. Remove answers and metadata.');
    return pack;
  }
  // Cyclic rotations put every case at each position twice over 12 slots, once per arm.
  function schedule(pack, slot) {
    demand(Number.isInteger(slot) && slot >= 1 && slot <= 12, 'Assign a slot from 1 to 12.');
    const rotation = Math.floor((slot - 1) / 2);
    return Array.from({length: 6}, (_,i) => ({
      case_id: pack.cases[(i + rotation) % 6].id,
      arm: (slot - 1 + i) % 2 === 0 ? 'first_fire' : 'ordinary_search'
    }));
  }
  function download(name, value) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function read() {
    try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
  }
  let session = read(), clock = null;
  let grading = {masked: null,key: null,grades: {},index: 0}, analysisFiles = [];
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(session)); return true; }
    catch { return false; }
  }
  function maskedSession(run) {
    return {type:'masked_responses',version:1,study_id:run.pack.study_id,
      responses:run.records.map(r => ({response_id:r.response_id,case_id:r.case_id,answer:r.answer,citation:r.citation,limit:r.limit,...actionFields(r)}))
        .sort((a,b) => a.response_id.localeCompare(b.response_id))};
  }
  function rawSession(run) {
    return {type:'study_run',version:1,study_id:run.pack.study_id,pack_signature:JSON.stringify(run.pack.cases.map(c=>[c.id,c.prompt])),run_id:run.run_id,mode:run.mode,
      slot:run.slot,time_limit_s:run.pack.time_limit_s,records:run.records};
  }
  function loadFile(parent, label, many, onLoad) {
    const wrap = el('label', label, 'field'), input = el('input');
    input.type = 'file'; input.accept = '.json,application/json'; input.multiple = many;
    const message = el('small'); message.setAttribute('role','status');
    input.onchange = async () => {
      try {
        const files = [...input.files]; if (!files.length) return;
        demand(files.every(f => f.size < 2e6), 'Use JSON files under 2 MB.');
        const parsed = await Promise.all(files.map(async f => JSON.parse(await f.text())));
        onLoad(many ? parsed : parsed[0]); message.textContent = 'Loaded.';
      } catch (e) { message.textContent = e.message || 'Could not read file.'; }
    };
    wrap.append(input, message); parent.append(wrap);
  }
  function area(label, rows = 2) {
    const wrap = el('label',label,'field'), input=el('textarea');
    input.rows=rows; input.maxLength=8000; wrap.append(input); return {wrap,input};
  }
  function currentCase() { return session.pack.cases.find(c => c.id === session.order[session.index].case_id); }
  function stopClock() { if (clock) clearInterval(clock); clock=null; }
  function finalize(timedOut) {
    if (!session || !session.active) return;
    const active = session.active, item = session.order[session.index];
    session.records.push({response_id:uid(),case_id:item.case_id,arm:item.arm,position:session.index+1,
      elapsed_s:timedOut ? session.pack.time_limit_s : Math.min(session.pack.time_limit_s,Math.max(0,Math.round((Date.now()-active.start)/1000))),
      timed_out:timedOut,answer:active.answer,citation:active.citation,limit:active.limit,...actionFields(active)});
    session.index++; session.active=null; save(); stopClock();
  }
  function participant(host, paint) {
    if (session) {
      if (session.active && Date.now() >= session.active.end) finalize(true);
      const s = session;
      host.append(el('p',s.mode === 'practice' ? 'Open practice · excluded from study results' : 'Facilitated study · anonymous session', 'eyebrow'));
      if (s.index === 6) {
        host.append(el('h3','Six cases complete'),el('p','Give the grading file to an independent reader. Keep the analyst file with the facilitator; it contains task assignments and times.'));
        host.append(button('Export masked responses', () => download('masked-'+s.run_id+'.json',maskedSession(s))),
          button('Export analyst record', () => download('run-'+s.run_id+'.json',rawSession(s)),'btn ghost'));
        if (s.pack.study_id === 'open-practice') {
          const cases = window.FF?.cases || [];
          const details=el('details'); details.append(el('summary','Review the published practice answers'));
          s.records.forEach(r => { const c=cases.find(c=>c.id===r.case_id); if(c)details.append(el('p',c.title+' — '+c.decision)); });host.append(details);
        }
      } else {
        const item = s.order[s.index], caseData = currentCase();
        const method = item.arm === 'first_fire' ? 'FIRST FIRE' : 'Ordinary search';
        host.append(el('h3','Case '+(s.index+1)+' of 6 · '+method),
          el('p', item.arm === 'first_fire' ? 'Use FIRST FIRE and its primary-source links in a separate tab. Put the primary source in your response.' :
            'Use your usual web search, NASA PSI, or NTRS in a separate tab. The FIRST FIRE site is excluded for this assignment. Follow the facilitator’s agreed search settings.'));
        if (!s.active) {
          host.append(el('p','The prompt appears when you start. Both methods allow '+s.pack.time_limit_s+' seconds per case.'));
          host.append(button('Reveal prompt and start timer',() => {
            const now=Date.now(); s.active={start:now,end:now+1000*s.pack.time_limit_s,answer:'',citation:'',limit:'',next_action:'',action_reason:''};save();paint();
          }));
        } else {
          const timer=el('p','','note'), question=el('h4',caseData.prompt);
          const a=area('Your decision and finding',3), c=area('Primary source URL and page, figure, or table'), l=area('One condition or limit on the finding');
          const choice=el('label','Next action with one test budget (optional)','field'), select=el('select');
          const options=[['','No choice'],...Object.entries(actions)];
          for(const [value,text] of options){const op=el('option',text);op.value=value;select.append(op);}
          select.value=s.active.next_action || '';choice.append(select);
          const why=area('Why would this use of the budget address the evidence gap? (optional)');
          why.input.value=s.active.action_reason || '';
          // Sessions begun in older builds have no secondary endpoint for this active case.
          const showAction=hasAction(s.active);
          const message=el('small');message.setAttribute('role','status');
          const tick=() => {
            if (!host.isConnected || !s.active) {stopClock(); return;}
            const left=Math.ceil((s.active.end-Date.now())/1000);
            if(left<=0){finalize(true);paint();return;}
            timer.textContent='Time remaining: '+Math.floor(left/60)+'m '+String(left%60).padStart(2,'0')+'s';
          };
          const update=() => {
            if(!s.active) return;
            if(Date.now() >= s.active.end){finalize(true);paint();return;}
            Object.assign(s.active,{answer:a.input.value,citation:c.input.value,limit:l.input.value});
            if(showAction)Object.assign(s.active,{next_action:select.value,action_reason:why.input.value});
            if(!save()) message.textContent='Local saving is unavailable. Keep this page open until export.';
          };
          for(const [field,key] of [[a,'answer'],[c,'citation'],[l,'limit']]){
            field.input.value=s.active[key];field.input.oninput=update;
          }
          select.onchange=update;why.input.oninput=update;
          host.append(question,timer,a.wrap,c.wrap,l.wrap);
          if(showAction)host.append(choice,why.wrap);
          host.append(message,
            button('Submit response',()=>{if(!s.active)return;const expired=Date.now()>=s.active.end;finalize(expired);paint();}));
          tick();if(s.active)clock=setInterval(tick,500);
        }
      }
      const details=el('details'); details.append(el('summary','Session controls'));
      if (s.index>0 && s.index<6) details.append(button('Export partial analyst record',()=>download('partial-run-'+s.run_id+'.json',rawSession(s)),'btn ghost'));
      details.append(button('Clear this device’s session',()=>{if(confirm('Clear this session and its saved answers from this browser? Export first if needed.')){session=null;save();paint();}},'btn ghost'));
      host.append(details);return;
    }
    host.append(el('h3','Compare two ways to find evidence'),el('p','A facilitator assigns six cases, three with FIRST FIRE and three with ordinary search. Save an answer, a source, and a limit for each case. This browser stores the session locally.'));
    const slotWrap=el('label','Anonymous assignment slot','field'), slot=el('select');
    for(let n=1;n<=12;n++){const o=el('option','Slot '+n);o.value=n;slot.append(o);}slotWrap.append(slot);host.append(slotWrap);
    function start(pack, mode) {
      validatePack(pack); const n=Number(slot.value); session={pack,mode,slot:n,run_id:uid(),order:schedule(pack,n),index:0,active:null,records:[]};save();paint();
    }
    loadFile(host,'Import facilitator’s participant pack',false,pack => start(pack,pack.study_id==='open-dry-run-v1'?'practice':'study'));
    const available=Array.isArray(window.FF?.cases)?window.FF.cases.slice(0,6):[];
    if(available.length===6) host.append(button('Practice with six published cases',() => start({version:1,study_id:'open-practice',time_limit_s:240,cases:available.map(c=>({id:c.id,prompt:c.question||c.title}))},'practice'),'btn ghost'));
    host.append(el('p','Practice uses published decisions. A new evaluation needs independently written cases. Omit names and contact details from answers.', 'note'));
  }

  function checkKey(k) {
    demand(k && k.version===1 && cleanId(k.study_id) && Array.isArray(k.cases) && k.cases.length===6 &&
      new Set(k.cases.map(c=>c.id)).size===6 && k.cases.every(c=>c && cleanId(c.id) && ['accepted','evidence','limit'].every(a=>words(c[a])) && (!owns(c,'next_action') || words(c.next_action)) &&
      Array.isArray(c.sources) && c.sources.length && c.sources.every(v=>typeof v==='string' && /^https?:\/\//.test(v))),
      'Expected a six-case assessor key with accepted, evidence, limit, and sources for each ID.');
    return k;
  }
  function checkMasked(m) {
    demand(m && m.type==='masked_responses' && m.version===1 && cleanId(m.study_id) && Array.isArray(m.responses) &&
      m.responses.length>0 && m.responses.every(r=>r && cleanId(r.response_id) && cleanId(r.case_id) && ['answer','citation','limit'].every(k=>typeof r[k]==='string') &&
      validAction(r) && Object.keys(r).every(k=>['response_id','case_id','answer','citation','limit','next_action','action_reason'].includes(k))), 'Import a masked response file, not the analyst record.');
    demand(new Set(m.responses.map(r=>r.response_id)).size===m.responses.length,'Duplicate response ID.');
    return m;
  }
  function gradePane(host,paint) {
    host.append(el('h3','Score masked responses'),el('p','The assessor sees the participant’s answer and the source rubric. Grade each criterion independently. Equivalent primary evidence can earn credit. Assignments, time and participant slot are hidden.'));
    loadFile(host,'Load assessor key',false,k=>{checkKey(k);if(grading.masked)demand(grading.masked.study_id===k.study_id,'Key belongs to a different study.');grading.key=k;grading.grades={};paint();});
    loadFile(host,'Load one masked response file',false,m=>{checkMasked(m);if(grading.key)demand(grading.key.study_id===m.study_id,'Responses belong to a different study.');
      grading.masked=m;grading.grades={};grading.index=0;paint();});
    if(!grading.key || !grading.masked)return;
    const rows=grading.masked.responses, r=rows[grading.index], key=grading.key.cases.find(c=>c.id===r.case_id);
    if(!key){host.append(el('p','This response has no case in the key.'));return;}
    host.append(el('h4','Response '+(grading.index+1)+' of '+rows.length),el('p','Case '+r.case_id+' · '+r.response_id.slice(0,8),'eyebrow'));
    const criteria=[['decision','Decision',r.answer,key.accepted],['source','Evidence and locator',r.citation,key.evidence+' Reference: '+key.sources.join(' · ')],['scope','Scope or limit',r.limit,key.limit]];
    if(attemptedAction(r) && key.next_action){
      criteria.push(['action_supported','Secondary: budget choice and rationale',(actions[r.next_action]||'(no choice)')+' · '+(r.action_reason||'(no rationale)'),key.next_action]);
    }else{
      const reason=!hasAction(r)?'Earlier record did not ask for a budget choice.':!attemptedAction(r)?'Participant skipped the optional budget decision.':'The key has no predeclared secondary rubric.';
      host.append(el('p',reason+' Primary grading is unchanged.','note'));
    }
    const grade=grading.grades[r.response_id]||{};
    for(const [id,title,answer,rubric] of criteria){
      const block=el('div',undefined,'panel'); block.append(el('h4',title),el('p','Response: '+(answer||'(blank)')),el('p','Rubric: '+rubric,'note'));
      const label=el('label','Score','field'), select=el('select');
      [['','Select…'],['0','0 · missing or incorrect'],['1','1 · supported']].forEach(([v,t])=>{const opt=el('option',t);opt.value=v;select.append(opt);});
      select.value=grade[id]===undefined?'':String(grade[id]);select.onchange=()=>{if(!grading.grades[r.response_id])grading.grades[r.response_id]={};if(select.value==='') delete grading.grades[r.response_id][id];else grading.grades[r.response_id][id]=Number(select.value);};
      label.append(select);block.append(label);host.append(block);
    }
    if(grading.index>0)host.append(button('Previous',()=>{grading.index--;paint();},'btn ghost'));
    if(grading.index<rows.length-1)host.append(button('Next',()=>{grading.index++;paint();}));
    const status=el('small');status.setAttribute('role','status');
    host.append(button('Export grades',()=>{
      if(!rows.every(x=>['decision','source','scope'].every(k=>[0,1].includes(grading.grades[x.response_id]?.[k])))){status.textContent='Grade all three criteria for every response before export.';return;}
      const secondary = row => {
        const keyed=grading.key.cases.find(c=>c.id===row.case_id)?.next_action;
        if(!hasAction(row))return {action_status:'unavailable'};
        if(!attemptedAction(row))return {action_status:'skipped'};
        if(!keyed)return {action_status:'no_rubric'};
        return {action_status:'graded',action_supported:grading.grades[row.response_id]?.action_supported};
      };
      if(rows.some(x=>secondary(x).action_status==='graded' && ![0,1].includes(secondary(x).action_supported))){status.textContent='Grade each attempted budget decision with a predeclared rubric.';return;}
      download('grades-'+rows[0].response_id+'.json',{type:'study_grades',version:1,study_id:grading.key.study_id,
        grades:rows.map(x=>({response_id:x.response_id,case_id:x.case_id,...grading.grades[x.response_id],...secondary(x)}))});
    },'btn ghost'),status,el('p','Grades are held in this tab until export.','note'));
  }
  function summarize(files) {
    demand(files.every(f=>f && f.version===1 && ['study_run','study_grades'].includes(f.type) && cleanId(f.study_id)), 'Use analyst records and exported grades.');
    demand(new Set(files.map(f=>f.study_id)).size===1,'Analyze one study at a time.');
    const runs=files.filter(f=>f.type==='study_run'), grades=files.filter(f=>f.type==='study_grades');
    demand(runs.length && grades.length,'Select at least one analyst record and one corresponding grade file.');
    demand(runs.every(f=>f.mode==='study'), 'Open practice runs are excluded from evaluation.');
    demand(new Set(runs.map(x=>x.run_id)).size===runs.length,'Duplicate run. Select one export per participant.');
    demand(runs.every(f=>cleanId(f.run_id) && Array.isArray(f.records) && f.records.length===6 && Number.isInteger(f.slot) && f.slot>=1 && f.slot<=12 &&
      Number.isInteger(f.time_limit_s) && f.records.every(r=>r && cleanId(r.response_id) && cleanId(r.case_id) && ['first_fire','ordinary_search'].includes(r.arm) &&
        ['answer','citation','limit'].every(k=>typeof r[k]==='string') && validAction(r) && typeof r.timed_out==='boolean' && Number.isFinite(r.elapsed_s) && r.elapsed_s>=0 && r.elapsed_s<=f.time_limit_s) &&
      new Set(f.records.map(r=>r.case_id)).size===6 && f.records.filter(r=>r.arm==='first_fire').length===3), 'Each run must be a completed six-case, three-per-method record.');
    demand(new Set(runs.map(f=>f.time_limit_s)).size===1,'Time limits differ across sessions.');
    demand(runs.every(f=>words(f.pack_signature)) && new Set(runs.map(f=>f.pack_signature)).size===1,'Case text or case order differs across sessions.');
    demand(new Set(runs.map(f=>f.records.map(r=>r.case_id).sort().join('|'))).size===1,'Case packs differ across sessions.');
    demand(grades.every(g=>Array.isArray(g.grades) && g.grades.length), 'Each grade file must contain response grades.');
    const gs=grades.flatMap(g=>g.grades);
    demand(gs.every(g=>g && cleanId(g.response_id) && ['decision','source','scope'].every(k=>[0,1].includes(g[k]))),'Invalid grade file.');
    const byId=new Map(gs.map(g=>[g.response_id,g]));demand(byId.size===gs.length,'Duplicate grades: choose one adjudicated grade per response.');
    const responses=runs.flatMap(f=>f.records.map(r=>({...r,run_id:f.run_id,slot:f.slot})));
    demand(new Set(responses.map(r=>r.response_id)).size===responses.length,'Duplicate response in analyst files.');
    demand(responses.length===gs.length && responses.every(r=>byId.get(r.response_id)?.case_id===r.case_id),'Missing, extra or case-mismatched grades.');
    const rows=responses.map(r=>{
      const g=byId.get(r.response_id);
      const status=g.action_status===undefined?'unavailable':g.action_status;
      const validStatus=!hasAction(r) ? status==='unavailable' :
        attemptedAction(r) ? ['graded','no_rubric'].includes(status) : status==='skipped';
      demand(validStatus && (status==='graded'?[0,1].includes(g.action_supported):g.action_supported===undefined),'Secondary grade does not match the recorded budget response.');
      return {response_id:r.response_id,case_id:r.case_id,arm:r.arm,run_id:r.run_id,slot:r.slot,position:r.position,
        elapsed_s:r.elapsed_s,timed_out:r.timed_out,decision:g.decision,source:g.source,scope:g.scope,
        next_action:r.next_action??null,action_status:status,action_supported:g.action_supported??null};
    });
    const groups={};for(const arm of ['first_fire','ordinary_search']){
      const a=rows.filter(r=>r.arm===arm), times=a.map(r=>r.elapsed_s).sort((a,b)=>a-b);
      groups[arm]={responses:a.length,complete_correct:a.filter(r=>r.decision+r.source+r.scope===3).length,
        decision_correct:a.filter(r=>r.decision===1).length,source_correct:a.filter(r=>r.source===1).length,scope_correct:a.filter(r=>r.scope===1).length,
        budget_offered:a.filter(r=>r.action_status!=='unavailable').length,
        budget_attempted:a.filter(r=>['graded','no_rubric'].includes(r.action_status)).length,
        budget_graded:a.filter(r=>r.action_status==='graded').length,budget_supported:a.filter(r=>r.action_supported===1).length,
        budget_skipped:a.filter(r=>r.action_status==='skipped').length,budget_ungraded:a.filter(r=>r.action_status==='no_rubric').length,
        timeouts:a.filter(r=>r.timed_out).length,median_elapsed_s:(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2};
    }
    const full=r=>r.decision===1 && r.source===1 && r.scope===1;
    const paired=runs.map(run=>{
      const records=rows.filter(x=>x.run_id===run.run_id);
      const a=records.filter(x=>x.arm==='first_fire'&&full(x)).length,b=records.filter(x=>x.arm==='ordinary_search'&&full(x)).length;
      return {run_id:run.run_id,slot:run.slot,first_fire_full:a,ordinary_search_full:b,difference_out_of_three:a-b};
    });
    const tests=[...new Set(rows.map(r=>r.case_id))].sort().map(id=>{
      const selected=rows.filter(r=>r.case_id===id);
      return {case_id:id,...Object.fromEntries(['first_fire','ordinary_search'].map(arm=>{
        const a=selected.filter(r=>r.arm===arm);return [arm,{full:a.filter(full).length,assigned:a.length}];
      }))};
    });
    return {study_id:runs[0].study_id,runs:runs.length,groups,paired,case_breakdown:tests,rows};
  }
  function analysisPane(host,paint) {
    host.append(el('h3','Compare completed runs'),el('p','Import analyst records and the final adjudicated grade for each participant. Only fully joined, completed study sessions are included. Review incomplete sessions and nonreturns separately in the study report.'));
    loadFile(host,'Select all analyst and grade JSON files together',true,files=>{summarize(files);analysisFiles=files;paint();});
    if(!analysisFiles.length)return;const result=summarize(analysisFiles);
    host.append(el('p',result.runs+' completed participant session(s). These are descriptive pilot counts.'));
    for(const [arm,g] of Object.entries(result.groups)){
      host.append(el('h4',arm==='first_fire'?'FIRST FIRE':'Ordinary search'),
        el('p',g.complete_correct+'/'+g.responses+' fully supported · '+g.source_correct+' with correct source · '+g.timeouts+' timeouts · median '+g.median_elapsed_s+' s including timeouts.'),
        el('p','Optional budget decision: '+g.budget_supported+'/'+g.budget_graded+' graded responses supported. '+g.budget_attempted+' attempted of '+g.budget_offered+' offered; '+g.budget_skipped+' skipped, '+g.budget_ungraded+' without rubric.','note'));
    }
    const changes=result.paired.map(r=>r.difference_out_of_three);
    const mean=changes.reduce((a,b)=>a+b,0)/changes.length;
    host.append(el('h4','Within-reader comparison'),el('p','Mean difference in fully supported answers: '+(mean>0?'+':'')+mean.toFixed(2)+' out of three per method. '+changes.filter(v=>v>0).length+' reader(s) scored higher with FIRST FIRE, '+changes.filter(v=>v===0).length+' tied and '+changes.filter(v=>v<0).length+' scored higher with ordinary search. This describes these readers and tasks only.'));
    const breakdown=el('details');breakdown.append(el('summary','Results by question'));
    result.case_breakdown.forEach(r=>breakdown.append(el('p',r.case_id+' · FIRST FIRE '+r.first_fire.full+'/'+r.first_fire.assigned+' fully supported · ordinary search '+r.ordinary_search.full+'/'+r.ordinary_search.assigned+'.')));
    host.append(breakdown);
    host.append(button('Export scores by case and participant',()=>download('analysis-'+result.study_id+'.json',result)));
  }
  function render(root) {
    let tab='participant';
    function paint(){
      stopClock();root.replaceChildren();
      const shell=el('section',undefined,'panel stack');shell.classList.add('ff-study');
      shell.append(el('p','Evidence study','eyebrow'),el('h2','Find the evidence'));
      const nav=el('div',undefined,'actions');for(const [id,name] of [['participant','Participant'],['grade','Assessor'],['analysis','Analyst']]){
        const b=button(name,()=>{tab=id;paint();},id===tab?'btn':'btn ghost');b.setAttribute('aria-pressed',String(id===tab));nav.append(b);
      }
      shell.append(nav);const host=el('div',undefined,'stack');shell.append(host);root.append(shell);
      if(tab==='participant')participant(host,paint);else if(tab==='grade')gradePane(host,paint);else analysisPane(host,paint);
    }
    paint();
  }
  if(typeof module!=='undefined' && module.exports)module.exports={validatePack,schedule,maskedSession,summarize,checkKey};
  if(typeof window!=='undefined')window.renderStudy=render;
})();
