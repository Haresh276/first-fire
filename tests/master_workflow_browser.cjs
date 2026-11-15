/* Verify working research paths including two real downloads and a local video seek. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os'),path = require('node:path');
const {pathToFileURL} = require('node:url');
let chromium;
try { ({chromium}=require('playwright')); } catch { ({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root=path.resolve(__dirname,'..'),base=new URL(process.env.FIRST_FIRE_QA_URL||pathToFileURL(path.join(root,'dist/index.html')));
async function download(page,button){
  const [file]=await Promise.all([page.waitForEvent('download'),button.click()]);
  return fs.readFile(await file.path());
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true});
  try{for(const width of [1140,360]){
    const p=await browser.newPage({viewport:{width,height:850}}),errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    const open=async route=>p.goto(new URL(route,base).href);
    await open('#field-guide?tab=learn');
    const search=p.getByRole('searchbox');await search.waitFor();
    assert.equal(await p.locator('.panel').filter({has:search}).locator('details').filter({has:p.getByRole('link',{name:'Inspect the evidence →',includeHidden:true})}).count(),32);
    await search.fill('centrifuge');assert.equal(await p.locator('.panel').filter({has:search}).locator('details').filter({has:p.getByRole('link',{name:'Inspect the evidence →',includeHidden:true})}).count(),1);
    await open('#field-guide?tab=judges');
    await p.getByRole('button',{name:'Start timer'}).click();
    await p.getByRole('button',{name:'Next',exact:true}).click();
    await p.getByRole('heading',{name:'When does the Earth test transfer?'}).waitFor();
    await open('#materials-lab?tab=airflow');await p.getByLabel('Specimen').selectOption('nomex');
    await p.getByText('Read plotted measurements').click();assert.ok(await p.locator('main tbody tr').count()>4);
    await open('#materials-lab?tab=atmosphere&pressure=56.5&oxygen=34&gravity=0.165&materials=pmma,cellulose');
    const air=p.locator('main section').filter({has:p.getByRole('heading',{name:'Design the cabin atmosphere',exact:true})});
    const pressure=air.getByLabel('Cabin pressure (kPa)',{exact:true});await pressure.waitFor();
    const comparison=air.getByRole('table').filter({has:p.getByRole('columnheader',{name:'Your cabin',exact:true})});
    const value=(name,side)=>comparison.getByRole('row').filter({has:p.getByRole('cell',{name,exact:true})}).getByRole('cell').nth(side);
    await comparison.getByRole('columnheader',{name:'Earth reference',exact:true}).waitFor();
    assert.equal(await value('Oxygen partial pressure (kPa)',1).innerText(),'19.21');
    assert.match(await value('PMMA acrylic · fire evidence',1).innerText(),/0 coordinate-matched rows/);
    await pressure.fill('');await air.getByText('Enter values within the indicated ranges.',{exact:true}).waitFor();
    await pressure.fill('80');await air.getByLabel('Oxygen by volume (%)',{exact:true}).fill('20');
    assert.match(await value('Lower band · fire calculation',1).innerText(),/Choose a band enclosing nominal O₂/);
    await air.getByLabel('Lower O₂ A (%)',{exact:true}).fill('17');
    await air.getByLabel('Diluent',{exact:true}).selectOption('He');
    const temperature=value('Adiabatic flame-zone temperature (K)',1);
    await p.waitForFunction(()=>!!window.FFMasterPhysics);
    assert.equal(await temperature.innerText(),'2,348.2');
    assert.equal(await value('Nitrogen / suit pressure',1).innerText(),'Outside scope');
    assert.match(await value('Lower band · fire calculation',1).innerText(),/0 kJ$/);
    await air.getByLabel('Comparison pressure (kPa)',{exact:true}).fill('80');
    await air.getByLabel('Comparison oxygen (%)',{exact:true}).fill('20');
    await air.getByLabel('Comparison gas',{exact:true}).selectOption('Ar');
    assert.equal(await value('Adiabatic flame-zone temperature (K)',2).innerText(),'2,348.2');
    assert.equal(await value('Oxygen partial pressure (kPa)',2).innerText(),'16');
    await comparison.getByRole('columnheader',{name:'Comparison B',exact:true}).waitFor();
    await open('#materials-lab?tab=materials');const material=p.getByLabel('Material',{exact:true});await material.waitFor();
    assert.equal(await material.locator('option').count(),12);
    await p.getByText(/Browse \d+ matching source rows/).click();
    assert.ok(await p.locator('details[open] li a').count()>0);
    await open('#flame-tracking');await p.locator('#track-file').setInputFiles(path.join(root,'site/first-fire-demo.mp4'));
    await p.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
    async function mark(x){await p.locator('#track-x').fill(String(x));await p.locator('#track-y').fill('100');await p.locator('#track-add').click();}
    await mark(50);await mark(150);await mark(80);
    await p.locator('#track-time').fill('2');await p.locator('#track-time').press('Tab');
    await p.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.seeking&&Math.abs(v.currentTime-2)<0.01;});
    await mark(100);await p.locator('#track-kind').selectOption('length');await mark(160);await mark(210);const measured=JSON.parse(await download(p,p.locator('#track-save')));
    assert.equal(measured.slopeMmS,2);assert.equal(measured.rows.length,2);assert.equal(measured.projectedFlameLengths[0].lengthMm,10);
    await open('forecast-register.html');
    await p.getByLabel('Experiment and material').fill('Synthetic checkout specimen');
    await p.getByLabel('Design source and location').fill('Quality assurance fixture');
    await p.getByLabel('Conditions, event and resolution rules').fill('Fixed geometry. One yes, one unresolved.');
    await p.getByLabel('Trial ID, predicted probability, comparator probability').fill('A,0.8,0.5\nB,0.1,0.5');
    const bytes=await download(p,p.getByRole('button',{name:'Create forecast file'}));
    await p.locator('#file').setInputFiles({name:'example.json',mimeType:'application/json',buffer:bytes});
    await p.locator('fieldset').first().getByLabel('Outcome').selectOption('yes');
    const row=p.locator('fieldset').first();await row.getByLabel('Official source URL').fill('https://example.org/fixture');await row.getByLabel('Observation date').fill('2026-11-15');await row.getByLabel('Locator and decision rationale').fill('Synthetic workflow fixture.');
    const receipt=JSON.parse(await download(p,p.getByRole('button',{name:'Export resolution receipt'})));
    assert.equal(receipt.forecastSHA256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.equal(receipt.result.resolved,1);assert.ok(Math.abs(receipt.result.modelBrier-.04)<1e-9);
    await open('team-handoff.html');await p.getByLabel('Case, setting or artifact').fill('Test record');await p.getByLabel('Reviewer or participant alias').fill('Synthetic QA');await p.getByLabel('Source URL, page or record ID').fill('fixture');await p.getByLabel('Finding, correction or observed result').fill('Fixture only.');await p.locator('#log button').click();const review=JSON.parse(await download(p,p.locator('#export')));assert.equal(review.entries[0].reviewer,'Synthetic QA');
    assert.deepEqual(errors,[]);await p.close();console.log(width+' px: field guide, atmospheric and material checks, real video seek and export, forecast identity and resolution, team review passed.');
  }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
