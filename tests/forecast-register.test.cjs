const assert=require('node:assert/strict'),test=require('node:test');
const {trials,validate,score}=require('../site/forecast-register.js');
test('preserve matched trial indices and coverage for partial outcomes',()=>{
  const rows=trials('alpha,0.8,0.5\nbeta,1,0\ngamma,0.2,0.3');
  const s=score(rows,['yes','void','no']);
  assert.equal(s.resolved,2);assert.ok(Math.abs(s.modelBrier-.04)<1e-12);
  assert.ok(Math.abs(s.comparatorBrier-.17)<1e-12);
  assert.equal(score(rows,['pending','void','pending']).modelBrier,null);
  assert.throws(()=>score(rows,['yes']));
});
test('validate loaded forecast types, bounds and unique trial IDs',()=>{
  const doc={schema:'first-fire.material-forecast.v1',material:'test',source:'fixture',event:'unit test',trials:trials('A,0.8,0.2')};
  assert.equal(validate(doc),doc);
  for(const lines of ['A,,0','A,1.1,0','A,0,0\nA,1,1','A,Infinity,0'])assert.throws(()=>trials(lines));
  assert.throws(()=>validate({...doc,trials:[{id:'a',probability:'0.4',comparator:0.5}]}));
});
