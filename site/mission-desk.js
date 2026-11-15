/* Evidence that can travel with a rule, and the measurement needed to test its transfer. */
(() => {
  'use strict';
  const studies = () => Object.fromEntries(window.FF.cases.map(c => [c.id, c]));
  const mir = ['NASA · Combustion Experiments on Mir, p. 5','https://www.nasa.gov/wp-content/uploads/static/history/SP-4225/science/combustion-summary.pdf#page=5'];
  const scale = ['Urban et al. · Saffire results, p. 8, Table 2 and Figure 10','https://ntrs.nasa.gov/api/citations/20210011521/downloads/ICES%202021-266%200503-2021%20final.pdf#page=8'];
  const rules = [
    {q:'Does an Earth oxygen limit bound flammability in reduced gravity?',id:'ices',domain:'Material screening', setting:'Glenn drop-tower centrifuge · simulated lunar gravity', sourceIndexes:[0,1],
     scope:['Unresolved','Counterexample','Unresolved'],evidence:'At 8.2 psia, P213 tape extinguished at a lower oxygen concentration than the 1 g forced-flow extrapolation. Polycarbonate extinguished at a higher concentration than the measured ground values. These comparisons used a five-second flame endpoint. ICES Fig. 13 and the single-material figures disagree on some lunar limits. FLINT uses Fig. 13, repeats the comparison with the alternate readings, and excludes cotton.',
     missing:'Match the material, flow, pressure, exposure time and ignition protocol before transferring a limiting-oxygen measurement.'},
    {q:'Will switching off ventilation extinguish a flame?',id:'sibal',domain:'Suppression',setting:'Mir · orbital microgravity',source:mir,
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'On Mir, stopping forced flow extinguished the tested solid flames. Candle flames persisted in quiet air. Fuel and geometry change the answer even in orbit.',
     missing:'Measure local flow and post-shutdown extinction for the same fuel. Under partial gravity, buoyancy can move gas with the fan off.'},
    {q:'Can a small coupon stand in for a large fire?',id:'saffire',domain:'Scale',setting:'Saffire I–III · orbital microgravity',source:scale,
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'Saffire recorded different peak flame sizes in different specimen and duct configurations. The narrow Saffire-II samples missed the transient overshoot seen in Saffire-I and III.',
     missing:'Vary length, width and duct height separately. Record the peak as well as steady spread before scaling from a coupon to a cabin.'},
    {q:'Does the end of visible light mean combustion stopped?',id:'flex',domain:'Extinction',setting:'FLEX-155 · orbital microgravity',
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'In FLEX-155 the heptane droplet continued to vaporize after the visible flame vanished. Investigators interpreted the later behavior as cool-flame combustion.',
     missing:'Track droplet diameter, temperature and gas composition after visible extinction. Verify the same endpoint in the target gravity.'},
    {q:'Can one detector response represent every smoke source?',id:'same',domain:'Detection',setting:'SAME · detector measurements in orbit',
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'SAME detector signals depended on the material generating the smoke. A strong response to silicone rubber did not establish response to small particles from Teflon.',
     missing:'Hold the detector and threshold fixed. Compare particle-size distributions and transport times for each source.'},
    {q:'Does slower spread mean a shorter-lasting fire?',id:'sibal',domain:'Duration',setting:'LUCI rotating rocket · simulated lunar gravity',
     scope:['Unresolved','Counterexample','Unresolved'],evidence:'In the LUCI rotating-flight comparison, the SIBAL flame spread more slowly in simulated lunar gravity and burned about 45 seconds longer than its ground counterpart.',
     missing:'Measure spread speed and time to extinction separately, with matched oxygen histories. The comparison was a lunar-gravity analogue aboard a rocket.'},
    {q:'Can a burner oxygen reading represent the cabin air?',id:'cfig',domain:'Atmosphere',setting:'CFI-G inverse flames · orbital microgravity',sourceIndexes:[0,1],
     scope:['Counterexample','Unresolved','Unresolved'],evidence:'In the inverse CFI-G configuration the oxygen mixture flowed from the burner into a fuel-containing chamber. The two gas locations describe different exposures.',
     missing:'Record the chamber gas and burner stream separately. Obtain a material test at the target ambient oxygen, pressure and gravity.'}
  ];
  const applications = [
    {id:'crew',title:'Gaganyaan',tag:'Crew cabin',question:'What must match before comparing two cabin atmospheres?',body:'ISRO’s crew-module pressure control system regulates total pressure and oxygen partial pressure. A material comparison also needs oxygen fraction, ignition conditions and ventilation at the specimen.',test:'Recover both pressure and oxygen fraction for each source row. Record the flow and specimen type before drawing a comparison.',source:['ISRO · ECLSS requirements, introduction','https://www.isro.gov.in/media_isro/pdf/Tenders/2024/44_Tender_Document1602424.pdf'],route:'#compass',action:'Compare habitat conditions'},
    {id:'wire',title:'Wire insulation'},
    {id:'ward',title:'Hospital oxygen wards',tag:'Oxygen enrichment',question:'What transfers from a spacecraft fabric test to a hospital?',body:'Medical oxygen supports combustion. In a published surgical incident, oxygen delivery, an electric scalpel and a burning drape came together locally. A spacecraft chamber average cannot supply the oxygen concentration at that drape.',test:'Use a measured local gas concentration and the actual fabric and ignition geometry. A clinical safety decision belongs to the applicable medical guidance.',source:['WHO · Medical oxygen fire risk','https://www.who.int/publications/m/item/medical-oxygen-fire-risk-mitigation-measures'],extra:['Original incident report','https://pubmed.ncbi.nlm.nih.gov/22656688/'],route:'#case/ices',action:'Compare material evidence'},
    {id:'mine',title:'Mines',tag:'Smoke transport',question:'Would the same detector give the same warning underground?',body:'NIOSH reports that mine ventilation can carry smoke and toxic gases downstream. A detector threshold measured with a laboratory smoke source cannot establish how long it takes that smoke to reach a sensor in a mine.',test:'Measure the ventilation path, velocity, source and sensor response separately.',source:['NIOSH · Mining fires and explosions','https://www.cdc.gov/niosh/mining/topics/fires-explosions.html'],route:'#case/same',action:'Inspect the detector experiment'},
    {id:'aircraft',title:'Aircraft',tag:'Material configuration',question:'Does a coupon result apply to a finished cabin panel?',body:'FAA test methods distinguish material, orientation, heat release, smoke and the assembled article. Saffire-II shows why a burn duration recorded for a composite specimen needs a component-level interpretation.',test:'Match the cabin material assembly and the measured endpoint to the applicable aircraft test.',source:['FAA · Material test criteria, Appendix A','https://www.fire.tc.faa.gov/pdf/TC-17-46.pdf'],route:'#case/saffire',action:'Inspect the composite test'},
    {id:'sub',title:'Submarines',tag:'Compartment boundaries',question:'Can one compartment reading characterize a vessel?',body:'Navy damage-control guidance calls for monitoring spaces next to the affected compartment. A well-mixed calculation has a single gas concentration. It cannot resolve a blocked passage or a remote smoke pocket.',test:'Compare readings at different locations and document the ventilation and compartment boundaries.',source:['U.S. Navy · Shipboard organization and regulations','https://www.med.navy.mil/Portals/62/Documents/NMFA/NMCPHC/root/Field%20Activities/Pages/NEPMU6/Operational%20Support/Environmental%20Health/OPNAVINST-3120-32.pdf'],route:'#physics',action:'Inspect the mixing assumptions'}
  ];
  const esc = value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const link = ([name,url])=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(name)+' ↗</a>';
  const wireSetups = [
    {
      id:'centrifuge', label:'Rotating chamber', metric:'52 rpm', condition:'55 mm from the rotation axis',
      method:'During the aircraft’s near-weightless phase, rotation produced 0.166 g at the wire. Tracer particles in Figure 9 show hot gases circulating around the shaft.',
      result:'During flame spread on the copper wire, chamber pressure kept rising (Figure 7b). The authors propose that recirculating gases warmed the flame region and helped spread persist.'
    },
    {
      id:'parabola', label:'Nonrotating chamber', metric:'0 rpm', condition:'Aircraft trajectory supplies 0.166 g',
      method:'The aircraft flew a lunar-gravity parabola with the chamber stationary. The hot plume rose toward the shaft, which drew heat from the gas.',
      result:'Chamber pressure stayed relatively steady as the flame spread along the copper wire (Figure 7a). The two pressure traces show how the apparatus changed conditions around the wire.'
    },
    {
      id:'test4', label:'NASA wire test', metric:'15°', condition:'Wire angle from vertical',
      method:'NASA-STD-6001B, Change 3, Test 4 specifies five equivalent wire specimens. Each is ignited at the bottom in the worst anticipated atmosphere.',
      result:'Test 4 records burn length and whether burning debris ignites paper. Those measurements are needed to assess a wire under this protocol. The aircraft study measured flame spread in a laboratory chamber.'
    }
  ];
  function wireComparison(article,params) {
    const paper = ['Konno et al. (2026) · Table 1 and Figures 7, 9, 14','https://doi.org/10.1016/j.combustflame.2026.114800'];
    const jaxa = ['JAXA · apparatus and findings','https://humans-in-space.jaxa.jp/kibouser/pickout/74526.html'];
    const standard = ['NASA-STD-6001B · section 7.4','https://standards.nasa.gov/sites/default/files/standards/NASA/B-w/CHANGE-3/3/2025_06_25_NASA-STD-6001B_w_Change_3_FINAL_Admin-Change-FINAL.pdf#page=31'];
    article.innerHTML = `
      <header><span class="eyebrow">JAXA and Hokkaido University · 2026</span><h2>Does matching lunar gravity reproduce a wire fire?</h2></header>
      <p>At the same nominal 0.166 g, flame spread was easier to sustain in a rotating chamber than in the nonrotating aircraft test. The researchers tested 0.5 mm copper and nichrome cores with 0.15 mm of low-density polyethylene insulation.</p>
      <label class="field wire-control">Compare the test setup
        <select aria-controls="wire-result">${wireSetups.map(setup=>'<option value="'+setup.id+'">'+setup.label+'</option>').join('')}</select>
      </label>
      <div class="wire-result" id="wire-result" aria-live="polite" aria-atomic="true"></div>
      <div class="note"><strong>What would transfer to a lunar habitat?</strong><p>Record how gravity was produced, where the wire sat and how hot gas moved before using an extinction result. The lunar-gravity runs were too few to establish a nichrome-wire flammability limit. A fabric or cable bundle would need its own geometry and test.</p></div>
      <p class="wire-sources">${link(paper)} · ${link(jaxa)} · ${link(standard)}</p>`;
    const select = article.querySelector('select');
    const output = article.querySelector('#wire-result');
    const initial = wireSetups.find(setup=>setup.id===params.get('setup')) || wireSetups[0];
    function show(setup) {
      output.innerHTML = `<div class="wire-setting"><strong>${setup.metric}</strong><span>${setup.condition}</span></div>
        <div class="wire-description"><h3>${setup.label}</h3><p>${setup.method}</p><p>${setup.result}</p></div>`;
    }
    select.value = initial.id;
    show(initial);
    select.onchange = () => {
      const setup = wireSetups[select.selectedIndex];
      show(setup);
      const query = new URLSearchParams(params);
      query.set('setup',setup.id);
      history.replaceState(history.state,'','#earth?'+query);
    };
  }
  const worlds = ['Orbit', 'Moon', 'Mars'];
  const regimes = ['Orbital microgravity', 'Moon gravity', 'Mars gravity'];

  function selectedRule(params) {
    const entry = params.get('entry');
    const regime = params.get('regime');
    const target = worlds.findIndex(world => world.toLowerCase() === (params.get('world') || '').toLowerCase());
    return {
      entry: /^[0-6]$/.test(entry) ? Number(entry) : 0,
      regime: /^[0-2]$/.test(regime) ? Number(regime) : target >= 0 ? target : 1
    };
  }

  function cabinFromQuery(params) {
    function value(key, min, max) {
      const raw = params.get(key)?.trim() || '';
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n >= min && n <= max ? raw : null;
    }
    // Preserve the Compass input range. The rover checks its own narrower model limits.
    const oxygen = value('oxygen', 0, 100), psia = value('psia', 0.01, 100);
    if (oxygen === null || psia === null) return null;
    const cabin = {oxygen, psia};
    for (const key of ['subject','material']) {
      const text = params.get(key)?.trim();
      if (text) cabin[key] = text.slice(0,120);
    }
    return cabin;
  }

  function rulebook(root, params = new URLSearchParams((location.hash.split('?')[1] || ''))) {
    root.innerHTML='<div class="breadcrumb"><a href="#home">Research desk</a> / The Audit</div><header class="pagetitle"><span class="eyebrow">The Audit</span><h1>Rulebook</h1><p class="sub">Choose a question and gravity setting to see where the supporting test took place and what remains to be measured.</p></header><div class="actions"><a class="ghost" href="#passports">Investigation passports →</a><a class="ghost" href="#referee">Open the Referee →</a><a class="ghost" href="#earth?case=wire">Compare lunar-gravity wire tests →</a></div><div class="section rule-layout"><div class="panel tablewrap"><table class="rules"><caption>Evidence for seven research questions</caption><thead><tr><th scope="col">Research question</th><th scope="col">Orbit</th><th scope="col">Moon gravity</th><th scope="col">Mars gravity</th></tr></thead><tbody></tbody></table></div><section class="panel stack" id="rule-reading" aria-live="polite" aria-atomic="true"></section></div>';
    const tbody=root.querySelector('tbody'), reading=root.querySelector('#rule-reading');
    const initial = selectedRule(params), cabin = cabinFromQuery(params);
    function select(entry, regime, button, remember) {
      const rule = rules[entry], world = worlds[regime], status = rule.scope[regime];
      const previous = tbody.querySelector('[aria-pressed="true"]');
      if (previous === button) return;
      previous?.setAttribute('aria-pressed','false');
      button.setAttribute('aria-pressed','true');
      const researchCase = studies()[rule.id];
      const sources = rule.source ? [rule.source] : (rule.sourceIndexes || [0]).map(i => {
        const source = researchCase.sources[i];
        return [source.title, source.url];
      });
      const target = regime === 0 ? 'orbital microgravity' : world === 'Moon' ? 'lunar gravity' : 'Martian gravity';
      const conclusion = status === 'Unresolved'
        ? 'The cited comparison leaves this question open for '+target+'.'
        : regime === 1 ? 'A simulated lunar-gravity experiment found a counterexample. Application to a lunar habitat still requires matched conditions.'
        : 'A flight experiment found a counterexample under its recorded conditions.';
      const search = new URLSearchParams(params);
      search.set('entry',String(entry)); search.set('regime',String(regime));
      if (search.has('world')) search.set('world',world);
      if (search.has('gravity')) search.set('gravity',['0','0.165','0.38'][regime]);
      const rover = new URLSearchParams({from:'rulebook',world,case:rule.id});
      for (const key of ['oxygen','psia','subject','material']) {
        if (cabin && key in cabin) {
          search.set(key, cabin[key]);
          rover.set(key, cabin[key]);
        } else search.delete(key);
      }
      const hash = '#rulebook?'+search;
      reading.innerHTML='<div><span class="eyebrow">'+regimes[regime]+' · '+rule.domain+'</span><h2>'+rule.q+'</h2></div>'+
        '<p class="rule-conclusion"><strong>'+status+'</strong> · '+conclusion+'</p>'+
        '<div><h3>Where the evidence comes from</h3><p><strong>'+rule.setting+'</strong></p><p>'+rule.evidence+'</p></div>'+
        '<div class="note"><strong>Next measurement</strong><p>'+rule.missing+'</p></div>'+
        '<div class="sourceitem">'+sources.map(link).join('<br>')+'</div>'+
        '<div class="actions"><a class="ghost" href="#case/'+rule.id+'">Related research case →</a></div>';
      if (cabin || params.has('oxygen') || params.has('psia')) {
        const context = document.createElement('aside');
        context.className = 'note';
        context.setAttribute('aria-label','Your cabin scenario');
        const heading = document.createElement('strong'); heading.textContent = 'Your cabin scenario';
        const atmosphere = document.createElement('p');
        atmosphere.textContent = cabin
          ? world+' · '+cabin.oxygen+'% oxygen · '+cabin.psia+' psia absolute. These are your comparison inputs.'
          : 'To carry cabin air into the rover, supply both an oxygen fraction (0–100%) and an absolute pressure (0.01–100 psia). Only the gravity setting will transfer.';
        context.append(heading, atmosphere);
        if (cabin?.subject || cabin?.material) {
          const filters = document.createElement('p');
          filters.textContent = 'Archive search filters: '+[cabin.subject,cabin.material].filter(Boolean).join(' · ');
          context.append(filters);
        }
        reading.querySelector('.rule-conclusion').after(context);
      }
      const activity = document.createElement('a'); activity.className='ghost';
      activity.href = '#rover-design?'+rover;
      activity.textContent = 'Open the rover model with '+(cabin ? 'this cabin atmosphere' : (world === 'Orbit' ? 'orbital' : world === 'Moon' ? 'lunar' : 'Martian')+' gravity')+' →';
      reading.querySelector('.actions').append(activity);
      const permalink = document.createElement('a'); permalink.className='inlinebtn';
      permalink.href=hash; permalink.textContent='Link to this finding'; reading.append(permalink);
      if (remember && location.hash.split('?')[0] === '#rulebook') history.replaceState(history.state,'',hash);
    }
    let selectedButton;
    rules.forEach((rule,entry)=>{
      const tr=tbody.insertRow(), th=document.createElement('th'); th.scope='row'; th.textContent=rule.q;tr.append(th);
      rule.scope.forEach((status,regime)=>{
        const b=document.createElement('button'); b.type='button';
        b.textContent=status === 'Counterexample' && regime === 1 ? 'Analogue counterexample' : status;
        b.className='rule-verdict';
        b.setAttribute('aria-label',regimes[regime]+' · '+rule.q+' '+b.textContent);
        b.setAttribute('aria-controls','rule-reading'); b.setAttribute('aria-pressed','false');
        b.onclick=()=>select(entry,regime,b,true);
        tr.insertCell().append(b);
        if(entry===initial.entry && regime===initial.regime)selectedButton=b;
      });
    });
    select(initial.entry,initial.regime,selectedButton,false);
  }
  function earth(root,p) {
    const item=applications.find(x=>x.id===p.get('case'))||applications[0];
    root.innerHTML='<div class="breadcrumb"><a href="#home">Research desk</a> / At Home</div><header class="pagetitle"><span class="eyebrow">At Home</span><h1>Fire research on Earth</h1><p class="sub">Follow a spacecraft result into a crew cabin, a ward or a confined space. See which measurement you would need before using it there.</p></header><div class="earth-layout"><nav aria-label="Applications">'+applications.map(x=>'<a href="#earth?case='+x.id+'" '+(x===item?'aria-current="page"':'')+'>'+x.title+'</a>').join('')+'</nav><article class="panel stack"></article></div>';
    const article = root.querySelector('article');
    if (item.id==='wire') {
      wireComparison(article,p);
      return;
    }
    article.innerHTML='<div><span class="eyebrow">'+item.tag+'</span><h2>'+item.question+'</h2></div><p>'+item.body+'</p><div class="note"><strong>What to measure</strong><p>'+item.test+'</p></div><p>'+link(item.source)+(item.extra?' · '+link(item.extra):'')+'</p><div class="actions"><a class="btn" href="'+item.route+'">'+item.action+' →</a></div>';
  }
  window.FFMissionDesk={rulebook,earth,rules};
})();
