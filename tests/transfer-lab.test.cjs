const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{}};
for(const relative of ['dist/records.js','dist/observation-rows.js','site/transfer-lab.js']){
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8'),ctx);
}
const api=ctx.window.FFTransferLab, data=ctx.window.FF, records=api.prepare(data.tests), protocol=api.defaults;
const study=data.investigations.find(s=>s.accession==='PSI-69');
const ids=pairs=>Array.from(pairs,({a,b})=>[a.test,b.test]);
test('reroutes a match when greedy pairing loses coverage and minimizes cost at maximum size',()=>{
  const rows=['A','B'],cols=['X','Y'];
  const solve=matrix=>api.assign(rows,cols,(a,b)=>matrix[rows.indexOf(a)][cols.indexOf(b)]).pairs;
  const selections=pairs=>Array.from(pairs,({a,b})=>a+b);
  assert.deepEqual(selections(solve([[0,1],[0,null]])),['AY','BX']);
  assert.deepEqual(selections(solve([[1,2],[2,12]])),['AY','BX']);
  assert.deepEqual(selections(solve([[0,null],[null,null]])),['AX']);
});
test('pairing ignores all post-ignition outcomes and never reuses a run',()=>{
  const before=api.match(records,protocol);
  const swapped=data.tests.map(row=>({...row,outcome:'Invented',burn_time_s:'9999',visible_extinction_diameter_mm:''})).reverse();
  const after=api.match(api.prepare(swapped),protocol);
  assert.deepEqual(ids(before.pairs),[['65','202'],['66','6'],['67','34']]);
  assert.deepEqual(ids(after.pairs),ids(before.pairs));
  assert.equal(new Set(Array.from(before.pairs,({a,b})=>[a.run,b.run]).flat()).size,6);
  assert.ok(Math.abs(api.measure(before.pairs,'time').average-1.6)<1e-10);
  assert.equal(api.match(records,{...protocol,sameDay:true}).pairs.length,0);
  assert.equal(api.match(records,{...protocol,gravity:0.165}).pairs.length,0);
  const days=api.byDate(records,protocol,'time');
  assert.ok(days.some(x=>x.pairs===0));
  assert.ok(days.some(x=>x.pairs>0));
});
test('a pressure contrast holds oxygen fixed and can change which termination endpoint is usable',()=>{
  const p={...protocol,exposure:'pressure',low:10.4,high:14.7,held:30};
  const r=api.match(records,p);
  assert.deepEqual(ids(r.pairs),[['25','29'],['26','44'],['41','30']]);
  const time=api.measure(r.pairs,'time'),diam=api.measure(r.pairs,'diameter');
  assert.equal(time.sameEnd,2);
  assert.equal(time.n,3);
  assert.ok(diam.n<time.n);
  for(const {a,b} of r.pairs)assert.ok(a.oxygen===30 && b.oxygen===30);
});
test('rejects ambiguous exposure arms, missing pressure and duplicate instrument identifiers',()=>{
  assert.throws(()=>api.checked({...protocol,low:20.5}),/overlap/);
  const sample=data.tests.filter(x=>x.accession==='PSI-69').find(x=>x.test_id==='65');
  const compare=data.tests.filter(x=>x.accession==='PSI-69').find(x=>x.test_id==='202');
  const broken=[{...sample,pressure_psia:''},{...compare,instrument_id:'dup'}, {...compare,record_id:'extra',instrument_id:'dup'}];
  const result=api.match(api.prepare(broken),protocol);assert.equal(result.pairs.length,0);assert.equal(result.counts.measured,0);
  const over={...compare,nitrogen_initial_pct:'99'};
  assert.equal(api.match(api.prepare([sample,over]),protocol).high.length,0);
});
test('masked export includes verified locators and omits outcomes until reveal, then records date sensitivity',()=>{
  const r=api.match(records,protocol);
  const blinded=api.exportRecord(records,study,protocol,r,'time',false);
  assert.equal(blinded.pairs[0].A.source_row,66);assert.equal(blinded.pairs[0].A.table_sha256,study.tables[0].sha256);
  assert.equal(blinded.pairs[0].B.doi,'10.60555/mbq8-0451');
  assert.ok(!('observed' in blinded) && !('observed' in blinded.pairs[0].A));
  const opened=api.exportRecord(records,study,protocol,r,'time',true);
  assert.equal(opened.observed.n,3);assert.ok(opened.day_sensitivity.length>0);assert.ok(opened.pairs[0].A.observed.ending);
});
