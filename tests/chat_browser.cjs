/*
  Browser regression for the built FIRST FIRE chat. Requires a running local chat service and
  Playwright with Chromium. From first-fire, run: node tests/chat_browser.cjs
  Optional variables: CHROMIUM_EXECUTABLE, FIRST_FIRE_CHAT_URL, FIRST_FIRE_CHAT_SCREENSHOT.
  Use a clean browser context for each origin. Chats contain only authored test questions.
*/
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');

function playwright() {
  try { return require('playwright'); }
  catch (error) {
    const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    if (fs.existsSync(bundled)) return require(bundled);
    throw error;
  }
}

const dist = path.resolve(__dirname, '../dist');
const live = new URL(process.env.FIRST_FIRE_CHAT_URL || 'http://127.0.0.1:8765/');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(live.hostname), 'Choose a loopback URL for local model tests.');
const frozen = JSON.parse(fs.readFileSync(path.join(dist, 'data/chat-benchmark.json'), 'utf8'));
const screenshot = process.env.FIRST_FIRE_CHAT_SCREENSHOT || path.join(os.tmpdir(), 'first-fire-chat-final.png');
const QUESTION = 'Did the Nomex ignite in Saffire-II sample 2-7?';
const APOLLO = 'tell me about the apollo fire accident';
const existingId = 'prior-apollo-thread';
const oldAnswer = 'Ground and space experiments help researchers understand flame spread. Saffire-I (PSI-98).';
const sizes = [{width:360,height:800},{width:811,height:979},{width:1280,height:860}];

async function waitForTurns(page, count) {
  await page.waitForFunction(expected => document.querySelectorAll('.ffchat-reply').length === expected, count, {timeout:150000});
}

async function send(page, question) {
  const composer = page.getByRole('textbox',{name:'Your question'});
  await composer.fill(question);
  await composer.press('Enter');
}

async function checkLayout(page, name) {
  for (const size of sizes) {
    const {width} = size;
    await page.setViewportSize(size);
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
      offscreen: [...document.querySelectorAll('main button, main select, main textarea, main input')].filter(el => {
        if (!el.getClientRects().length) return false;
        const box = el.getBoundingClientRect();
        return box.left < -1 || box.right > innerWidth + 1;
      }).map(el => el.outerHTML.slice(0,100))
    }));
    assert(geometry.content <= geometry.width + 1, name + ' page overflow at ' + width);
    assert.deepEqual(geometry.offscreen, [], name + ' interactive control clipping at ' + width);
  }
}

async function benchmark(page) {
  const rows = frozen.rows;
  assert.equal(rows.length,100);
  assert.equal(new Set(rows.map(r => r.id)).size,100);
  const nav = page.getByRole('navigation',{name:'Workspace'});
  await nav.locator('summary').filter({hasText:'Explore'}).click();
  await nav.getByRole('link',{name:'Chat benchmark'}).click();
  await page.locator('.bm-count').getByText('100 of 100 questions',{exact:true}).waitFor();
  const item = page.locator('.bm-item');
  const pass = rows.filter(r => r.pass).length;
  assert.equal(await item.count(),100);
  const select = page.getByLabel('Outcome');
  await select.selectOption('fail');
  assert.equal(await item.count(),100-pass);
  assert.equal(await page.locator('.bm-item summary .bm-ok').count(),0);
  await select.selectOption('pass');
  assert.equal(await item.count(),pass);
  assert.equal(await page.locator('.bm-item summary .bm-no').count(),0);
  await select.selectOption('');
  const chosen = rows.find(r => r.pass && r.citations.some(c=>c.url.startsWith('https://')));
  const query = page.getByLabel('Find a question');
  await query.fill(chosen.id.toLowerCase());
  assert.equal(await item.count(),1);
  assert.equal(await item.locator('.bm-id').textContent(),chosen.id);
  await item.locator('summary').first().click();
  assert.equal(await item.locator('.bm-answer').textContent(),chosen.answer);
  await item.getByText(chosen.expected, {exact:true}).waitFor();
  const external = chosen.citations.find(c => c.url.startsWith('https://'));
  assert(await item.locator('a').evaluateAll((links,url)=>links.some(a=>a.href===url && a.rel.includes('noopener')),external.url));
  if (external.locator) assert((await item.innerText()).includes(external.locator));
  await checkLayout(page,'benchmark result');
  const last = rows.at(-1);
  await query.fill(last.id);
  assert.equal(await item.count(),1);
  assert.equal(await item.locator('.bm-id').innerText(),last.id);
  await query.fill('');
  const difficulty = page.getByLabel('Difficulty');
  await difficulty.selectOption(last.level);
  assert.equal(await item.count(),rows.filter(r=>r.level===last.level).length);
  await query.fill('unmatched-integration-4826');
  await page.getByText('No matching questions. Clear a filter to see more.').waitFor();
  await page.getByRole('link', {name:'Return to chat'}).click();
  await page.getByRole('heading', {name:'Research chat'}).waitFor();
}

