// Read the exported evaluation with no API or local model connection.
(() => {
  'use strict';
  const available=window.FFFreshChat,root=document.getElementById('report');
  const runId=new URLSearchParams(location.search).get('run')==='A'?'A':'B';
  const r=available?.[runId] || available?.A;
  if(!r){root.textContent='The results file could not be opened.';return;}
  root.replaceChildren();
  const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const pct=x=>x==null?'—':(100*x).toFixed(1)+'%';
  function table(headers,rows){
    const wrap=el('div'),t=el('table');wrap.className='scroll';wrap.append(t);
    const head=t.createTHead().insertRow();
    for(const label of headers){const cell=el('th',label);cell.scope='col';head.append(cell);}
    const body=t.createTBody();for(const row of rows){const tr=body.insertRow();for(const value of row)tr.insertCell().textContent=value;}
    return wrap;
  }
  const tabs=el('nav');tabs.setAttribute('aria-label','Test series');tabs.className='controls';
  for(const [key,title] of [['B','Second blind test · stronger local model'],['A','First blind test · compact local model']]){
    if(!available[key])continue;const link=el('a',title);link.href='?run='+key;if(r===available[key])link.setAttribute('aria-current','page');tabs.append(link);
  }
  root.append(tabs);
  const intro=el('p',r.overview);intro.className='intro';root.append(intro);
  root.append(table(['Difficulty','Questions',r.labels.previous,r.labels.current,r.labels.selector],r.levels.map(x=>[x.label,x.n,x.previous,x.current,x.selector])));
  root.append(el('p',r.paired),el('h2','How often confidence matched the verdict'),el('p',r.calibrationText));
  root.append(table(['Predicted chance of passing','Questions','Mean prediction','Passed','95% interval for pass rate'],r.reliability.map(x=>[x.label,x.n,pct(x.meanProbability),pct(x.accuracy),x.accuracy95?.map(pct).join(' to ')||'—'])));
  root.append(el('h2','Test conditions'));for(const m of r.method)root.append(el('p',m));
  const download=el('a','Download the full evidence and scoring files (ZIP)');download.href='fresh-chat-audit.zip';root.append(download);
  root.append(el('h2','Inspect the answers'));
  const controls=el('div');controls.className='controls';
  function select(label,entries){
    const wrapper=el('label',label),s=el('select');for(const [value,title] of entries){const o=el('option',title);o.value=value;s.append(o);}
    wrapper.append(s);controls.append(wrapper);return s;
  }
  const result=select('Result',[['fail','Revised chat missed'],['all','All questions'],['pass','Revised chat passed'],['regressed','Only the previous chat passed']]);
  const level=select('Difficulty',[['','All levels'],...r.levels.filter(x=>x.label!=='All').map(x=>[x.label,x.label])]);
  const count=el('p'),list=el('div');root.append(controls,count,list);
  function render(){
    list.replaceChildren();
    const rows=r.rows.filter(x=>(!level.value||x.level===level.value)&&(result.value==='all'||(result.value==='regressed'?x.previous.pass&&!x.current.pass:x.current.pass===(result.value==='pass'))));
    count.textContent=rows.length+' of '+r.rows.length+' questions';
    for(const x of rows){
      const d=el('details');d.className='q';d.append(el('summary',x.id+' · '+x.question));
      d.append(el('small',x.level+' · Pregrade confidence '+pct(x.probability)+(x.showPercentage===false?' · The chat withheld the percentage for this reply.':'')),el('h3','Expected answer'),el('p',x.reference));
      for(const [name,label] of Object.entries(r.labels).sort((a,b)=>['current','previous','selector'].indexOf(a[0])-['current','previous','selector'].indexOf(b[0]))){
        const ans=x[name],box=name==='current'?el('div'):el('details');if(name!=='current')box.append(el('summary',label+' · '+(ans.pass?'Passed':'Missed')));else box.append(el('h3',label+' · '+(ans.pass?'Passed':'Missed')));
        box.append(el('p',ans.reason),el('p',ans.answer));
        const ul=el('ul');for(const s of ans.citations){const li=el('li'),a=el('a',s.title||s.url);if(/^(?:https?:\/\/|#|[\w-]+(?:\.(?:html|pdf|json|csv)(?:[#?]|$)|\/))/.test(s.url||'')){a.href=s.url.startsWith('#')?'index.html'+s.url:s.url;li.append(a);}else li.textContent=s.title||'';if(s.locator)li.append(' · '+s.locator);ul.append(li);}
        if(ul.childNodes.length)box.append(ul);d.append(box);
      }
      list.append(d);
    }
  }
  level.onchange=result.onchange=render;render();
})();
