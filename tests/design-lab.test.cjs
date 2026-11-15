const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze,defaultSettings:defaults,importRecord,scenarioRecord}=require('../site/design-lab.js');
const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance, a+' vs '+b);
const result=(oxygen,result)=>({oxygen,result});
const H=ws=>ws.reduce((sum,w)=>w>0?sum-w*Math.log2(w):sum,0);
test('reproduces the continuous prior and computes a two-burn adaptive policy in bits',()=>{
  const m=analyze(defaults);
  close(m.summary.median,26);close(m.summary.interval80[0],24.0776726516831,0.001);
  close(m.forecasts[3].prior,0.25249253754692297,0.0001);
  assert.equal(m.best.oxygen,26);
  close(m.best.utility,1-H([0.95,0.05]));
  assert.equal(m.best.branches.yes.oxygen,25);assert.equal(m.best.branches.no.oxygen,27);
  assert.ok(m.best.total>m.best.utility && m.best.total<2);
  // Check via entropy of the discretized parameter itself, independent of binary MI formula.
  const conditional=analyze({...defaults,horizon:1},[result(26,'yes')]);
  const other=analyze({...defaults,horizon:1},[result(26,'no')]);
  close(m.best.utility,H(m.prior.weights)-0.5*(H(conditional.posterior.weights)+H(other.posterior.weights)));
  close(m.best.total,m.best.utility+0.5*(conditional.best.utility+other.best.utility));
});
test('goal at a planned burn selects a different test and matches expected Brier risk reduction',()=>{
  const s={...defaults,horizon:1,objective:'burn',target:25};const m=analyze(s);
  assert.equal(m.best.oxygen,25);
  for(const c of m.choices){
    const p=m.posterior.below(25), risk=x=>x*(1-x);
    const py=analyze(s,[result(c.oxygen,'yes')]).posterior.below(25);
    const pn=analyze(s,[result(c.oxygen,'no')]).posterior.below(25);
    close(c.utility,risk(p)-c.yes*risk(py)-c.no*risk(pn));
  }
});
test('likelihood supports noisy repeats and flags deterministic contradictions',()=>{
  const trials=[result(25,'yes'),result(25,'no')];
  const m=analyze(defaults,trials);close(m.summary.median,26);
  assert.equal(analyze({...defaults,error:0},trials).conflict,true);
  const yes=analyze({...defaults,error:0,horizon:1,low:25,high:25},[trials[0]]);
  assert.equal(yes.best,null);
  close(yes.forecasts[3].posterior,1);
  const single=analyze({...defaults,horizon:2,low:25,high:25});
  assert.equal(single.best.branches.yes.oxygen,25);assert.equal(single.best.branches.no.oxygen,25);
  const reverse=analyze(defaults,trials.slice().reverse());close(reverse.summary.mean,m.summary.mean);
});
test('intercept malformed records and reconstruct outputs without trusting imported results',()=>{
  const history=[result(26,'yes'),result(25,'no')];const m=analyze(defaults,history);
  const exportData=scenarioRecord(defaults,history,m);assert.deepEqual(exportData.official_outcomes,[null,null,null,null]);
  exportData.result.posterior.mean=1000;
  const input=importRecord(JSON.parse(JSON.stringify(exportData)));const rebuilt=analyze(input.settings,input.history);
  assert.ok(rebuilt.summary.mean<26);assert.equal(rebuilt.best.oxygen,m.best.oxygen);
  assert.throws(()=>importRecord({...exportData,kind:'observed'}));
  assert.throws(()=>analyze({...defaults,low:29,high:25}));
  assert.throws(()=>analyze({...defaults,error:-1}));
  assert.throws(()=>analyze(defaults,[result(23.77,'yes')]));
  assert.throws(()=>analyze(defaults,Array(41).fill(result(26,'yes'))));
});
test('restricted ranges and unlikely histories yield finite predictions or negligible gain',()=>{
  const s={...defaults,mean:22,spread:0.5,low:39,high:40,error:0};
  const m=analyze(s,[result(37,'no')]);
  assert.equal(m.conflict,false);assert.ok(m.summary.interval80[0]>=37);assert.ok(m.summary.mean>37);
  assert.equal(m.best,null);assert.equal(m.forecasts.find(b=>b.oxygen===37).posterior,0);
  const p=analyze({...defaults,error:2},Array(40).fill(result(40,'no')));
  assert.ok(Number.isFinite(p.summary.mean));assert.ok(p.choices.every(c=>c.total>=0&&Number.isFinite(c.total)));
});