async function cancelResponse(page) {
  // Delay delivery of a synthetic reply so cancelling is deterministic even on fast machines.
  let release;
  const gate = new Promise(resolve => { release=resolve; });
  const glob = '**/api/chat';
  const route = async intercepted => {
    await gate;
    await intercepted.fulfill({json:{status:'abstained',answer:'Cancelled response.',citations:[]}}).catch(()=>{});
  };
  await page.route(glob,route);
  try {
    const received = page.waitForRequest(req=>req.method()==='POST' && new URL(req.url()).pathname==='/api/chat');
    await send(page,'Cancel this test reply');
    await received;
    await page.getByRole('button',{name:'Stop reply'}).click();
    await page.getByText(/Reply stopped/).waitFor();
    assert.equal(await page.getByRole('textbox',{name:'Your question'}).inputValue(),'Cancel this test reply');
  } finally {
    release();
    await page.unroute(glob,route);
  }
}

async function unsafeLinks(page) {
  const word = '<img src=invalid onerror="window.ffInjected=true">';
  await page.route('**/api/chat',route=>route.fulfill({json:{
    answer:word,status:'limited',model:'synthetic-safety-check',citations:[
      {id:'bad',title:'Unexpected script link',url:'javascript:alert(1)',locator:'for test'},
      {id:'ok',title:'NASA source',url:'https://ntrs.nasa.gov/citations/20170008805',locator:'page 25'}
    ]
  }}),{times:1});
  await send(page,'Check citation rendering');
  await page.getByText('Insufficient verified evidence',{exact:true}).last().waitFor();
  const answer=page.locator('.ffchat-reply').last();
  assert.equal(await answer.locator('.ffchat-answer-text img, img[onerror]').count(),0);
  assert.equal(await answer.locator('a').count(),0);
  assert(!((await answer.innerText()).includes(word)));
  assert.equal(await page.evaluate(()=>window.ffInjected),undefined);
}

async function recentChats(page) {
  await page.getByRole('button',{name:'History',exact:true}).click();
  return page.locator('.ffchat-history-link:visible');
}

