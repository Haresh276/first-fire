/* Verify both offline reference tables and the live decision path. Set FLINT_URL for deployed QA. */
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
let chromium;
try {({chromium} = require('playwright'));}
catch {({chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const micro = require('../flint-engine/results/micro/micro_results.json');
const core = require('../flint-engine/results/core/results.json');
(async () => {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(process.env.FLINT_URL || pathToFileURL(path.join(__dirname,'../site/flint.html')).href);
    assert.equal(await page.locator('#solid-limit').textContent(), (100 * core.gravity.PC.moon).toFixed(2)+'% O₂');
    await page.locator('select[name=gravity]').selectOption('orbit');
    assert.equal(await page.locator('#solid-limit').textContent(), 'Not modelled');
    await page.locator('select[name=fan]').selectOption('10');
    assert.equal(await page.locator('#solid-limit').textContent(), (100 * core.gravity.PC.orbit_10cms).toFixed(2)+'% O₂');
    const atlas = micro.atlas_summary;
    assert.equal(await page.locator('.scenario').count(), atlas.solid_scenarios + atlas.droplet_scenarios);
    await page.locator('[data-filter=validity]').selectOption('not modelled');
    const status = () => page.locator('#atlas-status').textContent();
    assert.ok((await status()).includes('of '+atlas.not_modelled+' matching'));
    const topLine = await page.locator('.scenario:visible a').first().getAttribute('href');
    assert.ok(topLine.endsWith('atlas_solids.csv'));
    await page.locator('#atlas-next').click();
    assert.ok(await page.locator('#atlas-next').isDisabled());
    await page.locator('[data-filter=family]').selectOption('droplet');
    assert.ok((await status()).includes('No matching scenarios'));
    await page.getByRole('button',{name:'Clear filters'}).click();
    await page.waitForFunction(() => !document.querySelector('#atlas-next').disabled);
    await page.locator('[data-filter=family]').selectOption('droplet');
    assert.ok((await status()).includes('of '+atlas.droplet_scenarios+' matching'));
    const row = page.locator('.scenario:visible').first();
    await row.locator('summary').click();
    assert.ok((await row.textContent()).includes('Extinction diameter'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path:process.env.FLINT_SCREEN || path.join(os.tmpdir(),'flint-mobile.png')});
    await page.setViewportSize({width:1400,height:940});
    await page.screenshot({path:path.join(os.tmpdir(),'flint-desktop.png')});
    assert.deepEqual(errors,[]);
    console.log('FLINT browser verification passed.');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode=1;});
