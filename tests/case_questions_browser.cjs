// Run after scripts/build.py, using Playwright and Chromium. FIRST_FIRE_QA_URL
// can point to a deployed copy. CHROMIUM_EXECUTABLE can select installed Chrome.
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  ({ chromium } = require(bundled));
}

const entry = process.env.FIRST_FIRE_QA_URL || pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href;
const testedQuestion = 'How frequently did the ISS detector miss Teflon smoke?';

async function openCase(page, id) {
  const url = new URL(entry);
  url.hash = 'case/' + id;
  await page.goto(url.href);
  const panel = page.locator('#comparison');
  await panel.getByRole('button', { name: 'Ask your own question' }).waitFor();
  return panel;
}

async function ask(panel, question, status) {
  await panel.getByRole('textbox', { name: /your question/i }).fill(question);
  await panel.getByRole('button', { name: 'Find evidence', exact: true }).click();
  const result = panel.locator('#case-question-result[data-status="' + status + '"]');
  await result.waitFor();
  return result;
}

async function smokeCase(page) {
  const panel = await openCase(page, 'same');
  const presets = panel.getByRole('combobox', { name: 'Research question' });
  await presets.selectOption({ label: 'Can one sample determine detector reliability?' });
  assert.match(await panel.locator('#pair').innerText(), /Teflon sample 56/i);
  await panel.getByRole('button', { name: 'Ask your own question' }).click();
  assert.equal(await presets.isVisible(), false);

  const answer = await ask(panel, testedQuestion, 'evidence');
  assert.match(await answer.innerText(), /two.thirds|2\/3/i);
  assert.match(await answer.innerText(), /Teflon/i);
  const links = await answer.getByRole('link').evaluateAll(nodes => nodes.map(node => node.href));
  assert(links.some(url => /PMC7918997|10\.1016\/j\.firesaf\.2018\.04\.004/i.test(url)),
    'The detector finding must link to the investigators’ published results.');
  assert.equal(new URL(page.url()).hash, '#case/same');

  const sections = page.getByRole('navigation', { name: 'Case sections' });
  await sections.getByRole('link', { name: 'My research brief' }).click();
  const briefQuestion = page.getByRole('textbox', { name: 'Research question', exact: true });
  assert.equal(await briefQuestion.inputValue(), testedQuestion);
  const ready = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download brief' }).click();
  const file = await ready;
  assert((await readFile(await file.path(), 'utf8')).includes(testedQuestion));
  await sections.getByRole('link', { name: 'Evidence', exact: true }).click();
  assert.equal(await panel.getByRole('textbox', { name: /your question/i }).inputValue(), testedQuestion);

  const timing = await ask(panel, 'Exactly how many seconds until the alarm sounds in an occupied cabin?', 'gap');
  assert.doesNotMatch(await timing.innerText(), /\b\d+(?:\.\d+)?\s+seconds to alarm/i);
  const outsideQuestion = 'What is the capital city of Argentina?';
  const unrelated = await ask(panel, outsideQuestion, 'gap');
  assert.doesNotMatch(await unrelated.innerText(), /two.thirds of the Teflon tests/i,
    'The previous finding should clear for an unrelated question.');
  const broaderSearch = await unrelated.getByRole('link', { name: /search all evidence/i }).getAttribute('href');
  assert.equal(new URLSearchParams(broaderSearch.split('?')[1]).get('q'), outsideQuestion);

  await panel.getByRole('button', { name: 'Suggested questions' }).click();
  await presets.selectOption({ label: 'Which material warrants a missed-alarm test?' });
  assert.match(await panel.locator('#pair').innerText(), /light.scattering/i);
}

async function mobileCase(page) {
  const panel = await openCase(page, 'saffire');
  await panel.getByRole('button', { name: 'Ask your own question' }).click();
  assert.equal(await panel.getByRole('textbox', { name: /your question/i }).inputValue(), '');
  const answer = await ask(panel, 'Did the Nomex fabric ignite?', 'evidence');
  assert.match(await answer.innerText(), /no (?:observed )?(?:fabric |Nomex )?ignition|did not ignite|was not ignited|zero Nomex burn length/i);
  const widths = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  assert(widths[1] <= widths[0] + 1, '360-pixel viewport overflows: ' + widths.join(' / '));
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
  const errors = [];
  try {
    for (const [size, scenario] of [[{ width: 1280, height: 900 }, smokeCase], [{ width: 360, height: 780 }, mobileCase]]) {
      const page = await browser.newPage({ viewport: size });
      page.on('pageerror', error => errors.push(error.message));
      await scenario(page);
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log('Passed custom SAME and Saffire questions, citations, missing evidence, preset switching and mobile layout.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
