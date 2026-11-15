/* Portable records for an engineer's decision, a blind task handoff and a reply. */
'use strict';
const FIREDecisionReview = (() => {
  const formats = {task:'first-fire.decision-task.v1', review:'first-fire.decision-review.v1', exchange:'first-fire.decision-exchange.v1'};
  const datasets = {
    'PSI-101':'87164b7dc9168a4273c159f7a9f23699afbd06ad97b77974377e79b9bf8a3bef',
    'PSI-102':'268d1e121d2f211b124407dd32b9475617bd269ede2c2d1749441da3e949a2af',
    'PSI-99':'3c24390b9ef86f3d1ebaab911a1a3cc95a8759aebf42062371370e6d4b31b8ac',
    'PSI-69':'37c88ce8ae9391b7544ff630a45ce87543d04d317cdbfbed104fe7d5c27e1b96'
  };
  const cases = {
    detector:{
      question:'Which smoke measurements would you require before selecting a detector for a crewed rover?',
      setting:'Prepare the evidence section of a rover detector test plan for smoke from overheated wiring.',
      guide:'evidence-guide.html?task=detection&question=transfer', inspect:'detector.html?run=75', sources:['PSI-102','PSI-101']
    },
    fabric:{
      question:'What would you require before transferring a material-junction result to a crewed cabin?',
      setting:'Choose the next test for a cabin fabric joined to an acrylic component.',
      guide:'evidence-guide.html?task=spread&question=components', inspect:'140-second-fire.html', sources:['PSI-99']
    },
    extinction:{
      question:'Which measurements would convince you that burning ceased in a dilution test?',
      setting:'Design an extinction measurement for a liquid-fuel droplet and state what it can establish for a cabin.',
      guide:'evidence-guide.html?task=extinction&question=visible', inspect:'index.html#case/flex', sources:['PSI-69']
    }
  };
  const changes={changed:'Changed the plan',unchanged:'Kept the plan',deferred:'Deferred the decision'};
  const uses={draft:'Proposal or draft',used:'Applied in a plan or session',none:'No use outside this review'};
  const sharing={private:'Private copy',partners:'Participating groups only',public:'May quote publicly'};
  const relationships={external:'Self-reported independent reviewer',team:'Build team or coached participant',practice:'Practice'};
  const dispositions={revised:'Revised the proposal',retained:'Retained the proposal',unresolved:'Disagreement remains open'};
  function text(value, label, limit, optional=false) {
    if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())) throw Error('Check the entry for '+label+'.');
    return value.trim();
  }
  function allowed(value, map, label) {
    if (!Object.hasOwn(map,value)) throw Error('Choose a valid '+label+'.');
    return value;
  }
  function id(value) {
    if (typeof value!=='string' || !/^[a-f\d]{32}$/i.test(value)) throw Error('Invalid record identifier.');
    return value;
  }
  function time(value) {
    if (typeof value!=='string' || value.length!==24 || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString()!==value) throw Error('Invalid recorded date.');
    return value;
  }
  function startTask(caseId, setting, taskId, originId) {
    const type=allowed(caseId,cases,'safety question');
    return {schema:formats.task, taskId:id(taskId), originId:id(originId), caseId:type, question:cases[type].question,
      context:text(setting,'shared context',600), sources:cases[type].sources.map(accession=>({accession,sha256:datasets[accession]}))};
  }
  function readTask(value) {
    if (value?.schema!==formats.task) throw Error('Expected a FIRST FIRE task invitation.');
    const task=startTask(value.caseId,value.context,value.taskId,value.originId);
    if (value.question!==task.question || !Array.isArray(value.sources) || value.sources.length!==task.sources.length ||
        task.sources.some((src,i)=>src.accession!==value.sources[i]?.accession || src.sha256!==value.sources[i]?.sha256)) {
      throw Error('The question or source revision differs from this release.');
    }
    return task;
  }
  function before(task, reviewerId, person, decision, at) {
    const actor={group:text(person?.group,'group code',100),role:text(person.role,'role',100),country:text(person.country,'location',90,true),
      relationship:allowed(person.relationship,relationships,'reviewer relationship')};
    return {schema:formats.review, task:readTask(task),reviewerId:id(reviewerId),person:actor, before:{decision:text(decision,'starting decision',1800),at:time(at)},after:null};
  }
  function readReview(value) {
    if (value?.schema!==formats.review) throw Error('Choose a FIRST FIRE decision record.');
    const record=before(value.task,value.reviewerId,value.person,value.before?.decision,value.before?.at);
    if (value.after===null) return record;
    return finish(record,value.after,value.after?.at);
  }
  function finish(record, outcome, at) {
    if (record.after!==null) throw Error('This decision was already completed.');
    const applied=allowed(outcome?.use,uses,'application');
    const after={change:allowed(outcome.change,changes,'decision outcome'),decision:text(outcome.decision,'reviewed decision',1800),
      locator:text(outcome.locator,'NASA locator',500),why:text(outcome.why,'evidence rationale',1600),challenge:text(outcome.challenge,'challenge',1200),
      use:applied,artifact:text(outcome.artifact,'document or session reference',500,applied!=='used'),sharing:allowed(outcome.sharing,sharing,'sharing permission'),at:time(at)};
    if (after.at<record.before.at) throw Error('The ending time precedes the starting decision. Check the device clock.');
    return {...record,after};
  }
  function pair(first,second) {
    const original=readReview(first), peer=readReview(second);
    if (!original.after || !peer.after) throw Error('Both reviewers must complete a decision.');
    if (JSON.stringify(original.task)!==JSON.stringify(peer.task)) throw Error('The task, shared context or source revision differs. Start from the same invitation.');
    if (original.reviewerId!==original.task.originId || original.reviewerId===peer.reviewerId) throw Error('Open the originating decision first and add a different reviewer’s record.');
    if ([original,peer].some(r=>r.after.sharing==='private')) throw Error('A private-only response cannot enter a shared exchange.');
    return {original,peer,permission:[original,peer].every(r=>r.after.sharing==='public')?'public':'partners'};
  }
  function exchange(first,second,disposition,response,at) {
    const joined=pair(first,second);
    const result={schema:formats.exchange,...joined,reply:{disposition:allowed(disposition,dispositions,'response'),response:text(response,'source-based response',1800),at:time(at)}};
    return result;
  }
  function open(value) {
    if (value?.schema===formats.task) return readTask(value);
    if (value?.schema===formats.review) return readReview(value);
    if (value?.schema!==formats.exchange) throw Error('Choose a FIRST FIRE task, decision or completed exchange.');
    return exchange(value.original,value.peer,value.reply?.disposition,value.reply?.response,value.reply?.at);
  }
  return {formats,datasets,cases,changes,uses,sharing,relationships,dispositions,startTask,before,finish,readReview,pair,exchange,open};
})();
if(typeof module!=='undefined' && module.exports) module.exports=FIREDecisionReview;

