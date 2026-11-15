(() => {
  'use strict';
  const key='first-fire.judge-session.v1';
  const stages=[
    {tool:'transfer-lab',title:'Match flight experiments',link:'#transfer-lab',action:'Open matched analysis',prompt:'Compare FLEX droplets at two oxygen settings. Choose the matching rules before revealing the outcomes.'},
    {tool:'transport-lab',title:'Challenge a sensor reading',link:'#transport-lab',action:'Open transport simulation',prompt:'Watch a remote sensor respond. Isolate the compartments, then increase circulation. Which change moves the reading across the threshold?'},
    {tool:'design-lab',title:'Choose the next lunar test',link:'#design-lab',action:'Open experiment design',prompt:'Record a hypothetical result. Inspect how it changes the uncertainty and the next oxygen setting worth testing.'},
    {tool:'chat',title:'Interrogate the archive',link:'#chat?q='+encodeURIComponent('How many methanol observations are in FLEX?'),action:'Open expert chat',prompt:'Send the suggested question or ask your own. Inspect which source rows support the answer.'}
  ];
  let state=null;
  try{const raw=JSON.parse(sessionStorage.getItem(key));if(raw?.version===1 && typeof raw.records==='object' && raw.records && typeof raw.intention==='string')state=raw;}catch{}
  function persist(){try{if(state)sessionStorage.setItem(key,JSON.stringify(state));else sessionStorage.removeItem(key);}catch{}}
  const el=(tag,t,cls)=>{const e=document.createElement(tag);if(t!==undefined)e.textContent=t;if(cls)e.className=cls;return e;};
  function link(text,href,cls){const a=el('a',text,cls);a.href=href;return a;}
  function button(text,fn,cls='ghost'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
  function download(name,obj){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const present=()=>stages.filter(s=>state?.records[s.tool]).length;
  function guide(){
    document.getElementById('run-guide')?.remove();
    if(!state)return;
    const tool=location.hash.slice(1).split('?')[0],index=stages.findIndex(s=>s.tool===tool);if(index===-1)return;
    const rail=el('nav',undefined,'run-guide shell');rail.id='run-guide';rail.setAttribute('aria-label','Guided session');
    rail.append(link('← Research session','#session'),el('span','Step '+(index+1)+' of '+stages.length+' · '+stages[index].title));
    const next=stages[index+1];rail.append(link(next?'Next step →':'Review session →',next?.link||'#session'));document.getElementById('content').before(rail);
  }
  document.addEventListener('ff-research-result',evt=>{
    const d=evt.detail;if(!state || !d || !stages.some(s=>s.tool===d.tool))return;
    if(d.invalid || d.valid===false){delete state.records[d.tool];persist();return;}
    if(typeof d.summary!=='string' || !d.record)return;
    state.records[d.tool]={title:d.title,summary:d.summary,record:d.record};persist();
  });
  function render(root){
    root.replaceChildren();const wrapper=el('div',undefined,'run-shell');
    const crumb=el('div',undefined,'breadcrumb');crumb.append(link('Research desk','#home'),' / Guided session');
    const title=el('header',undefined,'pagetitle');title.append(el('span','Live walkthrough','eyebrow'),el('h1','Run a fire investigation'),el('p','Work from a measured flight comparison to a sensor model and a proposed lunar test. Save the question, assumptions and evidence behind your decision.','sub'));
    wrapper.append(crumb,title);
    if(!state){
      const panel=el('section',undefined,'panel stack');panel.append(el('h2','What are you investigating?'));
      const label=el('label','Research question','field'),input=el('textarea');input.value='When would a change in atmosphere justify another fire test?';input.rows=2;input.maxLength=480;label.append(input);
      const start=button('Start guided session →',()=>{if(!input.value.trim()){input.reportValidity();input.focus();return;}state={version:1,intention:input.value.trim(),started:new Date().toISOString(),records:{}};persist();location.hash=stages[0].link;},'btn');
      input.required=true;panel.append(label,el('p','The four steps use this tab to collect your results. You can download the record at any point.','small'),start);wrapper.append(panel);
    }else{
      const summary=el('section',undefined,'run-summary');summary.append(el('span','Current investigation','eyebrow'),el('h2',state.intention),el('p',present()+' of 4 tools have returned a result in this session.'));
      const actions=el('div',undefined,'actions');
      actions.append(button('Download research record ↓',()=>download('first-fire-research-session.json',{...state,exported:new Date().toISOString(),status:present()===4?'four results captured':'partial session',methods:'https://first-fire-lunar-lab.christsamuel26.chatgpt.site/#report/advanced-methods',signedForecastSHA256:'9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3'}),'btn'));
      const finish=button('Close session',()=>{if(present()){finish.hidden=true;const ask=el('span','Clear this tab’s session after downloading? ');ask.append(button('Clear session',clear),button('Keep session',()=>{ask.remove();finish.hidden=false;}));actions.append(ask);}else clear();});
      function clear(){state=null;persist();render(root);guide();}
      actions.append(finish);
      const decision=el('label','What does the evidence justify testing next?','field'),notes=el('textarea');
      notes.rows=3;notes.maxLength=1600;notes.placeholder='State your decision and the measurement that could change it.';notes.value=state.decision||'';
      notes.oninput=()=>{state.decision=notes.value;persist();};decision.append(notes);
      summary.append(decision,actions);wrapper.append(summary);
    }
    const list=el('ol',undefined,'run-steps');
    for(const s of stages){const card=el('li',undefined,'panel'),r=state?.records[s.tool];card.append(el('h2',s.title),el('p',s.prompt));if(r){const p=el('p',r.summary,'run-result');card.append(p);}if(state)card.append(link(s.action+' →',s.link,'inlinebtn'));list.append(card);}
    wrapper.append(list);root.append(wrapper);
  }
  window.FFResearchSession={render,guide,active:()=>!!state,previous:tool=>state?.records[tool]||null};
})();
