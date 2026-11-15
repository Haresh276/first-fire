// FIRST_FIRE_URL=https://your-published-site/ node rover-design/tests/discovery.cjs
// For a local edition, serve dist/ on port 8787. FIRST_FIRE_BROWSER=webkit tests iOS/Safari profiles.
'use strict';

const assert = require('node:assert/strict');
const {chromium, webkit, devices} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const home = process.env.FIRST_FIRE_URL || 'http://127.0.0.1:8787/';
const engine = process.env.FIRST_FIRE_BROWSER || 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'FIRST_FIRE_BROWSER must be chromium or webkit');
const profiles = {
  phone: devices[engine === 'webkit' ? 'iPhone 13' : 'Pixel 7'],
  tablet: devices['iPad (gen 7)'],
  desktop: {...devices[engine === 'webkit' ? 'Desktop Safari' : 'Desktop Chrome'], viewport: {width: 1440, height: 900}},
};
const panels = [
  ['workbench', '3D workbench'],
  ['assembly', 'Assembly'],
  ['conditions', 'Conditions'],
  ['results', 'Results'],
  ['evidence', 'Evidence'],
  ['review', 'Mission review'],
];

function searchForm(page) {
  const label = {name: 'Search tools', exact: true};
  const field = page.getByRole('searchbox', label).or(page.getByRole('textbox', label));
  return page.getByRole('search').filter({has: field}).or(page.getByRole('form', label)).first();
}

async function activate(control, touch) {
  if (touch) await control.tap();
  else await control.click();
}

async function discover(page, touch) {
  await page.goto(home, {waitUntil: 'domcontentloaded'});
  const form = searchForm(page);
  const directory = page.getByRole('link', {name: /tool|search/i})
    .and(page.locator('a[href*="tools.html"]:visible')).first();
  // Either a search on the homepage or a visible directory link is a valid entry.
  await form.or(directory).first().waitFor({state: 'visible'});
  if (!await form.isVisible()) await activate(directory, touch);
  await form.waitFor({state: 'visible'});

  const input = form.getByRole('searchbox').or(form.getByRole('textbox')).first();
  await input.fill('rover');
  await input.press('Enter');
  await page.waitForURL(url => url.pathname.endsWith('/tools.html') && url.searchParams.get('q') === 'rover');
  const filteredUrl = page.url();
  const result = page.getByRole('link', {name: '3D rover workbench', exact: true}).first();
  await result.waitFor({state: 'visible'});
  await page.getByRole('link', {name: 'Detector flight evidence', exact: true}).waitFor({state: 'hidden'});
  await activate(result, touch);
  await currentPanel(page, 'workbench', '3D workbench');
  assert.equal(new URL(page.url()).origin, new URL(filteredUrl).origin, 'Rover should open on the same site');
  await page.goBack();
  await page.waitForURL(filteredUrl);
  assert.equal(await input.inputValue(), 'rover', 'Back should preserve the search term');
  await activate(result, touch);
  await currentPanel(page, 'workbench', '3D workbench');
}

async function currentPanel(page, id, name, address = id) {
  const nav = page.getByRole('navigation', {name: 'Workspace views'});
  const active = nav.getByRole('link', {name, exact: true});
  await page.locator('#' + id + ':visible').waitFor();
  assert.equal(await active.getAttribute('aria-current'), 'page', 'Active panel: ' + name);
  assert.equal(await nav.locator('[aria-current=page]').count(), 1);
  assert.equal(await page.locator('section.view:visible').count(), 1);
  assert.equal(new URL(page.url()).hash, '#' + address, 'Addressable panel: ' + name);
}

async function cabinTest(page) {
  await currentPanel(page, 'workbench', '3D workbench', 'workbench/cabin-test');
  await page.getByLabel('Fan exchange (L/s)').waitFor({state: 'visible'});
  assert.equal(await page.getByRole('button', {name: 'Cabin test', exact: true}).getAttribute('aria-pressed'), 'true');
}

async function deviceJourney(browser, profile) {
  const options = profiles[profile];
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await discover(page, options.hasTouch);
    const nav = page.getByRole('navigation', {name: 'Workspace views'});
    for (const [id, name] of panels.slice(1)) {
      await activate(nav.getByRole('link', {name, exact: true}), options.hasTouch);
      await currentPanel(page, id, name);
      if (id === 'evidence') await page.locator('#evidence').getByRole('link').first().waitFor({state: 'visible'});
    }
    await page.goBack();
    await currentPanel(page, 'evidence', 'Evidence');
    if (profile === 'desktop') {
      await page.getByRole('searchbox', {name: 'Find in workbench'}).fill('cabin tracer');
      await page.getByRole('link', {name: /Cabin tracer test/i}).click();
      await cabinTest(page);
    }
    assert.deepEqual(errors, [], profile + ' browser errors');
    console.log('PASS ' + profile + ': homepage → rover search → six panels, browser Back and search recovery');
    return page.url();
  } finally {
    await context.close();
  }
}

async function receiveLink(browser, address) {
  const context = await browser.newContext(profiles.phone);
  try {
    const page = await context.newPage();
    await page.goto(address, {waitUntil: 'domcontentloaded'});
    await cabinTest(page);
    assert.equal(page.url(), address);
    console.log('PASS fresh phone: copied desktop cabin tracer address opens the cabin test and its fan control');
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = engine === 'webkit' ? await webkit.launch({headless: true})
    : await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader']});
  console.log('Testing ' + engine + ' at ' + home);
  try {
    for (const profile of ['phone', 'tablet']) await deviceJourney(browser, profile);
    const address = await deviceJourney(browser, 'desktop');
    await receiveLink(browser, address);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
