/* Exercise the normal chat screen using a fresh browser session per question.
   Usage: node scripts/run_local_chat_exam.cjs BANK.json OUTPUT.jsonl http://127.0.0.1:PORT
   A run may resume only against identical inputs and serving assets. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const [bank, output, origin] = process.argv.slice(2);
if (!bank || !output || !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin || '')) throw Error('Provide bank, output.jsonl and loopback origin');
async function main() {
  const bytes = fs.readFileSync(bank);
  const questions = JSON.parse(bytes).questions;
  const health = await (await fetch(origin + '/api/health')).json();
  if (!health.ready || !health.model_digest) throw Error('Local model unavailable');
  const index = await (await fetch(origin)).text();
  const assets = Object.fromEntries(await Promise.all([...index.matchAll(/<script[^>]* src="([^"]+)"/g)].map(async ([,name]) => {
    const response = await fetch(origin + '/' + name);
    if (!response.ok) throw Error('Missing script ' + name);
    return [name, sha(Buffer.from(await response.arrayBuffer()))];
  })));
  const registry = await fetch(origin + '/chat-passages.js');
  const registrySHA256 = registry.ok ? sha(Buffer.from(await registry.arrayBuffer())) : null;
  const fingerprint = sha(JSON.stringify([sha(bytes),health,sha(index),assets,registrySHA256]));
  const meta = output + '.meta.json';
  if (fs.existsSync(meta)) {
    if (JSON.parse(fs.readFileSync(meta)).fingerprint !== fingerprint) throw Error('Cannot resume against different inputs or model');
  } else {
    if (fs.existsSync(output)) throw Error('Missing receipt for existing run');
    fs.writeFileSync(meta, JSON.stringify({started:new Date().toISOString(),fingerprint,bankSHA256:sha(bytes),health,assets,registrySHA256},null,2)+'\n');
  }
  const done = new Set((fs.existsSync(output)?fs.readFileSync(output,'utf8'):'').split('\n').filter(Boolean).map(line=>JSON.parse(line).id));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
  try {
    for (const q of questions) {
      if (done.has(q.id)) continue;
      const page = await browser.newPage();
      let api = [];
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/api/chat') api.push(response.json());
      });
      try {
        await page.goto(origin + '/#chat');
        let n = 0;
        for (const message of [...(q.history||[]).filter(t=>t.role==='user').map(t=>t.content),q.message]) {
          api = [];
          await page.locator('#ffchat-question').fill(message);
          await page.locator('#ffchat-question').press('Enter');
          await page.waitForFunction(n=>document.querySelectorAll('.ffchat-reply').length===n,++n,{timeout:160000});
        }
        const turn = await page.evaluate(()=>JSON.parse(sessionStorage.getItem('first-fire.chat.v1')).threads.at(-1).turns.at(-1));
        const displayed = await page.locator('.ffchat-answer-text').last().innerText();
        if (turn.question!==q.message || !displayed.trim()) throw Error('Transcript or visible answer missing ' + q.id);
        const textMatches=turn.answer.trim()===displayed.trim();
        const service = await Promise.all(api);
        if (service.some(s=>s.error)) throw Error('Service failed for ' + q.id);
        fs.appendFileSync(output,JSON.stringify({id:q.id,level:q.level||q.difficulty,question:q.message,displayed,textMatches,turn,service})+'\n');
        done.add(q.id);
        if (done.size%10===0) console.log(done.size+'/'+questions.length);
      } finally {await page.close();}
    }
  } finally {await browser.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
