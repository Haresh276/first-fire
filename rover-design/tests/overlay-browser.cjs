// Serve rover-design and run with the same Playwright setup as 3d-browser.cjs.
'use strict';
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.ROVER_TEST_URL || 'http://127.0.0.1:8766/prototype/';

async function selectOverlay(page, kind, active, text) {
  await page.locator('#scene-overlay').selectOption(kind);
  await page.waitForFunction(expected =>
    document.querySelector('#rover-scene').dataset.activeOverlay === expected, active);
  const reading = page.locator('#overlay-reading');
  if (kind === 'none') assert.equal(await reading.isVisible(), false);
  else assert.match(await reading.innerText(), text);
}

async function imageHash(page) {
  // Exclude the HTML legend so changing the caption alone cannot pass a geometry test.
  const image = await page.locator('#rover-scene').screenshot({
    style: '#overlay-reading { visibility: hidden !important }'
  });
  return createHash('sha256').update(image).digest('hex');
}

async function checkMarker(page, kind, exists, legend) {
  await selectOverlay(page, kind, exists ? kind : 'none', legend);
  const marker = await imageHash(page);
  await selectOverlay(page, 'none', 'none');
  const plain = await imageHash(page);
  if (exists) assert.notEqual(marker, plain, kind + ' must draw a visible marker');
  else assert.equal(marker, plain, kind + ' must omit its marker');
  return marker;
}

async function condition(page, key, value) {
  await page.locator('#views [data-view=conditions]').click();
  await page.locator('#conditions:visible').waitFor();
  const control = page.locator('#field-' + key);
  const section = page.locator('#fields details').filter({has: control});
  if (!await section.evaluate(details => details.open)) await section.locator('summary').click();
  if (await control.evaluate(el => el.tagName === 'SELECT')) await control.selectOption(value);
  else await control.fill(value);
  await page.locator('#views [data-view=workbench]').click();
  await page.locator('#workbench:visible').waitFor();
}

async function exercise(browser, fallback) {
  const page = await browser.newPage({viewport:{width:1260, height:870}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    if (fallback) await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(kind,...args) {
        return ['webgl','webgl2','experimental-webgl'].includes(kind) ? null : getContext.call(this,kind,...args);
      };
    });
    await page.goto(url, {waitUntil:'domcontentloaded'});
    await page.locator('#workbench:visible').waitFor();
    await page.waitForFunction(() => document.querySelector('#rover-scene')?.dataset.activeOverlay === 'none');
    const renderer = await page.locator('#rover-scene').getAttribute('data-renderer');
    if (fallback) assert.equal(renderer, 'canvas-3d');
    else if (process.env.ROVER_EXPECT_RENDERER) assert.equal(renderer, process.env.ROVER_EXPECT_RENDERER);
    else assert.ok(['webgl','canvas-3d'].includes(renderer));

    await checkMarker(page, 'gravity', true, /1\.62 m\/s²/);
    await page.locator('#drive-world').selectOption('Orbit');
    await checkMarker(page, 'gravity', false, /orbital free fall.*0 N/i);
    await page.locator('#drive-world').selectOption('Moon');

    await checkMarker(page, 'power', true, /450 W.*day/);
    await page.locator('#drive-phase').selectOption('night');
    await checkMarker(page, 'power', false, /0 W.*night/);
    await page.locator('#drive-phase').selectOption('day');

    const outward = await checkMarker(page, 'thermal', true, /W outward/);
    await condition(page, 'sinkK', '315');
    const inward = await checkMarker(page, 'thermal', true, /W inward/);
    assert.notEqual(inward, outward, 'hot sink must reverse the visible radiator arrow');
    await condition(page, 'sinkK', '295');
    await checkMarker(page, 'thermal', false, /0 W exchange/);

    await checkMarker(page, 'access', true, /Access loss [\d.,]+ mol.*1 cycles/);
    await condition(page, 'cycles', '0');
    await checkMarker(page, 'access', false, /Access loss 0 mol.*hull leakage/);

    const forward = await checkMarker(page, 'ventilation', true, /end A.*30 L\/s.*concurrent/);
    await condition(page, 'fanFrom', 'end B');
    const reverse = await checkMarker(page, 'ventilation', true, /end B.*30 L\/s.*opposed/);
    assert.notEqual(forward, reverse, 'reversing the duct inlet must reverse the visible fan arrow');
    await condition(page, 'exchangeLs', '0');
    await checkMarker(page, 'ventilation', false, /0 L\/s/);

    await checkMarker(page, 'suppression', true, /0\.6 kg.*extinction unmodeled/);
    await condition(page, 'dischargeS', '0');
    await checkMarker(page, 'suppression', false, /0 kg.*extinction unmodeled/);
    assert.deepEqual(errors, []);
    console.log('PASS '+renderer+' · six overlays, positive/zero gating, orbit and both flow reversals');
  } finally { await page.close(); }
}

(async () => {
  const options = {headless:true};
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  try { await exercise(browser, false); await exercise(browser, true); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
