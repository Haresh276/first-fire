(() => {
  const key='first-fire.review-log.v1';let entries=[];
  try{const a=JSON.parse(sessionStorage.getItem(key));if(Array.isArray(a))entries=a.filter(r=>typeof r?.finding==='string');}catch{}
  const node=id=>document.getElementById(id);
  function render(){
    const list=document.createElement('ol');
    for(const r of entries){const item=document.createElement('li');item.textContent=r.kind+' · '+r.item+' · '+r.reviewer+' · '+r.at+' — '+r.finding+' ('+r.source+')';list.append(item);}
    node('entries').replaceChildren(list);node('export').disabled=!entries.length;
  }
  node('log').onsubmit=e=>{
    e.preventDefault();const values=Object.fromEntries(new FormData(e.target));
    if(Object.values(values).some(v=>!String(v).trim())){node('msg').textContent='Complete each field.';return;}
    entries.push({...values,at:new Date().toISOString()});
    try{sessionStorage.setItem(key,JSON.stringify(entries));node('msg').textContent='Entry saved in this tab.';}catch{node('msg').textContent='Entry held in memory. Download to retain it.';}
    e.target.reset();render();
  };
  node('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,entries},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='first-fire-team-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  render();
})();

/* The checklist is a team-operated record. Only a person can confirm an event or submission. */
(() => {
  const items=[
    ['Project name and high-level summary','index.html#report/submission'],
    ['English demonstration, at most 30 seconds or seven slides','master-film.mp4'],
    ['English subtitles and synthetic-media credit','master-film.vtt'],
    ['Working public project and final description','index.html#field-guide'],
    ['Fifteen NASA dataset DOIs and the scientific papers','index.html#report/submission'],
    ['Partner data, models, fonts, software licences and attribution','first-fire-field-guide.pdf#page=32'],
    ['SI disclosure confirmed by every contributor','team-handoff.html'],
    ['Generated media visibly labelled and free of NASA insignia','index.html#physics?mode=rover'],
    ['English entry proofread','index.html#report/submission'],
    ['Private-window link checks on a physical phone and laptop','index.html#report/device-and-reader'],
    ['Three entrants confirmed on the Amaravati team page','https://www.spaceappschallenge.org/'],
    ['All seven case sign-offs and five Earth-source checks recorded','index.html#report/signoff'],
    ['Six-person pilot assessed and reported','index.html#study'],
    ['Forecast DOI issued and linked','forecast-deposition.zip'],
    ['Two timed runs under eleven minutes, including one offline','master-round2.pdf'],
    ['Final submission confirmed from the entrant account','https://www.spaceappschallenge.org/']
  ];
  const key='first-fire.team-submission-checks.v1',list=document.getElementById('checks'),output=document.getElementById('checks-state');
  if(!list)return;
  let checks={};try{checks=JSON.parse(sessionStorage.getItem(key)||'{}')||{};}catch{}
  function summary(){output.textContent=Object.keys(checks).length+' of '+items.length+' checks have a team confirmation in this tab.';}
  function persist(){try{sessionStorage.setItem(key,JSON.stringify(checks));}catch{}summary();}
  for(const [name,url] of items){
    const box=document.createElement('details'),title=document.createElement('summary');title.textContent=name;
    const link=document.createElement('a');link.href=url;link.textContent='Open supporting material';
    const form=document.createElement('form'),who=document.createElement('input'),note=document.createElement('input');
    who.required=note.required=true;who.maxLength=80;note.maxLength=500;
    for(const [text,input] of [['Person confirming',who],['Evidence, timestamp, result or reference',note]]){const label=document.createElement('label');label.textContent=text;label.append(input);form.append(label);}
    const status=document.createElement('p'),save=document.createElement('button'),remove=document.createElement('button');
    status.setAttribute('role','status');save.type='submit';save.textContent='Confirm this check';remove.type='button';remove.textContent='Clear confirmation';
    function draw(){const v=checks[name];who.value=v?.who||'';note.value=v?.note||'';status.textContent=v?'Confirmed in this tab by '+v.who+' on '+v.at+'.':'Awaiting confirmation.';remove.hidden=!v;}
    form.onsubmit=e=>{e.preventDefault();if(!who.value.trim()||!note.value.trim())return;checks[name]={who:who.value.trim(),note:note.value.trim(),at:new Date().toISOString()};persist();draw();};
    remove.onclick=()=>{delete checks[name];persist();draw();};form.append(save,remove);box.append(title,status,link,form);list.append(box);draw();
  }
  summary();document.getElementById('save-checklist').onclick=()=>{
    const blob=new Blob([JSON.stringify({schema:'first-fire.team-checklist.v1',issuedUTC:new Date().toISOString(),checks},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='first-fire-team-checklist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
})();
