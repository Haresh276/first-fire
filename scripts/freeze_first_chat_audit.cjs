/* Preserve the first blind run. This script only joins already graded responses. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {metrics}=require('./fit_reply_confidence.cjs');
const [directory,gradesFile,output]=process.argv.slice(2);
const read=p=>fs.readFileSync(p),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const keyFile=path.join(directory,'key.json'),key=JSON.parse(read(keyFile)),grades=JSON.parse(read(gradesFile));
const hashes={key:hash(read(keyFile)),grades:hash(read(gradesFile))},tracks={};
for(const track of ['previous','current','selector']){
  const file=path.join(directory,track+'.jsonl'),bytes=read(file),inputs=new Map(bytes.toString().trim().split('\n').map(s=>{const r=JSON.parse(s);return [r.id,r];}));
  hashes[track]=hash(bytes);
  const rows=grades.filter(g=>key[g.ticket][0]===track).map(g=>{
    const id=key[g.ticket][1],r=inputs.get(id);
    if(g.id!==id||typeof g.passed!=='boolean'||!r)throw Error('Incorrect ID join');
    const v=r.turn?.verification,p=track==='current'?v.calibration.probability:track==='previous'?v.confidence.value:null;
    return {id,level:r.level,correct:g.passed,probability:p,model:v?.calibration?.model,reason:g.reason,code:g.code};
  }).sort((a,b)=>a.id.localeCompare(b.id));
  if(rows.length!==100||inputs.size!==100||new Set(rows.map(r=>r.id)).size!==100)throw Error('Incomplete first test');
  const numeric=rows.filter(r=>Number.isFinite(r.probability)),pass=rows.filter(r=>r.correct).length;
  tracks[track]={n:rows.length,passed:pass,numericCoverage:numeric.length,metrics:numeric.length?metrics(numeric,.79):null,rows};
}
const report={description:'Bank A first cold run. Previous numbers were evidence-factor scores where available. Current numbers predicted complete answer correctness and were frozen at 79/100 development prevalence. The selector has no calibrated probability.',hashes,tracks};
const content=JSON.stringify(report,null,2)+'\n';
if(fs.existsSync(output) && read(output).toString()!==content)throw Error('Original report already exists with a different fingerprint');
fs.writeFileSync(output,content);
console.log(hash(content),Object.fromEntries(Object.entries(tracks).map(([k,t])=>[k,t.passed])));
