/* Mark the same feature in two sampled source frames, in native image coordinates. */
(() => {
  'use strict';

  const finite = Number.isFinite;
  const present = value => typeof value === 'string' && value.trim().length > 0;
  const positive = value => finite(value) && value > 0;
  const hashPattern = /^[a-f0-9]{64}$/i;
  const validSource = link => typeof link === 'string' && /^https:\/\//i.test(link);
  const framePath = path => typeof path === 'string' && /^flight-frames\/[\w /.+%-]+$/i.test(path)
    && !/(?:^|\/)\.\.?(?:\/|$)|%2e|%2f|%5c/i.test(path);
  const number = value => new Intl.NumberFormat('en', {maximumFractionDigits: 3}).format(value);

  function evidence(metadata) {
    return metadata?.status === 'verified' && validSource(metadata.source) && present(metadata.locator);
  }

  function checkSequence(data) {
    if (!Array.isArray(data?.frames) || data.frames.length < 2) throw Error('At least two published camera frames are required.');
    const ids = new Set();
    for (const frame of data.frames) {
      if (!present(frame.id) || ids.has(frame.id) || !framePath(frame.file) || !hashPattern.test(frame.sha256 || '')) {
        throw Error('The frame manifest has a missing or duplicate ID, unsafe file path or missing SHA-256.');
      }
      ids.add(frame.id);
    }
  }

  function checkPoint(point, image) {
    if (!Number.isInteger(image?.width) || !Number.isInteger(image?.height) || image.width < 1 || image.height < 1) {
      throw Error('Wait for the native image to decode.');
    }
    if (!Number.isInteger(point?.x) || !Number.isInteger(point?.y) || point.x < 0 || point.x >= image.width ||
        point.y < 0 || point.y >= image.height) throw Error('Choose whole pixel coordinates inside the native image.');
  }

  function measure(data, index, points, images) {
    checkSequence(data);
    if (!Number.isInteger(index) || index < 0 || index >= data.frames.length - 1) throw Error('Choose a neighboring frame pair.');
    const frames = data.frames.slice(index, index + 2);
    frames.forEach((f, i) => {
      checkPoint(points[i], images[i]);
      if (f.id !== images[i].id) throw Error('A mark belongs to another frame.');
      if (images[i].computedSha256 && images[i].computedSha256.toLowerCase() !== f.sha256.toLowerCase()) {
        throw Error('The source frame checksum differs from its manifest.');
      }
    });
    if (images[0].width !== images[1].width || images[0].height !== images[1].height) {
      throw Error('The native image dimensions differ. Choose a matched camera pair.');
    }
    for (const key of ['camera', 'cameraId', 'run', 'sample', 'registration']) {
      if (frames.some(f => f[key] != null) && frames[0][key] !== frames[1][key]) {
        throw Error('The selected frames differ in ' + key + '.');
      }
    }
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const distance = Math.hypot(dx, dy);
    const {clock, calibration: scale} = data;
    const [first, second] = frames.map(f => f.timeSeconds);
    const dt = evidence(clock) && finite(first) && finite(second) && second > first ? second - first : null;
    const ratio = positive(scale?.mmPerPixel) ? scale.mmPerPixel : positive(scale?.pixelsPerMm) ? 1 / scale.pixelsPerMm : null;
    const roi = scale?.regionPx;
    const inRegion = !roi || points.every(p => p.x >= roi.xMin && p.x <= roi.xMax && p.y >= roi.yMin && p.y <= roi.yMax);
    const calibrated = evidence(scale) && ratio !== null && inRegion;
    return {
      schema: 'first-fire.paired-camera-marks.v1', title: data.title, run: data.run, source: data.source,
      axes: 'Native pixel centers. Origin at upper left, x increases to the right and y downward.',
      feature: 'Operator-selected feature in a fixed camera view. Displacement is a two-dimensional projection.',
      frames: frames.map((frame, i) => ({...frame, widthPx: images[i].width, heightPx: images[i].height,
        markPx: {...points[i]}, computedSha256: images[i].computedSha256 || null,
        verification: images[i].computedSha256 ? 'decoded bytes match manifest SHA-256' : 'manifest SHA-256 only'})),
      pixels: {dx, dy, distance}, seconds: dt, pixelsPerSecond: dt === null ? null : distance / dt,
      millimetres: calibrated ? {dx: dx * ratio, dy: dy * ratio, distance: distance * ratio} : null,
      millimetresPerSecond: calibrated && dt !== null ? distance * ratio / dt : null,
      clock: clock || null, clockNote: data.clockNote || null,
      timingReason: dt !== null ? clock.locator : clock?.reason || data.clockNote || 'A verified increasing camera time interval is unavailable.',
      calibration: scale || null, scaleReason: calibrated ? scale.locator : !inRegion ? 'Marks outside the calibrated region.'
        : scale?.reason || 'An attributable native-image scale is unavailable.'
    };
  }

  function bandContour(imageData, example) {
    const {width,height,data}=imageData,[x0,x1]=example.nativeX,[y0,y1]=example.nativeY;
    const half=(example.boxcarWidthPx-1)/2;
    if (![x0,x1,y0,y1,half].every(Number.isInteger) || half<0 || x0<half || x1+half>=width ||
        y0<0 || y1>=height || y1<y0 || x1<x0 || data.length!==width*height*4 ||
        example.fractionOfFramePeak<=0 || example.fractionOfFramePeak>1) throw Error('Contour window outside the decoded image.');
    const profile=new Float64Array(x1-x0+2*half+1);
    for(let y=y0;y<=y1;y++) {
      for(let x=x0-half,i=0;x<=x1+half;x++,i++) {
        const offset=4*(y*width+x);profile[i]+=data[offset]-data[offset+2];
      }
    }
    const smoothed=new Float64Array(x1-x0+1);
    for(let i=0;i<smoothed.length;i++) {
      for(let j=0;j<example.boxcarWidthPx;j++)smoothed[i]+=profile[i+j];
    }
    // All sums share a common divisor; the fraction-of-peak crossing is invariant to it.
    const peak=Math.max(...smoothed);
    if(!(peak>0))throw Error('No positive red-minus-blue peak in the selected band.');
    for(let i=smoothed.length-1;i>=0;i--)if(smoothed[i]>=peak*example.fractionOfFramePeak)return i+x0;
    throw Error('The selected images contain no contour crossing.');
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {measure, checkSequence, checkPoint, framePath, bandContour};
  if (typeof window === 'undefined') return;

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    return node;
  }
  function button(label, cls = '') {
    const node = el('button', cls, label); node.type = 'button'; return node;
  }
  function sourceLink(url, label) {
    if (!validSource(url)) return document.createTextNode(label);
    const a = el('a', '', label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  }

  const styles = `
  .flight-frames{display:grid;gap:1.15rem;min-width:0}
  .flight-frames h2,.flight-frames h3,.flight-frames p,.flight-frames figure{margin:0}
  .flight-frames h2{font-size:clamp(1.65rem,3.1vw,2.55rem);line-height:1.08}
  .flight-frames .ff-head,.flight-frames .ff-foot{display:grid;gap:.45rem}
  .flight-frames .ff-head p,.flight-frames .ff-muted,.flight-frames .ff-caption{color:#4a5a55;line-height:1.5}
  .flight-frames .ff-toolbar,.flight-frames .ff-actions,.flight-frames .ff-measures{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap}
  .flight-frames .ff-toolbar{border-block:1px solid #d3d8d0;padding:.55rem 0;justify-content:space-between}
  .flight-frames .ff-toolbar label{display:flex;align-items:center;gap:.55rem;font-weight:650}
  .flight-frames select,.flight-frames input,.flight-frames button{font:inherit}
  .flight-frames select,.flight-frames input{min-width:0;border:1px solid #adb6af;border-radius:5px;padding:.4rem .55rem;background:#fff;color:#1c302b}
  .flight-frames button:not(.ff-photo){border:1px solid #a8b1a9;border-radius:5px;font-weight:650;color:#223530;background:#fffdf8;padding:.4rem .7rem;cursor:pointer}
  .flight-frames button:not(.ff-photo):hover:enabled{background:#e9eee8}.flight-frames button:disabled{opacity:.48;cursor:default}
  .flight-frames :focus-visible{outline:3px solid #136e99;outline-offset:3px}
  .flight-frames .ff-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(.7rem,2vw,1.4rem)}
  .flight-frames .ff-card{min-width:0;display:grid;align-content:start;gap:.45rem}
  .flight-frames .ff-cardhead{display:flex;justify-content:space-between;align-items:baseline;gap:.35rem;flex-wrap:wrap}
  .flight-frames .ff-cardhead h3{font-size:1.15rem;font-family:inherit}.flight-frames .ff-caption{font-size:.86rem;overflow-wrap:anywhere}
  .flight-frames .ff-photo{position:relative;display:block;width:100%;margin:0;padding:0;min-height:6rem;overflow:hidden;
    border:0;border-radius:6px;background:#11191c;cursor:crosshair;touch-action:manipulation}
  .flight-frames .ff-photo:disabled{opacity:1}.flight-frames .ff-photo img{display:block;width:100%;height:auto;margin:0}
  .flight-frames .ff-photo canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .flight-frames .ff-entry{display:flex;align-items:flex-end;gap:.45rem;flex-wrap:wrap;margin-top:.35rem}
  .flight-frames .ff-entry label{display:grid;gap:.16rem;font-size:.83rem;color:#40554c}.flight-frames .ff-entry input{width:6.4rem;font-variant-numeric:tabular-nums}
  .flight-frames .ff-detail{display:grid;grid-template-columns:78px 1fr;gap:.65rem;align-items:center;color:#44544b;font-size:.84rem}
  .flight-frames .ff-detail canvas{width:78px;height:78px;border:1px solid #9ca8a1;border-radius:4px;image-rendering:pixelated}
  .flight-frames .ff-detail[hidden]{display:none}
  .flight-frames .ff-worked p{margin:.45rem 0;overflow-wrap:anywhere}.flight-frames .ff-offline{display:grid;gap:.3rem;margin-top:.65rem}.flight-frames .ff-chart{display:block;width:100%;max-width:38rem;height:157px;background:#fafcf7;margin:.6rem 0}.flight-frames .ff-results{display:grid;gap:.6rem;background:#eef2ec;border-left:3px solid #356757;padding:.85rem 1rem;border-radius:3px}
  .flight-frames .ff-measures{align-items:stretch;gap:.65rem 1.4rem}.flight-frames .ff-metric{display:grid;gap:.1rem}
  .flight-frames .ff-metric span{color:#45564f;font-size:.81rem}.flight-frames .ff-metric strong{font-variant-numeric:tabular-nums;font-size:1.1rem}
  .flight-frames .ff-note{font-size:.91rem;line-height:1.4}.flight-frames .ff-foot details p{margin:.45rem 0;overflow-wrap:anywhere}
  .flight-frames .ff-foot summary{font-weight:650;cursor:pointer}.flight-frames .ff-foot button{justify-self:start}
  @media(max-width:700px){.flight-frames .ff-pair{grid-template-columns:minmax(0,1fr)}.flight-frames .ff-card+.ff-card{padding-top:.7rem;border-top:1px solid #d3d8d0}}
  `;

  async function readFrame(frame, suppliedFile = null) {
    const decoded = new Image();
    let url = frame.file;
    let computed = null;
    try {
      // On file:// browsers can display local images but generally block fetch on sibling files.
      if (suppliedFile || location.protocol !== 'file:') {
        let blob=suppliedFile;
        if(!blob) {
          const response = await fetch(frame.file, {credentials:'same-origin'});
          if (!response.ok) throw Error('The source file returned HTTP ' + response.status + '.');
          blob = await response.blob();
        }
        if(suppliedFile && !window.crypto?.subtle) throw Error('This browser does not expose SHA-256 for local files.');
        if(frame.bytes && blob.size !== frame.bytes) throw Error('The image byte count differs from the source manifest.');
        if (window.crypto?.subtle) {
          const bytes = new Uint8Array(await window.crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
          computed = Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
          if (computed !== frame.sha256.toLowerCase()) throw Error('The image checksum differs from the source manifest.');
        }
        url = URL.createObjectURL(blob);
      }
      decoded.src = url;
      await decoded.decode();
      if (frame.width && (frame.width !== decoded.naturalWidth || frame.height !== decoded.naturalHeight)) {
        throw Error('Decoded dimensions differ from the published frame metadata.');
      }
      return {id:frame.id, width:decoded.naturalWidth, height:decoded.naturalHeight, computedSha256:computed, decoded, url};
    } catch (error) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      throw Error(error.name === 'EncodingError' ? 'This browser could not decode this source frame.' : error.message);
    }
  }

  function overlay(canvas, viewer, current, prior, label) {
    const rect = viewer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr,dpr);
    const xy = p => [(p.x + .5) * rect.width / current.image.width, (p.y + .5) * rect.height / current.image.height];
    if (!current.point) return;
    const [x,y] = xy(current.point);
    if (prior?.point && prior.image?.width === current.image.width && prior.image?.height === current.image.height) {
      const [x0,y0] = xy(prior.point);
      ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x,y);ctx.lineWidth=3;ctx.strokeStyle='#162223';ctx.stroke();
      ctx.setLineDash([5,4]);ctx.lineWidth=2;ctx.strokeStyle='#ffe4a8';ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(x0,y0,5,0,Math.PI*2);ctx.stroke();
    }
    const color = label === 'A' ? '#ffd887' : '#8feae0';
    ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.strokeStyle='#122326';ctx.lineWidth=4;ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle=color;ctx.fillRect(x-1,y-1,2,2);
    const left = Math.min(Math.max(x + 10,0),rect.width - 17), top = Math.min(Math.max(y - 14,0),rect.height - 16);
    ctx.fillStyle='#142525';ctx.fillRect(left,top,16,16);ctx.font='bold 12px sans-serif';ctx.fillStyle=color;ctx.fillText(label,left+3,top+12);
  }

  function magnify(canvas, image, point) {
    const ctx = canvas.getContext('2d'), w = 78, factor = 3;
    canvas.width = w; canvas.height = w; ctx.fillStyle='#141b1c';ctx.fillRect(0,0,w,w);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image.decoded, w/2-(point.x+.5)*factor, w/2-(point.y+.5)*factor, image.width*factor,image.height*factor);
    ctx.strokeStyle='#8ce5df';ctx.lineWidth=1;ctx.strokeRect(w/2-factor/2,w/2-factor/2,factor,factor);
  }

  function workedChart(data, decodedFrame) {
    const example = data.workedExample;
    if (!example || !evidence(data.clock) || !Array.isArray(example.contourXPx) ||
        example.contourXPx.length !== data.frames.length || !example.contourXPx.every(finite) ||
        !data.frames.every(f => finite(f.timeSeconds))) return null;
    const details = el('details'), title=el('summary','','Show worked measurement · luminous contour');
    const xs = data.frames.map(f=>f.timeSeconds), ys = example.contourXPx;
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.floor(Math.min(...ys)/10)*10,y1=Math.ceil(Math.max(...ys)/10)*10;
    if (x1<=x0 || y1<=y0) return null;
    const chart=el('canvas','ff-chart');
    chart.setAttribute('role','img');chart.setAttribute('aria-label','Band-averaged horizontal contour position versus time. All five positions follow in text.');
    const values=el('p','ff-caption',xs.map((s,i)=>data.frames[i].id+' | '+number(s)+' s | x = '+number(ys[i])+' px').join(' · '));
    details.append(title,el('p','',`+${number(example.displacementPx)} px over ${number(example.seconds)} s = ${example.endpointRatePxPerS.toFixed(2)} px/s. This horizontal rate follows a brightness contour averaged across a band of rows.`),
      chart,values,el('p','ff-caption',`Image band x = ${example.nativeX.join('–')} px, y = ${example.nativeY.join('–')} px. The ${example.channel} profile is smoothed over ${example.boxcarWidthPx} pixels and sampled at ${example.fractionOfFramePeak*100}% of that frame’s peak.`),
      el('p','ff-caption',example.limits));
    const reproduction=el('p','ff-caption');reproduction.setAttribute('role','status');
    details.append(reproduction);
    let replaying=false;
    async function reproduce() {
      if(replaying || !details.open)return;
      replaying=true;reproduction.textContent='Checking the contour against the source image pixels…';
      try {
        const actual=[];
        for(const f of data.frames){
          const image=await decodedFrame(f);
          const c=el('canvas');c.width=image.width;c.height=image.height;
          const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image.decoded,0,0);
          actual.push(bandContour(ctx.getImageData(0,0,c.width,c.height),example));c.width=0;c.height=0;
        }
        const delta=actual.at(-1)-actual[0];
        const agreement=actual.every((x,i)=>x===ys[i]);
        reproduction.textContent=`Browser pixel replay: x = ${actual.join(', ')} px. Endpoint rate ${(delta/(x1-x0)).toFixed(2)} px/s. `+
          (agreement?'All five positions match the archived calculation.':'The browser-decoded pixels give different crossings from the archived calculation.');
      } catch(error) {
        reproduction.textContent='Showing the archived calculation. This browser could not replay the original pixels. '+
          (error.name==='SecurityError'?'The local-file browser policy blocked canvas pixel access.':error.message);
        replaying=false;
      }
    }
    function drawGraph() {
      if(!details.open || !chart.clientWidth) return;
      const w=chart.clientWidth,h=157,dpr=Math.min(window.devicePixelRatio||1,2);
      chart.width=w*dpr;chart.height=h*dpr;
      const ctx=chart.getContext('2d');ctx.scale(dpr,dpr);
      const px=x=>43+(x-x0)/(x1-x0)*(w-66),py=y=>h-32-(y-y0)/(y1-y0)*(h-60);
      ctx.font='12px sans-serif';ctx.fillStyle='#394e45';ctx.fillText('Horizontal position (px)',8,14);
      for (const y of [y0,(y0+y1)/2,y1]) {
        ctx.fillStyle='#43594f';ctx.fillText(number(y),6,py(y)+4);ctx.strokeStyle='#d5ded6';
        ctx.beginPath();ctx.moveTo(43,py(y));ctx.lineTo(w-23,py(y));ctx.stroke();
      }
      ctx.beginPath();xs.forEach((x,i)=>i?ctx.lineTo(px(x),py(ys[i])):ctx.moveTo(px(x),py(ys[i])));
      ctx.strokeStyle='#0b6b61';ctx.lineWidth=2;ctx.stroke();
      xs.forEach((x,i)=>{ctx.beginPath();ctx.arc(px(x),py(ys[i]),3.7,0,2*Math.PI);ctx.fillStyle='#a9451d';ctx.fill();});
      ctx.fillStyle='#43594f';ctx.fillText(number(x0)+' s',px(x0)-4,h-12);ctx.textAlign='right';ctx.fillText(number(x1)+' s',px(x1)+4,h-12);
    }
    details.ontoggle=()=>{drawGraph();reproduce();};
    return {details,drawGraph,reproduce};
  }

  function render(root) {
    const data = window.FFSaffireFrames;
    const section = el('section','panel flight-frames');
    section.setAttribute('aria-label','NASA flight camera measurements');
    root.append(section);
    try { checkSequence(data); }
    catch (error) { section.append(el('h2','','Flight camera frames'),el('p','',error.message)); return () => section.remove(); }
    section.append(el('style','',styles));
    const header = el('header','ff-head');
    header.append(el('h2','', data.title || 'Saffire flight camera frames'),
      el('p','','Mark the same visible feature on both frames. Click a point, or enter its native pixel coordinates. The dashed line on frame B shows its apparent displacement.'));
    const nav = el('div','ff-toolbar'), label = el('label','','Frame pair'), select = el('select');
    for (let i=0;i<data.frames.length-1;i++) select.add(new Option(`${i+1} and ${i+2} of ${data.frames.length}`,String(i)));
    label.append(select);
    const levels = el('label','','Display brightness'), brightness=el('select');
    for(const [factor,name] of [[1,'Original'],[3,'3×'],[6,'6×']]) brightness.add(new Option(name,String(factor)));
    brightness.value='3';levels.append(brightness);
    const navActions = el('div','ff-actions'), prev = button('← Previous'), next = button('Next →');
    navActions.append(prev,next);nav.append(label,levels,navActions);
    const pair = el('div','ff-pair'), result = el('section','ff-results');
    result.setAttribute('aria-label','Measured displacement');
    const notice = el('p','ff-note');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    const metrics = el('div','ff-measures');
    result.append(notice,metrics);
    const foot = el('div','ff-foot'), support = el('details'), summary = el('summary','','Source, timing and scale');
    const source = data.source || {};
    support.append(summary);
    if (data.run && typeof data.run === 'string') support.append(el('p','',data.run));
    const sourceInfo = el('p');
    sourceInfo.append(sourceLink(typeof source === 'string' ? source : source.url || source.landingPage || source.downloadUrl,
      (typeof source === 'object' && (source.title || source.label)) || 'NASA source record'));
    support.append(sourceInfo);
    const timing = el('p','',data.clockNote || data.clock?.reason || 'Timing is reported for pairs with a verified camera clock.');
    if (validSource(data.clock?.source)) timing.append(' ',sourceLink(data.clock.source, data.clock.locator || 'Clock source'));
    const scale = el('p','',data.calibration?.reason || 'An attributable physical scale is unavailable.');
    if (validSource(data.calibration?.source)) scale.append(' ',sourceLink(data.calibration.source,data.calibration.locator || 'Calibration source'));
    support.append(timing,scale,el('p','ff-caption','Pixel coordinates begin at the upper left. Positive x runs right and positive y runs down. Motion toward the camera and changes in brightness can shift an apparent edge.'));
    if(framePath(data.calibration?.file)) {
      const target=el('a','','View the camera calibration target');target.href=data.calibration.file;target.target='_blank';target.rel='noopener';
      support.append(target);
    }
    const save = button('Download measurement');save.disabled = true;
    const worked=workedChart(data,readyFrame);
    foot.append(save,support);
    section.append(header);
    if(worked){worked.details.classList.add('ff-worked');section.append(worked.details);}
    section.append(nav,pair,result,foot);

    const marks = new Map(), cache = new Map();
    let active = 0, generation = 0, disposed = false, views = [], latest = null;
    let resize = null;
    if(location.protocol==='file:'){
      const label=el('label','ff-offline','Verify original JPEGs from this device');
      const picker=el('input');picker.type='file';picker.accept='image/jpeg';picker.multiple=true;
      const note=el('p','ff-caption','Local browsers can display the bundled images. Select their original JPEGs to check the bytes and replay the contour offline.');
      note.setAttribute('role','status');label.append(picker);support.append(label,note);
      picker.onchange=async()=>{
        const chosen=Array.from(picker.files||[]),newFrames=new Map();
        if(!chosen.length)return;
        picker.disabled=true;
        try{
          for(const file of chosen){
            const f=data.frames.find(item=>item.file.split('/').at(-1)===file.name);
            if(!f || newFrames.has(f.id))throw Error('Choose unique mapped images belonging to this flight sequence.');
            newFrames.set(f.id,await readFrame(f,file));
          }
          if(disposed)return;
          for(const [id,img] of newFrames){
            const old=cache.get(id);
            cache.set(id,Promise.resolve(img));
            old?.then(prior=>{if(prior.url.startsWith('blob:'))URL.revokeObjectURL(prior.url);}).catch(()=>{});
          }
          note.textContent=`Verified ${newFrames.size} local original image${newFrames.size===1?'':'s'} against the NASA source manifest.`;
          newFrames.clear();draw(active);
          if(worked?.details.open)worked.reproduce();
        }catch(error){note.textContent=error.message;}
        finally{
          for(const img of newFrames.values())URL.revokeObjectURL(img.url);
          picker.disabled=false;picker.value='';
        }
      };
    }
    function readyFrame(f) {
      if (!cache.has(f.id)) {
        const promise = readFrame(f);
        cache.set(f.id,promise);
        promise.catch(() => cache.delete(f.id));
      }
      return cache.get(f.id);
    }
    function card(index, label) {
      const frame = data.frames[index];
      const node = el('article','ff-card'), head = el('header','ff-cardhead');
      head.append(el('h3','', `Frame ${label} · ${index+1} of ${data.frames.length}`));
      if (evidence(data.clock) && finite(frame.timeSeconds)) head.append(el('span','ff-caption',number(frame.timeSeconds)+' s from reference'));
      const photo = button('','ff-photo');
      photo.disabled = true;
      photo.setAttribute('aria-label',`Mark a feature in frame ${label}. Arrow keys move one pixel. Hold Shift to move ten.`);
      const canvas = el('canvas');canvas.setAttribute('aria-hidden','true');
      const file = el('p','ff-caption');
      const original = el('a','','Open source frame');original.href=frame.file;original.target='_blank';original.rel='noopener';
      file.append(document.createTextNode(frame.id+' · '),original);
      if(framePath(frame.clockEvidence?.file)){
        const clockFile=el('a','','Clock annotation');clockFile.href=frame.clockEvidence.file;clockFile.target='_blank';clockFile.rel='noopener';
        file.append(' · ',clockFile);
      }
      const message=el('p','ff-caption','Loading source frame…');message.setAttribute('role','status');
      const inputs = el('form','ff-entry');
      const axes=['X','Y'].map(axis => {
        const l=el('label','',axis+' (px)'), input=el('input');input.type='number';input.step='1';input.min='0';input.required=true;
        input.setAttribute('aria-label',`Frame ${label} ${axis} in pixels`);input.disabled=true;l.append(input);inputs.append(l);return input;
      });
      const set = button('Set point');set.type='submit';set.disabled=true;
      const clear = button('Clear point');clear.disabled=true;
      inputs.append(set,clear);
      const detail=el('div','ff-detail'), loupe=el('canvas'), loupeText=el('p');
      loupe.setAttribute('aria-hidden','true');detail.hidden=true;detail.append(loupe,loupeText);
      node.append(head,photo,file,message,inputs,detail);pair.append(node);
      const v = {frame, label, node, photo,canvas,axes,set,clear,message,loupe,loupeText,detail, image:null, point:marks.get(frame.id), error:null};
      function place(x,y) {
        try {
          checkPoint({x,y},v.image);
          v.point={x,y};marks.set(frame.id,v.point);
          axes[0].value=x;axes[1].value=y;refresh();
        } catch (error) { message.textContent=error.message; }
      }
      photo.onclick=event=>{
        if (!v.image) return;
        if (event.detail===0) {
          if (!v.point) place(Math.floor(v.image.width/2),Math.floor(v.image.height/2));
          return;
        }
        const rect=photo.getBoundingClientRect();
        place(Math.min(v.image.width-1,Math.floor((event.clientX-rect.left)/rect.width*v.image.width)),
          Math.min(v.image.height-1,Math.floor((event.clientY-rect.top)/rect.height*v.image.height)));
      };
      photo.onkeydown=event=>{
        if (!v.image || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const p=v.point || {x:Math.floor(v.image.width/2),y:Math.floor(v.image.height/2)};
        const stride=event.shiftKey ? 10 : 1;
        const dx=event.key==='ArrowLeft' ? -stride : event.key==='ArrowRight' ? stride : 0;
        const dy=event.key==='ArrowUp' ? -stride : event.key==='ArrowDown' ? stride : 0;
        place(Math.max(0,Math.min(v.image.width-1,p.x+dx)),Math.max(0,Math.min(v.image.height-1,p.y+dy)));
      };
      inputs.onsubmit=event=>{event.preventDefault();place(axes[0].valueAsNumber,axes[1].valueAsNumber);};
      clear.onclick=()=>{marks.delete(frame.id);v.point=null;axes.forEach(a=>{a.value='';});refresh();};
      return v;
    }

    function refresh() {
      if (disposed) return;
      latest=null;metrics.replaceChildren();save.disabled=true;
      for (const [i,v] of views.entries()) {
        if (!v.image) continue;
        v.photo.querySelector('img').style.filter='brightness('+brightness.value+')';
        v.loupe.style.filter='brightness('+brightness.value+')';v.clear.disabled=!v.point;
        overlay(v.canvas,v.photo,v,i===1?views[0]:null,v.label);
        const integrity=v.image.computedSha256 ? 'SHA-256 verified' : 'SHA-256 from manifest';
        v.message.textContent=`${v.image.width} × ${v.image.height} native pixels · ${integrity}`;
        v.detail.hidden=!v.point;
        if (v.point) {
          magnify(v.loupe,v.image,v.point);
          v.loupeText.textContent=`3× native detail at (${v.point.x}, ${v.point.y}). Focus the image and use the arrow keys to refine this mark.`;
        }
      }
      if (views.some(v=>v.error)) { notice.textContent='A frame could not be verified or decoded. Select a different pair or try this pair again.';return; }
      if (!views.every(v=>v.image)) {notice.textContent='Reading the two source frames…';return;}
      const missing=views.filter(v=>!v.point).map(v=>v.label);
      if (missing.length) {notice.textContent='Place a point on frame '+missing.join(' and ')+' to measure displacement.';return;}
      try {latest=measure(data,active,views.map(v=>v.point),views.map(v=>v.image));}
      catch(error){notice.textContent=error.message;return;}
      latest.displayBrightnessFactor=Number(brightness.value);
      const sign=v=>(v>0?'+':'')+number(v), p=latest.pixels;
      const items=[['Projected displacement',number(p.distance)+' px'],['Horizontal Δx',sign(p.dx)+' px'],
        ['Vertical Δy',sign(p.dy)+' px']];
      if (latest.seconds!==null) items.push(['Frame interval',number(latest.seconds)+' s'],['Apparent speed',number(latest.pixelsPerSecond)+' px/s']);
      if (latest.millimetres) items.push(['Projected distance',number(latest.millimetres.distance)+' mm']);
      if (latest.millimetresPerSecond!==null) items.push(['Projected speed',number(latest.millimetresPerSecond)+' mm/s']);
      for (const [name,value] of items) {
        const stat=el('div','ff-metric');stat.append(el('span','',name),el('strong','',value));metrics.append(stat);
      }
      const limitations=[];
      if (!latest.millimetres) limitations.push('Physical distance unavailable. '+latest.scaleReason);
      if (latest.seconds===null) limitations.push('Time interval unavailable. '+latest.timingReason);
      notice.textContent=limitations.join(' ') || 'Both marks lie in the calibrated image region.';
      save.disabled=false;
    }

    function draw(choice) {
      const token=++generation;
      active=Number(choice);select.value=String(active);prev.disabled=active===0;next.disabled=active===data.frames.length-2;
      resize?.disconnect();pair.replaceChildren();
      views=[card(active,'A'),card(active+1,'B')];refresh();
      if (typeof ResizeObserver==='function') {
        resize=new ResizeObserver(()=>{
          if(token===generation&&!disposed) worked?.drawGraph();
          if(token===generation&&!disposed) views.forEach((v,i)=>{if(v.image)overlay(v.canvas,v.photo,v,i===1?views[0]:null,v.label);});
        });
        views.forEach(v=>resize.observe(v.photo));
      }
      views.forEach(v=>{readyFrame(v.frame).then(image=>{
        if (disposed || token!==generation) return;
        v.image=image;
        const img=image.decoded.cloneNode();img.alt='Native flight camera image '+v.frame.id;img.draggable=false;
        v.photo.replaceChildren(img,v.canvas);v.photo.disabled=false;v.set.disabled=false;
        v.axes.forEach((field,i)=>{field.disabled=false;field.max=String((i?image.height:image.width)-1);
          if(v.point) field.value=i?v.point.y:v.point.x;});
        refresh();
      }).catch(error=>{
        if (disposed || token!==generation) return;
        v.error=error.message;v.message.textContent=error.message;
        const retry=button('Retry frame pair');retry.onclick=()=>draw(active);v.node.append(retry);refresh();
      });});
    }
    brightness.onchange=refresh;select.onchange=()=>draw(select.value);prev.onclick=()=>draw(active-1);next.onclick=()=>draw(active+1);
    save.onclick=()=>{
      if(!latest)return;
      const blob=new Blob([JSON.stringify(latest,null,2)+'\n'],{type:'application/json'});
      const url=URL.createObjectURL(blob), a=el('a');a.href=url;a.download='first-fire-flight-frame-measurement.json';
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    };
    draw(0);
    return ()=>{
      disposed=true;resize?.disconnect();
      cache.forEach(p=>p.then(img=>{if(img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);}).catch(()=>{}));
      cache.clear();section.remove();
    };
  }
  window.FFFlightFrames = {render, measure};
})();
