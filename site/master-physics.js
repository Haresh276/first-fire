// Rigid-cabin mass/energy inventory and interpolation of separately computed reference results.
(() => {
  'use strict';
  const node=typeof module!=='undefined' && module.exports;
  const physics=node?require('./physics-lab.js'):window.FFPhysics;
  if(node)require('./master-physics-data.js');
  const grid=globalThis.FFMasterEquilibrium;
  const transport=node?require('./transport-lab.js'):window.FFTransportLab;
  const R=8.31446261815324,refK=300,CV={oxygen:21.0,nitrogen:20.8,co2:28.8,water:25.3};
  const defaults={...physics.defaults,duration:120,crew:0,activity:'nominal',support:false,diluent:'N2',wallTemperatureK:300,batteryOffAtS:86400,fuelMassG:100000,wallUA:80,crewHeatW:90,bandPP:.2,
    makeupGmin:3,scrubGmin:4,oxygenTankG:4000,scrubCapacityG:5000};
  // NASA BVAD Table 3-24 gives O₂ consumed and CO₂ produced (g/person/min).
  const metabolism={sleep:[.37,.44],nominal:[.59,.69],aerobic:[3.99,5.22]};
  const limits={oxygen:[0,40],cutoff:[0,30],fuelMassG:[0,1e6],batteryOffAtS:[0,86400],wallTemperatureK:[50,600],duration:[10,86400],crew:[0,6],wallUA:[0,1000],crewHeatW:[0,300],bandPP:[.05,2],
    makeupGmin:[0,40],scrubGmin:[0,60],oxygenTankG:[0,30000],scrubCapacityG:[0,40000]};
  function validate(s){
    const error=physics.validate({...s,oxygen:Math.max(s.oxygen,10),cutoff:Math.max(s.cutoff,5)});if(error)throw RangeError(error);
    for(const [key,[lo,hi]] of Object.entries(limits)){
      if(!Number.isFinite(s[key])||s[key]<lo||s[key]>hi)throw RangeError(key+' must be between '+lo+' and '+hi+'.');
    }
    if(!['N2','Ar','He'].includes(s.diluent))throw RangeError('Unsupported diluent.');
    if(!Number.isInteger(s.crew)||!Number.isInteger(s.duration)||typeof s.support!=='boolean'||!Object.hasOwn(metabolism,s.activity))throw RangeError('Check crew, duration, activity and life-support settings.');
  }
  function bracket(keys,q){
    if(!Number.isFinite(q)||q<keys[0]||q>keys.at(-1))throw RangeError('Outside the precomputed grid.');
    const j=keys.findIndex((v,i)=>i>0&&v>=q);
    return [j-1,(q-keys[j-1])/(keys[j]-keys[j-1])];
  }
  function equilibrium(fuel,oxygenPct,pressureKpa){
    if(!Object.hasOwn(grid.kelvin,fuel))throw RangeError('Unsupported equilibrium fuel.');
    const [i,a]=bracket(grid.oxygen,oxygenPct),[j,b]=bracket(grid.pressure,pressureKpa),g=grid.kelvin[fuel];
    return (1-a)*((1-b)*g[i][j]+b*g[i][j+1])+a*((1-b)*g[i+1][j]+b*g[i+1][j+1]);
  }
  // Master B18 specifies full thickness. Gas conductivity evaluated at 600 K, from Cantera.
  const spreadDefaults={oxygen:21,pressure:101.325,thicknessMM:.3175,densityKgM3:.182/.0003175,
    cpJKgK:1350,pyrolysisK:600,ambientK:300,conductivity:grid.air_conductivity_600K_W_mK,flowCmS:20,emissivity:.8,regime:'thermal'};
  function spread(config={}){
    const s={...spreadDefaults,...config};
    for(const k of ['thicknessMM','densityKgM3','cpJKgK','pyrolysisK','ambientK','conductivity']){
      if(!Number.isFinite(s[k])||s[k]<=0)throw RangeError('Positive material properties are required.');
    }
    if(s.pyrolysisK<=s.ambientK)throw RangeError('Pyrolysis temperature must exceed the ambient temperature.');
    if(!['thermal','quench','blowoff','unknown'].includes(s.regime))throw RangeError('Unknown spread regime.');
    const kelvin=equilibrium('cellulose',s.oxygen,s.pressure);
    const mmPerSecond=1000*Math.PI/4*s.conductivity/(s.densityKgM3*s.cpJKgK*s.thicknessMM/1000)*(kelvin-s.pyrolysisK)/(s.pyrolysisK-s.ambientK);
    if(!Number.isFinite(s.flowCmS)||s.flowCmS<0||!Number.isFinite(s.emissivity)||s.emissivity<0||s.emissivity>1)throw RangeError('Check opposed airflow and surface emissivity.');
    const M=(s.oxygen*.031998+(100-s.oxygen)*.028014)/100;
    const gasDensity=s.pressure*1000*M/(R*s.pyrolysisK);
    const criticalFlowCmS=100*s.emissivity*5.670374419e-8*(s.pyrolysisK**4-s.ambientK**4)/(gasDensity*1050*(kelvin-s.pyrolysisK));
    const lowFlow=s.flowCmS<=criticalFlowCmS;
    const allowed=s.regime==='thermal' && kelvin>s.pyrolysisK && !lowFlow;
    return {mmPerSecond:allowed?mmPerSecond:null,thermalConditional:allowed,
      kelvin,criticalFlowCmS,lowFlow,regime:s.regime,arealMass:s.thicknessMM*s.densityKgM3/1000,properties:s};
  }
  function saffireCheck(){
    const opposed=spread({oxygen:21.5}),concurrent=spread({oxygen:21.6});
    const scale=physics.saffireSpeeds.opposed/opposed.mmPerSecond;
    const transfer=scale*concurrent.mmPerSecond;
    return {calibrationSource:'PSI-98:1:3',comparisonSource:'PSI-98:1:2',assumedPressureKpa:101.325,
      rawOpposedMMs:opposed.mmPerSecond,calibratedFactor:scale,predictedConcurrentMMs:transfer,
      observedConcurrentMMs:physics.saffireSpeeds.concurrent,errorMMs:transfer-physics.saffireSpeeds.concurrent};
  }
  function simulateCabin(config={},stepSeconds){
    const s={...defaults,...config};validate(s);
    const dt=stepSeconds??(s.duration<=900||s.speed>0?1:15);
    if(!Number.isFinite(dt)||dt<=0||dt>30||s.duration/dt>1000000)throw RangeError('Unsupported integration step.');
    const c=physics.chemistry(s.fuel),n0=s.pressure*1000*s.volume/(R*refK);
    const n={oxygen:n0*s.oxygen/100,nitrogen:0,helium:0,argon:0,co2:0,water:0};
    n[{N2:'nitrogen',He:'helium',Ar:'argon'}[s.diluent]]=n0*(1-s.oxygen/100);
    const total=()=>n.oxygen+n.nitrogen+n.argon+n.helium+n.co2+n.water;
    const capacity=()=>Object.keys(CV).reduce((sum,k)=>sum+CV[k]*n[k],0)+1.5*R*(n.helium+n.argon);
    const availableExtent=Math.min(s.fuelMassG,s.length*s.density)/c.molarMass;
    let storedJ=0,chemicalJ=0,batteryJ=0,crewJ=0,wallJ=0,removedSensibleJ=0,extent=0;
    let crewO2Mol=0,crewCO2Mol=0,makeupMol=0,scrubMol=0,shortfallMol=0,maxResidualJ=0;
    let oxygenMin=s.oxygen,oxygenMax=s.oxygen,flameEnded=false;
    const trace=[],every=Math.max(dt,Math.ceil(s.duration/300/dt)*dt);
    let nextSample=every;
    function observation(t){
      const gasK=refK+storedJ/capacity(),amount=total(),oxygenPct=100*n.oxygen/amount;
      return {seconds:t,oxygenPct,co2Pct:100*n.co2/amount,temperatureK:gasK,pressureKpa:amount*R*gasK/s.volume/1000,
        positionCm:extent*c.molarMass/s.density,heatKJ:chemicalJ/1000,batteryKJ:batteryJ/1000,storedKJ:storedJ/1000,
        wallKJ:wallJ/1000,crewHeatKJ:crewJ/1000,removedGasSensibleKJ:removedSensibleJ/1000};
    }
    trace.push(observation(0));
    const [o2G,co2G]=metabolism[s.activity],setpoint=s.oxygen/100,cut=s.cutoff/100;
    for(let t=0;t<s.duration;){
      const h=Math.min(dt,s.duration-t),temperatureRise=storedJ/capacity();
      const extentMax=(n.oxygen-total()*cut)/(c.oxygen+c.deltaMoles*cut);
      const demand=s.speed*s.density*h/c.molarMass;
      const delta=flameEnded?0:Math.max(0,Math.min(demand,availableExtent-extent,extentMax));
      if(demand>0&&(extentMax<=demand || extent+delta>=availableExtent-1e-12))flameEnded=true;
      extent+=delta;n.oxygen-=delta*c.oxygen;n.co2+=delta*c.carbon;n.water+=delta*c.water;
      const wantO2=s.crew*o2G*h/(60*31.998),crewUsed=Math.min(wantO2,n.oxygen);
      const produced=s.crew*co2G*h/(60*44.009)*(wantO2?crewUsed/wantO2:0);
      n.oxygen-=crewUsed;n.co2+=produced;crewO2Mol+=crewUsed;crewCO2Mol+=produced;shortfallMol+=wantO2-crewUsed;
      let scrub=0;
      if(s.support){
        scrub=Math.max(0,Math.min(n.co2,s.scrubGmin*h/(60*44.009),s.scrubCapacityG/44.009-scrubMol));
        n.co2-=scrub;scrubMol+=scrub;
        if(100*n.oxygen/total()<=s.oxygen-s.bandPP/2) {
          const add=Math.max(0,Math.min((setpoint*total()-n.oxygen)/(1-setpoint),s.makeupGmin*h/(60*31.998),s.oxygenTankG/31.998-makeupMol));
          n.oxygen+=add;makeupMol+=add;
        }
      }
      const qFire=delta*c.molarMass*c.heat*1000;
      const qBatt=Math.max(0,Math.min(s.power*Math.max(0,Math.min(t+h,s.batteryOffAtS)-t),s.capacity*3600-batteryJ));
      const qCrew=s.crew*s.crewHeatW*h;
      // External supply enters at 300 K; removed gas carries the previous-step bulk sensible energy.
      const exported=(crewUsed*CV.oxygen+scrub*CV.co2)*temperatureRise;
      removedSensibleJ+=exported;chemicalJ+=qFire;batteryJ+=qBatt;crewJ+=qCrew;
      const preLoss=storedJ+qFire+qBatt+qCrew-exported;
      const loss=(preLoss-capacity()*(s.wallTemperatureK-refK))*(-Math.expm1(-s.wallUA*h/capacity()));wallJ+=loss;storedJ=preLoss-loss;
      maxResidualJ=Math.max(maxResidualJ,Math.abs(chemicalJ+batteryJ+crewJ-wallJ-removedSensibleJ-storedJ));
      const pct=100*n.oxygen/total();oxygenMin=Math.min(oxygenMin,pct);oxygenMax=Math.max(oxygenMax,pct);
      t+=h;
      if(t+1e-9>=nextSample || t>=s.duration){trace.push(observation(t));nextSample+=every;}
    }
    const inputJ=chemicalJ+batteryJ+crewJ;
    return {scenario:s,stepSeconds:dt,trace,final:trace.at(-1),moles:{...n},oxygenRangePct:[oxygenMin,oxygenMax],
      bandPct:[s.oxygen-s.bandPP,s.oxygen+s.bandPP],withinBand:oxygenMin>=s.oxygen-s.bandPP-1e-10 && oxygenMax<=s.oxygen+s.bandPP+1e-10,
      crewO2G:crewO2Mol*31.998,crewCO2G:crewCO2Mol*44.009,makeupG:makeupMol*31.998,scrubbedG:scrubMol*44.009,
      unmetCrewO2G:shortfallMol*31.998,energyResidualJ:maxResidualJ,energyResidualPercent:inputJ?100*maxResidualJ/inputJ:0};
  }
  function decayCheck(volume=8,flowLps=15,initial=20,duration=300,dt=.2){
    if(!Number.isInteger(duration)||duration<1||duration>300||!Number.isFinite(initial)||initial<=0)throw RangeError('Invalid washout trace.');
    const run=transport.simulate({...transport.defaults,remoteVolume:volume,exchange:0,vent:flowLps,lag:0,initialRemoteMgM3:initial},dt);
    const rate=(flowLps/1000)/volume;
    let maxPercent=0;
    for(const pt of run.points.slice(0,duration+1)){
      const expected=initial*Math.exp(-rate*pt.t);
      maxPercent=Math.max(maxPercent,100*Math.abs(pt.b-expected)/Math.max(expected,1e-12));
    }
    return {volume,flowLps,initial,duration,dt,computed:run.points[duration].b,analytic:initial*Math.exp(-rate*duration),maxPercent};
  }
  const api={simulateCabin,equilibrium,spread,saffireCheck,decayCheck,defaults,spreadDefaults};
  if(node)module.exports=api;
  if(typeof window==='undefined')return;
  window.FFMasterPhysics=api;
  const $=(tag,text,css)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(css)n.className=css;return n;};
  function btn(text,fn,cls='ghost'){const b=$('button',text,cls);b.type='button';b.onclick=fn;return b;}
  const label=(text,input)=>{const l=$('label',text,'field');l.append(input);return l;};
  function select(options){const s=$('select');for(const [value,title] of options){const o=$('option',title);o.value=value;s.append(o);}return s;}
  const num=(n,d=2)=>Number(n.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d});
  function table(labels,rows){
    const outer=$('div',null,'tablewrap'),t=$('table'),hd=$('thead'),h=$('tr'),body=$('tbody');
    labels.forEach(text=>h.append($('th',text)));hd.append(h);
    rows.forEach(values=>{const row=$('tr');values.forEach((v,i)=>row.append($(i?'td':'th',v)));body.append(row);});
    t.append(hd,body);outer.append(t);return outer;
  }
  function download(name,object){
    const a=$('a'),url=URL.createObjectURL(new Blob([JSON.stringify(object,null,2)+'\n'],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function chart(trace,key,caption){
    const ns='http://www.w3.org/2000/svg',make=tag=>document.createElementNS(ns,tag);
    const fig=$('figure'),svg=make('svg');svg.setAttribute('viewBox','0 0 580 175');svg.style.cssText='width:100%;height:auto;display:block';svg.setAttribute('role','img');svg.setAttribute('aria-label',caption);
    const vals=trace.map(p=>p[key]),min=Math.min(...vals),max=Math.max(...vals),pad=Math.max((max-min)*.13,.01);
    const lo=min-pad,hi=max+pad,end=trace.at(-1).seconds;
    const X=t=>58+495*t/end,Y=v=>128-102*(v-lo)/(hi-lo);
    function text(x,y,content){const el=make('text');el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('font-size','13');el.setAttribute('fill','currentColor');el.textContent=content;svg.append(el);}
    for(const v of [lo,(lo+hi)/2,hi]){const line=make('line');line.setAttribute('x1','55');line.setAttribute('x2','555');line.setAttribute('y1',Y(v));line.setAttribute('y2',Y(v));line.setAttribute('stroke','#c8d4ca');svg.append(line);text(1,Y(v)+4,num(v));}
    const p=make('polyline');p.setAttribute('points',trace.map(point=>X(point.seconds).toFixed(2)+','+Y(point[key]).toFixed(2)).join(' '));p.setAttribute('fill','none');p.setAttribute('stroke','#17685e');p.setAttribute('stroke-width','3');svg.append(p);
    text(56,154,'0');text(247,154,caption);text(485,154,num(end)+' s');
    fig.append(svg);fig.style.margin='0';return fig;
  }
  function render(root,params=new URLSearchParams()){
    const wrap=$('div',null,'stack'),header=$('header',null,'pagetitle');header.append($('span','Physics Lab','eyebrow'),$('h1','Cabin fire dynamics'),$('p','Follow oxygen, cabin pressure and heat through a fire or a full day of crew activity. Inspect the solver checks and the evidence behind each estimate.','sub'));
    const tabs=$('div',null,'actions'),body=$('section',null,'panel stack');
    const views=[['cabin','Cabin balance'],['chemistry','Flame and spread'],['benchmarks','Independent checks']];
    let mode=views.some(([k])=>k===params.get('mode'))?params.get('mode'):'cabin',scenario={...defaults},quantity='oxygenPct',regime='thermal';
    const buttons={};for(const [key,title] of views){buttons[key]=btn(title,()=>{mode=key;draw();});tabs.append(buttons[key]);}
    const references=$('p',null,'small');const a=$('a','Methods, equations and reproducible benchmarks');a.href='#report/master-physics';references.append(a);
    wrap.append(header,tabs,body,references);root.replaceChildren(wrap);
    const chartVars={oxygenPct:'O₂ (%)',co2Pct:'CO₂ (%)',temperatureK:'Cabin gas (K)',pressureKpa:'Cabin pressure (kPa)',heatKJ:'Chemical heat (kJ)'};
    function cabin(){
      body.append($('h2','Cabin balance'));
      const presets=$('div',null,'actions');const crewBase={...defaults,duration:86400,speed:0,crew:2,oxygen:21,pressure:101.325,support:true};
      for(const [name,config] of [['Two-minute strip burn',defaults],['24 h · crew with life support',crewBase],['24 h · supply off',{...crewBase,support:false}]]){
        presets.append(btn(name,()=>{scenario={...config};draw();}));
      }body.append(presets);
      const form=$('form',null,'stack'),controls=$('div',null,'tr-inputs'),fields={};
      const fuel=select([['cellulose','Cellulose'],['polyethylene','Polyethylene']]);fuel.value=scenario.fuel;controls.append(label('Fuel',fuel));
      const all={duration:['Duration (s)',10,86400],oxygen:['Starting oxygen (%)',10,40],pressure:['Pressure (kPa)',30,110],speed:['Front speed (cm/s)',0,2],volume:['Cabin volume (m³)',1,60],wallUA:['Wall conductance (W/K)',0,1000],crew:['Crew members',0,6]};
      for(const [k,[text,min,max]] of Object.entries(all)){const input=$('input');input.type='number';input.min=min;input.max=max;input.step=['crew','duration'].includes(k)?'1':'any';input.required=true;input.value=scenario[k];fields[k]=input;controls.append(label(text,input));}
      const support=select([['on','Supply and scrubber on'],['off','Supply and scrubber off']]);support.value=scenario.support?'on':'off';controls.append(label('Life support',support));
      const extra=$('details'),more=$('div',null,'tr-inputs');extra.append($('summary','Fuel, battery and controller settings'));
      for(const [k,text,range] of [['length','Strip length (cm)',physics.ranges.length],['density','Linear fuel mass (g/cm)',physics.ranges.density],['cutoff','Oxygen cutoff (%)',physics.ranges.cutoff],['power','Battery power (W)',physics.ranges.power],['capacity','Battery energy (Wh)',physics.ranges.capacity],['oxygenTankG','Make-up tank (g O₂)',limits.oxygenTankG],['scrubCapacityG','Scrubber capacity (g CO₂)',limits.scrubCapacityG],['makeupGmin','Make-up flow (g/min)',limits.makeupGmin],['scrubGmin','Scrubber flow (g/min)',limits.scrubGmin],['bandPP','Control band ± (O₂ points)',limits.bandPP],['crewHeatW','Heat per person (W)',limits.crewHeatW]]){
        const input=$('input');input.type='number';input.step='any';input.min=range[0];input.max=range[1];input.required=true;input.value=scenario[k];fields[k]=input;more.append(label(text,input));}
      const activity=select(Object.keys(metabolism).map(key=>[key,key]));activity.value=scenario.activity;more.append(label('Crew activity',activity));extra.append(more);
      const apply=$('button','Run cabin model','btn');apply.type='submit';const alert=$('p',null,'small');alert.setAttribute('role','status');
      form.append(controls,extra,apply,alert);body.append(form);
      const output=$('div',null,'stack');body.append(output);
      function results(){
        const out=simulateCabin(scenario),f=out.final;
        const cur=select(Object.entries(chartVars));cur.value=quantity;
        const holder=$('div');function plot(){holder.replaceChildren(chart(out.trace,quantity,chartVars[quantity]));}
        cur.onchange=()=>{quantity=cur.value;plot();};plot();
        const r=$('p','At '+num(f.seconds)+' s, oxygen is '+num(f.oxygenPct)+'%, CO₂ is '+num(f.co2Pct)+'%, cabin gas is '+num(f.temperatureK,1)+' K and pressure is '+num(f.pressureKpa)+' kPa.','note');
        output.replaceChildren(r,label('Plot quantity',cur),holder,table(['Balance','Final state'],[
          ['Burned strip',num(f.positionCm)+' cm'],['Chemical / electrical heat',num(f.heatKJ)+' / '+num(f.batteryKJ)+' kJ'],
          ['Gas sensible heat / loss to walls',num(f.storedKJ)+' / '+num(f.wallKJ)+' kJ'],['Crew O₂ use / make-up',num(out.crewO2G)+' / '+num(out.makeupG)+' g'],
          ['Crew CO₂ produced / scrubbed',num(out.crewCO2G)+' / '+num(out.scrubbedG)+' g'],['Oxygen range over every step',out.oxygenRangePct.map(x=>num(x)).join('–')+'%'],
          ['Requested control band',out.bandPct.map(x=>num(x)).join('–')+'% · '+(out.withinBand?'within band':'outside band')],
          ['Maximum energy-ledger residual',out.energyResidualJ.toExponential(2)+' J']]),btn('Download cabin trajectory',()=>download('first-fire-cabin-trajectory.json',out)));
        if(out.unmetCrewO2G>0)output.append($('p','Available oxygen fell below the specified metabolic demand. The depleted-cabin trajectory has no physiological interpretation.','note'));
      }
      form.oninput=()=>{alert.textContent='Edits pending. Run the model to apply.';};
      form.onsubmit=event=>{event.preventDefault();const p={...scenario,fuel:fuel.value,activity:activity.value,support:support.value==='on'};for(const [k,input] of Object.entries(fields))p[k]=input.valueAsNumber;
        try{validate(p);scenario=p;results();alert.textContent='Trajectory updated.';}catch(err){alert.textContent=err.message;}};
      results();
    }
    function flame(){
      body.append($('h2','Flame temperature and spread'),$('p','Choose the oxidizer and pressure. The lookup gives the local adiabatic gas temperature of a stoichiometric flame, including gas-phase dissociation.'));
      const form=$('form',null,'stack'),controls=$('div',null,'tr-inputs'),fields={};
      const propertyFields={oxygen:['Oxidizer O₂ (%)',10,40,21],pressure:['Pressure (kPa)',30,110,101.325],thicknessMM:['Fabric thickness (mm)',.01,3,spreadDefaults.thicknessMM],cpJKgK:['Fabric heat capacity (J/kg/K)',500,4000,1350],pyrolysisK:['Pyrolysis temperature (K)',400,1100,600],densityKgM3:['Fabric bulk density (kg/m³)',50,2000,spreadDefaults.densityKgM3],flowCmS:['Opposing flow for quench check (cm/s)',0,100,20]};
      for(const [k,[name,min,max,def]] of Object.entries(propertyFields)){const i=$('input');i.type='number';i.required=true;i.step='any';i.min=min;i.max=max;i.value=def;fields[k]=i;controls.append(label(name,i));}
      const regimeField=select([['thermal','Assume thin-fuel thermal regime'],['quench','Near low-flow radiative quenching'],['blowoff','Near high-flow blowoff'],['unknown','Regime unknown']]);regimeField.value=regime;
      const b=$('button','Calculate flame conditions','btn');b.type='submit';form.append(controls,label('Spread-regime assessment',regimeField),b);body.append(form);
      const output=$('div',null,'stack');output.setAttribute('aria-live','polite');body.append(output);
      function calculate(){try{const inputs=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.valueAsNumber]));regime=regimeField.value;
        const c=spread({...inputs,regime}),pe=equilibrium('polyethylene',inputs.oxygen,inputs.pressure),saffire=saffireCheck();
        output.replaceChildren(table(['Fuel and calculation','Result'],[['Cellulose flame',num(c.kelvin,0)+' K'],['Polyethylene flame',num(pe,0)+' K'],['SIBAL thermal spread scale',c.mmPerSecond===null?'Withheld for this regime':num(c.mmPerSecond,3)+' mm/s'],['Estimated radiative quench flow',num(c.criticalFlowCmS,2)+' cm/s']]),
          $('p','Saffire-I recorded 1.3 mm/s against the flow and 1.8 mm/s with it. The spread formula assumes conduction and uses the whole composite thickness. Flow direction, radiation, char and gravity-dependent extinction require further measurements.'),$('p','Calibrating one multiplier on the opposed flight run gives '+num(saffire.calibratedFactor,2)+'. Applying it to the concurrent run gives '+num(saffire.predictedConcurrentMMs,2)+' mm/s against the observed 1.8 mm/s. Both runs used the same specimen. Direction and prior heating limit this comparison.'),
          $('p','NASA reports SIBAL area density of 0.182 kg/m² and thickness of about 0.32 mm. Heat capacity and pyrolysis temperature are assumptions. Changing thickness at fixed bulk density changes the area density.','small'));
      }catch(err){output.textContent=err.message;}}form.onsubmit=ev=>{ev.preventDefault();calculate();};calculate();
    }
    function checks(){
      const checks=grid.spot_checks,max=Math.max(...checks.map(x=>x.relative_percent)),d=decayCheck(),sur=globalThis.FFMasterSurrogate,ref=globalThis.FFMasterFDS;
      body.append($('h2','Independent checks'),$('h3','Gas equilibrium'),$('p','Cantera '+grid.cantera+' solved '+(2*grid.oxygen.length*grid.pressure.length)+' grid conditions. All ten off-grid checks are within '+num(max,3)+'% of fresh equilibrium solves. The acceptance limit is 2%.'));
      const spots=$('details');spots.append($('summary','See the ten spot checks'),table(['Fuel','O₂ (%)','Pressure (kPa)','Direct (K)','Lookup (K)'],checks.map(x=>[x.fuel,x.oxygen_pct,x.pressure_kpa,num(x.reference_k,1),num(x.interpolated_k,1)])));body.append(spots);
      body.append($('h3','Ventilation decay'),$('p','A single 8 m³ compartment starts at 20 mg/m³ and receives clean air at 15 L/s. At 300 s the time-step solver gives '+num(d.computed,4)+' mg/m³ against '+num(d.analytic,4)+' mg/m³ from the exponential solution. Largest relative error is '+num(d.maxPercent,4)+'%.'));
      if(ref){body.append($('h3','NIST Fire Dynamics Simulator'),$('p','Two sealed 8 m³ methane-burner cases and one finer-mesh repeat compare a volume-averaged FDS oxygen measurement with a well-mixed stoichiometric balance. The declared acceptance limit is '+num(ref.tolerance_pp)+' oxygen percentage points at every sampled time.'),
        table(['Burner / mesh','FDS final O₂','Balance final O₂','Largest gap'],ref.cases.map(x=>[num(x.peak_kw)+' kW · '+x.resolution+'³',num(x.trace.at(-1).fds_oxygen_pct,3)+'%',num(x.trace.at(-1).balance_oxygen_pct,3)+'%',num(x.max_abs_pp,3)+' points · '+(x.pass?'pass':'miss')])),
        btn('Download FDS decks and comparisons',()=>download('first-fire-fds-reference.json',ref)));}
      if(sur){body.append($('h3','Recurrent model release gate'),$('p','The networks learn exact sealed-strip trajectories. Training used '+sur.partitions.train+' whole runs, model selection used '+sur.partitions.validation+', and the final test used '+sur.partitions.test+' separate runs. Each run contains 60 oxygen predictions.'),
        table(['Method','Mean error (O₂ points)','95th percentile'],[['Trained liquid cell',sur.liquid],['Plain recurrent network',sur.plain_rnn],['Four nearest training curves',sur.nearest_curves],['Chemistry-informed lookup',sur.structured_lookup]].map(([t,v])=>[t,num(v.mae_pp,5),num(v.p95_pp,5)])),
        $('p',sur.decision==='drop'?'The liquid candidate missed the lookup gate and was dropped from the prediction path. Errors here measure agreement with the equations.':'The liquid candidate passed its lookup gate.','note'),btn('Download surrogate benchmark',()=>download('first-fire-surrogate-comparison.json',sur)));}
    }
    function draw(){for(const [k,b] of Object.entries(buttons)){b.className=k===mode?'btn':'ghost';b.setAttribute('aria-pressed',String(k===mode));}body.replaceChildren();if(mode==='cabin')cabin();else if(mode==='chemistry')flame();else checks();}
    draw();
  }
  api.render=render;
})();
