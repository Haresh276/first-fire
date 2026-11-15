/* Independent frozen archive-calculation evaluation. Run after scripts/build.py. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),data=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const bank=data('tests/chat/science-unseen-v1.json'),engine=data('site/science-chat.js');
if(sha(bank)!=='b556e445ff26e3ccbf72b410a44a80f23ee5586534b74051af1a23f89c687c87')throw Error('Question bank differs from the sealed v1 edition.');
const context=vm.createContext({window:{}});
for(const f of ['dist/records.js','dist/observation-rows.js'])vm.runInContext(data(f),context);
vm.runInContext(engine,context);
const {FFScienceChat:chat,FF:archive}=context.window,items=JSON.parse(bank);
function close(a,b){return typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b));}
function eq(a,b){return Array.isArray(b)?Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>close(v,b[i])):close(a,b);}
const cases=items.map(q=>{
 const turns=[];if(q.previous){const result=chat.answer(q.previous,[],archive);if(result)turns.push({question:q.previous,...result});}
 const actual=chat.answer(q.question,turns,archive),a=actual?.analysis,e=q.expected;
 const sourced=Array.isArray(actual?.sources)&&actual.sources.some(s=>s.url&&s.locator);
 const abstained=!actual || !a || !['answered','limited'].includes(actual.status)||a.value===null&&!a.groups?.length;
 let pass=false;
 if(e.type==='withhold')pass=abstained;
 else if(e.type==='groups'){
  const byLabel=new Map((a?.groups||[]).map(g=>[g.label.toLowerCase(),g.value]));pass=sourced&&['methanol','heptane'].every((k,i)=>close(byLabel.get(k),e.values[i]));
 }else pass=sourced&&a?.unit===e.unit&&a?.n===e.n&&eq(a?.value,e.value);
 return {...q,actual:{status:actual?.status||'outside calculator',answer:actual?.answer||'',n:a?.n??null,value:a?.value??null,unit:a?.unit??null,groups:a?.groups?.map(g=>({label:g.label,value:g.value})),sourceIds:actual?.sources?.map(s=>s.id)||[]},pass};
});
const report={version:1,questionSHA256:sha(bank),engineSHA256:sha(engine),recordsSHA256:sha(data('data/tests.csv')),strictPass:cases.filter(c=>c.pass).length,count:cases.length,cases};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log('Strict',report.strictPass+'/'+report.count,'engine',report.engineSHA256);
for(const q of cases.filter(c=>!c.pass))console.log(q.id,q.expected.type,q.actual.status,q.actual.value,q.actual.answer.slice(0,90));