async function chat(page, isLive) {
  await page.getByRole('heading',{name:'Research chat',exact:true}).waitFor();
  const input = page.getByRole('textbox',{name:'Your question'});
  await input.fill('First line');
  await input.press('Shift+Enter');
  await input.pressSequentially('Second line');
  assert.equal(await input.inputValue(),'First line\nSecond line');
  await waitForTurns(page,0);
  const localReply = isLive && page.waitForResponse(res=>new URL(res.url()).pathname==='/api/chat' && res.request().method()==='POST',{timeout:150000});
  await send(page,QUESTION);
  if (isLive) assert((await localReply).ok(),'Live mode should answer through the running chat service.');
  await waitForTurns(page,1);
  const first = page.locator('.ffchat-reply').first();
  const firstAnswer = await first.locator('.ffchat-answer-text').innerText();
  assert.match(await first.innerText(),/nomex/i);
  assert.match(await first.innerText(),/did not ignite|no observed Nomex ignition/i);
  assert((await first.locator('a').count())>0);
  assert((await first.locator('a').evaluateAll(links=>links.every(a=>a.hash===a.getAttribute('href') || new URL(a.href).protocol==='https:'))));
  await send(page, isLive?'And the downstream fabric?':'What should we test next?');
  await waitForTurns(page,2);
  const second=page.locator('.ffchat-reply').last();
  assert.match(await second.innerText(),isLive?/nomex/i:/Suggested next test/);
  assert.equal(await page.getByRole('button',{name:'Export',exact:true}).count(),0);
  assert.doesNotMatch(await page.locator('main').innerText(),/chat mode|local (transformer|service)|archive mode|selected passages|qwen3:0\.6b/i);
  await input.fill('Unsent draft');
  await benchmark(page);
  await waitForTurns(page,2);
  assert.equal(await input.inputValue(),'Unsent draft','Navigation within this document preserves the draft and conversation.');
  await page.reload();
  await page.getByRole('heading',{name:'What would you like to know?'}).waitFor();
  await waitForTurns(page,0);
  assert.equal(await input.inputValue(),'');
  const archive = await recentChats(page);
  assert.equal(await archive.count(),1);
  await archive.filter({hasText:QUESTION}).click();
  await waitForTurns(page,2);
  await page.getByRole('button',{name:'Edit question'}).first().click();
  await send(page,'Which oxygen stream contained 85% in CFI-G 21202 A1?');
  await waitForTurns(page,1);
  assert.match(await page.locator('.ffchat-reply').innerText(),/burner/i);
  const recent = await recentChats(page);
  assert.equal(await recent.count(),2);
  await recent.filter({hasText:QUESTION}).click();
  await waitForTurns(page,2);
  assert.equal(await first.locator('.ffchat-answer-text').innerText(),firstAnswer);
  await checkLayout(page,'chat after edits');
  if (isLive) {
    await cancelResponse(page);
    await unsafeLinks(page);
  }
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  await waitForTurns(page,0);
}

