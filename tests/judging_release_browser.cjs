/* Check the public hand-off, without cookies, from a copy of the tested release. */
const assert = require('node:assert/strict');
const path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), fs = require('node:fs');
let chromium;
try { ({chromium} = require('playwright')); } catch {
  ({chromium} = require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));
}
const base = new URL(process.argv[2] || 'http://127.0.0.1:8000/');
const dist = path.resolve(__dirname,'../dist');
const sums = JSON.parse(fs.readFileSync(path.join(dist,'checksums.json'),'utf8'));
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE});
  const context = await browser.newContext({viewport:{width:1280,height:900}});
  try {
    const p = await context.newPage(), errors = [];
    p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base.href,{waitUntil:'domcontentloaded'});
    await p.getByRole('heading',{name:'Will a flame keep spreading on the Moon?'}).waitFor();
    await p.getByRole('link',{name:/Open the rover fire case/}).click();
    await p.locator('#startup').waitFor({state:'hidden'});
    assert.match(await p.locator('#inventory-table').innerText(),/Nomex/i);
    await p.locator('a[href="flint.html"]').first().click();
    await p.locator('#solid-limit').waitFor();
    assert.match(await p.locator('#solid-limit').innerText(),/%/);
    await p.goto(new URL('submission.html',base).href);
    const links = await p.locator('main a[href]').evaluateAll(as=>as.map(a=>a.href));
    const urls = links.map(u=>new URL(u));
    // External PSI DOI accessibility is checked independently; never compare external bytes to our local manifest.
    const paths = [...new Set(urls.filter(u=>u.origin===base.origin)
      .map(u=>decodeURIComponent(u.pathname.replace(/^\//,''))))];
    for (const file of [...new Set([...paths,'forecast-lock/fm2-v2.json','forecast-lock/fm2-v2.tsr','master-round2-slides.pptx'])]) {
      const url = new URL(file,base);
      const r = await context.request.get(url.href,{timeout:45000});
      assert.equal(r.status(),200,file+' HTTP status');
      assert.equal(crypto.createHash('sha256').update(await r.body()).digest('hex'),sums[file],file+' bytes');
    }
    const disclosure=links.find(u=>u.includes('#disclosure'));
    await p.goto(disclosure);
    const text=await p.locator('#disclosure').innerText();
    for(const term of ['Claude','ChatGPT','synthetic English narration','SI-generated'])assert.ok(text.includes(term),term);
    const title = await p.locator('#disclosure').evaluate(el=>el.getBoundingClientRect().width);
    assert.ok(title>0);
    assert.deepEqual(errors,[]);
    console.log('Anonymous navigation, interactive initialization, disclosure and '+paths.length+' submission target checks passed at '+base.origin);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
