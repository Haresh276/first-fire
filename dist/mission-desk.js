/* Evidence that can travel with a rule, and the measurement needed to test its transfer. */
(() => {
  'use strict';
  const studies = () => Object.fromEntries(window.FF.cases.map(c => [c.id, c]));
  const mir = ['NASA · Combustion Experiments on Mir, p. 5','https://www.nasa.gov/wp-content/uploads/static/history/SP-4225/science/combustion-summary.pdf#page=5'];
  const scale = ['NASA · Saffire results, Table 2 and Figure 10','https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf'];
  const rules = [
    {q:'Does passing an Earth test bound flammability?',id:'ices',domain:'Material screening',
     scope:['Unresolved','Counterexample','Unresolved'],evidence:'In short lunar-gravity tests, P213 tape and polycarbonate fell on opposite sides of their Earth comparators. An Earth oxygen limit cannot serve as a universal bound.',
     missing:'Match the material, flow, pressure, exposure time and ignition protocol before transferring a limiting-oxygen measurement.'},
    {q:'Will switching off ventilation extinguish a flame?',id:'sibal',domain:'Suppression',source:mir,
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'On Mir, stopping forced flow extinguished the tested solid flames. Candle flames persisted in quiet air. Fuel and geometry change the answer even in orbit.',
     missing:'Measure local flow and post-shutdown extinction for the same fuel. Under partial gravity, buoyancy can move gas with the fan off.'},
    {q:'Can a small coupon stand in for a large fire?',id:'saffire',domain:'Scale',source:scale,
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'Saffire recorded different peak flame sizes in different specimen and duct configurations. The narrow Saffire-II samples missed the transient overshoot seen in Saffire-I and III.',
     missing:'Vary length, width and duct height separately. Record the peak as well as steady spread before scaling from a coupon to a cabin.'},
    {q:'Does the end of visible light mean combustion stopped?',id:'flex',domain:'Extinction',
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'In FLEX-155 the heptane droplet continued to vaporize after the visible flame vanished. Investigators interpreted the later behavior as cool-flame combustion.',
     missing:'Track droplet diameter, temperature and gas composition after visible extinction. Verify the same endpoint in the target gravity.'},
    {q:'Can one detector response represent every smoke source?',id:'same',domain:'Detection',
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'SAME detector signals depended on the material generating the smoke. A strong response to silicone rubber did not establish response to small particles from Teflon.',
     missing:'Hold the detector and threshold fixed. Compare particle-size distributions and transport times for each source.'},
    {q:'Does slower spread mean a shorter-lasting fire?',id:'sibal',domain:'Duration',
     scope:['Unresolved','Counterexample','Unresolved'],evidence:'In the LUCI rotating-flight comparison, the SIBAL flame spread more slowly in simulated lunar gravity and burned about 45 seconds longer than its ground counterpart.',
     missing:'Measure spread speed and time to extinction separately, with matched oxygen histories. The comparison was a lunar-gravity analogue aboard a rocket.'},
    {q:'Can a burner oxygen reading represent the cabin air?',id:'cfig',domain:'Atmosphere',
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'In the inverse CFI-G configuration the oxygen mixture flowed from the burner into a fuel-containing chamber. The two gas locations describe different exposures.',
     missing:'Record the chamber gas and burner stream separately. Obtain a material test at the target ambient oxygen, pressure and gravity.'}
  ];
  const applications = [
    {id:'crew',title:'Gaganyaan',tag:'Crew cabin',question:'What must match before comparing two cabin atmospheres?',body:'ISRO’s crew-module pressure control system regulates total pressure and oxygen partial pressure. A material comparison also needs oxygen fraction, ignition conditions and ventilation at the specimen.',test:'Recover both pressure and oxygen fraction for each source row. Record the flow and specimen type before drawing a comparison.',source:['ISRO · ECLSS requirements, introduction','https://www.isro.gov.in/media_isro/pdf/Tenders/2024/44_Tender_Document1602424.pdf'],route:'#compass',action:'Compare habitat conditions'},
    {id:'ward',title:'Hospital oxygen wards',tag:'Oxygen enrichment',question:'What transfers from a spacecraft fabric test to a hospital?',body:'Medical oxygen supports combustion. In a published surgical incident, oxygen delivery, an electric scalpel and a burning drape came together locally. A spacecraft chamber average cannot supply the oxygen concentration at that drape.',test:'Use a measured local gas concentration and the actual fabric and ignition geometry. A clinical safety decision belongs to the applicable medical guidance.',source:['WHO · Medical oxygen fire risk','https://www.who.int/publications/m/item/medical-oxygen-fire-risk-mitigation-measures'],extra:['Original incident report','https://pubmed.ncbi.nlm.nih.gov/22656688/'],route:'#case/ices',action:'Compare material evidence'},
    {id:'mine',title:'Mines',tag:'Smoke transport',question:'Would the same detector give the same warning underground?',body:'NIOSH reports that mine ventilation can carry smoke and toxic gases downstream. A detector threshold measured with a laboratory smoke source cannot establish how long it takes that smoke to reach a sensor in a mine.',test:'Measure the ventilation path, velocity, source and sensor response separately.',source:['NIOSH · Mining fires and explosions','https://www.cdc.gov/niosh/mining/topics/fires-explosions.html'],route:'#case/same',action:'Inspect the detector experiment'},
    {id:'aircraft',title:'Aircraft',tag:'Material configuration',question:'Does a coupon result apply to a finished cabin panel?',body:'FAA test methods distinguish material, orientation, heat release, smoke and the assembled article. Saffire-II shows why a burn duration recorded for a composite specimen needs a component-level interpretation.',test:'Match the cabin material assembly and the measured endpoint to the applicable aircraft test.',source:['FAA · Material test criteria, Appendix A','https://www.fire.tc.faa.gov/pdf/TC-17-46.pdf'],route:'#case/saffire',action:'Inspect the composite test'},
    {id:'sub',title:'Submarines',tag:'Compartment boundaries',question:'Can one compartment reading characterize a vessel?',body:'Navy damage-control guidance calls for monitoring spaces next to the affected compartment. A well-mixed calculation has a single gas concentration. It cannot resolve a blocked passage or a remote smoke pocket.',test:'Compare readings at different locations and document the ventilation and compartment boundaries.',source:['U.S. Navy · Shipboard organization and regulations','https://www.med.navy.mil/Portals/62/Documents/NMFA/NMCPHC/root/Field%20Activities/Pages/NEPMU6/Operational%20Support/Environmental%20Health/OPNAVINST-3120-32.pdf'],route:'#physics',action:'Inspect the mixing assumptions'}
  ];
  const esc = value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const link = ([name,url])=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+' ↗</a>';
  function rulebook(root) {
    root.innerHTML='<div class="breadcrumb"><a href="#home">Research desk</a> / The Audit</div><header class="pagetitle"><span class="eyebrow">The Audit</span><h1>Rulebook</h1><p class="sub">Which fire-safety assumptions survive a change in gravity? Select a finding to inspect the evidence and the next measurement.</p></header><div class="actions"><a class="ghost" href="#passports">Investigation passports →</a><a class="ghost" href="#referee">Open the Referee →</a></div><div class="section rule-layout"><div class="panel tablewrap"><table class="rules"><caption>Evidence for seven research questions</caption><thead><tr><th>Research question</th><th>Orbit</th><th>Moon gravity</th><th>Mars gravity</th></tr></thead><tbody></tbody></table></div><section class="panel stack" id="rule-reading" aria-live="polite"></section></div>';
    const tbody=root.querySelector('tbody'), reading=root.querySelector('#rule-reading');
    const regimes=['Orbit','Moon gravity','Mars gravity'];
    rules.forEach((rule,i)=>{
      const tr=tbody.insertRow(), th=document.createElement('th'); th.scope='row'; th.textContent=rule.q;tr.append(th);
      rule.scope.forEach((label,j)=>{
        const b=document.createElement('button');b.type='button';b.textContent=label;b.className='rule-verdict';
        b.setAttribute('aria-label',regimes[j]+' · '+rule.q+' '+label); b.setAttribute('aria-pressed','false');
        b.onclick=()=>{
          for(const old of tbody.querySelectorAll('[aria-pressed="true"]'))old.setAttribute('aria-pressed','false');
          b.setAttribute('aria-pressed','true');const c=studies()[rule.id], source=rule.source||[c.sources[0].title,c.sources[0].url];
          reading.innerHTML='<div><span class="eyebrow">'+regimes[j]+' · '+rule.domain+'</span><h2>'+rule.q+'</h2></div><strong>'+label+'</strong><p>'+(label==='Unresolved'?'The reviewed sources do not establish this claim in '+regimes[j].toLowerCase()+'. The closest comparison is below.':'This comparison challenges the general claim under the reported conditions.')+'</p><p>'+rule.evidence+'</p><div class="note"><strong>Next measurement</strong><p>'+rule.missing+'</p></div><p>'+link(source)+'</p><a href="#case/'+rule.id+'">Related research case →</a>';
        };
        tr.insertCell().append(b);if(i===0&&j===1)b.click();
      });
    });
  }
  function earth(root,p) {
    const item=applications.find(x=>x.id===p.get('case'))||applications[0];
    root.innerHTML='<div class="breadcrumb"><a href="#home">Research desk</a> / At Home</div><header class="pagetitle"><span class="eyebrow">At Home</span><h1>Fire research on Earth</h1><p class="sub">Follow a spacecraft result into a crew cabin, a ward or a confined space. See which measurement you would need before using it there.</p></header><div class="earth-layout"><nav aria-label="Applications">'+applications.map(x=>'<a href="#earth?case='+x.id+'" '+(x===item?'aria-current="page"':'')+'>'+x.title+'</a>').join('')+'</nav><article class="panel stack"><div><span class="eyebrow">'+item.tag+'</span><h2>'+item.question+'</h2></div><p>'+item.body+'</p><div class="note"><strong>What to measure</strong><p>'+item.test+'</p></div><p>'+link(item.source)+(item.extra?' · '+link(item.extra):'')+'</p><div class="actions"><a class="btn" href="'+item.route+'">'+item.action+' →</a></div></article></div>';
  }
  window.FFMissionDesk={rulebook,earth};
})();
