// With Playwright installed, run with Node from any directory. Pass the deployed
// /research-workspace/ URL to test the live site, or omit it to test the release files.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const site = new URL(process.argv[2] || 'https://first-fire.test/research-workspace/');
const files = path.resolve(__dirname, '../public/research-workspace');
const types = {
  '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml',
  '.webp':'image/webp', '.json':'application/json', '.ttf':'font/ttf'
};

async function exercise() {
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({serviceWorkers:'block'});
    const page = await context.newPage();
    const errors = [], probes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) probes.push(url.href);
    });
    if (!process.argv[2]) {
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        const filename = decodeURIComponent(url.pathname.slice(site.pathname.length)) || 'index.html';
        const resolved = path.resolve(files, filename);
        if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname) || !resolved.startsWith(files + path.sep)) {
          return route.abort();
        }
        try {
          const body = await fs.readFile(resolved);
          return route.fulfill({contentType:types[path.extname(filename)] || 'application/octet-stream', body});
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
          return route.fulfill({status:404, body:''});
        }
      });
    }
    await page.goto(new URL('#home',site).href);
    const input = page.locator('#ffchat-question');
    const replies = page.locator('.ffchat-reply');
    const body = reply => reply.locator('.ffchat-answer-text').innerText();
    async function ask(question, expected) {
      const count = await replies.count();
      await input.fill(question);
      await input.press('Enter');
      const answer = replies.nth(count);
      await answer.waitFor({timeout:25000});
      assert.match(await body(answer),expected,question);
      return answer;
    }
    const detail = 'give a detailed answer about the experiment';
    await ask('can you explain to me about Nomex', /meta-aramid/i);
    const answer = await ask(detail, /22\.1%.*20 cm\/s/s);
    assert.match(await body(answer), /140 s.*did not ignite.*soot.*1-g/s);
    await ask('source 2', /Thomsen.*\[2\]/);
    await ask('thanks', /welcome/);
    await ask('how long did it burn?', /140 s.*composite/);
    await ask('Can you explain FLEX-155?', /droplet|FLEX-155|cool flame/i);
    await ask(detail, /FLEX-155.*18%/s);
    await ask('cite your sources', /FLEX/i);

    await page.goto(new URL('#chat',site).href);
    await page.reload();
    await replies.nth(7).waitFor();
    assert.equal(await replies.count(),8);
    await page.getByRole('button',{name:'Retry answer',exact:true}).nth(1).click();
    await page.waitForFunction(() => document.querySelectorAll('.ffchat-reply').length === 2);
    assert.match(await body(replies.last()), /Nomex/);
    assert.doesNotMatch(await body(replies.last()), /FLEX/);
    await page.getByRole('button',{name:'Edit question',exact:true}).first().click();
    await input.fill('Can you explain FLEX-155?');
    await input.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('.ffchat-reply').length === 1);
    await ask(detail, /FLEX-155/);
    await page.getByRole('button',{name:'New chat',exact:true}).click();
    await ask(detail, /Which experiment/);
    const state = await page.evaluate(() => JSON.parse(sessionStorage.getItem('first-fire.chat.v1')));
    assert.equal(state.threads.filter(thread => thread.turns.length).length,4);
    assert.deepEqual(probes,[]);
    assert.deepEqual(errors,[]);
    console.log('Passed the Nomex conversation, sources, topic switch, refresh, edit, retry, new chat and public network checks.');
  } finally {
    await browser.close();
  }
}
exercise().catch(error => {console.error(error); process.exitCode = 1;});
