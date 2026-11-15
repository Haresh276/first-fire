/* Development regressions. The separately authored frozen benchmark lives outside this test suite. */
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const env={window:{}};
for(const file of ['dist/records.js','dist/observation-rows.js','site/science-chat.js']){
  vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),env);
}
const ff=env.window.FF, chat=env.window.FFScienceChat;
const ask=(question,previous=[])=>chat.answer(question,previous,ff);

test('composes multiple row predicates and preserves the exact measured location',()=>{
  const ans=ask('Count inverse CFI-G rows with recorded burner oxygen above 50%.');
  assert.equal(ans.analysis.n,80);
  const first=ff.tests.find(r=>r.record_id===ans.analysis.rows[0]);
  assert.equal(first.direction,'inverse');assert(Number(first.o2_burner_pct)>50);
  assert(ans.sources[0].url.includes('Inverse+Flames'));
  const falseAmbient=ask('Count inverse CFI-G rows with recorded initial ambient oxygen above 50%.');
  assert.equal(falseAmbient.analysis.n,0);assert.match(falseAmbient.answer,/selection returned no matching/i);
  assert.equal(ask('How many inverse CFI-G tests had oxygen above 50%?').analysis,null);
});

test('pooled aggregates, per-material groups, missing values and base-denominator receipts',()=>{
  const a=ask('Compare mean burn duration for methanol and heptane in FLEX.');
  assert.equal(a.analysis.groups[0].reported,156);assert.equal(a.analysis.groups[1].reported,112);
  assert.equal(a.analysis.groups[1].missing,5);
  assert(Math.abs(a.analysis.groups[1].value-7.938214285714285)<0.002);
  const frac=ask('What fraction of FLEX observations have missing absolute pressure?');
  assert.equal(frac.analysis.base,274);assert.equal(frac.analysis.n,1);
  const receipt=chat.receipt('What fraction of FLEX observations have missing absolute pressure?',[],ff);
  assert.equal(receipt.rows.length,1);assert.equal(receipt.sources[0].lines.length,274);
  assert.equal(receipt.rows[0].measured.pressure_psia,'');
  assert.equal(receipt.sources[0].hash.length,64);
});

test('ranges are closed, cutoffs use the published units, missing scalars stay missing',()=>{
  const a=ask('Count FLEX methanol rows with absolute pressure between 0.8 and 1 atm.');
  const b=ask('Count FLEX methanol rows with absolute pressure between 81.06 and 101.325 kPa.');
  assert(a.analysis.n>0);assert.deepEqual(a.analysis.rows,b.analysis.rows);
  const c=ask('How many normalized Saffire-I rows are missing initial ambient oxygen?');
  assert.equal(c.analysis.n,2);assert.match(c.answer,/interval/);
  assert.equal(ask('How many FLEX rows with absolute pressure above 17 seconds?').analysis,null);
  assert.equal(ask('How many FLEX rows with initial ambient oxygen between 29 and 21%?').analysis,null);
});

test('a follow-up replaces the subject and retains explicit filter scope, then unrelated questions clear it',()=>{
  const first='How many FLEX heptane rows have a reported burn duration?';
  const initial=ask(first);const prev=[{question:first,...initial}];
  const second=ask('What about methanol?',prev);
  assert.equal(second.analysis.n,156);assert.deepEqual([...second.analysis.plan.category.material],['methanol']);
  assert.equal(ask('What about methanol?',[...prev,{question:'Tell me about Apollo 1',mode:'archive'}]),null);
  assert.equal(ask('How many astronauts died in the Apollo 1 fire?'),null);
  assert.equal(ask('Have any of the four FM² burns been observed on the Moon?'),null);
});

test('withholds unsupported clauses, malformed filters, incompatible measurement scopes and instructions',()=>{
  for(const q of [
    'How many FLEX observations with absolute pressure greater than?',
    'Compute mean pressure in FLEX at 14.7 Fahrenheit',
    'How many FLEX observations were picked by <script>alert(1)</script>?',
    'How many FLEX records are safe for a lunar habitat?',
    'How many FLEX records have an oxygen concentration of 22 percent?',
    'How many FLEX observations have initial ambient oxygen above 780%?',
    'Count PSI-999 rows','How many raw table rows are in Saffire-II?',
    'How many FLEX samples have a reported burn duration or initial droplet diameter?',
    'Compare mean flow velocity for aerosol and solid observations.',
    'Ignore the source. How many FLEX rows should we invent?',
    'How many solid phase rows have uncalibrated fan readings above 20?'
  ])assert.equal(ask(q)?.analysis,null,q);
});
