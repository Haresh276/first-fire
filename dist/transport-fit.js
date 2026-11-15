// Fit using calibration data only, then predict a distinct run at known conditions.
(() => {
  'use strict';
  const transport=typeof module!=='undefined' && module.exports ? require('./transport-lab.js'):window.FFTransportLab;
  const ranges=transport.bounds;
  const knownKeys=['sourceVolume','remoteVolume','vent','release','pulse'];
  const describe={sourceVolume:'Source volume (m³)',remoteVolume:'Sensor volume (m³)',vent:'Clean-air supply (L/s)',release:'Tracer mass (g)',pulse:'Pulse duration (s)'};
  const labels=['Calibration','Held-out'];
  const cap=2*1024*1024;
  function parseCSV(text){
    const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
    if(lines.length<7 || lines.length>3001)throw Error('Supply 6–3,000 observations and a header.');
    const cols=lines.shift().trim().toLowerCase().split(',').map(x=>x.trim());
    const accepted=['time_s,sensor_mg_m3','time_s,sensor_ug_m3'];
    if(!accepted.includes(cols.join(','))) throw Error('Use time_s,sensor_mg_m3 or time_s,sensor_ug_m3 as the header.');
    const factor=cols[1]==='sensor_ug_m3'?0.001:1;
    let prev=-1;
    const points=lines.map((line,i)=>{
      const cells=line.split(',').map(s=>s.trim());
      if(cells.length!==2 || cells.some(s=>!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(s)))throw Error('Expected two numeric cells on line '+(i+2)+'.');
      const t=Number(cells[0]),y=Number(cells[1])*factor;
      if(!Number.isFinite(t)||!Number.isFinite(y)||t<=prev||t<0||t>300)throw Error('Times must increase strictly within 0–300 s and readings must be finite.');
      prev=t;return {t,y};
    });
    validateTrace(points);
    return points;
  }
  function validateTrace(points){
    if(!Array.isArray(points)||points.length<6||points.length>3000)throw Error('Supply 6–3,000 observations per run.');
    let prev=-1;
    for(const p of points){
      if(!p || !Number.isFinite(p.t)||!Number.isFinite(p.y)||p.t<0||p.t>300||p.t<=prev)throw Error('Times must increase strictly within 0–300 s and readings must be finite.');
      prev=p.t;
    }
    if(points.at(-1).t-points[0].t<10)throw Error('Observations must span at least 10 seconds.');
  }
  function traceEqual(a,b){
    return a.length===b.length && a.every((p,i)=>Math.abs(p.t-b[i].t)<1e-9 && Math.abs(p.y-b[i].y)<=1e-8*Math.max(1,Math.abs(p.y),Math.abs(b[i].y)));
  }
  function known(s){
    const values={};
    for(const k of knownKeys){
      const value=s[k],[lo,hi]=ranges[k];
      if(!Number.isFinite(value)||value<lo||value>hi||(k==='pulse'&&!Number.isInteger(value)))throw Error('Check '+describe[k]+' ('+lo+'–'+hi+').');
      values[k]=value;
    }
    return values;
  }
  function resample(points,times,key='sensor'){
    return times.map(({t})=>{
      const lo=Math.floor(t),f=t-lo;
      return points[lo][key]*(1-f)+points[Math.min(lo+1,300)][key]*f;
    });
  }
  function single(s,lag){
    const vol=s.sourceVolume+s.remoteVolume,q=s.vent/1000,dt=.2;
    const fraction=lag>0?-Math.expm1(-dt/lag):1;
    let mass=0,y=0;const samples=[{sensor:0}];
    for(let i=0;i<1500;i++){
      mass+=((i<s.pulse*5?s.release*1000/s.pulse:0)-q*mass/vol)*dt;
      y+=(mass/vol-y)*fraction;
      if((i+1)%5===0)samples.push({sensor:y});
    }
    return samples;
  }
  function score(obs,pred) {
    let sum=0,abs=0,sq=0;
    for(let i=0;i<obs.length;i++){const error=pred[i]-obs[i].y;sum+=error;abs+=Math.abs(error);sq+=error*error;}
    if(!Number.isFinite(sq)||!Number.isFinite(abs)||!Number.isFinite(sum))throw Error('Readings exceed the numerical range for scoring. Check the concentration units.');
    return {rmse:Math.sqrt(sq/obs.length),mae:abs/obs.length,bias:sum/obs.length,n:obs.length};
  }
  const qs=[0,2,5,10,15,20,30,40,55,75,100,150,225,325,450,600,800];
  const ts=[0,2,5,10,15,20,30,40,50,60];
  function fit(cal,calKnown,held,heldKnown,noiseFloor=.15) {
    validateTrace(cal);validateTrace(held);
    if(traceEqual(cal,held))throw Error('These traces have identical times and readings. Supply a separate held-out run.');
    const a=known(calKnown),b=known(heldKnown);
    if(!Number.isFinite(noiseFloor)||noiseFloor<=0)throw Error('Use a positive tolerance in mg/m³.');
    // The held-out run can change pulse size, duration or geometry. It must share the same
    // effective exchange rate and sensor response for this transfer test to be meaningful.
    const candidates=new Map(),oneZone=new Map();
    function evaluate(q,tau) {
      const k=q+'/'+tau;
      if(!candidates.has(k)){
        const run=transport.simulate({...transport.defaults,...a,exchange:q,lag:tau},.2);
        candidates.set(k,{q,tau,rmse:score(cal,resample(run.points,cal)).rmse});
      }
      return candidates.get(k);
    }
    const ordered=(a,b)=>a.rmse-b.rmse||a.tau-b.tau||a.q-b.q;
    for(const q of qs)for(const tau of ts)evaluate(q,tau);
    let best=[...candidates.values()].sort(ordered)[0];
    // Cover the gap to neighboring coarse flow settings. Refine both axes, including cross terms.
    const index=qs.indexOf(best.q);
    const spread=Math.max(best.q-qs[Math.max(0,index-1)],qs[Math.min(qs.length-1,index+1)]-best.q);
    const steps=[[Math.max(1,spread/3),3],[Math.max(.5,spread/9),1],[Math.max(.25,spread/27),.5],[.25,.25]];
    for(const [flowStep,lagStep] of steps){
      const mid=best;
      for(let i=-3;i<=3;i++)for(let j=-3;j<=3;j++){
        const q=Math.round((mid.q+i*flowStep)*4)/4,tau=mid.tau+j*lagStep;
        if(q>=0&&q<=800&&tau>=0&&tau<=60){const candidate=evaluate(q,tau);if(ordered(candidate,best)<0)best=candidate;}
      }
    }
    // Final pattern search traverses high-flow/lag trade-offs missed by a single fine block.
    for(const [dq,dt] of [[8,1],[4,.5],[2,.25],[1,.25],[.5,.25],[.25,.25]]){
      for(let iteration=0;iteration<12;iteration++){
        const mid=best;
        for(const u of [-1,0,1])for(const v of [-1,0,1]){
          const q=mid.q+u*dq,tau=mid.tau+v*dt;
          if(q>=0&&q<=800&&tau>=0&&tau<=60){const next=evaluate(q,tau);if(next.rmse<best.rmse)best=next;}
        }
        if(mid===best)break;
      }
    }
    function baseline(tau){
      if(!oneZone.has(tau))oneZone.set(tau,{tau,rmse:score(cal,resample(single(a,tau),cal)).rmse});
      return oneZone.get(tau);
    }
    let base=baseline(0);
    for(let tau=0;tau<=60;tau+=.5){const trial=baseline(tau);if(trial.rmse<base.rmse)base=trial;}
    const predicted=resample(transport.simulate({...transport.defaults,...b,exchange:best.q,lag:best.tau},.2).points,held);
    const baselinePred=resample(single(b,base.tau),held);
    const equivalent=[...candidates.values()].filter(x=>x.rmse<=best.rmse+noiseFloor+1e-12);
    function limits(prop){const vals=equivalent.map(x=>x[prop]);return [Math.min(...vals),Math.max(...vals)];}
    return {schema:'FIRST-FIRE-transport-fit-v1',scenario_calibration:a,scenario_held_out:b,dt_s:.2,
      fitted:{exchange_lps:best.q,sensor_tau_s:best.tau,calibration_rmse:best.rmse},
      baseline:{model:'single well-mixed volume, first-order sensor',sensor_tau_s:base.tau,calibration_rmse:base.rmse},
      near_fits:{rmse_allowance_mg_m3:noiseFloor,exchange_lps:limits('q'),sensor_tau_s:limits('tau'),n:equivalent.length,tried:candidates.size,
        extrema:['q','tau'].flatMap(key=>{const sorted=equivalent.slice().sort((a,b)=>a[key]-b[key]||ordered(a,b));return [sorted[0],sorted.at(-1)];})},
      two_zone_held:score(held,predicted),one_zone_held:score(held,baselinePred),
      calibration_observations:cal,held_out_trace:held.map((p,i)=>({time_s:p.t,observed_mg_m3:p.y,two_zone_mg_m3:predicted[i],single_zone_mg_m3:baselinePred[i],two_zone_residual:predicted[i]-p.y,single_zone_residual:baselinePred[i]-p.y})),
      units:{time:'s',concentration:'mg/m³',exchange:'L/s',mass:'g',volumes:'m³'},
      assumptions:'Passive tracer, zero initial background, constant exchange and ventilation, common exchange and sensor lag across both runs.'};
  }
  function example(){
    const cal=known(transport.defaults),held={...cal,release:.75,pulse:32};
    const make=(s,phase)=>{
      const trace=transport.simulate({...transport.defaults,...s,exchange:38,lag:11},.05).points;
      return trace.filter((_,i)=>i%5===0).map(p=>({t:p.t,y:Math.max(0,p.sensor+(p.t===0?0:.18*Math.sin(p.t*.17+phase)+.07*Math.cos(p.t*.093+phase)))}));
    };
    return {runs:[make(cal,.3),make(held,1.7)],scenarios:[cal,held],bundled:[true,true],provenance:['Synthetic example','Synthetic example'],names:['Example calibration pulse','Example held-out pulse']};
  }
  const metrics={rmse:'RMSE',mae:'Mean absolute error',bias:'Average signed error'};
  const nice=x=>Number(x.toFixed(3)).toLocaleString('en-US',{maximumFractionDigits:3});
  const e=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
  const act=(label,handler,cls='ghost')=>{const b=e('button',label,cls);b.type='button';b.onclick=handler;return b;};
  function download(name,content,type){
    const url=URL.createObjectURL(new Blob([content],{type}));
    const a=e('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function plot(canvas,trace){
    const width=Math.max(240,canvas.clientWidth),height=205,scale=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*scale);canvas.height=height*scale;
    const c=canvas.getContext('2d');if(!c)return;c.scale(scale,scale);
    const l=48,r=width-12,top=21,bot=height-29;
    const vals=trace.flatMap(x=>[x.two_zone_residual,x.single_zone_residual]);
    const ymax=Math.max(0.1,Math.max(...vals.map(Math.abs)))*1.04;
    const first=trace[0].time_s,last=trace.at(-1).time_s;
    const x=t=>l+(r-l)*(t-first)/(last-first),y=v=>(top+bot)/2-v/ymax*(bot-top)/2;
    c.font='11px system-ui';c.fillStyle='#3c5047';c.textAlign='right';
    for(const v of [-ymax,0,ymax]){c.fillText(nice(Number(v.toPrecision(2))),l-5,y(v)+4);c.strokeStyle=v===0?'#7c8b7d':'#ccd5c9';c.beginPath();c.moveTo(l,y(v));c.lineTo(r,y(v));c.stroke();}
    for(const t of [first,(first+last)/2,last]){c.textAlign=t===first?'left':t===last?'right':'center';c.fillText(nice(t)+' s',x(t),height-7);}
    for(const [k,color,dash] of [['single_zone_residual','#a84f24',[5,4]],['two_zone_residual','#216655',[]]]){
      c.strokeStyle=color;c.setLineDash(dash);c.lineWidth=2;c.beginPath();trace.forEach((v,i)=>i?c.lineTo(x(v.time_s),y(v[k])):c.moveTo(x(v.time_s),y(v[k])));c.stroke();
    }
  }
  function compact(out) {
    const fields=['schema','scenario_calibration','scenario_held_out','fitted','baseline','near_fits','two_zone_held','one_zone_held','units','dt_s','assumptions'];
    return {...Object.fromEntries(fields.map(k=>[k,out[k]])),calibration_n:out.calibration_observations.length,source_origins:out.sources.map(x=>x.origin)};
  }
  function mount(element,previousFit=window.FFResearchSession?.previous?.('transport-lab')?.record?.sensorFit) {
    let sample=example(),current=null,revision=0,observer=null;
    const form=e('div',null,'stack'),status=e('p',null,'small'),results=e('div');status.setAttribute('role','status');
    const scenarioInputs=[],sources=[],pickers=[],examples=example();
    const commands=e('div',null,'actions');
    const intro=e('p','Fit a compartment exchange rate and a sensor response time on one run. Predict a second run with the fitted values and compare against a single well-mixed compartment.');
    const grid=e('div',null,'grid2');
    const notify=result=>element.dispatchEvent(new CustomEvent('ff-transport-fit',{bubbles:true,detail:{result}}));
    function invalidate(message){
      revision++;current=null;observer?.disconnect();results.replaceChildren();status.textContent=message;notify(null);
    }
    function loadDefaults(){
      sample=example();sample.scenarios.forEach((s,i)=>{for(const k of knownKeys)scenarioInputs[i][k].value=s[k];sources[i].value='Synthetic example';pickers[i].value='';});
      invalidate('Loaded two synthetic runs. Fit to calculate held-out errors.');
    }
    labels.forEach((label,i)=>{
      const card=e('section',null,'panel stack');card.append(e('h3',label+' run'));
      const file=e('input');file.type='file';file.accept='.csv,text/csv';pickers.push(file);
      const l=e('label',label+' sensor CSV','field');l.append(file);card.append(l);
      const provenance=e('select');for(const text of ['Synthetic example','Uploaded, provenance unspecified','Researcher-reported measurement','Researcher-reported simulation']){
        const opt=e('option',text);opt.value=text;provenance.append(opt);
      }
      const pl=e('label','Data origin','field');pl.append(provenance);card.append(pl);sources.push(provenance);
      provenance.onchange=()=>{
        if(sample.bundled[i]&&provenance.value!=='Synthetic example'){provenance.value='Synthetic example';status.textContent='The bundled example is synthetic.';return;}
        if(!sample.bundled[i]&&provenance.value==='Synthetic example'){provenance.value='Uploaded, provenance unspecified';}
        sample.provenance[i]=provenance.value;invalidate('Origin changed. Fit again to update the record.');
      };
      let uploadGeneration=0;
      file.onchange=async()=>{
        const g=++uploadGeneration,selected=file.files[0];if(!selected)return;
        sample.runs[i]=null;sample.bundled[i]=false;
        invalidate('Reading '+label.toLowerCase()+' CSV…');
        try{
          if(selected.size>cap)throw Error('CSV exceeds the 2 MB file limit.');
          const points=parseCSV(await selected.text());if(g!==uploadGeneration || file.files[0]!==selected)return;
          sample.runs[i]=points;sample.names[i]=selected.name;sample.bundled[i]=examples.runs.some(run=>traceEqual(run,points));
          sample.provenance[i]=sample.bundled[i]?'Synthetic example':'Uploaded, provenance unspecified';
          provenance.value=sample.provenance[i];invalidate(selected.name+' loaded · '+points.length+' samples. Enter the known scenario and run the fit.');
        }catch(err){
          if(g!==uploadGeneration || file.files[0]!==selected)return;
          sample.runs[i]=null;sample.names[i]=selected.name;sample.provenance[i]='Uploaded, provenance unspecified';provenance.value=sample.provenance[i];invalidate(err.message);
        }
      };
      const params=e('details');params.append(e('summary','Known conditions'));
      const values=e('div',null,'tr-inputs'),inputs={};
      for(const key of knownKeys){
        const c=e('input');c.type='number';c.min=ranges[key][0];c.max=ranges[key][1];c.step=key==='pulse'?'1':'any';c.value=sample.scenarios[i][key];inputs[key]=c;
        const f=e('label',describe[key],'field');f.append(c);values.append(f);
        c.oninput=()=>invalidate('Conditions changed. Fit again to update the comparison.');
      }
      params.append(values);card.append(params);scenarioInputs.push(inputs);grid.append(card);
    });
    const allowance=e('input');allowance.type='number';allowance.min='0.001';allowance.step='any';allowance.value='0.15';
    allowance.oninput=()=>invalidate('Tolerance changed. Fit again to update the comparison.');
    const field=e('label','Near-fit RMSE allowance (mg/m³)','field');field.append(allowance);
    const fitButton=act('Fit and test held-out run',async()=>{
      invalidate('Fitting the calibration trace…');const generation=revision;
      fitButton.disabled=true;
      await new Promise(resolve=>setTimeout(resolve,20));
      try{
        if(generation!==revision)return;
        if(!sample.runs.every(x=>x))throw Error('Supply two valid run files or restore the example.');
        const params=scenarioInputs.map(inputs=>Object.fromEntries(knownKeys.map(k=>[k,inputs[k].value.trim()===''?NaN:Number(inputs[k].value)])));
        const out=fit(sample.runs[0],params[0],sample.runs[1],params[1],Number(allowance.value));
        out.sources=sample.names.map((name,i)=>({name,origin:sample.provenance[i]}));current=out;
        status.textContent=(new Set(sample.provenance).size>1?'Mixed-origin comparison. ':'Fit complete. ')+'Both parameter estimates used only the calibration trace.';draw();notify(compact(out));
      }catch(err){status.textContent=err.message;}finally{fitButton.disabled=false;}
    },'btn');
    commands.append(fitButton,act('Restore synthetic runs',loadDefaults));
    const exampleActions=e('div',null,'actions');
    examples.runs.forEach((run,i)=>exampleActions.append(act('Example '+labels[i].toLowerCase()+' CSV',()=>{
      download('synthetic-'+labels[i].toLowerCase()+'-tracer.csv','time_s,sensor_mg_m3\n'+run.map(x=>x.t+','+x.y.toPrecision(12)).join('\n')+'\n','text/csv');
    })));
    const instructions=e('details');instructions.append(e('summary','CSV format and assumptions'),e('p','Use time_s,sensor_mg_m3 or time_s,sensor_ug_m3. Provide 6–3,000 baseline-corrected readings in increasing order between 0 and 300 seconds, from the start of release. Align clocks and use two different runs with the same exchange setting and sensor. Set pulse and geometry for each run. A CSV may be up to 2 MB. Files are processed in this browser.'),exampleActions);
    function draw(){
      if(!current)return;
      const out=current,n=out.near_fits,part=e('div',null,'stack');
      part.append(e('h3','Held-out sensor errors'),e('p',out.sources.map(x=>x.name+' ('+x.origin+')').join(' → ')));
      const table=e('table'),thead=e('thead'),header=e('tr');for(const text of ['Error (mg/m³)','Two-zone','One-zone'])header.append(e('th',text));thead.append(header);table.append(thead);
      const body=e('tbody');for(const [key,label] of Object.entries(metrics)){const row=e('tr');row.append(e('th',label),e('td',nice(out.two_zone_held[key])),e('td',nice(out.one_zone_held[key])));body.append(row);}table.append(body);
      const wrap=e('div',null,'tablewrap');wrap.append(table);
      part.append(wrap,e('p','Fitted exchange '+nice(out.fitted.exchange_lps)+' L/s and sensor time constant '+nice(out.fitted.sensor_tau_s)+' s. The single-compartment baseline fitted its own sensor time constant of '+nice(out.baseline.sensor_tau_s)+' s. Calibration RMSE was '+nice(out.fitted.calibration_rmse)+' mg/m³. The held-out run contributed '+out.two_zone_held.n+' readings.'));
      part.append(e('h3','Residuals on the held-out run'),e('p','Prediction minus observation in mg/m³. Green solid shows two compartments. Orange dashed shows one compartment.'));
      const canvas=e('canvas');canvas.style.width='100%';canvas.style.height='205px';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Held-out prediction error versus time for both models');part.append(canvas);
      const collision=e('p','Among '+n.tried+' tested fits, '+n.n+' lie within '+nice(n.rmse_allowance_mg_m3)+' mg/m³ of the best calibration RMSE. Their exchanges span '+nice(n.exchange_lps[0])+'–'+nice(n.exchange_lps[1])+' L/s and their sensor times span '+nice(n.sensor_tau_s[0])+'–'+nice(n.sensor_tau_s[1])+' s. These grid ranges depend on the tolerance and search resolution.');
      const limitsNote=e('p','A fit at a search boundary can indicate a parameter the experiment cannot resolve. The single-compartment sensor fit '+(out.baseline.sensor_tau_s===60?'reached the 60 s upper search limit.':out.baseline.sensor_tau_s===0?'reached the 0 s lower search limit.':'fell inside the 0–60 s search range.'));
      part.append(e('h3','Which parameters do the data distinguish?'),collision,limitsNote,act('Download fit and residuals',()=>download('first-fire-transport-fit.json',JSON.stringify(out,null,2)+'\n','application/json')));
      results.replaceChildren(part);plot(canvas,out.held_out_trace);observer?.disconnect();observer=new ResizeObserver(()=>plot(canvas,out.held_out_trace));observer.observe(canvas);
    }
    form.append(e('h2','Fit a sensor trace'),intro,grid,field,instructions,commands,status,results);element.replaceChildren(form);
    status.textContent='Two synthetic example runs are loaded. Both use the same transport physics with distinct perturbations.';
    if(previousFit?.schema==='FIRST-FIRE-transport-fit-v1' && Number.isFinite(previousFit.two_zone_held?.rmse) && Number.isFinite(previousFit.one_zone_held?.rmse)){
      const saved=e('div',null,'note');saved.append(e('strong','Fit saved in this session'),e('p','Held-out RMSE was '+nice(previousFit.two_zone_held.rmse)+' mg/m³ for two compartments and '+nice(previousFit.one_zone_held.rmse)+' mg/m³ for one. '+(Array.isArray(previousFit.source_origins)?previousFit.source_origins.join(' → ')+'. ':'')+'Load the original files to inspect their residuals again, or fit the example currently in the controls.'));
      results.replaceChildren(saved);
    }
    return ()=>{revision++;observer?.disconnect();};
  }
  const api={fit,parseCSV,example,mount,compact};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(typeof window!=='undefined')window.FFTransportFit=api;
})();
