(() => {
  'use strict';
  const data = globalThis.RoverFireData, M=globalThis.RoverFireModel;
  const {reference} = data, defaults=reference.rover;
  const $=id=>document.getElementById(id);
  const html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';
  const signed=(value,d=1)=>Number.isFinite(value)?(value>0?'+':'')+num(value,d):'—';
  const pc=(n,d=1)=>num(n*100,d)+'%';
  const badge=label=>'<span class="badge '+(label===M.validated?'':'extra')+'">'+label+'</span>';
  const option=(el,value,text)=>el.add(new Option(text,value));
  const table=(headers,rows)=>'<div class="scroll"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
  const td=s=>'<td>'+s+'</td>', tr=cells=>'<tr>'+cells.map(td).join('')+'</tr>';
  const color={PMMA:'#ffb075',P213:'#e7ca77',PC:'#86cab7',NOMEX:'#8bb9dc'};
  const short={PMMA:'Cover',P213:'Tape',PC:'Housing',NOMEX:'Fastener'};
  const names={PMMA:'PMMA cover',P213:'P213 tape',PC:'Polycarbonate housing',NOMEX:'Nomex fasteners'};
  const gravNames={orbit:'Orbit',moon:'Moon',mars:'Mars',earth:'Earth'};
  let cabin={...defaults},items=structuredClone(data.inventory),selected=0,rows=[],doses=null;
  let candidateSpecimen = MaterialCaseLink.imported;
  let activeTimeline=null,timer=null,repaintScene=()=>{};
  const pins=[];
  const selectedItem=()=>items[selected];
  const unknown=it=>!Object.hasOwn(data.fuels,it.material);
  const unsupported=()=>cabin.gravity==='orbit'
    ? 'With fans off in orbit, oxygen transport by diffusion is outside the solid model. Read the BASS and Saffire flight evidence below.'
    : unknown(selectedItem()) ? 'This material has no FLINT calibration. Its limit, timeline and response are not modelled.'
    : 'The material limit is outside the engine’s oxygen search range.';
  function syncControls() {
    const p=reference.trade.findIndex(a=>a.P_psia===cabin.P_psia&&a.X_O2===cabin.X_O2);
    $('preset').value=p<0?'custom':String(p);
    $('pressure').value=cabin.P_psia;$('oxygen').value=+(cabin.X_O2*100).toFixed(8);
    $('volume').value=cabin.volume_m3;$('fans').value=+(cabin.fan_m_s*100).toFixed(8);
    $('gravity').value=cabin.gravity;
  }
  function stop() {clearInterval(timer);timer=null;$('play').textContent='Play timeline';}
  function resetTimeline() {
    stop();activeTimeline=null;
    $('timeline-view').hidden=true;$('ignite-here').hidden=false;
    $('timeline-context').textContent='Light '+selectedItem().name+' to run the fans-off case. The fan comparison above shows the separate effect of forced flow.';
    $('response').value='none';$('vent-label').hidden=true;
  }
  function pick(index,scroll=false) {
    candidateSpecimen = null;
    selected=index;resetTimeline();render();
    if(scroll)$('cabin').scrollIntoView({block:'start'});
  }
  function renderFocus() {
    const it=selectedItem(),off=rows[selected][1];
    const available=Number.isFinite(off.limit);
    $('selected-title').textContent=it.name;
    $('selected-details').innerHTML=html([it.where,it.area_m2+' m²',it.areal_density+' kg/m²'].filter(Boolean).join(' · '))+
      ' <small>(illustrative dimensions)</small> '+badge(M.extrapolated);
    $('selected-margin').innerHTML=available?'<div class="metric-main">'+signed(off.margin)+' <small>O₂ points</small></div>'+
      badge(M.validity(cabin)):'<strong>'+(unknown(it)?'Not calibrated':'Not modelled')+'</strong>';
    $('selected-meaning').textContent=available
      ? (off.burns?'Above':'At or below')+' the fans-off limit of '+pc(off.limit)+'. '+(off.burns?'Sustained burning is possible.':'Sustained burning is not predicted.')
      :unsupported();
    $('ignite').disabled=$('ignite-here').disabled=!available;
    pins.forEach((pin,i)=>{
      pin.setAttribute('aria-pressed',String(i===selected));
      pin.dataset.state=rows[i][1].burns===null?'withheld':rows[i][1].burns?'burns':'below';
      pin.title=items[i].name+' · '+(rows[i][1].burns===null?'Not modelled':signed(rows[i][1].margin)+' points · '+M.validity(cabin));
    });
    repaintScene();
  }
  function renderInventory() {
    const output=(finding,fan)=>{
      if(!Number.isFinite(finding.limit))return 'Not modelled';
      return '<strong>'+pc(finding.limit)+' limit</strong><small>'+signed(finding.margin)+' pts · '+html(finding.branch)+'</small>'+
        badge(M.validity(cabin,fan));
    };
    $('inventory-table').innerHTML=table(['Item','Selected fan · '+num(cabin.fan_m_s*100,1)+' cm/s','Fans off','Fans-off outcome'],
      items.map((it,i)=>'<tr class="'+(i===selected?'active-row':'')+'">'+td('<button type="button" class="table-pick" data-item="'+i+'">'+html(it.name)+'</button><small>'+html(it.where||'Added item')+'</small>')+
        td(output(rows[i][0],cabin.fan_m_s))+td(output(rows[i][1],0))+
        td(unknown(it)?'Not calibrated':rows[i][1].burns===null?'Not modelled':rows[i][1].burns?'May keep burning':'Below sustained-burning limit')+'</tr>'));
    $('inventory-table').querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>pick(Number(b.dataset.item),true));
  }
  function renderTrade() {
    const comparisons=M.trade(cabin,items);
    const unique=[...new Set(items.filter(it=>!unknown(it)).map(it=>it.material))];
    const values=comparisons.flatMap(row=>row.rows.map(it=>it.margin)).filter(Number.isFinite);
    const min=Math.min(0,...values),max=Math.max(1,...values),scale=100/(max-min),zero=-min*scale;
    const key=unique.map(k=>'<span><i class="dot" style="background:'+color[k]+'"></i>'+html(names[k])+'</span>').join('');
    const lines=row=>unique.map(k=>{
      const value=row.rows[items.findIndex(it=>it.material===k)].margin;
      if(!Number.isFinite(value))return '<small>'+html(names[k])+': not modelled</small>';
      return '<div class="bar-line" aria-label="'+html(names[k])+', '+signed(value)+' points"><div class="bar-track" style="--zero:'+zero+'%"><div class="bar" style="background:'+color[k]+';left:'+(zero+Math.min(0,value)*scale)+'%;width:'+Math.abs(value)*scale+'%"></div></div><span>'+signed(value)+'</span></div>';
    }).join('');
    $('trade-chart').innerHTML='<div class="trade-key">'+key+'</div>'+table(['Atmosphere','O₂ partial pressure','Pre-breathe ratio','Items above limit','Fans-off margin (points)','Validity of row'],
      comparisons.map((r,i)=>tr(['<button type="button" class="table-pick" data-preset="'+i+'">'+html(r.atmosphere)+'</button><small>'+num(r.P_psia)+' psia · '+pc(r.X_O2)+'</small>',
      num(r.pO2_kPa)+' kPa',num(r.prebreathe_ratio,2),r.modelled?r.count+' of '+r.modelled+' calibrated / modelled':'Not modelled',
      '<div class="bar-cell">'+lines(r)+'</div>',badge(M.validity(r.conditions))])));
    $('trade-chart').querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{
      setPreset(+b.dataset.preset);$('conditions').scrollIntoView({block:'start'});
    });
  }
  function floodRow(agent,dose) {
    if(!dose)return tr([agent,'Not modelled','—','—','—']);
    if(!dose.needed)return tr([agent,'No addition needed','No change','Already below target',badge(M.validity(cabin))]);
    const crew=agent==='CO₂ flood'?(dose.crew_must_mask?'Mask required. ':'')+
      pc(dose.final_CO2)+' CO₂ after flooding.':'O₂ partial pressure '+num(dose.pO2_kPa)+' kPa. Check hull pressure rating.';
    return tr([agent,num(dose.kg)+' kg',num(dose.final_P_psia)+' psia',
              crew,badge(M.extrapolated)]);
  }
  function renderDoses() {
    const it=selectedItem(),a=rows[selected],v=doses.vent;
    const fanOutcome=a.every(r=>Number.isFinite(r.limit))
      ?'Limit moves from '+pc(a[0].limit)+' to '+pc(a[1].limit)+'. '+(a[1].burns?'May sustain burning.':'Below limit.'):'Not modelled';
    const vent=v?.needed ? num(v.P_psia)+' psia':v?'No venting needed':'Not modelled';
    $('dose-table').innerHTML='<h3>'+html(it.name)+'</h3>'+table(['Response','Dose or endpoint','Final pressure','Fire or crew effect','Validity of result'],[
      tr(['Fans off','Cut forced flow','No pressure change',fanOutcome,badge(M.validity(cabin,cabin.fan_m_s))]),
      floodRow('CO₂ flood',doses.co2),floodRow('Nitrogen flood',doses.n2),
      tr(['Vent cabin',vent,v?.needed?vent:'—',v?.needed?('O₂ partial pressure '+num(v.pO2_kPa)+' kPa. Suit crew before venting.'):'—',v?badge(v.needed?M.extrapolated:M.validity(cabin)):'Not modelled'])]);
    if(M.isReference(cabin,it))$('dose-table').insertAdjacentHTML('beforeend',
      '<p class="note">In this reference case, acrylic and polycarbonate need large gas floods. Nomex needs less added gas. The pressure hull and the crew’s protective equipment constrain feasibility.</p>');
    $('vent-target').max=cabin.P_psia;
    $('vent-target').value=v?.P_psia!=null?Math.min(cabin.P_psia,v.P_psia).toFixed(3):'';
    showResponse();
  }
  function showResponse() {
    const mode=$('response').value,selectedDose=doses?.[mode],off=rows[selected][1];
    let message='',label='';
    $('vent-label').hidden=mode!=='vent';
    if(mode==='suit')message='Suits protect crew during a vent. Suiting up alone adds no suppressant and leaves the cabin fire margin unchanged.';
    else if(!Number.isFinite(off.limit)) message=unsupported();
    else if(mode==='none')message='No intervention. The sealed-cabin timeline follows this item with the fans off and the crew response withheld.';
    else if(mode==='fans'){
      message='Fans off: '+signed(off.margin)+' oxygen points relative to the limit. '+(off.burns?'The model still permits sustained burning.':'The model gives no sustained burning.');label=M.validity(cabin);
    } else if(mode==='vent'){
      const input=$('vent-target'),target=input.valueAsNumber;
      if(!input.value||!input.checkValidity()||!(target<=cabin.P_psia)){message='Choose a target between the solver’s lower pressure bound and the starting pressure.';}
      else {
        const limit=M.limit(cabin,selectedItem(),0,target).limit;
        if(!Number.isFinite(limit))message='The engine has no finite oxygen limit at this target. Choose a pressure within its oxygen search range.';
        else message='At '+num(target,2)+' psia, the fans-off limit is '+pc(limit)+'. '+
          (cabin.X_O2>limit?'The item can still burn.':limit-cabin.X_O2>=data.constants.margin-1e-4?'The target reaches the extinction buffer.':'The item is at or below its limit, inside the extinction buffer.')+
          ' The crew must suit up before an intentional cabin vent.';
        label=M.extrapolated;
      }
    } else if(!selectedDose)message='The engine could not find a flood dose within its solution range.';
    else if(!selectedDose.needed){message='This case already meets the modeled extinction buffer. No flood is required.';label=M.validity(cabin);}
    else {
      message='Adding '+num(selectedDose.kg)+' kg at fixed volume gives '+num(selectedDose.final_P_psia)+' psia. '+
        (mode==='co2'?('Cabin CO₂ rises to '+pc(selectedDose.final_CO2)+'. '+(selectedDose.crew_must_mask?'Crew must mask up.':'The mask threshold is not exceeded.')):
        ('O₂ partial pressure stays at '+num(selectedDose.pO2_kPa)+' kPa. '+(selectedDose.crew_must_mask?'Low oxygen requires crew protection. ':'')+'The hull must withstand the new pressure.'));
      label=M.extrapolated;
    }
    $('response-result').textContent=message;
    if(label)$('response-result').insertAdjacentHTML('beforeend',' '+badge(label));
  }
  const channels={heat:['Heat release','kW'],co2:['Cabin CO₂','%'],temperature:['Gas temperature','K'],pressure:['Cabin pressure','psia']};
  function sparkline(trace,key) {
    const values=trace.map(r=>r[key]);
    const lo=key==='temperature'||key==='pressure'?Math.min(...values):0;
    const hi=Math.max(lo+0.001,...values),width=280,height=66;
    const x=t=>6+t/trace.at(-1).t*(width-12);
    const y=v=>height-6-(v-lo)/(hi-lo)*(height-12);
    const stride=Math.max(1,Math.floor(trace.length/200));
    const plotted=trace.filter((_,i)=>i%stride===0||i===trace.length-1);
    // Include peaks between decimated points.
    plotted.push(trace[values.indexOf(Math.max(...values))]);plotted.sort((a,b)=>a.t-b.t);
    const points=plotted.map(r=>x(r.t).toFixed(2)+','+y(r[key]).toFixed(2)).join(' ');
    const [label,unit]=channels[key];
    return '<figure><figcaption>'+label+' ('+unit+')</figcaption><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+label+' over time">'+
      '<path d="M6 6 V60 H274" stroke="#53646b" fill="none"/><polyline fill="none" stroke="#ffb075" stroke-width="2" points="'+points+'"/>'+
      '<line class="cursorline" x1="6" x2="6" y1="5" y2="60" stroke="#9ed2c0" stroke-width="1.5"/></svg>'+
      '<small>'+num(lo)+'–'+num(hi)+' '+unit+' · '+num(trace[0].t,0)+'–'+num(trace.at(-1).t)+' s</small> '+badge(M.extrapolated)+'</figure>';
  }
  function renderTime() {
    if(!activeTimeline)return;
    const i=Math.min(activeTimeline.trace.length-1,+$('time').value);
    const reading=activeTimeline.trace[i],x=6+268*i/(activeTimeline.trace.length-1);
    $('timeline-charts').querySelectorAll('.cursorline').forEach(line=>{line.setAttribute('x1',x);line.setAttribute('x2',x);});
    $('timeline-reading').innerHTML=Object.entries(channels).map(([k,[label,unit]])=>
      '<div><small>'+label+'</small><strong>'+num(reading[k],k==='co2'?2:1)+' '+unit+'</strong>'+badge(M.extrapolated)+'</div>').join('')+
      '<div><small>Elapsed time</small><strong>'+num(reading.t)+' s</strong>'+badge(M.extrapolated)+'</div>';
    $('time').setAttribute('aria-valuetext',num(reading.t)+' seconds');
  }
  function ignite(shouldScroll) {
    const it=selectedItem();stop();activeTimeline=M.timeline(cabin,it);
    if(!activeTimeline)return;
    const saved=M.isReference(cabin,it)?reference.responses.find(r=>r.material===it.material).timeline:null;
    const summary=saved||activeTimeline.summary;
    $('timeline-context').textContent='Ignited item: '+it.name+'. The simulation follows the unmitigated fire with fans off.';
    $('timeline-view').hidden=false;$('ignite-here').hidden=true;
    const metrics=[['Time to 1 kW','t_hrr_1kW_s'],['Time to 10 kW','t_hrr_10kW_s'],['Time to 1% CO₂','t_CO2_1pct_s'],['Time to 10 K warming','t_dT_10K_s']];
    $('timeline-thresholds').innerHTML=metrics.map(([name,k])=>'<div><small>'+name+'</small><strong>'+(summary[k]===null?'Not reached':num(summary[k])+' s')+'</strong>'+badge(M.extrapolated)+'</div>').join('');
    $('timeline-charts').innerHTML=Object.keys(channels).map(k=>sparkline(activeTimeline.trace,k)).join('');
    $('time').max=activeTimeline.trace.length-1;$('time').value=0;renderTime();
    const sensitivity=M.isReference(cabin,it)?reference.timeline_sensitivity_t10kW[it.material]:null;
    $('sensitivity').innerHTML=sensitivity?'<p>Time to reach 10 kW when spread and burning rates change together: '+
      Object.entries(sensitivity).sort(([a],[b])=>Number(a)-Number(b)).map(([factor,t])=>num(Number(factor),1)+'× rates: '+(t===null?'not reached':num(t)+' s')).join(' · ')+
      ' '+badge(M.extrapolated)+'</p>':'';
    if(shouldScroll)$('ignition').scrollIntoView({block:'start'});
  }
  function evidence() {
    const chain=[
      {title:'Fabrics, fasteners and tape',keys:['NOMEX','P213'],experiments:['PSI-26','PSI-25','PSI-98','PSI-99','PSI-100'],
       body:'BASS and BASS-II tested extinction in orbit. Saffire recorded fire growth on larger samples. ICES and LUCI supply short lunar-gravity comparisons.',
       gap:'The spread rate in the exploration atmosphere remains unknown.',papers:['ices','luci']},
      {title:'Window and housing plastics',keys:['PMMA','PC'],experiments:['PSI-25'],
       body:'BASS-II flew PMMA films. ICES compared the lunar limits of acrylic, tape and polycarbonate. FLINT applies the thin-solid model to the case inventory.',
       gap:'Thick-window behaviour needs a matching test.',papers:['ices']},
      {title:'Wiring smoke',experiments:['PSI-102','PSI-101'],body:'SAME and SAME-R measured smoke particles from heated spacecraft materials in orbit.',
       gap:'Detector selection uses the flight measurements. FLINT has no lunar smoke-transport or detector model.'},
      {title:'Liquid leak',experiments:['PSI-69','PSI-39'],body:'FLEX measured droplet burning, extinction and suppression. CFI investigated cool flames.',
       gap:'Droplets in lunar gravity remain outside the flown domain.',url:'flint.html#freefall',link:'FLEX results and suppressant bias'},
      {title:'Gas leak',experiments:['PSI-159'],body:'A held-out test on CFI-G found that the archived fields could not predict hot ignition.',
       gap:'Igniter energy and fuel flow are unresolved. FLINT returns no ignition probability.',url:'flint.html#freefall',link:'Read the tested negative'},
      {title:'Suppression and crew response',experiments:['PSI-69','PSI-98','PSI-99','PSI-100'],body:'FLEX informs suppressant behaviour in droplet flames. Saffire shows how fires grow before response. FLINT computes the rover’s gas-addition and venting endpoints.',
       gap:'A vent-while-burning experiment at lunar gravity would test the calculated thresholds.',papers:['fm2','ices']},
    ];
    const papers={ices:['ICES-2025-392','20250002114'],luci:['LUCI','20250010653'],fm2:['FM² briefing, p. 25','20260001966']};
    const active=c=>c.keys?.includes(selectedItem().material)||false;
    const cards=chain.sort((a,b)=>Number(active(b))-Number(active(a))).map(c=>{
      const links=c.experiments.map(id=>{
        const s=data.investigations[id];return '<a href="'+html(s.url)+'">'+html(s.name)+' ('+id+')</a>';
      });
      for(const k of c.papers||[])links.push('<a href="https://ntrs.nasa.gov/citations/'+papers[k][1]+'">'+papers[k][0]+'</a>');
      if(c.url)links.push('<a href="'+c.url+'">'+c.link+'</a>');
      return '<article class="'+(active(c)?'current':'')+'"><h3>'+c.title+'</h3><p>'+c.body+'</p><p><small>'+c.gap+'</small></p><p>'+links.join(' · ')+'</p></article>';
    });
    $('evidence-chain').innerHTML='<div class="evidence-grid">'+cards.join('')+'</div>';
  }
  function render() {
    rows=items.map(it=>M.assess(cabin,it));doses=M.responses(cabin,selectedItem());
    renderFocus();renderInventory();renderTrade();renderDoses();evidence();
    MaterialCaseLink.update({place:cabin.gravity, pressurePsia:cabin.P_psia, oxygenPct:cabin.X_O2*100,
      fanCmS:cabin.fan_m_s*100, composition:{[unknown(selectedItem()) ? 'OTHER' : selectedItem().material]:100}}, 'rover-case', candidateSpecimen);
  }
  function setPreset(i) {
    const p=reference.trade[i];
    cabin={...cabin,P_psia:p.P_psia,X_O2:p.X_O2};
    syncControls();resetTimeline();render();$('input-status').textContent='Applied '+p.atmosphere+'.';
  }
  $('preset').onchange=()=>{
    if($('preset').value==='custom'){$('pressure').focus();return;}
    const p=reference.trade[+$('preset').value];
    $('pressure').value=p.P_psia;$('oxygen').value=+(100*p.X_O2).toFixed(8);
    $('case-form').requestSubmit();
  };
  for(const id of ['pressure','oxygen'])$(id).oninput=()=>{$('preset').value='custom';};
  $('case-form').onsubmit=e=>{
    e.preventDefault();
    cabin={...cabin,P_psia:$('pressure').valueAsNumber,X_O2:$('oxygen').valueAsNumber/100,
           volume_m3:$('volume').valueAsNumber,fan_m_s:$('fans').valueAsNumber/100,gravity:$('gravity').value};
    syncControls();resetTimeline();render();$('input-status').textContent='Updated cabin conditions.';
  };
  $('item-material').onchange=()=>{
    const exemplar=data.inventory.find(it=>it.material===$('item-material').value);
    $('item-area').value=exemplar?.area_m2??'';$('item-density').value=exemplar?.areal_density??'';
  };
  $('item-form').onsubmit=e=>{
    e.preventDefault();const name=$('item-name').value.trim();
    if(!name){$('item-status').textContent='Enter a name for this item.';return;}
    const material=$('item-material').value;
    items.push({name, material, where:'Added inventory item',area_m2:$('item-area').valueAsNumber,
                areal_density:$('item-density').valueAsNumber});
    $('item-name').value='';pick(items.length-1);$('item-status').textContent='Added '+name+'.';
  };
  $('reset-case').onclick=()=>{
    candidateSpecimen = null;
    cabin={...defaults};items=structuredClone(data.inventory);selected=0;
    syncControls();resetTimeline();render();$('input-status').textContent='Restored the nominal lunar cabin.';
    $('item-status').textContent='';
  };
  $('ignite').onclick=()=>ignite(true);$('ignite-here').onclick=()=>ignite(false);
  $('response').onchange=showResponse;$('vent-target').oninput=showResponse;
  $('time').oninput=()=>{stop();renderTime();};
  $('play').onclick=()=>{
    if(timer){stop();return;}
    if(+$('time').value===+$('time').max)$('time').value=0;
    $('play').textContent='Pause timeline';
    timer=setInterval(()=>{
      $('time').value=Math.min(+$('time').max,+$('time').value+2);renderTime();
      if(+$('time').value===+$('time').max)stop();
    },80);
  };
  reference.trade.forEach((r,i)=>option($('preset'),i,r.atmosphere));
  option($('preset'),'custom','Custom atmosphere');
  Object.keys(data.gravity).forEach(g=>option($('gravity'),g,gravNames[g]));
  for(const [k,v] of Object.entries(data.fuels))option($('item-material'),k,v.name);
  option($('item-material'),'OTHER','Other · not calibrated');$('item-material').onchange();
  const positions=[[31,45],[45,29],[69,47],[49,64]];
  data.inventory.forEach((it,i)=>{
    const pin=document.createElement('button');pin.type='button';pin.className='pin';pin.textContent=short[it.material];
    pin.setAttribute('aria-label','Select '+it.name);pin.onclick=()=>pick(i);
    pin.style.left=positions[i][0]+'%';pin.style.top=positions[i][1]+'%';
    $('scene-pins').append(pin);pins.push(pin);
  });
  const received = MaterialCaseLink.imported;
  if (received) {
    cabin = {...cabin, gravity:received.place, P_psia:received.pressurePsia, X_O2:received.oxygenPct/100, fan_m_s:received.fanCmS/100};
    const pure = Object.keys(received.composition).find(key => received.composition[key] === 100);
    const match = items.findIndex(item => item.material === pure);
    if (match >= 0) selected = match;
    // Preserve an imported case that extends beyond the default form ranges.
    $('fans').max = Math.max(Number($('fans').max), received.fanCmS);
    $('oxygen').min = Math.min(Number($('oxygen').min), received.oxygenPct);
    $('oxygen').max = Math.max(Number($('oxygen').max), received.oxygenPct);
  }
  syncControls();resetTimeline();render();$('startup').hidden=true;
  import('./rover-fire-scene.mjs').then(({mountCabin})=>{
    repaintScene=mountCabin($('scene'),pins,()=>rows.map(a=>a[1]),pick);
    $('scene-holder').classList.add('ready');$('scene-mode').textContent='Drag to rotate · select a material';
  }).catch(()=>{
    $('scene').hidden=true;$('scene-mode').textContent='Illustration · select a material';
  });
})();
