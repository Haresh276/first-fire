/* Repeat the measurement in a public-style HTTP view and an extracted local-file bundle.
   The fixture page loads the real site manifest, UI script and camera files. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {pathToFileURL}=require('node:url');
function dependency(name){try{return require(name);}catch{return require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',name));}}
const {chromium}=dependency('playwright');
const site=path.resolve(__dirname,'../site');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ff-native-frames-'));
const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="style.css"><main id="r" class="shell main"></main><script src="saffire-frames.js"></script><script src="flight-frames-ui.js"></script><script>FFFlightFrames.render(r)</script>';
for(const name of ['style.css','saffire-frames.js','flight-frames-ui.js','flight-frames','fonts']) {
  if(fs.existsSync(path.join(site,name)))fs.symlinkSync(path.join(site,name),path.join(tmp,name));
}
fs.writeFileSync(path.join(tmp,'index.html'),html);
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.join(tmp,url.pathname==='/'?'index.html':url.pathname);
  if(!file.startsWith(tmp+'/') || !fs.existsSync(file)){res.writeHead(404);res.end();return;}
  const type={'.html':'text/html','.js':'text/javascript','.jpg':'image/jpeg','.css':'text/css'};
  res.writeHead(200,{'Content-Type':type[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
async function journey(browser,url,mobile,offline) {
  const page=await browser.newPage({viewport:{width:mobile?360:1280,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  try {
    await page.goto(url);
    await page.waitForFunction(()=>document.querySelectorAll('.ff-photo img').length===2);
    assert.equal(await page.locator('.ff-photo img').first().evaluate(n=>n.naturalWidth),1705);
    assert.equal(await page.locator('.flight-frames').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
    for(const [id,x,y] of [['A',400,700],['B',412,695]]) {
      await page.getByLabel('Frame '+id+' X in pixels').fill(String(x));
      await page.getByLabel('Frame '+id+' Y in pixels').fill(String(y));
      await page.locator('.ff-card').nth(id==='A'?0:1).getByRole('button',{name:'Set point'}).click();
    }
    await page.getByRole('button',{name:'Mark a feature in frame B'}).press('ArrowRight');
    await page.getByRole('button',{name:'Mark a feature in frame B'}).press('ArrowLeft');
    const save=page.waitForEvent('download');await page.getByRole('button',{name:'Download measurement'}).click();
    const result=JSON.parse(fs.readFileSync(await(await save).path()));
    assert.deepEqual(result.pixels,{dx:12,dy:-5,distance:13});assert.equal(result.seconds,59/30);
    assert.equal(result.millimetres,null);assert.equal(!!result.frames[0].computedSha256,!offline);
    await page.getByText('Show worked measurement · luminous contour').click();
    await page.getByText('+49 px over 14 s = 3.50 px/s.',{exact:false}).waitFor();
    await page.waitForFunction(()=>/All five positions match|browser-decoded pixels give different|Showing the archived calculation/.test(document.querySelector('.flight-frames .ff-worked').innerText));
    const replay=await page.locator('.ff-worked [role=status]').textContent();
    if(!offline)assert.match(replay,/All five positions match/);
    if(offline) {
      await page.getByText('Source, timing and scale',{exact:true}).click();
      const dataset=JSON.parse(fs.readFileSync(path.join(site,'front-example.json')));
      await page.getByLabel('Verify original JPEGs from this device').setInputFiles(dataset.frames.map(f=>path.join(site,f.file)));
      await page.waitForFunction(()=>/All five positions match/.test(document.querySelector('.ff-worked').innerText));
      const localSave=page.waitForEvent('download');await page.getByRole('button',{name:'Download measurement'}).click();
      const verified=JSON.parse(fs.readFileSync(await(await localSave).path()));
      assert.equal(verified.frames[0].computedSha256,dataset.frames[0].sha256);
    }
    await page.locator('.ff-toolbar').getByRole('button',{name:'Next'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.ff-photo img').length===2);
    assert.equal(await page.getByLabel('Frame A X in pixels').inputValue(),'412');
    assert.equal(await page.getByLabel('Frame B X in pixels').inputValue(),'');
    await page.locator('.ff-photo').last().click({position:{x:30,y:30}});
    assert.equal(await page.getByRole('button',{name:'Download measurement'}).isEnabled(),true);
    await page.locator('.ff-card').last().getByRole('button',{name:'Clear point'}).click();
    assert.equal(await page.getByRole('button',{name:'Download measurement'}).isDisabled(),true);
    assert.deepEqual(errors,[]);
    console.log(mobile?'mobile':'desktop', offline?'file':'http', replay);
  } finally {await page.close();}
}
(async()=>{
  let browser;
  try{
    await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
    const url='http://127.0.0.1:'+server.address().port;
    await journey(browser,url,false,false);await journey(browser,url,true,false);
    await journey(browser,pathToFileURL(path.join(tmp,'index.html')).href,true,true);
    const page=await browser.newPage();
    await page.route('**/Mapped_S2C2-*',route=>route.fulfill({status:200,body:'Incorrect image bytes'}));
    await page.goto(url);await page.getByRole('button',{name:'Retry frame pair'}).first().waitFor();
    assert.equal(await page.getByRole('button',{name:'Download measurement'}).isDisabled(),true);
    await page.close();
  }finally{await browser?.close();server.close();fs.rmSync(tmp,{force:true,recursive:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
