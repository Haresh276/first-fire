/* Check all seven Section 6 examples through the same controls a judge uses. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const os=require('node:os'),http=require('node:http');
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..');
const saved=JSON.parse(fs.readFileSync(path.join(root,'flint-engine/results/rover/rover_case.json')));
const reference=key=>saved.responses.find(row=>row.material===key);
const thermal=key=>saved.items.find(row=>row.material===key);
const extensions={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1);
  const folder=route.startsWith('rover-workbench/')?'dist':'site', base=path.join(root,folder);
  const file=path.resolve(base,route);
  if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':extensions[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise((yes,no)=>server.once('error',no).listen(0,'127.0.0.1',yes));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  try{
    const page=await browser.newPage({viewport:{width:1230,height:880}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/rover-fire-case.html');
    await page.locator('#startup').waitFor({state:'hidden'});
    await page.waitForFunction(()=>document.querySelector('#scene-mode').innerText!=='Select a cabin item');
    if(process.env.ROVER_QA_IMAGE)await page.screenshot({path:process.env.ROVER_QA_IMAGE});
    const inventory=page.locator('#inventory-table tr');
    const arrow=key=>new RegExp((100*key).toFixed(1).replace('.','\\.')+'%');
    const pmma=inventory.filter({hasText:thermal('PMMA').item});
    assert.match(await pmma.locator('td').nth(1).innerText(),arrow(thermal('PMMA').loc_fans_on));
    assert.match(await pmma.locator('td').nth(2).innerText(),arrow(thermal('PMMA').loc_fans_off));
    assert.match(await inventory.filter({hasText:thermal('NOMEX').item}).locator('td').nth(2).innerText(),arrow(thermal('NOMEX').loc_fans_off));
    const earth=saved.trade.find(r=>r.atmosphere==='Earth sea level');
    assert.match(await page.locator('#trade-chart tr').filter({hasText:earth.atmosphere}).innerText(),
                 new RegExp(earth.items_that_burn+' of '+earth.of));
    await page.getByRole('button',{name:'Select '+thermal('NOMEX').item,exact:true}).click();
    const dose=reference('NOMEX');
    const responseRows=page.locator('#dose-table tbody tr');
    for(const [label,expected,unit] of [['CO₂ flood',dose.co2.kg,'kg'],['Nitrogen flood',dose.n2.kg,'kg'],['Vent cabin',dose.vent.P_psia,'psia']]){
      const row=responseRows.filter({hasText:label});
      assert.equal(await row.locator('td').nth(1).innerText(),expected.toFixed(1)+' '+unit);
      assert.match(await row.innerText(),/Model extrapolation/);
    }
    await page.locator('#response').selectOption('vent');
    await page.locator('#vent-target').fill(String(dose.vent.P_psia*.8));
    assert.match(await page.locator('#response-result').innerText(),/extinction buffer/);
    await page.locator('#response').selectOption('suit');
    assert.match(await page.locator('#response-result').innerText(),/leaves the cabin fire margin unchanged/);
    await page.getByRole('button',{name:'Select '+thermal('PMMA').item,exact:true}).click();
    await page.locator('#ignite').click();
    const timeline=page.locator('#timeline-thresholds > div').filter({hasText:'Time to 10 kW'});
    assert.equal(await timeline.locator('strong').innerText(),reference('PMMA').timeline.t_hrr_10kW_s.toFixed(1)+' s');
    await page.locator('#time').fill('50');
    assert.ok(await page.locator('#timeline-charts figure').count()===4);
    await page.locator('#preset').selectOption(String(saved.trade.indexOf(earth)));
    assert.equal(await page.locator('#pressure').inputValue(),String(earth.P_psia));
    await page.locator('#gravity').selectOption('orbit');
    await page.getByRole('button',{name:'Apply conditions'}).click();
    assert.match(await page.locator('#selected-meaning').innerText(),/oxygen transport by diffusion/);
    assert.ok(await page.locator('#ignite').isDisabled());
    await page.getByRole('button',{name:'Restore nominal case'}).click();
    await page.getByText('Add an item to the cabin',{exact:true}).click();
    await page.locator('#item-name').fill('Uncalibrated cable insulation');
    await page.locator('#item-material').selectOption('OTHER');
    await page.locator('#item-area').fill('0.5');await page.locator('#item-density').fill('1');
    await page.getByRole('button',{name:'Add item',exact:true}).click();
    assert.match(await page.locator('#selected-margin').innerText(),/Not calibrated/);
    await page.setViewportSize({width:390,height:850});await page.locator('#cabin').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.deepEqual(errors,[]);
    console.log('Rover page: seven FLINT acceptance results and custom, orbit, response, item, mobile interactions pass.');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
