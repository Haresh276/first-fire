// Two illustrative outcomes on the same vertical fabric geometry. Progress is a normalized
// animation phase. Neither distances nor timing represent an FM² prediction.
(() => {
  'use strict';

  const WIRE_OFF = 0.3;
  const clamp = value => Math.max(0, Math.min(1, value));
  const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

  function gradient(ctx, x0, y0, x1, y1, stops) {
    const paint = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [position, color] of stops) paint.addColorStop(position, color);
    return paint;
  }

  function stroke(ctx, color, width, points) {
    ctx.beginPath();
    points.forEach(([x,y], index) => index ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function glow(ctx, x, y, rx, ry, stops) {
    if (rx < 0.1 || ry < 0.1) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const paint = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [position, color] of stops) paint.addColorStop(position, color);
    ctx.fillStyle = paint;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function rail(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(2,6,8,.65)';
    ctx.fillRect(x+1.8, y+2, w, h);
    ctx.fillStyle = gradient(ctx,x,0,x+w,0,[
      [0,'#263338'],[.23,'#92a2a3'],[.4,'#667777'],[.65,'#39484a'],[1,'#19252a']
    ]);
    ctx.fillRect(x,y,w,h);
  }

  // Generate a repeatable fine twill. Crossed highlights alternate the threads that sit above each other.
  function weave(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x,y,w,h);
    ctx.clip();
    ctx.fillStyle = gradient(ctx,x,0,x+w,0,[
      [0,'#142936'],[.14,'#263f52'],[.39,'#355369'],[.66,'#233d50'],[.86,'#294657'],[1,'#182f3e']
    ]);
    ctx.fillRect(x,y,w,h);
    const pitch = Math.max(2.5,w/9);
    const rows = Math.ceil(h/pitch);
    const cols = Math.ceil(w/pitch);
    for (let r=0;r<rows;r++) {
      const yy = y+r*pitch;
      for(let c=0;c<cols;c++) {
        const xx=x+c*pitch;
        const shade = .09 + .08*(1 + Math.sin(c*.81 + r*1.57));
        const highlight = 'rgba(165,198,208,' + shade.toFixed(3) + ')';
        if ((r+c)%3 < 2) {
          stroke(ctx,'rgba(2,10,19,.42)',pitch*.49,[[xx+.4,yy],[xx+.8,yy+pitch]]);
          stroke(ctx,highlight,pitch*.26,[[xx,yy+.2],[xx+.4,yy+pitch*.8]]);
        } else {
          stroke(ctx,'rgba(2,10,19,.45)',pitch*.55,[[xx,yy+1],[xx+pitch,yy+.9]]);
          stroke(ctx,highlight,pitch*.26,[[xx+.1,yy+1],[xx+pitch*.9,yy+.7]]);
        }
      }
    }
    ctx.restore();
  }

  function fastener(ctx, x, y, r) {
    ctx.fillStyle = '#0b1419';
    ctx.beginPath(); ctx.arc(x,y,r,0,2*Math.PI); ctx.fill();
    ctx.fillStyle = '#687574';
    ctx.beginPath(); ctx.arc(x-.25,y-.35,r*.7,0,2*Math.PI); ctx.fill();
    stroke(ctx,'#263334',.8,[[x-r*.44,y+r*.29],[x+r*.44,y-r*.29]]);
  }

  function chamber(ctx, left, paneWidth, h) {
    const center = left + paneWidth/2;
    const top = h*.115;
    const fabricHeight = h*.74;
    const bottom = top + fabricHeight;
    const w = Math.min(fabricHeight/10, paneWidth*.24);
    const side = w/2;
    const x = center-side;
    const gap = Math.max(3,w*.15);
    const mount = Math.max(2,w*.095);
    const plate = w*1.25;
    const beam = w*.23;
    const light = gradient(ctx,0,0,0,h,[[0,'#141d23'],[.53,'#102028'],[1,'#0b141b']]);
    ctx.fillStyle = light;
    ctx.fillRect(left,0,paneWidth,h);
    glow(ctx,center-w*.4,h*.4,paneWidth*.6,h*.84,[[0,'rgba(97,128,137,.24)'],[1,'rgba(97,128,137,0)']]);

    // Recessed inspection window and its edge screws.
    const rim = Math.min(12,paneWidth*.044);
    const edge = Math.max(7,paneWidth*.036);
    const paneTop = 8, paneBottom = h-8;
    ctx.strokeStyle = 'rgba(140,162,167,.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left+edge+.5,paneTop+.5,paneWidth-edge*2-1,paneBottom-paneTop-1);
    for (const xx of [left+edge+rim*.74,left+paneWidth-edge-rim*.74]) {
      for (const yy of [paneTop+rim*.72,paneBottom-rim*.72]) fastener(ctx,xx,yy,1.75);
    }

    // Side walls and quiet registration marks provide a fixed reference as the front moves.
    for(const sign of [-1,1]) {
      const xx = center + sign*Math.max(w*1.93,paneWidth*.22);
      stroke(ctx,'rgba(117,147,150,.15)',1,[[xx,top-3],[xx,bottom+5]]);
      for(let n=0;n<=20;n++){
        const yy=top+fabricHeight*n/20;
        const length=n%5===0 ? 7 : 3;
        stroke(ctx,n%5===0?'rgba(176,192,189,.42)':'rgba(126,151,150,.26)',1,[[xx,yy+.5],[xx-sign*length,yy+.5]]);
      }
    }

    // A cropped knit would imply a wider specimen; the entire 2:20 exposed strip stays in view.
    ctx.fillStyle = 'rgba(2,8,12,.5)';
    ctx.fillRect(x-w*.14,top-1,w*1.28,fabricHeight+5);
    weave(ctx,x,top,w,fabricHeight);
    rail(ctx,x-gap-mount,top-2,mount,fabricHeight+5);
    rail(ctx,x+w+gap,top-2,mount,fabricHeight+5);
    for(const yy of [top-beam+1,bottom]) {
      ctx.fillStyle = gradient(ctx,0,yy,0,yy+beam,[[0,'#95a4a3'],[.18,'#687a7d'],[.57,'#344247'],[1,'#20292e']]);
      ctx.fillRect(center-plate,yy,plate*2,beam);
      for(const sign of [-1,1]) fastener(ctx,center+sign*plate*.84,yy+beam*.5,Math.max(1.3,beam*.27));
    }
    return {center,top,bottom,w,height:fabricHeight};
  }

  function ignitionWire(ctx, rig, heat) {
    const {center:x,bottom:y,w}=rig;
    const lead = [ [x-1.48*w,y+.54*w],[x-1.12*w,y+.54*w],[x-.8*w,y+.12*w],[x-.52*w,y-.045*w] ];
    const other=lead.map(([px,py])=>[2*x-px,py]).reverse();
    stroke(ctx,'#78827e',2,lead);
    stroke(ctx,'#78827e',2,other);
    const coil=[];
    for(let i=0;i<=54;i++){
      const t=i/54;
      coil.push([x+w*(t-.5)*1.06,y-.045*w+Math.sin(t*Math.PI*16)*w*.037]);
    }
    stroke(ctx,'#121a1c',3.1,coil);
    stroke(ctx,'#8a9290',1.5,coil);
    if(heat>0){
      ctx.save();
      ctx.globalAlpha=heat;
      ctx.shadowColor='#ff752f'; ctx.shadowBlur=w*.29;
      stroke(ctx,'#ffb26b',2.2,coil);
      stroke(ctx,'#ffe5a6',.9,coil);
      ctx.restore();
    }
  }

  // Temperature and burnt area are deliberately not encoded on a quantitative scale.
  function charredFabric(ctx, rig, fraction) {
    if(fraction<=0) return;
    const {center:x,bottom:y,w,height:h} = rig;
    const end=y-fraction*h;
    ctx.save();
    ctx.beginPath(); ctx.rect(x-w/2,rig.top,w,h); ctx.clip();
    ctx.fillStyle=gradient(ctx,0,end-w*.12,0,end+w*.5,[
      [0,'rgba(60,37,26,0)'],[.23,'rgba(91,48,26,.69)'],[.65,'rgba(25,22,22,.88)'],[1,'rgba(12,17,19,.95)']
    ]);
    ctx.fillRect(x-w/2,end-w*.12,w,y-end+w*.12);
    const count=Math.floor(fraction*h/(w*.24));
    for(let j=1;j<=count;j++){
      const drift=Math.sin(j*2.59), yy=y-j*w*.24+w*.035*drift;
      const start=Math.sin(j*2.29)*.25-.24;
      stroke(ctx,'rgba(126,109,92,.25)',.65,[[x+w*start,yy],[x+w*(start+.18),yy+drift*w*.08],[x+w*(start+.34),yy-w*.04]]);
      if(j%3===1)stroke(ctx,'rgba(118,94,73,.22)',.65,[[x+w*.22,yy-w*.12],[x+w*.19,yy+w*.06],[x+w*.28,yy+w*.11]]);
    }
    ctx.restore();
  }

  function flame(ctx, rig, front, intensity, t) {
    if(intensity<.008) return;
    const {center:x,w}=rig;
    const sway=Math.sin(t*23)*.09 + Math.sin(t*37)*.055;
    const flicker=1+.09*Math.sin(t*53)+.055*Math.cos(t*43);
    const width=w*(.32+.76*intensity);
    const height=w*(.29+1.52*intensity)*flicker;
    const y=front+w*.09;
    glow(ctx,x,y-height*.35,width*1.8,height*1.34,[[0,'rgba(241,105,40,'+(.27*intensity)+')'],[.4,'rgba(232,90,16,'+(.12*intensity)+')'],[1,'rgba(224,83,16,0)']]);

    ctx.save();
    ctx.translate(x,y);
    ctx.scale(width,height);
    ctx.globalAlpha=Math.min(1,.2+intensity);
    // Connected translucent sheets curl above the leading edge.
    function sheet(shift, scale, angle, stops) {
      ctx.save(); ctx.translate(shift,0); ctx.scale(scale,scale);
      ctx.fillStyle=gradient(ctx,0,-1,0,.08,stops);
      ctx.beginPath(); ctx.moveTo(-.46,0);
      ctx.bezierCurveTo(-.58,-.25,-.12,-.48,angle-.13,-.72);
      ctx.bezierCurveTo(angle-.17,-.82,angle-.02,-.88,angle,-1);
      ctx.bezierCurveTo(angle-.02,-.79,angle+.24,-.65,.22,-.47);
      ctx.bezierCurveTo(.18,-.35,.35,-.38,.39,-.54);
      ctx.bezierCurveTo(.37,-.39,.57,-.23,.47,-.04);
      ctx.quadraticCurveTo(.14,.12,-.46,0); ctx.fill(); ctx.restore();
    }
    sheet(.02,1,sway+.06,[[0,'rgba(244,115,53,.05)'],[.3,'rgba(244,119,43,.56)'],[.73,'rgba(255,162,42,.89)'],[1,'rgba(249,85,22,.64)']]);
    sheet(-.115,.72,-sway-.16,[[0,'rgba(255,183,77,.15)'],[.49,'rgba(255,193,65,.85)'],[.80,'#ffe599'],[1,'rgba(255,133,49,.60)']]);
    glow(ctx,-.04,-.10,.45,.32,[[0,'rgba(255,244,171,.90)'],[.45,'rgba(255,194,64,.55)'],[1,'rgba(249,161,55,0)']]);
    glow(ctx,.04,-.005,.39,.08,[[0,'rgba(148,167,239,.55)'],[1,'rgba(83,145,236,0)']]);
    ctx.restore();
  }

  function mount(canvas) {
    const ctx=canvas.getContext('2d');
    if(!ctx) return {draw(){},destroy(){}};
    let progress=0, outcomes=[true,false], width=0, height=0, ratio=1, backdrop=null, rigs=[], disposed=false;
    function resize(){
      if(disposed)return;
      const rect=canvas.getBoundingClientRect();
      const w=Math.round(rect.width), h=Math.round(rect.height);
      const dpr=Math.min(2,window.devicePixelRatio || 1);
      if(w<=0 || h<=0 || (width===w && height===h && ratio===dpr))return;
      width=w; height=h; ratio=dpr;
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
      backdrop=canvas.ownerDocument.createElement('canvas');
      backdrop.width=canvas.width; backdrop.height=canvas.height;
      const base=backdrop.getContext('2d');
      base.scale(dpr,dpr);
      const half=w/2;
      rigs=[chamber(base,0,half,h),chamber(base,half,half,h)];
      stroke(base,'#344149',1,[[half,0],[half,h]]);
      draw(progress,outcomes);
    }
    function draw(value, selectedOutcomes=outcomes){
      progress=clamp(Number.isFinite(value)?value:0);
      outcomes=[Boolean(selectedOutcomes[0]),Boolean(selectedOutcomes[1])];
      if(disposed || !backdrop)return;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.drawImage(backdrop,0,0);
      ctx.setTransform(ratio,0,0,ratio,0,0);
      const ignition=ease(progress/.16);
      const sinceOff=clamp((progress-WIRE_OFF)/(1-WIRE_OFF));
      const heat=progress<WIRE_OFF ? ease(progress/.075) : 0;
      rigs.forEach((rig,index)=>{
        const fraction=outcomes[index] ? ignition*.036 + ease(sinceOff)*.61 : ignition*.036;
        const strength=outcomes[index] ? ignition*(.77+.14*ease(sinceOff)) : ignition*.77*(1-ease(sinceOff/.34));
        const front=rig.bottom-rig.height*fraction;
        charredFabric(ctx,rig,fraction);
        ignitionWire(ctx,rig,heat);
        flame(ctx,rig,front,strength,progress);
      });
    }
    resize();
    const observer=typeof ResizeObserver==='function' ? new ResizeObserver(resize) : null;
    if(observer) observer.observe(canvas); else window.addEventListener('resize',resize);
    function destroy(){
      disposed=true;
      observer?.disconnect();
      if(!observer)window.removeEventListener('resize',resize);
      backdrop=null; rigs=[];
    }
    return {draw,destroy};
  }

  window.FFSpreadScene={mount,wireOff:WIRE_OFF};
})();
