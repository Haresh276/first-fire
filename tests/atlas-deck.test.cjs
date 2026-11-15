const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {indexArchive,scopeOf,investigationResult}=require('../site/atlas-deck.js');
const project=path.resolve(__dirname,'..');
const data={window:{}};
for (const bundle of ['records.js','observation-rows.js']) {
  vm.runInNewContext(fs.readFileSync(path.join(project,'dist',bundle),'utf8'),data);
}
const {studies,rows}=indexArchive(data.window.FF);

test('every nonempty deck source record is addressable, in its original versioned table',()=>{
  assert.equal(studies.length,15);
  assert.equal(studies.flatMap(s=>s.tables).length,16);
  assert.equal(rows.length,1622);
  assert.equal(new Set(rows.map(r=>r.id)).size,1622);
  assert.equal(rows.filter(r=>r.obs).length,1058);
  for(const study of studies){
    assert.equal(study.license,'CC0-1.0');
    for(const t of study.tables){
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(project,t.file))).digest('hex'),t.sha256);
    }
  }
  for(const r of rows) {
    assert.equal(r.cells,data.window.FF.rawTables[r.table.file][r.csvRow-1]);
    assert.ok(r.cells.some(cell=>cell.trim()));
  }
});
test('source exclusions retain their literal meaning and stay reachable',()=>{
  assert.equal(rows.filter(r=>r.kind==='Repeated source record').length,8);
  assert.equal(rows.filter(r=>r.kind==='Table note').length,4);
  assert.equal(rows.filter(r=>r.kind==='Maintenance').length,1);
  assert.equal(rows.filter(r=>r.kind==='Burner setting').length,469);
  assert.equal(rows.filter(r=>r.kind==='Candidate conditions').length,8);
  assert.equal(rows.filter(r=>r.study.accession==='PSI-159'&&r.obs.direction==='inverse').length,154);
  for(const r of rows.filter(r=>r.obs?.direction==='inverse')){
    assert(r.lo===null && r.hi===null && r.bucket==='other');
    assert.equal(scopeOf(r),'Burner O₂ only');
  }
  const interval=rows.find(r=>r.lo!==null && r.lo!==r.hi);
  assert.equal(interval.bucket,'range');
  assert.match(scopeOf(interval),/–/);
  assert(rows.filter(r=>r.bucket==='high').every(r=>r.lo===r.hi && r.lo>=30));
});

const {compareRecords}=require('../site/atlas-deck.js');
const row=id=>rows.find(r=>r.id===id);
const dimension=(comparison,id)=>comparison.fields.find(f=>f.id===id);
test('investigation records preserve source identity and distinguish a burner feed from a chamber measurement',()=>{
  const original=row('PSI-159:2:2'),result=investigationResult(original),saved=result.record;
  assert.equal(result.tool,'atlas');
  assert.equal(saved.id,'PSI-159:2:2');
  assert.equal(saved.sourceRow,2);
  assert.equal(saved.doi,original.study.doi);
  assert.equal(saved.sourceFile,original.table.file);
  assert.equal(saved.sourceURL,original.table.url);
  assert.equal(saved.conditions['Chamber O₂'],null);
  assert.match(saved.conditions['Burner O₂'],/21% at burner inlet/);
  assert.match(saved.endpoint,/Burn time 0 s/);
  const settings=investigationResult(row('PSI-107:1:2')).record;
  assert.equal(settings.endpoint,null);
  assert.match(settings.boundary,/Burner setting.*no individual normalized observation/);
});
test('a normal and inverse flame carry oxygen at different physical locations',()=>{
  const result=compareRecords(row('PSI-159:1:2'),row('PSI-159:2:2'));
  assert.match(result.interpretation,/burner feed/);
  assert.match(dimension(result,'ambient').left,/39.39%/);
  assert.equal(dimension(result,'ambient').right,undefined);
  assert.match(dimension(result,'burner').right,/21% at burner/);
  assert.match(dimension(result,'flow').right,/mg\/s/);
  assert.equal(dimension(result,'material').status,'Same entry');
  assert.match(dimension(result,'endpoint').right,/Burn time 0 s/);
});
test('preserves compound specimen identity, approximate O2, qualitative duration and missing pressure',()=>{
  const result=compareRecords(row('PSI-99:1:3'),row('PSI-99:1:8'));
  assert.match(dimension(result,'material').right,/PMMA & Nomex/);
  assert.match(dimension(result,'geometry').right,/0\.85 and 0\.37 mm/);
  assert.match(dimension(result,'endpoint').left,/Insignificant/);
  assert.match(dimension(result,'endpoint').right,/140 s.*note 2/);
  assert.match(dimension(result,'ambient').right,/approx/);
  assert.equal(dimension(result,'pressure').status,'Incomplete');
});
test('distinguishes smoke-source preparation, uncalibrated displays and standalone source settings',()=>{
  const result=compareRecords(row('PSI-101:1:2'),row('PSI-25:1:2'));
  assert.match(result.interpretation,/detector measurement/);
  assert.match(dimension(result,'flow').left,/Smoke-source inlet/);
  assert.match(dimension(result,'flow').right,/Fan display 62/);
  assert.match(dimension(result,'endpoint').left,/Smoke heating 60 s/);
  assert.equal(dimension(result,'endpoint').right,undefined);
  const raw=compareRecords(row('PSI-107:1:2'),row('PSI-159:1:2'));
  assert.match(raw.interpretation,/no individual observation/);
  assert.equal(dimension(raw,'endpoint').left,undefined);
  assert.equal(dimension(raw,'type').left,'Burner setting');
});
