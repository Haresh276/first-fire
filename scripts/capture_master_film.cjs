// Capture the built FIRST FIRE interface without replacing any charts, text or test results.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url');
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
const out=path.resolve(process.argv[2]),base=pathToFileURL(path.resolve(process.argv[3]||path.join(__dirname,'../dist'),'index.html'));
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
 try{
  const p=await b.newPage({viewport:{width:1030,height:820},deviceScaleFactor:1.5});p.setDefaultTimeout(12000);
  async function go(route,selector){await p.goto(base.href+'#'+route);await p.locator(selector).first().waitFor();await p.evaluate(()=>document.fonts.ready);}
  async function shot(file,selector,width,height){
    const node=p.locator(selector).first();await node.scrollIntoViewIfNeeded();
    // Clip a close-up to the source feature, preserving the actual screen's geometry and content.
    const box=await node.boundingBox(),clip={x:0,y:0,width:0,height:0};
    const coords=await node.evaluate(n=>{const a=n.getBoundingClientRect();return {x:a.x+scrollX,y:a.y+scrollY};});
    clip.x=Math.max(0,coords.x);clip.y=Math.max(0,coords.y);clip.width=Math.min(width||box.width,box.width,p.viewportSize().width-clip.x);clip.height=Math.min(height||box.height,box.height);
    await p.screenshot({path:path.join(out,file+'.png'),fullPage:true,clip,animations:'disabled'});
  }
  await go('rulebook','#rule-reading');await shot('rule','#rule-reading',650,224);
  await go('materials-lab?tab=margins','.margin-row');
  // Include both directions in the NASA comparison, drawn by the live material library.
  await shot('material','.master-panel',900,355);
  await go('atlas','.atlas-matrix');await shot('atlas','.atlas-matrix',850,305);
  await p.setViewportSize({width:570,height:850});
  await go('compass','main .panel');await shot('compass','main section.note',900,240);
  await p.setViewportSize({width:1030,height:820});
  await go('referee','.rf-layout');await p.getByRole('button',{name:'Test the planted quote'}).click();await p.getByRole('heading',{name:'Claim withheld'}).waitFor();await shot('referee','.rf-report',620,239);
  await p.setViewportSize({width:695,height:850});
  await go('vehicle-designer','.vd-scene canvas');await shot('rover','.vd-scene',680,345);
  await p.setViewportSize({width:1000,height:820});
  await go('forecast','.fm-lock');await shot('forecast','.fm-curve',650,350);
  await p.setViewportSize({width:570,height:850});
  const verify=p.getByText('Verify the forecast fingerprint',{exact:true});await verify.click();
  await p.waitForFunction(()=>/9f565b|verified|match/i.test(document.querySelector('.fm-lock').innerText));
  await shot('seal','.fm-lock',925,305);
 }finally{await b.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
