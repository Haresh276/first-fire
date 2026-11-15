/* A local, read-only view of recorded test runs; no model is queried here. */
(()=>{'use strict';
const make=(t,txt,cls)=>{const e=document.createElement(t);if(txt!==null&&txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
const anchor=(text,href)=>{const e=make('a',text);e.href=href;return e;};
const opt=(v,t)=>{const o=make('option',t);o.value=v;return o;};
const metric=(value,label,caption)=>{const d=make('div',null,'bm-metric');d.append(make('strong',value),make('b',label),make('small',caption));return d;};
const score=(x,n)=>n?x+' / '+n:'—';const nice=v=>String(v??'').replace(/[_-]/g,' ');
function renderBenchmark(root){
 const records=window.FF||{}, B=records.chatBenchmark;
 root.replaceChildren();
 const crumbs=make('div',null,'breadcrumb');crumbs.append(anchor('Research desk','#home'),make('span','/'),'Model evaluation');
 const hero=make('section',null,'bm-head'),kicker=make('span','RECORDED EVALUATION','eyebrow');hero.append(kicker,make('h1','Can the chat defend its answers?'),make('p','Inspect the answers, sources and scoring checks from the recorded 100-question run. The results describe the tested version; they do not measure a researcher’s performance.','sub'));root.append(crumbs,hero);
 if(!B||!Array.isArray(B.rows)||!B.rows.length){root.append(make('p','No recorded run is included in this build.'));return;}
 const stats=make('div',null,'bm-stats');const rows=B.rows,success=rows.filter(r=>r.pass).length,content=rows.filter(r=>r.content).length,cs=rows.filter(r=>r.citation!==null),rs=rows.filter(r=>r.retrieval!==null);
 stats.append(metric(score(success,rows.length),'Full rubric','All required checks pass'),metric(score(content,rows.length),'Answer content','Frozen fact and contradiction checks'),metric(score(cs.filter(x=>x.citation).length,cs.length),'Citation check','Items scored for source matching'),metric(score(rs.filter(x=>x.retrieval).length,rs.length),'Retrieval @3','Items with a scored target'));root.append(stats);
 const methods=make('div',null,'bm-method panel');methods.append(make('span','Test conditions','eyebrow'),make('h2',B.name||'Local transformer run'),make('p',B.note||'Fixed corpus and rubric. The answer-content check is automated; passing it cannot establish that every statement is true.'),anchor('Read the evaluation and failure analysis →','#report/chat-benchmark'),make('p','A separate replay scores the same 100 responses after the chat’s evidence checks.'),anchor('See scores and abstentions after review →','#report/referee-replay'));methods.append(anchor('Inspect the archive calculator and browser tests →','#archive-audit'));root.append(methods);
 const controls=make('div',null,'bm-filters'),level=make('select'),outcome=make('select'),query=make('input');query.type='search';query.placeholder='Try “oxygen”, a case name, or Q072';level.append(opt('','Every difficulty'));[...new Set(rows.map(x=>x.level))].forEach(v=>level.append(opt(v,nice(v))));[['','All outcomes'],['fail','Failed a check'],['pass','Passed all checks']].forEach(([v,t])=>outcome.append(opt(v,t)));
 [[query,'Find a question'],[level,'Difficulty'],[outcome,'Outcome']].forEach(([e,l])=>{const a=make('label',l,'field');a.append(e);controls.append(a);});root.append(controls);
 const status=make('p','', 'bm-count');status.setAttribute('role','status');const list=make('div',null,'bm-list');root.append(status,list);
 const display=()=>{list.replaceChildren();const q=query.value.trim().toLowerCase(),matches=rows.filter(r=>(!level.value||level.value===r.level)&&(!outcome.value||(outcome.value==='pass')===r.pass)&&(!q||[r.question,r.id,r.answer,r.level].join(' ').toLowerCase().includes(q)));status.textContent=matches.length+' of '+rows.length+' questions';for(const r of matches){const row=make('details',null,'bm-item'),summary=make('summary');summary.append(make('span',r.id,'bm-id'),make('span',r.question,'bm-q'),make('span',r.pass?'Passed':'Failed',r.pass?'bm-ok':'bm-no'));const body=make('div',null,'bm-body');body.append(make('span',nice(r.level)+' · '+nice(r.status)+' · '+(Number.isFinite(r.ms)?(r.ms/1000).toFixed(2)+' s':'time unavailable'),'eyebrow'));if(r.history?.length){const h=make('details');h.append(make('summary','Conversation before this question'));r.history.forEach(x=>h.append(make('p',x.role+': '+x.content)));body.append(h);}
 body.append(make('h3','Returned answer'),make('p',r.answer||'No answer returned.','bm-answer'));
 if(r.expected){body.append(make('h3','Reference answer'),make('p',r.expected));}
 const checks=make('p','Content: '+(r.content?'pass':'fail')+' · Disposition: '+(r.behavior?'pass':'fail')+' · Citation: '+(r.citation==null?'not scored':r.citation?'pass':'fail')+' · Retrieval @3: '+(r.retrieval==null?'not scored':r.retrieval?'hit':'miss'));body.append(checks);
 if(r.missed?.length){const ul=make('ul');r.missed.forEach(v=>ul.append(make('li',v)));body.append(make('h3','Failed checks'),ul);}
 const citations=make('ul');for(const c of r.citations||[]){const li=make('li');if(/^https?:\/\//.test(c.url||'')){const a=anchor(c.title||c.id,c.url);a.target='_blank';a.rel='noopener noreferrer';li.append(a);}else li.append(make('span',c.title||c.id));if(c.locator)li.append(' · '+c.locator);citations.append(li);}if(citations.childNodes.length)body.append(make('h3','Sources returned'),citations);
 row.append(summary,body);list.append(row);}
 if(!matches.length)list.append(make('p','No matching questions. Clear a filter to see more.','panel'));
 };[level,outcome].forEach(e=>e.onchange=display);query.oninput=display;display();
 const links=make('div',null,'actions section');links.append(anchor('Download all recorded answers (JSON)','data/chat-benchmark.json'),anchor('Model comparison','#report/chat-models'),anchor('Return to chat','#chat'));root.append(links);
}
window.renderBenchmark=renderBenchmark;
})();
