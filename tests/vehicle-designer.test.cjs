const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../site/vehicle-designer.js');
const approx=(x,y,tol)=>assert(Math.abs(x-y)<tol,`${x} must be within ${tol} of ${y}`);
test('default chemistry, sum of fuel load and exact JSON round trip',()=>{const d=v.initial(),r=v.derive(d);assert.equal(d.parts.length,11);approx(r.load.heatMJ,6.424,1e-9);approx(r.cabin.final.oxygenPct,32.75,.005);approx(r.cabin.final.co2Pct,.97,.005);approx(r.cabin.final.heatKJ,1094.4,.01);assert(r.balances.maxAbsoluteMoles<1e-9);assert(r.balances.energyResidualJ<1e-6);const exported=v.brief(d,r);exported.results.cabin.final.heatKJ=-50000;const reopened=v.readDesign(JSON.parse(JSON.stringify(exported)));assert.equal(v.derive(reopened).cabin.final.heatKJ,1094.4);assert.deepEqual(v.derive(reopened),v.derive(d));});
test('blank fuel and depleted oxygen give flat unpowered chemical traces; missing properties withhold the result',()=>{for(const mode of ['mass','oxygen']){const d=v.initial();if(mode==='mass')d.items[0].mass_kg=0;else{d.atmosphere.low=0;d.atmosphere.oxygen=0;}const r=v.derive(d);assert.equal(r.cabin.final.heatKJ,0);assert.equal(r.cabin.final.positionCm,0);approx(r.cabin.final.temperatureK,300,1e-8);}const d=v.initial();d.items[0].material='teflon';const r=v.derive(d);assert.equal(r.cabin,null);assert.deepEqual(r.load.unknownHeat,[0]);d.items[0].mass_kg=0;assert.equal(v.derive(d).cabin.final.heatKJ,0);});
test('theoretical provenance survives import and mixed stock including an uncited custom material',()=>{const d=v.initial();d.parts[0].origin='theoretical';d.customMaterials.push({id:'user-test',name:'Printed panel',family:'Assumed material',heatMJkg:20,oxygenKgKg:null,density:900,pyrolysisK:null,behavior:'Unmeasured.',source:''});d.items[0].material='user-test';const r=v.derive(d);assert(r.theoretical);assert.equal(r.confidence,'Low');approx(r.load.heatMJ,6.808,1e-8);assert.deepEqual(r.load.unknownOxygen,[0]);assert.equal(v.brief(d,r).provenance['parts.cabin.volume'].tag,'theoretical');});
test('sensors, finite response stocks, variable gravity, diluent, hatch, crew and compensation preserve limits',()=>{const d=v.initial();d.conditions.crew='present';d.conditions.support=true;d.conditions.activity='aerobic';d.conditions.hatch='open internal hatch';d.conditions.ignition='battery fault';d.conditions.response='isolate power';d.conditions.gravity_g=0;d.atmosphere.diluent='He';const r=v.derive(d);assert(r.sensor.cross>0);assert(r.cabin.crewO2G>0);assert.equal(r.housing.volume,15);assert.equal(r.housing.weightN,0);assert(r.cabin.final.batteryKJ<90*120/1000);assert(r.balances.maxAbsoluteMoles<1e-7);assert(Math.abs(r.sensor.massResidualMg)<1e-8);d.conditions.response='discharge CO₂';const s=v.derive(d);assert(s.response.releasedKg<=1&&s.response.releasedKg>0);assert(s.response.co2MixPct>s.cabin.final.co2Pct);d.conditions.sensor_kind='light-scattering smoke';assert.equal(v.derive(d).sensor.cross,null);d.conditions.sensor_kind='carbon dioxide';assert(v.derive(d).sensor.cross>0);});
test('controls reject impossible values and invalid provenance before export',()=>{for(const edit of [d=>d.parts.pop(),d=>{d.parts[0].numbers.volume=-1;},d=>{d.items[0].mass_kg=-.1;},d=>{d.atmosphere.low=39;},d=>{d.parts[0].source='javascript:alert(1)';}]){const d=v.initial();edit(d);assert.throws(()=>v.readDesign(d));}});

test('migrates older v1 briefs without adding thermal resistance or pressurized stocks',()=>{
  const d=v.initial(),c=d.parts.find(p=>p.family==='cabin'),power=d.parts.find(p=>p.family==='power');
  delete c.wallMaterial;delete c.numbers.thicknessMm;delete c.numbers.designPressure;delete d.conditions.exteriorKpa;
  for(const field of ['h2Volume','h2Pressure','h2Z','o2Z'])delete power.numbers[field];
  const before=JSON.stringify(d),restored=v.readDesign({format:'first-fire.vehicle-brief.v1',design:d});
  assert.equal(JSON.stringify(d),before);
  const r=v.derive(restored);assert.equal(r.assumptions.wallUA,80);assert.equal(r.storage.hydrogenKg,0);
  assert.equal(r.cabin.final.heatKJ,1094.4);assert.deepEqual(r,v.derive(d));
});

test('series conduction and pressure screening respond independently of fuel heat',()=>{
  const d=v.initial(),c=d.parts.find(p=>p.family==='cabin');c.numbers.thicknessMm=25;
  let r=v.derive(d);
  assert(r.thermal.conductivityWmK>150&&r.thermal.conductivityWmK<160);
  const aluminum=r.thermal.wallUAWK;c.wallMaterial='ss304';r=v.derive(d);
  assert(r.thermal.conductivityWmK>15&&r.thermal.conductivityWmK<16);
  assert(r.thermal.wallUAWK<aluminum);assert.equal(r.assumptions.wallUA,r.thermal.wallUAWK);
  c.numbers.designPressure=40;r=v.derive(d);assert(r.rating.headroomKpa<0);
  approx(r.rating.headroomKpa,40-Math.max(...r.cabin.trace.map(x=>x.pressureKpa)),1e-10);
  d.conditions.exteriorKpa=10;approx(v.derive(d).rating.headroomKpa,r.rating.headroomKpa+10,1e-10);
});

