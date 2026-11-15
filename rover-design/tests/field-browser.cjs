// Run against a local rover-design server with the same browser and URL overrides as 3d-browser.cjs.
'use strict';
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.ROVER_TEST_URL || 'http://127.0.0.1:8766/prototype/';

// These observations exist only inside the test. They do not represent a real vehicle or experiment.
const syntheticTrial = [
  'elapsedS,xM,zM,batteryWh', '400,100,-50,100', '401,101,-49.2,99',
  '402,102,-48.4,', '403,103,-47.6,97', '450,150,-10,50'
].join('\n');
const metadata = {source:'Synthetic QA trial only', clock:'Start pulse UTC simulator clock',
  frame:'Meters +X east and +Z north'};

function near(actual, expected, tolerance = 1e-8) {
  assert.notEqual(actual, '', 'Expected a numeric CSV cell');
  assert.ok(Math.abs(Number(actual) - expected) < tolerance, `Expected ${actual} to equal ${expected}`);
}

async function readDownload(page, button) {
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  assert.equal(download.suggestedFilename(), 'first-fire-field-comparison.csv');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const [header, ...lines] = Buffer.concat(chunks).toString('utf8').trimEnd().split(/\r?\n/);
  const fields = header.split(',');
  // The controlled test labels contain no commas. Metadata cells in this export are quoted.
  return lines.map(line => {
    const cells = line.split(',').map(v => v.replace(/^"|"$/g, ''));
    assert.equal(cells.length, fields.length);
    return Object.fromEntries(fields.map((field, i) => [field, cells[i]]));
  });
}

(async () => {
  const options = {headless:true};
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage({acceptDownloads:true});
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.goto(url, {waitUntil:'domcontentloaded'});
    const panel = page.locator('#field-panel');
    await panel.getByRole('heading', {name:'Independent field trial'}).waitFor();
    const file = panel.getByLabel('Observed trial CSV');
    const offset = panel.getByLabel('Observed start time relative to simulation start (s)');
    const gap = panel.getByLabel('Maximum simulated interpolation gap (s, optional)');
    const compare = panel.getByRole('button', {name:'Compare observed trial with current drive'});
    const save = panel.getByRole('button', {name:'Download comparison CSV'});
    const status = panel.getByRole('status');
    const expectStatus = text => status.filter({hasText:text}).waitFor();
    async function load(text, expected) {
      await file.setInputFiles({name:'synthetic-qa-only.csv', mimeType:'text/csv', buffer:Buffer.from(text)});
      await expectStatus(expected);
    }

    assert.ok(await compare.isDisabled());
    assert.ok(await save.isDisabled());
    await load('', 'CSV needs a header');
    await load('elapsedS,zM\n1,2\n2,3', 'CSV requires elapsedS,xM,zM');
    await load('elapsedS,xM,zM\n1,2,3\n1,2,3', 'times must be strictly increasing');
    assert.ok(await compare.isDisabled());

    await load(syntheticTrial, '5 user-supplied observations loaded');
    await compare.click();
    await expectStatus('Record or replay a simulated drive');
    await page.locator('#drive-terrain').selectOption('flat');
    await page.locator('#clear-points').click();
    await page.locator('#point-x').fill('0');
    await page.locator('#point-z').fill('8');
    await page.locator('#add-point').click();
    await page.locator('#drive-rate').selectOption('30');
    await page.locator('#play-route').click();
    await page.locator('#drive-status').filter({hasText:'Traverse complete'}).waitFor();
    await compare.click();
    await expectStatus('Record an observation source, clock reference and matching axes');
    await panel.getByLabel('Observation source or trial identifier').fill(metadata.source);
    await panel.getByLabel('Clock and common start event').fill(metadata.clock);
    await panel.getByLabel('Shared +X / +Z axes and frame description').fill(metadata.frame);

    await offset.fill('1');
    await compare.click();
    await expectStatus('Horizontal position RMSE');
    assert.match(await panel.innerText(), /4\/5 observed rows matched \(80%\)/);
    assert.match(await panel.innerText(), /Battery-change samples: 3/);
    const pos = await readDownload(page, save);
    assert.equal(pos.length, 4);
    for (const [i, row] of pos.entries()) {
      for (const [key, value] of Object.entries(metadata)) assert.equal(row[key], value);
      assert.match(row.simulation, /\/ custom \/ [\d.]+ s$/);
      near(row.observedRow, i + 1);
      near(row.timeS, i + 1);
      near(row.clockOffsetS, 1);
      near(row.positionAnchorTimeS, 1);
      near(row.positionAnchorObservedRow, 1);
      near(row.batteryAnchorTimeS, 1);
      near(row.observedAnchorXM, 100);
      near(row.observedAnchorZM, -50);
      near(row.simulatedAnchorXM, 0);
      near(row.simulatedAnchorZM, .95);
      near(row.errorXM, -i);
      near(row.errorZM, .15 * i);
      near(row.horizontalErrorM, Math.hypot(i, .15 * i));
    }
    near(Number((await status.innerText()).match(/position RMSE ([\d.]+)/)[1]),
      Math.sqrt(3.5 * (1 + .15 ** 2)), .00006);
    assert.equal(pos[2].batteryChangeErrorWh, '');
    assert.equal(pos[2].absoluteBatteryChangeErrorWh, '');
    assert.ok(Number(pos[3].batteryChangeErrorWh) > 0);
    near(pos[3].absoluteBatteryChangeErrorWh, Number(pos[3].batteryChangeErrorWh));

    await offset.fill('-1');
    assert.ok(await save.isDisabled());
    await compare.click();
    await expectStatus('Horizontal position RMSE');
    assert.match(await panel.innerText(), /3\/5 observed rows matched \(60%\)/);
    const neg = await readDownload(page, save);
    assert.equal(neg.length, 3);
    near(neg[0].positionAnchorObservedRow, 2);
    near(neg[0].positionAnchorTimeS, 0);
    near(neg[0].observedAnchorXM, 101);
    near(neg[0].simulatedAnchorZM, 0);
    near(neg[0].horizontalErrorM, 0);
    near(neg.at(-1).errorXM, -2);
    await offset.fill('99');
    await compare.click();
    await expectStatus('No positive-duration time overlap');
    assert.ok(await save.isDisabled());

    await load('elapsedS,xM,zM\n20,20,0\n20.1,21,0\n20.25,22,0','3 user-supplied observations loaded');
    await offset.fill('0');
    await gap.fill('0.125');
    await compare.click();
    await expectStatus('Battery-change RMSE unavailable');
    assert.match(await panel.innerText(), /1 excluded across a simulated gap/);
    const noBattery = await readDownload(page, save);
    assert.deepEqual(noBattery.map(r => r.observedRow), ['1','3']);
    assert.ok(noBattery.every(r => r.batteryAnchorTimeS === '' && r.batteryChangeErrorWh === ''));
    await file.setInputFiles([]);
    await expectStatus('No observation file selected');
    assert.ok(await compare.isDisabled());
    assert.ok(await save.isDisabled());
    assert.deepEqual(pageErrors, []);
    console.log('PASS field-trial CSV parsing, manual comparison, common-time anchors, signed residuals, RMSE, gaps, missing battery and three browser downloads');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
