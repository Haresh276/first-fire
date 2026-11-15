/* Build the split edition first. Set FIRST_FIRE_OFFLINE_BROWSER=1 for the full Chrome download interaction. */
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs/promises');
const path=require('node:path'), crypto=require('node:crypto'), http=require('node:http'), os=require('node:os');
const JSZip=require('../site/vendor/resume/jszip.min.js');
const {plan,parseZip,combine}=require('../site/offline-download.js');
const dist=process.env.FIRST_FIRE_OFFLINE_DIST||path.resolve(__dirname,'../dist');
const file=n=>fs.readFile(path.join(dist,n));
const json=async n=>JSON.parse(await file(n));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function actual(){return plan(await json('offline-packs.json'),await json('checksums.json'));}

test('join the real packages; verify all extracted bytes and nested manifests independently with JSZip',async()=>{
  const messages=[],entries=await actual();
  const result=await combine(entries,file,x=>messages.push(x));
  const merged=await JSZip.loadAsync(await result.blob.arrayBuffer(),{checkCRC32:true});
  const embedded=JSON.parse(await merged.file('FIRST-FIRE/checksums.json').async('string'));
  const supplements=JSON.parse(await merged.file('FIRST-FIRE/offline-packs.json').async('string')).supplements;
  const expected={...embedded};
  for(const p of Object.values(supplements))for(const [n,h] of Object.entries(p.files)){
    assert(!Object.hasOwn(expected,n));expected[n]=h;
  }
  assert.equal(result.files,Object.keys(merged.files).length);
  assert.deepEqual(Object.keys(merged.files).sort(),['FIRST-FIRE/checksums.json',...Object.keys(expected).map(k=>'FIRST-FIRE/'+k)].sort());
  for(const [n,h] of Object.entries(expected))assert.equal(sha(await merged.file('FIRST-FIRE/'+n).async('uint8array')),h,n);
  assert.equal(messages.length,2*entries.length);assert(Object.hasOwn(expected,'rover-workbench/prototype/index.html'));
});

test('reject wrong member digests, pack bytes, duplicate paths, corrupt headers and traversal',async()=>{
  const index=await json('offline-packs.json'),hashes=await json('checksums.json');
  const altered=structuredClone(index),p=Object.values(altered.supplements)[0];
  p.files[Object.keys(p.files)[0]]='2'.repeat(64);
  assert.throws(()=>plan(altered,hashes),/checksum or membership/);
  const z=new JSZip();z.file('FIRST-FIRE/a','a',{createFolders:false});
  const bytes=await z.generateAsync({type:'uint8array'});
  const seen=new Set();parseZip(bytes,0,seen,['a']);
  assert.throws(()=>parseZip(bytes,100,seen,['a']),/duplicate/);
  assert.throws(()=>parseZip(bytes,0,new Set(),['another']),/file list/);
  const wrong=bytes.slice();wrong[14]^=1;
  assert.throws(()=>parseZip(wrong,0,new Set(),['a']),/ZIP header/);
  const unsafe=new JSZip();unsafe.file('FIRST-FIRE/../outside','a',{createFolders:false});
  const badZip=await unsafe.generateAsync({type:'uint8array'});
  assert.throws(()=>parseZip(badZip,0,new Set(),[]),/Unsafe/);
  await assert.rejects(combine([{name:'bad.zip',bytes:bytes.length,hash:'0'.repeat(64),files:['a']}],async()=>bytes),/SHA-256/);
});

test('browser loads no packages until click, retries an HTTP failure, then downloads a verified complete edition',
  {skip:process.env.FIRST_FIRE_OFFLINE_BROWSER!=='1'}, async()=>{
    const modulePath=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(modulePath));}
    const server=http.createServer(async(req,res)=>{
      try {
        const name=new URL(req.url,'http://localhost').pathname.slice(1);
        if(!/^[\w.\/-]+$/.test(name)||name.includes('..')){res.writeHead(404);return res.end();}
        const bytes=name==='offline-download.js'?await fs.readFile(path.join(__dirname,'../site',name)):await file(name);
        res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.html')?'text/html':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'application/octet-stream'});res.end(bytes);
      }catch{res.writeHead(404);res.end();}
    });
    let browser;
    try {
      await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
      browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
      const page=await browser.newPage({viewport:{width:360,height:850}});
      const requests=[];page.on('request',r=>requests.push(r.url()));
      await page.goto('http://127.0.0.1:'+server.address().port+'/offline.html');
      const button=page.locator('[data-ff-offline-combine]'),status=page.locator('[data-ff-offline-status]');
      assert(await button.isEnabled());assert.equal(requests.filter(u=>/\.zip$|offline-packs\.json$|checksums\.json$/.test(u)).length,0);
      await page.route('**/first-fire-offline.zip',route=>route.fulfill({status:503,body:'Simulated temporary failure'}),{times:1});
      await button.click();await page.waitForFunction(()=>/503.*retry/i.test(document.querySelector('[data-ff-offline-status]').textContent));
      assert(await button.isEnabled());assert((await page.locator('a[data-pack]').count())>=5);
      const event=page.waitForEvent('download',{timeout:45000});await button.click();const download=await event;
      assert.equal(download.suggestedFilename(),'FIRST-FIRE-complete-offline.zip');assert.equal(await download.failure(),null);
      assert.match(await status.textContent(),/Verified \d+ files/);
      const zip=await JSZip.loadAsync(await fs.readFile(await download.path()));assert(zip.file('FIRST-FIRE/rover-workbench/prototype/index.html'));
    }finally{await browser?.close();server.close();}
  });
