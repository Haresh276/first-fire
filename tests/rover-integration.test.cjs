const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {pathToFileURL} = require('node:url');
const root=path.resolve(__dirname,'..');
require('../dist/rover-model.js');
const {buildRecord}=require('../site/rover-integration.js');
const {FFRoverData:data, FFRoverModel:model}=globalThis;

test('the portable script reproduces the source module for every reference scenario',async()=>{
  const sourcePath=path.join(root,'rover-design/prototype/model.mjs');
  const native=await import(pathToFileURL(sourcePath).href);
  assert.equal(data.modelSHA256, createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'));
  for(const scenario of Object.values(data.examples)){
    const {tool,record}=buildRecord(scenario,data,model);
    assert.equal(tool,'rover-design');
    assert.equal(record.kind,'simulated');
    assert.deepEqual(record.result,native.simulate(scenario,data.catalog,data.schema));
    assert.deepEqual(record.sources.map(s=>s.id),record.result.sourceIds);
    assert.ok(record.sources.every(s=>s.url.startsWith('https:') && s.locator));
    assert.deepEqual(record.scenario,scenario);
    assert.notEqual(record.scenario,scenario);
  }
});

test('material-only comparison preserves assumptions, withheld endpoints and gas inventory',()=>{
  const base=data.examples['lunar-cellulose'], swap=model.selectPart(base,'material','pe',data.catalog);
  const a=buildRecord(base,data,model).record.result, b=buildRecord(swap,data,model).record.result;
  assert.deepEqual(buildRecord(swap,data,model).record.comparison.changedInputs.map(x=>x.field),['parts.material']);
  assert.deepEqual(a.air,b.air);
  assert.equal(a.flow.spreadRateMmS,null);assert.equal(b.suppression.extinction,null);
  assert.ok(b.coupon.netChemicalPotentialKJ>a.coupon.netChemicalPotentialKJ);
  const open=model.selectPart(swap,'cabin','open-deck',data.catalog);
  assert.equal(buildRecord(open,data,model).record.result.air,null);
  assert.throws(()=>buildRecord({...base,conditions:{...base.conditions,volumeM3:NaN}},data,model),/volumeM3/);
});
