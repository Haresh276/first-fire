const test=require('node:test'),assert=require('node:assert/strict');
const {materials,points,boundary,atmosphere,tested}=require('../site/master-materials.js');
const {stats}=require('../site/front-tracking.js');
test('worked atmospheres reproduce F9.4 and exclude nitrogen ratio for other diluents',()=>{
 const a=atmosphere({pressure:101.3,oxygen:21}),b=atmosphere({pressure:56.5,oxygen:34});
 assert.deepEqual([a,b].map(x=>Math.round(x.moles)),[487,272]);
 assert.deepEqual([a,b].map(x=>+x.ratio.toFixed(1)),[2.7,1.3]);assert.equal(+b.pO2.toFixed(2),19.21);
 assert.equal(atmosphere({diluent:'He'}).ratio,null);assert.throws(()=>atmosphere({oxygen:-1}));
});
test('flow interpolation is bounded and evidence matching requires all conditions in one row',()=>{
 for(const id of ['pmma','nomex']){const c=points(id,'curve');assert.equal(boundary(id,.1),null);
  assert.equal(boundary(id,2000),null);assert.equal(boundary(id,c[1].flow),c[1].oxygen);assert(c[0].oxygen>Math.min(...c.map(p=>p.oxygen))+2);}
 const material=materials.find(x=>x.id==='pmma');
 const good={material:'PMMA',gravity_g:'0',pressure_psia:'8.2',o2_initial_pct:'34'};assert.equal(tested([good],material,0,56.54,34).length,1);
 assert.equal(tested([good,{...good,gravity_g:'0.165',pressure_psia:''}],material,.165,56.54,34).length,0);
 assert.equal(materials.filter(x=>x.margin.length).length,5);assert.equal(materials.length,12);
});
test('oblique pixel axis, unsorted marks and reversal give a signed speed in mm/s',()=>{
 const cal=[{x:0,y:0},{x:30,y:40}],r=stats(cal,100,[{x:18,y:24,t:4},{x:6,y:8,t:0},{x:12,y:16,t:2}]);assert.equal(r.slopeMmS,10);assert.equal(r.residualRmsMm,0);assert.equal(r.rows[2].pointBoundMmS,2);
 assert.equal(stats(cal,100,[{x:6,y:8,t:1},{x:0,y:0,t:2}]).slopeMmS,-20);
 assert.throws(()=>stats(cal,100,[{x:1,y:1,t:1},{x:2,y:2,t:1}]));
});

test('crew-days, unrecovered airlock and leak accounting are independently additive',()=>{
 const {consumables}=require('../site/master-materials.js'),s={pressure:56.5,oxygen:34,volume:12,suit:29.6,diluent:'N2'};
 const r=consumables(2,3,.5,2,1,s);assert.equal(r.crewO2,5.04);assert.equal(r.crewCO2,6);
 assert(Math.abs(r.gasMakeup-atmosphere(s).massKg*2.012*3/12)<1e-9);assert(r.lostO2<r.gasMakeup);
 assert.equal(consumables(0,0,0,0,0,s).gasMakeup,0);assert.throws(()=>consumables(1,-1,0,0,1,s));
});
test('material fire check requires joint evidence and distinguishes Table 2 applicability',()=>{
 const {materialCheck}=require('../site/master-materials.js'),m=materials.find(v=>v.id==='pmma');
 const s={gravity:.165,pressure:56.54,oxygen:34,diluent:'N2'};
 const fake=[{record_id:'argon',material:'PMMA',gravity_g:0,pressure_psia:8.2,o2_initial_pct:34},{record_id:'unknown',material:'PMMA',gravity_g:null,pressure_psia:8.2,o2_initial_pct:34}];
 assert.deepEqual(materialCheck(fake,m,s).ids,[]);assert(materialCheck(fake,m,s).nearLunarReference);
 assert(!materialCheck(fake,m,{...s,diluent:'He'}).nearLunarReference);
 assert.equal(materialCheck(fake,m,{...s,gravity:0}).ids[0],'argon');
});
test('band endpoints run published cabin chemistry for each diluent and withhold outside the domain',()=>{
 const {bandTrial,flameEstimate}=require('../site/master-materials.js'),engine=require('../site/master-physics.js');
 const s={pressure:56.54,oxygen:34,diluent:'N2',volume:12};
 for(const diluent of ['N2','He','Ar']){
   assert.equal(bandTrial({...s,diluent},17,'cellulose',engine).heatKJ,0);
   assert(Math.abs(bandTrial({...s,diluent},34,'cellulose',engine).heatKJ-1094.4)<.001);
   assert.equal(flameEstimate({...s,oxygen:44,diluent},'cellulose',engine),null);
 }
 assert.equal(bandTrial({...s,pressure:20},25,'cellulose',engine),null);
 assert.equal(flameEstimate(s,'cellulose',engine),engine.equilibrium('cellulose',34,56.54));
 assert(flameEstimate({...s,diluent:'Ar'},'cellulose',engine)>flameEstimate(s,'cellulose',engine));
});

test('He and Ar interpolation agrees with 20 separate Cantera HP equilibrium solves within 2%',()=>{
 const {flameEstimate}=require('../site/master-materials.js'),engine=require('../site/master-physics.js');
 const references=[["He","cellulose",12.2,35.1,1966.379],["He","cellulose",17.7,49.7,2255.477],["He","cellulose",22.4,74.4,2406.455],["He","cellulose",27.8,88.1,2516.293],["He","cellulose",37.9,102.3,2641.501],["He","polyethylene",12.2,35.1,2098.122],["He","polyethylene",17.7,49.7,2412.027],["He","polyethylene",22.4,74.4,2579.869],["He","polyethylene",27.8,88.1,2703.14],["He","polyethylene",37.9,102.3,2846.874],["Ar","cellulose",12.2,35.1,1966.379],["Ar","cellulose",17.7,49.7,2255.477],["Ar","cellulose",22.4,74.4,2406.455],["Ar","cellulose",27.8,88.1,2516.293],["Ar","cellulose",37.9,102.3,2641.501],["Ar","polyethylene",12.2,35.1,2098.122],["Ar","polyethylene",17.7,49.7,2412.027],["Ar","polyethylene",22.4,74.4,2579.869],["Ar","polyethylene",27.8,88.1,2703.14],["Ar","polyethylene",37.9,102.3,2846.874]];
 for(const [diluent,fuel,oxygen,pressure,kelvin] of references){const r=flameEstimate({diluent,oxygen,pressure},fuel,engine);assert(Math.abs(r-kelvin)/kelvin<.02,[diluent,fuel,oxygen,pressure].join(' '));}
});
