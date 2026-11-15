/* Score messages entered into the static chat UI. Requires Playwright and Chromium.
   node scripts/evaluate_science_browser.cjs BANK.json OUTPUT.json
   CHROMIUM_EXECUTABLE, FIRST_FIRE_QA_URL are optional. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url'),crypto=require('node:crypto');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'),[bank,out]=process.argv.slice(2);
if(!bank||!out)throw Error('Provide the question bank and output file paths.');
const assetDir=process.env.FIRST_FIRE_QA_DIST||path.join(root,'dist');
const entry=(process.env.FIRST_FIRE_QA_URL||pathToFileURL(path.join(assetDir,'index.html')).href).split('#')[0];
const raw=fs.readFileSync(bank),qs=JSON.parse(raw),h=b=>crypto.createHash('sha256').update(b).digest('hex');
const close=(a,b)=>typeof a==='number' && Number.isFinite(a) && Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b));
function score(q,t,displayed){
  const a=t.analysis,e=q.expected||q,k=e.type||q.kind,source=t.sources?.some(s=>s.locator&&s.url);
  if(t.answer.trim()!==displayed.trim())return false;
  if(k==='no_lunar_rate' || k==='no_lunar_count' || (k==='withhold'&&q.id==='S36'))
    return !!(source && /\b0 verified lunar burn outcomes out of 4|\bzero (?:documented|verified|resolved)/i.test(displayed) && /undefined|no measured success percentage/i.test(displayed));
  if(k==='withhold')return t.status==='abstained' && !a;
  if(k==='groups'){const by=new Map((a?.groups||[]).map(g=>[g.label.toLowerCase(),g.value]));return !!(source&&['methanol','heptane'].every((key,i)=>close(by.get(key),e.values[i])));}
  return !!(source&&a?.unit===e.unit&&(e.n===undefined||a.n===e.n)&&(Array.isArray(e.value)?Array.isArray(a?.value)&&a.value.length===e.value.length&&e.value.every((v,i)=>close(a.value[i],v)):close(a?.value,e.value)));
}
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true});const rows=[];
 try{const page=await b.newPage();for(const q of qs){await page.goto(entry+'#chat');await page.reload();let n=0;
   for(const question of [q.previous,q.question].filter(Boolean)){await page.locator('#ffchat-question').fill(question);await page.locator('#ffchat-question').press('Enter');n++;await page.waitForFunction(n=>document.querySelectorAll('.ffchat-reply').length===n,n);}
   const displayed=await page.locator('.ffchat-answer-text').last().innerText(),turn=await page.evaluate(q=>JSON.parse(sessionStorage.getItem('first-fire.chat.v1')).threads.at(-1)?.turns.at(-1),q);
   if(!turn || turn.question!==q.question)throw Error('Transcript mismatch: '+q.id);
   rows.push({id:q.id,previous:q.previous||null,question:q.question,expected:q.expected||Object.fromEntries(Object.entries(q).filter(([k])=>['kind','value','unit'].includes(k))),displayed,status:turn.status,evidenceKind:turn.evidenceKind||null,sourceIds:turn.sources?.map(s=>s.id),pass:score(q,turn,displayed)});
 } const releaseAssets=['chat-ui.js','science-chat.js','intent-router.js','evidence-desk.js','proof-drawer.js','record-facts.js','source-claims.js','source-claim-reviews.js','mission-receipts.js','observation-rows.js'];
 const engineSHA256=Object.fromEntries(releaseAssets.filter(file=>fs.existsSync(path.join(assetDir,file))).map(file=>[file,h(fs.readFileSync(path.join(assetDir,file)))]));
 const result={engineSHA256,scope:'Static chat as displayed in Chrome; same-tab follow-ups within each question only',bankSHA256:h(raw),localChatUISHA256:h(fs.readFileSync(path.join(assetDir,'chat-ui.js'))),n:rows.length,passed:rows.filter(x=>x.pass).length,cases:rows};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(result.passed+'/'+result.n,rows.filter(x=>!x.pass).map(x=>x.id).join(','));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
