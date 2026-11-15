// Test navigation, the bundled renderer and a drive on a built or published FIRST FIRE edition.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({
    executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,
    args:['--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({viewport:{width:1280,height:860}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const home = process.env.FIRST_FIRE_URL || 'http://127.0.0.1:8787/';
    await page.goto(home,{waitUntil:'domcontentloaded'});
    const open=page.getByRole('link',{name:/3D rover workbench/i}).first();
    await open.click();
    await page.locator('#lab:visible').waitFor();
    assert.match(page.url(),/\/rover-workbench\/prototype\/(?:index\.html)?#workbench$/);
    await page.locator('#drive-rate').selectOption('30');
    await page.locator('#play-route').click();
    await page.waitForFunction(()=>parseFloat(document.querySelector('#motion-distance').textContent)>0);
    const canvas=page.locator('#rover-scene');
    assert.ok(['webgl','canvas-3d'].includes(await canvas.getAttribute('data-renderer')));
    await page.locator('[data-layer=cutaway]').click();
    await page.locator('#drive-world').selectOption('Mars');
    assert.equal(await page.locator('#drive-world').inputValue(),'Mars');
    await page.locator('#main-site').click();
    await page.waitForURL(url=>url.hash==='#home' && !url.pathname.includes('/rover-workbench/'));
    assert.deepEqual(errors,[]);
    console.log('PASS homepage → 3D rover → drive → cutaway → Mars → research desk at '+home);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
