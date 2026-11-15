/* Projected front positions and flame lengths on supplied frames. Image coordinates are native video pixels. */
(() => {
  'use strict';
  function stats(cal,lengthMm,marks,pixelError=1){
    if(cal.length!==2||!Number.isFinite(lengthMm)||lengthMm<=0)throw Error('Set two scale points and a positive physical distance.');
    const dx=cal[1].x-cal[0].x,dy=cal[1].y-cal[0].y,norm=Math.hypot(dx,dy);
    if(norm<5)throw Error('The scale marks must be at least five source pixels apart.');
    if(!Number.isFinite(pixelError)||pixelError<0)throw Error('Enter a nonnegative point uncertainty.');
    const mmPerPixel=lengthMm/norm;
    const rows=[...marks].sort((a,b)=>a.t-b.t).map(p=>({...p,positionMm:((p.x-cal[0].x)*dx+(p.y-cal[0].y)*dy)/norm*mmPerPixel}));
    for(let i=1;i<rows.length;i++){const dt=rows[i].t-rows[i-1].t;if(dt<=1e-6)throw Error('Choose distinct frame times.');rows[i].intervalSpeedMmS=(rows[i].positionMm-rows[i-1].positionMm)/dt;rows[i].pointBoundMmS=2*pixelError*mmPerPixel/dt;}
    const t=rows.length?rows.reduce((a,r)=>a+r.t,0)/rows.length:0,y=rows.length?rows.reduce((a,r)=>a+r.positionMm,0)/rows.length:0;
    const ss=rows.reduce((a,r)=>a+(r.t-t)**2,0);
    const slope=ss>0?rows.reduce((a,r)=>a+(r.t-t)*(r.positionMm-y),0)/ss:null;
    const rms=slope===null?null:Math.sqrt(rows.reduce((s,r)=>s+(r.positionMm-(y+slope*(r.t-t)))**2,0)/rows.length);
    return {mmPerPixel,rows,slopeMmS:slope,residualRmsMm:rms};
  }
  if(typeof module!=='undefined')module.exports={stats};
  if(typeof window==='undefined')return;
  const e=(tag,t)=>{const n=document.createElement(tag);if(t!=null)n.textContent=t;return n;};
  function render(root){
    root.innerHTML='<header class="pagetitle"><h1>Measure a flame front</h1><p class="sub">Calibrate a known length in a fixed camera view, mark the same flame edge in successive frames, and measure its projected speed. You can also mark both ends of a flame to measure its projected length.</p></header><section class="panel stack"><div class="master-fields"><label class="field">Video from your device<input type="file" accept="video/*" id="track-file"></label><label class="field">Source or run ID<input id="track-source" maxlength="200" placeholder="Run and camera identifier"></label><label class="field">Scale mark separation (mm)<input id="track-scale" type="number" min=".001" value="20" step="any"></label><label class="field">Point uncertainty (pixels)<input id="track-error" type="number" min="0" value="1" step="any"></label></div><p>Mark the two scale points along the expected spread direction, then one front position per frame. A single scale applies to a stationary camera and a planar specimen. Speed is signed along the scale axis.</p><video id="track-video" controls playsinline hidden style="max-width:100%;width:100%;max-height:42vh"></video><canvas id="track-image" hidden tabindex="0" style="max-width:100%;width:100%;touch-action:manipulation" aria-label="Paused frame. Click a point, or enter pixel coordinates below."></canvas><div class="master-fields"><label class="field">Image X (pixels)<input type="number" min="0" id="track-x"></label><label class="field">Image Y (pixels)<input type="number" min="0" id="track-y"></label><label class="field">Frame time (s)<input type="number" id="track-time" min="0" step="any" value="0"></label></div><label class="field">After scale calibration<select id="track-kind"><option value="front">Track front position</option><option value="length">Measure projected flame length (two endpoints)</option></select></label><div class="actions"><button class="btn" id="track-add">Mark point</button><button class="ghost" id="track-undo">Undo last point</button><button class="ghost" id="track-save">Export measurements</button></div><p id="track-status" role="status"></p><div id="track-list" class="tablewrap"></div><div id="track-lengths" class="tablewrap"></div></section>';
    const $=s=>root.querySelector('#track-'+s),c=$('image'),v=$('video');let url='',cal=[],marks=[],segments=[],tip=null,history=[],file=null,latest=null;
    const num=id=>$(id).valueAsNumber,f=n=>Number(n.toFixed(3)),ctx=c.getContext('2d');
    function draw(){if(v.readyState<2||!v.videoWidth)return;c.hidden=false;c.width=v.videoWidth;c.height=v.videoHeight;ctx.drawImage(v,0,0,c.width,c.height);
      const radius=Math.max(3,c.width/180);for(const [arr,colour] of [[cal,'#29ffb2'],[marks,'#ffbd50']]){ctx.strokeStyle=colour;ctx.lineWidth=Math.max(2,c.width/400);for(const {x,y} of arr){ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();}}}
    function drawSegments(){
      if(!v.videoWidth)return;
      ctx.strokeStyle='#46d5ff';ctx.fillStyle='#46d5ff';ctx.lineWidth=Math.max(2,c.width/400);
      for(const segment of segments.filter(s=>Math.abs(s.t-v.currentTime)<.001)){ctx.beginPath();ctx.moveTo(segment.start.x,segment.start.y);ctx.lineTo(segment.end.x,segment.end.y);ctx.stroke();}
      if(tip&&Math.abs(tip.t-v.currentTime)<.001){ctx.beginPath();ctx.arc(tip.x,tip.y,Math.max(3,c.width/180),0,2*Math.PI);ctx.fill();}
    }
    function lengths(){return segments.map(s=>({...s,lengthMm:Math.hypot(s.end.x-s.start.x,s.end.y-s.start.y)*latest.mmPerPixel,clickBoundMm:2*num('error')*latest.mmPerPixel}));}
    function refresh(){draw();drawSegments();$('undo').disabled=!history.length&&!tip;latest=null;$('list').replaceChildren();$('lengths').replaceChildren();
      if(cal.length<2){$('status').textContent=file?'Select scale mark '+(cal.length+1)+' of 2.':'Select a video to begin.';$('save').disabled=true;return;}
      try{latest=stats(cal,num('scale'),marks,num('error'));$('status').textContent='Scale '+f(latest.mmPerPixel)+' mm/pixel. '+(latest.slopeMmS===null?'Mark the front at two or more times.':'Fitted speed '+f(latest.slopeMmS)+' mm/s · RMS position residual '+f(latest.residualRmsMm)+' mm.');$('save').disabled=latest.rows.length<2&&!segments.length;
        if($('kind').value==='length')$('status').textContent=tip?'Mark the other visible flame endpoint in this frame.':'Mark the two visible ends of the flame in one paused frame.';}
      catch(err){$('status').textContent=err.message;$('save').disabled=true;return;}
      const table=e('table'),h=table.createTHead().insertRow();for(const t of ['Time (s)','Position (mm)','Interval speed (mm/s)','Point-error bound (± mm/s)'])h.append(e('th',t));const b=table.createTBody();for(const r of latest.rows){const tr=b.insertRow();for(const x of [r.t,r.positionMm,r.intervalSpeedMmS,r.pointBoundMmS])tr.insertCell().textContent=x==null?'—':f(x);}if(latest.rows.length)$('list').append(table);
      if(segments.length){const sizes=e('table'),head=sizes.createTHead().insertRow();for(const t of ['Time (s)','Projected flame length (mm)','Two-click bound (± mm)'])head.append(e('th',t));const body=sizes.createTBody();for(const s of lengths()){const tr=body.insertRow();for(const n of [s.t,s.lengthMm,s.clickBoundMm])tr.insertCell().textContent=f(n);} $('lengths').append(sizes);}
    }
    $('file').onchange=()=>{if(url)URL.revokeObjectURL(url);file=$('file').files[0];cal=[];marks=[];segments=[];tip=null;history=[];v.pause();c.hidden=true;v.hidden=!file;if(file){url=URL.createObjectURL(file);v.src=url;}else v.removeAttribute('src');refresh();};
    v.onloadeddata=()=>{v.pause();$('time').max=v.duration;refresh();};v.onseeked=()=>{if(tip&&Math.abs(tip.t-v.currentTime)>.001)tip=null;$('time').value=v.currentTime;refresh();};v.onpause=()=>{$('time').value=v.currentTime;draw();};v.onerror=()=>{$('status').textContent='This browser could not decode the video. Choose a supported local file.';};$('time').onchange=()=>{if(v.readyState&&Number.isFinite(num('time'))){v.pause();v.currentTime=Math.max(0,Math.min(v.duration,num('time')));}};
    function add(x,y){if(v.readyState<2 || v.seeking || !v.paused){$('status').textContent='Pause the decoded video on the desired frame before marking.';return;}if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=v.videoWidth||y>=v.videoHeight){$('status').textContent='Choose a point inside the frame.';return;}
      const mark={x,y,t:v.currentTime};
      if(cal.length===1 && Math.hypot(cal[0].x-x,cal[0].y-y)<5){$('status').textContent='Place the second scale mark at least five pixels away.';return;}
      if(cal.length===2&&$('kind').value==='length'){
        if(!tip||Math.abs(tip.t-mark.t)>.001){tip=mark;refresh();return;}
        if(segments.some(s=>Math.abs(s.t-mark.t)<.001)){$('status').textContent='This frame already has a measured flame length. Undo it or seek to a new frame.';tip=null;return;}
        if(Math.hypot(tip.x-x,tip.y-y)<1){$('status').textContent='Choose a distinct endpoint.';return;}
        segments.push({t:mark.t,start:tip,end:mark});history.push('length');tip=null;refresh();return;
      }
      if(cal.length===2 && marks.some(p=>Math.abs(p.t-mark.t)<1e-6)){$('status').textContent='Seek to a different time, or undo that frame’s previous mark.';return;}
      history.push(cal.length<2?'scale':'front');(cal.length<2?cal:marks).push(mark);refresh();}
    c.onclick=ev=>{const rect=c.getBoundingClientRect();add((ev.clientX-rect.left)*c.width/rect.width,(ev.clientY-rect.top)*c.height/rect.height);};$('add').onclick=()=>add(num('x'),num('y'));$('undo').onclick=()=>{if(tip)tip=null;else{const group=history.pop();if(group==='length')segments.pop();if(group==='scale')cal.pop();if(group==='front')marks.pop();}refresh();};
    $('kind').onchange=()=>{tip=null;refresh();};
    $('scale').oninput=$('error').oninput=refresh;
    $('save').onclick=()=>{if(!latest||!file)return;const d={schema:'first-fire.front.v1',source:$('source').value,width:v.videoWidth,height:v.videoHeight,durationSeconds:v.duration,calibration:cal,knownMm:num('scale'),clickErrorPx:num('error'),projectedFlameLengths:lengths(),...latest,limits:'2D projection in the scale plane. The interval bound covers two clicks only, excluding scale error, perspective and timing uncertainty.'};const u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const a=e('a');a.href=u;a.download='first-fire-front-measurements.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};refresh();return ()=>{v.pause();if(url)URL.revokeObjectURL(url);};
  }
  window.FFFrontTracking={render,stats};
})();
