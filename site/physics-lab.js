// Closed-cabin teaching model. SI internally; UI fuel properties use a dry repeat unit.
(() => {
  'use strict';

  const R = 8.31446261815324;
  const T0 = 300;
  const horizon = 120;
  const interval = 2;
  const fuels = {
    cellulose: {name:'Cellulose', formula:'C₆H₁₀O₅', carbon:6, hydrogen:10, oxygen:5, heat:15.2},
    polyethylene: {name:'Polyethylene', formula:'CH₂', carbon:1, hydrogen:2, oxygen:0, heat:43.4}
  };
  const loadings = {coupon:0.05, stress:2};
  const ranges = {
    volume:[1,60], pressure:[30,110], oxygen:[10,40], cutoff:[5,30], length:[10,100],
    density:[loadings.coupon,10], speed:[0,2], chassisMass:[100,5000], capacity:[0,2000], power:[0,3000]
  };
  const defaults = {
    planet:'Moon', fuel:'cellulose', volume:12, pressure:56.54, oxygen:34, cutoff:18, length:40,
    density:loadings.stress, speed:0.3, chassisMass:800, capacity:20, power:0
  };
  const gravity = {Moon:1.62, Mars:3.71};
  const trainingDomain = {
    volume:[4,30], pressure:[50,105], oxygen:[21,37], cutoff:[15,20],
    length:[20,60], density:[0.5,5], speed:[0.03,0.65]
  };
  function validate(s) {
    if (!Object.hasOwn(fuels,s.fuel) || !Object.hasOwn(gravity,s.planet)) return 'Choose a listed material and surface.';
    for (const [key,[lo,hi]] of Object.entries(ranges)) {
      if (!Number.isFinite(s[key]) || s[key]<lo || s[key]>hi) return 'Enter a '+key+' value from '+lo+' to '+hi+'.';
    }
    return null;
  }
  function chemistry(fuelKey) {
    const f=fuels[fuelKey];
    const molarMass=f.carbon*12.011+f.hydrogen*1.008+f.oxygen*15.999;
    const oxygen=f.carbon+f.hydrogen/4-f.oxygen/2;
    const water=f.hydrogen/2;
    return {molarMass,oxygen,water,carbon:f.carbon,deltaMoles:f.carbon+water-oxygen,heat:f.heat};
  }
  // NASA7 Cp/R polynomial coefficients in GRI-Mech 3.0 as shipped by Cantera.
  // The first five terms suffice for sensible enthalpy differences within each region.
  const cp = {
    N2:[[3.298677,.0014082404,-3.963222e-6,5.641515e-9,-2.444854e-12],
        [2.92664,.0014879768,-5.68476e-7,1.0097038e-10,-6.753351e-15]],
    CO2:[[2.35677352,.00898459677,-7.12356269e-6,2.45919022e-9,-1.43699548e-13],
         [3.85746029,.00441437026,-2.21481404e-6,5.23490188e-10,-4.72084164e-14]],
    H2O:[[4.19864056,-.00203643410,6.52040211e-6,-5.48797062e-9,1.77197817e-12],
         [3.03399249,.00217691804,-1.64072518e-7,-9.7041987e-11,1.68200992e-14]]
  };
  function sensible(species,T) {
    function integral(a,low,high) {
      return R*a.reduce((sum,k,i)=>sum+k*(high**(i+1)-low**(i+1))/(i+1),0);
    }
    return integral(cp[species][0],T0,Math.min(1000,T))+(T>1000?integral(cp[species][1],1000,T):0);
  }
  function flameTemperature(oxygenPct, fuelKey) {
    if (!Object.hasOwn(fuels,fuelKey) || !(oxygenPct>0 && oxygenPct<=100)) throw RangeError('Invalid reactants');
    const c=chemistry(fuelKey);
    const nitrogen=c.oxygen*(100/oxygenPct-1);
    const released=c.heat*1000*c.molarMass;
    const energy=T=>c.carbon*sensible('CO2',T)+c.water*sensible('H2O',T)+nitrogen*sensible('N2',T);
    let lo=T0,hi=3500;
    if (energy(hi)<released) return {kelvin:null,above:hi};
    for(let i=0;i<45;i++){
      const m=(lo+hi)/2;
      if(energy(m)<released) lo=m; else hi=m;
    }
    return {kelvin:(lo+hi)/2,above:null};
  }
  function atTime(s,t) {
    const err=validate(s);
    if(err || !Number.isFinite(t) || t<0 || t>horizon) throw RangeError(err || 'Time must be between 0 and 120 seconds.');
    const c=chemistry(s.fuel);
    const initialMoles=s.pressure*1000*s.volume/(R*T0);
    const initialOxygen=initialMoles*s.oxygen/100;
    const cutoff=s.cutoff/100;
    const oxygenLimited=Math.max(0,(initialOxygen-cutoff*initialMoles)/(c.oxygen+cutoff*c.deltaMoles));
    const available=s.length*s.density/c.molarMass;
    const demand=t*s.speed*s.density/c.molarMass;
    const extent=Math.min(available,demand,oxygenLimited);
    const burned=extent*c.molarMass;
    const gasMoles=initialMoles+c.deltaMoles*extent;
    const electrical=Math.min(s.capacity*3.6,s.power*t/1000);
    return {
      time:t, oxygen:100*(initialOxygen-extent*c.oxygen)/gasMoles,
      co2:100*extent*c.carbon/gasMoles, water:100*extent*c.water/gasMoles,
      burned, position:burned/s.density, chemical:burned*c.heat, electrical,
      energy:burned*c.heat+electrical,
      state:oxygenLimited<=Math.min(available,demand)?'Oxygen cutoff':available<=demand?'End of strip':s.speed>0?'Prescribed spread':'Front stationary'
    };
  }
  function run(s) {
    const trace=Array.from({length:horizon/interval+1},(_,i)=>atTime(s,i*interval));
    return {trace,final:trace[trace.length-1],flame:flameTemperature(s.oxygen,s.fuel),
      chassisWeight:s.chassisMass*gravity[s.planet], buoyancy:Math.sqrt(gravity[s.planet]*0.2*0.5)};
  }
  function liquidInputs(s) {
    const c=chemistry(s.fuel);
    const inventory=s.pressure*1000*s.volume/(R*T0);
    return [
      (s.oxygen-29)/8, (s.cutoff-17.5)/2.5,
      Math.log1p(s.density*s.length*c.oxygen*100/(c.molarMass*inventory))/2-1,
      Math.log1p(s.density*s.speed*horizon*c.oxygen*100/(c.molarMass*inventory))/2-1,
      s.fuel==='cellulose'?1:-1
    ];
  }
  // Liquid reservoir with fixed, seeded recurrent weights and a fitted linear readout.
  // Exponential step for a neuron with a conductance held constant over one sample.
  function liquidStep(model,inputs,prev,time) {
    const x=[...inputs,time/horizon];
    return model.cells.map(cell=>{
      let voltage=cell.bias;
      for(let i=0;i<x.length;i++) voltage+=cell.input[i]*x[i];
      voltage+=cell.feedback*prev[cell.source];
      const gate=1/(1+Math.exp(-voltage));
      const conductance=cell.leak+cell.gain*gate;
      const target=cell.reversal*cell.gain*gate/conductance;
      return target+(prev[cell.index]-target)*Math.exp(-conductance*interval);
    });
  }
  function inTrainingDomain(s) {
    return Object.entries(trainingDomain).every(([key,[low,high]])=>s[key]>=low && s[key]<=high);
  }
  function liquidPrediction(s,model) {
    if(!model || !inTrainingDomain(s))return null;
    const inputs=liquidInputs(s);
    let state=model.cells.map(()=>0);
    const result=[s.oxygen];
    for(let t=interval;t<=horizon;t+=interval) {
      state=liquidStep(model,inputs,state,t);
      const features=[1,...inputs,t/horizon,...state];
      const drop=features.reduce((sum,feature,i)=>sum+feature*model.weights[i],0);
      result.push(s.oxygen-Math.min(Math.max(0,s.oxygen-s.cutoff),Math.max(0,drop)));
    }
    return result;
  }
  // Saffire-I SIBAL spread rates in NASA NTRS 20170008805, slide 21.
  const saffireSpeeds={concurrent:1.8,opposed:1.3};
  function compareReferenceSpeeds(s,t) {
    return Object.fromEntries(Object.entries(saffireSpeeds).map(([direction,mmPerSecond])=>[
      direction,atTime({...s,speed:mmPerSecond/10},t)
    ]));
  }
  const api={saffireSpeeds,compareReferenceSpeeds,defaults,ranges,loadings,trainingDomain,inTrainingDomain,fuels,gravity,horizon,interval,validate,chemistry,atTime,run,flameTemperature,liquidInputs,liquidStep,liquidPrediction};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  if(typeof window!=='undefined') window.FFPhysics=api;
})();

