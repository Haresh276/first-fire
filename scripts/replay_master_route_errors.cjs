/* Replay misclassifications from two historical banks or the latest independent bank.
   All downstream components use the installed release; the old classifier is SHA-verified. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib'),{pathToFileURL}=require('node:url');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..'), dir=process.env.FIRST_FIRE_QA_DIST||path.join(root,'dist');
const base=process.env.FIRST_FIRE_QA_URL||pathToFileURL(path.join(dir,'index.html')).href;
const exe=process.env.CHROMIUM_EXECUTABLE||(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(fs.existsSync));
const digest=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
  const browser=await chromium.launch({executablePath:exe,headless:true});
  const results=[];
  try{
    const first=gunzipSync(fs.readFileSync(path.join(root,'tests/chat/snapshots/intent-v1.js.gz')));
    const prior=gunzipSync(fs.readFileSync(path.join(root,'tests/chat/snapshots/intent-v2.js.gz')));
    const final=fs.readFileSync(path.join(dir,'intent-router.js'));
    const banks=process.argv.includes('--third')?[['master-route-third.json',final]]:[['master-route-first.json',first],['master-route-generalization.json',prior]];
    for(const [source,code] of banks){
      const bank=JSON.parse(fs.readFileSync(path.join(root,'site',source)));
      if(digest(code)!==bank.routerSHA256)throw Error('Router fingerprint does not match '+source);
      for(const row of bank.cases.filter(r=>!r.pass)){
        const context=await browser.newContext(),page=await context.newPage();
        try{
          await page.goto(base+'#chat');await page.locator('#ffchat-question').waitFor();
          await page.addScriptTag({content:code.toString('utf8')});
          const input=page.locator('#ffchat-question');await input.fill(row.question);await input.press('Enter');
          const reply=page.locator('.ffchat-reply').last();
          await reply.locator('.ff-chat-evidence').waitFor({state:'attached',timeout:40000});
          const answer=await reply.locator('.ffchat-answer-text').innerText();
          const turn=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('first-fire.chat.v1')).threads.at(-1).turns.at(-1));
          results.push({bank:source,routerSHA256:bank.routerSHA256,id:row.id,question:row.question,expected:row.expected,scoredIntent:row.actual,renderedIntent:turn.intent.type,status:turn.status,kind:turn.evidenceKind,answer});
        }finally{await context.close();}
      }
    }
  }finally{await browser.close();}
  const sha={};for(const f of ['chat-ui','evidence-desk','record-facts','source-claims','source-claim-reviews','referee-deck','proof-drawer'])sha[f]=digest(fs.readFileSync(path.join(dir,f+'.js')));
  const artifact={method:'Read the visible reply of a real signed-out Chromium chat in a clean context for each initially misclassified item. Each question uses its original frozen router with the current downstream evidence gate. Includes citation markers; assessment of substantive numeric assertions is documented in research/answer-verification.md.',moduleSHA256:sha,rows:results};
  const output=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
  fs.writeFileSync(output||path.join(root,'site',process.argv.includes('--third')?'master-route-third-answers.json':'master-route-error-answers.json'),JSON.stringify(artifact,null,2)+'\n');
  for(const r of results)console.log(r.id,r.scoredIntent,r.renderedIntent,r.answer.replace(/\n+/g,' '));
})().catch(e=>{console.error(e);process.exitCode=1;});
