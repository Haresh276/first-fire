const test=require('node:test'),assert=require('node:assert/strict');
const {chooseTier,selectedId,suggest}=require('../site/reader-device.js');
const samples=require('./reader-samples.json');
test('classifies ten explicitly labelled synthetic résumés and explains the suggestion',()=>{
  for(const s of samples){const result=suggest(s.text);assert.equal(result.level,s.level,s.id);assert.equal(result.field,s.field,s.id);assert.match(result.reason,/Suggested/);}
  assert.throws(()=>suggest(' '));
});
test('requires measured storage and adapter for automatic Pro; missing memory defaults to Standard',()=>{
  const capable={checked:true,adapter:true,free:400_000_000};
  assert.equal(chooseTier({deviceMemory:8},capable).tier,'pro');
  for(const nav of [{connection:{saveData:true},deviceMemory:8},{connection:{effectiveType:'3g'}},{deviceMemory:2}])assert.equal(chooseTier(nav,capable).tier,'lite');
  for(const [nav,signals] of [[{},capable],[{deviceMemory:8},{}],[{deviceMemory:8},{...capable,adapter:false}],[{deviceMemory:8},{...capable,free:0}]])assert.equal(chooseTier(nav,signals).tier,'standard');
});
test('selector output must be an exact letter in the offered evidence set',()=>{
  const candidates=[{id:'A-record'},{id:'B-record'}];
  assert.equal(selectedId('b\n',candidates),'B-record');
  for(const output of ['C','B or A','NONE','1','B.','B [made-up citation]'])assert.equal(selectedId(output,candidates),null);
});
