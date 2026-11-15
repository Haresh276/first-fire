/* An open rehearsal with a shared, frozen source packet and a separately masked review. */
(() => {
  'use strict';
  const packetId = 'saffire-replay-v1';
  const methods = ['first_fire', 'general_assistant'];
  const names = {first_fire:'FIRST FIRE', general_assistant:'General-purpose assistant'};
  const criteria = {
    evidence:'Matches both measured rates to the correct runs and cites the source locations.',
    calculation:'Reproduces both distances and their signed difference with consistent units.',
    transfer:'Identifies a transfer limit and a measurement needed in the target cabin.'
  };
  const prompt = 'At 50 seconds, how much farther would a front move with the concurrent Saffire-I rate than with the opposed rate in the specified rover model? Identify the two observed inputs, calculate both distances and their signed difference, and decide whether the evidence determines the actual flame speed in this lunar cabin. Cite the exact source locations. Give one measurement that would strengthen the transfer.';
  const packet = [
    'FIRST FIRE shared evidence packet | '+packetId,
    'QUESTION', prompt,
    'A. NASA PSI-98, experimental table 1, records 2 and 3 (header is record 1). DOI: https://doi.org/10.60555/0t15-1z43',
    'Selected original columns: sample, material, air flow (cm/s), percent O2, flow direction.',
    'PSI-98:1:2 | S1 | SIBAL Fabric | 20 | 21.5 - 21.7 | Concurrent',
    'PSI-98:1:3 | S2 | SIBAL Fabric | 20 | ~ 21.5 | Opposed',
    'B. NASA NTRS 20170008805, Saffire-I results. https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21',
    'PDF p. 21: For the 40.6 cm wide specimen, the investigators report average front rates of 1.8 mm/s concurrent with flow and 1.3 mm/s opposed. PDF p. 14: Airflow was stopped after the first run’s planned 420 seconds. The second run used fabric remaining from the first.',
    'C. Team model specification, simulated rover. Start with a 16 m³ lunar cabin, cellulose, 34% O2, 56.54 kPa absolute, 40 cm strip, 2 g/cm and an assumed O2 cutoff of 18%. Impose each published front speed on the same scenario. Assume neither strip exhaustion nor the oxygen cutoff is reached by 50 s. The front travels imposed speed × elapsed time, capped by the available fuel and oxygen. The solver treats the cabin as well mixed.',
    'RESPONSE FORMAT', 'Use only this packet as evidence. Calculators and the specified solver are allowed. Include input IDs and units, arithmetic, the result, the uncertainty about transfer, and a useful next measurement. Omit tool names and personal identifiers from the response.'
  ].join('\n\n')+'\n';
  const packetHash = '0bbfc694f7a801e0cee483cede1643769b5a3174135991652b7b133f7ee1f1c6';
  const idValid = s => typeof s==='string' && /^[a-zA-Z0-9_-]{8,80}$/.test(s);
  const textValid = (v,limit=8000) => typeof v==='string' && v.trim().length>0 && v.length<=limit;
  const check = (condition,message) => {if(!condition)throw new Error(message);};
  const id = () => crypto.randomUUID?.() || [...crypto.getRandomValues(new Uint8Array(16))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const coin = () => crypto.getRandomValues(new Uint8Array(1))[0]%2;
  function newRun(first,runId=id()) {
    check(methods.includes(first) && idValid(runId),'Unknown method or review ID.');
    return {id:runId,order:[first,methods.find(m=>m!==first)],runs:[],active:null,packetHash};
  }
  function finish(run, answer, now=Date.now(), responseId=id()) {
    check(run?.active && run.runs.length<2,'Start the trial before saving a response.');
    check(textValid(answer),'Enter a response of 1–8,000 characters.');
    check(idValid(responseId)&&!run.runs.some(r=>r.id===responseId),'Invalid response ID.');
    const {started,toolLabel}=run.active;
    check(Number.isFinite(now)&&now>=started,'The device clock changed. Restart this trial.');
    run.runs.push({id:responseId,method:run.order[run.runs.length],toolLabel,answer:answer.trim(),elapsedSeconds:Math.round((now-started)/1000)});
    run.active=null;
  }
  const common = (run,type) => ({version:1,type,caseId:packetId,packetSHA256:packetHash,reviewId:run.id});
  function exportPair(run) {
    check(run.runs.length===2,'Complete both trials first.');
    const responses=run.runs.map(r=>({id:r.id,answer:r.answer})).sort((a,b)=>a.id.localeCompare(b.id));
    return {
      assessor:{...common(run,'paired_assessor'),responses},
      analyst:{...common(run,'paired_analyst'),runs:run.runs.map(({id,method,toolLabel,elapsedSeconds})=>({id,method,toolLabel,elapsedSeconds}))}
    };
  }
  function header(file,type) {
    check(file?.type===type && file.version===1 && file.packetSHA256===packetHash && file.caseId===packetId && idValid(file.reviewId),'This file does not match this review type and evidence packet.');
  }
  function rows2(items) {
    return Array.isArray(items) && items.length===2 && items.every(r=>idValid(r?.id)) && items[0].id!==items[1].id;
  }
  function assess(file) {
    header(file,'paired_assessor');
    check(rows2(file.responses) && file.responses.every(r=>textValid(r.answer) && Object.keys(r).every(k=>['id','answer'].includes(k))),'Expected two masked responses.');
    return file;
  }
  function join(mapping,marks) {
    header(mapping,'paired_analyst');header(marks,'paired_scores');
    check(mapping.reviewId===marks.reviewId && rows2(mapping.runs) && rows2(marks.grades),'The two files must come from the same completed review.');
    check(methods.every(m=>mapping.runs.filter(r=>r.method===m).length===1),'Each method needs one response.');
    return mapping.runs.map((row,index)=>{
      const score=marks.grades.find(g=>g.id===row.id);
      check(textValid(row.toolLabel,120)&&Number.isInteger(row.elapsedSeconds)&&row.elapsedSeconds>=0 && score && Object.keys(criteria).every(k=>[0,1].includes(score[k])),'Missing or invalid score, time or tool version.');
      return {method:row.method,toolLabel:row.toolLabel,order:index+1,elapsedSeconds:row.elapsedSeconds,scores:Object.fromEntries(Object.keys(criteria).map(k=>[k,score[k]])),score:Object.keys(criteria).reduce((sum,k)=>sum+score[k],0)};
    });
  }
  const api={packetId,packet,packetHash,prompt,criteria,newRun,finish,exportPair,assess,join};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const $=s=>document.querySelector(s);
  function node(tag,value){const n=document.createElement(tag);if(value!=null)n.textContent=value;return n;}
  function btn(label,fn,style='ghost'){const b=node('button',label);b.type='button';b.className=style;b.onclick=fn;return b;}
  function field(label,control){const w=node('label',label);w.className='field';w.append(control);return w;}
  function download(name,value,asText=false){
    const url=URL.createObjectURL(new Blob([asText?value:JSON.stringify(value,null,2)+'\n'],{type:asText?'text/plain':'application/json'}));
    const a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function error(target,fn){target.textContent='';try{fn();}catch(e){target.textContent=e.message;}}
  function readFile(label,handle){
    const input=node('input'),msg=node('small');input.type='file';input.accept='.json,application/json';msg.setAttribute('role','status');
    input.onchange=async()=>{try{const f=input.files[0];if(!f)return;check(f.size<120000,'Use a comparison JSON file under 120 kB.');handle(JSON.parse(await f.text()));msg.textContent='File loaded.';}catch(e){msg.textContent=e.message||'File could not be read.';}};
    const w=field(label,input);w.append(msg);return w;
  }
  const storageKey='first-fire.paired-review.v1';
  function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify(run));}catch{$('#save-status').textContent='Tab storage unavailable. Keep this page open until you export.';}}
  function restored(){
    try{
      const r=JSON.parse(sessionStorage.getItem(storageKey));
      if(!r || !idValid(r.id) || r.packetHash!==packetHash || !Array.isArray(r.order)||r.order.length!==2||!methods.every(m=>r.order.includes(m))||!Array.isArray(r.runs)||r.runs.length>2)return null;
      if(!r.runs.every((x,i)=>idValid(x.id)&&x.method===r.order[i]&&textValid(x.answer)&&textValid(x.toolLabel,120)&&Number.isInteger(x.elapsedSeconds)&&x.elapsedSeconds>=0))return null;
      if(r.active && (r.runs.length===2 || !Number.isFinite(r.active.started)||!textValid(r.active.toolLabel,120)||typeof r.active.draft!=='string'))return null;
      return r;
    }catch{return null;}
  }
  let run=restored(),timer=null;
  function paintRun(){
    if(timer)clearInterval(timer);
    const h=$('#run');h.replaceChildren();
    if(!run){
      h.append(node('h2','Run the two trials'),node('p','Use separate operators when possible. Give each the same packet and a fresh session. The timer measures wall time from starting a trial to saving its response, including copy and paste.'),
        btn('Assign trial order',()=>{run=newRun(methods[coin()]);persist();paintRun();},'btn'));
      return;
    }
    if(run.runs.length===2){
      const pair=exportPair(run);h.append(node('h2','Two responses recorded'),node('p','Give only the masked responses and the shared source packet to a separate assessor. Keep the analyst file until scoring is complete.'),
        btn('Download masked responses',()=>download('masked-'+run.id+'.json',pair.assessor),'btn'),
        btn('Download analyst mapping and times',()=>download('analyst-'+run.id+'.json',pair.analyst)));
    }else{
      const method=run.order[run.runs.length];
      h.append(node('h2','Trial '+(run.runs.length+1)+' of 2 · '+names[method]));
      if(!run.active){
        const input=node('input');input.type='text';input.maxLength=120;input.placeholder=method==='first_fire'?'Site release or offline package name':'Assistant, model or displayed version';
        const msg=node('p');msg.setAttribute('role','status');
        h.append(field('Tool and version used',input),btn('Start timed response',()=>error(msg,()=>{
          check(textValid(input.value,120),'Enter the tool and version. Write “version unavailable” if needed.');
          run.active={started:Date.now(),toolLabel:input.value.trim(),draft:''};persist();paintRun();
        }),'btn'),msg);
      }else{
        const elapsed=node('p'),answer=node('textarea'),msg=node('p');answer.rows=6;answer.maxLength=8000;answer.value=run.active.draft;msg.setAttribute('role','status');
        answer.oninput=()=>{run.active.draft=answer.value;persist();};
        const tick=()=>{elapsed.textContent='Elapsed time · '+Math.max(0,Math.floor((Date.now()-run.active.started)/1000))+' s';};tick();timer=setInterval(tick,1000);
        const instructions=node('p',method==='first_fire'?'Use the research desk in a separate tab with the shared packet. Record the answer and its source locations.':'Give a fresh assistant the unchanged text file, with access to the packet only. Copy its answer below.');h.append(instructions);
        if(method==='first_fire'){const a=node('a','Open the investigation workspace');a.href='index.html#awareness';a.target='_blank';a.rel='noopener';h.append(a);}
        h.append(elapsed,field('Response, sources and transfer limit',answer),btn('Save response and stop timer',()=>error(msg,()=>{finish(run,answer.value);persist();paintRun();}),'btn'),msg);
      }
    }
    const reset=node('details');reset.append(node('summary','Trial controls'),btn('Discard this pair and restart',()=>{if(confirm('Discard this pair, including its answers and times?')){run=null;persist();paintRun();}}));h.append(reset);
  }
  function paintAssessment(file){
    const h=$('#grade');h.replaceChildren();
    const sets=file.responses.map((r,i)=>{
      const section=node('section'),answer=node('p',r.answer);answer.className='answer';section.append(node('h3','Response '+(i+1)),answer);
      const controls={};for(const [k,desc] of Object.entries(criteria)){
        const select=node('select');for(const [v,t] of [['','Select score'],['1','1 · Meets criterion'],['0','0 · Does not meet criterion']])select.add(new Option(t,v));
        controls[k]=select;section.append(field(desc,select));
      }
      h.append(section);return {id:r.id,controls};
    });
    const msg=node('p');msg.setAttribute('role','status');
    h.append(btn('Download masked scores',()=>error(msg,()=>{
      check(sets.every(s=>Object.values(s.controls).every(c=>c.value!=='')),'Grade all three criteria for both responses.');
      const grades=sets.map(s=>({id:s.id,...Object.fromEntries(Object.entries(s.controls).map(([k,c])=>[k,Number(c.value)]))}));
      download('scores-'+file.reviewId+'.json',{version:1,type:'paired_scores',reviewId:file.reviewId,caseId:packetId,packetSHA256:packetHash,grades});
    }),'btn'),msg);
  }
  const files={};
  function paintResult(){
    const h=$('#results');h.replaceChildren();if(!files.mapping||!files.marks)return;
    error(h,()=>{
      const rows=join(files.mapping,files.marks);
      const table=node('table'),cap=node('caption','Matched case results'),head=node('thead'),tr=node('tr');table.append(cap,head);head.append(tr);
      for(const t of ['Tool and version','Assigned order','Evidence','Calculation','Transfer','Elapsed'])tr.append(node('th',t));
      const body=node('tbody');table.append(body);
      for(const r of rows){const line=node('tr');for(const v of [names[r.method]+' · '+r.toolLabel,r.order,r.scores.evidence,r.scores.calculation,r.scores.transfer,r.elapsedSeconds+' s'])line.append(node('td',String(v)));body.append(line);}
      const wrap=node('div');wrap.className='tablewrap';wrap.append(table);h.append(wrap,node('p','This is one exposed, manually scored task. It describes these two responses and their recorded wall times.'),
        btn('Download comparison results',()=>download('comparison-'+files.mapping.reviewId+'.json',{...common({id:files.mapping.reviewId},'paired_result'),practice:true,rows})));
    });
  }
  $('#question').textContent=prompt;$('#sources').textContent=packet;$('#packet-id').textContent=packetId+' · SHA-256 '+packetHash;
  window.addEventListener('pagehide',()=>clearInterval(timer));
  window.addEventListener('pageshow',event=>{if(event.persisted)paintRun();});
  $('#packet').onclick=()=>download(packetId+'.txt',packet,true);
  $('#assessor').append(readFile('Import masked responses',file=>paintAssessment(assess(file))));
  $('#analyst').append(readFile('Import analyst mapping and times',file=>{header(file,'paired_analyst');files.mapping=file;paintResult();}),
    readFile('Import masked scores',file=>{header(file,'paired_scores');files.marks=file;paintResult();}));
  paintRun();
})();
