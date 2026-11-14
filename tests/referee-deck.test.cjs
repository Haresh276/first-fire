const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data',name),'utf8'));
globalThis.FF={evidence:read('evidence/pages.json'),forecast:read('forecast.json')};
require('../site/referee-reviews.js');
require('../site/referee-passages.js');
require('../site/referee-deck.js');
const {evaluate,checkedReply,route,quantitative,wordPieces}=FFDeckReferee;
const by=id=>FFRefereeReviews.cases.find(r=>r.id===id);
const run=r=>evaluate(r.anchor,r.quote,r.claim);

test('record binding, independent decisions, uncertainty and numerical errors',async()=>{
  const canonical=by('nomex'), valid=await run(canonical);
  assert.equal(valid.state,'supported');
  assert.equal(valid.numeric.state,'na');
  assert.equal((await evaluate(canonical.anchor,canonical.quote.replace('not ',''),canonical.claim)).quotation.state,'fail');
  assert.equal((await evaluate('luci34',canonical.quote,canonical.claim)).quotation.state,'fail');
  assert.equal((await evaluate(canonical.anchor,canonical.quote,canonical.claim+' Also safe on the Moon.')).semantic.state,'unavailable');
  const badTime=await run(by('fake-time'));
  assert.equal(badTime.semantic.state,'pass');assert.equal(badTime.numeric.state,'fail');assert.equal(badTime.state,'rejected');
  const badFlight=await run(by('fake-flight'));
  assert.equal(badFlight.scope.state,'fail');assert.equal(badFlight.state,'rejected');
  for(const item of FFRefereeReviews.cases.filter(c=>c.fixture)){assert.equal((await run(item)).state,'rejected');}
  assert.equal((await run(by('teflon'))).numeric.state,'pass');
  assert.equal(quantitative('sameS8','About 66.7% of Teflon alarms were missed at 900 K.',by('teflon').quote).state,'unavailable');
  assert.equal((await run(by('fake-alarm'))).numeric.state,'fail');
  assert.equal(quantitative('luci34','The flame went out 45 seconds earlier at partial gravity than at Earth gravity.',by('extinction').quote).state,'fail');
  assert.equal(quantitative('sameS8','The ISS detector detected 66.7% of the Teflon smoke tests.',by('teflon').quote).state,'unavailable');
  assert.equal(quantitative('saff25','The fabric reached 900 K.','some words').state,'unavailable');
});
test('real numbers remain bound to the unit, specimen, source and direction in the full Referee path',async () => {
  const duration=by('extinction'), detector=by('teflon');
  const attacks=[
    [duration,duration.claim.replace('seconds','minutes'),'fail'],
    [duration,duration.claim.replace('45','−45'),'fail'],
    [duration,duration.claim.replace('fabric flame','heptane droplet'),'unavailable'],
    [duration,duration.claim.replace('Earth gravity than at partial','partial gravity than at Earth'),'fail'],
    [duration,duration.claim.replace('45','forty-five'),'unavailable'],
    [detector,detector.claim.replace('Teflon','Kapton'),'fail'],
    [detector,detector.claim.replace('missed','detected'),'unavailable'],
    [detector,detector.claim.replace('ISS','Shuttle'),'unavailable'],
    [detector,detector.claim.replace('%',' mg'),'unavailable'],
  ];
  for(const [source,claim,state] of attacks){
    const result=await evaluate(source.anchor,source.quote,claim);
    assert.equal(result.quotation.state,'pass',claim);
    assert.equal(result.numeric.state,state,claim);
    assert.notEqual(result.state,'supported',claim);
  }
  const wrongSource=await evaluate(detector.anchor,duration.quote,duration.claim);
  assert.equal(wrongSource.quotation.state,'fail');assert.equal(wrongSource.state,'rejected');
  const positive=await evaluate(duration.anchor,duration.quote,duration.claim.replace('45 seconds','0.75 minutes'));
  assert.equal(positive.numeric.state,'pass');
  assert.equal(positive.state,'unverified'); // An equivalent quantity still needs its own independent semantic review.
});
test('same evidence through chat, unmatched evidence and intake restrictions',async()=>{
  const src=(await run(by('nomex'))).src;
  const previous={answer:'original',status:'answered',sources:[{url:src.url}]};
  const checked=await checkedReply('Did the Nomex ignite in Saffire-II sample 2-7?',previous);
  assert.equal(checked.reviewId,'nomex');assert.match(checked.answer,/did not ignite.*\[1\]/);
  assert.equal(checked.sources[0].locator,'PDF page 25');
  assert.equal((await checkedReply('Did the Nomex ignite in Saffire-II sample 2-7?',{...previous,sources:[{url:'#case/unrelated'}]})).status,'abstained');
  const forged={answer:'Every lunar cabin is certified fireproof.',status:'answered',sources:[src]};
  assert.equal((await checkedReply('Is anything fireproof?',forged)).status,'abstained');
  const p=FFRefereePassages.find(p=>p.id==='saffire:time');
  const limited=await checkedReply('Why did the Nomex ignite?',{...previous,answer:p.text+' Every lunar cabin is certified fireproof.',sources:[p]});
  assert.equal(limited.evidenceKind,'archive-note');
  assert(!limited.answer.includes('certified fireproof'));
  assert.equal((await checkedReply('Did the Nomex ignite at 100% oxygen?',previous)).status,'abstained');
  assert.equal((await checkedReply('Compare Apollo and the Nomex in Saffire',previous)).status,'abstained');
  assert.equal((await checkedReply('What size was the FLEX-155 droplet at visible extinction?',forged)).evidenceKind,'withheld');
  assert.equal((await checkedReply('Invent a per-material denominator for the Teflon missed-alarm fraction and report it as observed.',previous)).evidenceKind,'withheld');
  const irrelevant={...previous,mode:'local',answer:p.text,sources:[p]};
  assert.equal((await checkedReply('What was the flame temperature?',irrelevant)).evidenceKind,'withheld');
});
test('routes explicit subjects and tokenizes the NLI sentence pair as wordpieces',()=>{
  assert.equal(route('set the heat release in the sealed cabin')[1],'#physics');
  assert.equal(route('try the rover sandbox')[1],'#physics?mode=rover');
  assert.equal(route('tell me about the Apollo fire'),null);
  assert.equal(route('FM² forecast')[1],'#forecast');
  assert.deepEqual(wordPieces('Héat, heating!',new Map([['heat',1],['##ing',2],[',',3],['!',4],['[UNK]',100]])),[1,3,1,2,4]);
});
test('FM² chat uses single explicit supported atmosphere, reproducible model and bounded assumptions',()=>{
  globalThis.window=globalThis;
  require('../site/forecast-ui.js');
  const ask=FFDeckReferee.forecastAnswer;
  const original=ask('FM² forecast: what is the chance of sustained spread at 25% oxygen?');
  assert.match(original.answer,/25.25%/);assert.equal(original.evidenceKind,'calculation');
  assert.equal(original.sources[1].locator,'PDF page 5');
  const update=ask('What about 29%?',[original]);assert.match(update.answer,/97.72%/);
  const custom=ask('FM2 chance of spread at 25% oxygen with mean 25 and sigma 1.5');
  assert.match(custom.answer,/50%/);
  assert.equal(ask('FM² chance at 25% and 33%').evidenceKind,'input-needed');
  assert.equal(ask('FM² chance at 55%').evidenceKind,'input-needed');
  assert.equal(ask('FM² probability at 25% with sigma 0').evidenceKind,'input-needed');
  assert.equal(ask('Did NASA observe the actual FM² ignition at 25%?'),null);
  assert.equal(ask('What was the measured temperature for FM² at 25%?'),null);
  assert.equal(ask('Does a SHA-256 digest establish that the FM² prediction was preregistered?'),null);
});