if(typeof document!=='undefined') {
  const D=FIREDecisionReview, el=id=>document.getElementById(id);
  const val=id=>el(id).value, show=(id,visible)=>{el(id).hidden=!visible;};
  const now=()=>new Date().toISOString();
  const freshId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const storage='first-fire.decision-exchange.session.v1';
  let task=null,mine=null,peer=null,reply=null,loadSequence=0;
  const urlCase=new URLSearchParams(location.search).get('case');
  if(Object.hasOwn(D.cases,urlCase)) el('case-id').value=urlCase;

  function persist() {
    try { sessionStorage.setItem(storage,JSON.stringify({task,mine,peer,reply})); } catch { /* Downloads also work when browser storage is disabled. */ }
  }
  function restore() {
    try {
      const state=JSON.parse(sessionStorage.getItem(storage));
      if (!state) return;
      if (urlCase && (state.task||state.mine?.task)?.caseId!==urlCase) return;
      if (state.mine) mine=D.readReview(state.mine);
      if (state.task) task=D.open(state.task);
      if (state.peer) peer=D.pair(mine,state.peer).peer;
      if (state.reply) reply=D.exchange(mine,peer,state.reply.disposition,state.reply.response,state.reply.at).reply;
    } catch { task=mine=peer=reply=null; }
  }
  function save(name,object) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(object,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function promptCase() {
    const choice=D.cases[val('case-id')];
    el('question').textContent=choice.question;
    el('setting').value=task?.context || choice.setting;
  }
  function renderRecord(record, target) {
    target.replaceChildren();
    const heading=document.createElement('h3');heading.textContent=record.person.group;target.append(heading);
    const info=document.createElement('dl');
    for(const [label,body] of [
      ['Reviewer', [record.person.role,record.person.country,D.relationships[record.person.relationship]].filter(Boolean).join(' · ')],
      ['Starting decision · '+record.before.at,record.before.decision],['Reviewed decision · '+record.after.at, D.changes[record.after.change]+' — '+record.after.decision],
      ['Evidence checked',record.after.locator+' — '+record.after.why],['Challenge for the other group',record.after.challenge],
      ['Reported use',[D.uses[record.after.use],record.after.artifact].filter(Boolean).join(' · ')],['Permission',D.sharing[record.after.sharing]]
    ]) {
      const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=body;info.append(dt,dd);
    }
    target.append(info);
  }
  function render() {
    show('app',true);show('setup',!mine);show('saved',!!mine);show('analysis',!!mine&&!mine.after);show('complete',!!mine?.after);
    show('comparison',!!peer);show('reset',!!mine||!!task);show('intake',!mine&&!task);show('backup',!!mine&&!mine.after);
    if(!mine) {
      if (task) el('case-id').value=task.caseId;
      el('case-id').disabled=!!task;el('setting').readOnly=!!task;promptCase();
      return;
    }
    const current=mine.task,kind=D.cases[current.caseId];
    el('stage').textContent='Task '+current.taskId.slice(0,8)+' · '+D.relationships[mine.person.relationship];
    el('starting').textContent=mine.before.decision;
    el('reviewer').textContent=mine.person.group+' · '+mine.person.role+' · '+mine.before.at;
    el('locked-task').textContent=current.question+' '+current.context;
    el('guide').href=kind.guide;el('inspect').href=kind.inspect;
    el('source-list').replaceChildren(...current.sources.map(src=>{
      const item=document.createElement('li'),a=document.createElement('a');a.href='data/raw/'+src.accession+'-experimental.csv';a.textContent=src.accession+' original experimental table';
      const code=document.createElement('small'); code.style.overflowWrap='anywhere';code.textContent=' · SHA-256 '+src.sha256;item.append(a,code);return item;
    }));
    if (mine.after) renderRecord(mine,el('mine'));
    show('join',!!mine.after&&mine.reviewerId===current.originId&&mine.after.sharing!=='private'&&!peer);
    if (!peer) return;
    const comparison=D.pair(mine,peer), groups=[mine,peer];
    el('pair').replaceChildren(...groups.map(record=>{const card=document.createElement('article');renderRecord(record,card);return card;}));
    const labels=groups.map(record=>record.person.country || 'country unreported');
    el('scope').textContent='Locations as entered: '+labels.join(' / ')+'. Joint sharing permission: '+D.sharing[comparison.permission]+'. Group affiliations, independent participation and actual use are self-reported.';
    el('disposition').value=reply?.disposition||'';el('resolution').value=reply?.response||'';
  }
  function clear() {
    task=mine=peer=reply=null;
    for(const form of document.forms) form.reset();
    el('open-file').value='';el('peer-file').value='';el('file-status').textContent='';el('peer-status').textContent='';el('return-status').textContent='';
    if(Object.hasOwn(D.cases,urlCase)) el('case-id').value=urlCase;
    el('artifact').required=false;persist();render();
  }
  function readFile(input,onData,status) {
    input.addEventListener('change',async()=>{
      const sequence=++loadSequence,file=input.files[0];
      if(!file) return;
      try{
        if(file.size>130000) throw Error('Choose a decision JSON file smaller than 130 KB.');
        const data=D.open(JSON.parse(await file.text()));
        if(sequence!==loadSequence) return;
        onData(data);persist();render();el(status).textContent='Loaded '+file.name+'.';
      } catch(error){if(sequence===loadSequence) el(status).textContent=error instanceof SyntaxError?'Choose a valid JSON file.':error.message;}
      if(sequence===loadSequence) input.value='';
    });
  }
  readFile(el('open-file'),data=>{
    if(data.schema===D.formats.task){task=data;return;}
    if(data.schema===D.formats.review){mine=data;return;}
    mine=data.original;peer=data.peer;reply=data.reply;
  },'file-status');
  readFile(el('peer-file'),data=>{peer=D.pair(mine,data).peer;},'peer-status');
  el('case-id').addEventListener('change',promptCase);
  el('before-form').addEventListener('submit',event=>{
    event.preventDefault();
    try {
      const reviewerId=freshId();
      const invitation=task||D.startTask(val('case-id'),val('setting'),freshId(),reviewerId);
      mine=D.before(invitation,reviewerId,{group:val('group'),role:val('role'),country:val('country'),relationship:val('participation')},val('before'),now());
      task=mine.task;persist();render();el('saved').scrollIntoView();
    } catch(error) {el('file-status').textContent=error.message;}
  });
  el('use').addEventListener('change',()=>{el('artifact').required=val('use')==='used';});
  el('after-form').addEventListener('submit',event=>{
    event.preventDefault();
    try {
      mine=D.finish(mine,{change:val('change'),decision:val('after'),locator:val('locator'),why:val('why'),challenge:val('challenge'),use:val('use'),artifact:val('artifact'),sharing:val('sharing')},now());
      persist();render();el('complete').scrollIntoView();
    } catch(error) {el('file-status').textContent=error.message;}
  });
  el('invite').onclick=()=>save('first-fire-task-'+mine.task.taskId.slice(0,8)+'.json',mine.task);
  function exportMine(){save('first-fire-decision-'+mine.task.taskId.slice(0,8)+'-'+mine.reviewerId.slice(0,8)+(mine.after?'':'-starting')+'.json',mine);}
  el('backup').onclick=exportMine;el('export').onclick=exportMine;
  el('return-form').addEventListener('submit',event=>{
    event.preventDefault();
    try {
      const result=D.exchange(mine,peer,val('disposition'),val('resolution'),now());
      save('first-fire-exchange-'+mine.task.taskId.slice(0,8)+'.json',result);reply=result.reply;persist();
      el('return-status').textContent='Downloaded both source-based decisions and the response. Permission: '+D.sharing[result.permission]+'.';
    } catch(error) {el('return-status').textContent=error.message;}
  });
  el('reset').onclick=()=>{
    if(!window.confirm('Start a new session? Download any decision or exchange you want to retain first.'))return;
    ++loadSequence;clear();el('setup').scrollIntoView();
  };
  restore();render();
}
