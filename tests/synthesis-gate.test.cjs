const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.window = globalThis;
require('../dist/records.js');
require('../site/answer-confidence-fit.js');
require('../site/answer-confidence.js');
require('../site/evidence-desk.js');

test('local synthesis binds the release URL, locator, quantities and rendered claim', async () => {
  const source = {id:'fixture', title:'Fixture registration', url:'forecast-lock/pmma-v1.json', locator:'Worked example'};
  globalThis.FFChatPassages = {version:'ff-passages-1', docs:{fixture:{...source, text:'The initial readings were 36 and 14 seconds.'}}};
  const receipt = {version:'ff-synthesis-1',ids:['fixture'],blocks:[
    {text:'The difference is 22 seconds.',refs:[0],calculations:[['-',36,14]]},
  ]};
  const q = 'How big is the time difference?';
  const answer = {status:'answered',mode:'local',evidenceKind:'grounded-synthesis',answer:'The difference is 22 seconds. [1]',
                  sources:[source],synthesisReceipt:receipt};
  const valid = await FFEvidenceDesk.gate(q,answer);
  assert.equal(valid.answer,answer.answer);
  assert.equal(valid.verification.checks.quantity.state,'pass');
  assert.equal(valid.verification.checks.interpretation.state,'unavailable');
  assert.equal(valid.sources[0].url,'forecast-lock/pmma-v1.json');
  const attacks = [
    x => x.answer = x.answer.replace('22','17'),
    x => { x.answer=x.answer.replace('22','17'); x.synthesisReceipt.blocks[0].text=x.synthesisReceipt.blocks[0].text.replace('22','17'); },
    x => x.synthesisReceipt.blocks[0].calculations[0][1] = 414,
    x => x.synthesisReceipt.blocks[0].calculations = [['eval','globalThis']],
    x => x.sources[0].url = 'https://unrelated.example/',
    x => x.synthesisReceipt.ids[0] = '__proto__',
  ];
  for (const attack of attacks) {
    const turn=structuredClone(answer);
    attack(turn);
    const result=await FFEvidenceDesk.gate(q,turn);
    assert.equal(result.status,'abstained');
    assert.equal(result.verification.checks.quote.state,'fail');
  }
});

test('proof drawer identifies the exact material registration, guide or method cited', () => {
  require('../site/proof-drawer.js');
  const {readFileSync}=require('node:fs'),{createHash}=require('node:crypto'),path=require('node:path');
  const fingerprint=file=>createHash('sha256').update(readFileSync(path.join(__dirname,'../site',file))).digest('hex');
  const proof=(id,url,locator)=>FFProofDrawer.resolve({id,url,locator,title:'Fixture'});
  for(const model of ['fm2-v1','pmma-v1','fm2-v2']){
    const file='forecast-lock/'+model+'.json',x=proof('registration',file,'Event definition');
    assert.equal(x.original,file);
    assert.equal(x.hash,fingerprint(file));
    assert.equal(x.locator,'Event definition');
  }
  const id='first-fire-field-guide.pdf',page=proof('guide',id+'#page=6');
  assert.equal(page.original,id+'#page=6');assert.equal(page.hash,fingerprint(id));assert.match(page.locator,/page 6/);
  const method=proof('forecast:formula','#report/forecast','Model assumptions');
  assert.equal(method.original,'#report/forecast');assert.equal(method.hash,'');
  assert.equal(proof('fm2-lock','#forecast','Signed model').hash,fingerprint('forecast-lock/fm2-v1.json'));
  assert.equal(proof('fm2-outcomes','#forecast','Outcome register').hash,'');
  assert.equal(proof('guide','first-fire-field-guide.pdf#page=5&external=1'),null);
});

test('spelled and numerical fractions agree while co-occurring digits cannot forge a ratio', async()=>{
  const source={id:'gravity',title:'Gravity',url:'#report/data',locator:'Fixture'};
  globalThis.FFChatPassages={docs:{gravity:{...source,text:'The field is one-sixth as strong. Run 7 supplied the measurement.'}}};
  async function check(text){
    return FFEvidenceDesk.gate('How strong is the field?',{status:'answered',mode:'local',evidenceKind:'grounded-synthesis',answer:text+' [1]',sources:[source],
      synthesisReceipt:{version:'ff-synthesis-1',ids:['gravity'],blocks:[{text,refs:[0],calculations:[]}]}});
  }
  assert.equal((await check('Its field is 1/6 as strong.')).status,'answered');
  assert.equal((await check('Its field is one-seventh as strong.')).status,'abstained');
});

test('each rendered proof drawer offers the timestamp for the selected registration', () => {
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>({tag,dataset:{},children:[],append(...items){this.children.push(...items);},setAttribute(){}})};
  try{
    for(const name of ['fm2-v1','pmma-v1','fm2-v2']){
      const drawer=FFProofDrawer.drawer({id:'registration',url:'forecast-lock/'+name+'.json',title:'Registration',locator:'Scoring rules'});
      const signature=drawer.children.find(child=>child?.textContent==='Download the signed timestamp');
      assert.equal(signature.href,'forecast-lock/'+name+'.tsr');
    }
    assert.ok(FFProofDrawer.drawer({url:'#report/data',title:'Data',locator:'Audit'}));
  }finally{globalThis.document=previous;}
});
