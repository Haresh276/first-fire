// Run against a local HTTP preview of public/. Requires Playwright and Chromium.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const workspace = new URL(process.argv[2] || 'http://127.0.0.1:8000/research-workspace/');
const links = [
  ['#forecast', 'FM² forecast'],
  ['#physics', 'Inside a sealed cabin'],
  ['#design-lab', 'Experiment design lab'],
  ['#transport-lab', 'When does a remote sensor respond?'],
  ['#transfer-lab', 'Transfer Lab'],
  ['#physics?mode=rover', 'Inside a sealed cabin'],
  ['#rover-design', 'Rover design lab']
];

async function selectLab(page, href) {
  const menu = page.locator('#workspace-explore');
  if (!(await menu.evaluate(details => details.open))) await menu.locator('summary').click();
  await menu.locator('a[href="' + href + '"]').click();
}

async function labs(page) {
  for (const [href, title] of links) {
    await selectLab(page, href);
    await page.getByRole('heading', {level: 1, name: title, exact: true}).waitFor();
    assert.equal(await page.locator('#content').getAttribute('aria-busy'), 'false');
  }
  await selectLab(page, 'judge-lab.html');
  await page.locator('#lab:not([hidden])').waitFor();
  await page.goBack();
  await selectLab(page, 'rover-workbench/prototype/index.html#workbench');
  await page.locator('#export:not([disabled])').waitFor();
}

async function pendingChat(browser, viewport) {
  const context = await browser.newContext({viewport, serviceWorkers:'block'});
  try {
    const page = await context.newPage();
    let release, requested;
    const received = new Promise(resolve => { requested = resolve; });
    const delayed = new Promise(resolve => { release = resolve; });
    await page.route('**/records.js', async route => { requested(); await delayed; await route.continue(); });
    await page.goto(new URL('#home', workspace).href);
    const input = page.locator('#content textarea');
    await input.fill('What burned in Saffire-II sample 2-7?');
    await input.press('Enter');
    await received;
    const menu = page.locator('#workspace-explore');
    await menu.locator('summary').click();
    release();
    await page.waitForFunction(() => !document.querySelector('.ffchat-wait'));
    assert.equal(await menu.evaluate(details => details.open), true, 'A reply must leave Explore open');
    await menu.locator('a[href="#physics"]').click();
    const heading = page.getByRole('heading', {name:'Inside a sealed cabin'});
    await heading.waitFor();
    await page.reload();
    await heading.waitFor();
    await page.goBack();
    await input.waitFor();
    await page.locator('.ffchat-reply').first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Desktop and mobile navigation must fit');
    await labs(page);
  } finally { await context.close(); }
}

async function stalledLab(browser) {
  const context = await browser.newContext({serviceWorkers:'block'});
  try {
    const page = await context.newPage();
    let resume;
    const gate = new Promise(resolve => { resume = resolve; });
    await page.route('**/records.js', async route => { await gate; await route.continue(); });
    await page.goto(new URL('#home', workspace).href);
    await page.locator('#content textarea').waitFor();
    await page.locator('.mast-nav > a[href="#physics"]').click();
    await page.getByText('Opening Physics Lab…', {exact:true}).waitFor();
    assert.equal(await page.locator('#content textarea').count(), 0);
    resume();
    await page.getByRole('heading', {name:'Inside a sealed cabin'}).waitFor();
  } finally { await context.close(); }
}

async function savedLabs(browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(workspace.href);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
      }
    });
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('link', {name:'Try the live site'}).waitFor();
    await labs(page);
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await pendingChat(browser, {width:1280, height:800});
    await pendingChat(browser, {width:360, height:800});
    await stalledLab(browser);
    await savedLabs(browser);
    console.log('Nine lab destinations, pending chat, slow startup, back/reload and offline recovery passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