(() => {
  'use strict';
  if(typeof window==='undefined')return;
  const physics=window.FFPhysics;
  const storeKey='first-fire.rover.v1';
  const parts={
    cabin:{jaxa:'JAXA-inspired pressurized cabin',pod:'Compact research pod',custom:'My cabin'},
    chassis:{ltv:'NASA LTV-inspired chassis',utility:'Utility chassis',custom:'My chassis'},
    pack:{passive:'Unpowered pack',test:'Electrical test pack',custom:'My pack'}
  };
  const presets={
    jaxa:{volume:12},pod:{volume:4},ltv:{chassisMass:800},utility:{chassisMass:1300},
    passive:{capacity:20,power:0},test:{capacity:50,power:300}
  };
  const fmt=(number,digits=2)=>number.toLocaleString('en-US',{maximumFractionDigits:digits});
  function field(id,label,value,unit,step='any') {
    const [min,max]=physics.ranges[id];
    return '<label>'+label+'<span class="pl-input"><input name="'+id+'" type="number" step="'+step+'" min="'+min+'" max="'+max+'" value="'+value+'" required><span>'+unit+'</span></span></label>';
  }
  function select(name,label,options,value) {
    return '<label>'+label+'<select name="'+name+'">'+Object.entries(options).map(([key,text])=>'<option value="'+key+'"'+(value===key?' selected':'')+'>'+text+'</option>').join('')+'</select></label>';
  }
  function partPicker(key,title,initial) {
    return '<div>'+select(key,title,parts[key],initial)+'<label class="pl-custom" hidden>'+title+' name<input name="'+key+'Name" maxlength="46" placeholder="Custom '+key+'"></label></div>';
  }
  function metric(label,id,unit){
    return '<div><span>'+label+'</span><b id="pl-'+id+'">—</b> <small>'+unit+'</small></div>';
  }
  function chart(canvas,trace,prediction,selected) {
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    const width=Math.max(180,Math.round(canvas.getBoundingClientRect().width));
    const height=177;
    const ratio=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.scale(ratio,ratio);ctx.font='11px system-ui';ctx.fillStyle='#c9d4ce';
    const pad=35,top=12,bottom=145,right=width-14;
    const max=Math.max(10,Math.ceil(Math.max(...trace.map(p=>Math.max(p.oxygen,p.co2)))/10)*10);
    const x=t=>pad+(right-pad)*t/physics.horizon, y=v=>bottom-(bottom-top)*v/max;
    ctx.textAlign='right';
    for(const tick of [0,max/2,max]){
      ctx.fillText(tick+'%',pad-6,y(tick)+3);
      ctx.strokeStyle='#475858';ctx.beginPath();ctx.moveTo(pad,y(tick));ctx.lineTo(right,y(tick));ctx.stroke();
    }
    ctx.textAlign='center';
    for(const t of [0,30,60,90,120])ctx.fillText(t+' s',x(t),bottom+16);
    function line(values,color,dash=[]) {
      ctx.beginPath();ctx.lineWidth=2;ctx.strokeStyle=color;ctx.setLineDash(dash);
      values.forEach((v,i)=>i?ctx.lineTo(x(trace[i].time),y(v)):ctx.moveTo(x(trace[i].time),y(v)));ctx.stroke();
    }
    line(trace.map(p=>p.oxygen),'#83ddbf');
    line(trace.map(p=>p.co2),'#ffae73');
    if(prediction)line(prediction,'#e4d4a4',[4,4]);
    ctx.setLineDash([3,3]);ctx.strokeStyle='#e8eee9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x(selected),top);ctx.lineTo(x(selected),bottom);ctx.stroke();ctx.setLineDash([]);
  }
  function renderPhysicsLab(root,params) {
    const roverMode=params?.get?.('mode')==='rover' || params?.mode==='rover';
    // Existing rover and reference links use the heavier scenario from the original worked example.
    const requested=params?.get?.('reference');
    const d=roverMode || Object.hasOwn(physics.saffireSpeeds,requested)
      ? physics.defaults : {...physics.defaults,density:physics.loadings.coupon};
    root.innerHTML='<div class="pl"><div class="breadcrumb"><a href="#home">Research desk</a><span>/</span>Physics Lab</div>'+
      '<header class="pagetitle"><span class="eyebrow">Physics Lab</span><h1>Inside a sealed cabin</h1><p class="sub">Give a burning strip a fuel, a starting atmosphere and a spread speed. Follow the oxygen it consumes and the heat it releases.</p><p class="sub" style="margin-top:10px;border-left:4px solid #ae411e;padding:8px 12px;background:#fff6f0"><b>What this lab is for:</b> checking, one strip at a time, the cabin bookkeeping behind FIRST FIRE\'s answers. For the challenge question itself, use the <a href="cabin-fire.html">Cabin Fire Simulator</a> (does a rover or habitat fire put itself out before it endangers the crew, and which response works?) or the <a href="material-lab.html">Material Lab</a> (will a new material keep burning on the Moon, on Mars or in orbit?).</p><div class="actions"><a class="ghost" href="cabin-fire.html">Cabin Fire Simulator →</a> <a class="ghost" href="material-lab.html">Material Lab →</a> <a class="ghost" href="#transport-lab">Model a remote sensor →</a></div></header>'+
      '<form id="pl-form"><div class="pl-grid">'+
      '<section class="panel pl-inputs"><h2>Test conditions</h2><div class="pl-fields">'+
      select('planet','Surface',{Moon:'Moon',Mars:'Mars'},'Moon')+
      select('fuel','Strip material',Object.fromEntries(Object.entries(physics.fuels).map(([k,v])=>[k,v.name])),d.fuel)+
      field('oxygen','Starting oxygen',d.oxygen,'%')+field('pressure','Absolute pressure',d.pressure,'kPa')+
      field('volume','Free cabin volume',d.volume,'m³')+field('cutoff','Assumed O₂ cutoff',d.cutoff,'%')+
      field('length','Strip length',d.length,'cm')+field('density','Dry combustible mass per centimetre',d.density,'g/cm')+
      '</div><div class="actions"><button type="button" class="ghost" id="pl-coupon">Thin coupon · 0.05 g/cm</button><button type="button" class="ghost" id="pl-stress">Stress case · 2 g/cm</button></div><p id="pl-inventory" class="pl-aside"></p>'+
      '<details class="pl-details"><summary>Spread and specimen assumptions</summary><div class="pl-fields">'+
      field('speed','Assumed front speed',d.speed,'cm/s')+'</div><p class="small">The thin coupon assumes a 2 cm wide strip with 250 g/m² of combustible material. The stress case concentrates forty times as much fuel per centimetre. For a real specimen, divide its dry combustible mass by its active length and exclude inert backing. Both examples impose the front speed until the strip ends or the assumed oxygen cutoff is reached.</p></details>'+
      '<p class="pl-message" id="pl-message" role="status"></p><button type="button" class="ghost" id="pl-reset">Reset conditions</button></section>'+
      '<section class="pl-readout" aria-labelledby="pl-trace-title"><span class="eyebrow">Sealed-cabin calculation</span><h2 id="pl-trace-title">Cabin gas over time</h2>'+
      '<div id="pl-live-data"><div class="pl-chart-key"><span class="pl-o2">Oxygen</span><span class="pl-co2">Carbon dioxide</span><span id="pl-liquid-key">Liquid model O₂</span></div>'+
      '<canvas id="pl-chart" aria-label="Time series of wet gas percentages. Use the time slider below for exact results." role="img"></canvas>'+
      '<label class="pl-time">Inspect time <output id="pl-clock">120 s</output><input id="pl-time" type="range" aria-label="Elapsed time in seconds" min="0" max="120" step="2" value="120"></label>'+
      '<div class="pl-metrics">'+metric('Oxygen','o2','vol%')+metric('Carbon dioxide','co2','vol%')+metric('Heat released¹','heat','kJ')+metric('Front position','front','cm')+
      '</div><div class="pl-strip" aria-hidden="true"><i id="pl-char"></i></div><p id="pl-fate"></p><p class="pl-qualifier">¹ Cumulative chemical and prescribed electrical energy. Gas fractions include water vapor.</p></div></section></div>'+
      '<section class="panel pl-rover" id="pl-rover" aria-labelledby="pl-rover-title"><div class="pl-vehicle"><img src="rover-concept.png" width="950" height="677" alt="SI-generated concept by Team Code Blooded. A wheeled pressurized rover has a separate cabin and chassis."></div><div><span class="eyebrow">Rover sandbox</span><h2 id="pl-rover-title">Assemble a test vehicle</h2>'+
      '<p>Mix a cabin, a chassis and a battery. Component sizes are editable design assumptions. The NASA LTV concept supplies the open chassis reference and the JAXA concept supplies the pressurized cabin reference.</p>'+
      '<div class="pl-parts">'+partPicker('cabin','Cabin','jaxa')+partPicker('chassis','Chassis','ltv')+partPicker('pack','Battery','passive')+
      '</div><div class="pl-fields">'+field('chassisMass','Chassis mass',d.chassisMass,'kg')+field('capacity','Modeled available energy',d.capacity,'Wh')+field('power','Heat deposited by pack',d.power,'W')+
      '</div><p id="pl-rover-result" class="pl-aside"></p><label class="pl-name">Design name<input name="designName" maxlength="60" value="Cabin trial"></label><div class="actions"><button type="button" class="btn" id="pl-save">Save on this device</button><button type="button" class="ghost" id="pl-load">Load saved design</button></div><p id="pl-store" class="small" role="status"></p>'+(location.protocol==='file:'?'<a class="small" href="rover-concept.png" target="_blank" rel="noopener">Open the credited rover illustration (PNG)</a>':'<a class="small" href="rover-concept.png" download="first-fire-rover-concept.png">Download the credited rover illustration (PNG)</a>')+'</div></section></form>'+
      '<div class="section grid2"><section class="panel pl-evidence"><h2>Local flame temperature</h2><strong id="pl-temp"></strong><p id="pl-temp-source"></p><p>Stoichiometric oxygen–nitrogen air and fuel enter at 300 K. Complete combustion, constant pressure, no heat loss or product dissociation. Dissociation and heat transfer can lower a real flame temperature. The mixed cabin gas has a different temperature.</p></section>'+
      '<section class="panel pl-evidence"><h2>Experimental liquid network</h2><strong id="pl-estimate"></strong><p id="pl-network-result"></p><p id="pl-evaluation"></p></section></div>'+
      '<section class="panel section pl-method pl-reference" aria-labelledby="pl-reference-title"><div><span class="eyebrow">NASA evidence comparison</span><h2 id="pl-reference-title">Reverse the flow</h2></div>'+
      '<p>In orbit, Saffire-I burned the same cotton–fiberglass specimen in two directions at 20 cm/s airflow. NASA reported a faster front when the flame traveled with the flow. Use those two measured rates as alternative inputs for your cabin.</p>'+
      '<div class="tablewrap"><table><caption>Recorded Saffire-I conditions and spread rates</caption><thead><tr><th>Burn</th><th>Airflow</th><th>Source O₂</th><th>Front speed</th></tr></thead><tbody>'+
      '<tr><th scope="row"><a href="#atlas?record=PSI-98%3A1%3A2">S1 · concurrent</a></th><td>20 cm/s</td><td>21.5–21.7%</td><td>1.8 mm/s</td></tr>'+
      '<tr><th scope="row"><a href="#atlas?record=PSI-98%3A1%3A3">S2 · opposed</a></th><td>20 cm/s</td><td>~21.5%</td><td>1.3 mm/s</td></tr></tbody></table></div>'+
      '<p id="pl-match" class="pl-aside"></p><div class="actions"><button type="button" id="pl-compare" class="btn" aria-expanded="false" aria-controls="pl-comparison">Compare both inputs</button></div>'+
      '<div id="pl-comparison" hidden><label class="pl-time">Comparison time <output id="pl-compare-clock">60 s</output><input id="pl-compare-time" type="range" aria-label="Reference comparison time in seconds" min="0" max="120" step="2" value="60"></label>'+
      '<div class="tablewrap"><table><caption>Cabin model with each reference speed imposed</caption><thead><tr><th>Input</th><th>Front position</th><th>Cabin O₂</th><th>Chemical heat</th></tr></thead><tbody id="pl-pair"></tbody></table></div>'+
      '<p id="pl-observation"></p><p><strong>Discriminating test.</strong> Repeat both directions on fresh, matched specimens and counterbalance run order. Hold oxygen, pressure, geometry and airflow magnitude fixed. Compare calibrated front position over time and record remaining fuel. This separates a direction effect from possible prior heating or changes to the shared specimen.</p></div>'+
      '<p class="small"><a href="https://doi.org/10.60555/0t15-1z43" target="_blank" rel="noopener">Saffire-I PSI table, rows 2–3 ↗</a> · <a href="https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21" target="_blank" rel="noopener">NASA spread-rate measurements, slide 21 ↗</a></p></section>'+
      '<section class="panel section pl-method"><h2>How to read the result</h2><details open><summary>Balances and assumptions</summary><p>The rigid chamber starts at 300 K with oxygen and a nitrogen balance. Each burned fuel unit consumes its stoichiometric oxygen, forming carbon dioxide and water vapor. All gas percentages use the updated total mole count. Released heat is the fuel consumed times its net heat of combustion, plus battery heat limited by available watt-hours. The model omits leaks, condensation, smoke, incomplete combustion, thermal runaway and wall heat transfer.</p><p>Surface gravity changes chassis weight and the displayed buoyant velocity scale. Real flame propagation also depends on flow, material and gravity. The chamber balance uses the front speed you enter. The Mars setting has lower confidence for transferring a surface-fire interpretation. Neither setting has experimental calibration here.</p></details>'+
      '<details><summary>Model and source records</summary><ul><li>Fuel chemistry uses cellulose (C₆H₁₀O₅, 15.2 MJ/kg) and polyethylene (CH₂, 43.4 MJ/kg). <a href="https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf" target="_blank" rel="noopener">NBS Technical Note 1128, heat of combustion table</a></li>'+
      '<li>Gas temperature solves a sensible enthalpy balance for N₂, CO₂ and H₂O. <a href="https://github.com/Cantera/cantera/blob/v3.1.0/data/gri30.yaml" target="_blank" rel="noopener">Cantera GRI-Mech thermochemistry</a></li>'+
      '<li>Vehicle references describe program roles. <a href="https://www.nasa.gov/news-release/nasa-japan-advance-space-cooperation-sign-agreement-for-lunar-rover/" target="_blank" rel="noopener">NASA–Japan pressurized rover agreement</a> · <a href="https://www.nasa.gov/moonbase/lunar-terrain-vehicle/" target="_blank" rel="noopener">NASA Lunar Terrain Vehicle</a></li>'+
      '<li>The experimental network uses recurrent, input-gated continuous-time cells and a fitted readout. <a href="https://arxiv.org/abs/2006.04439" target="_blank" rel="noopener">Hasani et al., Liquid Time-constant Networks</a></li></ul></details></section></div>';
    const get=id=>root.querySelector('#pl-'+id), form=get('form'), clock=get('time');
    const control=name=>form.elements.namedItem(name);
    let current=null,scenario=null,predicted=null;
    let reference=null;
    const desk=window.FFAwareness;
    const lite=desk?.tier?.()==='lite';
    let model=lite?null:window.FFCabinLiquid;
    let runNetwork;
    if(lite){
      runNetwork=document.createElement('button');
      runNetwork.type='button';runNetwork.className='ghost';runNetwork.textContent='Run liquid model on this device';
      get('evaluation').after(runNetwork);
      runNetwork.onclick=async()=>{
        runNetwork.disabled=true;
        try{
          await window.FFLoadAsset('cabin-liquid-weights.js');
          if(!runNetwork.isConnected)return;
          model=window.FFCabinLiquid;showEvaluation();calculate();runNetwork.hidden=true;
        }catch{runNetwork.disabled=false;runNetwork.textContent='Retry liquid model';}
      };
    }
    const explanation=document.createElement('p');
    explanation.className='pl-aside';
    const back=document.createElement('a');
    back.href='#awareness';
    back.textContent='Review this investigation →';
    get('trace-title').after(explanation,back);
    get('chart').hidden=lite;
    function publish(record) {
      document.dispatchEvent(new CustomEvent('ff-research-result',{detail:record?{
        tool:'physics',title:'Rover and cabin physics',
        summary:fmt(record.outputs.position,2)+' cm of prescribed travel at '+record.seconds+' s; '+fmt(record.outputs.oxygen,3)+'% wet O₂.',record
      }:{tool:'physics',invalid:true}}));
    }
    function selectedParts(){
      return Object.fromEntries(Object.keys(parts).map(k=>[k,{key:control(k).value,name:control(k+'Name').value.slice(0,46)}]));
    }
    function read() {
      const s={planet:control('planet').value,fuel:control('fuel').value};
      for(const k of Object.keys(physics.ranges))s[k]=control(k).valueAsNumber;
      return s;
    }
    function writeTrial(s) {
      for(const key of Object.keys(d))control(key).value=s[key];
    }
    function inspect() {
      if(!current)return;
      const index=Number(clock.value)/physics.interval, sample=current.trace[index];
      get('clock').textContent=sample.time+' s';
      get('o2').textContent=fmt(sample.oxygen);
      get('co2').textContent=fmt(sample.co2);
      get('heat').textContent=fmt(sample.energy,1);
      get('front').textContent=fmt(sample.position,1);
      get('char').style.width=(100*sample.position/scenario.length)+'%';
      get('fate').textContent=sample.state+' · '+fmt(sample.burned,1)+' g consumed · '+fmt(sample.chemical,1)+' kJ combustion + '+fmt(sample.electrical,1)+' kJ electrical.';
      const covered=physics.inTrainingDomain(scenario);
      if(runNetwork)runNetwork.hidden=Boolean(model)||!covered;
      get('estimate').textContent=predicted?fmt(predicted[index])+'% O₂':covered?'Available on demand':'Outside training range';
      get('network-result').textContent=predicted?'At '+sample.time+' s the simulator gives '+fmt(sample.oxygen)+'%. The absolute difference is '+fmt(Math.abs(predicted[index]-sample.oxygen),3)+' percentage points.':covered?'Lite mode runs the physics solver. Enable the liquid model to compare its estimate at the same time.':'The gas balance runs directly. The network was trained on 0.5–5 g/cm, 4–30 m³, 50–105 kPa, 21–37% O₂, a 15–20% cutoff, 20–60 cm of strip and 0.03–0.65 cm/s.';
      get('liquid-key').hidden=!predicted;
      if(!lite)chart(get('chart'),current.trace,predicted,sample.time);
      const basis=reference?'The '+reference+' Saffire-I speed is imposed on this strip. ':'The strip speed is a user assumption. ';
      const level=desk?.level?.();
      const detail=level==='beginner'?'The strip uses oxygen as it burns. Move the clock to see how much remains.':
        level==='advanced'?'The ideal gas inventory is pV/(RT). Wet mole fractions use the changing total after the stoichiometric reaction.':
        'At an imposed speed, available fuel and the assumed oxygen cutoff bound the distance. The oxygen reading includes product water vapor.';
      explanation.textContent=basis+detail;
      const sources=[{title:'Fuel thermochemistry',url:'https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf'}];
      if(reference)sources.push({title:'Saffire-I experimental conditions',doi:'10.60555/0t15-1z43',url:'https://doi.org/10.60555/0t15-1z43',row:reference==='concurrent'?'PSI-98:1:2':'PSI-98:1:3'},
        {title:'Saffire-I front rates, PDF page 21',url:'https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21'});
      publish({kind:'simulated',inputs:{...scenario},parts:selectedParts(),designName:control('designName').value.slice(0,60),
        reference,seconds:sample.time,outputs:{...sample,chassisWeightN:current.chassisWeight,idealFlameK:current.flame.kelvin},
        units:{position:'cm',oxygen:'wet vol%',co2:'wet vol%',water:'wet vol%',burned:'g',chemical:'kJ',electrical:'kJ',energy:'kJ'},
        fuelInventory:{massG:scenario.length*scenario.density,loadingGPerCm:scenario.density,basis:'assumed dry combustible mass per active length'},
        liquidStatus:predicted?'evaluated':covered?'deferred in Lite mode':'outside training domain',
        liquid:predicted?{oxygenPercent:predicted[index],errorPercentagePoints:Math.abs(sample.oxygen-predicted[index]),training:'synthetic cabin runs'}:null,
        sources,boundary:'The front speed is imposed. Source and rover differ in gravity, fuel and atmosphere. The liquid model approximates the solver.'});
    }
    function compare() {
      const section=get('comparison'), show=get('compare').getAttribute('aria-expanded')==='true';
      section.hidden=!show || !current;
      if(!current || !show)return;
      const t=Number(get('compare-time').value), pair=physics.compareReferenceSpeeds(scenario,t);
      get('compare-clock').textContent=t+' s';
      const rows=Object.entries(pair).map(([direction,row])=>{
        const tr=document.createElement('tr');
        const origin=direction==='concurrent'?'Concurrent rate':'Opposed rate';
        for(const text of [origin,fmt(row.position,2)+' cm',fmt(row.oxygen,3)+'%',fmt(row.chemical,2)+' kJ']){
          const cell=document.createElement(tr.childElementCount?'td':'th');
          if(cell.tagName==='TH')cell.scope='row';
          cell.textContent=text;tr.append(cell);
        }
        return tr;
      });
      get('pair').replaceChildren(...rows);
      const difference=pair.concurrent.position-pair.opposed.position;
      get('observation').textContent='Modeled distance difference at '+t+' s: '+fmt(difference,2)+' cm. '+
        (difference>1e-8?'The faster imposed input has consumed more strip at this instant.':'Both modeled fronts are at the same position at this instant.')+
        ' These are calculated distances for your configuration. Saffire-I supplies speed inputs, so agreement in speed cannot validate the solver.';
    }
    get('compare').onclick=()=>{
      const active=get('compare').getAttribute('aria-expanded')==='true';
      get('compare').setAttribute('aria-expanded',String(!active));
      get('compare').textContent=active?'Compare both inputs':'Hide comparison';
      compare();
    };
    get('compare-time').oninput=compare;
    function calculate() {
      for(const key of Object.keys(parts))control(key+'Name').parentElement.hidden=control(key).value!=='custom';
      scenario=read();
      const err=physics.validate(scenario);
      for(const [key,[lo,hi]] of Object.entries(physics.ranges)){
        const value=scenario[key],input=control(key);
        input.setAttribute('aria-invalid',String(!Number.isFinite(value)||value<lo||value>hi));
      }
      get('message').textContent=err||'';
      get('save').disabled=!!err;get('compare').disabled=!!err;
      get('live-data').hidden=!!err;
      if(err){
        current=null;compare();publish(null);
        if(runNetwork)runNetwork.hidden=true;
        for(const id of ['inventory','temp','temp-source','estimate','network-result','rover-result','match'])get(id).textContent='Complete the test conditions to calculate.';
        return;
      }
      const loadingLabel=scenario.density===physics.loadings.coupon?'Thin-coupon example':scenario.density===physics.loadings.stress?'High-loading stress example':'Custom loading';
      get('inventory').textContent=loadingLabel+' · '+fmt(scenario.length*scenario.density,3)+' g of combustible material across '+fmt(scenario.length)+' cm. Both the fuel loading and the cabin conditions are model inputs.';
      current=physics.run(scenario);predicted=physics.liquidPrediction(scenario,model);
      get('match').textContent='Your scenario uses '+physics.fuels[scenario.fuel].name.toLowerCase()+' on '+scenario.planet+' at '+fmt(scenario.oxygen)+'% O₂. The flight used a composite in orbit; this sealed-box solver has no airflow direction, and the cited PSI table supplies no pressure measurement. Only the speed is borrowed.';
      compare();
      const kelvin=current.flame.kelvin;
      get('temp').textContent=kelvin?fmt(kelvin,0)+' K':'Above 3,500 K fit range';
      get('temp-source').textContent='Ideal flame-zone estimate for '+physics.fuels[scenario.fuel].name.toLowerCase()+' at '+fmt(scenario.oxygen)+'% starting O₂.';
      get('rover-result').textContent=scenario.planet+' · '+(scenario.planet==='Mars'?'lower-confidence transfer · ':'')+
        'chassis weight '+fmt(current.chassisWeight,0)+' N · buoyant velocity scale '+fmt(current.buoyancy,2)+' m/s (assumed 0.2 m length and 50% density contrast).';
      inspect();
    }
    function showEvaluation(){
      if(!model)return;
      const m=model.benchmark;
      get('evaluation').textContent=m.trainRuns+' synthetic runs trained the readout. On '+m.testRuns+' separate simulator runs ('+fmt(m.points,0)+' time points), mean absolute O₂ error was '+fmt(m.mae,3)+' percentage points. The 95th percentile was '+fmt(m.p95,3)+' and the worst was '+fmt(m.worst,3)+'. Holding O₂ constant gave '+fmt(m.constantMae,3)+' mean error. Flight validation is pending.';
    }
    showEvaluation();
    function applyPreset(evt){
      const key=evt.target.name;
      if(!Object.hasOwn(parts,key))return;
      const settings=presets[evt.target.value];
      if(settings)Object.entries(settings).forEach(([k,v])=>{control(k).value=v;});

    }
    form.addEventListener('submit',e=>e.preventDefault());
    for(const [key,loading] of Object.entries(physics.loadings)){
      get(key).onclick=()=>{control('density').value=loading;calculate();};
    }
    form.addEventListener('input',evt=>{
      if(evt.target===clock){inspect();return;}
      if(evt.target.name.endsWith('Name')){inspect();return;}
      if(evt.target.name==='speed')reference=null;
      if(evt.target.name==='volume')control('cabin').value='custom';
      if(evt.target.name==='chassisMass')control('chassis').value='custom';
      if(['capacity','power'].includes(evt.target.name))control('pack').value='custom';
      applyPreset(evt);calculate();
    });
    get('reset').onclick=()=>{reference=null;form.reset();writeTrial(d);clock.value=120;get('store').textContent='';calculate();};
    get('save').onclick=()=>{
      if(!current)return;
      const name=control('designName').value.trim() || 'Cabin trial';
      const components=Object.fromEntries(Object.keys(parts).map(k=>[k,control(k).value]));
      const names=Object.fromEntries(Object.keys(parts).map(key=>[key,control(key+'Name').value.trim().slice(0,46)]));
      try{localStorage.setItem(storeKey,JSON.stringify({version:1,name,components,names,scenario}));get('store').textContent='Saved “'+name+'” on this device.';}
      catch{get('store').textContent='Device storage is unavailable.';}
    };
    get('load').onclick=()=>{
      try{
        const raw=localStorage.getItem(storeKey);if(!raw){get('store').textContent='No saved design on this device.';return;}
        const saved=JSON.parse(raw);
        if(saved.version!==1 || !saved.scenario || physics.validate(saved.scenario) || typeof saved.name!=='string' ||
          !Object.entries(parts).every(([key,values])=>Object.hasOwn(values,saved.components?.[key])))throw Error('invalid');
        reference=null;
        writeTrial(saved.scenario);
        for(const k of Object.keys(parts)){
          control(k).value=saved.components[k];
          control(k+'Name').value=typeof saved.names?.[k]==='string'?saved.names[k].slice(0,46):'';
        }
        control('designName').value=saved.name.slice(0,60);calculate();
        get('store').textContent='Loaded “'+control('designName').value+'”.';
      }catch{get('store').textContent='The saved design could not be opened.';}
    };
    const previous=desk?.previous?.('physics');
    if(previous?.inputs && !physics.validate(previous.inputs)){
      writeTrial(previous.inputs);
      for(const [k,options] of Object.entries(parts)){
        const part=previous.parts?.[k];
        if(part && Object.hasOwn(options,part.key)){
          control(k).value=part.key;
          control(k+'Name').value=String(part.name||'').slice(0,46);
        }
      }
      if(typeof previous.designName==='string')control('designName').value=previous.designName.slice(0,60);
      if(Number.isInteger(previous.seconds) && previous.seconds>=0 && previous.seconds<=physics.horizon && previous.seconds%physics.interval===0)clock.value=previous.seconds;
      if(Object.hasOwn(physics.saffireSpeeds,previous.reference) && previous.inputs.speed===physics.saffireSpeeds[previous.reference]/10)reference=previous.reference;
    }
    if(Object.hasOwn(physics.saffireSpeeds,requested)){
      reference=requested;control('speed').value=physics.saffireSpeeds[requested]/10;
    }
    calculate();
    const observer=!lite && typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(current)chart(get('chart'),current.trace,predicted,Number(clock.value));}):null;
    observer?.observe(get('live-data'));
    if(roverMode)requestAnimationFrame(()=>get('rover')?.scrollIntoView({block:'start'}));
    window.addEventListener('hashchange',()=>observer?.disconnect(),{once:true});
  }
  window.renderPhysicsLab=renderPhysicsLab;
})();
