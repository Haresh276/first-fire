'use strict';

(() => {
  const samples = window.FFFlex155;
  const el = id => document.getElementById(id);
  const canvas = el('instrument');
  const ctx = canvas.getContext('2d');
  const slider = el('sample');
  slider.max = samples.length - 1;
  const px = window.devicePixelRatio || 1;
  let timer = null;
  let audio, oscillator, gain;
  function draw() {
    const point = samples[Number(slider.value)];
    const width = canvas.clientWidth, height = canvas.clientHeight;
    canvas.width = Math.round(width*px); canvas.height = Math.round(height*px);
    ctx.setTransform(px,0,0,px,0,0);
    const cx=width/2, cy=height*.5, unit=Math.min(width*.72,height*.78)/24;
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle='#09161d';ctx.fillRect(0,0,width,height);
    // A fixed coordinate field makes shrinkage visible even when the light is gone.
    ctx.lineWidth=1;ctx.strokeStyle='#263c44';
    ctx.beginPath();ctx.moveTo(18,cy);ctx.lineTo(width-18,cy);ctx.moveTo(cx,15);ctx.lineTo(cx,height-15);ctx.stroke();
    for(let mm=2;mm<=12;mm+=2) {
      ctx.beginPath();ctx.arc(cx,cy,mm*unit,0,Math.PI*2);ctx.strokeStyle='#1e333a';ctx.stroke();
    }
    if(point.flame>0) {
      ctx.beginPath();ctx.arc(cx,cy,point.flame*unit/2,0,Math.PI*2);
      ctx.strokeStyle='#ffac72';ctx.shadowColor='#f78649';ctx.shadowBlur=12;ctx.lineWidth=2.8;ctx.stroke();ctx.shadowBlur=0;
    }
    const diameter=Math.sqrt(point.drop2);
    ctx.beginPath();ctx.arc(cx,cy,diameter*unit/2,0,Math.PI*2);ctx.fillStyle='#8be2d3';ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='#b8cecc';
    ctx.beginPath();ctx.moveTo(16,height-28);ctx.lineTo(16+unit*5,height-28);ctx.stroke();
    ctx.font='13px system-ui';ctx.fillStyle='#cdded9';ctx.fillText('5 mm',16,height-9);
    el('time').textContent=point.t.toFixed(2)+' s';
    el('flame-mm').textContent=point.flame===null?'No plotted point':point.flame.toFixed(1)+' mm';
    el('drop-mm').textContent=diameter.toFixed(2)+' mm';
    el('sample-number').textContent=(Number(slider.value)+1)+' of '+samples.length;
    slider.setAttribute('aria-valuetext',el('time').textContent+', flame '+el('flame-mm').textContent+', droplet '+el('drop-mm').textContent);
    if(oscillator) oscillator.frequency.setTargetAtTime(145*diameter,audio.currentTime,.035);
  }
  function silence() {
    if(oscillator){oscillator.stop();oscillator.disconnect();gain.disconnect();oscillator=null;}
  }
  async function sound() {
    if(!el('tone').checked||timer===null||oscillator)return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){el('tone').checked=false;el('tone').disabled=true;return;}
    try {
      audio ||= new Audio(); await audio.resume();
      if(!el('tone').checked || timer===null || oscillator)return;
      oscillator=audio.createOscillator();gain=audio.createGain();gain.gain.value=.035;
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();draw();
    } catch { el('tone').checked=false; silence(); }
  }
  function stop() {clearInterval(timer);timer=null;el('play').textContent='Play samples';silence();}
  el('play').addEventListener('click',()=>{
    if(timer!==null){stop();return;}
    if(Number(slider.value)===samples.length-1)slider.value=0;
    draw(); el('play').textContent='Pause';
    timer=setInterval(()=>{if(Number(slider.value)===samples.length-1){stop();return;} slider.value=Number(slider.value)+1;draw();},850);
    sound();
  });
  slider.addEventListener('input',()=>{stop();draw();});
  el('tone').addEventListener('change',()=>el('tone').checked?sound():silence());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
  for(const p of samples) {
    const tr=document.createElement('tr');
    for(const value of [p.t.toFixed(2),p.flame===null?'No plotted point':p.flame.toFixed(1),p.drop2.toFixed(2),p.x]) {
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    }
    el('points').append(tr);
  }
  window.addEventListener('resize',draw);draw();
})();
