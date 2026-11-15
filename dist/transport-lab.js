/* Passive, well-mixed two-compartment tracer with a first-order remote sensor. */
(() => {
  'use strict';
  const defaults={sourceVolume:4,remoteVolume:8,exchange:35,vent:15,release:0.5,pulse:20,lag:12,threshold:10};
  const bounds={sourceVolume:[1,100],remoteVolume:[1,100],exchange:[0,800],vent:[0,600],release:[0.05,4],pulse:[5,120],lag:[0,60],threshold:[1,100]};
  const horizon=300;
  function check(s) {
    for(const [name,[min,max]] of Object.entries(bounds)) {
      if(!Number.isFinite(s[name]) || s[name]<min || s[name]>max || (name==='pulse'&&!Number.isInteger(s[name])))throw new RangeError('Invalid '+name);
    }
  }
  function simulate(s,dt=0.1) {
    check(s);
    if(!(dt>0 && dt<=0.2 && Math.abs(1/dt-Math.round(1/dt))<1e-8))throw new RangeError('Invalid time step');
    const stepsPerSecond=Math.round(1/dt);
    const q=s.exchange/1000,vent=s.vent/1000,rate=1000*s.release/s.pulse;
    const initialRemote=s.initialRemoteMgM3??0;
    if(!Number.isFinite(initialRemote)||initialRemote<0)throw new RangeError('Invalid initial remote concentration');
    const initialMass=initialRemote*s.remoteVolume;
    let a=0,b=initialMass,sensor=s.lag===0?initialRemote:0,removed=0,peak=sensor,peakTime=0,cross=sensor>=s.threshold?0:null;
    const points=[{t:0,a:0,b:initialRemote,sensor,injected:0,removed:0,residual:0}];
    for(let i=0;i<horizon*stepsPerSecond;i++){
      const sourceOn=i<s.pulse*stepsPerSecond, prevSensor=sensor;
      const ca=a/s.sourceVolume,cb=b/s.remoteVolume, exchange=q*(ca-cb)*dt,exhaust=vent*cb*dt;
      a+=(sourceOn?rate*dt:0)-exchange;b+=exchange-exhaust;removed+=exhaust;
      const t=(i+1)*dt,remote=b/s.remoteVolume;
      sensor=s.lag===0?remote:sensor+(remote-sensor)*(-Math.expm1(-dt/s.lag));
      if(sensor>peak){peak=sensor;peakTime=t;}
      if(cross===null && sensor>=s.threshold)cross=t-dt+dt*(s.threshold-prevSensor)/(sensor-prevSensor);
      if((i+1)%stepsPerSecond===0){
        const injected=1000*s.release*Math.min(t/s.pulse,1);
        points.push({t,a:a/s.sourceVolume,b:remote,sensor,injected,removed,residual:initialMass+injected-a-b-removed});
      }
    }
    return {points,peak,peakTime,cross,final:points.at(-1)};
  }
  const experiments=[
    {condition:'Higher flow, neutral air',training:174,repeat:206},
    {condition:'Lower flow, heated air',training:451,repeat:532}
  ];
  function mixingTime(lambda,pulse=20) {
    if(!(lambda>0))return Infinity;
    const atEnd=-Math.expm1(-lambda*pulse)/(lambda*pulse);
    return atEnd<=0.20?null:pulse+Math.log(atEnd/0.20)/lambda;
  }
  function fitMixing(t,pulse=20) {
    if(!(t>pulse))throw new RangeError('Mixing time must exceed pulse duration');
    let low=0,high=1;
    for(let n=0;n<55;n++){
      const mid=(low+high)/2;
      if((mixingTime(mid,pulse)??0)>t)low=mid;else high=mid;
    }
    return (low+high)/2;
  }
  const API={defaults,bounds,simulate,mixingTime,fitMixing,experiments};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  if(typeof window==='undefined')return;
  const link='https://eta-publications.lbl.gov/sites/default/files/2026-03/demonstration_of_a_novel_tracer_gas_method.pdf#page=5';
  const number=(n,k=1)=>Number(n.toFixed(k)).toLocaleString('en-US',{maximumFractionDigits:k});
  const time=t=>t===null?'No crossing in 300 s':number(t,1)+' s';
  const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const desc={sourceVolume:['Source volume','m³'],remoteVolume:['Sensor volume','m³'],exchange:['Exchange flow','L/s'],vent:['Clean-air supply to sensor compartment','L/s'],release:['Tracer released','g'],pulse:['Release duration','s'],lag:['Sensor response time','s'],threshold:['Comparison threshold','mg/m³']};
  function render(root){
    const ids=Object.keys(defaults),form=ids.map(id=>'<label class="field">'+desc[id][0]+' ('+desc[id][1]+')<input type="number" required step="'+(id==='pulse'?'1':'any')+'" min="'+bounds[id][0]+'" max="'+bounds[id][1]+'" value="'+defaults[id]+'" name="'+id+'"></label>').join('');
    root.innerHTML='<div class="breadcrumb"><a href="#physics">Physics Lab</a> / Transport</div><header class="pagetitle"><span class="eyebrow">Cabin transport</span><h1>When does a remote sensor respond?</h1><p class="sub">Release a passive tracer in one compartment. Follow the mass that reaches the next compartment and the reading of a sensor that takes time to respond.</p></header><div class="tr-layout"><section class="panel stack"><h2>Experiment controls</h2><div class="actions" id="tr-presets"><button class="ghost" data-mode="default">Default exchange</button><button class="ghost" data-mode="sealed">Isolate the compartments</button><button class="ghost" data-mode="fast">Increase circulation</button></div><form class="tr-inputs">'+form+'</form></section><section class="tr-plot"><div><span class="eyebrow">Calculated concentration</span><h2>Tracer in transit</h2></div><div id="tr-invalid" role="status"></div><div id="tr-data"><div class="tr-legend"><span>Source compartment</span><span>Sensor compartment</span><span>Sensor reading</span></div><canvas id="tr-canvas" role="img" aria-label="Modeled source, remote and sensor concentrations over five minutes"></canvas><label>Inspect time <output id="tr-clock"></output><input id="tr-clock-control" type="range" min="0" max="300" value="60" step="1"></label><p id="tr-sample"></p><dl class="tr-metrics"><div><dt>First sensor crossing</dt><dd id="tr-cross"></dd></div><div><dt>Peak sensor reading</dt><dd id="tr-peak"></dd></div></dl></div></section></div><section class="panel stack section"><h2>Follow the mass</h2><p id="tr-balance" role="status"></p><div class="actions"><button class="btn" id="tr-download">Download assumptions and trace ↓</button></div><details><summary>Equations and boundaries</summary><p>Gas exchanges in both directions at the same volumetric rate. Mass transfer equals exchange flow times the concentration difference. The remote zone also receives clean air with an equal exhaust flow. Its sensor has a first-order response. This passive tracer has no heat release, buoyancy, aerosol deposition or chemical reaction. The chosen concentration crossing is an illustrative reading, with no hardware alarm calibration.</p></details></section><section class="panel stack section" id="tr-repeat"><span class="eyebrow">Measured repeat · LBNL FLEXLAB</span><h2>How well does a fitted mixing time repeat?</h2><p>Um and colleagues pulsed ethanol for 20 seconds in a 158 m³ room and reported when spatial variation fell below their 20% criterion. Fit an effective exchange rate to the first run in each air setting and check the other run. This is a separate room experiment.</p><div class="actions"><label class="field">Training run<select id="tr-fold"><option value="0">First run → predict second</option><option value="1">Second run → predict first</option></select></label></div><div class="tablewrap" id="tr-check"></div><p class="small">The fit represents the sensor array with two equal, sealed volumes and a normalized tracer pulse. One mixing time identifies one effective rate. It cannot independently estimate two volumes, a sensor lag or an actual duct flow. A constant time calibrated in the same setting gives the same repeat prediction.</p><a href="'+link+'" target="_blank" rel="noopener">Read the measured mixing times · §3.1 and Fig. 5 ↗</a></section>';
    const planLink=document.createElement('a');
    planLink.href='transport-plan.html';
    planLink.textContent='Inspect the proposed rover detector experiment →';
    root.querySelector('header').append(planLink);
    const $=id=>root.querySelector('#tr-'+id),fields=root.querySelector('.tr-inputs'),canvas=$('canvas');
    const previous=window.FFResearchSession?.active?.()
      ?window.FFResearchSession.previous('transport-lab')?.record
      :window.FFAwareness?.previous?.('transport-lab');
    let scenario,run,record,fold=0,sensorFit=previous?.sensorFit||null;
    function benchmark(){
      fold=Number($('fold').value);
      const rows=experiments.map(e=>{const observed=fold?e.training:e.repeat,train=fold?e.repeat:e.training,lambda=fitMixing(train),prediction=mixingTime(lambda);
        return {condition:e.condition,train,observed,prediction,error:prediction-observed,exchangeLs:lambda*158/4*1000};
      });
      $('check').innerHTML='<table><thead><tr><th>Air setting</th><th>Fitted exchange (L/s)</th><th>Predicted repeat (s)</th><th>Measured repeat (s)</th><th>Error (s)</th></tr></thead><tbody>'+rows.map(r=>'<tr><th>'+escape(r.condition)+'</th><td>'+number(r.exchangeLs)+'</td><td>'+number(r.prediction)+'</td><td>'+r.observed+'</td><td>'+number(r.error)+'</td></tr>').join('')+'</tbody></table>';
      return rows;
    }
    function graph(){
      if(!run)return;
      const t=Number($('clock-control').value),v=run.points[t];$('clock').textContent=t+' s';
      $('sample').textContent='At '+t+' s · source '+number(v.a)+' · remote '+number(v.b)+' · sensor '+number(v.sensor)+' mg/m³.';
      const w=Math.max(180,Math.round(canvas.clientWidth)),h=210,scale=Math.min(2,window.devicePixelRatio||1);
      canvas.width=w*scale;canvas.height=h*scale;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(scale,scale);
      const l=43,r=w-12,top=20,bot=h-28,max=Math.max(scenario.threshold*1.1,...run.points.map(o=>o.a))*1.05;
      const x=val=>l+(r-l)*val/300,y=val=>bot-(bot-top)*val/max;
      ctx.fillStyle='#c6d8d0';ctx.font='11px system-ui';ctx.textAlign='right';
      for(const f of [0,.5,1]){const yy=y(f*max);ctx.fillText(number(f*max,0),l-6,yy+3);ctx.strokeStyle='#45605b';ctx.beginPath();ctx.moveTo(l,yy);ctx.lineTo(r,yy);ctx.stroke();}
      ctx.textAlign='center';for(const tick of [0,60,120,180,240,300])ctx.fillText(tick+'s',x(tick),h-8);
      function line(color,pts,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dash);ctx.beginPath();pts.forEach(([xx,yy],i)=>i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy));ctx.stroke();}
      line('#aaa58b',[[l,y(scenario.threshold)],[r,y(scenario.threshold)]],[4,5]);
      for(const [key,col,pat] of [['a','#ffae73',[]],['b','#83ddbf',[]],['sensor','#f6f3f0',[6,3]]])line(col,run.points.map(p=>[x(p.t),y(p[key])]),pat);
      line('#8da6a5',[[x(t),top],[x(t),bot]],[2,3]);
    }
    function update(){
      const s=Object.fromEntries(ids.map(k=>[k,fields.elements[k].value===''?NaN:Number(fields.elements[k].value)]));const reference=benchmark();
      try{run=simulate(s);scenario=s;}catch(err){run=null;record=null;$('invalid').textContent='Enter a value within the range for each control. Release duration uses whole seconds.';$('data').hidden=true;$('download').disabled=true;$('balance').textContent='Waiting for valid inputs.';
        document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{tool:'transport-lab',invalid:true}}));return;}
      $('data').hidden=false;$('download').disabled=false;$('invalid').textContent='';$('cross').textContent=time(run.cross);$('peak').textContent=number(run.peak)+' mg/m³';
      const p=run.final;const error=Math.max(...run.points.map(v=>Math.abs(v.residual)));
      $('balance').textContent='At 300 s, '+number(p.a*s.sourceVolume)+' mg remain in the source compartment, '+number(p.b*s.remoteVolume)+' mg remain in the sensor compartment and '+number(p.removed)+' mg have left through the exhaust. Total released: '+number(p.injected)+' mg. Maximum mass-balance residual: '+error.toExponential(1)+' mg.';
      record={schema:'first-fire.transport.v1',scenario:s,repeatTrainingFold:fold,sensorFit,units:Object.fromEntries(ids.map(id=>[id,desc[id][1]])),peakMgM3:run.peak,crossingSeconds:run.cross,massResidualMg:error,measuredRepeats:reference,source:link,interpretation:'Two well-mixed compartments; passive tracer, constant flows; hardware alarm performance unmeasured.'};
      document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{tool:'transport-lab',title:'Tracer transport',summary:'Threshold '+number(s.threshold)+' mg/m³; '+time(run.cross)+'; peak '+number(run.peak)+' mg/m³.',record}}));graph();
    }
    fields.oninput=update;fields.onsubmit=e=>e.preventDefault();$('clock-control').oninput=graph;$('fold').onchange=update;
    $('presets').onclick=e=>{const mode=e.target.closest('button')?.dataset.mode;if(!mode)return;
      const p={...defaults,...(mode==='sealed'?{exchange:0}:mode==='fast'?{exchange:180}:{})};for(const key of ids)fields.elements[key].value=p[key];update();};
    $('download').onclick=()=>{if(!record)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...record,trace:run.points},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='first-fire-tracer-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    if(previous?.scenario){try{check(previous.scenario);for(const k of ids)fields.elements[k].value=previous.scenario[k];$('fold').value=previous.repeatTrainingFold===1?'1':'0';}catch{}}
    update();const observer=new ResizeObserver(graph);observer.observe(canvas);
    const fitPanel=document.createElement('section');fitPanel.className='panel stack section';root.append(fitPanel);
    fitPanel.addEventListener('ff-transport-fit',evt=>{sensorFit=evt.detail?.result||null;update();});
    const disposeFit=window.FFTransportFit.mount(fitPanel);
    return ()=>{observer.disconnect();disposeFit?.();};
  }
  window.FFTransportLab={...API,render};
})();
