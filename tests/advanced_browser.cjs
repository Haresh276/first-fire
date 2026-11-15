/* After python3 scripts/build.py, run node tests/advanced_browser.cjs.
   FIRST_FIRE_QA_URL can point to a deployed home page. CHROMIUM_EXECUTABLE
   selects a system Chromium. Each viewport starts in an isolated browser context. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {fileURLToPath, pathToFileURL} = require('node:url');

let chromium;
try {
  ({chromium} = require('playwright'));
} catch {
  ({chromium} = require(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));
}
const entry = new URL(process.env.FIRST_FIRE_QA_URL || pathToFileURL(path.resolve(__dirname, '../dist/index.html')));
entry.hash = '';
const signedSHA = '9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3';
const question = 'Which changes in oxygen and circulation justify a follow-up?';
const decision = 'Repeat methanol trials within one day. For a separate lunar specimen, test 25% oxygen after hypothetical sustained spread at 26%.';
const chatQuestion = 'Count methanol observations in FLEX.';
const button = (page, name) => page.getByRole('button', {name});
const rail = page => page.getByRole('navigation', {name:'Guided session'});

async function download(page, name, expectedFile) {
  const [file] = await Promise.all([page.waitForEvent('download'), button(page, name).click()]);
  assert.equal(file.suggestedFilename(), expectedFile);
  assert.equal(await file.failure(), null);
  return JSON.parse(await fs.readFile(await file.path(), 'utf8'));
}
async function checkWidth(page) {
  const [viewport, width] = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  assert(width <= viewport+2, `${page.url()} is ${width}px wide in a ${viewport}px viewport`);
}
async function next(page) {
  await rail(page).getByRole('link', {name:'Next step'}).click();
}
async function backToSession(page) {
  await rail(page).getByRole('link', {name:'Research session'}).click();
  await page.locator('.run-summary').waitFor();
}
async function signedForecastDigest(page) {
  const url = new URL('forecast-lock/fm2-v1.json', entry);
  let bytes;
  if (url.protocol === 'file:') bytes = await fs.readFile(fileURLToPath(url));
  else {
    const asset = await page.request.get(url.href);
    assert.equal(asset.status(), 200, 'Published forecast file must be available');
    bytes = await asset.body();
  }
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function compareFlights(page) {
  const reveal = button(page, 'Reveal outcomes');
  await reveal.waitFor();
  await checkWidth(page);
  const masked = await download(page, 'Download study JSON', 'first-fire-FLEX-matched-study.json');
  assert.equal(masked.outcomes_revealed, false);
  assert.equal('observed' in masked, false);
  assert.equal(masked.pairs.length, 3);
  for (const p of masked.pairs) for (const flight of [p.A,p.B]) assert.equal('observed' in flight, false);
  await reveal.click();
  await page.getByText('+1.6 s',{exact:true}).waitFor();
  const revealed = await download(page, 'Download study JSON', 'first-fire-FLEX-matched-study.json');
  assert.equal(revealed.outcomes_revealed, true);
  assert.equal(revealed.observed.n, 3);
  assert.equal(Number(revealed.observed.average.toFixed(1)), 1.6);
  assert.deepEqual(revealed.pairs.map(p => [p.A.id,p.B.id]), masked.pairs.map(p => [p.A.id,p.B.id]));
  // Verify a nondefault endpoint and the revealed state survive leaving the tool.
  await page.getByLabel('Measured endpoint').selectOption('diameter');
  await backToSession(page);
  await page.getByRole('link', {name:'Open matched analysis'}).click();
  assert.equal(await page.getByLabel('Measured endpoint').inputValue(), 'diameter');
  await page.getByLabel('Measured endpoint').selectOption('time');
  await page.getByText('+1.6 s',{exact:true}).waitFor();
  await page.locator('.tl-extra summary').click();
  await page.getByLabel('Pair only runs from the same UTC date').check();
  await button(page,'Apply protocol').click();
  await page.getByRole('heading',{name:'No matched pairs'}).waitFor();
  const after = await download(page, 'Download study JSON', 'first-fire-FLEX-matched-study.json');
  assert.equal(after.settings.sameDay, true);
  assert.deepEqual(after.pairs, []);
  assert.equal(after.outcomes_revealed, false);
}

async function simulateSensor(page) {
  await next(page);
  await button(page, 'Isolate the compartments').click();
  assert.match(await page.locator('#tr-cross').innerText(), /No crossing/);
  assert.match(await page.locator('#tr-peak').innerText(), /^0 mg/);
  await button(page, 'Increase circulation').click();
  assert.equal(await page.locator('#tr-cross').innerText(), '22.4 s');
  await page.getByLabel('Training run').selectOption('1');
  const trace = await download(page, 'Download assumptions and trace', 'first-fire-tracer-run.json');
  assert.equal(trace.scenario.exchange, 180);
  assert.equal(trace.repeatTrainingFold, 1);
  assert.deepEqual(trace.measuredRepeats.map(r => [r.train, r.observed]), [[206,174],[532,451]]);
  assert.equal(trace.trace.length, 301);
  assert(trace.massResidualMg < 1e-8);
  // Re-import the example traces under private file names. Only origins and compact results belong in the dossier.
  await page.getByText('CSV format and assumptions', {exact:true}).click();
  for (const arm of ['calibration','held-out']) {
    const [sample] = await Promise.all([page.waitForEvent('download'), button(page, 'Example '+arm+' CSV').click()]);
    const name = 'private-fixture-'+arm+'.csv';
    await page.getByLabel(arm+' sensor CSV', {exact:false}).setInputFiles({
      name,mimeType:'text/csv',buffer:await fs.readFile(await sample.path())
    });
    await page.getByText(name+' loaded', {exact:false}).waitFor();
  }
  await button(page, 'Fit and test held-out run').click();
  await page.getByRole('heading', {name:'Held-out sensor errors'}).waitFor();
  await checkWidth(page);
  const fit = await download(page, 'Download fit and residuals', 'first-fire-transport-fit.json');
  assert.deepEqual(fit.sources.map(s => s.origin), ['Synthetic example','Synthetic example']);
  assert.equal(fit.fitted.exchange_lps, 38);
  assert.equal(fit.fitted.sensor_tau_s, 11);
  assert.equal(fit.held_out_trace.length, 61);
  const heldRMSE = Math.sqrt(fit.held_out_trace.reduce((sum, r) => sum+r.two_zone_residual**2, 0)/61);
  assert(Math.abs(heldRMSE - fit.two_zone_held.rmse) < 1e-9);
  assert(fit.two_zone_held.rmse < fit.one_zone_held.rmse);
  await backToSession(page);
  await page.getByRole('link', {name:'Open transport simulation'}).click();
  await page.getByText('Fit saved in this session', {exact:true}).waitFor();
  await page.reload();
  await page.getByText('Fit saved in this session', {exact:true}).waitFor();
  assert.equal(await page.getByRole('heading', {name:'Held-out sensor errors'}).count(), 0);
  const retained = (await download(page, 'Download assumptions and trace', 'first-fire-tracer-run.json')).sensorFit;
  for (const key of ['fitted','baseline','near_fits','two_zone_held','one_zone_held','scenario_calibration','scenario_held_out','units']) {
    assert.deepEqual(retained[key],fit[key],key+' must survive a page reload');
  }
  assert.deepEqual(retained.source_origins,['Synthetic example','Synthetic example']);
  assert.equal(retained.calibration_n,61);
  assert.doesNotMatch(JSON.stringify(retained), /private-fixture|calibration_observations|held_out_trace|observed_mg_m3|"sources"/);
  assert.equal(await page.getByLabel('Training run').inputValue(), '1');
  assert.equal(await page.locator('#tr-cross').innerText(), '22.4 s');
}

async function designAndChat(page) {
  await next(page);
  assert.equal(await page.getByLabel('Trial oxygen').inputValue(), '26');
  assert.match(await page.locator('#dl-tree').innerText(), /25%/);
  assert.match(await page.locator('#dl-tree').innerText(), /27%/);
  await button(page, 'Spread sustained').click();
  assert.equal(await page.getByLabel('Trial oxygen').inputValue(), '25');
  await checkWidth(page);
  await next(page);
  const composer = page.locator('.ffchat textarea');
  assert.match(await composer.inputValue(), /methanol observations/);
  await composer.fill(chatQuestion);
  await composer.press('Enter');
  await page.getByText('157 normalized observation rows match.', {exact:true}).waitFor();
  await page.locator('.ffchat-exchange summary').first().click();
  const source = page.locator('.ffchat-exchange details a').first();
  assert.match(await source.innerText(), /FLEX/);
  assert.match(await source.getAttribute('href'), /^https:\/\//);
  const receipt = await download(page, 'Download calculation', 'first-fire-archive-calculation.json');
  assert.equal(receipt.question, chatQuestion);
  assert.equal(receipt.result.value, 157);
  assert.equal(receipt.rows.length, 157);
  assert.equal(new Set(receipt.rows.map(r => r.source_row)).size, 157);
  for (const r of receipt.rows) {
    assert.equal(r.accession, 'PSI-69');
    assert.equal(r.material.toLowerCase(), 'methanol');
    assert(Number.isInteger(r.source_row) && r.source_row > 1 && r.source_file);
  }
  await button(page, 'Edit question').click();
  assert.equal(await composer.inputValue(), chatQuestion);
  await button(page, 'Cancel edit').click();
  await checkWidth(page);
  await rail(page).getByRole('link', {name:'Review session'}).click();
}

async function verifyRecord(page) {
  const resultCount = page.getByText('4 of 4 tools have returned a result in this session.');
  await resultCount.waitFor();
  const notes = page.getByLabel('What does the evidence justify testing next?');
  await notes.fill(decision);
  const name = 'first-fire-research-session.json';
  const record = await download(page, 'Download research record', name);
  assert.equal(record.intention, question);
  assert.equal(record.decision, decision);
  assert.equal(record.status, 'four results captured');
  assert.equal(record.signedForecastSHA256, signedSHA);
  assert.equal(await signedForecastDigest(page), signedSHA);
  assert.deepEqual(Object.keys(record.records).sort(), ['chat','design-lab','transfer-lab','transport-lab']);
  const {records} = record;
  assert.equal(records['transfer-lab'].record.settings.sameDay, true);
  assert.deepEqual(records['transfer-lab'].record.matched_source_ids, []);
  assert.equal(records['transport-lab'].record.scenario.exchange, 180);
  assert.equal(records['transport-lab'].record.crossingSeconds.toFixed(1), '22.4');
  const fitSummary = records['transport-lab'].record.sensorFit;
  assert.equal(fitSummary.fitted.exchange_lps,38);
  assert.equal(fitSummary.fitted.sensor_tau_s,11);
  assert.equal(fitSummary.two_zone_held.n,61);
  assert.equal(fitSummary.two_zone_held.rmse.toFixed(3),'0.138');
  assert.equal(fitSummary.one_zone_held.rmse.toFixed(3),'5.080');
  assert.deepEqual(fitSummary.source_origins,['Synthetic example','Synthetic example']);
  assert.doesNotMatch(JSON.stringify(records['transport-lab']), /private-fixture|calibration_observations|held_out_trace|observed_mg_m3/);
  const design = records['design-lab'].record;
  assert.equal(design.kind, 'hypothetical');
  assert.deepEqual(design.history, [{oxygen:26, result:'yes'}]);
  assert.equal(design.recommendation.oxygen, 25);
  assert.deepEqual(design.official_outcomes, [null,null,null,null]);
  assert.equal(records.chat.record.question, chatQuestion);
  assert.equal(records.chat.record.analysis.value, 157);
  await page.reload();
  await resultCount.waitFor();
  assert.equal(await notes.inputValue(), decision);
  await checkWidth(page);
  const restored = await download(page, 'Download research record', name);
  assert.deepEqual(restored.records, records);
  assert.equal(restored.started, record.started);
  assert.equal(restored.intention, question);
  assert.equal(restored.decision, decision);
}

async function checkSeparateDesigns(page) {
  // Close this investigation, then create a distinct standalone design.
  await button(page, 'Close session').click();
  await button(page, 'Clear session').click();
  await page.goto(new URL('#design-lab', entry).href);
  const trial = page.getByLabel('Trial oxygen');
  assert.equal(await trial.inputValue(), '26');
  await button(page, 'No sustained spread').click();
  assert.equal(await trial.inputValue(), '27');
  // Opening a second guide must neither enroll the standalone run nor overwrite it.
  await page.goto(new URL('#session', entry).href);
  await button(page, 'Start guided session').click();
  await backToSession(page);
  await page.getByRole('link', {name:'Open experiment design'}).click();
  assert.equal(await trial.inputValue(), '26');
  assert.equal(await page.locator('#dl-history li').count(), 0);
  await button(page, 'Spread sustained').click();
  await page.reload();
  assert.equal(await trial.inputValue(), '25');
  assert.equal(await page.locator('#dl-history li').count(), 1);
  await backToSession(page);
  await button(page, 'Close session').click();
  await button(page, 'Clear session').click();
  await page.goto(new URL('#design-lab', entry).href);
  assert.equal(await trial.inputValue(), '27');
  assert.match(await page.locator('#dl-history').innerText(), /Did not sustain/);
}

async function journey(browser, viewport) {
  const context = await browser.newContext({viewport, isMobile:viewport.width<600});
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(entry.href);
    await page.getByRole('link', {name:'Run the investigation'}).click();
    await page.getByLabel('Research question', {exact:true}).fill(question);
    await button(page, 'Start guided session').click();
    await compareFlights(page);
    await simulateSensor(page);
    await designAndChat(page);
    await verifyRecord(page);
    await checkSeparateDesigns(page);
    assert.deepEqual(errors, []);
    console.log(`Passed the complete guided investigation at ${viewport.width}×${viewport.height}.`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_EXECUTABLE || undefined});
  try {
    for (const view of [{width:1360,height:900}, {width:360,height:800}]) await journey(browser, view);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
