// Three.js r160.1 is bundled locally under scene/vendor with its upstream MIT license.
import * as T from './vendor/three.module.min.js';
import {buildHardware,displayDimensions} from './hardware.mjs';
import {landscape} from './landscape.mjs';
import {software} from './software.mjs';

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function release(root){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    for(const mat of [node.material].flat().filter(Boolean)){
      materials.add(mat);Object.values(mat).forEach(value=>{if(value?.isTexture)textures.add(value);});
    }
  });
  for(const item of [...geometries,...textures,...materials])item.dispose();
}

export function createScene(canvas,{onPick=()=>{}}={}){
  let renderer=null,cpu=null;
  const config={alpha:false,antialias:true,powerPreference:'default',preserveDrawingBuffer:false};
  let context=null;
  try {context=canvas.getContext('webgl2',config)||canvas.getContext('webgl',config);} catch {}
  if(context){
    renderer=new T.WebGLRenderer({canvas,context,...config});
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  }else cpu=software(canvas);
  canvas.dataset.renderer=renderer?'webgl':'canvas-3d';canvas.style.touchAction='none';
  const camera=new T.PerspectiveCamera(38,1,.08,550), scene=new T.Scene(), env=renderer?landscape(scene):null;
  const ray=new T.Raycaster(), pointer=new T.Vector2(), focus=new T.Vector3();
  let hardware=null,dimensions=null,key='',state=null,pose={},view={},dead=false,raf=0,softLast=0;
  let yaw=.68,elevation=.29,distance=6.7;
  function draw(t=0){
    raf=0;if(dead||!state)return;
    if(cpu && t-softLast<50 && t!==0){raf=requestAnimationFrame(draw);return;}
    softLast=t;
    // Hidden workbench tabs have no layout size. ResizeObserver requests the next visible frame.
    const width=Math.round(canvas.clientWidth),height=Math.round(canvas.clientHeight);
    if(!width || !height)return;
    const dpr=renderer?Math.min(1.8,window.devicePixelRatio||1):Math.min(1.15,window.devicePixelRatio||1);
    if(renderer){
      if(renderer.getPixelRatio()!==dpr || canvas.width!==Math.floor(width*dpr) || canvas.height!==Math.floor(height*dpr)){
        renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);
      }
    }else if(canvas.width!==Math.floor(width*dpr)||canvas.height!==Math.floor(height*dpr)){
      canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);
    }
    camera.aspect=width/height;camera.updateProjectionMatrix();
    const y=pose.heightM??pose.yM??0,x=pose.xM??0,z=pose.zM??0;
    hardware.root.position.set(x,y,z);hardware.root.rotation.set(-(pose.pitchRad||0),pose.headingRad||0,pose.rollRad||0,'YXZ');
    const marked=hardware.update(pose,view,state);
    canvas.dataset.activeOverlay=marked?view.overlay:'none';
    const exploded=view.mode==='exploded', zoom=(exploded?1.30:1)*Math.max(1,1.12/camera.aspect);
    const extent=dimensions.scale*Math.max(1,.58+.42*dimensions.width,.40+.60*dimensions.length);
    const radius=distance*zoom*extent,flat=radius*Math.cos(elevation);
    focus.set(x,y+(exploded?1.7:1.26)*dimensions.scale,z);
    camera.position.set(x+Math.sin(yaw)*flat,focus.y+Math.sin(elevation)*radius,z+Math.cos(yaw)*flat);
    camera.lookAt(focus);camera.updateMatrixWorld();scene.updateMatrixWorld();
    if(renderer){env.update(state.conditions.world,state.conditions.phase,view.terrain||'flat',pose,camera,dimensions);renderer.render(scene,camera);}
    else cpu.render(hardware.root,camera,state,pose,view);
  }
  function invalidate(){if(!dead&&!raf)raf=requestAnimationFrame(draw);}
  function update(scenario,newPose={},newView={}){
    if(dead)return;
    const defaultCount=scenario.parts.wheels==='six-wheel'?6:4;
    const count=scenario.conditions.wheels??defaultCount;
    const radius=newView?.wheelRadiusM??.47,track=newView?.trackWidthM??2.42;
    const newKey=JSON.stringify([scenario.parts,count,radius,track]);
    if(newKey!==key){
      if(hardware){scene.remove(hardware.root);release(hardware.root);}
      dimensions=displayDimensions(count,radius,track);
      hardware=buildHardware(scenario.parts,dimensions);scene.add(hardware.root);key=newKey;
      canvas.dataset.wheelCount=String(hardware.wheelCount);
      canvas.dataset.wheelRadiusM=String(dimensions.radius);
      canvas.dataset.trackWidthM=String(dimensions.track);
      canvas.dataset.wheelScale=dimensions.limited?'schematic':'matched';
    }
    state=scenario;pose=newPose||{};view=newView||{};invalidate();
  }
  function nudgeCamera(yawDeltaRad=0,pitchDeltaRad=0,zoomFactor=1){
    yaw+=yawDeltaRad;elevation=clamp(elevation+pitchDeltaRad,.048,1.46);
    distance=clamp(distance*zoomFactor,3.7,20);invalidate();
  }
  function resetCamera(){yaw=.68;elevation=.29;distance=6.7;invalidate();}
  function pick(event){
    if(!hardware)return;
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
    ray.setFromCamera(pointer,camera);
    const hits=ray.intersectObject(hardware.root,true);
    for(const hit of hits){
      let slot=null,visible=true;
      for(let node=hit.object;node;node=node.parent){
        if(!node.visible||node.userData.nonPick){visible=false;break;}
        if(node.userData.slot)slot=node.userData.slot;
      }
      if(visible&&slot){onPick(slot);return;}
    }
    onPick(null);
  }
  const events=new AbortController(), points=new Map();
  let moved=false,oldPinch=0,start=null;
  function pinch(){
    const [a,b]=points.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;
  }
  function listen(name,callback,options={}){
    canvas.addEventListener(name,callback,{...options,signal:events.signal});
  }
  listen('webglcontextlost',e=>{e.preventDefault();canvas.dataset.renderer='webgl-lost';});
  listen('webglcontextrestored',()=>{canvas.dataset.renderer='webgl';invalidate();});
  listen('pointerdown',e=>{
    if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===1){start={x:e.clientX,y:e.clientY};moved=false;}
    else{moved=true;oldPinch=pinch();}
  });
  listen('pointermove',e=>{
    const prev=points.get(e.pointerId);if(!prev)return;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size>1){
      const next=pinch();if(oldPinch>0&&next>0)nudgeCamera(0,0,oldPinch/next);
      oldPinch=next;
    }else{
      if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>4)moved=true;
      if(moved)nudgeCamera(-(e.clientX-prev.x)*.008,(e.clientY-prev.y)*.006);
    }
  });
  listen('pointerup',e=>{
    if(!points.has(e.pointerId))return;points.delete(e.pointerId);
    if(!moved&&points.size===0)pick(e);
  });
  listen('pointercancel',e=>{points.delete(e.pointerId);moved=true;});
  listen('wheel',e=>{e.preventDefault();nudgeCamera(0,0,Math.exp(clamp(e.deltaY*(e.deltaMode===1?16:1),-160,160)*.0018));},{passive:false});
  const observer=new ResizeObserver(invalidate);observer.observe(canvas);
  function dispose(){
    if(dead)return;dead=true;events.abort();observer.disconnect();cancelAnimationFrame(raf);
    release(scene);renderer?.dispose();renderer?.forceContextLoss();points.clear();
  }
  return {update,resetCamera,nudgeCamera,dispose};
}
