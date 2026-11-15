/* Optional hardware test. Start an HTTP server for dist (or supply an HTTPS release), set
   FIRST_FIRE_QA_URL, FIRST_FIRE_DOWNLOAD_MODEL=yes, and optionally CHROMIUM_EXECUTABLE. */
const assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
async function main(){
  if(process.env.FIRST_FIRE_DOWNLOAD_MODEL!=='yes'){console.log('Skipped optional ~215 MB hardware-model test.');return;}
  const entry=new URL(process.env.FIRST_FIRE_QA_URL||'http://localhost:8765/');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  try{
    const page=await browser.newPage();await page.goto(new URL('#awareness',entry).href);
    const capabilities=await page.evaluate(()=>window.FFReaderDevice.measure());assert(capabilities.adapter,'A WebGPU adapter is required.');
    await page.getByLabel('Device mode').selectOption('pro');await page.getByText('This device',{exact:true}).click();
    const download=page.getByRole('button',{name:'Download and enable on-device selector'});await download.click();
    await page.waitForFunction(()=>FFReaderDevice.isModelReady() || document.querySelector('.rf-preferences [role=status]')?.textContent.includes('could not start'),{},{timeout:600000});
    assert(await page.evaluate(()=>FFReaderDevice.isModelReady()),await page.locator('.rf-preferences [role=status]').innerText());
    const selected=await page.evaluate(()=>FFReaderDevice.selectEvidence('Which material did not ignite?',[
      {id:'detector',text:'A remote detector recorded smoke in the second compartment.'},
      {id:'nomex',text:'The acrylic burned and heated the Nomex, but the Nomex did not ignite.'}
    ]));
    assert.equal(selected,'nomex');await page.getByRole('button',{name:'Disable on-device selector'}).click();
    assert.equal(await page.evaluate(()=>FFReaderDevice.isModelReady()),false);
    console.log('Real WebGPU model selected the Nomex evidence and unloaded.',capabilities);
  }finally{await browser.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
