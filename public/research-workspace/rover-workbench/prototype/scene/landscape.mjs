import * as T from './vendor/three.module.min.js';
import {heightAt} from '../traverse.mjs';

export const worlds={
  Moon:{ground:0x928f88,rock:0x84817a,high:0x101722,low:0x343c47,haze:0x918f88,sun:0xffefcb,hemi:0xd3e6ff},
  Mars:{ground:0xb37a59,rock:0x8e614c,high:0x927063,low:0xedbd91,haze:0xc59e81,sun:0xffe1ba,hemi:0xffdec3},
  Earth:{ground:0x7f8970,rock:0x7e8077,high:0x547fa1,low:0xd3dfdd,haze:0xb3c8c3,sun:0xffedce,hemi:0xd8ecff},
  Orbit:{ground:0x94918b,rock:0x79756e,high:0x080d19,low:0x172437,haze:0x172437,sun:0xfff2ce,hemi:0xd8e7ff}
};
function generator(seed) {
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function noiseTexture(){
  const size=384, canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),random=generator(3921);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(size*y+x)*4;
    const v=Math.min(255,185+random()*44+11*Math.sin(x*2*Math.PI/size*5+.6*Math.sin(y*2*Math.PI/size*4))+7*Math.cos((x+y)*2*Math.PI/size*16));
    image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  for(let i=0;i<1300;i++){
    const x=random()*size,y=random()*size,r=.3+random()**3*2.2;
    ctx.fillStyle='rgba(40,38,34,0.29)';ctx.beginPath();ctx.ellipse(x,y,r*1.5,r,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(244,243,237,0.47)';ctx.fillRect(x-r*.4,y-r*.8,r,.7);
  }
  const tex=new T.CanvasTexture(canvas);
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
function makeSky(){
  const uniforms={
    top:{value:new T.Color()},horizon:{value:new T.Color()},starPower:{value:0}
  };
  const mat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,
    vertexShader:'varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`
      varying vec3 dir;uniform vec3 top;uniform vec3 horizon;uniform float starPower;
      float hash(vec3 p){return fract(sin(dot(p,vec3(17.11,37.77,111.53)))*43758.5453);}
      void main(){vec3 n=normalize(dir);float h=clamp(n.y,0.,1.);
        vec3 color=mix(horizon,top,pow(h,.37));
        vec3 grid=n*245.;float star=hash(floor(grid));
        if(star>.996){float pin=max(0.,1.-length(fract(grid)-.5)*2.6);
          color+=vec3(.55,.68,.84)*pin*starPower;}
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  });
  const sky=new T.Mesh(new T.SphereGeometry(440,22,14),mat);sky.renderOrder=-100;return sky;
}
function groundMesh(tex){
  const material=new T.MeshStandardMaterial({map:tex,roughness:.96,metalness:.01,vertexColors:true});
  const geo=new T.PlaneGeometry(130,130,70,70);geo.rotateX(-Math.PI/2);
  const count=geo.attributes.position.count;geo.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(count*3),3));
  const mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;return mesh;
}
function ridges(world,terrain,x,z) {
  const settings=worlds[world],geo=new T.BufferGeometry(),vertices=[],colors=[];
  const random=generator(5093),n=160,rows=9;
  const floor=heightAt(x,z,terrain);
  const rings=[];
  for(let j=0;j<=rows;j++){
    const t=j/rows,ring=[];
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2, distance=53+t*125;
      const peak=Math.max(0,Math.sin(3*a+.3)+.53*Math.sin(9*a)+.26*Math.cos(16*a))*.52;
      const relief=((1.8+13*peak)*Math.sin(Math.PI*t)**1.5+t*.8)*(world==='Earth'?.9:1);
      const xx=Math.sin(a)*distance,zz=Math.cos(a)*distance;
      ring.push([xx,floor+relief+random()*.40*t+heightAt(x+xx,z+zz,terrain)-floor-.8,zz]);
    }
    rings.push(ring);
  }
  const indices=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<n;i++){
    vertices.push(...rings[j][i]);
    const v=.82+.075*Math.sin(i*.32)+.06*Math.sin(j+i);
    colors.push(v,v,v);
    if(j===rows)continue;
    const k=(i+1)%n,a=j*n+i,b=j*n+k,c=a+n,d=b+n;
    indices.push(a,c,b,b,c,d);
  }
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:settings.rock,flatShading:false,vertexColors:true,side:T.DoubleSide,roughness:1}));
  mesh.position.set(x,0,z);return mesh;
}
function orbitalLimb(){
  // A procedural planetary limb provides a depth reference during orbital free fall.
  const planet=new T.Mesh(new T.SphereGeometry(86,56,30),new T.ShaderMaterial({
    vertexShader:'varying vec3 n;void main(){n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 n; void main(){vec3 v=normalize(n);
      float cloud=sin(v.x*27.+sin(v.y*21.))*cos(v.z*30.-v.x*9.)+.42*sin(v.x*72.+v.z*48.);
      float land=sin(v.x*11.+v.y*14.)+.8*cos(v.z*18.-v.y*10.);
      vec3 ocean=mix(vec3(.018,.061,.125),vec3(.111,.225,.172),smoothstep(.32,.50,land));
      vec3 c=mix(ocean,vec3(.58,.65,.65),smoothstep(.33,.84,cloud))*(.12+.95*max(0.,dot(v,normalize(vec3(-.35,.98,.12)))));
      gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`
  }));
  return planet;
}
export function landscape(scene){
  const sky=makeSky(),tex=noiseTexture(),ground=groundMesh(tex),planet=orbitalLimb();
  scene.add(sky,ground,planet);
  const fill=new T.HemisphereLight(0xfff4dd,0x69716e,1.8),sun=new T.DirectionalLight(0xffe8c3,3.4);
  scene.add(fill,sun,sun.target);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:45});
  sun.shadow.normalBias=.018;sun.shadow.bias=-.0003;
  const rockGeo=new T.IcosahedronGeometry(1,0),rockMat=new T.MeshStandardMaterial({flatShading:true,roughness:1});
  const rocks=new T.InstancedMesh(rockGeo,rockMat,135);rocks.receiveShadow=true;scene.add(rocks);
  let mountains=null,key='';
  // Soft local ambient occlusion supplements the sun shadow beneath the frame.
  const mask=document.createElement('canvas');mask.width=mask.height=64;
  const ctx=mask.getContext('2d'),grad=ctx.createRadialGradient(32,32,5,32,32,32);
  grad.addColorStop(0,'rgba(0,0,0,.44)');grad.addColorStop(.55,'rgba(0,0,0,.23)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const stamp=new T.Mesh(new T.PlaneGeometry(3.7,4.7),new T.MeshBasicMaterial({map:new T.CanvasTexture(mask),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  const shadowRig=new T.Group();stamp.rotation.x=-Math.PI/2;shadowRig.add(stamp);scene.add(shadowRig);
  function update(world,phase,terrain,pose,camera,dimensions) {
    const p=worlds[world]||worlds.Moon,night=phase==='night',orbit=world==='Orbit';
    const x=pose.xM||0,z=pose.zM||0,y=pose.heightM??pose.yM??0;
    const tile=12,cx=Math.round(x/tile)*tile,cz=Math.round(z/tile)*tile;
    // Do not invent surface obstacles or mountain silhouettes on surveyed terrain.
    const showRocks=!orbit && terrain!=='lola';
    ground.visible=!orbit;rocks.visible=showRocks;planet.visible=orbit;shadowRig.visible=!orbit;
    const next=[world,phase,terrain,cx,cz].join('|');
    if(next!==key){
      key=next;sky.material.uniforms.top.value.setHex(night?0x080d19:p.high);sky.material.uniforms.horizon.value.setHex(night?0x252c39:p.low);
      sky.material.uniforms.starPower.value=night||orbit?1:0;
      fill.color.setHex(night?0xa2bbdc:p.hemi);fill.groundColor.setHex(night?0x515a64:0x8e8880);fill.intensity=night?1.02:1.7;
      sun.color.setHex(night?0xb6cce5:p.sun);sun.intensity=night?1.10:3.5;
      scene.fog=new T.FogExp2(night?0x313946:p.haze,orbit?0:.0052);
      ground.material.color.setHex(night?0x70757b:p.ground);ground.position.set(cx,0,cz);
      const g=ground.geometry,a=g.attributes.position,uv=g.attributes.uv,cols=g.attributes.color;
      if(!orbit){
        for(let i=0;i<a.count;i++){
          const wx=cx+a.getX(i),wz=cz+a.getZ(i);
          a.setY(i,heightAt(wx,wz,terrain));uv.setXY(i,wx/3.3,wz/3.3);
          const v=.88+.065*Math.sin(.45*wx+.32*Math.cos(wz))+.035*Math.cos(wx*.85+wz*.7);
          cols.setXYZ(i,v,v,v);
        }
        a.needsUpdate=uv.needsUpdate=cols.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
      }
      if(mountains){scene.remove(mountains);mountains.geometry.dispose();mountains.material.dispose();mountains=null;}
      if(showRocks){
        mountains=ridges(world,terrain,cx,cz);scene.add(mountains);
        const matrix=new T.Object3D(),random=generator(1227+cx*139+cz*317);
        for(let i=0;i<rocks.count;i++){
          const rx=cx+(random()-.5)*51, rz=cz+(random()-.5)*51, radius=.04+.21*random()**2;
          matrix.position.set(rx,heightAt(rx,rz,terrain)+radius*.18,rz);matrix.rotation.set(random()*2,random()*6,random());
          matrix.scale.set(radius*(.8+random()),radius*.57,radius);matrix.updateMatrix();rocks.setMatrixAt(i,matrix.matrix);
        }
        rocks.instanceMatrix.needsUpdate=true;rocks.computeBoundingSphere();rockMat.color.setHex(p.rock);
      }
    }
    sky.position.copy(camera.position);
    planet.position.set(x-49,y-78,z-64);
    sun.position.set(x-7,y+10,z+6);sun.target.position.set(x,y+.6,z);
    shadowRig.scale.set(dimensions.width*dimensions.scale,dimensions.scale,dimensions.length*dimensions.scale);
    shadowRig.position.set(x,y+.025,z);shadowRig.rotation.set(-(pose.pitchRad||0),pose.headingRad||0,pose.rollRad||0,'YXZ');
  }
  return {update};
}
