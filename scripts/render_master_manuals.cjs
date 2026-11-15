/* Run after installing Playwright and Chromium. Fonts and CSS come from the repository. */
const os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
let chromium;
try { ({chromium}=require('playwright')); }
catch { ({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const site=path.resolve(__dirname,'../site');
const publicBase='https://first-fire-lunar-lab.vercel.app/';
const manuals=[['judge-brief','judge-brief'],['master-round2','master-round2'],['master-worksheet','master-worksheet'],['manual','first-fire-user-manual'],['technical-manual','first-fire-technical-manual']];
const selected=process.argv.slice(2);
for(const name of selected) if(!manuals.some(([input])=>name===input)) throw Error('Unknown manual: '+name);
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
  try{for(const [input,output] of manuals){
    if(selected.length && !selected.includes(input))continue;
    const page=await browser.newPage();await page.goto(pathToFileURL(path.join(site,input+'.html')).href);
    await page.locator('a[href]').evaluateAll((anchors,base)=>anchors.forEach(a=>{
      if(a.protocol==='file:')a.href=new URL(a.getAttribute('href'),base).href;
    }),publicBase+input+'.html');
    await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
    await page.pdf({path:path.join(site,output+'.pdf'),preferCSSPageSize:true,printBackground:true,tagged:true,displayHeaderFooter:false});
    await page.close();
  }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
