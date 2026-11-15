// Reuse the workbench's local crew cabin. Only the cabin shell, floor and
// interior are drawn. The coloured pieces are schematic sample locations.
import * as T from './rover-workbench/prototype/scene/vendor/three.module.min.js';
import {buildHardware, displayDimensions} from './rover-workbench/prototype/scene/hardware.mjs';

export function mountCabin(canvas, pins, getRows, onPick) {
  const renderer = new T.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(34,1,0.1,50);
  const parts={cabin:'mobile-hab'};
  const rig=buildHardware(parts,displayDimensions(4));
  rig.update({}, {mode:'cutaway'}, {parts});
  scene.add(rig.root,new T.HemisphereLight(0xfff5df,0x889ba0,2.4));
  const lamp=new T.DirectionalLight(0xfaf1db,2.2);
  lamp.position.set(4,7,5);scene.add(lamp);
  const cutouts = [
    [[-.35,1.65,.80],[.65,.05,.26]],  // display cover, forward console
    [[-.57,1.63,-.69],[.48,.10,.18]], // tape on the stowage bundle
    [[.58,1.55,-.68],[.46,.40,.42]],  // equipment enclosure
    [[.39,1.85,.18],[.40,.15,.10]],   // illustrated fastener on the seat back
  ];
  const locations=cutouts.map(([pos,size],index)=>{
    const m=new T.MeshStandardMaterial({roughness:.56,metalness:.12});
    const mesh=new T.Mesh(new T.BoxGeometry(...size),m);
    mesh.position.set(...pos);mesh.userData.index=index;
    scene.add(mesh);return mesh;
  });
  let azimuth=.68,elevation=.94;
  function draw() {
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h)return;
    renderer.setPixelRatio(Math.min(1.6,window.devicePixelRatio||1));
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    const radius=5.12*Math.max(1,1.15/camera.aspect);
    camera.position.set(Math.sin(azimuth)*Math.cos(elevation)*radius,
      1.39+Math.sin(elevation)*radius, Math.cos(azimuth)*Math.cos(elevation)*radius);
    camera.lookAt(0,1.39,0);camera.updateMatrixWorld();
    const rows=getRows();
    locations.forEach((mesh,i)=>{
      const valid=rows[i].burns;
      const color=valid===null ? 0x9eaaaf :valid ? 0xff9c57 : 0x91d5b9;
      mesh.material.color.setHex(color);
      mesh.material.emissive.setHex(color).multiplyScalar(.24);
      const pos=mesh.position.clone().project(camera);
      pins[i].style.left=((pos.x+1)/2*100)+'%';
      pins[i].style.top=((1-pos.y)/2*100)+'%';
    });
    renderer.render(scene,camera);
  }
  const ray=new T.Raycaster();
  let anchor;
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    anchor={x:e.clientX,y:e.clientY,angle:azimuth,tilt:elevation,moved:false};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!anchor)return;
    const dx=e.clientX-anchor.x,dy=e.clientY-anchor.y;
    if(Math.abs(dx)+Math.abs(dy)>5)anchor.moved=true;
    if(anchor.moved){
      azimuth=anchor.angle-dx*.008;
      elevation=Math.max(.45,Math.min(1.36,anchor.tilt+dy*.006));
      draw();
    }
  });
  canvas.addEventListener('pointerup',e=>{
    if(anchor&&!anchor.moved){
      const b=canvas.getBoundingClientRect();
      ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,
                        1-(e.clientY-b.top)/b.height*2),camera);
      const hit=ray.intersectObjects(locations)[0];if(hit)onPick(hit.object.userData.index);
    }
    anchor=null;
  });
  canvas.addEventListener('pointercancel',()=>{anchor=null;});
  const obs=new ResizeObserver(draw);obs.observe(canvas);draw();
  return draw;
}
