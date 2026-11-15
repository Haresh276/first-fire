import {createScene} from './scene/scene.mjs';
import {makeTraverseConfig, createTraverse, stepTraverse, runRoute} from './traverse.mjs';
import {drawMap,drawProfile} from './route-charts.mjs';

const $=id=>document.getElementById(id);
const fmt=(n,dp=1)=>n.toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:dp});
const courses={
  survey:[[0,18],[15,24],[24,8],[8,-4]],
  straight:[[0,36]],
  slope:[[16,12],[30,12],[42,24]]
};
const terrainNames={flat:'Level test course',grade:'10% grade',rolling:'Rolling test terrain',lola:'LOLA · south polar DEM'};
const slots={cabin:'Cabin',chassis:'Chassis',wheels:'Wheels',power:'Power',thermal:'Thermal control',lifeSupport:'Life support',access:'Airlock / suitport',detection:'Detector',suppression:'Suppression',material:'Material coupon',payload:'Payload'};
function displayQuantity(value, unit) {
  return value == null ? 'unavailable' : fmt(value,3)+' '+unit;
}
function inspectionReading(slot,c,r) {
  const q=displayQuantity;
  const readings={
    cabin:r.air?'Free volume '+q(c.volumeM3,'m³')+' · cabin '+q(c.pressureKPa,'kPa')+' · initial oxygen '+q(r.air.initialO2KPa,'kPa'):'Open crew deck · shared atmosphere unavailable.',
    chassis:'Assembled mass '+q(r.mobility.massKg,'kg')+' · level support '+q(r.mobility.staticSupportN,'N'),
    wheels:c.wheels+' installed wheels · equal level load '+q(r.mobility.staticLoadPerWheelN,'N/wheel'),
    power:'Generated '+q(r.power.generationW,'W')+' · stored after '+c.hours+' h '+q(r.power.endWh,'Wh'),
    thermal:'Net longwave out '+q(r.thermal.netLongwaveOutW,'W')+' · heat rejection margin '+q(r.thermal.rejectedMinusLoadW,'W'),
    lifeSupport:'Crew oxygen demand '+q(r.air?.metabolicO2G,'g')+' · CO₂ removed '+q(r.air?.scrubbedCO2G,'g'),
    access:'Access cycles '+c.cycles+' · gas lost '+q(r.air?.accessLossMol,'mol')+' · leakage '+q(r.air?.outwardLeakMol,'mol'),
    detection:'Window-end sampling zone '+q(r.tracer?.atSamplingZoneMgM3,'mg/m³')+' · modeled alarm time '+q(r.tracer?.thresholdTimeWithDelayS,'s'),
    suppression:'Agent delivered '+q(r.suppression.deliveredKg,'kg')+' · remaining '+q(r.suppression.remainingKg,'kg'),
    material:'Stock '+r.sourcing.origin+' · feed '+q(r.sourcing.feedG,'g')+' · chemical energy potential '+q(r.coupon?.netChemicalPotentialKJ,'kJ'),
    payload:'Assumed payload mass '+q(c.payloadKg,'kg')+' · calibration and mounting depend on the selected instrument.'
  };
  return readings[slot];
}
function overlayReading(mode,d,c,r) {
  const q=displayQuantity;
  switch(mode){
    case 'gravity':return d.hasGround?'Vertical gravity '+q(d.gravityMs2,'m/s²')+' · level support '+q(r.mobility.staticSupportN,'N'):'Orbital free fall · ideal sustained support 0 N.';
    case 'power':return 'Solar electricity '+q(d.solarW,'W')+' · '+c.phase+' · panel '+q(c.panelM2,'m²');
    case 'thermal':return 'Net longwave '+q(Math.abs(d.netThermalW),'W')+' '+(d.netThermalW<0?'inward':d.netThermalW>0?'outward':'exchange')+' · radiator skin '+q(c.skinK,'K');
    case 'access':return d.hasCabin?'Access loss '+q(d.accessLossMol,'mol')+' over '+c.cycles+' cycles · hull leakage '+q(d.leakMol,'mol'):'Open crew deck · no cabin gas inventory.';
    case 'ventilation':return d.hasCabin?'Fan from '+c.fanFrom+' · '+q(d.tracerFlowLs,'L/s')+' · duct '+q(r.flow.ductSpeedMs,'m/s')+' · '+r.flow.relativeDirection:'Open crew deck · cabin ventilation unavailable.';
    case 'suppression':return 'Agent delivered '+q(d.deliveredKg,'kg')+' · inventory remaining '+q(r.suppression.remainingKg,'kg')+' · extinction unmodeled.';
    default:return '';
  }
}
const driveFields={
  speedMps:['Commanded wheel speed','m/s',.01,8],turnRateRadS:['Turn rate','rad/s',.01,2],
  rollingResistance:['Rolling resistance','ratio',0,1],friction:['Friction coefficient','ratio',0,2],
  efficiency:['Drivetrain efficiency','fraction',.01,1],slipFraction:['Prescribed slip','fraction',0,.95],
  reservePct:['Battery reserve','%',0,100],wheelRadiusM:['Effective wheel radius','m',.01,2],
  trackWidthM:['Wheel track','m',.05,10]
};
function saveFile(name,content,mime) {
  const url=URL.createObjectURL(new Blob([content],{type:mime}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function makePoints(pairs) {return pairs.map(([xM,zM])=>({xM,zM}));}
function sameWaypoints(a,b) {return a.length===b.length && a.every((p,i)=>p.xM===b[i].xM && p.zM===b[i].zM);}
function trajectoryPose(a,b,t) {
  if(!b || !t)return a;
  const p={...a};
  for (const k of ['xM','zM','yM','wheelAngleRad','leftWheelAngleRad','rightWheelAngleRad','pitchRad','rollRad','distanceM','batteryWh','elapsedS','driveWh','hotelWh','solarWh','curtailedWh'])p[k]=a[k]+(b[k]-a[k])*t;
  const delta=b.headingRad-a.headingRad;
  p.headingRad=a.headingRad+Math.atan2(Math.sin(delta),Math.cos(delta))*t;
  return p;
}

export function mountWorkbench({catalog, sources, jezero, lola, changeCondition, changeEnvironment, changePart, checkScenario, loadScenario}) {
  let scenario,result, config,state,plan=null,track=[],playhead=0,replaying=false,manualMode=false;
  let terrain='rolling',waypoints=makePoints(courses.survey),preset='survey',overrides={};
  let active=true, layer='exterior',selectedSlot=null,tool='drive',firePlaying=false,fireT=0;
  let prevFrame=0,queued=0,lastReadout=0,mapPoint=null,inManual=true,runId='',uiMessage='';
  const held=new Set(), inputs=new Map();
  const status=$('drive-status'), canvas=$('rover-scene');
  function toolTab(name) {
    if(tool!==name)halt();
    tool=name;
    for(const b of document.querySelectorAll('[data-tool]')){
      const selected=b.dataset.tool===name;b.setAttribute('aria-pressed',String(selected));$('tool-'+b.dataset.tool).hidden=!selected;
    }
    if(name!=='fire')firePlaying=false;
    if(name==='fire')setLayer('cutaway');
    if(name==='inspect'){selectedSlot=$('inspect-slot').value;showPart();}
    if(name!=='inspect')selectedSlot=null;
    refresh();
  }
  const scene=createScene(canvas,{onPick: slot=>{
    if(!slot || !Object.hasOwn(slots,slot))return;
    $('inspect-slot').value=slot; toolTab('inspect');
  }});
  function setLayer(mode) {
    layer=mode;
    for(const b of document.querySelectorAll('[data-layer]'))b.setAttribute('aria-pressed',String(b.dataset.layer===layer));
    refresh();
  }
  function showPart() {
    if(!scenario)return;
    const key=$('inspect-slot').value;
    $('inspect-part').replaceChildren(...catalog.parts.filter(p=>p.slot===key).map(p=>new Option(p.title,p.id)));
    $('inspect-part').value=scenario.parts[key];
    const p=catalog.parts.find(p=>p.id===scenario.parts[key]);
    $('inspect-description').textContent=p.scope+' '+(scenario.customNames?.[key]?'Design name · '+scenario.customNames[key]+'. ':'')+'Interfaces unverified.';
    $('inspect-reading').textContent=result?inspectionReading(key,scenario.conditions,result):'';
    const refs=$('inspect-sources');refs.replaceChildren();
    for (const id of p.sourceIds) {
      const entry=sources?.find(s=>s.id===id);if(!entry)continue;
      const a=document.createElement('a');a.href=entry.url;a.textContent=entry.agency+' · '+entry.title;a.target='_blank';a.rel='noopener noreferrer';refs.append(a);
    }
  }
  function stop() {held.clear();replaying=false;firePlaying=false;prevFrame=0;}
  function resetDrive() {
    stop();plan=null;playhead=0;manualMode=false;inManual=true;uiMessage='';
    if(config)runId=JSON.stringify(config);
    state=config ? createTraverse(config) : null;track=state?[state]:[];
    $('replay-line').hidden=true;
  }
  function replacePath(points,key) {
    waypoints=structuredClone(points);preset=key;
    $('route-preset').value=key;
    resetDrive();updateRouteText();refresh();
  }
  function updateRouteText() {
    $('waypoints-list').replaceChildren(...waypoints.map(p=>{
      const li=document.createElement('li');li.textContent='X '+fmt(p.xM,2)+' m · Z '+fmt(p.zM,2)+' m';return li;
    }));
    const text=$('route-description');text.replaceChildren();
    if(preset==='jezero') {
      const link=document.createElement('a');link.href=jezero.missionMapUrl;link.target='_blank';link.rel='noopener';link.textContent='NASA/JPL map';
      text.append('Sol 15 · '+jezero.cataloguedLengthM+' m catalogued. Simplified horizontal trace on a level test surface. ',link);
    } else if(terrain==='lola'){
      const link=document.createElement('a');link.href='../terrain/lola.json';link.textContent='Tile provenance';
      text.append('NASA LRO/LOLA · 80 m grid near 89.5001° S, 0.1512° E. Sub-grid obstacles are unresolved. ',link);
    } else text.textContent='Local X/Z metres. Click the map or enter coordinates to extend the plan. Dashed line is planned; orange is traveled.';
  }
  function rebuildConfig() {
    if(!result)return;
    config=makeTraverseConfig(scenario,result,{...overrides,terrain});
    for(const [key,input] of inputs)input.value=config[key];
  }
  function planToggle() {
    if(!result || !config || !waypoints.length || config.world==='Orbit')return;
    if(replaying){replaying=false;refresh();return;}
    if(!plan || playhead>=plan.track.length-1){
      plan=runRoute(config,waypoints,{dtS:.25,maxTimeS:3600});
      playhead=0;track=plan.track;state=track[0];inManual=false;manualMode=false;
      $('replay-seek').max=Math.max(0,track.length-1);$('replay-line').hidden=false;
    }
    uiMessage='';held.clear();replaying=plan.track.length>1;prevFrame=0;refresh();schedule();
  }
  function showSnapshot() {
    if(!state || !config || !result)return null;
    // Route review exports exactly the prefix visible at the current replay time.
    const prefix=activeTrack();
    return {config:{...config},state:{...state},status:state.status,mode:inManual?(manualMode?'manual':'ready'):'planned replay',
      routePreset:preset, terrainProvenance:terrain==='lola'?lola:{type:'analytical test surface',terrain},
      routeProvenance:preset==='jezero'?jezero:{type:'assumed waypoints',frame:'local projected X/Z metres'},
      waypoints:structuredClone(waypoints),waypointsReached:!inManual && plan && playhead>=plan.track.length-1?plan.waypointsReached:null,
      track:prefix};
  }
  function activeTrack() {
    if(inManual || !plan) {
      if(!state || !track.length)return track;
      const last=track.at(-1);
      if(last===state)return track;
      if(last.elapsedS===state.elapsedS)return [...track.slice(0,-1),state];
      return [...track,state];
    }
    const i=Math.floor(playhead);
    const prefix=plan.track.slice(0,i+1);
    if(i!==playhead)prefix.push(state);
    return prefix;
  }
  function refreshScene() {
    if(!active || !state || !result)return;
    const c=scenario.conditions,air=result.air, k=4*c.exchangeLs/1000/c.volumeM3;
    const decay=Math.exp(-k*fireT);
    const concentrations=c.pulseMg===0?{sourceFraction:0,remoteFraction:0}:{sourceFraction:(1+decay)/2,remoteFraction:(1-decay)/2};
    const tracer=tool==='fire' && air?{...concentrations,sourceZone:c.ignition}:null;
    const overlay=$('scene-overlay').value,overlayData={
      gravityMs2:result.mobility.idealSupportAccelerationMs2,solarW:result.power.generationW,
      netThermalW:result.thermal.netLongwaveOutW,accessLossMol:air?.accessLossMol,leakMol:air?.outwardLeakMol,
      tracerFlowLs:c.exchangeLs,fanDirection:c.fanFrom,ignition:c.ignition,deliveredKg:result.suppression.deliveredKg,
      hasCabin:Boolean(air),hasGround:c.world!=='Orbit'
    };
    const readout=$('overlay-reading');
    readout.hidden=overlay==='none';
    const line=overlayReading(overlay,overlayData,c,result);
    if(readout.textContent!==line)readout.textContent=line;
    scene.update(scenario,{...state,heightM:state.yM,steerRad:0},{mode:layer,selectedSlot,terrain,tracer,
      overlay,overlayData,wheelRadiusM:config.wheelRadiusM,trackWidthM:config.trackWidthM});
    const help=canvas.dataset.wheelScale==='schematic'?'Concept geometry · wheel dimensions clipped for display':'Concept geometry · drag to orbit';
    if($('scene-help').textContent!==help)$('scene-help').textContent=help;
  }
  function renderFire() {
    if(!scenario)return;
    const c=scenario.conditions;
    $('fire-seek').max=c.windowS;$('fire-seek').value=fireT;$('fire-clock').textContent=fmt(fireT,1)+' s';
    const enabled=Boolean(result?.air);
    for(const id of ['fire-origin','fire-sensor','fire-fan','fire-seek','play-fire'])$(id).disabled=!enabled;
    $('play-fire').textContent=firePlaying?'Pause tracer test':'Play tracer test';
    if(!enabled){$('fire-reading').textContent='A sealed cabin is required for the two-zone tracer experiment.';return;}
    const decay=Math.exp(-4*c.exchangeLs/1000*fireT/c.volumeM3),mean=c.pulseMg/c.volumeM3;
    const src=mean*(1+decay),dst=mean*(1-decay);
    const t=result.tracer.thresholdTimeWithDelayS;
    const status=scenario.parts.detection==='no-detector'?'No detector installed.':t===null?'No modeled crossing in this observation window.':fireT>=t?'Modeled threshold reached at '+fmt(t)+' s.':'Modeled threshold at '+fmt(t)+' s.';
    $('fire-reading').textContent='Release zone '+fmt(src,2)+' mg/m³ · other zone '+fmt(dst,2)+' mg/m³. '+status;
  }
  function drawPlots() {
    if(!active || !state)return;
    const prefix=activeTrack();
    mapPoint=drawMap($('route-map'),waypoints,prefix,state,terrain);
    drawProfile($('drive-profile'),prefix);
  }
  function refresh() {
    if(!active || !scenario || !result || !state)return;
    const orb=config.world==='Orbit';
    $('motion-distance').textContent=fmt(state.distanceM)+' m';$('motion-speed').textContent=fmt(state.speedMps,2)+' m/s';
    $('motion-battery').textContent=fmt(state.batteryWh)+' Wh';$('motion-time').textContent=fmt(state.elapsedS)+' s';
    const degree=180/Math.PI;
    const items=[['Drive energy',fmt(state.driveWh,2)+' Wh'],['Other loads',fmt(state.hotelWh,2)+' Wh'],['Solar input',fmt(state.solarWh,2)+' Wh'],['Pitch / roll',orb?'—':fmt(state.pitchRad*degree)+'° / '+fmt(state.rollRad*degree)+'°']];
    const dl=$('run-metrics');
    if(!dl.children.length)for(const [label] of items){const d=document.createElement('div');const t=document.createElement('dt');t.textContent=label;d.append(t,document.createElement('dd'));dl.append(d);}
    items.forEach((v,i)=>dl.children[i].lastElementChild.textContent=v[1]);
    $('run-context').textContent=orb?'Orbital free fall · no ground contact.':'Elevation (m) over traveled distance (m) · '+(inManual?'manual drive':'route replay');
    $('scene-title').textContent=scenario.name.replace(/^Code Blooded\s*\|\s*/,'');
    $('scene-terrain').textContent=orb?'Orbital free fall':scenario.conditions.world+' / '+terrainNames[terrain];
    $('play-route').textContent=replaying?'Pause traverse':plan && playhead<plan.track.length-1?'Resume traverse':'Run planned traverse';
    $('play-route').disabled=orb||!waypoints.length;
    for(const b of document.querySelectorAll('[data-command]')){b.disabled=orb;b.classList.toggle('held',held.has(b.dataset.command));}
    $('drive-terrain').disabled=orb;$('route-preset').disabled=orb;
    $('export-track').disabled=activeTrack().length<2;
    $('undo-point').disabled=!waypoints.length;$('clear-points').disabled=!waypoints.length;
    $('replay-seek').value=playhead;$('replay-label').textContent=fmt(state.elapsedS)+' s / '+fmt(plan?.state.elapsedS??0)+' s';
    status.textContent=uiMessage || (orb?'Wheel drive is unavailable in orbital free fall.':state.status==='ready'?waypoints.length+' planned waypoint'+(waypoints.length===1?'':'s')+' · ready to drive.':state.status==='route complete'?'Traverse complete · '+plan.waypointsReached+'/'+waypoints.length+' waypoints.':state.status+(replaying?' · playback':''));
    renderFire();refreshScene();drawPlots();
  }
  function schedule() {
    if(!queued && active && (held.size || replaying || firePlaying))queued=requestAnimationFrame(frame);
  }
  function frame(now) {
    queued=0;
    if(!active || !result || !state)return;
    const dt=prevFrame?Math.min(.12,(now-prevFrame)/1000):0;
    prevFrame=now;
    const rate=Number($('drive-rate').value);
    if(held.size && dt) {
      const cmd={throttle:Number(held.has('forward'))-Number(held.has('reverse')),steer:Number(held.has('right'))-Number(held.has('left'))};
      state=stepTraverse(state,cmd,Math.min(2,dt*rate),config);
      if(state.elapsedS===track.at(-1).elapsedS)track[track.length-1]=state;
      else if(state.elapsedS-track.at(-1).elapsedS>=.25 || state.status!=='driving')track.push(state);
      if(['traction limit','battery reserve','map boundary','orbital free fall'].includes(state.status))held.clear();
    } else if(replaying && dt) {
      // The final step may be clipped to the reserve or route time limit.
      let time=state.elapsedS+dt*rate, i=Math.floor(playhead),last=plan.track.length-1;
      while(i<last && plan.track[i+1].elapsedS<=time)i++;
      const a=plan.track[i],b=plan.track[i+1];
      const t=b?(time-a.elapsedS)/(b.elapsedS-a.elapsedS):0;
      playhead=i+t;state=trajectoryPose(a,b,t);
      if(i===last)replaying=false;
    }
    if(firePlaying){fireT=Math.min(scenario.conditions.windowS,fireT+dt*rate);if(fireT>=scenario.conditions.windowS)firePlaying=false;}
    if(now-lastReadout>110 || (!held.size && !replaying && !firePlaying)){refresh();lastReadout=now;}else refreshScene();
    schedule();
  }
  function press(key) {
    if(!result || config.world==='Orbit' || !active || tool!=='drive')return;
    if(!inManual){resetDrive();}
    manualMode=true;held.add(key);uiMessage='';if(!queued)prevFrame=0;schedule();refresh();
  }
  function release(key) {
    held.delete(key);
    if(!held.size && inManual && state && state.status==='driving') {
      state={...state,speedMps:0,steer:0,status:'idle'};
      if(track.at(-1)?.elapsedS===state.elapsedS)track[track.length-1]=state;else track.push(state);
    }
    refresh();
  }
  function editPath(points) {
    if(points.length>64 || points.some(p=>!Number.isFinite(p.xM)||!Number.isFinite(p.zM)||Math.max(Math.abs(p.xM),Math.abs(p.zM))>(terrain==='lola'?2560:1000000))) {
      uiMessage='Enter up to 64 finite waypoints within the terrain bounds.';refresh();return false;
    }
    replacePath(points,'custom');return true;
  }
  for(const [id,title] of Object.entries(slots))$('inspect-slot').add(new Option(title,id));
  for(const [key,[title,unit,min,max]] of Object.entries(driveFields)){
    const label=document.createElement('label'),input=document.createElement('input');
    label.textContent=title+' ('+unit+')';input.type='number';input.step='any';input.min=min;input.max=max;input.id='drive-'+key;
    input.addEventListener('change',()=>{
      const v=input.valueAsNumber;
      if(!Number.isFinite(v) || v<min || v>max){input.value=config[key];uiMessage='Expected '+title+' between '+min+' and '+max+'.';refresh();return;}
      overrides[key]=v;rebuildConfig();resetDrive();refresh();
    });label.append(input);$('drive-fields').append(label);inputs.set(key,input);
  }
  for(const b of document.querySelectorAll('[data-layer]'))b.addEventListener('click',()=>setLayer(b.dataset.layer));
  $('scene-overlay').onchange=()=>{
    if(['ventilation','suppression'].includes($('scene-overlay').value))setLayer('cutaway');
    else refresh();
  };
  for(const b of document.querySelectorAll('[data-tool]'))b.addEventListener('click',()=>toolTab(b.dataset.tool));
  $('inspect-slot').onchange=()=>{selectedSlot=$('inspect-slot').value;showPart();refresh();};
  $('inspect-part').onchange=()=>changePart($('inspect-slot').value,$('inspect-part').value);
  $('reset-camera').onclick=()=>scene.resetCamera();
  for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>{
    const [yaw,pitch,zoom]=JSON.parse(b.dataset.camera);scene.nudgeCamera(yaw,pitch,zoom);
  };
  $('drive-world').onchange=()=>changeEnvironment($('drive-world').value,$('drive-phase').value);
  $('drive-phase').onchange=()=>changeEnvironment($('drive-world').value,$('drive-phase').value);
  $('drive-terrain').onchange=()=>{
    terrain=$('drive-terrain').value;
    if(preset==='jezero' && terrain!=='flat')preset='custom';
    if(terrain==='lola' && waypoints.some(p=>Math.abs(p.xM)>2560||Math.abs(p.zM)>2560)){waypoints=makePoints(courses.survey);preset='survey';}
    $('route-preset').value=preset;rebuildConfig();resetDrive();updateRouteText();refresh();
  };
  $('route-preset').onchange=()=>{
    const key=$('route-preset').value;
    if(key==='jezero'){
      terrain='flat';if(scenario.conditions.world!=='Mars')changeEnvironment('Mars',scenario.conditions.phase);
      $('drive-terrain').value=terrain;rebuildConfig();replacePath(jezero.waypoints,key);
    }else if(Object.hasOwn(courses,key))replacePath(makePoints(courses[key]),key);
  };
  $('route-map').onclick=e=>{if(!mapPoint || config.world==='Orbit')return;const r=e.target.getBoundingClientRect();editPath([...waypoints,mapPoint(e.clientX-r.left,e.clientY-r.top)]);};
  $('add-point').onclick=()=>editPath([...waypoints,{xM:$('point-x').valueAsNumber,zM:$('point-z').valueAsNumber}]);
  $('undo-point').onclick=()=>editPath(waypoints.slice(0,-1));$('clear-points').onclick=()=>editPath([]);
  $('play-route').onclick=planToggle;$('reset-drive').onclick=()=>{resetDrive();refresh();};
  $('replay-seek').oninput=()=>{
    if(!plan)return;
    replaying=false;playhead=Number($('replay-seek').value);state=plan.track[playhead];refresh();
  };
  const keys={w:'forward',a:'left',s:'reverse',d:'right',ArrowUp:'forward',ArrowDown:'reverse',ArrowLeft:'left',ArrowRight:'right'};
  function keyOf(e){return keys[e.key] || keys[e.key.toLowerCase()];}
  canvas.addEventListener('keydown',e=>{const k=keyOf(e);if(k && !e.metaKey && !e.ctrlKey && !e.altKey){e.preventDefault();if(!e.repeat)press(k);}});
  window.addEventListener('keyup',e=>{const k=keyOf(e);if(k && held.has(k))release(k);});
  function halt(){const wasManual=held.size>0;stop();if(wasManual)release('');}
  canvas.addEventListener('blur',()=>{if(held.size)halt();});
  window.addEventListener('blur',halt);document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();});
  for(const b of document.querySelectorAll('[data-command]')){
    b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);press(b.dataset.command);});
    b.addEventListener('lostpointercapture',()=>release(b.dataset.command));
    b.addEventListener('keydown',e=>{if(e.key===' ' || e.key==='Enter'){e.preventDefault();if(!e.repeat)press(b.dataset.command);}});
    b.addEventListener('keyup',e=>{if(e.key===' ' || e.key==='Enter')release(b.dataset.command);});
    b.addEventListener('blur',()=>{if(held.has(b.dataset.command))release(b.dataset.command);});
  }
  $('fire-origin').onchange=()=>changeCondition('ignition',$('fire-origin').value);
  $('fire-sensor').onchange=()=>changeCondition('sensor',$('fire-sensor').value);
  $('fire-fan').onchange=()=>{const v=$('fire-fan').valueAsNumber;if(v>=0 && v<=500)changeCondition('exchangeLs',v);else $('fire-fan').value=scenario.conditions.exchangeLs;};
  $('fire-seek').oninput=()=>{fireT=Number($('fire-seek').value);firePlaying=false;refresh();};
  $('play-fire').onclick=()=>{if(fireT>=scenario.conditions.windowS)fireT=0;firePlaying=!firePlaying;prevFrame=0;refresh();schedule();};
  $('export-track').onclick=()=>{
    const data=showSnapshot();if(!data)return;
    const cols=Object.keys(data.state);
    const body=[cols.join(','),...data.track.map(row=>cols.map(k=>row[k]).join(','))].join('\n')+'\n';
    saveFile('first-fire-traverse.csv',body,'text/csv');
  };
  $('export-plan').onclick=()=>saveFile('first-fire-route.json',JSON.stringify({format:'first-fire.route/1',scenario,terrain,overrides,preset,waypoints},null,2),'application/json');
  $('import-plan').onclick=()=>$('plan-file').click();
  $('plan-file').onchange=async()=>{
    const f=$('plan-file').files[0];if(!f)return;
    try{
      if(f.size>2000000)throw Error('File exceeds 2 MB.');
      const data=JSON.parse(await f.text());
      if(data.format!=='first-fire.route/1' || !Object.hasOwn(terrainNames,data.terrain) ||
          !['survey','straight','slope','jezero','custom'].includes(data.preset) ||
          !Array.isArray(data.waypoints) || data.waypoints.length>64)throw Error('Unknown route format, course, terrain or waypoint count.');
      if(!data.overrides || typeof data.overrides!=='object' || Array.isArray(data.overrides) || Object.keys(data.overrides).some(k=>!Object.hasOwn(driveFields,k)))throw Error('Invalid drive settings.');
      const test=checkScenario(data.scenario),cfg=makeTraverseConfig(data.scenario,test,{...data.overrides,terrain:data.terrain});
      const bound=cfg.terrain==='lola'?2560:1e6;
      if(data.waypoints.some(p=>!p || !Number.isFinite(p.xM) || !Number.isFinite(p.zM) || Math.max(Math.abs(p.xM),Math.abs(p.zM))>bound))throw Error('Invalid waypoint coordinates.');
      let key=Object.hasOwn(courses,data.preset) && sameWaypoints(data.waypoints,makePoints(courses[data.preset]))?data.preset:'custom';
      if(data.preset==='jezero' && cfg.world==='Mars' && cfg.terrain==='flat' && sameWaypoints(data.waypoints,jezero.waypoints))key='jezero';
      loadScenario(data.scenario);overrides={...data.overrides};terrain=cfg.terrain;$('drive-terrain').value=terrain;
      rebuildConfig();replacePath(data.waypoints,key);uiMessage='Loaded route · '+f.name;refresh();
    }catch(e){uiMessage='Could not load route. '+e.message;refresh();}
    $('plan-file').value='';
  };
  new ResizeObserver(()=>{if(active && state)drawPlots();}).observe($('route-map'));
  return {
    update(s,r) {
      scenario=s;result=r;
      if(!r){stop();config=null;state=null;$('workbench').inert=true;$('workbench').classList.add('invalid-run');return;}
      $('workbench').inert=false;$('workbench').classList.remove('invalid-run');
      if(s.conditions.world!=='Moon' && terrain==='lola')terrain='rolling';
      if(s.conditions.world!=='Mars' && preset==='jezero') {preset='survey';waypoints=makePoints(courses.survey);}
      if(!jezero)$('route-preset').querySelector('[value=jezero]').disabled=true;
      $('drive-world').value=s.conditions.world;$('drive-phase').value=s.conditions.phase;
      $('drive-terrain').querySelector('[value=lola]').disabled=s.conditions.world!=='Moon';$('drive-terrain').value=terrain;
      $('route-preset').value=preset;
      rebuildConfig();const key=JSON.stringify(config);
      if(runId!==key || !state){runId=key;resetDrive();}
      $('fire-origin').value=s.conditions.ignition;$('fire-sensor').value=s.conditions.sensor;$('fire-fan').value=s.conditions.exchangeLs;
      fireT=Math.min(fireT,s.conditions.windowS);
      updateRouteText();showPart();refresh();
    },
    visible(value){active=value;if(!value)halt();else requestAnimationFrame(refresh);},
    snapshot:showSnapshot
  };
}
