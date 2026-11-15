/* Run against built dist (file by default) or pass a FIRST_FIRE_QA_URL local HTTP deployment. */
'use strict';
const path=require('node:path'),os=require('node:os'),fs=require('node:fs'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const base=process.env.FIRST_FIRE_QA_URL||pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href;
const exe=process.env.CHROMIUM_EXECUTABLE||(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(fs.existsSync));
(async()=>{
  const browser=await chromium.launch({executablePath:exe,headless:true});
  try{
    const page=await browser.newPage({viewport:{width:800,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    async function ask(q){
      await page.goto(base+'#chat');await page.reload();
      const input=page.locator('#ffchat-question');await input.fill(q);await input.press('Enter');
      const a=page.locator('.ffchat-reply').last();await a.locator('.ff-chat-evidence').waitFor({state:'attached'});
      return {reply:a,body:await a.locator('.ffchat-answer-text').innerText(),intent:await a.locator('.ff-intent strong').innerText()};
    }
    const missing=await ask('Compare CFI-G 21088A1 with CFI-G 21202.');
    assert.equal(missing.intent,'Compare records');assert.doesNotMatch(missing.body,/\d/);assert.match(missing.body,/two distinct row identifiers/);
    const rows=await ask('Compare FLEX-155 versus FLEX-120.');
    assert.match(rows.body,/Different entries/);assert.equal(rows.intent,'Compare records');
    await rows.reply.getByRole('button',{name:'Show source 1'}).first().click();
    const proof=rows.reply.locator('.ff-proof').first();await proof.locator('summary').click();assert.match(await proof.innerText(),/CSV row/);
    assert.match(await proof.innerText(),/[a-f\d]{64}/);assert(await proof.getByRole('button',{name:'Copy citation'}).isVisible());
    await rows.reply.getByRole('button',{name:'Not what I meant'}).click();await rows.reply.getByRole('button',{name:'Cabin physics'}).click();
    await page.getByText('To run a sealed-cabin calculation,',{exact:false}).waitFor();
    assert.equal(await page.locator('.ffchat-reply .ff-intent strong').last().innerText(),'Cabin physics');
    const compass=await ask('Rank liquid records for a lunar habitat at 34% oxygen and 8.2 psia.');
    assert.match(compass.body,/eligible liquid rows/);assert.match(compass.body,/Closest row/);
    await compass.reply.locator('.rf-continue').click();await page.getByRole('heading',{name:'Habitat compass',exact:true}).waitFor();
    assert.equal(await page.getByLabel('Required test subject').inputValue(),'liquid');
    assert.equal(await page.getByLabel('Absolute pressure (psia)').inputValue(),'8.2');
    const physics=await ask('What if cellulose burns in a 12 m3 sealed cabin?');
    assert.match(physics.body,/specify fuel, surface/);await physics.reply.locator('.rf-continue').click();
    await page.locator('[name="volume"]').waitFor();assert.equal(await page.locator('[name="volume"]').inputValue(),'12');
    assert.equal(await page.locator('[name="pressure"]').inputValue(),'');
    const quote=await ask('Check the quotation “Despite this significant heating load, the fabric was not ignited.” and the claim “The Nomex fabric did not ignite in Saffire-II sample 2-7.”');
    assert.match(quote.body,/did not ignite/);assert.equal(quote.intent,'Verify a claim');
    const custom=await ask('Check the quote “Despite this significant heating load, the fabric was not ignited.” and the claim “This can be certified safe for any spacecraft.”');
    assert.doesNotMatch(custom.body,/certified safe/);
    const historical=await ask('Tell me about the Apollo fire accident');
    assert.match(historical.body,/1967/);assert.match(historical.body,/Grissom/);assert.match(historical.body,/“/);
    await historical.reply.locator('.ff-chat-evidence summary').click();
    assert.match(await historical.reply.locator('.ff-chat-evidence').innerText(),/NASA excerpts/);
    const link=await historical.reply.getByRole('link',{name:'Report an error'}).getAttribute('href');
    assert(!decodeURIComponent(link).includes('Tell me about the Apollo fire accident'));
    await page.goto(base+'#referee?view=errors');await page.getByText('Evidence scores and release history').waitFor();
    assert(await page.getByText(/Versioned public errors/).isVisible());
    const decorated=await page.evaluate(async()=>{
      const div=document.createElement('div');document.body.append(div);
      const urls=['https://humans-in-space.jaxa.jp/docs/report.pdf','https://jaxa.go.jp/source','https://www.isro.gov.in/mission','https://isro.gov.in.example.com/invalid'];
      for(const href of urls){const item=document.createElement('p'),a=document.createElement('a');a.href=href;a.textContent='Report, slide 26';item.append(a);div.append(item);}
      FFProofDrawer.attach(div);
      return [...div.children].map(n=>({proof:!!n.querySelector('.ff-proof'),details:n.querySelector('.ff-proof')?.textContent}));
    });
    assert.deepEqual(decorated.map(a=>a.proof),[true,true,true,false]);assert.match(decorated[0].details,/slide 26/i);
    assert.deepEqual(errors,[]);console.log('Passed contextual handoff, corrected intent, quote/quantity guard, private report, cross-view proof and ambiguity checks.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