test('closed H₂ and O₂ stores honor compressibility and never leak into the cabin calculation',()=>{
  const d=v.initial(),power=d.parts.find(p=>p.family==='power').numbers,base=v.derive(d);
  Object.assign(power,{h2Volume:24,h2Pressure:20000,h2Z:1.15,tankVolume:12,tankPressure:20000,o2Z:.95});
  const r=v.derive(d);
  approx(r.storage.hydrogenKg,20000*24*.00201588/(8.31446261815324*300*1.15),1e-12);
  approx(r.housing.massKg-base.housing.massKg,r.storage.oxygenKg+r.storage.hydrogenKg,1e-9);
  assert.deepEqual(r.cabin.final,base.cabin.final);
  power.h2Z=0;assert.throws(()=>v.derive(d),/compressibility/);
});

test('condition matches and NASA margins are constrained to the named material and specimen',()=>{
  const d=v.initial();d.items[0].material='nomex';d.conditions.surface='Orbit';d.conditions.gravity_g=0;
  const rows=[['Nomex Velcro','good',0],['PMMA','wrong material',0],['Nomex fabric','wrong gravity',1]].map(([material,record_id,gravity_g])=>({
    material,record_id,gravity_g,o2_initial_pct:34,pressure_psia:d.atmosphere.pressure/6.8947573,phase:'solid',source_url:'https://psi.nasa.gov/'}));
  const archive={rows,coverage:items=>({matches:items,complete:items.length}),rank:items=>items.map(r=>({r,known:3,score:0}))};
  const r=v.derive(d,archive),selected=r.materialEvidence[0];
  assert.equal(r.joint,3);assert.equal(selected.jointCount,1);assert.equal(selected.joint[0].id,'good');
  assert.equal(selected.candidateCount,2);assert(selected.nearest.every(x=>x.id!=='wrong material'));
  assert.equal(selected.margin[0].specimen,'Nomex Velcro');assert.equal(selected.margin[0].oxygenPoints,.32);
  d.conditions.gravity_g=.1654;assert.equal(v.derive(d,archive).materialEvidence[0].jointCount,0);
});

test('per-property sources, limits and theoretical dependencies survive saved designs',()=>{
  const d=v.initial(),m={id:'user-c',name:'Coupon',family:'Experimental',behavior:'Bench-only limit',heatMJkg:20,
    density:null,oxygenKgKg:1,pyrolysisK:null,source:'',oxygenLimitPct:27,limitConditions:'1 g vertical coupon, sustained spread.',
    properties:{heatMJkg:{tag:'theoretical',source:'',locator:''},oxygenKgKg:{tag:'reference',source:'https://example.org/study',locator:'Table 7'},
      oxygenLimitPct:{tag:'assumed',source:'',locator:''}}};
  d.customMaterials.push(m);d.items[0].material=m.id;
  let r=v.derive(d),brief=v.brief(d,r);assert.equal(r.outputProvenance.fuelHeat.tag,'theoretical');
  assert.equal(r.outputProvenance.fuelOxygen.tag,'assumed');assert.equal(r.outputProvenance.powerGas.tag,'assumed');
  assert.equal(r.materialEvidence[0].jointCount,null);assert.equal(r.materialEvidence[0].reportedLimit.tag,'assumed');
  assert.equal(brief.provenance['materials.user-c.oxygenKgKg'].locator,'Table 7');assert(brief.sources.includes('https://example.org/study'));
  assert.deepEqual(v.derive(v.readDesign(brief)),r);
  m.properties.oxygenKgKg.locator='';assert.throws(()=>v.derive(d),/Cite a URL/);
  m.properties.oxygenKgKg.locator='Table 7';d.parts.find(p=>p.family==='mobility').origin='theoretical';r=v.derive(d);
  assert.equal(r.outputProvenance.mobilityTime.tag,'theoretical');assert.equal(r.outputProvenance.vehicleWeight.tag,'assumed');
});

test('gas-only branches start at the threshold, conserve moles and track pressure or dilution through time',()=>{
  for(const mode of ['vent gas','discharge CO₂']){
    const d=v.initial();d.conditions.response=mode;d.conditions.sensor_zone=d.conditions.fire_zone;
    const r=v.derive(d),b=r.response.transient;assert(b);assert.equal(b.trace[0].seconds,r.sensor.responseAt);
    assert.equal(b.final.seconds,d.conditions.duration_s);assert.equal(b.trace[0].addedCO2Mol,0);assert.equal(b.trace[0].ventedMol,0);
    for(const row of b.trace)approx(row.totalMol,b.startMol+row.addedCO2Mol-row.ventedMol,1e-9);
    if(mode==='vent gas'){
      assert(b.final.pressureKpa<b.trace[0].pressureKpa);approx(b.final.oxygenPct,b.trace[0].oxygenPct,1e-9);
      assert(b.final.oxygenPartialKpa<b.trace[0].oxygenPartialKpa);
    }else{
      approx(b.final.addedCO2Mol*.044009,r.response.releasedKg,1e-9);
      assert(b.final.oxygenPct<b.trace[0].oxygenPct);approx(b.final.oxygenMol,b.trace[0].oxygenMol,1e-9);
    }
  }
  const d=v.initial();d.conditions.response='vent gas';d.conditions.ignition='none';assert.equal(v.derive(d).response.transient,null);
});
