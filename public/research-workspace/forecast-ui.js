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
  function modelPercent(p) {
    // A normal threshold has tails beyond every finite starting atmosphere.
    return p>.9999?'>99.99%':p<.0001?'<0.01%':percent(p);
  }
  function chart(m,s,xs,selected) {
    const X=x=>50+510*(x-20)/20,Y=p=>170-140*p;
    const path=Array.from({length:161},(_,i)=>{const x=20+i/8;return (i?'L':'M')+X(x).toFixed(2)+' '+Y(probability(x,m,s)).toFixed(2);}).join(' ');
    return '<svg role="img" aria-label="Model probability of sustained spread at starting oxygen from 20 to 40 percent. Exact values for the four burns are in the following table." viewBox="0 0 590 210" style="width:100%;height:auto;display:block"><title>Probability of sustained spread versus starting oxygen</title>'+
      [0,.5,1].map(p=>'<line x1="50" x2="560" y1="'+Y(p)+'" y2="'+Y(p)+'" stroke="#c8ccc6"/><text class="chartlab" x="44" y="'+(Y(p)+4)+'" text-anchor="end">'+(p*100)+'%</text>').join('')+
      [20,25,30,35,40].map(x=>'<text class="chartlab" x="'+X(x)+'" y="187" text-anchor="middle">'+x+'%</text>').join('')+
      '<path d="'+path+'" fill="none" stroke="#12655f" stroke-width="3"/>'+
      xs.map((x,i)=>{const p=probability(x,m,s);return (x===selected?'<circle cx="'+X(x)+'" cy="'+Y(p)+'" r="9" fill="none" stroke="#12655f" stroke-width="2"/>':'')+'<circle cx="'+X(x)+'" cy="'+Y(p)+'" r="5.5" fill="#a53713" stroke="white" stroke-width="2"><title>Burn '+(i+1)+': '+x+'% O₂, '+escape(modelPercent(p))+' probability</title></circle>';}).join('')+
      '<text class="chartlab" x="305" y="205" text-anchor="middle">Starting oxygen by volume (%)</text></svg>';
  }
  const referenceLength=(oxygen,limit)=>Math.min(20,Math.max(0,2.5*(oxygen-limit)));
  function snapshot(data,m,s,ys) {
    const xs=data.burns.map(b=>b.oxygen_pct), ps=xs.map(x=>probability(x,m,s)),bs=data.burns.map(b=>b.baseline_p_sustain);
    return {version:1,type:'first_fire_fm2_local_scenario',evidence_as_of:data.as_of,
      status:'illustrative_unregistered',actual_outcomes:xs.map(()=>null),actual_score:null,
      material:data.mission.material,pressure_psia:data.mission.pressure_psia,gravity_earth_g:data.mission.gravity_earth_g,
      model:{mu_o2_pct:m,sigma_pp:s,interval80_o2_pct:[m-s*Z80,m+s*Z80],event:data.model.event,assumption:data.model.assumption},
      burns:data.burns.map((b,i)=>({id:b.id,oxygen_pct:b.oxygen_pct,p_sustain:ps[i],nasa_expectation:b.nasa_expectation,guide_comparator:bs[i],reference_length_cm:referenceLength(b.oxygen_pct,m),hypothetical_outcome:ys[i]})),
      hypothetical_scores:{model:score(ps,ys),guide_comparator:score(bs,ys)},hypothetical_next_experiment:design(xs,ys,m,s),
      sources:data.sources.map(({title,url,locator})=>({title,url,locator})),
      comparator_basis:data.scoring.baseline_label,verification:'Local scenario only. A checksum identifies the exported bytes; it supplies neither a public timestamp nor publication.'};
  }
  function download(name,text) {
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');
    link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function illustrationPanel(data) {
    const source=data.sources.find(s=>s.id==='lpsc-slides');
    const radios=data.burns.map((burn,i)=>
      '<label><input type="radio" name="fm-oxygen" value="'+burn.oxygen_pct+'" aria-label="Burn '+burn.id+', '+burn.oxygen_pct+' percent oxygen"'+(i===data.burns.length-1?' checked':'')+'><span>'+burn.oxygen_pct+'%</span></label>'
    ).join('');
    return '<section class="panel fm-response" id="fm-spread-panel" aria-labelledby="fm-spread-heading">'+
      '<header><span class="eyebrow">Model response</span><h2 id="fm-spread-heading">After the igniter switches off</h2></header>'+
      '<fieldset class="fm-atmosphere"><legend>Starting oxygen</legend><div>'+radios+'</div></fieldset>'+
      '<p id="fm-spread-empty" class="note" hidden>Enter valid threshold assumptions to view the two examples.</p>'+
      '<div id="fm-spread-result"><div class="fm-chance"><strong id="fm-spread-chance"></strong><span>chance of sustained spread</span></div>'+
      '<div class="fm-probability-bar" aria-hidden="true"><i></i></div>'+
      '<figure class="fm-figure"><div class="fm-example-head">'+
      '<div><span>Lower assumed limit</span><b id="fm-limit-low"></b></div><div><span>Higher assumed limit</span><b id="fm-limit-high"></b></div></div>'+
      '<canvas id="fm-spread-canvas" aria-hidden="true"></canvas>'+
      '<div class="fm-example-outcomes"><strong id="fm-spread-low"></strong><strong id="fm-spread-high"></strong></div>'+
      '<div class="fm-playback"><span id="fm-wire-state"></span><button id="fm-spread-play" type="button">Play ignition</button></div>'+
      '<figcaption>Each strip uses one end of your central 80% interval. The probability uses the full distribution. A brief flame that dies out illustrates one way spread can fail. Flame shape and timing are illustrative.</figcaption></figure></div>'+
      '<span class="sr-only" id="fm-spread-summary" role="status"></span>'+
      '<p class="fm-source">The planned test heats a 2 × 20 cm strip of Synergy Pro Navy fabric from below at 8.2 psia.'+
      (source?' <a href="'+escape(source.url)+'#page=10" target="_blank" rel="noopener noreferrer">NASA test design ↗</a>':'')+'</p></section>';
  }
  function mountIllustration(root) {
    const get=id=>root.querySelector('#'+id);
    const result=get('fm-spread-result'), play=get('fm-spread-play'), wire=get('fm-wire-state');
    const scene=window.FFSpreadScene.mount(get('fm-spread-canvas'));
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const wireOff=window.FFSpreadScene.wireOff;
    let examples=[false,false], progress=1, frame=0, valid=false;
    function display(value) {
      progress=value;
      scene.draw(progress,examples);
      const powered=progress<wireOff;
      if(wire.dataset.powered!==String(powered)){
        wire.dataset.powered=String(powered);
        wire.textContent=powered?'Igniter on':'Igniter off';
      }
    }
    function stop() {
      cancelAnimationFrame(frame);
      frame=0;
    }
    function label() {
      if(motion.matches) play.textContent=progress===1?'Show ignition':'Switch off igniter';
      else play.textContent=frame?'Pause':progress===1?'Play ignition':'Resume';
    }
    function finish() {
      stop();
      if(valid)display(1);
      label();
    }
    play.onclick=()=>{
      if(!valid)return;
      if(motion.matches){
        display(progress===1?wireOff*.8:1);
      }else if(frame){
        stop();
      }else{
        if(progress===1)display(0);
        const start=performance.now()-progress*5200;
        const tick=now=>{
          display(Math.min(1,(now-start)/5200));
          if(progress<1)frame=requestAnimationFrame(tick);
          else {frame=0;label();}
        };
        frame=requestAnimationFrame(tick);
      }
      label();
    };
    motion.addEventListener('change',finish);
    function update(burn,interval) {
      stop();
      valid=Boolean(burn);
      result.hidden=!valid;
      get('fm-spread-empty').hidden=valid;
      if(!valid){
        get('fm-spread-summary').textContent='';
        return;
      }
      const chance=modelPercent(burn.p_sustain);
      get('fm-spread-chance').textContent=chance;
      root.querySelector('.fm-probability-bar i').style.width=(burn.p_sustain*100)+'%';
      // Allow round-off when the interval was entered directly and oxygen equals a bound.
      examples=interval.map(limit=>burn.oxygen_pct-limit>Number.EPSILON*Math.max(1,Math.abs(limit))*4);
      const outcomes=examples.map(yes=>yes?'Spread continues':'Spread stops');
      for(const [i,side] of ['low','high'].entries()){
        get('fm-limit-'+side).textContent=interval[i].toFixed(2)+'% O₂';
        const output=get('fm-spread-'+side);
        output.textContent=outcomes[i];
        output.dataset.sustain=String(examples[i]);
      }
      get('fm-spread-summary').textContent='Burn '+burn.id+' at '+burn.oxygen_pct+'% oxygen. Model chance of sustained spread '+chance+'. Lower assumed limit '+interval[0].toFixed(2)+'%, '+outcomes[0]+'. Higher assumed limit '+interval[1].toFixed(2)+'%, '+outcomes[1]+'.';
      display(1);
      label();
    }
    return {update,destroy(){stop();motion.removeEventListener('change',finish);scene.destroy();}};
  }
  function render(root) {
    const data=window.FF?.forecast;
    if(!data||!Array.isArray(data.burns)||data.burns.length!==4){root.textContent='The four-burn forecast record is unavailable.';return;}
    root.innerHTML='<div class="breadcrumb"><a href="#home">Research desk</a><span>/</span>FM² forecast</div>'+
      '<header class="pagetitle"><span class="eyebrow">Prospective case · lunar surface</span><h1>FM² forecast</h1><p class="sub">At what starting oxygen level would flame spread over Synergy Pro Navy fabric after the igniter switches off? Explore four planned lunar tests at 8.2 psia.</p></header>'+
      '<section class="panel fm-lock"><span class="eyebrow">The Oracle · Forecast v1</span><h2>The fixed forecast</h2><p>Code Blooded fixed the oxygen limit at 26% with a standard deviation of 1.5 percentage points. The four predictions have a signed timestamp of 14 November 2026 at 12:57:06 UTC. No lunar outcomes have been verified.</p><div class="actions"><a href="forecast-lock/fm2-v1.json" download>Forecast JSON ↓</a><a href="forecast-lock/fm2-v1.tsr" download>Signed timestamp ↓</a></div><details><summary>Verify the forecast fingerprint</summary><p>SHA-256 <code>9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3</code></p><p>Download both files. OpenSSL checks the signed time against a trusted CA bundle and verifies the digest of the exact forecast bytes.</p><pre>openssl ts -verify -data fm2-v1.json -in fm2-v1.tsr -CAfile /etc/ssl/cert.pem</pre><p>Timestamp authority: DigiCert. DOI pending. <a href="forecast-lock/README.txt" download>Verification and repository deposit notes ↓</a></p></details></section>'+
      '<p class="section small">Explore different assumptions below. Each edit creates a local scenario. The signed forecast file stays available above.</p>'+
      '<section class="section grid2 fm-comparison"><div class="panel stack"><div><span class="eyebrow">Threshold model</span><h2>Assumed oxygen limit</h2></div><p>The model assumes all four samples share one uncertain oxygen limit. It treats starting above that limit as sufficient for sustained spread.</p>'+
      '<label class="field">Mean limit (% oxygen)<input id="fm-mean" type="number" min="22" max="30" step="any"><small>Explore 22–30% oxygen by volume.</small></label>'+
      '<label class="field">Spread (percentage points)<input id="fm-sigma" type="number" min="0.5" max="4" step="any"><small>Standard deviation, from 0.5 to 4 percentage points.</small></label>'+
      '<p id="fm-validation" role="status"></p><p id="fm-interval" class="note"></p><details><summary>Set the central 80% interval directly</summary><div class="stack"><div class="grid2"><label class="field">Lower 80% bound (% O₂)<input type="number" step="any" id="fm-lo"></label><label class="field">Upper 80% bound (% O₂)<input type="number" step="any" id="fm-hi"></label></div><button type="button" class="ghost" id="fm-apply">Use these bounds</button><p class="small" role="status" id="fm-bounds-status"></p></div></details><button type="button" id="fm-defaults" class="ghost">Restore worked assumptions</button>'+
      '<figure class="fm-curve"><h3>Chance of sustained spread</h3><div id="fm-chart"></div><figcaption>The ring marks the selected starting atmosphere.</figcaption></figure></div>'+
      illustrationPanel(data)+'</section>'+
      '<section class="section panel"><div class="sectionhead"><div><span class="eyebrow">March 2026 design</span><h2 id="fm-planned-heading">Four planned burns</h2></div></div><div class="tablewrap" role="region" aria-labelledby="fm-planned-heading" tabindex="0"><table><thead><tr><th scope="col">Burn</th><th scope="col">Initial O₂</th><th scope="col">NASA expectation</th><th scope="col">Model probability</th><th scope="col">Guide comparator</th><th scope="col">Travel at mean limit</th></tr></thead><tbody id="fm-burns"></tbody></table></div>'+
      '<p class="small">NASA describes a 14.4 L chamber and up to eight percentage points of oxygen depletion. The deck’s travel scenario assumes a linear eight-point drop over 20 cm. At the mean limit, each point of oxygen above the limit gives 2.5 cm of travel, capped at 20 cm. Zero means no sustained travel in that scenario. The probabilities use the full distribution. NASA supplied qualitative expectations only. The guide supplies the 90/10 comparator. <a href="https://ntrs.nasa.gov/api/citations/20260001966/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conf%202026%20v2.pdf#page=14" target="_blank" rel="noopener noreferrer">NASA depletion assumption, p. 14 ↗</a></p></section>'+
      '<section class="section panel stack"><div><span class="eyebrow">What if?</span><h2>Score hypothetical outcomes</h2></div><p>Yes means sustained spread after nominal ignition power ends. No includes a valid attempt with no ignition or no sustained spread. Mark an aborted, faulty or ambiguous test void.</p><div class="fmgrid" id="fm-choices"></div><div id="fm-scores" class="note" role="status"></div><p class="small">Smaller Brier scores are better. Both predictors are scored against the same resolved burns. Four tests of the same material cannot establish calibration.</p></section>'+
      '<section class="section panel stack"><div><span class="eyebrow">Design a follow-up</span><h2>Choose the next oxygen test</h2></div><p>Hold material, pressure, gravity, geometry and ignition protocol fixed. Among 22–30% oxygen in half-point steps, choose the extra test that would teach the most about the common threshold.</p><div id="fm-design" role="status"></div><div class="actions"><a class="btn" href="#design-lab">Plan an adaptive experiment →</a></div></section>'+
      '<section class="section grid2"><div class="panel stack"><span class="eyebrow">Local copy</span><h2>Export this scenario</h2><p>The JSON records your assumptions, probabilities, and simulated outcomes. All four actual observations remain empty. A local checksum can identify this exact file later.</p><div class="actions"><button id="fm-export" type="button" class="btn">Download scenario JSON</button></div><p class="small" id="fm-digest" role="status"></p></div>'+
      '<div class="panel stack"><span class="eyebrow">Evidence</span><h2>Sources and experiment status</h2><p id="fm-status"></p><details><summary>Read source records</summary><div id="fm-sources"></div></details></div></section>';
    const burnTable = root.querySelector('[aria-labelledby="fm-planned-heading"]');
    burnTable.addEventListener('keydown', event => {
      if (event.target !== burnTable || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const distance = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -48], ArrowDown: [0, 48] }[event.key];
      if (!distance) return;
      const left = burnTable.scrollLeft, top = burnTable.scrollTop;
      burnTable.scrollLeft += distance[0];
      burnTable.scrollTop += distance[1];
      if (burnTable.scrollLeft !== left || burnTable.scrollTop !== top) event.preventDefault();
    });
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
    const illustration=mountIllustration(get('fm-spread-panel'));
    const selectedOxygen=()=>Number(root.querySelector('[name="fm-oxygen"]:checked').value);
    function updateResponse() {
      if(!active){illustration.update(null);return;}
      const oxygen=selectedOxygen(), burn=active.burns.find(b=>b.oxygen_pct===oxygen);
      illustration.update(burn,active.model.interval80_o2_pct);
      get('fm-chart').innerHTML=chart(active.model.mu_o2_pct,active.model.sigma_pp,active.burns.map(b=>b.oxygen_pct),oxygen);
    }
    root.querySelector('.fm-atmosphere').onchange=updateResponse;
    function refresh(){
      revision++;detail.textContent='';
      const m=mean.valueAsNumber,s=sigma.valueAsNumber,valid=Number.isFinite(m)&&Number.isFinite(s)&&m>=22&&m<=30&&s>=.5&&s<=4;
      mean.setAttribute('aria-invalid',String(!Number.isFinite(m)||m<22||m>30));sigma.setAttribute('aria-invalid',String(!Number.isFinite(s)||s<.5||s>4));
      get('fm-export').disabled=!valid;
      if(!valid){
        active=null;get('fm-validation').textContent='Enter a mean from 22 to 30 and a spread from 0.5 to 4 to calculate the scenario.';
        ['fm-chart','fm-interval','fm-burns','fm-scores','fm-design'].forEach(id=>get(id).replaceChildren());updateResponse();return;
      }
      get('fm-validation').textContent='';active=snapshot(data,m,s,ys);
      const [lo,hi]=active.model.interval80_o2_pct;
      get('fm-lo').value=Number(lo.toFixed(5));get('fm-hi').value=Number(hi.toFixed(5));get('fm-bounds-status').textContent='';
      get('fm-interval').textContent='Central 80% model interval: '+lo.toFixed(2)+'–'+hi.toFixed(2)+'% oxygen. NASA’s expected limit is 24–26%; it did not assign that range an 80% probability.';
      updateResponse();
      get('fm-burns').innerHTML=active.burns.map(b=>'<tr><th scope="row">'+b.id+'</th><td>'+b.oxygen_pct+'%</td><td>'+escape(b.nasa_expectation)+'</td><td><strong>'+escape(modelPercent(b.p_sustain))+'</strong></td><td>'+escape(percent(b.guide_comparator))+'</td><td>'+Number(b.reference_length_cm.toFixed(2))+' cm</td></tr>').join('');
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
      mean.value=m;sigma.value=s;refresh();
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
    return illustration.destroy;
  }
  if(typeof module!=='undefined' && module.exports)module.exports={probability,score,design,snapshot,percent,referenceLength};
  if(typeof window!=='undefined'){window.renderForecast=render;window.FFForecastMath={probability,modelPercent};}
})();
