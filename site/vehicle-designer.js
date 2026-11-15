/* FIRST FIRE vehicle designer. The run couples the selected specimen to the cabin solver;
   tracer, exterior, mobility and intervention budgets retain their separate observables. */
(() => {
  'use strict';
  const inNode=typeof module!=='undefined' && module.exports;
  const physics=inNode?require('./master-physics.js'):window.FFMasterPhysics;
  const catalog=()=>inNode?require('./materials-data.js').materials:window.FFMaterials?.materials||window.FFMaterialData.materials;
  const version='first-fire.vehicle.v1';
  const key='first-fire.vehicle-designer.v1';
  const R=8.31446261815324,gravity={Moon:.1654,Mars:.3782,Orbit:0,Earth:1};
  const sinks={'Lunar day':300,'Lunar night':225,'Mars day':275,'Mars night':235,'Earth reference':300,'Orbit reference':290};
  const references={cabin:'https://global.toyota/en/newsroom/corporate/27059582.html',chassis:'https://www.nasa.gov/moonbase-phases/',crew:'https://ntrs.nasa.gov/citations/20210024855',sensor:'https://www.nist.gov/publications/evaluation-spacecraft-smoke-detector-performance-low-gravity',material:'https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf'};
  // For all catalogue presets the name may be source-inspired. Numbers used here are team assumptions.
  const families={
    cabin:{title:'Pressure cabin',name:'Lunar Cruiser–style cabin',source:references.cabin,fields:{volume:['Free volume (m³)',12,1,50],extra:['Second compartment (m³)',3,.5,10],leak:['Leak (L of cabin gas/hour)',0,0,500],mass:['Cabin structure (kg)',600,0,5000]}},
    chassis:{title:'Chassis',name:'Lunar utility chassis',source:references.chassis,fields:{mass:['Chassis (kg)',800,100,5000],payload:['Other payload (kg)',40,0,1500],wheels:['Wheels',6,2,12,1]}},
    mobility:{title:'Mobility',name:'Electric wheel drive',source:references.cabin,fields:{speed:['Cruise speed (km/h)',8,.1,50],range:['Nominal range (km)',40,0,1000]}},
    power:{title:'Power',name:'Isolated battery pack',source:'',fields:{energy:['Stored energy (Wh)',20,0,2000],fault:['Fault input power (W)',90,0,3000],tankVolume:['Stored O₂ tank volume (L)',0,0,300],tankPressure:['O₂ tank pressure (kPa)',0,0,50000]}},
    thermal:{title:'Thermal control',name:'Cabin thermal loop',source:'',fields:{area:['Effective wall area (m²)',10,.1,100],coefficient:['Thermal conductance (W/m²/K)',8,0,10],coupling:['Exterior coupling fraction',.25,0,1]}},
    life:{title:'Life support',name:'Oxygen supply and scrubber',source:references.crew,fields:{makeup:['O₂ make-up (g/min)',3,0,40],scrub:['CO₂ removal (g/min)',4,0,60],tank:['O₂ stock (g)',4000,0,30000],filter:['Scrubber capacity (g CO₂)',5000,0,40000],section:['Mixing cross-section (m²)',.1,.005,2]}},
    access:{title:'Airlock / suitport',name:'Small airlock',source:'',fields:{volume:['Gas lost per cycle (m³)',1,0,5],cycles:['Cycles per day',1,0,20,1],suit:['Suit pressure (kPa)',29.6,15,60]}},
    crew:{title:'Crew',name:'Crew complement',source:references.crew,fields:{people:['People when aboard',2,0,4,1],heat:['Sensible heat (W/person)',90,0,300],mass:['Mass per person (kg)',80,0,150]}},
    sensors:{title:'Sensors',name:'Remote tracer monitor',source:references.sensor,fields:{threshold:['Tracer threshold (mg/m³)',1,.001,500],lag:['Response time constant (s)',5,0,120],o2:['Low O₂ threshold (%)',33,0,100],co2:['High CO₂ threshold (%)',.5,0,100],pulse:['Prescribed tracer pulse (mg)',90,0,2000]}},
    suppression:{title:'Suppression',name:'Portable response unit',source:'',fields:{stock:['Agent stock (kg)',1,0,20],flow:['Agent delivery (g/s)',30,0,500],delay:['Intervention delay after crossing (s)',2,0,300],vent:['Overboard vent (L/s)',30,0,1000]}},
    interior:{title:'Interior / ignition specimen',name:'Instrumented material strip',source:references.material,fields:{length:['Active strip length (cm)',40,10,100],density:['Linear fuel mass (g/cm)',2,.1,10],speed:['Imposed front speed (cm/s)',.3,0,2],cutoff:['Stop spread below O₂ (%)',18,5,30]}}
  };
  const wallMaterials={
    al6061:{name:'6061-T6 aluminium',coeff:[.07918,1.0957,-.07277,.08084,.02803,-.09464,.04179,-.00571,0],source:'https://trc.nist.gov/cryogenics/materials/6061%20Aluminum/6061_T6Aluminum_rev.htm'},
    ss304:{name:'304 stainless steel',coeff:[-1.4087,1.3982,.2543,-.6260,.2334,.4256,-.4658,.1650,-.0199],source:'https://trc.nist.gov/cryogenics/materials/304Stainless/304Stainless_rev.htm'}
  };
  const propertyLabels={heatMJkg:'Heat of combustion',oxygenKgKg:'O₂ demand',density:'Density',pyrolysisK:'Pyrolysis temperature',oxygenLimitPct:'Reported oxygen limit'};
  const provenanceTags=['measured','reference','assumed','theoretical'];
  Object.assign(families.cabin.fields,{
    designPressure:['Design differential pressure (kPa)',101.325,0,400],
    thicknessMm:['Solid wall thickness (mm)',3,0,100]
  });
  Object.assign(families.power.fields,{
    h2Volume:['H₂ tank internal volume (L)',0,0,1000],h2Pressure:['H₂ absolute storage pressure (kPa)',0,0,70000],
    h2Z:['H₂ compressibility factor at 300 K',1,.2,3],o2Z:['O₂ compressibility factor at 300 K',1,.2,3]
  });
  const exteriorPressure={Moon:0,Orbit:0,Mars:.6,Earth:101.325};
  function wallResistance(cabin,thermal) {
    const wall=wallMaterials[cabin.wallMaterial];
    const logT=Math.log10(300),logK=wall.coeff.reduceRight((a,x)=>a*logT+x,0);
    const k=10**logK,t=cabin.numbers.thicknessMm/1000,h=thermal.coefficient;
    return {material:wall.name,conductivityWmK:k,source:wall.source,referenceTemperatureK:300,
      shellResistanceM2KW:t/k,overallWm2K:h/(1+h*t/k),wallUAWK:thermal.area*h/(1+h*t/k)};
  }
  function materialProperty(material,key){
    const p=material.properties?.[key];
    return p?{tag:p.tag,source:p.source||null,locator:p.locator||null}:
      {tag:'assumed',source:null,locator:null};
  }
  function migrate(d){
    if(!Array.isArray(d?.parts))return d;
    const cabin=d.parts.find(p=>p.family==='cabin'),power=d.parts.find(p=>p.family==='power');
    if(!cabin?.numbers||!power?.numbers||!d.conditions)return d;
    if(cabin.wallMaterial!==undefined && cabin.numbers.thicknessMm!==undefined && cabin.numbers.designPressure!==undefined &&
        ['h2Volume','h2Pressure','h2Z','o2Z'].every(k=>power.numbers[k]!==undefined) && d.conditions.exteriorKpa!==undefined)return d;
    const out=clone(d),c=out.parts.find(p=>p.family==='cabin'),e=out.parts.find(p=>p.family==='power');
    if(c.wallMaterial===undefined)c.wallMaterial='al6061';
    c.numbers={thicknessMm:0,designPressure:101.325,...c.numbers};
    e.numbers={h2Volume:0,h2Pressure:0,h2Z:1,o2Z:1,...e.numbers};
    if(out.conditions.exteriorKpa===undefined)out.conditions.exteriorKpa=exteriorPressure[out.conditions.surface];
    return out;
  }
  const alternatives={
    cabin:[['Small pressure pod',{volume:4,extra:1,mass:210}]],chassis:[['Four-wheel utility chassis',{mass:450,wheels:4,payload:25}]],mobility:[['Long-range drive concept',{speed:12,range:1000}]],
    power:[['Fuel cell and oxygen store',{energy:700,fault:120,tankVolume:12,tankPressure:20000,h2Volume:24,h2Pressure:20000}],['Solar array and buffer pack',{energy:400,fault:40,tankVolume:0,tankPressure:0}]],
    thermal:[['High-area radiator and coolant loop',{area:18,coefficient:5,coupling:.45}]],life:[['Short-duration oxygen and scrubber',{makeup:2,scrub:2,tank:1000,filter:1000,section:.05}]],
    access:[['Suitport with residual cycle loss',{volume:.08,cycles:2}]],crew:[['Single operator',{people:1,heat:90,mass:80}]],sensors:[['Co-located instrument package',{threshold:.5,lag:2,pulse:90}]],
    suppression:[['Water-mist delivery unit',{stock:2,flow:50,delay:3,vent:0}],['Overboard vent controller',{stock:0,flow:0,vent:120,delay:1}]],interior:[['Short interior strip',{length:20,density:1.5,speed:.18}]]
  };
  const initial=(created=new Date().toISOString())=>({schema:version,created,name:'Lunar cabin · material trial',parts:Object.entries(families).map(([family,p])=>({family,...(family==='cabin'?{wallMaterial:'al6061'}:{}),name:p.name,origin:'reference',source:p.source,assumption:'Preset engineering values for this scenario.',numbers:Object.fromEntries(Object.entries(p.fields).map(([k,f])=>[k,f[1]]))})),conditions:{surface:'Moon',exteriorKpa:0,gravity_g:gravity.Moon,outside:'Lunar day',ventilation:'set speed',fan:.2,ignition:'heater',fire_zone:'cabin',sensor_zone:'equipment bay',sensor_kind:'passive tracer',hatch:'closed',crew:'absent',activity:'nominal',support:false,duration_s:120,response:'none',monitor:'temperatureK',threshold:310},atmosphere:{pressure:56.54,oxygen:34,diluent:'N2',low:30,high:37},items:[{name:'Ignition coupon',material:'cellulose',mass_kg:.08,area_m2:.04,zone:'cabin',origin:'Earth'},{name:'Stowed liner',material:'polyethylene',mass_kg:.12,area_m2:.20,zone:'equipment bay',origin:'Earth'}],selected:0,customMaterials:[]});
  const ranges={exteriorKpa:[0,120],gravity_g:[0,1],fan:[0,2],duration_s:[120,1800],threshold:[-1000,10000]};
  const choices={surface:Object.keys(gravity),outside:Object.keys(sinks),ventilation:['fan off','set speed'],ignition:['heater','overheated wire','battery fault','none'],fire_zone:['cabin','equipment bay','behind panel'],sensor_zone:['cabin','equipment bay','behind panel'],sensor_kind:['passive tracer','light-scattering smoke','ionization smoke','oxygen','carbon dioxide','carbon monoxide'],hatch:['closed','open internal hatch'],crew:['absent','present'],activity:['nominal','sleep','aerobic'],response:['none','fan off','isolate power','discharge CO₂','water mist','vent gas'],monitor:['temperatureK','co2Pct','oxygenPct','pressureKpa','heatKJ','positionCm']};
  const metrics={temperatureK:['Cabin temperature','K'],co2Pct:['Carbon dioxide','%'],oxygenPct:['Oxygen','%'],pressureKpa:['Cabin pressure','kPa'],heatKJ:['Chemical heat','kJ'],positionCm:['Front travel','cm']};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const finite=(v,lo,hi)=>Number.isFinite(v)&&v>=lo&&v<=hi;
  function check(ok,msg){if(!ok)throw Error(msg);}
  function smallText(s,max=120){return typeof s==='string'&&s.trim().length>0&&s.length<=max;}
  function safeLink(url){try{return ['http:','https:'].includes(new URL(url).protocol);}catch{return false;}}
  function materials(d){return [...catalog(),...d.customMaterials];}
  function validate(d){
    d=migrate(d);
    check(d?.schema===version&&smallText(d.name)&&smallText(d.created)&&Number.isFinite(Date.parse(d.created)),'Choose a valid version 1 vehicle design with a name and creation time.');
    check(Array.isArray(d.parts)&&d.parts.length===Object.keys(families).length&&new Set(d.parts.map(p=>p.family)).size===d.parts.length,'Provide exactly one part in each family.');
    for(const p of d.parts){const def=families[p.family];check(Object.hasOwn(families,p.family)&&def&&smallText(p.name)&&['reference','custom','theoretical'].includes(p.origin)&&typeof p.source==='string'&&(!p.source||safeLink(p.source))&&typeof p.assumption==='string'&&p.assumption.length<=600,'Check the part name, origin and source URL.');
      if(p.family==='cabin')check(Object.hasOwn(wallMaterials,p.wallMaterial),'Choose a supported wall material.');
      for(const [k,[label,,lo,hi,integer]] of Object.entries(def.fields))check(finite(p.numbers?.[k],lo,hi)&&(!integer||Number.isInteger(p.numbers[k])),p.name+' · '+label+' must be '+lo+'–'+hi+'.');}
    for(const [k,a] of Object.entries(choices))check(a.includes(d.conditions?.[k]),'Choose a supported '+k+'.');
    for(const [k,[lo,hi]] of Object.entries(ranges))check(finite(d.conditions[k],lo,hi),k+' must be '+lo+'–'+hi+'.');
    check(Number.isInteger(d.conditions.duration_s)&&typeof d.conditions.support==='boolean','Use whole seconds and a valid life-support state.');
    const a=d.atmosphere;check(a&&finite(a.pressure,30,110)&&finite(a.oxygen,0,40)&&['N2','He','Ar'].includes(a.diluent)&&finite(a.low,0,a.oxygen)&&finite(a.high,a.oxygen,40),'Use 30–110 kPa and an oxygen band between 0% and 40% enclosing the nominal value.');
    check(Array.isArray(d.customMaterials)&&d.customMaterials.length<=12,'Up to 12 custom materials are supported.');
    const ids=new Set(catalog().map(m=>m.id));for(const m of d.customMaterials){check(/^user-[a-z0-9-]{1,40}$/.test(m.id)&&!ids.has(m.id)&&smallText(m.name)&&smallText(m.family)&&smallText(m.behavior,500),'Custom material names, families and IDs must be distinct.');ids.add(m.id);
      for(const [key,limit] of [['heatMJkg',100],['oxygenKgKg',10],['density',30000],['pyrolysisK',4000]])check(m[key]===null||finite(m[key],0,limit),'Invalid custom material '+key+'.');if(m.oxygenLimitPct!=null)check(finite(m.oxygenLimitPct,0,100)&&smallText(m.limitConditions,500),'A material oxygen limit needs test conditions and an endpoint.');
      if(m.properties!==undefined){
        check(m.properties && typeof m.properties==='object' && !Array.isArray(m.properties),'Use a property-provenance object.');
        for(const [name,tag] of Object.entries(m.properties)){
          check(Object.hasOwn(propertyLabels,name) && tag && provenanceTags.includes(tag.tag) &&
            typeof tag.source==='string' && (!tag.source || safeLink(tag.source)) && typeof tag.locator==='string' && tag.locator.length<=500,
            'Invalid property provenance for '+name+'.');
          if(m[name]!==null && ['measured','reference'].includes(tag.tag))check(safeLink(tag.source)&&smallText(tag.locator,500),'Cite a URL and page, table, or test for '+name+'.');
        }
      }
      check(typeof m.source==='string'&&(!m.source||safeLink(m.source)),'Enter an HTTP(S) material source or leave it blank.');}
    check(Array.isArray(d.items)&&d.items.length>=1&&d.items.length<=30&&Number.isInteger(d.selected)&&d.selected>=0&&d.selected<d.items.length,'Choose an ignition specimen from 1–30 interior items.');
    for(const i of d.items)check(smallText(i.name)&&ids.has(i.material)&&finite(i.mass_kg,0,1000)&&finite(i.area_m2,.0001,10000)&&choices.fire_zone.includes(i.zone)&&['Earth','on-site'].includes(i.origin),'Check each item’s name, material, mass, area, origin and zone.');return d;
  }
  function inventory(d){const library=new Map(materials(d).map(m=>[m.id,m]));let heatMJ=0,oxygenKg=0,massKg=0;const unknownHeat=[],unknownOxygen=[];
    for(const [n,i] of d.items.entries()){const m=library.get(i.material);massKg+=i.mass_kg;if(!i.mass_kg)continue;if(m.heatMJkg==null)unknownHeat.push(n);else heatMJ+=i.mass_kg*m.heatMJkg;if(m.oxygenKgKg==null)unknownOxygen.push(n);else oxygenKg+=i.mass_kg*m.oxygenKgKg;}
    return {massKg,heatMJ,oxygenKg,unknownHeat,unknownOxygen};}
  // Equal-volume exchange conserves tracer mass. The sensor reads a local concentration through a first-order lag.
  function detector(d,volume,part){const c=d.conditions,source=c.fire_zone===c.sensor_zone,zoneV=volume/2,h=.25;
    const mass=c.ignition==='none'?0:part.sensors.pulse,rate=mass/15,srcFactor={'cabin':1,'equipment bay':.65,'behind panel':.2}[c.fire_zone];
    const fan=c.ventilation==='fan off'?0:c.fan,exchange=fan*part.life.section*srcFactor;
    let a=0,b=0,reading=0,peak=0,cross=null,responseAt=null,emitted=0;
    for(let i=1;i<=c.duration_s/h;i++){const t=i*h;const added=t<=15?rate*h:0;emitted+=added;a+=added;
      const flow=c.response==='fan off'&&responseAt!==null&&t>=responseAt?0:exchange;
      const shift=(a-b)*(-Math.expm1(-2*flow*h/zoneV))/2;a-=shift;b+=shift;
      const raw=(source?a:b)/zoneV,previous=reading;reading=part.sensors.lag?reading+(raw-reading)*(-Math.expm1(-h/part.sensors.lag)):raw;peak=Math.max(peak,reading);
      if(cross===null&&reading>=part.sensors.threshold&&reading>previous){cross=t-h+h*(part.sensors.threshold-previous)/(reading-previous);responseAt=cross+part.suppression.delay;}}
    return {cross,responseAt:responseAt!==null&&responseAt<=c.duration_s?responseAt:null,peak,exchangeLps:exchange*1000,emittedMg:emitted,massResidualMg:emitted-a-b,kind:'Prescribed passive tracer; hardware smoke response is uncalibrated.'};}
  function atmos(a,volume,suit){const provided=inNode?require('./master-materials.js').atmosphere:window.FFMaterials?.atmosphere;if(provided)return provided({...a,volume,suit});const x=a.oxygen/100,moles=a.pressure*1000*volume/(R*300),pO2=x*a.pressure,pDiluent=a.pressure-pO2;
    return {pO2,pDiluent,moles,ratio:a.diluent==='N2'?pDiluent/suit:null,massKg:moles*(x*.031998+(1-x)*({N2:.0280134,Ar:.039948,He:.004003}[a.diluent]))};}
  function materialEvidence(d,archive) {
    const matcher=inNode?require('./master-materials.js').tested:window.FFMaterials?.tested;
    const target=[d.conditions.gravity_g,d.atmosphere.oxygen,d.atmosphere.pressure/6.894757293];
    const library=materials(d),ids=[...new Set(d.items.map(i=>i.material))];
    return ids.map(id=>{
      const mat=library.find(m=>m.id===id),curated=catalog().find(m=>m.id===id);
      const namePattern=curated?new RegExp(curated.pattern,'i'):null;
      const rows=archive?.rows;
      const candidates=namePattern&&rows?rows.filter(r=>namePattern.test((r.material||'')+' '+(r.material_detail||''))):[];
      const matches=curated&&rows&&matcher?matcher(rows,curated,d.conditions.gravity_g,d.atmosphere.pressure,d.atmosphere.oxygen):null;
      const describe=r=>({id:r.record_id,source:r.source_url,material:r.material,endpoint:r.observation_type||r.outcome||null,
        gravityG:r.gravity_g,pressurePsia:r.pressure_psia,oxygenPct:r.o2_initial_pct});
      return {id,name:mat.name,candidateCount:rows&&curated?candidates.length:null,jointCount:matches?.length??null,
        joint:matches?.map(describe)||[],nearest:archive?.rank?archive.rank(candidates,target,[1,1,1]).slice(0,3).map(x=>({...describe(x.r),known:x.known})):[],
        margin:curated?.margin?.map(([specimen,value])=>({specimen,oxygenPoints:value,direction:curated.direction,
          source:curated.source,locator:'Table 2, ICES-2025-392',pressurePsia:8.2}))||[],
        reportedLimit:!curated&&Number.isFinite(mat.oxygenLimitPct)?{oxygenPct:mat.oxygenLimitPct,conditions:mat.limitConditions,...materialProperty(mat,'oxygenLimitPct')}:null,
        scope:curated?'Coordinates and material text only. Compare geometry, component, flow and endpoint in the source.':
          'Custom material has no curated archive identity or published lunar margin.'};
    });
  }

  // A separate, conditional branch freezes the fire/crew sources at first response.
  // It isolates the mole and pressure consequences of the action without inventing extinction kinetics.
  function interventionTrace(cabin,trigger,mode,stock,volume,end) {
    if(!cabin||trigger===null||!['discharge CO₂','vent gas'].includes(mode))return null;
    const hi=cabin.trace.findIndex(v=>v.seconds>=trigger);
    if(hi<0)return null;
    const right=cabin.trace[hi],left=cabin.trace[Math.max(0,hi-1)],span=right.seconds-left.seconds;
    const f=span?(trigger-left.seconds)/span:0;
    const state=k=>left[k]+f*(right[k]-left[k]);
    const temperatureK=state('temperatureK'),initial=state('pressureKpa')*1000*volume/(R*temperatureK);
    const oxygen=initial*state('oxygenPct')/100,co2=initial*state('co2Pct')/100;
    const times=[trigger,...cabin.trace.map(t=>t.seconds).filter(t=>t>trigger&&t<=end)];
    const trace=times.map(seconds=>{
      const age=seconds-trigger;
      const retained=mode==='vent gas'?Math.exp(-stock.vent*age/(1000*volume)):1;
      const added=mode==='discharge CO₂'?Math.min(stock.stock,stock.flow*age/1000)/.044009:0;
      const total=initial*retained+added,remainingO2=oxygen*retained,remainingCO2=co2*retained+added;
      return {seconds,addedCO2Mol:added,ventedMol:initial*(1-retained),totalMol:total,oxygenMol:remainingO2,
        co2Mol:remainingCO2,pressureKpa:total*R*temperatureK/volume/1000,
        oxygenPct:total===0?null:mode==='vent gas'?state('oxygenPct'):100*remainingO2/total,
        co2Pct:total===0?null:mode==='vent gas'?state('co2Pct'):100*remainingCO2/total,oxygenPartialKpa:remainingO2*R*temperatureK/volume/1000};
    });
    return {mode,temperatureK,startMol:initial,trace,final:trace.at(-1),scope:'Isothermal, well-mixed branch from the interpolated trigger state. Subsequent combustion and crew inputs are held at zero. Gas added at cabin temperature. Vent flow is a prescribed cabin-volume rate. Extinction, nozzle flow and phase change require separate measurements.'};
  }

  function derive(d,archive){d=validate(d);const part=Object.fromEntries(d.parts.map(p=>[p.family,p.numbers])),c=d.conditions,a=d.atmosphere,item=d.items[d.selected],material=materials(d).find(m=>m.id===item.material);
    const volume=part.cabin.volume+(c.hatch==='open internal hatch'?part.cabin.extra:0),air=atmos(a,volume,part.access.suit),load=inventory(d);
    const wall=wallResistance(d.parts.find(p=>p.family==='cabin'),part.thermal);
    const storage={oxygenKg:part.power.tankPressure*part.power.tankVolume/(R*300*part.power.o2Z)*.031998,
      hydrogenKg:part.power.h2Pressure*part.power.h2Volume/(R*300*part.power.h2Z)*.00201588,temperatureK:300,
      o2Z:part.power.o2Z,h2Z:part.power.h2Z,scope:'Separate power tanks. Amount uses PV = ZnRT. Z = 1 is an ideal-gas assumption.'};
    const tracer=detector(d,volume,part),stock=part.suppression;
    const sensor={...tracer,technology:c.sensor_kind};
    if(c.sensor_kind!=='passive tracer'){sensor.cross=null;sensor.responseAt=null;sensor.peak=null;}
    const supported=['cellulose','polyethylene'].includes(material.id),exposed=item.zone===c.fire_zone,active=c.ignition!=='none'&&exposed&&item.mass_kg>0&&!(material.heatMJkg===0&&material.oxygenKgKg===0);
    const assumptions={...physics.defaults,planet:c.surface==='Mars'?'Mars':'Moon',fuel:supported?material.id:'cellulose',volume,pressure:a.pressure,oxygen:a.oxygen,diluent:a.diluent,
      fuelMassG:item.mass_kg*1000,cutoff:part.interior.cutoff,length:part.interior.length,density:part.interior.density,speed:active&&supported?part.interior.speed:0,chassisMass:part.chassis.mass,
      duration:c.duration_s,crew:c.crew==='present'?part.crew.people:0,activity:c.activity,support:c.support,crewHeatW:part.crew.heat,makeupGmin:part.life.makeup,scrubGmin:part.life.scrub,oxygenTankG:part.life.tank,scrubCapacityG:part.life.filter,
      wallUA:wall.wallUAWK,wallTemperatureK:300+(sinks[c.outside]-300)*part.thermal.coupling,
      capacity:part.power.energy,power:c.ignition==='battery fault'?part.power.fault:c.ignition==='overheated wire'?part.power.fault*.25:0,
      batteryOffAtS:86400};
    // Unknown active chemistry suppresses the reactive trajectory rather than substituting paper.
    let cabin=active&&!supported?null:physics.simulateCabin(assumptions);
    if(cabin&&['oxygen','carbon dioxide'].includes(c.sensor_kind)){
      const isO2=c.sensor_kind==='oxygen',k=isO2?'oxygenPct':'co2Pct',limit=isO2?part.sensors.o2:part.sensors.co2;
      let read=cabin.trace[0][k],t=0;const crossed=v=>isO2?v<=limit:v>=limit;
      if(crossed(read))sensor.cross=0;
      for(const v of cabin.trace.slice(1)){const last=read,dt=v.seconds-t;read=part.sensors.lag?last+(v[k]-last)*(-Math.expm1(-dt/part.sensors.lag)):v[k];
        if(sensor.cross===null&&crossed(read)&&last!==read)sensor.cross=t+dt*(limit-last)/(read-last);t=v.seconds;}
      sensor.responseAt=sensor.cross!==null&&sensor.cross+stock.delay<=c.duration_s?sensor.cross+stock.delay:null;
      sensor.kind='Well-mixed cabin gas with an assumed sensor lag. No gas concentration gradients are resolved.';
    }else if(c.sensor_kind!=='passive tracer')sensor.kind='A material-specific smoke response or a CO production calibration is required for a hardware crossing.';
    const trigger=sensor.responseAt,available=trigger===null?0:Math.max(0,c.duration_s-trigger);
    const releasedKg=['discharge CO₂','water mist'].includes(c.response)?Math.min(stock.stock,stock.flow*available/1000):0;
    if(cabin&&c.response==='isolate power'&&trigger!==null){assumptions.batteryOffAtS=trigger;cabin=physics.simulateCabin(assumptions);}

    const limits=cabin?[a.low,a.high].map(oxygen=>{const r=physics.simulateCabin({...assumptions,oxygen});return {oxygen,heatKJ:r.final.heatKJ,endOxygen:r.final.oxygenPct};}):[];
    const initialO2=air.moles*a.oxygen/100*.031998,flowLoss=part.cabin.leak/1000*24+part.access.cycles*part.access.volume;
    const resp={mode:c.response,releasedKg,availableSeconds:available,ventFraction:c.response==='vent gas'?(-Math.expm1(-stock.vent/1000*available/volume)):0,co2MixPct:null,waterLatentUpperKJ:null};
    if(cabin&&releasedKg&&c.response==='discharge CO₂'){const n=Object.values(cabin.moles).reduce((x,y)=>x+y,0),added=releasedKg/.044009;resp.co2MixPct=100*(cabin.moles.co2+added)/(n+added);}
    if(c.response==='water mist')resp.waterLatentUpperKJ=releasedKg*2257;
    resp.transient=interventionTrace(cabin,trigger,c.response,stock,volume,c.duration_s);
    const rows=archive?.rows?.filter(r=>r.phase==='solid')||[],target=[c.gravity_g,a.oxygen,a.pressure/6.894757293];
    const comparison=archive?archive.coverage(rows,target):null,nearest=archive?archive.rank(rows,target,[1,1,1]).slice(0,3).map(x=>({id:x.r.record_id,material:x.r.material,source:x.r.source_url,know:x.known,score:x.score})):[];
    const selectedEvidence=materialEvidence(d,archive),matchedMaterial=selectedEvidence.find(e=>e.id===material.id)?.jointCount;
    const theoretical=d.parts.some(p=>p.origin==='theoretical')||materials(d).some(m=>d.items.some(i=>i.material===m.id)&&Object.keys(propertyLabels).some(k=>m[k]!=null&&m.properties?.[k]?.tag==='theoretical')),uncertain=['Moon','Mars'].includes(c.surface)||!matchedMaterial||!supported;
    const front=cabin?.trace||[],line=c.monitor,cut=c.threshold;let crossing=null;
    for(let i=0;i<front.length;i++){const hit=line==='oxygenPct'?front[i][line]<=cut:front[i][line]>=cut;if(!hit)continue;const first=front[i],last=front[i-1];crossing=last&&first[line]!==last[line]?last.seconds+(first.seconds-last.seconds)*(cut-last[line])/(first[line]-last[line]):first.seconds;break;}
    const mass=part.cabin.mass+part.chassis.mass+part.chassis.payload+load.massKg+assumptions.crew*part.crew.mass+storage.oxygenKg+storage.hydrogenKg;
    const pressurePeak=cabin?Math.max(...cabin.trace.map(row=>row.pressureKpa)):null;
    const rating={designDifferentialKpa:part.cabin.designPressure,exteriorKpa:c.exteriorKpa,
      initialDifferentialKpa:a.pressure-c.exteriorKpa,peakInternalKpa:pressurePeak,
      headroomKpa:pressurePeak==null?null:part.cabin.designPressure-Math.max(0,pressurePeak-c.exteriorKpa),
      scope:'Screening against the investigator’s differential pressure rating at sampled times. Strength, buckling, relief dynamics and rupture are unresolved.'};
    const dependencies=outputProvenance(d,material,matchedMaterial);
    return {air,load,limits,initialO2,storage,rating,materialEvidence:selectedEvidence,outputProvenance:dependencies,balances:balance(cabin),sensor,response:resp,cabin,assumptions,theoretical,propertyStatus:theoretical?'theoretical':'assumed',supported,exposed,material:material.id,
      housing:{volume,storedTankOxygenKg:storage.oxygenKg,gasLossKgPerDay:flowLoss*air.massKg/volume,weightN:mass*9.80665*c.gravity_g,massKg:mass,loadPerWheelN:mass*9.80665*c.gravity_g/part.chassis.wheels,nominalHours:part.mobility.range/part.mobility.speed,bearingCount:part.chassis.wheels},
      thermal:{...wall,wallK:assumptions.wallTemperatureK,buoyancyScaleMs:Math.sqrt(Math.max(0,c.gravity_g*9.80665*.05*300/300)),exteriorReferenceK:sinks[c.outside]},
      crossing,nearest,joint:comparison?.matches.length??null,complete:comparison?.complete??null,confidence:uncertain||theoretical?'Low':'Medium',reason:!supported?'Active material has no supported complete-combustion equation.':!matchedMaterial?'No material-specific archive record jointly matches gravity, ambient oxygen and pressure.':'Matched atmosphere coordinates still leave specimen and model transfer unvalidated.'};}
  function balance(r){
    if(!r)return null;
    const s=r.scenario,n=r.moles,formula=s.fuel==='cellulose'?{mass:162.141,c:6,h:10,o:5}:{mass:14.027,c:1,h:2,o:0};
    const initial=s.pressure*1000*s.volume/(R*300),extent=r.final.positionCm*s.density/formula.mass;
    const crewO2=r.crewO2G/31.998,crewCO2=r.crewCO2G/44.009,make=r.makeupG/31.998,scrub=r.scrubbedG/44.009;
    const discrepancy={carbon:n.co2+scrub-crewCO2-formula.c*extent,hydrogen:2*n.water-formula.h*extent,
      oxygen:2*n.oxygen+2*n.co2+n.water+2*scrub+2*crewO2-2*crewCO2-2*make-2*initial*s.oxygen/100-formula.o*extent,
      inert:(n.nitrogen+(n.argon||0)+(n.helium||0))-initial*(1-s.oxygen/100)};
    return {residualMoles:discrepancy,maxAbsoluteMoles:Math.max(...Object.values(discrepancy).map(Math.abs)),energyResidualJ:r.energyResidualJ};
  }
  function provenance(d){const inputs={};for(const p of d.parts)for(const k of Object.keys(p.numbers))inputs['parts.'+p.family+'.'+k]={tag:p.origin==='theoretical'?'theoretical':'assumed',source:p.source||null};
    for(const [k,v] of Object.entries(d.conditions))if(typeof v==='number')inputs['conditions.'+k]={tag:'assumed'};
    for(const [k,v] of Object.entries(d.atmosphere))if(typeof v==='number')inputs['atmosphere.'+k]={tag:'assumed'};
    d.items.forEach((v,i)=>{for(const k of ['mass_kg','area_m2'])inputs['items.'+i+'.'+k]={tag:'assumed'};});
    for(const m of materials(d))for(const k of Object.keys(propertyLabels)){
      if(m[k]===null||m[k]===undefined)continue;
      const curated=catalog().find(entry=>entry.id===m.id);
      inputs['materials.'+m.id+'.'+k]=curated?{tag:['heatMJkg','oxygenKgKg'].includes(k)?'reference':'assumed',source:curated.source||null,
        locator:['heatMJkg','oxygenKgKg'].includes(k)?'Published heating value or dry-fuel stoichiometry.':null}:materialProperty(m,k);
    }
    const cabin=d.parts.find(p=>p.family==='cabin');
    inputs['walls.conductivityWmK']={tag:'reference',source:wallMaterials[cabin.wallMaterial].source,locator:'Thermal conductivity correlation at 300 K'};
    return inputs;}
  function outputProvenance(d,selected,jointCount) {
    const inputs=provenance(d),all=Object.keys(inputs);
    const active='items.'+d.selected+'.mass_kg';
    const fuelKeys=field=>[...new Set(d.items.flatMap((i,j)=>i.mass_kg>0?['items.'+j+'.mass_kg','materials.'+i.material+'.'+field]:[]))];
    const wall=['parts.cabin.thicknessMm','parts.thermal.coefficient','parts.thermal.area','walls.conductivityWmK'];
    const gas=['atmosphere.pressure','atmosphere.oxygen','parts.cabin.volume',...(d.conditions.hatch==='open internal hatch'?['parts.cabin.extra']:[])];
    const power=['parts.power.energy','parts.power.fault'];
    const tank=['parts.power.tankVolume','parts.power.tankPressure','parts.power.o2Z','parts.power.h2Volume','parts.power.h2Pressure','parts.power.h2Z'];
    const thermal=[...wall,'parts.thermal.coupling'];
    const reaction=[active,'materials.'+selected.id+'.heatMJkg','materials.'+selected.id+'.oxygenKgKg','parts.interior.'];
    const trace=[...gas,...thermal,...reaction,'conditions.duration_s',
      ...(d.conditions.ignition==='battery fault'||d.conditions.ignition==='overheated wire'?power:[]),
      ...(d.conditions.crew==='present'?['parts.crew.people','parts.crew.heat']:[]),
      ...(d.conditions.support?['parts.life.makeup','parts.life.scrub','parts.life.filter','parts.life.tank']:[])];
    const sensor=d.conditions.sensor_kind==='passive tracer'?[...gas,'conditions.fan','parts.life.section','parts.sensors.threshold','parts.sensors.lag','parts.sensors.pulse']:
      [...trace,'parts.sensors.'];
    const response=[...sensor,'parts.suppression.'];
    if(d.conditions.response==='isolate power')trace.push(...response);
    const groups={cabin:trace,balances:trace,limits:[...trace,'atmosphere.low','atmosphere.high'],crossing:[...trace,'conditions.threshold'],
      sensor,response,interventionTransient:[...trace,...response],air:[...gas,'parts.access.suit'],initialO2:gas,
      fuelHeat: fuelKeys('heatMJkg'),fuelOxygen: fuelKeys('oxygenKgKg'),wallConductance:wall,
      pressureHeadroom:[...trace,'conditions.exteriorKpa','parts.cabin.designPressure'],
      powerGas:tank,vehicleWeight:['parts.cabin.mass','parts.chassis.mass','parts.chassis.payload','conditions.gravity_g',...tank,...d.items.map((_,i)=>'items.'+i+'.mass_kg'),...(d.conditions.crew==='present'?['parts.crew.people','parts.crew.mass']:[])],
      wheelReaction:['parts.chassis.wheels'],mobilityTime:['parts.mobility.range','parts.mobility.speed'],
      dailyGasLoss:[...gas,'parts.cabin.leak','parts.access.cycles','parts.access.volume'],
      archiveMatches:['conditions.gravity_g','atmosphere.pressure','atmosphere.oxygen']};
    groups.wheelReaction.push(...groups.vehicleWeight);
    return Object.fromEntries(Object.entries(groups).map(([metric,selectors])=>{
      const paths=[...new Set(selectors.flatMap(s=>s.endsWith('.')?all.filter(k=>k.startsWith(s)):all.includes(s)?[s]:[]))];
      const tag=paths.reduce((worst,k)=>provenanceTags.indexOf(inputs[k].tag)>provenanceTags.indexOf(worst)?inputs[k].tag:worst,'measured');
      const effective=paths.length?tag:'assumed';
      const dynamic=['cabin','limits','crossing','sensor','response','interventionTransient','pressureHeadroom'].includes(metric);
      const low=effective==='theoretical'||(dynamic&&(!jointCount||['Moon','Mars'].includes(d.conditions.surface)));
      return [metric,{tag:effective,confidence:low?'Low':'Medium',
        reason:effective==='theoretical'?'A dependent number is explicitly theoretical.':low?'The gas or material model has no verified transfer to this scenario.':
          'Conditional calculation from the listed inputs. These scenario values have no flight qualification.',
        inputs:paths,sources:[...new Set(paths.map(k=>inputs[k].source).filter(Boolean))]}];
    }));
  }
  function brief(d,r){d=validate(d);return {format:'first-fire.vehicle-brief.v1',design:clone(d),provenance:provenance(d),results:{...r,cabin:r.cabin?{...r.cabin,scenario:r.assumptions}:null},sources:[...new Set([...d.parts.map(p=>p.source),...materials(d).filter(m=>d.items.some(i=>i.material===m.id)).map(m=>m.source),...Object.values(r.outputProvenance).flatMap(p=>p.sources)].filter(Boolean))],scope:'One selected specimen at an imposed front speed; a separate prescribed tracer pulse drives an ideal sensor. Response agent quantities are conditional intervention budgets.'};}
  function readDesign(raw){const value=raw?.format==='first-fire.vehicle-brief.v1'?raw.design:raw;return clone(validate(value));}
  const api={families,alternatives,initial,validate,inventory,detector,derive,brief,readDesign};if(inNode)module.exports=api;if(typeof window==='undefined')return;
  const E=(tag,text,cls)=>{const x=document.createElement(tag);if(text!=null)x.textContent=text;if(cls)x.className=cls;return x;};
  const action=(name,fn,cls='ghost')=>{const b=E('button',name,cls);b.type='button';b.onclick=fn;return b;};
  const link=(text,url)=>{const a=E('a',text);a.href=url;if(url.startsWith('http')){a.target='_blank';a.rel='noopener noreferrer';}return a;};
  const field=(text,control)=>{const l=E('label',text,'field');control.setAttribute('aria-label',text);l.append(control);return l;};
  const num=(n,places=2)=>n==null||!Number.isFinite(n)?'Unavailable':Number(n.toFixed(places)).toLocaleString('en-US',{maximumFractionDigits:places});
  function table(cols,rows){const wrap=E('div',null,'tablewrap'),t=E('table'),head=E('thead'),tr=E('tr'),b=E('tbody');for(const v of cols)tr.append(E('th',v));head.append(tr);t.append(head);for(const values of rows){const r=E('tr');for(const [i,v] of values.entries()){const cell=E(i?'td':'th');if(v instanceof Node)cell.append(v);else cell.textContent=v;r.append(cell);}b.append(r);}t.append(b);wrap.append(t);return wrap;}
  const h2=text=>E('h2',text);
  function options(label,items,value,update){const s=E('select');for(const [v,t] of items.map(x=>Array.isArray(x)?x:[x,x]))s.add(new Option(t,v));s.value=value;s.onchange=()=>update(s.value);return field(label,s);}
  function numberField(label,value,lo,hi,update,integer=false){const n=E('input');n.type='number';n.min=lo;n.max=hi;n.step=integer?1:'any';n.value=value;n.oninput=()=>update(n.value===''?NaN:Number(n.value));return field(label,n);}
  function textField(label,value,onedit){const n=E('input');n.value=value;n.maxLength=120;n.onchange=()=>onedit(n.value);return field(label,n);}
  function info(text){return E('p',text,'small');}
  function plot(canvas,trace,metric){const ctx=canvas.getContext('2d');if(!ctx||!trace?.length)return;const W=canvas.width=740,H=canvas.height=225;ctx.clearRect(0,0,W,H);const a=trace.map(t=>t[metric]),min=Math.min(...a),max=Math.max(...a),range=max-min||1;const px=t=>62+(t-trace[0].seconds)/(trace.at(-1).seconds-trace[0].seconds||1)*(W-90),py=v=>H-40-(max===min?.5:(v-min)/range)*(H-70);
    ctx.font='13px system-ui';ctx.fillStyle='#4a6057';ctx.strokeStyle='#cbd8d0';for(const y of [min,(min+max)/2,max]){const yp=py(y);ctx.beginPath();ctx.moveTo(58,yp);ctx.lineTo(W-18,yp);ctx.stroke();ctx.fillText(num(y,2),3,yp+4);}ctx.fillText(num(trace[0].seconds)+' s',58,H-12);ctx.fillText(trace.at(-1).seconds+' s',W-58,H-12);ctx.strokeStyle='#157660';ctx.lineWidth=3;ctx.beginPath();trace.forEach((v,i)=>i?ctx.lineTo(px(v.seconds),py(v[metric])):ctx.moveTo(px(v.seconds),py(v[metric])));ctx.stroke();canvas.setAttribute('aria-label',metrics[metric][0]+', beginning '+num(a[0])+' and ending '+num(a.at(-1))+' '+metrics[metric][1]);}
  // Orthographic projection and painter-sorted faces; every primitive is generated locally.
  const colors={reference:'#8ec5b4',custom:'#e6aa6f',theoretical:'#b495ce'};
  function schematic(canvas,d,three,yaw){const ctx=canvas.getContext('2d');if(!ctx)return;const W=canvas.width=850,H=canvas.height=304;
    const parts=Object.fromEntries(d.parts.map(p=>[p.family,p])),c=d.conditions;ctx.fillStyle='#17352f';ctx.fillRect(0,0,W,H);
    const pitch=three?.27:0,angle=three?yaw:0;const camera=p=>{const [x,y,z]=p,xx=x*Math.cos(angle)-z*Math.sin(angle),zz=x*Math.sin(angle)+z*Math.cos(angle);return [W*.50+xx*67,H*.78-(y*Math.cos(pitch)-zz*Math.sin(pitch))*66,zz*Math.cos(pitch)+y*Math.sin(pitch)];};
    ctx.strokeStyle='#335248';ctx.lineWidth=1;for(let i=-8;i<=8;i++){for(const [v,w] of [[[i,0,-6],[i,0,6]],[[-8,0,i],[8,0,i]]]){const a=camera(v),b=camera(w);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();}}
    const faces=[];
    const add=(verts,fill,tint=0)=>{const points=verts.map(camera);faces.push({points,fill,tint,z:points.reduce((a,p)=>a+p[2],0)/points.length});};
    function block(x,y,z,w,h,deep,part){const v=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]].map(p=>[x+p[0]*w,y+p[1]*h,z+p[2]*deep]);for(const [ix,f] of [[ [0,1,2,3],.15],[[4,5,6,7],0],[[0,1,5,4],.15],[[3,2,6,7],-.15],[[1,2,6,5],.15],[[0,3,7,4],.1]])add(ix.map(i=>v[i]),colors[parts[part].origin],f);}
    const wheelN=parts.chassis.numbers.wheels,axles=Math.ceil(wheelN/2);block(-2.6,.62,-.98,5.2,.40,1.96,'chassis');
    const vol=parts.cabin.numbers.volume,ht=.90+Math.cbrt(vol)*.37;block(-1.72,1.03,-.82,3.12,ht,1.64,'cabin');block(1.47,1.03,-.66,.88,.66,1.3,'power');block(-1.1,1.04+ht,-.99,1.9,.09,1.98,'thermal');
    function wheel(x,z){const face=[],back=[],n=18;for(let i=0;i<n;i++){const a=i*2*Math.PI/n;face.push([x+.45*Math.cos(a),.47+.45*Math.sin(a),z]);back.push([x+.45*Math.cos(a),.47+.45*Math.sin(a),z-.22]);}const fill=colors[parts.mobility.origin];add(back,fill,.35);for(let i=0;i<n;i++)add([face[i],face[(i+1)%n],back[(i+1)%n],back[i]],fill,.53);add(face,fill,.27);}
    for(let i=0;i<wheelN;i++){const axle=Math.floor(i/2);wheel(-2.18+(axles===1?2.18:4.36*axle/(axles-1)),i%2?-.98:1.22);}
    for(const face of faces.sort((a,b)=>a.z-b.z)){ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=face.fill;ctx.fill();if(face.tint){ctx.fillStyle=face.tint<0?'rgba(255,255,255,.18)':'rgba(16,44,37,'+face.tint+')';ctx.fill();}ctx.strokeStyle='#35554b';ctx.stroke();}
    const target=camera([c.fire_zone==='cabin'?-.45:c.fire_zone==='equipment bay'?1.8:-1.42,c.fire_zone==='equipment bay'?1.48:1.78,.97]);ctx.beginPath();ctx.arc(target[0],target[1],7,0,Math.PI*2);ctx.fillStyle=c.ignition==='none'?'#bdbfae':'#ff985c';ctx.fill();ctx.strokeStyle='#17352f';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#e5f2e9';ctx.font='14px system-ui';ctx.fillText(c.ignition==='none'?'No ignition':'Ignition · '+c.fire_zone,24,30);canvas.setAttribute('aria-label',(three?'Rotatable 3D':'2D side')+' vehicle, '+wheelN+' wheels, '+c.fire_zone+' ignition zone.');}
  function render(root){
    let d=initial(),tab='Build',family='cabin',swap='polyethylene',report=null,yaw=.55;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)'),can3D=()=>window.FFAwareness?.tier?.()!=='lite'&&!reduced.matches;let three=can3D()&&window.FFAwareness?.tier?.()==='pro';
    try{const s=localStorage.getItem(key);if(s)d=readDesign(JSON.parse(s));}catch{}
    const shell=E('div',null,'vd-shell'),heading=E('header',null,'pagetitle');heading.append(E('div','Research desk / Vehicle designer','breadcrumb'),E('h1','Vehicle designer'),E('p','Build the cabin, place the fire and choose what can burn. Inspect the physics beside the closest flight evidence.','sub'));
    const hero=E('section',null,'vd-hero'),scene=E('div',null,'vd-scene'),canvas=E('canvas'),view=E('div',null,'vd-view'),stats=E('div',null,'vd-stats');
    const mode=action('3D view',()=>{three=!three;drawScene();}),rotate=action('Rotate view',()=>{yaw=(yaw+.3)%(Math.PI*2);drawScene();});view.append(mode,rotate);
    canvas.setAttribute('role','img');let drag=null;canvas.onpointerdown=e=>{if(!three)return;drag=e.clientX;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag!==null){yaw+=(e.clientX-drag)*.008;drag=e.clientX;drawScene();}};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
    scene.append(canvas,view);const legend=E('div',null,'vd-legend');for(const [k,v] of Object.entries(colors)){const key=E('span',k);key.style.setProperty('--swatch',v);legend.append(key);}scene.append(legend);hero.append(scene,stats);
    const tabs=E('nav',null,'vd-tabs');tabs.setAttribute('aria-label','Design workspaces');const editor=E('section',null,'panel vd-editor'),status=E('p',null,'vd-status');status.setAttribute('role','status');
    const actions=E('div',null,'actions'),file=E('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    function install(value){d=readDesign(value);drawEditor();calculate();}
    file.onchange=async()=>{const input=file.files[0];file.value='';if(!input)return;try{if(input.size>2_000_000)throw Error('Choose a design JSON under 2 MB.');const imported=readDesign(JSON.parse(await input.text()));if(!root.contains(shell))return;install(imported);status.textContent='Design imported. All results were recalculated.';}catch(e){status.textContent='Import failed. '+e.message;}};
    const save=action('Save on this device',()=>{if(!report)return;try{localStorage.setItem(key,JSON.stringify(d));status.textContent='Design saved on this device.';}catch{status.textContent='Storage unavailable. Download the design brief to keep it.';}});
    const download=action('Download design brief',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(brief(d,report),null,2)],{type:'application/json'}));const a=E('a');a.href=url;a.download='first-fire-vehicle-design.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);},'btn');
    actions.append(save,download,action('Import design',()=>file.click()),file);
    shell.append(heading,hero,tabs,editor,status,actions);root.replaceChildren(shell);
    function grid(){return E('div',null,'vd-grid');}
    function drawScene(){if(!can3D())three=false;mode.hidden=!can3D();mode.textContent=three?'2D view':'3D view';rotate.hidden=!three;schematic(canvas,d,three,yaw);}
    function note(text){const p=E('p',text,'vd-note');return p;}
    function changeThen(fn){return v=>{fn(v);calculate();};}
    function inputGroup(obj,defs){const g=grid();for(const [k,[name,,lo,hi,integer]] of Object.entries(defs))g.append(numberField(name,obj[k],lo,hi,changeThen(x=>{obj[k]=x;}),!!integer));return g;}
    function build(){const top=grid();top.append(textField('Design name',d.name,changeThen(v=>d.name=v)),options('Part family',Object.entries(families).map(([k,p])=>[k,p.title]),family,v=>{family=v;drawEditor();}));const p=d.parts.find(p=>p.family===family),def=families[family];
      const part=E('div',null,'vd-part');const title=E('h3',p.name),origin=options('Part origin',['reference','custom','theoretical'],p.origin,v=>{if(v==='reference'){const fresh=initial().parts.find(x=>x.family===family);Object.assign(p,fresh);}else p.origin=v;drawEditor();calculate();});
      const name=textField('Part name',p.name,v=>{p.name=v;if(p.origin==='reference')p.origin='custom';drawEditor();calculate();});
      const preset=options('Catalogue preset',[[p.name,'Current · '+p.name],...[ [def.name,{}],...alternatives[family] ].filter(([n])=>n!==p.name).map(([n])=>[n,n])],p.name,v=>{
        const found=alternatives[family].find(([n])=>n===v),fresh=initial().parts.find(n=>n.family===family);Object.assign(p,fresh,{name:v,numbers:{...fresh.numbers,...found?.[1]}});drawEditor();calculate();});
      const form=grid();form.append(preset,origin,name);
      if(family==='cabin')form.append(options('Wall material',Object.entries(wallMaterials).map(([id,m])=>[id,m.name]),p.wallMaterial,changeThen(value=>{p.wallMaterial=value;if(p.origin==='reference'){p.origin='custom';origin.querySelector('select').value='custom';}})));
      for(const [k,[label,,lo,hi,integer]] of Object.entries(def.fields)){form.append(numberField(label,p.numbers[k],lo,hi,x=>{p.numbers[k]=x;if(p.origin==='reference'){p.origin='custom';origin.querySelector('select').value='custom';}calculate();},!!integer));}
      const src=textField('Part reference URL (optional)',p.source,changeThen(v=>{p.source=v;}));src.querySelector('input').maxLength=1000;const assumption=textField('Engineering assumption',p.assumption,changeThen(v=>{p.assumption=v;}));assumption.querySelector('input').maxLength=600;form.append(src,assumption);
      const make=action('Create a theoretical part',()=>{Object.assign(p,{origin:'theoretical',name:'New '+def.title.toLowerCase(),source:'',assumption:'User-defined theoretical part.'});drawEditor();calculate();});part.append(title,info('Reference names identify a design concept. Each editable number begins as an engineering assumption.'),form,make);editor.append(h2('Build the vehicle'),top,part,link('Open the detailed rover and terrain workbench →','#rover-design'));}
    function conditions(){const c=d.conditions,g=grid();g.append(options('Surface',choices.surface,c.surface,v=>{c.surface=v;c.gravity_g=gravity[v];c.exteriorKpa=exteriorPressure[v];c.outside={Moon:'Lunar day',Mars:'Mars day',Earth:'Earth reference',Orbit:'Orbit reference'}[v];drawEditor();calculate();}),numberField('Gravity (Earth g)',c.gravity_g,0,1,changeThen(x=>c.gravity_g=x)),options('Exterior',choices.outside,c.outside,changeThen(x=>c.outside=x)));
      for(const [k,label] of [['ventilation','Fan setting'],['ignition','Ignition source'],['fire_zone','Fire location'],['sensor_zone','Sensor location'],['sensor_kind','Sensor technology'],['hatch','Internal hatch'],['crew','Crew aboard'],['activity','Crew activity'],['response','Response after detection']])g.append(options(label,choices[k],c[k],changeThen(v=>c[k]=v)));
      g.append(numberField('Exterior absolute pressure (kPa)',c.exteriorKpa,0,120,changeThen(x=>c.exteriorKpa=x)),numberField('Fan speed (m/s)',c.fan,0,2,changeThen(x=>c.fan=x)),numberField('Clock duration (s)',c.duration_s,120,1800,changeThen(x=>c.duration_s=x),true),options('Life support',['off','on'],c.support?'on':'off',changeThen(x=>c.support=x==='on')));editor.append(h2('Place the fire'),g,info('An imposed front propagates only along the selected item in the ignition zone. The fan transports a separate prescribed tracer.'));
      const a=d.atmosphere,b=grid();b.append(numberField('Cabin pressure (kPa)',a.pressure,30,110,changeThen(x=>a.pressure=x)),numberField('Nominal oxygen (%)',a.oxygen,0,40,changeThen(x=>a.oxygen=x)),options('Diluent',['N2','He','Ar'],a.diluent,changeThen(x=>a.diluent=x)),numberField('Lower O₂ band (%)',a.low,0,40,changeThen(x=>a.low=x)),numberField('Upper O₂ band (%)',a.high,0,40,changeThen(x=>a.high=x)));editor.append(h2('Cabin atmosphere'),b,link('Compare atmospheres and material limits →','#materials-lab?tab=atmosphere'));}
    let fuelStats;
    function fuels(){editor.append(h2('Furnish the cabin'));fuelStats=E('div',null,'vd-load');const available=materials(d),g=E('div',null,'vd-items');
      for(const [i,x] of d.items.entries()){
        const p=E('fieldset');p.append(E('legend',i===d.selected?'Ignition specimen · '+x.name:x.name));const controls=grid();
        controls.append(textField('Item name '+(i+1),x.name,changeThen(v=>x.name=v)),options('Material for item '+(i+1),available.map(m=>[m.id,m.name]),x.material,v=>{x.material=v;calculate();}),numberField('Mass (kg), item '+(i+1),x.mass_kg,0,1000,changeThen(v=>x.mass_kg=v)),numberField('Surface area (m²), item '+(i+1),x.area_m2,.0001,10000,changeThen(v=>x.area_m2=v)),options('Item zone '+(i+1),choices.fire_zone,x.zone,changeThen(v=>x.zone=v)),options('Item origin '+(i+1),['Earth','on-site'],x.origin,changeThen(v=>x.origin=v)));
        const buttons=E('div',null,'actions');if(i!==d.selected)buttons.append(action('Use as ignition specimen',()=>{d.selected=i;drawEditor();calculate();}));if(d.items.length>1)buttons.append(action('Remove '+x.name,()=>{d.items.splice(i,1);if(d.selected>i)d.selected--;else if(d.selected===i)d.selected=Math.min(i,d.items.length-1);drawEditor();calculate();}));p.append(controls,buttons);g.append(p);
      }
      const add=action('Add interior item',()=>{if(d.items.length>=30)return;d.items.push({name:'Interior item '+(d.items.length+1),material:'cellulose',mass_kg:.08,area_m2:.04,zone:'cabin',origin:'Earth'});drawEditor();calculate();});editor.append(g,add,h2('Compare a material swap'));
      const swapSelect=options('Replacement for selected ignition specimen',available.map(m=>[m.id,m.name]),swap,v=>{swap=v;calculate();});editor.append(swapSelect,fuelStats,action('Apply material swap',()=>{d.items[d.selected].material=swap;drawEditor();calculate();}));
      const custom=E('details');custom.append(E('summary','Add a material to this design'));
      const draft={name:'',family:'',behavior:'',heatMJkg:null,oxygenKgKg:null,density:null,pyrolysisK:null,oxygenLimitPct:null,limitConditions:'',properties:{},source:''};
      const f=grid();for(const [k,label] of [['name','Material name'],['family','Family'],['behavior','Burn behaviour and limits'],['source','Source URL (optional)']])f.append(textField(label,'',v=>draft[k]=v));
      for(const [k,label,hi] of [['heatMJkg','Heat of combustion (MJ/kg)',100],['oxygenKgKg','O₂ demand (kg/kg)',10],['density','Density (kg/m³)',30000],['pyrolysisK','Pyrolysis temperature (K)',4000],['oxygenLimitPct','Reported limiting oxygen (%)',100]]){
        const meta=draft.properties[k]={tag:'assumed',source:'',locator:''},row=E('fieldset');row.append(E('legend',propertyLabels[k]));
        const fields=grid(),source=textField(propertyLabels[k]+' source URL','',v=>meta.source=v);
        source.querySelector('input').maxLength=1000;
        fields.append(numberField(label,'',0,hi,v=>draft[k]=Number.isFinite(v)?v:null),
          options(propertyLabels[k]+' provenance',provenanceTags,'assumed',v=>meta.tag=v),source,
          textField(propertyLabels[k]+' page, table or test ID','',v=>meta.locator=v));
        if(k==='oxygenLimitPct')fields.append(textField('Limit conditions and endpoint','',v=>draft.limitConditions=v));
        row.append(fields);f.append(row);
      }
      const result=E('p');custom.append(f,action('Save custom material',()=>{const candidate=clone(d);let suffix=1;while(materials(candidate).some(m=>m.id==='user-'+suffix))suffix++;candidate.customMaterials.push({...draft,id:'user-'+suffix});try{validate(candidate);d=candidate;drawEditor();calculate();}catch(e){result.textContent=e.message;}}),result);editor.append(custom);}
    function fuelReport(){if(!fuelStats||!report)return;const alt=clone(d);alt.items[alt.selected].material=swap;const other=derive(alt,archiveNow());const names=materials(d),name=m=>names.find(x=>x.id===m)?.name;const show=(r,key,unknown,unit)=>num(r.load[key])+' '+unit+(r.load[unknown].length?' + unquantified items':'');
      fuelStats.replaceChildren(table(['Inventory metric',name(d.items[d.selected].material),name(swap)],[['Fuel heat',show(report,'heatMJ','unknownHeat','MJ'),show(other,'heatMJ','unknownHeat','MJ')],['O₂ for complete burn',show(report,'oxygenKg','unknownOxygen','kg'),show(other,'oxygenKg','unknownOxygen','kg')],['Selected coupon heat',report.cabin?num(report.cabin.final.heatKJ)+' kJ':'No reaction curve',other.cabin?num(other.cabin.final.heatKJ)+' kJ':'No reaction curve'],['Material-and-condition matches',report.materialEvidence.find(m=>m.id===report.material)?.jointCount??'Unmapped',other.materialEvidence.find(m=>m.id===other.material)?.jointCount??'Unmapped'],
        ['NASA Table 2 margins',(report.materialEvidence.find(m=>m.id===report.material)?.margin||[]).map(m=>m.specimen+' '+num(m.oxygenPoints)+' pp').join(', ')||'None in archive',
          (other.materialEvidence.find(m=>m.id===other.material)?.margin||[]).map(m=>m.specimen+' '+num(m.oxygenPoints)+' pp').join(', ')||'None in archive'],
        ['Fire evidence',link('Source ↗',names.find(x=>x.id===d.items[d.selected].material).source||'#materials-lab'),link('Source ↗',names.find(x=>x.id===swap).source||'#materials-lab')]]));}
    let output;
    function results(){editor.append(h2('Run and inspect'));const g=grid(),c=d.conditions;g.append(options('Trace and crossing',Object.entries(metrics).map(([id,m])=>[id,m[0]+' ('+m[1]+')']),c.monitor,v=>{c.monitor=v;calculate();}),numberField('Your threshold (selected units)',c.threshold,-1000,10000,changeThen(v=>c.threshold=v)));output=E('div',null,'vd-output');editor.append(g,output);}
    function drawOutput(){if(!report||!output)return;const r=report,c=d.conditions,metric=c.monitor,unit=metrics[metric][1],selected=materials(d).find(m=>m.id===r.material),cap=d.atmosphere;
      output.replaceChildren();if(r.cabin){const chart=E('canvas');chart.className='vd-chart';chart.setAttribute('role','img');plot(chart,r.cabin.trace,metric);output.append(chart,info('First '+(metric==='oxygenPct'?'downward':'upward')+' crossing of '+num(c.threshold)+' '+unit+': '+(r.crossing===null?'none in this run':num(r.crossing)+' s')+'. Thresholds are supplied by the researcher.'));
        const z=r.cabin.final;output.append(table(['At '+z.seconds+' seconds','Calculated result'],Object.entries(metrics).map(([k,v])=>[v[0],num(z[k],3)+' '+v[1]])),info('Maximum energy closure residual '+r.cabin.energyResidualJ.toExponential(2)+' J. Largest terminal atom/inert inventory residual '+r.balances.maxAbsoluteMoles.toExponential(2)+' mol. Model uses complete combustion and the imposed specimen speed.'));
        output.append(h2('Control band'),table(['Starting O₂','Ending wet O₂','Chemical heat'],r.limits.map(b=>[num(b.oxygen)+'%',num(b.endOxygen,3)+'%',num(b.heatKJ)+' kJ'])));
      }else output.append(note('No reactive cabin trace for '+selected.name+'. Supply an independently supported reaction model for this material. The inventory displays its available properties.'));
      const sens=r.sensor,act=r.response;output.append(h2('Detection and intervention'),table(['Conditional observable','Result'],[['First threshold crossing',sens.cross===null?(sens.peak===null?'Unavailable or outside horizon':'No crossing'):num(sens.cross)+' s'],['Sensor model',sens.kind],['Peak passive tracer reading',sens.peak===null?'Not calibrated for this technology':num(sens.peak,3)+' mg/m³'],['Exchange before response',num(sens.exchangeLps)+' L/s'],['Response begins',c.response==='none'||sens.responseAt===null?'No intervention':num(sens.responseAt)+' s'],['Agent delivered',num(act.releasedKg)+' kg'],['Gas fraction vented after trigger',num(100*act.ventFraction)+'%'],...(act.co2MixPct==null?[]:[['Inventory-mixed final CO₂',num(act.co2MixPct)+'%']]),...(act.waterLatentUpperKJ==null?[]:[['Maximum evaporation heat sink',num(act.waterLatentUpperKJ)+' kJ']])]),info('The prescribed tracer drives its own threshold. Power isolation changes electrical heating. Water delivery supplies an upper bound on evaporative heat removal. Chemical suppression and hardware-specific smoke response need measurements.'));
      if(act.transient){const branch=act.transient,chart=E('canvas');chart.className='vd-chart';chart.setAttribute('role','img');
        plot(chart,branch.trace,'pressureKpa');output.append(h2('Gas response after detection'),info(branch.scope),chart,
          table(['Conditional gas state','At response','At end'],[['Cabin pressure (kPa)','pressureKpa'],['O₂ partial pressure (kPa)','oxygenPartialKpa'],['CO₂ (%)','co2Pct'],['Gas vented (mol)','ventedMol'],['Agent CO₂ added (mol)','addedCO2Mol']].map(([name,k])=>[name,num(branch.trace[0][k],3),num(branch.final[k],3)])));
      }
      output.append(h2('Pressure shell and separate power tanks'),
        table(['Design quantity','Result'],[
          ['Wall material',r.thermal.material],['Conductivity held at 300 K',num(r.thermal.conductivityWmK,2)+' W/(m·K)'],
          ['Area-integrated conductance to reservoir',num(r.thermal.wallUAWK,3)+' W/K'],['Design differential pressure',num(r.rating.designDifferentialKpa)+' kPa'],
          ['Starting inside minus outside pressure',num(r.rating.initialDifferentialKpa)+' kPa'],['Headroom at sampled peak',r.rating.headroomKpa===null?'Unavailable':num(r.rating.headroomKpa)+' kPa'],
          ['Stored H₂ / O₂',num(r.storage.hydrogenKg,4)+' / '+num(r.storage.oxygenKg,4)+' kg']]),
        info(r.rating.scope+' '+r.storage.scope+' The tank gases stay isolated from the cabin.'),
        link('NIST wall conductivity correlation at 300 K ↗',r.thermal.source));
      output.append(h2('Vehicle and air budgets'),table(['Quantity','Value'],[['Gravity / wheel reaction',num(c.gravity_g,4)+' g / '+num(r.housing.loadPerWheelN)+' N per wheel'],['Accounted vehicle mass / weight',num(r.housing.massKg)+' kg / '+num(r.housing.weightN)+' N'],['Nominal operating time from range',num(r.housing.nominalHours)+' h'],['Exposed specimen areal mass',num(d.items[d.selected].mass_kg/d.items[d.selected].area_m2,3)+' kg/m²'],['Wall reservoir / exterior boundary',num(r.thermal.wallK)+' / '+num(r.thermal.exteriorReferenceK)+' K'],['Buoyant velocity scale (5 cm, ΔT/T = 1)',num(r.thermal.buoyancyScaleMs,3)+' m/s'],['Initial O₂ partial pressure',num(r.air.pO2)+' kPa'],['Initial cabin gas / inventory O₂',num(r.air.massKg)+' / '+num(r.initialO2)+' kg'],['Nitrogen-to-suit pressure ratio',num(r.air.ratio)],['Daily cabin-equivalent leak and airlock loss',num(r.housing.gasLossKgPerDay,3)+' kg/day'],['Known fuel O₂ / available cabin O₂',r.initialO2?num(100*r.load.oxygenKg/r.initialO2)+'%'+(r.load.unknownOxygen.length?' + unknown':''):'No initial oxygen']]),info('Daily leak and airlock inventories are offset budgets for the chosen conditions. The sealed cabin trace covers the interval between pressure-loss events.'));
      output.append(h2('Evidence for the materials aboard'));
      for(const evidence of r.materialEvidence){
        const item=E('details');item.open=evidence.id===selected.id;
        item.append(E('summary',evidence.name),info((evidence.jointCount??'Unmapped')+' joint material-and-condition matches. '+(evidence.candidateCount??'Unknown')+' archive records contain the material term. '+evidence.scope));
        if(evidence.nearest.length)item.append(table(['Closest record','Reported material','Gravity / O₂ / pressure'],evidence.nearest.map(record=>[link(record.id,'#atlas?record='+encodeURIComponent(record.id)),record.material,[record.gravityG??'—',record.oxygenPct??'—',record.pressurePsia??'—'].join(' / ')+' (g, %, psia)'])));
        if(evidence.margin.length)item.append(table(['Reduced-gravity specimen','Conservative O₂ margin','Lunar limit vs. 1-g extrapolation'],evidence.margin.map(m=>[m.specimen,num(m.oxygenPoints)+' percentage points',m.direction])),info('The margins are calculated from 1-g slopes at 8.2 psia. They do not measure the size of the lunar shift.'),link('NASA Table 2 ↗',evidence.margin[0].source));
        if(evidence.reportedLimit){const m=evidence.reportedLimit;item.append(info(num(m.oxygenPct)+'% O₂ · '+m.tag+' · '+m.conditions));if(m.source)item.append(link(m.locator||'User-supplied source',m.source));}
        output.append(item);
      }
      const provenanceCard=E('details');provenanceCard.append(E('summary','Output confidence and input provenance'),
        table(['Result','Weakest input','Confidence and basis'],Object.entries(r.outputProvenance).map(([k,p])=>[k.replace(/([a-z])([A-Z])/g,'$1 $2'),p.tag,p.confidence+' · '+p.reason])));
      output.append(provenanceCard);
      output.append(h2('Closest archived evidence'),note(r.confidence+' confidence. '+r.reason),info((r.joint??'Unavailable')+' joint matches among '+(r.complete??'unknown')+' solid-fuel rows with reported gravity, ambient oxygen and pressure. Compass tolerances: ±0.02 g, ±1 oxygen point and ±0.5 psia.'),table(['Closest run','Material','Known coordinates'],r.nearest.map(o=>[link(o.id,'#atlas?record='+encodeURIComponent(o.id)),o.material||'Unspecified',o.know+'/3'])),link('Inspect the source conditions in Compass →','#compass'),info(selected.behavior));if(selected.source)output.append(link('Material evidence ↗',selected.source));}
    function drawEditor(){tabs.replaceChildren();editor.replaceChildren();fuelStats=null;output=null;for(const name of ['Build','Conditions','Fuel load','Run & evidence']){const b=action(name,()=>{tab=name;drawEditor();calculate();});if(name===tab)b.setAttribute('aria-current','page');tabs.append(b);}
      ({Build:build,Conditions:conditions,'Fuel load':fuels,'Run & evidence':results})[tab]();}
    function archiveNow(){return window.FF?.tests&&window.FFJointCoverage&&window.FFRankInvestigations?{rows:window.FF.tests,coverage:window.FFJointCoverage,rank:window.FFRankInvestigations}:null;}
    function calculate(){try{report=derive(d,archiveNow());status.textContent='';save.disabled=download.disabled=false;drawScene();stats.replaceChildren(E('span',report.theoretical?'THEORETICAL DESIGN':'SCENARIO RESULT','eyebrow'),E('h2',d.name));const value=(name,val)=>{const unit=E('div');unit.append(E('span',name),E('strong',val));return unit;};stats.append(value('Known fuel inventory',num(report.load.heatMJ)+' MJ'+(report.load.unknownHeat.length?' + unknown':'')),value('Chemical heat in selected trial',report.cabin?num(report.cabin.final.heatKJ)+' kJ':'Unquantified'),value('Joint archive matches',report.joint??'Unavailable'));shell.dataset.theoretical=String(report.theoretical);if(tab==='Fuel load')fuelReport();if(tab==='Run & evidence')drawOutput();}
      catch(e){report=null;save.disabled=download.disabled=true;status.textContent=e.message;stats.replaceChildren(note('Complete the design inputs to recalculate.'));fuelStats?.replaceChildren();output?.replaceChildren();}}
    function media(){drawScene();}reduced.addEventListener?.('change',media);document.addEventListener('ff-device-change',media);
    drawEditor();calculate();return ()=>{reduced.removeEventListener?.('change',media);document.removeEventListener('ff-device-change',media);};
  }
  window.FFVehicleDesigner={...api,render};
})();
