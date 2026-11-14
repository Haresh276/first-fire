/*
 Run after scripts/build.py: node tests/browser.cjs
 Requires Playwright and its Chromium (or set CHROMIUM_EXECUTABLE).
 Optional FIRST_FIRE_QA_URL=http://localhost:8000/index.html for the same checks on HTTP.
 Screenshots go to an OS temporary directory, or FIRST_FIRE_QA_ARTIFACT_DIR.
 All submissions are fabricated and the browser context is discarded at exit.
*/
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
let chromium;
try {({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const root=path.resolve(__dirname,'..');
const entry=process.env.FIRST_FIRE_QA_URL||pathToFileURL(path.join(root,'dist/index.html')).href;
const artifacts=process.env.FIRST_FIRE_QA_ARTIFACT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'first-fire-browser-'));
fs.mkdirSync(artifacts,{recursive:true});
const mkfile=(name,value)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
const pack={...require('../research/evaluation-examples/participant.example.json'),study_id:'synthetic-integrated-qa',time_limit_s:30};
const key={...require('../research/evaluation-examples/key.example.json'),study_id:pack.study_id};
const cases=require('../data/cases.json');
const consoleErrors=[];
async function visit(page,hash){await page.goto(entry+'#'+hash);await page.waitForFunction(()=>document.querySelector('#content h1, #content article, #content h2'));}
async function getDownload(page,click){const wait=page.waitForEvent('download');await click();const d=await wait;return {file:d.suggestedFilename(),bytes:fs.readFileSync(await d.path())};}
async function checkOverflow(page,name){
 const geom=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,body:document.documentElement.scrollWidth, offenders:[...document.querySelectorAll('main *')].filter(n=>{if(n.closest('.tablewrap,[hidden]')||!n.getClientRects().length)return false;const box=n.getBoundingClientRect();return box.right>document.documentElement.clientWidth+2;}).slice(0,4).map(n=>({tag:n.tagName,cls:n.className,txt:n.textContent.trim().slice(0,50)}))}));
 assert(geom.body<=geom.viewport+2,name+' overflow '+JSON.stringify(geom));
}
async function workspaceNavigation(page) {
 const nav=page.getByRole('navigation',{name:'Workspace'});
 const explore=nav.locator('summary').filter({hasText:'Explore'});
 const cases=nav.getByRole('link',{name:'Case library'});
 await page.goto(entry+'#home',{waitUntil:'domcontentloaded'});
 await page.locator('.hero h1').waitFor();
 assert(await page.getByRole('link',{name:'FIRST FIRE home'}).isVisible());
 assert.deepEqual(await nav.getByRole('link').allTextContents(),['Chat']);
 assert.equal(await cases.isVisible(),false);
 await explore.focus();
 await page.keyboard.press('Enter');
 assert(await cases.isVisible());
 const links=await nav.getByRole('link').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
 const width=page.viewportSize().width;
 assert(links.every(rect=>rect.x>=0 && rect.right<=width+1),'Explore link outside '+width+'px viewport.');
 await page.keyboard.press('Escape');
 assert.equal(await cases.isVisible(),false);
 assert(await explore.evaluate(n=>n===document.activeElement));
 await explore.click();
 await cases.click();
 await page.getByRole('heading',{name:'Research cases',exact:true}).waitFor();
 assert.equal(await cases.isVisible(),false);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'content');
 await nav.getByRole('link',{name:'Chat',exact:true}).click();
 await page.getByRole('heading',{name:'Research chat',exact:true}).waitFor();
 assert.equal(await nav.getByRole('link',{name:'Chat',exact:true}).getAttribute('aria-current'),'page');
 await checkOverflow(page,'workspace navigation');
}
function watch(page){page.on('pageerror',e=>consoleErrors.push(e.message));page.on('requestfailed',r=>{if(r.failure()?.errorText?.includes('ABORTED'))return;if(r.url().startsWith('file:'))consoleErrors.push('Failed local asset '+r.url());});page.on('response',r=>{if(r.status()>=400 && new URL(r.url()).origin===new URL(entry).origin)consoleErrors.push(r.status()+' '+r.url());});}
async function study(page){
 await visit(page,'study');await page.getByRole('button',{name:'Practice with six published cases'}).waitFor();
 await page.getByLabel('Import facilitator').setInputFiles(mkfile('pack.json',pack));
 for(let i=0;i<6;i++){
  await page.getByRole('button',{name:'Reveal prompt and start timer'}).click();
  await page.getByLabel('Your decision and finding').fill('Synthetic response '+i);
  await page.getByLabel('Primary source URL').fill('https://example.test source locator');
  await page.getByLabel('One condition or limit').fill('Synthetic scope');
  if(i%2===0){await page.getByLabel('Next action with one test budget').selectOption('reanalyze');await page.getByLabel('Why would this').fill('Synthetic reason');}
  if(i===0){await page.reload();assert.equal(await page.getByLabel('Your decision and finding').inputValue(),'Synthetic response 0');}
  if(i===3){
   await page.evaluate(()=>{const k='first-fire.study.v1',r=JSON.parse(localStorage.getItem(k));r.active.end=Date.now()-1000;localStorage.setItem(k,JSON.stringify(r));});await page.reload();
  }else await page.getByRole('button',{name:'Submit response'}).click();
 }
 const masked=JSON.parse((await getDownload(page,()=>page.getByRole('button',{name:'Export masked responses'}).click())).bytes);
 const raw=JSON.parse((await getDownload(page,()=>page.getByRole('button',{name:'Export analyst record'}).click())).bytes);
 assert(raw.records[3].timed_out);assert.equal(masked.responses.length,6);assert(masked.responses.every(r=>!('arm' in r)));
 await page.getByRole('button',{name:'Assessor',exact:true}).click();
 await page.getByLabel('Load assessor key').setInputFiles(mkfile('key.json',key));
 await page.getByLabel('Load one masked response file').setInputFiles(mkfile('masked.json',masked));
 await page.getByRole('heading',{name:'Response 1 of 6'}).waitFor();
 await page.getByRole('button',{name:'Export grades',exact:true}).click();assert(await page.getByText('Grade all three criteria for every response before export.').isVisible());
 for(let i=0;i<6;i++){
  for(const [j,input] of (await page.locator('#study select').all()).entries()){assert.equal(await input.inputValue(),'');await input.selectOption(j===3?'0':'1');}
  if(i<5)await page.getByRole('button',{name:'Next',exact:true}).click();
 }
 const grades=JSON.parse((await getDownload(page,()=>page.getByRole('button',{name:'Export grades',exact:true}).click())).bytes);
 await page.getByRole('button',{name:'Analyst',exact:true}).click();
 await page.getByLabel('Select all analyst and grade JSON').setInputFiles([mkfile('run.json',raw),mkfile('grades.json',grades)]);
 const report=JSON.parse((await getDownload(page,()=>page.getByRole('button',{name:'Export scores by case and participant'}).click())).bytes);
 assert.equal(report.groups.first_fire.complete_correct,3);assert.equal(report.groups.first_fire.budget_supported,0);assert.equal(report.groups.ordinary_search.budget_skipped,3);
}
async function forecast(page){
 await visit(page,'forecast');await page.locator('#fm-mean').waitFor();assert.equal(await page.locator('#fm-burns tr').count(),4);
 await page.getByLabel('Mean limit').fill('');assert(await page.locator('#fm-export').isDisabled());await page.getByRole('button',{name:'Restore worked assumptions'}).click();
 await page.getByText('Set the central 80% interval directly').click();await page.getByLabel('Lower 80% bound').fill('25');await page.getByLabel('Upper 80% bound').fill('29');await page.getByRole('button',{name:'Use these bounds'}).click();assert.equal(await page.getByLabel('Mean limit').inputValue(),'27');await page.getByRole('button',{name:'Restore worked assumptions'}).click();
 for(let i=0;i<4;i++)await page.getByLabel('Hypothetical burn '+(i+1)+' outcome').selectOption(i<3?'yes':'no');
 assert((await page.locator('#fm-scores').textContent()).includes('0.0161'));assert((await page.locator('#fm-design').textContent()).includes('below 29%'));
 await page.getByLabel('Hypothetical burn 1 outcome').selectOption('no');assert((await page.locator('#fm-design').textContent()).includes('contradict'));
 const {bytes}=await getDownload(page,()=>page.getByRole('button',{name:'Download scenario JSON'}).click());assert.deepEqual(JSON.parse(bytes).actual_outcomes,[null,null,null,null]);
 await page.getByText(crypto.createHash('sha256').update(bytes).digest('hex'),{exact:false}).waitFor();
}
async function claimAndAcrylic(page){
 await visit(page,'claim');
 await page.getByLabel('Your claim or research question').fill('The 85% oxygen in CFI-G was the gas surrounding the burner.');
 await page.getByRole('button',{name:'Find relevant cases'}).click();
 await page.getByLabel('Case for comparison').selectOption('cfig');
 for(const label of ['Endpoint in your question','Material or specimen in your question','Gravity or platform in your question'])await page.getByLabel(label).selectOption('match');
 const assertion=page.getByLabel('Which assertion or hypothesis');
 await assertion.selectOption('inconsistent');await page.getByRole('button',{name:'Compare with the source'}).click();
 await page.getByRole('heading',{name:'Mapped assertion conflicts with the source'}).waitFor();
 const review=await getDownload(page,()=>page.getByRole('button',{name:'Download review',exact:true}).click());
 assert(review.bytes.toString().includes('6% ethane'));await page.getByRole('button',{name:'Save review on this device'}).click();
 await assertion.selectOption('recorded');await page.getByRole('button',{name:'Compare with the source'}).click();
 await page.getByRole('heading',{name:'Supported within the recorded scope'}).waitFor();
 await page.getByLabel('Gravity or platform in your question').selectOption('unknown');await page.getByRole('button',{name:'Compare with the source'}).click();
 await page.getByRole('heading',{name:'Insufficient support for the mapped claim'}).waitFor();
 await page.getByLabel('Case for comparison').selectOption('other');await page.getByRole('heading',{name:'Insufficient case evidence'}).waitFor();
 await page.reload();await page.getByText('Last saved review on this device').click();assert((await page.locator('#claimtool pre').innerText()).includes('6% ethane'));
 await visit(page,'acrylic');const verdict=page.locator('#acrylictool [aria-live]');
 assert.match(await verdict.innerText(),/larger rods spread faster on Earth/);
 await page.getByLabel('Acrylic specimen').selectOption('small');assert.match(await verdict.innerText(),/lacks a flight measurement/);
 await page.getByLabel('Oxygen by volume').selectOption('low');assert.match(await verdict.innerText(),/17.5%/);
 await page.getByLabel('Acrylic specimen').selectOption('panel');await page.getByLabel('Oxygen by volume').selectOption('enriched');assert.match(await verdict.innerText(),/rib edges/);
 assert.match(await page.locator('#acrylictool').innerText(),/0.88 mm\/s/);
 await page.getByLabel('Measurement').selectOption('ignition');assert.match(await verdict.innerText(),/Downstream ignition/);
 await page.getByLabel('Gravity question').selectOption('lunar');assert.match(await verdict.innerText(),/LUCI/);
 assert((await page.locator('#acrylictool .readlist a').evaluateAll(links=>links.map(x=>x.href))).every(url=>url.startsWith('https://')&&url.includes('#page=')));
}
async function app(page){
 await page.goto(entry);await page.locator('.hero h1').waitFor();await page.evaluate(()=>document.fonts.ready);assert(await page.locator('.hero img').evaluate(img=>img.naturalWidth>0));await checkOverflow(page,'desktop home');
 await page.screenshot({path:path.join(artifacts,'desktop-home.png')});
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'content');
 await page.locator('a[href="#case/sibal"]').first().click();await page.getByLabel('Research question').waitFor();
 const before=await page.locator('#pair').innerText();await page.getByLabel('Research question').selectOption({index:1});assert.notEqual(await page.locator('#pair').innerText(),before);
 await page.getByRole('link',{name:'My research brief'}).click();await page.getByLabel('Your decision').fill('Synthetic source-backed decision');await page.getByRole('button',{name:'Save on this device'}).click();await page.reload();assert.equal(await page.getByLabel('Your decision').inputValue(),'Synthetic source-backed decision');
 const brief=await getDownload(page,()=>page.getByRole('button',{name:'Download brief'}).click());assert(brief.bytes.toString().includes('Synthetic source-backed decision'));
 for(const c of cases){await visit(page,'case/'+c.id+'/designs');await page.locator('.optionlist').waitFor();assert.equal(await page.locator('.optionlist li').count(),6,c.id);}
 await visit(page,'home');await page.getByRole('searchbox',{name:'Search research evidence'}).fill('wire insulation smoke');await page.getByRole('button',{name:'Search'}).click();await page.locator('#matches .result').first().waitFor({timeout:15000});
 assert(/semantic \+ keyword retrieval/i.test(await page.locator('#matches').innerText()),await page.locator('#matches').innerText());assert((await page.locator('#matches a').evaluateAll(nodes=>nodes.slice(0,3).map(a=>a.getAttribute('href')))).includes('#case/same'));await checkOverflow(page,'desktop search');
 await visit(page,'data?study=PSI-101');await page.getByLabel('Search ID, material or endpoint').fill('Teflon 56');
 const row=page.getByRole('button',{name:/Open PSI-101 .*source row/}).first();await row.click();assert(await page.getByText('Original NASA row',{exact:true}).isVisible());
 const csv=await getDownload(page,()=>page.getByRole('button',{name:'Export filtered CSV'}).click());assert(csv.bytes.toString().includes('Teflon'));
 await page.getByRole('button',{name:'Rank for a habitat'}).click();await page.getByLabel('Scenario',{exact:true}).selectOption('mars');assert.equal(await page.getByLabel('Gravity (Earth g)').inputValue(),'0.38');
 await page.getByLabel('Required material text').fill('no-material-like-this');await page.getByText('No eligible records. Try another material or test subject.').waitFor();
 await visit(page,'data?study=PSI-99&q=2-7');await page.getByRole('button',{name:/Open PSI-99 2-7 source row/}).click();assert((await page.getByText('Original NASA row',{exact:true}).locator('..').innerText()).includes('140 s'));
 await visit(page,'coverage');const coverageBefore=await page.locator('#workbench [aria-live]').innerText();await page.getByLabel('Test subject').selectOption('gas');await page.getByLabel('Count rows that report').selectOption('burner');assert.notEqual(await page.locator('#workbench [aria-live]').innerText(),coverageBefore);
 await visit(page,'referee');await page.getByRole('button',{name:'Check wording'}).click();await page.locator('[data-match=yes]').waitFor();await page.getByLabel('Quotation to verify').fill('Lunar habitat certification was awarded to every material.');await page.getByRole('button',{name:'Check wording'}).click();await page.locator('[data-match=no]').waitFor();
 await visit(page,'sources');await page.getByRole('link',{name:/Blind-test protocol/}).click();await page.locator('article.prose').waitFor();assert(await page.locator('article.prose table').count()>0);
 await visit(page,'guide');await page.locator('#content article').waitFor();assert(await page.locator('article a').count()>4);await page.locator('article a[href^="#case/"]').first().click();await page.getByLabel('Research question').waitFor();
}
async function main(){
 const launch={headless:true};if(process.env.CHROMIUM_EXECUTABLE)launch.executablePath=process.env.CHROMIUM_EXECUTABLE;
 const browser=await chromium.launch(launch);
 try{
  const desktop=await browser.newPage({viewport:{width:1440,height:1000}});desktop.setDefaultTimeout(6500);watch(desktop);
  await app(desktop);await workspaceNavigation(desktop);await claimAndAcrylic(desktop);console.log('Passed desktop navigation, cases, claim mapping, acrylic experiment, search model, evidence, functional export, ranking, guide and keyboard.');await forecast(desktop);await study(desktop);
  await visit(desktop,'report/submission');await desktop.locator('article.prose').waitFor();for(const dest of ['demo.html','index.html']){const item=desktop.locator('article.prose a').filter({hasText:dest==='demo.html'?'Six-slide judge demonstration':'FIRST FIRE dashboard'}).first();const actual=await item.getAttribute('href');assert.equal(new URL(actual,entry).pathname,new URL(dest,entry).pathname,'Deployment-relative report link '+actual);}
  const mobile=await browser.newPage({viewport:{width:360,height:800},isMobile:true,deviceScaleFactor:1});mobile.setDefaultTimeout(6500);watch(mobile);
  await mobile.setViewportSize({width:320,height:700});
  // Exercise fallback type too, since a narrow header must fit before the bundled fonts load.
  let release;
  const delayFonts=new Promise(resolve=>{release=resolve;});
  await mobile.route('**/fonts/**',async request=>{await delayFonts;await request.continue();});
  try{await workspaceNavigation(mobile);}finally{release();await mobile.unrouteAll({behavior:'wait'});}
  await mobile.setViewportSize({width:360,height:800});
  const layoutIssues=[];
  for(const hash of ['home','claim','acrylic','cases','case/sibal','case/saffire/designs','data','data?mode=rank','forecast','study','coverage','referee','guide','report/evaluation','sources']){
   await visit(mobile,hash);await mobile.evaluate(()=>document.fonts.ready);try{await checkOverflow(mobile,'360px '+hash);}catch(e){layoutIssues.push(e.message);}
   if(['home','claim','acrylic','case/sibal','forecast','study','guide'].includes(hash))await mobile.screenshot({path:path.join(artifacts,'mobile-'+hash.replace('/','-')+'.png')});
  }
  await mobile.goto(new URL('demo.html',entry).href);await mobile.getByRole('button',{name:'Next slide'}).click();await mobile.locator('#s2:visible').waitFor();await checkOverflow(mobile,'mobile slides');
  assert.equal(layoutIssues.length,0,layoutIssues.join('\n'));assert.equal(consoleErrors.length,0,consoleErrors.join('\n'));console.log('Passed six timed study cases, 21 mandatory intentional rubric choices, masked scoring, conditional forecast, downloadable checksum, mobile layout and slides.');console.log('Screenshots:',artifacts);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
