/* After scripts/build.py. Use FIRST_FIRE_QA_URL and CHROMIUM_EXECUTABLE as in tests/browser.cjs. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
function dependency(name){try{return require(name);}catch{return require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',name));}}
const {chromium}=dependency('playwright'),{PDFDocument}=dependency('pdf-lib'),Zip=dependency('jszip');
const samples=require('./reader-samples.json');
const entry=new URL(process.env.FIRST_FIRE_QA_URL||pathToFileURL(path.resolve(__dirname,'../dist/index.html')));
const qa=[
  ['How many methanol observations are in FLEX?',/157/],
  ['How many heptane observations are in FLEX?',/117/],
  ['What happened in the Apollo 1 fire?',/1967|Grissom|Apollo 1/],
  ['Did the Nomex ignite in Saffire-II sample 2-7?',/did not ignite|no evidence of ignition|not ignited/i],
  ['What happened after the visible flame disappeared in FLEX-155?',/cool.flame|vapor/i],
  ['How many of the four FM² burns have been observed on the Moon?',/zero|0 verified|no.*(observ|resolv)/i],
  ['What is the FM² forecast probability of sustained spread at 25% oxygen?',/25\.25%/],
  ['What is the FM² forecast probability of sustained spread at 29% oxygen?',/97\.72%/],
  ['What is the FM² forecast probability of sustained spread at 33% oxygen?',/99\.99%/],
  ['Who won the football game?',/don.t have|archives?|cannot|could not|source|support|evidence/i]
];
async function bytes(format,text){
  if(format==='pdf'){
    const doc=await PDFDocument.create();const page=doc.addPage();page.drawText(text,{x:30,y:450,size:9});return Buffer.from(await doc.save());
  }
  if(format==='docx'){
    const z=new Zip();z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    z.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:body></w:document>');
    return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  }
  return Buffer.from(text);
}
async function privacy(browser){
  const ctx=await browser.newContext();const page=await ctx.newPage();try{
    const forbidden=[],requested=[];const canary='PRIVATE_RESUME_CANARY_LOCAL_ONLY';
    await page.route('**/*',r=>{const req=r.request();requested.push(req.url());const request=[req.url(),JSON.stringify(req.headers()),req.postData()||''].join(' ');if(request.includes(canary)||req.method()!=='GET')forbidden.push(request.slice(0,250));return r.continue();});
    await page.goto(new URL('#chat',entry).href);const opener=page.getByText('Reading preferences',{exact:true});await opener.click();
    const upload=page.getByLabel('Suggest a level from a résumé');
    for(const s of samples){
      const text=s.text+' '+canary+s.id;
      await upload.setInputFiles({name:'fictional-'+s.id+'.'+s.format,mimeType:{pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',md:'text/markdown'}[s.format],buffer:await bytes(s.format,text)});
      await page.locator('.rf-preferences [role=status]').filter({hasText:'Suggested'}).first().waitFor();
      assert.equal(await page.getByLabel('Answer detail').inputValue(),s.level,s.id);assert.equal(await page.getByLabel('Examples from').inputValue(),s.field,s.id);
    }
    const raw=await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));assert(!raw.includes(canary));assert(!raw.includes('fictional-'));
    assert.deepEqual(forbidden,[]);
    assert(!requested.some(url=>/web-llm\.mjs|params_shard|\.wasm$|huggingface\.co|model\.js|search-vectors/.test(url)));
    console.log('10/10 synthetic documents parsed at expected level and discipline. No raw text in requests, browser storage or network payloads.');
  }finally{await ctx.close();}
}
async function parity(browser){
  let reference;
  for(const name of ['lite','standard','pro']){
    const ctx=await browser.newContext();const page=await ctx.newPage();const fetched=[];page.on('request',req=>fetched.push(req.url()));
    try{
      await page.goto(new URL('#awareness',entry).href);await page.getByLabel('Device mode').selectOption(name);
      await page.goto(new URL('#search?q=wire%20insulation%20smoke',entry).href);await page.locator('#matches .result').first().waitFor();
      assert.match(await page.locator('#matches').innerText(),name==='lite'?/^Keyword retrieval/im:/semantic \+ keyword/im);
      assert.equal(fetched.some(url=>url.endsWith('search-vectors.js')),name!=='lite');
      const answers=[];
      for(const [q,pattern] of qa){
        await page.goto(new URL('#chat',entry).href);const box=page.locator('.ffchat textarea');const start=page.getByRole('button',{name:'New chat'});if(await start.isEnabled())await start.click();
        await box.fill(q);await box.press('Enter');await page.locator('.ffchat-answer-text').last().waitFor();const result=await page.locator('.ffchat-answer-text').last().innerText();assert.match(result,pattern,q+' → '+result);answers.push(result);
      }
      assert(!fetched.some(url=>/web-llm\.mjs|params_shard|\.wasm$|\/model\.js$/.test(url)));
      assert(fetched.some(url=>url.endsWith(name==='lite'?'observation-rows-lite.js':'observation-rows.js')));
      assert(!fetched.some(url=>url.endsWith(name==='lite'?'observation-rows.js':'observation-rows-lite.js')));
      if(reference)assert.deepEqual(answers,reference);else reference=answers;
      console.log(name+' passed ten first-turn answers and search loading checks.');
    }finally{await ctx.close();}
  }
}
// These are supplied signals on one workstation. Timing starts at navigation.
async function profileTiming(browser){
  for(const [tier,ram,cores,gpu,free] of [['lite',2,2,false,150000000],['standard',4,4,true,1500000000],['pro',8,8,true,2000000000]]){
    const ctx=await browser.newContext({viewport:{width:tier==='lite'?360:1400,height:850}});const page=await ctx.newPage();
    try{
      if(tier==='lite'){const client=await ctx.newCDPSession(page);await client.send('Emulation.setCPUThrottlingRate',{rate:4});}
      await page.addInitScript(({ram,cores,gpu,free})=>{
        for(const [key,value] of Object.entries({deviceMemory:ram,hardwareConcurrency:cores,storage:{estimate:async()=>({quota:free,usage:0})},gpu:{requestAdapter:async()=>gpu?{limits:{maxStorageBufferBindingSize:1<<27}}:null}}))Object.defineProperty(navigator,key,{configurable:true,value});
      },{ram,cores,gpu,free});
      await page.goto(entry.href,{waitUntil:'domcontentloaded'});await page.getByRole('link',{name:'Run the investigation'}).waitFor();
      const ms=await page.evaluate(()=>performance.now());const observed=await page.evaluate(async()=>{await FFReaderDevice.measure();return FFAwareness.tier();});
      assert.equal(observed,tier);console.log('Supplied '+tier+' signals, first visible investigation action '+Math.round(ms)+' ms.');
    }finally{await ctx.close();}
  }
}
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});try{await profileTiming(b);await privacy(b);await parity(b);}finally{await b.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
