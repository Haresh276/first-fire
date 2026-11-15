import * as T from './vendor/three.module.min.js';

const palette={gravity:0x66c5ff,power:0xffc54e,thermal:0xff854e,access:0x67e4d9,ventilation:0x87ee95,suppression:0xebadff};
const yAxis=new T.Vector3(0,1,0),zAxis=new T.Vector3(0,0,1);
const sunTravel=new T.Vector3(7,-10,-6).normalize();
const down=new T.Vector3(0,-1,0);

// All glyphs have fixed design lengths. The enabled state and direction follow the
// engineering result; neither the lengths nor the circle areas encode a quantity.
export function engineeringOverlay(root,slots,parts,dimensions) {
  const group=new T.Group();group.userData.nonPick=true;root.add(group);
  const ink=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,depthTest:false,depthWrite:false});
  const outline=new T.MeshBasicMaterial({color:0x28383e,toneMapped:false,depthTest:false,depthWrite:false});
  function shape(parent,geometry,material,order){
    const mesh=new T.Mesh(geometry,material);
    mesh.renderOrder=order;mesh.userData.glyphOrder=order;parent.add(mesh);return mesh;
  }
  function arrow(){
    const glyph=new T.Group();group.add(glyph);
    // Thin dark borders keep the same marker legible against metal, sky and terrain.
    const stem=shape(glyph,new T.CylinderGeometry(.026,.026,.60,10),outline,30);
    const stemFace=shape(glyph,new T.CylinderGeometry(.018,.018,.58,10),ink,31);
    stem.position.y=stemFace.position.y=.30;
    const tip=shape(glyph,new T.ConeGeometry(.096,.23,14),outline,32);
    const tipFace=shape(glyph,new T.ConeGeometry(.080,.20,14),ink,33);
    tip.position.y=.69;tipFace.position.y=.694;
    return glyph;
  }
  function halo(){
    const g=new T.Group();group.add(g);
    shape(g,new T.TorusGeometry(.19,.028,8,32),outline,32);
    shape(g,new T.TorusGeometry(.19,.016,7,32),ink,33);
    return g;
  }
  const arrows=[arrow(),arrow()],rings=[halo(),halo()];
  const pos=new T.Vector3(),direction=new T.Vector3(),inverse=new T.Quaternion();
  function at(slot,x,y,z){
    const component=slots[slot];component.updateMatrix();
    return pos.set(x,y,z).applyMatrix4(component.matrix);
  }
  function paintArrow(i,point,dir,tipAtAnchor=false) {
    const g=arrows[i];g.visible=true;g.position.copy(point);
    if(tipAtAnchor)g.position.addScaledVector(dir,-.81);
    g.quaternion.setFromUnitVectors(yAxis,dir);
  }
  function paintRing(i,point,normal,size=1){
    const g=rings[i];g.visible=true;g.position.copy(point);g.scale.setScalar(size);
    g.quaternion.setFromUnitVectors(zAxis,normal);
  }
  function update(s,view) {
    const kind=view.overlay, data=view.overlayData;
    group.visible=false;
    for(const g of [...arrows,...rings])g.visible=false;
    if(!data||!Object.hasOwn(palette,kind))return false;
    ink.color.setHex(palette[kind]);inverse.copy(root.quaternion).invert();
    if(kind==='gravity' && data.hasGround && data.gravityMs2>0){
      direction.copy(down).applyQuaternion(inverse);
      const foot=pos.set(1.47*dimensions.width,.06,.96*dimensions.length);
      paintArrow(0,foot,direction,true);paintRing(0,foot,direction,.63);
    }else if(kind==='power' && parts.power==='solar-pack' && data.solarW>0){
      direction.copy(sunTravel).applyQuaternion(inverse);
      const roof=parts.cabin==='open-deck'?1.93:parts.cabin==='research-pod'?2.34:2.57;
      for(let i=0;i<2;i++)paintArrow(i,at('power',(i?1:-1)*.60,roof+.29,-.55),direction,true);
    }else if(kind==='thermal' && Number.isFinite(data.netThermalW) && data.netThermalW!==0){
      const outward=data.netThermalW>0;direction.set(outward?-1:1,0,0);
      for(let i=0;i<2;i++)paintArrow(i,at('thermal',-1.12,1.80,i?-.58:.10),direction,!outward);
    }else if(kind==='access' && data.hasCabin && data.accessLossMol>0){
      direction.set(0,0,-1);
      const dual=parts.access==='suitport';
      for(let i=0;i<(dual?2:1);i++)paintArrow(i,at('access',dual?(i?.36:-.36):0,1.79,dual?-1.43:parts.cabin==='research-pod'?-1.17:-1.45),direction);
    }else if(kind==='ventilation' && data.hasCabin && data.tracerFlowLs>0){
      // The schematic duct runs from its aft end A to forward end B; exchange
      // between the well-mixed tracer zones is represented separately by their opacity.
      const fromA=(['end A','end B'].includes(data.fanDirection)?data.fanDirection:s.conditions.fanFrom)==='end A';
      direction.set(0,0,fromA?1:-1);
      const center=at('material',.61,1.81,-.29);
      center.addScaledVector(direction,-.405);paintArrow(0,center,direction);
    }else if(kind==='suppression' && parts.suppression==='mist' && data.deliveredKg>0){
      const tank=at('suppression',-.63,1.71,-.71);
      paintRing(0,tank,yAxis,1.2);paintRing(1,tank,zAxis,1.2);
    }else return false;
    group.visible=true;return true;
  }
  return {update};
}