async function incidentChecks(page, capture) {
  // Reproduce a previous release's session before retrying the user's reported question.
  await page.evaluate(({existingId,question,oldAnswer})=>{
    const threads = [{id:existingId,turns:[{question,answer:oldAnswer,sources:[],status:'answered',mode:'local'}]}];
    sessionStorage.setItem('first-fire.chat.v1',JSON.stringify({version:1,current:existingId,threads}));
  },{existingId,question:APOLLO,oldAnswer});
  await page.reload();
  await page.getByRole('heading',{name:'What would you like to know?'}).waitFor();
  assert.equal(await page.locator('.ffchat-reply').count(),0,'Previous release sessions also open in an empty chat.');
  await (await recentChats(page)).filter({hasText:APOLLO}).click();
  await page.getByText(oldAnswer,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Retry answer'}).click();
  const latest = page.locator('.ffchat-reply').last();
  const answer = latest.locator('.ffchat-answer-text');
  await page.waitForFunction(()=>/1967/.test(document.querySelector('.ffchat-answer-text')?.innerText));
  const answerText = await answer.innerText();
  assert.match(answerText,/Apollo (1|I)\b/);
  assert.match(answerText,/ground|launch pad|plugs.out/i);
  assert.match(answerText,/White|three (astronauts|crew)|Grissom/i);
  assert.doesNotMatch(answerText,/Saffire|PSI-98|ground and space experiments/i);
  const sources = latest.locator('.ffchat-sources');
  const summary = sources.locator('summary');
  await latest.getByRole('button',{name:'Show source 1'}).first().click();
  assert(await sources.evaluate(n=>n.open),'Choosing an inline reference should open its source list.');
  assert(await sources.locator('a').first().evaluate(n=>n===document.activeElement));
  const visibleLinks = sources.locator('a:visible');
  const addresses = await visibleLinks.evaluateAll(links=>links.map(a=>a.href));
  assert(addresses.some(href=>new URL(href).hostname.endsWith('.nasa.gov')));
  assert.doesNotMatch(await sources.innerText(),/Saffire|PSI-98/);
  await summary.click();
  if (capture) {
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);
      await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo({top:0,behavior:'instant'});});
      await page.screenshot({path:screenshot.replace(/\.png$/,'-apollo-'+viewport.width+'.png')});
    }
  }
  const followUp = async (question,count,expected) => {
    await send(page,question);
    await waitForTurns(page,count);
    assert.match(await answer.innerText(),expected,question);
  };
  await page.setViewportSize(sizes[0]);
  const fontSizes = await page.evaluate(()=>['.ffchat-answer-text','#ffchat-question'].map(css=>parseFloat(getComputedStyle(document.querySelector(css)).fontSize)));
  assert(fontSizes.every(n=>n>=16),'Answer and composer text should remain readable on a phone.');
  await page.getByRole('textbox',{name:'Your question'}).fill('What caused it?');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await waitForTurns(page,2);
  assert.match(await answer.innerText(),/ignition|electrical|wiring/i);
  await page.setViewportSize(sizes[1]);
  await followUp('Who was on board?',3,/Chaffee/);
  await followUp('What happened to Apollo 13?',4,/tank|oxygen/i);
  await followUp('Who was on board?',5,/Swigert/);
  await followUp('Tell me about the Mir fire accident',6,/evidence|record|cover|support|source/i);
  assert.match(await answer.innerText(),/don’t have a source|do not have a source|no source|lack.*source|no (?:evidence|record)/i);
  assert.equal(await latest.locator('.ffchat-sources a').count(),0);
  assert.doesNotMatch(await answer.innerText(),/Grissom|Saffire|Swigert/);
  for (let refresh=0;refresh<2;refresh++) {
    await page.reload();
    await page.getByRole('heading',{name:'What would you like to know?'}).waitFor();
    await waitForTurns(page,0);
  }
  const saved = await page.evaluate(()=>JSON.parse(sessionStorage.getItem('first-fire.chat.v1')));
  assert.equal(saved.threads.length,2,'Refreshing does not create empty History entries.');
  assert.equal(saved.threads.find(t=>t.id===existingId).turns[0].answer,oldAnswer,'Retry retains the original conversation.');
  const retried = saved.threads.find(t=>t.id!==existingId);
  assert.equal(retried.turns.length,6);
  assert.equal(retried.turns[0].answer,answerText);
  const firstRequest = capture && page.waitForRequest(req=>req.method()==='POST' && new URL(req.url()).pathname==='/api/chat');
  await send(page,QUESTION);
  if (capture) assert.deepEqual((await firstRequest).postDataJSON().history,[],'First prompt after refresh must not send prior turns.');
  await waitForTurns(page,1);
  assert.match(await answer.innerText(),/nomex/i);
  const allRecent = await recentChats(page);
  assert.equal(await allRecent.count(),3);
  await allRecent.filter({hasText:/Reply 2/}).click();
  await waitForTurns(page,6);
}

async function main() {
  const {chromium}=playwright();
  const macChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath=process.env.CHROMIUM_EXECUTABLE || (fs.existsSync(macChrome)?macChrome:undefined);
  const browser=await chromium.launch({executablePath,headless:true});
  try {
    for (const [entry, isLive] of [[live.href,true],[pathToFileURL(path.join(dist,'index.html')).href,false]]) {
      const context=await browser.newContext({viewport:{width:811,height:979}});
      try {
        const page=await context.newPage();
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        page.setDefaultTimeout(15000);
        await page.goto(new URL('#chat',entry).href);
        await chat(page,isLive);
        await benchmark(page);
        await waitForTurns(page,0);
        await page.setViewportSize({width:1280,height:860});
        await page.evaluate(()=>document.fonts.ready);
        if (isLive) await page.screenshot({path:screenshot});
        await incidentChecks(page,isLive);
        assert.deepEqual(errors,[]);
        console.log('Passed '+(isLive?'local HTTP transformer':'offline file')+' chat and benchmark checks.');
      } finally {await context.close();}
    }
    console.log('Desktop screenshot: '+screenshot);
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
