/* Inspect actual captured outputs without executing or grading a model in the reader's tab. */
(()=>{
 'use strict';
 const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 function label(title,input){
   const field=make('label',title,'field');
   input.setAttribute('aria-label',title);
   field.append(input);
   return field;
 }
 const link=(title,href)=>Object.assign(make('a',title),{href});
 function render(root){
   const data=window.FFArchiveAudits;const wrap=make('div',null,'stack');const title=make('header',null,'pagetitle');title.append(make('span','Benchmark notebook','eyebrow'),make('h1','Inspect the chat tests'),make('p','Read the question, the expected result and the answer FIRST FIRE actually gave. Choose a test run to see when its questions were first used.','sub'));wrap.append(title);
   const choose=make('select'),filter=make('select'),find=make('input');find.type='search';find.placeholder='Search, e.g. lunar, pressure, S06';
   for(const d of data){const o=make('option',d.title);o.value=d.id;choose.append(o);}
   for(const [v,l] of [['all','All results'],['fail','Misses only'],['pass','Passed only']]){const o=make('option',l);o.value=v;filter.append(o);}
   const controls=make('div',null,'bm-filters');controls.append(label('Test run',choose),label('Result',filter),label('Question or ID',find));wrap.append(controls);
   const overview=make('section',null,'panel stack'),result=make('p',null,'small'),list=make('div',null,'bm-list');result.setAttribute('role','status');wrap.append(overview,result,list);
   function update(){const set=data.find(d=>d.id===choose.value),items=set.cases,passed=items.filter(x=>x.pass).length;
     overview.replaceChildren(make('strong',passed+' / '+items.length+' passed'),make('p',set.description),link('Download this run’s answers (JSON) ↓',set.file));
     list.replaceChildren();const selected=items.filter(x=>(filter.value==='all'||x.pass===(filter.value==='pass'))&&(x.id+' '+x.question).toLowerCase().includes(find.value.trim().toLowerCase()));result.textContent=selected.length+' of '+items.length+' questions shown.';
     for(const x of selected){const item=make('details',null,'bm-item'),head=make('summary');head.append(make('span',x.id,'bm-id'),make('span',x.question,'bm-q'),make('span',x.pass?'Passed':'Missed',x.pass?'bm-ok':'bm-no'));const body=make('div',null,'bm-body');if(x.previous)body.append(make('h3','Preceding question'),make('p',x.previous));
       const e=x.expected,k=e.type||e.kind;let ref=k==='withhold'?'Withhold an unsupported numerical answer.':k==='groups'?'Methanol and heptane: '+e.values.join(' and '):k==='no_lunar_rate'?'The observed fraction is undefined; no lunar outcomes are recorded.':k==='no_lunar_count'?'Zero verified outcomes in this release.':String(Array.isArray(e.value)?e.value.join(' to '):e.value)+' '+e.unit+(e.n!==undefined?' · count: '+e.n:'');
       body.append(make('h3','Reference'),make('p',ref),make('h3',x.displayed!==undefined?'Answer shown in chat':'Calculator output'),make('p',x.displayed??(x.actual?.answer||'The question was outside the calculator.'),'bm-answer'));item.append(head,body);list.append(item);}
   }
   choose.onchange=filter.onchange=find.oninput=update;root.replaceChildren(wrap);wrap.append(link('Read the evaluation method and limitations →','#report/science-chat-audit'));update();
 }window.FFArchiveAudit={render};
})();
