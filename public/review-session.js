'use strict';
const sessions = {
  science: {
    title:'Can you reproduce the material comparison?', duration:'25 minutes', prompt:'Independently test how well a frozen detector model predicts a material-specific optical response in other ISS runs.',
    first:'Choose an error metric and a baseline. What would persuade you to prefer a material-specific measurement?',
    task:'Read the selection plan first. Work from a source workbook or the derived run table. Compute at least one prediction error independently, compare the overall baselines, and record any disagreement with the published analysis. Say whether you used your own calculation, the team script, or both.',
    result:'Which baseline did you compare, and what values did you reproduce?',
    check:'Calculate one run’s observed drop, predicted response and absolute error. Give the run number, baseline and source cell or CSV row. If the calculation failed, record where you got stuck.',
    links:[['Read the fixed selection and scoring protocol','detector-replication-plan.json'],['Open the 18 extracted observations with workbook links','review-detector-observations.csv']],
    comparisons:[['Inspect the team comparison and reproduction code','detector-replication.html']]
  },
  data:{
    title:'Which oxygen readings belong in a cabin query?',duration:'15 minutes',prompt:'Check a request for CFI-G tests with at least 34% initial chamber oxygen. A different instrument can report the same numerical value.',
    first:'Write the predicate and denominator you would use before seeing the project audit.',
    task:'Use the two original NASA tables first. Record one included row and one excluded row, their column labels and instrument locations. Count the eligible records, then open the FIRST FIRE audit and compare results. Record any unresolved join.',
    result:'Which rows and counts did you get? Did your independent query agree?',
    check:'Save your independent count with its denominator, and identify one included and one excluded row with column labels. If the count failed, describe the point of failure.',
    links:[['Normal configuration source CSV','data/raw/PSI-159-experimental.csv'],['Inverse configuration source CSV','data/raw/PSI-159-experimental-2.csv']],
    comparisons:[['Compare with the release audit','source-crosswalk/index.html']]
  },
  technology:{
    title:'Would the research chat catch a changed condition?',duration:'12 minutes',prompt:'Write a pair of your own spacecraft fire questions about the same evidence. Change one material, endpoint or measurement location in the second.',
    first:'Save the two questions and say what would make a citation or answer correct for each. Keep them unseen by the team until the run ends.',
    task:'Use both tools on your saved questions, in the assigned order below. Keep the exact wording. Start each question in a fresh chat. Record answers, cited IDs or justified refusals and the archive/model mode. Check retrieval, physical comparability and conclusion separately. Include failures. Prior exposure and the second search may influence your judgment.',
    result:'For each question, what did ordinary search and the chat recover? Which conclusion survived source inspection?',
    links:[['Open FIRST FIRE chat','index.html#chat'],['Search the same case archive','index.html#search'],['Inspect original NASA PSI materials','data/raw/psi-manifest.json']]
  },
  mission:{
    title:'Would you approve the next ground test?',duration:'15 minutes',prompt:'A rover engineering team must distinguish a delay getting particles to a detector from a slow response after arrival.',
    first:'What channels and controls would you require before changing detector placement?',
    task:'Inspect the proposed ground experiment. Check one resource or timing calculation, a repeated control and one condition in which the experiment cannot distinguish the two mechanisms. Make a ground-test decision. Name the additional evidence that would justify a reduced-gravity trial.',
    result:'Would you proceed, revise or defer? Name the assumption that matters most and the measurement that would change your decision.',
    links:[['Open the experimental design','transport-plan.html'],['Read the original detector case','detector.html'],['Inspect the two-compartment tracer tool','index.html#transport-lab']]
  },
  story:{
    title:'Tell the flight story back',duration:'6 minutes',prompt:'You will read a short investigation of a spacecraft fire and retell it in your own words.',
    first:'Have you seen the Saffire-II sample 2-7 case before? What would you need to tell which part of a composite burned?',
    task:'Open the photo story without narration. Inspect its record and photographs. Close the story tab before retelling it here. Describe what happened, which detail changed your interpretation and one conclusion the case leaves open.',
    result:'Retell the event as you would explain it to a classmate.',
    links:[['Read the flight story','140-second-fire.html']]
  },
  art:{
    title:'What can you see after the light changes?',duration:'5 minutes',prompt:'You will see two measurements from one flight experiment drawn on a common scale.',
    first:'Have you seen FLEX test 155 before? What would you ordinarily infer if a camera stopped seeing a flame?',
    task:'Play or step through the exhibit without opening the investigators’ interpretation. Return here and describe the order in which the two signals changed. Identify the sample that supports your reading. Explain which part was measured and which part was the artist’s mapping.',
    result:'What changed first and what could you still follow? What conclusion would need another sensor?',
    links:[['Open the flight-data exhibit','after-the-light.html']]
  }
};

