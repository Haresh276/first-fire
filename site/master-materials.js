/* Material-specific measurements, atmospheric arithmetic and the F9 scenario API. */
(() => {
  'use strict';
  const data=typeof window==='undefined'?require('./materials-data.js'):window.FFMaterialData;
  const gas={N2:{mass:28.0134,heat:29.12},He:{mass:4.0026,heat:20.79},Ar:{mass:39.948,heat:20.79}};
  function atmosphere({pressure=56.5,oxygen=34,volume=12,suit=29.6,diluent='N2'}={}){
    if(!Object.hasOwn(gas,diluent)||![pressure,oxygen,volume,suit].every(Number.isFinite)||pressure<=0||oxygen<0||oxygen>100||volume<=0||suit<=0)throw RangeError('Check the pressure, oxygen fraction, cabin volume, suit pressure and diluent.');
    const x=oxygen/100,moles=pressure*1000*volume/(8.314462618*300),pO2=x*pressure,pDiluent=(1-x)*pressure;
    // Dry standard troposphere, restricted to its 0–11 km domain.
    const seaFraction=pO2/(101.325*.2095),altitudeM=44330.77*(1-Math.pow(seaFraction,0.190263));
    return {pO2,pDiluent,ratio:diluent==='N2'?pDiluent/suit:null,moles,massKg:moles*(x*31.998+(1-x)*gas[diluent].mass)/1000,
      oxygenKg:x*moles*.031998,altitudeM:altitudeM>=0&&altitudeM<=11000?altitudeM:null,diluentPerO2:x?(1-x)/x:null,
      diluentHeatPerO2:x?(1-x)/x*gas[diluent].heat:null};
  }
  function points(id,series){
    const g=data.charts[id];
    return g[series].map(([x,y])=>({flow:10**((x-g.x0)/g.xDecade),oxygen:g.o2base+(g.baseline-y)/g.pxPerPct}));
  }
  function boundary(id,flow){
    const a=points(id,'curve');
    if(!Number.isFinite(flow)||flow<a[0].flow||flow>a.at(-1).flow)return null;
    const j=Math.max(1,a.findIndex(p=>p.flow>=flow)),lo=a[j-1],hi=a[j];
    return lo.oxygen+(hi.oxygen-lo.oxygen)*Math.log(flow/lo.flow)/Math.log(hi.flow/lo.flow);
  }
  function tested(rows,material,gravity,pressure,oxygen){
    const name=new RegExp(material.pattern,'i');
    const valid=(v,t,tol)=>v!==null&&v!==undefined&&String(v).trim()!==''&&Math.abs(Number(v)-t)<=tol;
    return rows.filter(r=>name.test(r.material+' '+(r.material_detail||''))&&valid(r.gravity_g,gravity,.02)&&valid(r.pressure_psia,pressure/6.8947573,.5)&&valid(r.o2_initial_pct,oxygen,1));
  }
  /* Constant-enthalpy Cantera 3.2 equilibrium, independent neutral diluents, K.
     Same repeat units, net heats, oxygen and pressure axes as build_master_equilibrium.py.
     Append the He species from nasa_gas.yaml to gri30.yaml's 53 species in an ideal-gas phase.
     For each fuel and starting oxygen x, set CO2, H2O and ballast to the product amounts
     in FUELS and nu_O2*(100/x-1). Start at 300 K, add the net heat per kilogram of products,
     and equilibrate('HP', solver='gibbs', rtol=1e-10). No nitrogen is added to He/Ar cases.
     Thermochemical source SHA-256:
     gri30.yaml 06650b1e0ee0012f6903d5328b1bb218cb6007d07f8ebe375d18f24811039345
     nasa_gas.yaml 4de6199d65d2d3db782e30573720c723130953707336add59713b02d8667e4db
  */
  const inertEquilibrium={"He":{"cellulose":[[1779.562,1781.316,1782.445,1783.486,1784.067,1784.541],[2128.58,2139.29,2146.57,2153.579,2157.636,2161.018],[2304.434,2322.783,2335.578,2348.171,2355.591,2361.858],[2407.737,2431.006,2447.41,2463.709,2473.389,2481.609],[2476.66,2503.283,2522.161,2541.012,2552.254,2561.83],[2526.499,2555.564,2576.246,2596.963,2609.35,2619.92],[2564.523,2595.454,2617.517,2639.664,2652.929,2664.262]],"polyethylene":[[1890.039,1893.01,1894.94,1896.73,1897.737,1898.559],[2271.368,2286.642,2297.171,2307.432,2313.429,2318.464],[2459.097,2483.306,2500.352,2517.273,2527.314,2535.836],[2571.233,2601.132,2622.374,2643.621,2656.309,2667.128],[2647.478,2681.333,2705.502,2729.78,2744.329,2756.765],[2703.525,2740.32,2766.671,2793.213,2809.153,2822.8],[2746.895,2785.979,2814.031,2842.34,2859.369,2873.964]]},"Ar":{"cellulose":[[1779.562,1781.316,1782.445,1783.486,1784.067,1784.541],[2128.58,2139.29,2146.57,2153.579,2157.636,2161.018],[2304.434,2322.783,2335.578,2348.171,2355.591,2361.858],[2407.737,2431.006,2447.41,2463.709,2473.389,2481.609],[2476.66,2503.283,2522.161,2541.012,2552.254,2561.83],[2526.499,2555.564,2576.246,2596.963,2609.35,2619.92],[2564.523,2595.454,2617.517,2639.664,2652.929,2664.262]],"polyethylene":[[1890.039,1893.01,1894.94,1896.73,1897.737,1898.559],[2271.368,2286.642,2297.171,2307.432,2313.429,2318.464],[2459.097,2483.306,2500.352,2517.273,2527.314,2535.836],[2571.233,2601.132,2622.374,2643.621,2656.309,2667.128],[2647.478,2681.333,2705.502,2729.78,2744.329,2756.765],[2703.525,2740.32,2766.671,2793.213,2809.153,2822.8],[2746.895,2785.979,2814.031,2842.34,2859.369,2873.964]]}};
  // Preserve phase, gravity, chamber oxygen and absolute pressure in one record.
  function materialCheck(rows,m,s){
    const matched=tested(rows,m,s.gravity,s.pressure,s.oxygen);
    return {ids:matched.map(r=>r.record_id),margin:m.margin,
      nearLunarReference:Math.abs(s.gravity-.165)<=.02 && Math.abs(s.pressure-8.2*6.8947573)<=.35 && s.diluent==='N2'};
  }
  function consumables(crew,days,leakLph,airlockM3,cycles,s){
    if(!Number.isInteger(crew)||!Number.isInteger(cycles)||[crew,days,leakLph,airlockM3,cycles].some(v=>!Number.isFinite(v)||v<0))throw RangeError('Enter nonnegative crew, duration and loss settings.');
    const air=atmosphere(s),dailyLostVolume=leakLph*.024+airlockM3*cycles;
    return {crewO2:crew*days*.84,crewCO2:crew*days,gasMakeup:air.massKg*dailyLostVolume*days/s.volume,
      lostO2:air.oxygenKg*dailyLostVolume*days/s.volume};
  }
  function bandTrial(s,oxygen,fuel,engine){
    if(!engine||s.pressure<30||s.pressure>110||s.volume<1||s.volume>60||oxygen<0||oxygen>40)return null;
    const {final}=engine.simulateCabin({fuel,volume:s.volume,pressure:s.pressure,diluent:s.diluent,oxygen,duration:120,crew:0,support:false,cutoff:18,length:40,density:2,speed:.3,power:0});
    return {endOxygen:final.oxygenPct,heatKJ:final.heatKJ};
  }
  function flameEstimate(s,fuel,engine){
    if(!engine||!['cellulose','polyethylene'].includes(fuel)||s.pressure<30||s.pressure>110||s.oxygen<10||s.oxygen>40)return null;
    if(s.diluent==='N2')return engine.equilibrium(fuel,s.oxygen,s.pressure);
    const spec=inertEquilibrium[s.diluent]?.[fuel];
    if(!spec)return null;
    const bracket=(values,n)=>{const j=values.findIndex((v,i)=>i&&n<=v);return [j-1,(n-values[j-1])/(values[j]-values[j-1])];};
    const [i,x]=bracket([10,15,20,25,30,35,40],s.oxygen),[j,y]=bracket([30,45,60,80,95,110],s.pressure);
    return (1-x)*((1-y)*spec[i][j]+y*spec[i][j+1])+x*((1-y)*spec[i+1][j]+y*spec[i+1][j+1]);
  }
  const api={materials:data.materials,atmosphere,points,boundary,tested,materialCheck,consumables,bandTrial,flameEstimate};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window==='undefined')return;
  const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!=null)n.textContent=value;if(cls)n.className=cls;return n;};
  const link=(t,h)=>{const a=el('a',t);a.href=h;if(h.startsWith('https:')){a.target='_blank';a.rel='noopener';}return a;};
  const fmt=(x,n=2)=>Number.isFinite(x)?Number(x.toFixed(n)).toLocaleString('en-US',{maximumFractionDigits:n}):'Outside scope';
  function select(choices,chosen){const n=el('select');for(const [id,label] of choices)n.add(new Option(label,id,false,id===chosen));return n;}
  function field(txt,input){const l=el('label',txt,'field');input.setAttribute('aria-label',txt);l.append(input);return l;}
  function numeric(value,min,max,step=1){const n=el('input');Object.assign(n,{type:'number',value,min,max,step,required:true});return n;}
  function table(headers,records){const wrap=el('div',null,'tablewrap');const t=el('table'),h=t.createTHead().insertRow(),body=t.createTBody();for(const cell of headers){const th=el('th',cell);th.scope='col';h.append(th);}for(const row of records){const tr=body.insertRow();for(const x of row){const td=tr.insertCell();if(x instanceof Node)td.append(x);else td.textContent=x;}}wrap.append(t);return wrap;}
  const panel=(title,sub)=>{const p=el('section',null,'panel stack master-panel');p.append(el('h2',title));if(sub)p.append(el('p',sub));return p;};
  function canvas(panel,aria){const c=el('canvas',null,'master-chart');c.width=780;c.height=310;c.setAttribute('role','img');c.setAttribute('aria-label',aria);panel.append(c);return c;}
  function chartBase(c,x,y,titleX,titleY,xTicks,yTicks){
    const ctx=c.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#f8f9f4';ctx.fillRect(0,0,c.width,c.height);ctx.font='14px system-ui';ctx.fillStyle='#26473e';
    for(const [axis,ticks] of [['x',xTicks],['y',yTicks]])for(const t of ticks){
      ctx.beginPath();ctx.strokeStyle='#d3dcd2';const xx=axis==='x'?x(t):55,yy=axis==='y'?y(t):14;ctx.moveTo(xx,yy);ctx.lineTo(axis==='y'?752:xx,axis==='x'?258:yy);ctx.stroke();
      ctx.textAlign=axis==='x'?'center':'right';ctx.fillText(t,axis==='x'?xx:48,axis==='x'?279:yy+4);
    }
    ctx.textAlign='center';ctx.fillText(titleX,400,305);ctx.save();ctx.translate(16,139);ctx.rotate(-Math.PI/2);ctx.fillText(titleY,0,0);ctx.restore();
    return ctx;
  }
  function flowChart(){
    const p=panel('Where does a flame cease to spread?','Compare flight observations with the published model for two thin materials under opposed airflow. Move the cursor to inspect a setting.');const choice=select(Object.entries(data.charts).map(([k,v])=>[k,v.title]),'pmma'),range=el('input');Object.assign(range,{type:'range',min:0,max:220,step:1,value:100});
    const controls=el('div',null,'master-fields');controls.append(field('Specimen',choice),field('Opposed flow (log scale)',range));p.append(controls);
    const c=canvas(p,'Limiting oxygen model (line), recorded spread (circles) and extinction (crosses) against airflow. Hatched areas lack nearby plotted observations.');
    const caption=el('p',null,'master-number');caption.setAttribute('aria-live','polite');const details=el('details'),summary=el('summary','Read plotted measurements');details.append(summary);const rows=el('div');details.append(rows);p.append(caption,el('p','Circles mark spread in parabolic flight. Crosses mark extinction. The line follows the authors’ prediction. Hatching marks flow ranges outside the displayed measurements. Coordinates are approximate readings of slide 26.'),details,link('JAXA FLARE report, slide 26 ↗',data.flowSource));
    function draw(){
      const id=choice.value,f=10**(+range.value/100),pred=boundary(id,f),lo=id==='pmma'?10:25,hi=id==='pmma'?27:38;
      const x=v=>55+697*Math.log10(v)/2.25,y=v=>258-(v-lo)*244/(hi-lo);
      const ctx=chartBase(c,x,y,'Opposed flow (cm/s, log scale)','Oxygen (vol%)',[1,2,5,10,20,50,100],[lo,lo+3,lo+6,lo+9,hi]);
      const measured=points(id,'sustained'),extinct=points(id,'extinct'),all=[...measured,...extinct],min=Math.min(...all.map(v=>v.flow)),max=Math.max(...all.map(v=>v.flow));
      if(ctx){ctx.save();ctx.beginPath();ctx.rect(55,14,697,244);ctx.clip();
        for(const [left,right] of [[55,x(min)],[x(max),752]]){ctx.save();ctx.beginPath();ctx.rect(left,14,right-left,244);ctx.clip();ctx.strokeStyle='#d9dfd8';ctx.lineWidth=1;for(let i=left-245;i<right;i+=13){ctx.beginPath();ctx.moveTo(i,258);ctx.lineTo(i+245,14);ctx.stroke();}ctx.restore();}
        ctx.strokeStyle='#246959';ctx.lineWidth=3;ctx.beginPath();points(id,'curve').forEach((s,i)=>i?ctx.lineTo(x(s.flow),y(s.oxygen)):ctx.moveTo(x(s.flow),y(s.oxygen)));ctx.stroke();
        ctx.fillStyle='#132f33';for(const s of measured){ctx.beginPath();ctx.arc(x(s.flow),y(s.oxygen),4.4,0,2*Math.PI);ctx.fill();}
        ctx.strokeStyle='#a34624';ctx.lineWidth=2;for(const s of extinct){const a=x(s.flow),b=y(s.oxygen);ctx.beginPath();ctx.moveTo(a-4,b-4);ctx.lineTo(a+4,b+4);ctx.moveTo(a-4,b+4);ctx.lineTo(a+4,b-4);ctx.stroke();}
        ctx.strokeStyle='#514e85';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(x(f),14);ctx.lineTo(x(f),258);ctx.stroke();ctx.restore();}
      caption.textContent=fmt(f,1)+' cm/s · '+(pred===null?'outside the published model curve':fmt(pred,1)+'% O₂ on the model curve')+'.';
    }
    function refresh(){rows.replaceChildren(table(['Series','Flow, cm/s','Oxygen, %'],['sustained','extinct'].flatMap(k=>points(choice.value,k).map(v=>[k,fmt(v.flow,1),fmt(v.oxygen,1)]))));draw();}
    choice.onchange=refresh;range.oninput=draw;refresh();return p;
  }
  function atmosphereChart(rows,params=new URLSearchParams()){
    const p=panel('Design the cabin atmosphere','Compare two atmospheres at 300 K. Change the gases, then check the pressure, fuel and crew implications against their sources.');
    const gasNames=[['N2','Nitrogen'],['He','Helium'],['Ar','Argon']];
    function group(title,entries){
      const block=el('fieldset',null,'ff-air-controls'),grid=el('div',null,'master-fields');
      block.append(el('legend',title),grid);for(const [label,input] of entries)grid.append(field(label,input));return block;
    }
    function side(primary){
      const names=primary?['Cabin pressure (kPa)','Oxygen by volume (%)','Diluent','Gravity A (Earth g)','Lower O₂ A (%)','Upper O₂ A (%)']:
        ['Comparison pressure (kPa)','Comparison oxygen (%)','Comparison gas','Gravity B (Earth g)','Lower O₂ B (%)','Upper O₂ B (%)'];
      const controls={pressure:numeric(primary?56.5:101.3,20,150,'any'),oxygen:numeric(primary?34:21,0,100,'any'),diluent:select(gasNames,'N2'),
        gravity:numeric(primary?.165:1,0,1,'any'),low:numeric(primary?30:20,0,100,'any'),high:numeric(primary?37:22,0,100,'any')};
      return {controls,block:group(primary?'Atmosphere A · your cabin':'Atmosphere B · comparison',Object.values(controls).map((v,i)=>[names[i],v]))};
    }
    const a=side(true),b=side(false),sides=el('div',null,'ff-air-pair');sides.append(a.block,b.block);p.append(sides);
    const shared={volume:numeric(12,1,1000,'any'),suit:numeric(29.6,5,100,'any'),crew:numeric(2,0,20),days:numeric(1,0,3650,'any'),
      leak:numeric(0,0,10000,'any'),airlock:numeric(1,0,100,'any'),cycles:numeric(1,0,100),fuel:select([['cellulose','Cellulose / paper'],['polyethylene','Polyethylene']],'cellulose')};
    // The vehicle editor can carry its actual A inputs and material IDs in a local link.
    for(const [key,control] of Object.entries({...a.controls,...shared})){
      const given=params.get(key);if(given===null||given.trim()==='')continue;
      const previous=control.value;control.value=given;
      if(!control.value||!control.checkValidity())control.value=previous;
    }
    const labels=['Cabin volume (m³)','Suit pressure (kPa)','Crew members','Mission days','Cabin gas leak (L/hour)','Gas lost per airlock cycle (m³)','Airlock cycles per day','Scenario fuel'];
    const advanced=el('details');advanced.append(el('summary','Crew, fuel and airlock inputs'),group('Shared scenario',Object.values(shared).map((v,i)=>[labels[i],v])));p.append(advanced);
    const materials=el('details'),pick=el('div',null,'ff-air-materials'),selection=new Set(params.has('materials')?params.get('materials').split(',').filter(id=>data.materials.some(m=>m.id===id)):['pmma','cellulose']);
    materials.append(el('summary','Materials in this comparison'),pick);p.append(materials);
    for(const m of data.materials){const l=el('label'),ck=el('input');ck.type='checkbox';ck.checked=selection.has(m.id);ck.onchange=()=>{if(ck.checked)selection.add(m.id);else selection.delete(m.id);};l.append(ck,document.createTextNode(m.name));pick.append(l);}
    if(params.has('materials')&&params.get('materials').split(',').some(id=>id&&!data.materials.some(m=>m.id===id)))materials.append(el('p','A vehicle item has no matched catalogue material. Its flight-test coverage and lunar correction are unestablished.'));
    const c=canvas(p,'Pressure and oxygen fraction. A circle represents atmosphere A, a diamond represents B, squares represent archived measurements.');const out=el('div'),note=el('p',null,'small');
    p.append(out,note,link('NASA exploration atmosphere design ↗',data.atmosSource));
    const assumptions=el('details');assumptions.append(el('summary','Equations, matching tolerances and sources'),
      el('p','Material rows match the same recorded label and three coordinates within 0.02 g, one oxygen percentage point and 0.5 psia. Other fuels, diluents, ignition methods and geometries can differ. A Table 2 margin belongs to its specimen and endpoint at 8.2 psia and simulated lunar gravity.'),
      link('ICES-2025-392, original Table 2 ↗',data.lunar),
      el('p','Metabolic budgets use nominal design allowances of 0.84 kg O₂ and 1.0 kg CO₂ per person-day. Leak and airlock losses replace dry cabin gas at the entered pressure, temperature and composition. Actual crew activity, recovery and leakage can differ.'),
      link('NASA life-support planning values, Table 3-24 ↗','https://ntrs.nasa.gov/citations/20210024855'),
      el('p','Both band endpoints run a prescribed 40 cm strip for 120 seconds at 0.3 cm/s and 2 g/cm. The assumed oxygen cutoff is 18%. Crew and gas-loss controls feed the mission budgets separately. The band-run model covers 1–60 m³, 30–110 kPa and 0–40% starting oxygen.'),
      el('p','The local stoichiometric gas-phase flame temperature includes dissociation. Cantera 3.2.0 solves enthalpy and pressure equilibrium using the solid net heating value, products and ballast at 300 K. Each fuel and diluent has its own 7 × 6 grid. Twenty off-grid helium/argon checks differed from direct solves by at most 1.785%. The grids cover 10–40% oxygen at 30–110 kPa. Helium and argon are neutral monatomic gases with nearly identical molar heat capacities; their mass inventories differ.'),
      link('Cantera gas-phase equilibrium method ↗','https://cantera.org/3.2/userguide/flame-temperature.html'));
    p.append(assumptions);
    const configs=rows.filter(r=>r.pressure_psia!=null&&String(r.pressure_psia).trim()&&r.o2_initial_pct!=null&&String(r.o2_initial_pct).trim()).map(r=>[Number(r.pressure_psia)*6.8947573,Number(r.o2_initial_pct)]);
    function read(controls){return Object.fromEntries(Object.entries(controls).map(([k,n])=>[k,n.type==='number'?n.valueAsNumber:n.value]));}
    function evidence(m,s){
      const v=materialCheck(rows,m,s),content=el('div');content.append(el('span',v.ids.length+' coordinate-matched rows'));
      if(v.ids.length){const d=el('details');d.append(el('summary','Inspect rows'));const list=el('ul');for(const id of v.ids){const li=el('li');li.append(link(id,'#atlas?record='+encodeURIComponent(id)));list.append(li);}d.append(list);content.append(d);}
      if(m.margin.length)content.append(el('small',(v.nearLunarReference?'Near the Table 2 reference conditions. ':'Table 2 reference only. ')+m.margin.map(([name,val])=>name+' '+val+' O₂ points').join(' · ')),link('Original Table 2 ↗',data.lunar));
      else content.append(el('small','No Table 2 margin for this material.'));
      return content;
    }
    function draw(){
      if([...Object.values(shared),...Object.values(a.controls),...Object.values(b.controls)].some(v=>!v.checkValidity())){out.textContent='Enter values within the indicated ranges.';c.hidden=true;note.textContent='';return;}
      const common=read(shared),s=[read(a.controls),read(b.controls)].map(v=>({...common,...v})),air=s.map(atmosphere);
      c.hidden=false;
      const x=v=>55+(v-20)*697/130,y=v=>258-v*244/100,ctx=chartBase(c,x,y,'Cabin pressure (kPa)','Oxygen (vol%)',[20,40,60,80,100,120,150],[0,20,40,60,80,100]);
      if(ctx){ctx.save();ctx.beginPath();ctx.rect(55,14,697,244);ctx.clip();for(let pressure=20;pressure<=150;pressure++){
        ctx.fillStyle='rgba(73,151,107,.20)';ctx.fillRect(x(pressure),y(21.3/pressure*100),6,2.1/pressure*244);
        if(s[0].diluent==='N2'){ctx.fillStyle='rgba(180,133,56,.13)';ctx.fillRect(x(pressure),14,6,Math.max(0,y(Math.max(0,100*(1-1.3*common.suit/pressure)))-14));}}
        ctx.fillStyle='#576f78';for(const [px,py] of configs)ctx.fillRect(x(px)-1.5,y(py)-1.5,3,3);
        const [ax,bx]=s.map(v=>x(v.pressure)),[ay,by]=s.map(v=>y(v.oxygen));ctx.lineWidth=3;ctx.strokeStyle='#9d3819';ctx.beginPath();ctx.arc(ax,ay,7,0,2*Math.PI);ctx.stroke();ctx.strokeStyle='#335f9c';ctx.beginPath();ctx.moveTo(bx,by-8);ctx.lineTo(bx+8,by);ctx.lineTo(bx,by+8);ctx.lineTo(bx-8,by);ctx.closePath();ctx.stroke();ctx.restore();}
      const engine=window.FFMasterPhysics,all=[];
      for(const [label,key] of [['Oxygen partial pressure (kPa)','pO2'],['Diluent partial pressure (kPa)','pDiluent'],['Nitrogen / suit pressure','ratio'],['Gas amount (mol)','moles'],['Gas mass (kg)','massKg'],['Diluent moles per O₂ mole','diluentPerO2'],['Dry oxygen-equivalent altitude (m)','altitudeM'],['Diluent heat capacity per O₂ mole (J/K)','diluentHeatPerO2']])all.push([label,...air.map(v=>fmt(v[key],key==='altitudeM'?0:2))]);
      const budgets=s.map(v=>consumables(v.crew,v.days,v.leak,v.airlock,v.cycles,v));
      for(const [label,key] of [['Crew oxygen demand (kg)','crewO2'],['Crew CO₂ to remove (kg)','crewCO2'],['Make-up gas for losses (kg)','gasMakeup'],['O₂ within make-up gas (kg)','lostO2']])all.push([label,...budgets.map(v=>fmt(v[key],3))]);
      for(const endpoint of ['low','high'])all.push([endpoint==='low'?'Lower band · fire calculation':'Upper band · fire calculation',...s.map(v=>{
        if(v.low>v.oxygen||v.high<v.oxygen)return 'Choose a band enclosing nominal O₂.';
        const trial=bandTrial(v,v[endpoint],common.fuel,engine);
        return trial?fmt(v[endpoint])+'% start → '+fmt(trial.endOxygen,3)+'% wet O₂ · '+fmt(trial.heatKJ)+' kJ':(engine?'Outside model domain':'Model unavailable');
      })]);
      all.push(['Adiabatic flame-zone temperature (K)',...s.map(v=>fmt(flameEstimate(v,common.fuel,engine),1))]);
      for(const m of data.materials.filter(m=>selection.has(m.id)))all.push([m.name+' · fire evidence',...s.map(v=>evidence(m,v))]);
      const earth=s[1].pressure===101.3&&s[1].oxygen===21&&s[1].diluent==='N2'&&s[1].gravity===1;
      out.replaceChildren(table(['Quantity','Your cabin',earth?'Earth reference':'Comparison B'],all));note.textContent='Circle A and diamond B show your two atmospheres. Squares show recorded pressure/oxygen combinations. Green spans pO₂ of 19.2–21.3 kPa. Gold shows the nitrogen-to-suit pressure ratio at or below 1.3 for A. Physiological clearance and material qualification require additional evidence.';
    }
    // Reuse the same numerical engines as the Physics and Vehicle instruments in offline and HTTP releases.
    if(!window.FFMasterPhysics && window.FFLoadAsset){
      Promise.all(['physics-lab.js','transport-lab.js','master-physics-data.js'].map(f=>window.FFLoadAsset(f))).then(()=>window.FFLoadAsset('master-physics.js')).then(draw).catch(draw);
    }
    p.oninput=draw;p.onchange=draw;draw();return p;
  }
  function cards(rows){
    const p=panel('Choose a material','See the tested specimen, the relevant archive records, and the limits of transferring the result.');const sel=select(data.materials.map(m=>[m.id,m.name]),'pmma');const info=el('div',null,'stack');p.append(field('Material',sel),info);
    function refresh(){const m=data.materials.find(a=>a.id===sel.value),re=new RegExp(m.pattern,'i'),matches=rows.filter(r=>re.test(r.material+' '+(r.material_detail||'')));
      info.replaceChildren(el('h3',m.name),el('p',m.family+'. '+m.behavior),el('p',matches.length+' normalized rows explicitly name this material or label. Related terminology may be recorded differently.'));
      if(m.margin.length)info.append(el('p','Table 2 gives conservative margins calculated from 1-g slopes. The direction column compares lunar limits with the Earth extrapolation. '+data.icesFigureNote),
        table(['Specimen or endpoint','Conservative margin (O₂ points)','Lunar limit vs. 1-g extrapolation'],m.margin.map(([label,n,direction])=>[label,fmt(n),direction])));
      if(matches.length){const d=el('details');d.append(el('summary','Browse '+matches.length+' matching source rows'));const ul=el('ul');for(const r of matches){const li=el('li');li.append(link(r.accession+' · '+r.test_id+' · '+r.material,'#atlas?record='+encodeURIComponent(r.record_id)));ul.append(li);}d.append(ul);info.append(d);}
      info.append(link('Read the source for this material ↗',m.source));
    }sel.onchange=refresh;refresh();return p;
  }
  function margins(){
    const p=panel('Five lunar-tested materials','Bars show Table 2 margins in oxygen points. Direction compares each lunar limit with the 1-g extrapolation. Fig. 13 and the single-material figures disagree on some limits.');
    for(const m of data.materials.filter(m=>m.margin.length))for(const [spec,n,direction] of m.margin){const row=el('div',null,'margin-row');row.append(el('span',m.name+' · '+spec));const rail=el('div',null,'margin-rail'),bar=el('div');bar.style.width=(100*n/2.3)+'%';rail.append(bar);row.append(rail,el('strong',n+' points'),el('span',direction==='Not stated'?direction:direction+' lunar limit'));p.append(row);}
    p.append(link('NASA ICES-2025-392, discussion and Table 2 ↗',data.lunar));return p;
  }
  function render(root,params=new URLSearchParams()){
    const rows=window.FF.tests||[];const header=el('header',null,'pagetitle');header.append(el('h1','Materials and atmosphere'),el('p','Trace a fire-safety comparison from a measured specimen to a proposed cabin.','sub'));
    const tabs=el('nav',null,'master-tabs');tabs.setAttribute('aria-label','Choose an instrument');const tab=params.get('tab')||'airflow';
    const instruments=[['airflow','Airflow limits',()=>flowChart()],['atmosphere','Cabin air',()=>atmosphereChart(rows,params)],['materials','Material library',()=>cards(rows)],['margins','Lunar margins',()=>margins()]];
    for(const [id,label] of instruments){const a=link(label,'#materials-lab?tab='+id);if(id===tab)a.setAttribute('aria-current','page');tabs.append(a);}
    root.replaceChildren(header,tabs,(instruments.find(x=>x[0]===tab)||instruments[0])[2]());
  }
  window.FFMaterials={...api,render};
})();
