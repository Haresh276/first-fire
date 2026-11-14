const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../site/explorer.js'),'utf8'),context);
const coverage=context.window.FFJointCoverage;
const oxygenOnly={o2_initial_pct:'34',gravity_g:'0',pressure_psia:'14.7'};
const pressureOnly={o2_initial_pct:'21',gravity_g:'0',pressure_psia:'8.2'};

test('a condition envelope cannot manufacture a joint observation from different rows',()=>{
  const result=coverage([oxygenOnly,pressureOnly],[0,34,8.2]);
  assert.equal(result.complete,2);assert.equal(result.matches.length,0);
});

test('matches local ambient ranges and excludes missing pressure, inverse burner O₂ and different gravity',()=>{
  const valid={gravity_g:'0',o2_low_pct:'32',o2_high_pct:'35',pressure_psia:'8.2'};
  const rows=[valid,{...valid,pressure_psia:''},{gravity_g:'0',o2_burner_pct:'34',pressure_psia:'8.2'},{...valid,gravity_g:'0.165'}];
  const result=coverage(rows,[0,34,8.2]);
  assert.equal(result.complete,2);assert.equal(result.matches.length,1);assert.equal(result.matches[0],valid);
});
