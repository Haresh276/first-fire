const {test}=require('node:test');
const assert=require('node:assert/strict');
const src=require('../data/forecast.json');
const {snapshot,probability,score,design}=require('../site/forecast-ui.js');
const targets=src.burns.map(b=>b.oxygen_pct);
const almost=(v,expected,eps=1e-7)=>assert.ok(Math.abs(v-expected)<eps,v+' versus '+expected);
test('browser calculation agrees with full-precision Python artifact across default, sensitivity and grid cases',()=>{
  const a=snapshot(src,26,1.5,Array(4).fill('pending'));
  a.burns.forEach((b,i)=>almost(b.p_sustain,src.burns[i].p_sustain));
  src.sensitivity.forEach(row=>almost(probability(25,row.mu_o2_pct,row.sigma_pp),row.p_burn4));
  a.hypothetical_next_experiment.candidates.forEach((row,i)=>almost(row.information_bits,src.next_experiment.candidates[i].information_bits));
  almost(a.hypothetical_next_experiment.pair.joint_information_bits,src.next_experiment.best_fixed_pair.joint_information_bits);
  assert.deepEqual(a.actual_outcomes,[null,null,null,null]);assert.equal(a.actual_score,null);
});
test('hypothetical answers update the conditional design and leave science records unresolved',()=>{
  const a=snapshot(src,26,1.5,['yes','yes','yes','no']);
  almost(a.hypothetical_scores.model.full_four_burn_score,src.scoring.hypothetical_examples[0].model.full_four_burn_score);
  assert.equal(a.hypothetical_next_experiment.best.oxygen_pct,26.5);
  assert.deepEqual(a.hypothetical_next_experiment.limits,{at_least_o2_pct:25,below_o2_pct:29});
  assert.equal(design(targets,['no','pending','yes','void'],26,1.5).state,'contradiction');
  assert.equal(design(targets,['no','pending','pending','void'],26,1.5).state,'grid_uninformative');
  assert.equal(score([.9,.9,.9,.1],['pending','void','yes','no']).n_resolved,2);
  assert.equal(score([.9,.9,.9,.1],['pending','void','yes','no']).full_four_burn_score,null);
  assert.deepEqual(a.actual_outcomes,[null,null,null,null]);assert.ok(src.burns.every(r=>r.outcome===null));
});
