// Canvas fallback uses the same camera, component meshes, world transforms and ray picking.
import * as T from './vendor/three.module.min.js';
import {heightAt} from '../traverse.mjs';
import {worlds} from './landscape.mjs';

const light=new T.Vector3(-.5,.8,.48).normalize();
const worldLight=new T.Vector3(),normalMatrix=new T.Matrix3(),mvp=new T.Matrix4();
const v=new T.Vector3(),rgb=new T.Color();
function numberColor(value){return '#'+value.toString(16).padStart(6,'0');}
export function software(canvas){
  const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true});
  if(!ctx)throw Error('Neither WebGL nor a 2D canvas is available.');
  function render(root,camera,s,pose,view){
    const w=canvas.width,h=canvas.height,world=s.conditions.world,terrain=view.terrain??'flat';
    const style=worlds[world],night=s.conditions.phase==='night',orbit=world==='Orbit';
    const background=ctx.createLinearGradient(0,0,0,h);
    background.addColorStop(0,numberColor(night?0x121b29:style.high));
    background.addColorStop(1,numberColor(night?0x4a515c:style.low));
    ctx.fillStyle=background;ctx.fillRect(0,0,w,h);
    function project(x,y,z){
      v.set(x,y,z).project(camera);return [(v.x+1)*w/2,(1-v.y)*h/2,v.z];
    }
    const {xM=0,zM=0}=pose;
    if(!orbit){
      // Draw actual terrain elevations from back to front, anchored to world coordinates.
      const polys=[],grid=5,xc=Math.round(xM/grid)*grid,zc=Math.round(zM/grid)*grid;
      for(let i=-12;i<12;i++)for(let j=-12;j<12;j++){
        const x=xc+i*grid,z=zc+j*grid;
        const pts=[[x,z],[x+grid,z],[x+grid,z+grid],[x,z+grid]].map(([a,b])=>project(a,heightAt(a,b,terrain)-.013,b));
        if(pts.some(p=>p[2]<-1||p[2]>=1))continue;
        const shade=.66+.07*Math.sin(x*.41+z*.21)+.068*Math.cos(x*.5-z*.12);
        rgb.setHex(style.ground).multiplyScalar(night?shade*.46:shade);
        polys.push([pts,pts.reduce((acc,p)=>acc+p[2],0),'#'+rgb.getHexString()]);
      }
      polys.sort((a,b)=>b[1]-a[1]);
      for(const [pts,,paint] of polys){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))ctx.lineTo(p[0],p[1]);ctx.closePath();ctx.fillStyle=ctx.strokeStyle=paint;ctx.fill();ctx.stroke();}
      const p=project(xM,pose.heightM??pose.yM??0,zM);ctx.fillStyle='rgba(10,15,20,.18)';ctx.beginPath();ctx.ellipse(p[0],p[1],w*.13,h*.047,0,0,Math.PI*2);ctx.fill();
    }else{
      ctx.fillStyle='#435e74';ctx.beginPath();ctx.ellipse(w*.15,h*1.34,w*.8,h*.77,0,0,Math.PI*2);ctx.fill();
    }
    // A Z buffer keeps intersecting panels, transparent tracer and tyre treads in depth order.
    const pixels=ctx.getImageData(0,0,w,h),rgba=new Uint32Array(pixels.data.buffer),depth=new Float32Array(w*h);
    depth.fill(Infinity);
    const overlays=[],glyphs=[];
    function triangle(x1,y1,z1,x2,y2,z2,x3,y3,z3,col,alpha,annotation=false){
      const minX=Math.max(0,Math.floor(Math.min(x1,x2,x3))),maxX=Math.min(w-1,Math.ceil(Math.max(x1,x2,x3)));
      const minY=Math.max(0,Math.floor(Math.min(y1,y2,y3))),maxY=Math.min(h-1,Math.ceil(Math.max(y1,y2,y3)));
      const area=(x2-x1)*(y3-y1)-(y2-y1)*(x3-x1);
      if(Math.abs(area)<.14)return;
      const inv=1/area, dax=(y2-y3)*inv, dbx=(y3-y1)*inv, day=(x3-x2)*inv,dby=(x1-x3)*inv;
      const baseA=((y2-y3)*(minX+.5-x3)+(x3-x2)*(minY+.5-y3))*inv;
      const baseB=((y3-y1)*(minX+.5-x3)+(x1-x3)*(minY+.5-y3))*inv;
      for(let yy=minY;yy<=maxY;yy++){
        let a=baseA+(yy-minY)*day,b=baseB+(yy-minY)*dby,offset=yy*w+minX;
        for(let xx=minX;xx<=maxX;xx++,offset++,a+=dax,b+=dbx){
          if(a<0||b<0||a+b>1)continue;
          const zz=z3+a*(z1-z3)+b*(z2-z3);
          if(!annotation && zz>=depth[offset])continue;
          if(alpha>=.999){rgba[offset]=col;if(!annotation)depth[offset]=zz;}
          else{
            const old=rgba[offset],one=1-alpha;
            const red=(old&255)*one+(col&255)*alpha;
            const green=((old>>>8)&255)*one+((col>>>8)&255)*alpha;
            const blue=((old>>>16)&255)*one+((col>>>16)&255)*alpha;
            rgba[offset]=0xff000000|(blue<<16)|(green<<8)|red;
          }
        }
      }
    }
    root.traverseVisible(mesh=>{
      if(!mesh.isMesh || mesh.material.opacity===0 || mesh.userData.decal)return;
      const attr=mesh.geometry.attributes, index=mesh.geometry.index?.array;
      const pos=attr.position.array,norm=attr.normal.array,count=pos.length/3;
      mvp.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);mvp.premultiply(camera.projectionMatrix);
      const coords=new Float32Array(count*3),m=mvp.elements;
      for(let i=0;i<pos.length;i+=3){
        const x=pos[i],y=pos[i+1],z=pos[i+2],inv=1/(m[3]*x+m[7]*y+m[11]*z+m[15]);
        coords[i]=((m[0]*x+m[4]*y+m[8]*z+m[12])*inv+1)*w/2;
        coords[i+1]=(1-(m[1]*x+m[5]*y+m[9]*z+m[13])*inv)*h/2;
        coords[i+2]=(m[2]*x+m[6]*y+m[10]*z+m[14])*inv;
      }
      normalMatrix.getNormalMatrix(mesh.matrixWorld).transpose();
      worldLight.copy(light).applyMatrix3(normalMatrix).normalize();
      const n=index?index.length:count;
      const glyphOrder=mesh.userData.glyphOrder;
      const colors=Array.from({length:12},(_,i)=>{
        rgb.copy(mesh.material.color).multiplyScalar(glyphOrder?1:(night?.41:.55)+i*(night?.057:.084));const hex=rgb.getHex();
        return 0xff000000|((hex&255)<<16)|(hex&0xff00)|(hex>>>16);
      });
      for(let i=0;i<n;i+=3){
        const a=3*(index?index[i]:i),b=3*(index?index[i+1]:i+1),c=3*(index?index[i+2]:i+2);
        const x1=coords[a],y1=coords[a+1],x2=coords[b],y2=coords[b+1],x3=coords[c],y3=coords[c+1];
        const area=(x2-x1)*(y3-y1)-(y2-y1)*(x3-x1);
        if(area>-.13||Math.min(coords[a+2],coords[b+2],coords[c+2])<=-1||Math.max(coords[a+2],coords[b+2],coords[c+2])>=1)continue;
        const dot=Math.max(0,Math.min(1,norm[a]*worldLight.x+norm[a+1]*worldLight.y+norm[a+2]*worldLight.z));
        const paint=colors[Math.round(dot*11)],alpha=mesh.material.opacity;
        if(glyphOrder)glyphs.push({order:glyphOrder,args:[x1,y1,coords[a+2],x2,y2,coords[b+2],x3,y3,coords[c+2],paint,alpha,true]});
        else if(alpha>=.999)triangle(x1,y1,coords[a+2],x2,y2,coords[b+2],x3,y3,coords[c+2],paint,alpha);
        else overlays.push([x1,y1,coords[a+2],x2,y2,coords[b+2],x3,y3,coords[c+2],paint,alpha]);
      }
    });
    overlays.sort((a,b)=>b[2]+b[5]+b[8]-a[2]-a[5]-a[8]);
    for(const f of overlays)triangle(...f);
    glyphs.sort((a,b)=>a.order-b.order);
    for(const {args} of glyphs)triangle(...args);
    ctx.putImageData(pixels,0,0);
  }
  return {render};
}