if(typeof module!=='undefined')module.exports=sessions;
if(typeof document!=='undefined') {
  const el=id=>document.getElementById(id), id=new URLSearchParams(location.search).get('session');
  if(Object.hasOwn(sessions,id)) {
    const entry=sessions[id], key='first-fire.review-session.v1/'+id;
    const fields=['result','record','limitation','conclusion','permission'];
    const getFields=()=>Object.fromEntries(fields.map(name=>[name,el(name).value.trim()]));
    const cleanText=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
    let base, draft={};
    const persist=()=>{try{sessionStorage.setItem(key,JSON.stringify({base,draft:getFields()}));}catch{}};
    try{
      const saved=JSON.parse(sessionStorage.getItem(key));
      if(saved?.base?.session===id&&['outside','team'].includes(saved.base.participant)&&cleanText(saved.base.role,100)&&cleanText(saved.base.before,2200)&&Number.isFinite(Date.parse(saved.base.started))&&/^[a-z0-9-]{8,48}$/i.test(saved.base.reviewId)){
        base=saved.base;draft=saved.draft||{};
      }
    }catch{}
    function reveal(){
      el('first').hidden=true;el('task').hidden=false;el('initial').textContent=base.before;
      if(base.toolOrder)el('instructions').textContent=entry.task+' Assigned order: '+base.toolOrder+'.';
    }
    el('directory').hidden=true;el('workspace').hidden=false;
    el('title').textContent=entry.title;document.title=entry.title+' · FIRST FIRE';
    for(const [target,source] of [['duration','duration'],['prompt','prompt'],['first-label','first'],['instructions','task'],['result-label','result']])el(target).textContent=entry[source];
    function addLinks(list, links){
      for(const [title,url] of links){
      const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent=title+' ↗';
      const li=document.createElement('li');li.append(link);list.append(li);
      }
    }
    addLinks(el('resources'),entry.links);
    function showComparison(){
      el('blind').hidden=true;
      el('blind-saved').textContent=base.independentCheck;
      el('comparison').hidden=false;
      el('finish').hidden=false;
      el('answer-links').replaceChildren();
      addLinks(el('answer-links'),entry.comparisons);
    }
    if(entry.check){
      el('blind-label').textContent=entry.check;
      el('blind').hidden=false;
      el('finish').hidden=true;
      if(base?.independentCheck)showComparison();
      el('blind').addEventListener('submit', event=>{
        event.preventDefault();
        const answer=el('blind-answer').value.trim();
        if(!answer){el('blind-status').textContent='Record a result or the point where you got stuck.';return;}
        base.independentCheck=answer;
        base.checkedAt=new Date().toISOString();
        persist();showComparison();el('answer-links').querySelector('a').focus();
      });
    }
    for(const name of fields)if(typeof draft[name]==='string')el(name).value=draft[name];
    if(base)reveal();
    el('start').addEventListener('submit',event=>{
      event.preventDefault();
      const role=el('role').value.trim(),before=el('first-answer').value.trim();
      if(!before||!role){el('start-status').textContent='Enter your role and first response to begin.';return;}
      base={schema:'first-fire.specialist-review.v1',session:id,protocol:'2026-11-15.1',sourceManifest:'review-release-2026-11-15.chat1.json',reviewId:crypto.randomUUID?.()||[...crypto.getRandomValues(new Uint8Array(12))].map(v=>v.toString(16).padStart(2,'0')).join(''),started:new Date().toISOString(),participant:el('kind').value,role,before};
      if(id==='technology')base.toolOrder=crypto.getRandomValues(new Uint8Array(1))[0]%2?'research chat, then ordinary search':'ordinary search, then research chat';
      persist();reveal();el('task-heading').focus();
    });
    el('another').addEventListener('click',()=>{try{sessionStorage.removeItem(key);}catch{} location.reload();});
    el('finish').addEventListener('input',persist);
    el('finish').addEventListener('submit',event=>{
      event.preventDefault();const answers=getFields();
      if(Object.values(answers).some(v=>!v)){el('exported').textContent='Complete each field, including what you could not verify.';return;}
      const record={...base,...answers,completed:new Date().toISOString(),task:entry.prompt,sourceLinks:[...entry.links,...(entry.comparisons||[])].map(pair=>pair[1])};
      const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='first-fire-'+id+'-'+base.reviewId+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
      el('another').hidden=false;
      el('exported').textContent='Prepared '+link.download+'. Return this file to your facilitator if you choose.';
    });
  }
}
