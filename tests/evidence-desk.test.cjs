'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');global.window=global;
for(const file of ['dist/records.js','dist/observation-rows.js','site/forecast-ui.js','site/science-chat.js','site/referee-reviews.js','site/referee-passages.js','site/referee-deck.js','site/intent-router.js','site/source-claim-reviews.js','site/source-claims.js','site/record-facts.js','site/evidence-desk.js','site/mission-receipts.js','site/proof-drawer.js','site/atlas-deck.js','site/mission-desk.js','site/explorer.js','site/physics-lab.js'])require(path.join(__dirname,'..',file));
const desk=FFEvidenceDesk,router=FFIntentRouter;
test('decoded PSI references, original DOI proof and quantifiable comparisons',async()=>{
  const q='Compare FLEX-155 versus FLEX-120.', route=router.detect(q);
  assert.equal(route.type,'compare');assert.equal(route.params.left,'PSI-69:1:156');
  const proposed=desk.toolAnswer(route,q,FF),checked=await desk.gate(q,proposed,[],route);
  assert.equal(checked.verification.checks.quantity.state,'pass');assert.match(checked.answer,/Different entries/);
  const p=FFProofDrawer.resolve(checked.sources[0],checked.verification,FF);
  assert.match(p.hash,/^[a-f0-9]{64}$/);assert.match(p.citation,/https:\/\/doi.org\/10\.60555\//);
  const altered=await desk.gate(q,{...proposed,answer:proposed.answer+' 581%'},[],route);
  assert.equal(altered.status,'abstained');assert.doesNotMatch(altered.answer,/581/);
});
test('complete Compass and cabin simulations replay; incomplete inputs ask for the missing evidence',async()=>{
  const questions=['Rank solid records for a lunar habitat at 34% oxygen and 8.2 psia.',
    'What if cellulose burns in a sealed 12 m3 Moon cabin at 34% oxygen and 56.54 kPa with cutoff 18%, strip length 40 cm, 2 g/cm and 0.3 cm/s?'];
  for(const q of questions){const r=router.detect(q),a=desk.toolAnswer(r,q,FF);assert.equal(a.evidenceKind,'tool-calculation');
    const checked=await desk.gate(q,a,[],r);assert.equal(checked.verification.checks.quantity.state,'pass');
    assert(checked.sources.every(s=>s.locator));}
  const q='What if cellulose burns in a sealed 12 m3 cabin?',r=router.detect(q);
  assert.deepEqual(r.params,{volume:12,fuel:'cellulose'});assert.equal(desk.toolAnswer(r,q,FF).evidenceKind,'input-needed');
});
test('quote, independent model and quantity each gate new submissions; unknown live paths fail closed',async()=>{
  const ref=FFRefereeReviews.cases.find(r=>r.id==='nomex');
  const q='Verify the claim "'+ref.claim+'" against the quote "'+ref.quote+'".';
  const sourceFirst='Verify the quote "'+ref.quote+'" and claim "'+ref.claim+'".';
  const r=router.detect(sourceFirst);
  const requested=await desk.checkSubmitted(sourceFirst,r),valid=await desk.gate(sourceFirst,requested,[],r);
  assert.equal(valid.status,'answered');assert.equal(valid.verification.checks.interpretation.state,'pass');
  const altered=await desk.gate(q,{...requested,submission:{...requested.submission,claim:'There were 9999 joules of heat.'}},[],r);
  assert.equal(altered.status,'abstained');assert.doesNotMatch(altered.answer,/9999/);
  const p=await desk.gate('What is the pressure?',{answer:'A verified value of 611.',sources:[],evidenceKind:'new-unregistered'},[],r);
  assert.equal(p.status,'abstained');assert.equal(p.verification.confidence.value,null);
});
test('historical source binding, matched conditions factors and protection against corrupt excerpt',async()=>{
  const q='Who was on board Apollo 1?',r=router.detect(q),input={evidenceKind:'mission-note',sources:[{id:'apollo1:mission'}],status:'answered'};
  const answer=await desk.gate(q,input,[],r);assert.match(answer.answer,/Grissom/);assert.match(answer.answer,/“/);
  const original=FFMissionReceipts.find(i=>i.facets.includes('crew'));const text=original.quote;
  try{original.quote='a falsified source';const blocked=await desk.gate(q,input,[],r);assert.equal(blocked.status,'abstained');}finally{original.quote=text;}
  const c=Object.fromEntries(['quote','interpretation','quantity','scope'].map(k=>[k,{state:'pass',reason:'test'}]));
  assert.equal(desk.confidence('complex',c,2).value,.65*.75);
  assert.equal(desk.confidence('beginner',c,3).label,'High');
});

test('publisher-bound claims use independently reviewed facets and recheck the measured table cells',async()=>{
  const card=FFSourceClaims.cards.find(c=>c.id==='sibal-base'), query='What did LUCI report for its flame base?';
  const proposed={answer:'The flame spread at 270 mm/s.',status:'answered',evidenceKind:'archive-note',sources:[]};
  const out=await desk.gate(query,proposed,[],router.detect(query));
  assert.match(out.answer,/0\.9 mm\/s/);assert.doesNotMatch(out.answer,/270/);
  assert.equal(out.verification.checks.quantity.state,'pass');
  assert.equal(FFReviewedSources.numbers({...card,claim:card.claim.replace('0.9','1.9')}).state,'fail');
  const original=card.quote;
  try{card.quote+='x';assert.equal(await FFReviewedSources.reviewed(query,proposed,FF),null);}
  finally{card.quote=original;}
  assert.equal(await FFReviewedSources.reviewed('Can the LUCI flame base certify oxygen safety on Mars?',proposed,FF),null);
  const gases=FFSourceClaims.cards.find(c=>c.id==='flex-gases');
  assert.notEqual(gases.verdict,'supported');assert.equal(FFReviewedSources.numbers(gases).state,'pass');
  const extracted=await FFReviewedSources.reviewed('What was the initial gas composition in FLEX?',proposed,FF);
  assert(extracted.answer.includes('“'));assert(!extracted.answer.includes(gases.claim));
});

test('locally selected paragraphs bind the entire answer, source identity and units', async()=>{
  require('../dist/chat-passages.js');
  const id='cfig:flows', d=FFChatPassages.docs[id], source={id,title:d.title,url:d.url,locator:d.locator};
  const turn={mode:'local',status:'answered',evidenceKind:'bound-passages',passageReceipt:{version:FFChatPassages.version,ids:[id]},sources:[source],answer:d.text+' [1]'};
  const input='Compare the oxygen flow in the two inverse CFI-G runs.';
  const good=await desk.gate(input,turn);
  assert.equal(good.answer,turn.answer);
  assert.equal(good.verification.checks.quote.state,'pass');
  for(const forged of [
    {...turn,answer:turn.answer.replace('mg/s','kg/s')},
    {...turn,answer:turn.answer+' All garments are flight safe.'},
    {...turn,sources:[{...source,locator:'page 999'}]},
    {...turn,passageReceipt:{version:'unknown',ids:[id]}},
    {...turn,passageReceipt:{version:FFChatPassages.version,ids:['__proto__']}},
  ]){
    const checked=await desk.gate(input,forged);
    assert.equal(checked.status,'abstained');
    assert.equal(checked.verification.checks.quote.state,'fail');
  }
});
