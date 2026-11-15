// Serve rover-design first, for example: python3 -m http.server 8766 --directory first-fire/rover-design
// node tests/3d-browser.cjs uses local Playwright/Chromium. See environment overrides below.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const url = process.env.ROVER_TEST_URL || 'http://127.0.0.1:8766/prototype/';
const readFixture = name => fs.readFile(path.join(__dirname,'..',name),'utf8').then(JSON.parse);
const numeric = text => Number.parseFloat(text.replace(/,/g,''));
const check = name => console.log('PASS '+name);

async function downloadText(page, action) {
  const [file] = await Promise.all([page.waitForEvent('download'),action()]);
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return {name:file.suggestedFilename(),text:Buffer.concat(chunks).toString('utf8')};
}
async function frame(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
}
async function screenHash(locator) {
  return createHash('sha256').update(await locator.screenshot()).digest('hex');
}
async function ready(page) {
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#lab:visible').waitFor();
  await page.locator('#workbench:visible').waitFor();
  await page.waitForFunction(()=>document.querySelector('#rover-scene')?.dataset.renderer &&
    document.querySelector('#inspect-slot')?.options.length>0 && document.querySelector('#motion-battery')?.textContent.match(/\d/));
  await frame(page);
}
async function view(page,id) {
  await page.locator('#views a[data-view="'+id+'"]').click();
  await page.locator('#'+id+':visible').waitFor();
}
async function pickPart(page,slot,part) {
  await page.locator('[data-tool=inspect]').click();
  await page.locator('#inspect-slot').selectOption(slot);
  await page.locator('#inspect-part').selectOption(part);
  assert.equal(await page.locator('#part-'+slot).inputValue(),part);
}
async function upload(page,plan) {
  await page.locator('#plan-file').setInputFiles({name:'acceptance-plan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(plan))});
}
async function setRange(page,selector,position) {
  const input=page.locator(selector);await input.focus();await page.keyboard.press(position);
}
async function routeDownload(page) {
  const saved=await downloadText(page,()=>page.locator('#export-plan').click());
  assert.match(saved.name,/\.json$/);return JSON.parse(saved.text);
}
async function csvDownload(page) {
  const file=await downloadText(page,()=>page.locator('#export-track').click());
  assert.match(file.name,/\.csv$/);
  const [first,...lines]=file.text.trim().split(/\r?\n/);
  const headings=first.split(',');
  for(const key of ['elapsedS','distanceM','batteryWh','driveWh','hotelWh','solarWh','xM','zM','status'])assert.ok(headings.includes(key),'Missing CSV column '+key);
  return lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[headings[i],v])));
}
async function desktop(browser) {
  const page=await browser.newPage({viewport:{width:1260,height:870},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await ready(page);
    const scene=page.locator('#rover-scene'),backend=await scene.getAttribute('data-renderer');
    assert.ok(['webgl','canvas-3d'].includes(backend),'A supported renderer must initialize');
    if(process.env.ROVER_EXPECT_RENDERER)assert.equal(backend,process.env.ROVER_EXPECT_RENDERER);
    assert.equal(await page.locator('#views a[aria-current=page]').getAttribute('data-view'),'workbench');
    const bounds=await scene.boundingBox();assert.ok(bounds.width>200 && bounds.height>150,'The viewer needs a usable canvas');
    const hashes=new Set();
    for(const layer of ['exterior','cutaway','exploded']) {
      const control=page.locator('[data-layer='+layer+']');
      await control.click();await frame(page);
      assert.equal(await control.getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('[data-layer][aria-pressed=true]').count(),1);
      hashes.add(await screenHash(scene));
    }
    assert.equal(hashes.size,3,'Each model layer must produce a visibly distinct canvas');
    await page.locator('[data-layer=exterior]').click();
    check('default 3D workbench, '+backend+' rendering and three visible model layers');

    const fixture=await readFixture('examples/lunar-cellulose.json');
    const catalog=await readFixture('parts.json');
    await page.locator('[data-tool=inspect]').click();
    const slots=await page.locator('#inspect-slot option').evaluateAll(options=>options.map(o=>o.value));
    assert.deepEqual([...slots].sort(),Object.keys(fixture.parts).sort());
    for(const slot of slots) {
      await page.locator('#inspect-slot').selectOption(slot);
      const choices=await page.locator('#inspect-part option').evaluateAll(options=>options.map(o=>o.value));
      assert.deepEqual([...choices].sort(),catalog.parts.filter(p=>p.slot===slot).map(p=>p.id).sort());
      const alternate=choices.find(id=>id!==fixture.parts[slot]);assert.ok(alternate);
      await pickPart(page,slot,alternate);
      assert.ok((await page.locator('#inspect-description').innerText()).trim().length>0);
      await pickPart(page,slot,fixture.parts[slot]);
    }
    check('all eleven inspection slots and component changes reflected in the assembly');

    await page.locator('[data-tool=drive]').click();
    await page.locator('#drive-terrain').selectOption('flat');
    await page.locator('#drive-rate').selectOption('12');
    await scene.focus();await page.keyboard.down('w');
    try {await page.waitForFunction(()=>parseFloat(document.querySelector('#motion-distance').textContent)>0.3);}
    finally {await page.keyboard.up('w');}
    await page.waitForFunction(()=>parseFloat(document.querySelector('#motion-speed').textContent)===0);
    const stopped=await page.locator('#motion-distance').innerText();
    // This hold checks that release stops the vehicle across subsequent animation frames.
    await page.waitForTimeout(240);
    assert.equal(await page.locator('#motion-distance').innerText(),stopped);
    assert.ok(numeric(stopped)>0);
    await page.locator('#reset-drive').click();assert.equal(numeric(await page.locator('#motion-distance').innerText()),0);
    check('keyboard drive, release to stop, telemetry and reset');

    await page.locator('#clear-points').click();assert.equal(await page.locator('#play-route').isDisabled(),true);
    await page.locator('#point-x').fill('0');await page.locator('#point-z').fill('8');await page.locator('#add-point').click();
    assert.equal(await page.locator('#route-preset').inputValue(),'custom');
    const plan=await routeDownload(page);assert.equal(plan.format,'first-fire.route/1');assert.deepEqual(plan.waypoints,[{xM:0,zM:8}]);
    await page.locator('#route-preset').selectOption('slope');await upload(page,plan);
    await page.waitForFunction(()=>document.querySelector('#drive-status').textContent.includes('Loaded route'));
    assert.deepEqual(await routeDownload(page),plan);
    for(const invalid of [{...plan,format:'unknown'},{...plan,waypoints:[{xM:'bad',zM:2}]},{...plan,overrides:{speedMps:-1}}]){
      await upload(page,invalid);
      await page.waitForFunction(()=>document.querySelector('#plan-file').value==='' && document.querySelector('#drive-status').textContent.includes('Could not load route'));
      assert.deepEqual(await routeDownload(page),plan,'Rejected imports must preserve the current design and course');
    }
    check('waypoint edits, route plan download/load and atomic rejection of invalid imports');

    await page.locator('#drive-rate').selectOption('30');await page.locator('#play-route').click();
    await page.waitForFunction(()=>document.querySelector('#drive-status').textContent.includes('Traverse complete'));
    const completed=await csvDownload(page);assert.ok(completed.length>3);
    assert.equal(completed.at(-1).status,'route complete');assert.ok(+completed.at(-1).distanceM>7);
    for(let i=1;i<completed.length;i++)assert.ok(+completed[i].elapsedS>=+completed[i-1].elapsedS);
    await setRange(page,'#replay-seek','Home');assert.equal(await page.locator('#export-track').isDisabled(),true);
    await setRange(page,'#replay-seek','ArrowRight');
    const prefix=await csvDownload(page);
    assert.equal(prefix.length,2);assert.ok(+prefix.at(-1).elapsedS<+completed.at(-1).elapsedS);
    assert.equal(+prefix.at(-1).distanceM,+completed[1].distanceM);
    await setRange(page,'#replay-seek','End');
    check('completed drive, time scrubbing, final and prefix telemetry CSV');

    await view(page,'review');await page.getByRole('button',{name:'Save current as A'}).click();
    await view(page,'workbench');await pickPart(page,'material','pe');
    await view(page,'review');const row=page.getByRole('row').filter({hasText:'Coupon chemical potential'});
    assert.match(await row.innerText(),/152\s+434\s+\+282/);
    const review=JSON.parse((await downloadText(page,()=>page.getByRole('button',{name:'Export review JSON'}).click())).text);
    assert.equal(review.baseline.scenario.parts.material,'cellulose');assert.equal(review.current.scenario.parts.material,'pe');
    assert.ok(review.baseline.traverse.state.distanceM>7);
    assert.equal(review.comparison.engineering.find(r=>r.path==='coupon.netChemicalPotentialKJ').delta,282);
    check('captured A and live B with traverse sample, material energy delta and structured review download');

    await view(page,'workbench');await page.locator('[data-tool=fire]').click();
    assert.equal(await page.locator('#play-fire').isDisabled(),false);
    assert.equal(await page.locator('[data-layer=cutaway]').getAttribute('aria-pressed'),'true');
    await setRange(page,'#fire-seek','End');
    assert.ok(numeric(await page.locator('#fire-clock').innerText())>0);
    assert.match(await page.locator('#fire-reading').innerText(),/mg\/m³/);
    await pickPart(page,'cabin','open-deck');await page.locator('[data-tool=fire]').click();
    assert.equal(await page.locator('#play-fire').isDisabled(),true);
    assert.match(await page.locator('#fire-reading').innerText(),/sealed cabin/i);
    await pickPart(page,'cabin','mobile-hab');
    check('sealed cabin tracer and open-deck experiment gating');

    await page.locator('[data-tool=drive]').click();
    await page.locator('#drive-terrain').selectOption('lola');
    assert.match(await page.locator('#route-description').innerText(),/LOLA/);
    assert.match(await page.locator('#route-description a').getAttribute('href'),/lola\.json$/);
    const lunar=await routeDownload(page);assert.equal(lunar.terrain,'lola');assert.equal(lunar.scenario.conditions.world,'Moon');
    const trace=await readFixture('terrain/jezero-route.json');
    await page.locator('#route-preset').selectOption('jezero');
    assert.equal(await page.locator('#drive-world').inputValue(),'Mars');
    assert.equal(await page.locator('#drive-terrain').inputValue(),'flat');
    assert.match(await page.locator('#route-description').innerText(),new RegExp(String(trace.cataloguedLengthM)));
    assert.equal(await page.locator('#route-description a').getAttribute('href'),trace.missionMapUrl);
    assert.deepEqual((await routeDownload(page)).waypoints,trace.waypoints);
    const lunarOption=page.locator('#drive-terrain option[value=lola]');
    assert.equal(await lunarOption.evaluate(option=>option.disabled),true,'A Mars rover must exclude lunar DEM terrain');
    await page.locator('#drive-world').selectOption('Orbit');
    assert.equal(await page.locator('#play-route').isDisabled(),true);assert.equal(await page.locator('[data-command=forward]').isDisabled(),true);
    assert.match(await page.locator('#drive-status').innerText(),/orbital free fall/i);
    await scene.focus();await page.keyboard.press('w');assert.equal(numeric(await page.locator('#motion-distance').innerText()),0);
    check('LOLA provenance, NASA Sol 15 course data and no wheel drive in orbit');
    assert.deepEqual(errors,[],'Unhandled browser errors');
  } finally {await page.close();}
}
async function mobile(browser) {
  const page=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  try {
    // Exercise the real software path used by browsers with unavailable WebGL.
    await page.addInitScript(()=>{
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...rest){
        return ['webgl','webgl2','experimental-webgl'].includes(kind)?null:getContext.call(this,kind,...rest);
      };
    });
    await ready(page);
    assert.equal(await page.locator('#rover-scene').getAttribute('data-renderer'),'canvas-3d');
    const fits=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
    assert.ok(await fits(),'Mobile workbench overflows its viewport');
    const scene=page.locator('#rover-scene'),one=await screenHash(scene);
    await page.locator('[data-layer=exploded]').tap();await frame(page);assert.notEqual(await screenHash(scene),one);
    await page.locator('[data-tool=inspect]').tap();await page.locator('#inspect-slot').selectOption('wheels');
    assert.ok(await page.locator('#inspect-part').isVisible());
    await view(page,'review');assert.ok(await fits(),'Mobile review overflows its viewport');
    await page.getByLabel('Agency or institution').selectOption('ISRO');
    assert.match(await page.locator('.mr-groups').innerText(),/Pragyan|Chandrayaan/i);
    check('375px touch layout, software rendering, inspection and agency research');
  } finally {await page.close();}
}
(async()=>{
  const options={headless:true};
  if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
  const browser=await chromium.launch(options);
  try {await desktop(browser);await mobile(browser);}
  finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
