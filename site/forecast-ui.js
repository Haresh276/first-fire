/* Interactive FM² teaching model. Calculations run locally, without writing observations. */
(() => {
  'use strict';
  const Z80 = 1.2815515655446004;
  const outcomes = ['pending','yes','no','void'];
  const labels = ['Pending','Yes · sustained spread','No · no sustained spread','Void · unusable test'];
  const grid = Array.from({length:17},(_,i)=>22+i/2);
  const escape = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent = p => p===0?'0%':p===1?'100%':p>.9999?'>99.99%':p<.0001?'<0.01%':(100*p).toFixed(2).replace(/\.?0+$/,'')+'%';
  // Complementary normal tail using the erfc approximation of Numerical Recipes.
  function tail(z) {
    if(z===Infinity)return 0;
    if(z===0)return .5;
    const x=Math.abs(z)/Math.SQRT2, t=1/(1+.5*x);
    const poly=1.00002368+t*(.37409196+t*(.09678418+t*(-.18628806+t*(.27886807+t*(-1.13520398+t*(1.48851587+t*(-.82215223+t*.17087277)))))));
    const upper=.5*t*Math.exp(-x*x-1.26551223+t*poly);
    return z>=0?upper:1-upper;
  }
  const probability=(x,m,s)=>tail((m-x)/s);
  function mass(a,b,m,s) {
    if(b<=a)return 0;
    if(a>=m)return Math.max(0,tail((a-m)/s)-tail((b-m)/s));
    return Math.max(0,probability(b,m,s)-probability(a,m,s));
  }
  function entropy(ps) { return -ps.reduce((sum,p)=>sum+(p>0?p*Math.log2(p):0),0); }
  function score(ps, ys) {
    const errors=ys.map((y,i)=>y==='yes'||y==='no'?(ps[i]-Number(y==='yes'))**2:null);
    const resolved=errors.filter(v=>v!==null);
    const mean=resolved.length?resolved.reduce((a,b)=>a+b,0)/resolved.length:null;
    return {per_burn:errors,n_resolved:resolved.length,resolved_mean:mean,full_four_burn_score:resolved.length===4?mean:null};
  }
  function design(xs,ys,m,s) {
    const lower=Math.max(-Infinity,...xs.filter((x,i)=>ys[i]==='no')),upper=Math.min(Infinity,...xs.filter((x,i)=>ys[i]==='yes'));
    const limits={at_least_o2_pct:Number.isFinite(lower)?lower:null,below_o2_pct:Number.isFinite(upper)?upper:null};
    if(lower>=upper)return {state:'contradiction',limits};
    const denominator=mass(lower,upper,m,s);
    if(denominator<=0)return {state:'numerical_limit',limits};
    const candidates=grid.map(oxygen_pct=>{
      let p=oxygen_pct<=lower?0:oxygen_pct>=upper?1:Math.min(1,Math.max(0,mass(lower,oxygen_pct,m,s)/denominator));
      return {oxygen_pct,p_sustain:p,information_bits:entropy([p,1-p])};
    });
    const best=candidates.reduce((a,b)=>a.information_bits>=b.information_bits?a:b);
    if(best.information_bits===0)return {state:'grid_uninformative',limits,candidates};
    let pair=null;
    for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
      const a=candidates[i],b=candidates[j], p=a.p_sustain, q=b.p_sustain;
      const h=entropy([p,Math.max(0,q-p),1-q]);
      if(!pair||h>pair.joint_information_bits)pair={oxygen_pct:[a.oxygen_pct,b.oxygen_pct],joint_information_bits:h};
    }
    return {state:'available',limits,best,pair,candidates};
  }
  function chart(m,s,xs) {
    const X=x=>50+510*(x-20)/20,Y=p=>170-140*p;
    const path=Array.from({length:161},(_,i)=>{const x=20+i/8;return (i?'L':'M')+X(x).toFixed(2)+' '+Y(probability(x,m,s)).toFixed(2);}).join(' ');
    return '<svg role="img" aria-label="Model probability of sustained spread at starting oxygen from 20 to 40 percent. Exact values for the four burns are in the following table." viewBox="0 0 590 210" style="width:100%;height:auto;display:block"><title>Probability of sustained spread versus starting oxygen</title>'+
      [0,.5,1].map(p=>'<line x1="50" x2="560" y1="'+Y(p)+'" y2="'+Y(p)+'" stroke="#c8ccc6"/><text class="chartlab" x="44" y="'+(Y(p)+4)+'" text-anchor="end">'+(p*100)+'%</text>').join('')+
      [20,25,30,35,40].map(x=>'<text class="chartlab" x="'+X(x)+'" y="187" text-anchor="middle">'+x+'%</text>').join('')+
      '<path d="'+path+'" fill="none" stroke="#12655f" stroke-width="3"/>'+
      xs.map((x,i)=>{const p=probability(x,m,s);return '<circle cx="'+X(x)+'" cy="'+Y(p)+'" r="5.5" fill="#a53713" stroke="white" stroke-width="2"><title>Burn '+(i+1)+': '+x+'% O₂, '+escape(percent(p))+' probability</title></circle>';}).join('')+
      '<text class="chartlab" x="305" y="205" text-anchor="middle">Starting oxygen by volume (%)</text></svg>';
  }
  function snapshot(data,m,s,ys) {
    const xs=data.burns.map(b=>b.oxygen_pct), ps=xs.map(x=>probability(x,m,s)),bs=data.burns.map(b=>b.baseline_p_sustain);
    return {version:1,type:'first_fire_fm2_local_scenario',evidence_as_of:data.as_of,
      status:'illustrative_unregistered',actual_outcomes:xs.map(()=>null),actual_score:null,
      material:data.mission.material,pressure_psia:data.mission.pressure_psia,gravity_earth_g:data.mission.gravity_earth_g,
      model:{mu_o2_pct:m,sigma_pp:s,interval80_o2_pct:[m-s*Z80,m+s*Z80],event:data.model.event,assumption:data.model.assumption},
      burns:data.burns.map((b,i)=>({id:b.id,oxygen_pct:b.oxygen_pct,p_sustain:ps[i],nasa_expectation:b.nasa_expectation,guide_comparator:bs[i],hypothetical_outcome:ys[i]})),
      hypothetical_scores:{model:score(ps,ys),guide_comparator:score(bs,ys)},hypothetical_next_experiment:design(xs,ys,m,s),
      sources:data.sources.map(({title,url,locator})=>({title,url,locator})),
      comparator_basis:data.scoring.baseline_label,verification:'Local scenario only. A checksum identifies the exported bytes; it supplies neither a public timestamp nor publication.'};
  }
  function download(name,text) {
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function render(root) {
    const data=window.FF?.forecast;
    if(!data||!Array.isArray(data.burns)||data.burns.length!==4){root.textContent='The four-burn forecast record is unavailable.';return;}
    root.innerHTML='<div class="breadcrumb"><a href="#home">Research desk</a><span>/</span>FM² forecast</div>'+
      '<header class="pagetitle"><span class="eyebrow">Prospective case · lunar surface</span><h1>FM² forecast</h1><p class="sub">At what starting oxygen level would flame spread over Synergy Pro Navy fabric after the igniter switches off? Explore four planned lunar tests at 8.2 psia.</p></header>'+
      '<div class="callout"><strong>Illustrative model · no observed score.</strong> NASA describes a planned experiment and qualitative expectations. The probabilities below come from the assumptions you choose.</div>'+
      '<section class="section grid2"><div class="panel stack"><span class="eyebrow">Threshold model</span><h2>Assumed oxygen limit</h2><p>The model assumes all four samples share one uncertain oxygen limit. It treats starting above that limit as sufficient for sustained spread.</p>'+
      '<label class="field">Mean limit (% oxygen)<input id="fm-mean" type="number" min="22" max="30" step="any"><small>Explore 22–30% oxygen by volume.</small></label>'+
      '<label class="field">Spread (percentage points)<input id="fm-sigma" type="number" min="0.5" max="4" step="any"><small>Standard deviation, from 0.5 to 4 percentage points.</small></label>'+
      '<p id="fm-validation" role="status"></p><p id="fm-interval" class="note"></p><details><summary>Set the central 80% interval directly</summary><div class="stack"><div class="grid2"><label class="field">Lower 80% bound (% O₂)<input type="number" step="any" id="fm-lo"></label><label class="field">Upper 80% bound (% O₂)<input type="number" step="any" id="fm-hi"></label></div><button type="button" class="ghost" id="fm-apply">Use these bounds</button><p class="small" role="status" id="fm-bounds-status"></p></div></details><button type="button" id="fm-defaults" class="ghost">Restore worked assumptions</button></div>'+
      '<div class="panel stack"><span class="eyebrow">Model response</span><h2>Chance of sustained spread</h2><div id="fm-chart"></div><p class="small">Dots mark the four planned starting atmospheres. A curve near 100% reflects the assumed threshold distribution, without evidence of certainty from the Moon.</p></div></section>'+
      '<section class="section panel"><div class="sectionhead"><div><span class="eyebrow">March 2026 design</span><h2>Four planned burns</h2></div></div><div class="tablewrap"><table><thead><tr><th scope="col">Burn</th><th scope="col">Initial O₂</th><th scope="col">NASA expectation</th><th scope="col">Model probability</th><th scope="col">Illustrative comparator</th></tr></thead><tbody id="fm-burns"></tbody></table></div>'+
      '<p class="small">The learner guide’s worked example uses 90% or 10% for an illustrative comparator. NASA published qualitative expectations only; team adoption of the example has not been established. Ignition and sustained spread are different endpoints.</p></section>'+
      '<section class="section panel stack"><div><span class="eyebrow">What if?</span><h2>Score hypothetical outcomes</h2></div><p>Yes means sustained spread after nominal ignition power ends. No includes a valid attempt with no ignition or no sustained spread. Mark an aborted, faulty or ambiguous test void.</p><div class="fmgrid" id="fm-choices"></div><div id="fm-scores" class="note" role="status"></div><p class="small">Smaller Brier scores are better. Both predictors are scored against the same resolved burns. Four tests of the same material cannot establish calibration.</p></section>'+
      '<section class="section panel stack"><div><span class="eyebrow">Design a follow-up</span><h2>Choose the next oxygen test</h2></div><p>Hold material, pressure, gravity, geometry and ignition protocol fixed. Among 22–30% oxygen in half-point steps, choose the extra test that would teach the most about the common threshold.</p><div id="fm-design" role="status"></div></section>'+
      '<section class="section grid2"><div class="panel stack"><span class="eyebrow">Local copy</span><h2>Export this scenario</h2><p>The JSON records your assumptions, probabilities, and simulated outcomes. All four actual observations remain empty. A local checksum can identify this exact file later.</p><div class="actions"><button id="fm-export" type="button" class="btn">Download scenario JSON</button></div><p class="small" id="fm-digest" role="status"></p></div>'+
      '<div class="panel stack"><span class="eyebrow">Evidence</span><h2>Sources and experiment status</h2><p id="fm-status"></p><details><summary>Read source records</summary><div id="fm-sources"></div></details></div></section>';
    const get=id=>root.querySelector('#'+id), mean=get('fm-mean'),sigma=get('fm-sigma'), detail=get('fm-digest');
    mean.value=data.model.mu_o2_pct;sigma.value=data.model.sigma_pp;
    const ys=Array(4).fill('pending'), choices=get('fm-choices');
    choices.innerHTML=data.burns.map((b,i)=>'<label class="fmburn field"><span>Burn '+b.id+' · '+b.oxygen_pct+'% O₂</span><select aria-label="Hypothetical burn '+b.id+' outcome" data-index="'+i+'">'+outcomes.map((v,i)=>'<option value="'+v+'">'+labels[i]+'</option>').join('')+'</select></label>').join('');
    get('fm-status').textContent='Evidence checked '+data.as_of+'. '+data.mission.schedule+' No lunar burn result is recorded in this edition.';
    const sources=get('fm-sources');
    for(const source of data.sources){
      const div=document.createElement('div');div.className='sourceitem';
      const label=document.createElement(source.url&&/^https?:\/\//.test(source.url)?'a':'strong');
      label.textContent=source.title;if(label.tagName==='A'){label.href=source.url;label.target='_blank';label.rel='noopener noreferrer';}const small=document.createElement('small');small.textContent=source.locator;div.append(label,small);sources.append(div);
    }
    let active=null,revision=0;
    function refresh(){
      revision++;detail.textContent='';
      const m=mean.valueAsNumber,s=sigma.valueAsNumber,valid=Number.isFinite(m)&&Number.isFinite(s)&&m>=22&&m<=30&&s>=.5&&s<=4;
      mean.setAttribute('aria-invalid',String(!Number.isFinite(m)||m<22||m>30));sigma.setAttribute('aria-invalid',String(!Number.isFinite(s)||s<.5||s>4));
      get('fm-export').disabled=!valid;
      if(!valid){
        active=null;get('fm-validation').textContent='Enter a mean from 22 to 30 and a spread from 0.5 to 4 to calculate the scenario.';
        ['fm-chart','fm-interval','fm-burns','fm-scores','fm-design'].forEach(id=>get(id).replaceChildren());return;
      }
      get('fm-validation').textContent='';active=snapshot(data,m,s,ys);
      const xs=data.burns.map(b=>b.oxygen_pct), [lo,hi]=active.model.interval80_o2_pct;
      get('fm-lo').value=Number(lo.toFixed(5));get('fm-hi').value=Number(hi.toFixed(5));get('fm-bounds-status').textContent='';
      get('fm-interval').textContent='Central 80% model interval: '+lo.toFixed(2)+'–'+hi.toFixed(2)+'% oxygen. NASA’s expected limit is 24–26%; it did not assign that range an 80% probability.';
      get('fm-chart').innerHTML=chart(m,s,xs);
      get('fm-burns').innerHTML=active.burns.map(b=>'<tr><th scope="row">'+b.id+'</th><td>'+b.oxygen_pct+'%</td><td>'+escape(b.nasa_expectation)+'</td><td><strong>'+escape(percent(b.p_sustain))+'</strong></td><td>'+escape(percent(b.guide_comparator))+'</td></tr>').join('');
      const sc=active.hypothetical_scores, a=sc.model,b=sc.guide_comparator, pending=ys.filter(y=>y==='pending').length, voids=ys.filter(y=>y==='void').length;
      get('fm-scores').textContent=a.n_resolved===0?'No hypothetical score. 0/4 resolved · '+pending+' pending · '+voids+' void.':
        (a.n_resolved===4?'Full four-burn hypothetical Brier score':'Partial hypothetical Brier score')+': model '+a.resolved_mean.toFixed(4)+' · comparator '+b.resolved_mean.toFixed(4)+' · '+a.n_resolved+'/4 resolved · '+pending+' pending · '+voids+' void.';
      const next=active.hypothetical_next_experiment,box=get('fm-design');
      if(next.state==='contradiction'){box.innerHTML='<p class="note">These outcomes contradict a single common threshold: a lower-oxygen sample sustained spread while a higher-oxygen one did not. No conditional design is defined. The hypothetical Brier scores above remain valid.</p>';return;}
      if(next.state!=='available'){box.innerHTML='<p class="note">No informative oxygen choice is available on this model grid. Reconsider the candidate range or the threshold assumption.</p>';return;}
      const limit=next.limits,bracket=[limit.at_least_o2_pct!==null?'at least '+limit.at_least_o2_pct+'%':null,limit.below_o2_pct!==null?'below '+limit.below_o2_pct+'%':null].filter(Boolean).join(' and ');
      box.innerHTML='<div class="grid2"><div class="fmburn"><span class="eyebrow">One additional test</span><h3>'+next.best.oxygen_pct+'% O₂</h3><p>'+next.best.information_bits.toFixed(3)+' bits · '+escape(percent(next.best.p_sustain))+' conditional probability of sustained spread.</p></div><div class="fmburn"><span class="eyebrow">Two tests fixed in advance</span><h3>'+next.pair.oxygen_pct.join('% and ')+'% O₂</h3><p>'+next.pair.joint_information_bits.toFixed(3)+' joint bits across the two tests. They share the same threshold.</p></div></div><p class="small">'+(bracket?'Hypothetical threshold '+bracket+'. The design conditions on your yes/no outcomes only.':'Based on the unconditioned scenario; no yes/no outcomes have been entered.')+' Equal information favors the first candidate in ascending oxygen order.</p>';
    }
    mean.oninput=sigma.oninput=refresh;choices.onchange=e=>{if(e.target.tagName==='SELECT'){ys[Number(e.target.dataset.index)]=e.target.value;refresh();}};
    get('fm-apply').onclick=()=>{
      const lo=get('fm-lo').valueAsNumber,hi=get('fm-hi').valueAsNumber;
      const m=(lo+hi)/2,s=(hi-lo)/(2*Z80);
      if(!Number.isFinite(m)||!Number.isFinite(s)||m<22||m>30||s<.5||s>4){
        get('fm-bounds-status').textContent='Enter increasing bounds with a midpoint from 22 to 30 and an implied spread from 0.5 to 4.';return;
      }
      mean.value=Number(m.toFixed(8));sigma.value=Number(s.toFixed(8));refresh();
    };
    get('fm-defaults').onclick=()=>{mean.value=data.model.mu_o2_pct;sigma.value=data.model.sigma_pp;refresh();};
    get('fm-export').onclick=async()=>{
      if(!active)return;const bytes=JSON.stringify(active,null,2)+'\n',version=revision;
      download('first-fire-fm2-scenario.json',bytes);
      try{
        const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bytes));
        if(version===revision)detail.textContent='SHA-256 of downloaded JSON: '+[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')+'. This checksum has no external timestamp.';
      }catch{if(version===revision)detail.textContent='The scenario was exported. This browser context does not provide SHA-256.';}
    };
    refresh();
  }
  if(typeof module!=='undefined' && module.exports)module.exports={probability,score,design,snapshot,percent};
  if(typeof window!=='undefined')window.renderForecast=render;
})();
