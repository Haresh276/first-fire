import {heightAt} from './traverse.mjs';

function context(canvas) {
  const {width, height} = canvas.getBoundingClientRect();
  if (width < 2 || height < 2) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) {
    canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr);
  }
  const ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  return {ctx,width,height};
}
function line(ctx,points,color,width,dashes=[]) {
  if (!points.length) return;
  ctx.strokeStyle=color; ctx.lineWidth=width; ctx.setLineDash(dashes); ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.stroke(); ctx.setLineDash([]);
}
function visiblePoints(track) {
  const every=Math.max(1,Math.ceil(track.length/500));
  return track.filter((p,i)=>i%every===0 || i===track.length-1);
}

export function drawMap(canvas,waypoints,track,pose,terrain) {
  const frame=context(canvas);
  if (!frame) return null;
  const {ctx,width:w,height:h}=frame;
  const trail=visiblePoints(track);
  const positions=[{xM:0,zM:0},...waypoints,...trail,pose];
  const xs=positions.map(p=>p.xM), zs=positions.map(p=>p.zM);
  const lowX=Math.min(...xs),highX=Math.max(...xs),lowZ=Math.min(...zs),highZ=Math.max(...zs);
  const cx=(lowX+highX)/2,cz=(lowZ+highZ)/2;
  const scale=Math.min((w-74)/Math.max(26,highX-lowX),(h-58)/Math.max(22,highZ-lowZ));
  const xy=p=>[(p.xM-cx)*scale+w/2,h/2-(p.zM-cz)*scale];
  const unproject=(x,y)=>({xM:Math.round((cx+(x-w/2)/scale)*10)/10,zM:Math.round((cz-(y-h/2)/scale)*10)/10});
  const step=32;
  for(let py=0;py<h;py+=step)for(let px=0;px<w;px+=step) {
    const p=unproject(px+step/2,py+step/2);
    const shade=terrain==='flat'?0:Math.round(8*Math.tanh(heightAt(p.xM,p.zM,terrain)/4));
    ctx.fillStyle='rgb('+(226+shade)+','+(232+shade)+','+(224+shade)+')';
    ctx.fillRect(px,py,step+1,step+1);
  }
  const grid=10**Math.floor(Math.log10(65/scale));
  const spacing=grid*(65/scale/grid>4?5:65/scale/grid>1.5?2:1);
  const lo=unproject(0,h),hi=unproject(w,0);
  for(let x=Math.ceil(lo.xM/spacing)*spacing;x<=hi.xM;x+=spacing){
    const dx=xy({xM:x,zM:0})[0];line(ctx,[[dx,0],[dx,h]],'#c6d1c8',1);
  }
  for(let z=Math.ceil(lo.zM/spacing)*spacing;z<=hi.zM;z+=spacing){
    const dy=xy({xM:0,zM:z})[1];line(ctx,[[0,dy],[w,dy]],'#c6d1c8',1);
  }
  const route=[{xM:0,zM:0},...waypoints];
  line(ctx,route.map(xy),'#64796b',2,[4,4]);line(ctx,trail.map(xy),'#c95729',2.5);
  for(let i=0;i<waypoints.length;i++){
    const [x,y]=xy(waypoints[i]);ctx.fillStyle='#f6faf3';ctx.strokeStyle='#375b49';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(x,y,6,0,2*Math.PI);ctx.fill();ctx.stroke();ctx.font='10px monospace';
    ctx.fillStyle='#263e31';ctx.fillText(String(i+1),x+8,y-5);
  }
  const [x,y]=xy(pose);ctx.save();ctx.translate(x,y);ctx.rotate(pose.headingRad);ctx.fillStyle='#c7461d';
  ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle='#2c4a3f';ctx.font='11px monospace';ctx.fillText('+Z ↑',10,17);
  const bar=Math.min(w/4,spacing*scale);line(ctx,[[12,h-12],[12+bar,h-12]],'#3c5445',2);
  ctx.fillText((bar/scale).toLocaleString('en',{maximumFractionDigits:1})+' m',12,h-18);
  return unproject;
}

export function drawProfile(canvas,track) {
  const frame=context(canvas);
  if(!frame)return;
  const {ctx,width:w,height:h}=frame;
  const points=visiblePoints(track);
  const heights=points.map(p=>p.yM);
  const lo=Math.floor(Math.min(0,...heights)),hi=Math.ceil(Math.max(1,...heights));
  const distance=Math.max(1,points.at(-1)?.distanceM??0);
  const x=d=>44+(w-60)*d/distance;
  const y=e=>h-26-(h-44)*(e-lo)/(hi-lo);
  ctx.fillStyle='#456052';ctx.font='11px monospace';
  for(let n=0;n<=2;n++){
    const elevation=lo+(hi-lo)*n/2;
    line(ctx,[[42,y(elevation)],[w-10,y(elevation)]],'#d7ddd3',1);
    ctx.fillText(elevation.toFixed(1),4,y(elevation)+3);
  }
  ctx.fillText('0 m',40,h-6);ctx.fillText(distance.toFixed(1)+' m',Math.max(64,w-62),h-6);
  if(points.length>1)line(ctx,points.map(p=>[x(p.distanceM),y(p.yM)]),'#bd5024',2.5);
}
