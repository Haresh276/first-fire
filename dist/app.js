(() => {
'use strict';
const root=document.getElementById('content');
const FF=window.FF;
if(!FF){root.textContent='The data files could not be opened. Keep index.html together with the other files in the download.';return;}
const cases=FF.cases.filter(c=>c.id!=='fm2');
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const out=(url,label)=>/^https?:\/\//i.test(url||'')?'<a href="'+attr(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>':esc(label);
const tagColor={sibal:'gold',saffire:'rose',flex:'blue',same:'',cfig:'blue',ices:'gold',fm2:'rose'};
const cardLabel={sibal:'Flame spread',saffire:'Ignition',flex:'Suppression',same:'Detection',cfig:'Atmosphere',ices:'Materials',fm2:'Forecast'};
const assetPage='https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/';
const PSI=i=>'https://psi.nasa.gov/physci/repo/data/investigations/PSI-'+i;
const linkbtn=(href,label,cls='ghost')=>'<a class="'+cls+'" href="'+attr(href)+'">'+esc(label)+'</a>';
const crumb=label=>'<div class="breadcrumb"><a href="#home">Research desk</a><span>/</span>'+esc(label)+'</div>';
function head(title,sub='',label=''){return '<div class="pagetitle">'+(label?'<span class="eyebrow">'+esc(label)+'</span>':'')+'<h1>'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+'</div>';}
const findCase=id=>FF.cases.find(c=>c.id===id);
const badge=(c)=>'<span class="tag '+tagColor[c.id]+'">'+esc(cardLabel[c.id])+'</span>';
function sourceList(sources){return sources.map(s=>'<div class="sourceitem">'+out(s.url,s.title)+'<small>'+esc(s.locator||s.supports||'')+'</small>'+(s.quote?'<blockquote>“'+esc(s.quote)+'”</blockquote>':'')+'</div>').join('');}
function cards(items){return '<div class="casegrid">'+items.map(c=>'<a class="card casecard" href="#case/'+c.id+'"><div class="topline">'+badge(c)+'<span class="catalognum">'+esc(c.short)+'</span></div><h3>'+esc(c.title)+'</h3><p>'+esc(c.question)+'</p><span aria-hidden="true" class="arrow">↗</span></a>').join('')+'</div>';}
function searchForm(q=''){return '<form class="searchform" id="query"><input type="search" aria-label="Search research evidence" name="q" maxlength="250" placeholder="Try “smoke from wire insulation”" value="'+attr(q)+'" required><button class="btn" type="submit">Search <span aria-hidden="true">↗</span></button></form>';}
function bindSearch(){const f=root.querySelector('#query');if(f) f.onsubmit=e=>{e.preventDefault();const q=f.q.value.trim();if(q)location.hash='search?q='+encodeURIComponent(q);};}
function home(){
const views=[
 ['#atlas','The Gap','Atlas & Compass','Inspect a NASA record or find the closest measured atmosphere.'],
 ['#rulebook','The Audit','Rulebook & Passports','Trace a fire-safety assumption to its experiment and limits.'],
 ['#forecast','The Oracle','Forecast & Next Fire','Inspect the four locked predictions and design a follow-up burn.'],
 ['#earth','At Home','Earth applications','Explore crew cabins, hospitals, mines and aircraft.']
];
root.innerHTML='<section class="hero mission-hero"><div class="herocopy"><span class="eyebrow">Spacecraft fire research</span><h1>Which fire tests can guide <em>a spacecraft crew?</em></h1><p>Choose a prevention, detection or suppression question. Rank NASA flight experiments by what they measured and take the source evidence into your next test.</p><div class="heroactions">'+linkbtn('evidence-guide.html?task=detection&question=transfer','Investigate a smoke detector →','btn')+linkbtn('detector-study.html','Replay the flight study')+linkbtn('judging.html','Open the Round 2 judging route')+'</div></div><figure class="heroimage"><img src="lunar-concept.jpg" alt="NASA concept rendering of a lunar lander on the Moon’s surface."><figcaption class="captionbar">'+out('https://ntrs.nasa.gov/api/citations/20260001966/downloads/Ferkul-Lunar%20and%20Planetary%20Science%20Conf%202026%20v2.pdf#page=6','Lunar mission concept · NASA')+'</figcaption></figure></section>'+
'<div class="ff-research-row">'+[['detector.html','Did the detector miss the smoke?','Inspect two instrument channels from the same NASA test.'],['#design-lab','Plan a lunar experiment','Choose an oxygen setting and write a test request for the lab.'],['classroom.html','Compare two alarm clocks','Match a NIST alarm record to its sensor readings in English or Telugu.']].map(([href,title,desc])=>'<a href="'+href+'"><strong>'+title+' ↗</strong><span>'+desc+'</span></a>').join('')+'</div>'+
'<div class="section actions">'+linkbtn('flint.html','FLINT, the engine')+linkbtn('cabin-fire.html','Cabin fire simulator')+linkbtn('material-lab.html','Material Lab')+linkbtn('#materials-lab','Explore material limits')+linkbtn('#master-physics','Validate cabin physics')+linkbtn('#field-guide','Field guide & judging kit')+linkbtn('judging-evidence.html','Evidence for ten awards')+'</div>'+
 '<nav aria-label="Research views" class="mission-views">'+views.map(([url,category,title,body])=>'<a class="panel" href="'+url+'"><span class="eyebrow">'+category+'</span><h2>'+title+'</h2><p>'+body+'</p></a>').join('')+'</nav>'+
'<div class="section actions">'+linkbtn('rover-fire-case.html','Pressurized Rover Fire Case')+linkbtn('#awareness','Your investigation')+linkbtn('#session','Run the investigation')+linkbtn('#transport-lab','Follow a tracer release')+linkbtn('#referee','Run the Referee')+linkbtn('#chat','Ask FIRST FIRE')+linkbtn('master-film.mp4','Watch the 30-second demo')+((location.protocol==='file:'||['localhost','127.0.0.1','[::1]'].includes(location.hostname))?'':linkbtn('offline.html','Download the offline edition'))+'</div>'+
'<section class="section"><div class="sectionhead"><div><span class="eyebrow">Case library</span><h2>Where comparisons go wrong</h2></div>'+linkbtn('#cases','All six cases →','inlinebtn')+'</div>'+cards(cases.filter(c=>['sibal','saffire','flex'].includes(c.id)))+'</section>'+
'<section class="section panel searchstrip"><div><h2>Find evidence</h2><p>Search cases and investigations by question.</p></div>'+searchForm()+'</section>'+
'<section class="section"><div class="toolsgrid">'+[['#chat','Ask the research desk','Ask a question, inspect its sources, and follow up in the same conversation.'],['#benchmark','Inspect the chat benchmark','Explore a hundred questions, the answers returned and which checks failed.'],['#claim','Check a research claim','Bring a statement, compare its conditions with a source and identify what remains open.'],['#acrylic','Try the acrylic exercise','See how changing from a rod to a panel changes what a study can tell you.'],['#coverage','Explore archive coverage','Find the measured conditions for a material phase and see what is missing.'],['#data?mode=rank','Compare mission conditions','See which observations match your material, atmosphere and gravity.'],['#forecast','Explore the FM² forecast','Change the oxygen threshold and compare model assumptions.'],['#study','Run a blind evaluation','Use a practice pack or enter a facilitator-led research session.']].map(([url,title,body])=>'<a class="panel toolcard" href="'+url+'"><h3>'+title+' ↗</h3><p>'+body+'</p></a>').join('')+'</div></section>';bindSearch();}
function library(){
 root.innerHTML=crumb('Cases')+head('Research cases','Follow a claim from a NASA measurement to a research decision. Each case includes six ranked design options.')+cards(cases)+'<div class="section callout"><strong>Prospective case study</strong> · <a href="#case/fm2">Four planned FM² burns</a></div><div class="section panel"><span class="eyebrow">Architecture review</span><h2>Which design fits each decision?</h2><p>Review the recommended approach across the six cases, then open the full ranking and acceptance checks.</p><div class="actions" style="margin-top:12px">'+linkbtn('#designs','Compare design decisions →','btn')+'</div></div>';
}
const sourceAlias=(c,i)=>c.sources[i]?.url;
const recordURL=(study,q)=>'#data?study='+encodeURIComponent(study)+'&q='+encodeURIComponent(q);
// Each change of question changes the evidential ranking. Observation labels, sources and endpoints are kept together.
function comparisons(c){
 const s=c.sources[0].url;
 const book={
 sibal:[
 ['How long did visible burning persist?','LUCI fabric observations','The long-duration test and its ground comparison observed visible extinction. In simulated lunar gravity it occurred about 45 seconds later.','Aircraft, day 2 / parabola 29','The fabric still burned at 20 seconds. Its lifetime in that run is at least the observation window.',s,sourceAlias(c,1)],
 ['How fast did the flame base spread early?','Aircraft, day 2 / parabola 29','A 5 cm strip burned downward at about 0.86 mm/s at lunar-equivalent gravity.','LUCI flight','The fitted base speed was 0.92 mm/s. This comparison addresses early spread in air.',sourceAlias(c,1),s.replace('#page=34','#page=19')]],
 saffire:[
 ['Did the Nomex ignite?','Saffire-II / sample 2-7','The fabric was damaged and blackened; investigators report no fabric ignition under these conditions.','Assembled sample / duration','The reported 140 s applies to the composite test. The upstream acrylic burned.',s,recordURL('PSI-99','2-7')],
 ['What burned in the assembly?','Saffire-II / component outcome','The upstream acrylic (PMMA) was consumed, exposing the adjacent Nomex to its flame.','Surface appearance','Blackening and burning are separate observations. The investigator report resolves the component outcome.',recordURL('PSI-99','2-7'),s]],
 flex:[
 ['Does the record support later cool-flame burning?','FLEX-155 / C03H201','The investigators interpreted the post-visible vaporization, plateau and cloud as evidence of cool-flame burning.','FLEX-120 / C12H201','The investigators described the cool-flame evidence as inconclusive. A cloud on its own cannot settle the question.',s,sourceAlias(c,1)],
 ['What was observed at visible extinction?','FLEX-155 / C03H201','The droplet measured 2.52 mm at visible extinction, down from 2.73 mm initially. The table lists a 2.7 s burn time.','Later chemical endpoint','A precise time at which all combustion stopped would require sufficient time-resolved diagnostics.',recordURL('PSI-69','C03H201'),s]],
 same:[
 ['Which material warrants a missed-alarm test?','Teflon / ISS light-scattering detector','Two-thirds of the Teflon tests fell below the ISS alarm threshold in the reported experiment.','Silicone rubber','A strong detector signal on silicone-rubber smoke does not establish sensitivity to Teflon smoke.',s,s],
 ['Can one sample determine detector reliability?','SAME-R / Teflon sample 56','The sample record describes the material and operating conditions. Figure 10 shows microscopy.','Detector response / Figure 9','Use the threshold comparison across tests for a statement about performance. A micrograph does not supply a per-run alarm verdict.',recordURL('PSI-101','PSI-101:1:74'),s]],
 cfig:[
 ['Which oxygen value describes the chamber?','Normal flame / 21088A1','This row reports 39.39% ambient oxygen. Its fuel and geometry still limit transfer to a fabric fire.','Inverse flame / 21202 A1','The 85% entry describes the burner stream. Ethane was present in the chamber.',recordURL('PSI-159','21088A1'),recordURL('PSI-159','21202 A1')],
 ['Did both inverse tests ignite?','Inverse flame / 21202 A2','Hot ignition was recorded, followed by self-extinction after 2 seconds.','Inverse flame / 21202 A1','The record reports no hot ignition despite the same 85% burner oxygen. The oxygen delivery rates differed.',recordURL('PSI-159','21202 A2'),recordURL('PSI-159','21202 A1')]],
 ices:[
 ['What happened to the P213 tape boundary?','P213 / lunar versus forced-flow extrapolation','The lunar extinction oxygen limit fell below the 1-g forced-flow extrapolation in this study.','Polycarbonate / ground measurements','The reported lunar extinction oxygen concentration lay above the WSTF measurements for this material. The Earth comparator differs. ICES Fig. 13 and the single-material figures disagree on some lunar limits. FLINT uses Fig. 13, repeats the comparison with the alternate readings, and excludes cotton.',s,sourceAlias(c,1)],
 ['Is Table 2 a direct lunar measurement?','Table 2 / engineering extrapolation','The table gives conservative calculated changes under its extrapolation assumptions.','Short partial-gravity tests','The centrifuge runs observe the flame over seconds. The local buoyant speed in lunar gravity remains uncertain.',sourceAlias(c,1),sourceAlias(c,4)]],
 fm2:[
 ['What has been observed on the Moon?','FM² / observed outcomes','No official lunar burn outcome is recorded in this edition.','FM² / design expectation','NASA’s qualitative expectations and the teaching model can be compared before any outcome is scored.',s,'#forecast'],
 ['Which probabilities belong to NASA?','LPSC / qualitative statement','The slides describe expected burn behavior. They do not publish a numeric probability vector.','Illustrative model','The four model probabilities follow from an assumed mean limiting oxygen of 26% and spread of 1.5 percentage points.',s,'#forecast']]};
 return book[c.id];
}
function actionLink(url){return url?.startsWith('#')?linkbtn(url,'Inspect record →','inlinebtn'):out(url,'Open source');}
const caseQuestions = new Map();
function comparisonState(c) {
  if (!caseQuestions.has(c.id)) {
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('first-fire:case-question:' + c.id)) || {}; } catch {}
    caseQuestions.set(c.id, {
      mode: saved.mode === 'custom' ? 'custom' : 'suggested',
      preset: Number.isInteger(saved.preset) ? saved.preset : 0,
      draft: typeof saved.draft === 'string' ? saved.draft.slice(0, 1000) : '',
      submitted: typeof saved.submitted === 'string' ? saved.submitted.slice(0, 1000) : ''
    });
  }
  return caseQuestions.get(c.id);
}
function saveComparison(c, state) {
  try { sessionStorage.setItem('first-fire:case-question:' + c.id, JSON.stringify(state)); } catch {}
}
function customSource(source) {
  const link = source.url?.startsWith('#')
    ? linkbtn(source.url, source.title, 'inlinebtn')
    : out(source.url, source.title);
  return '<div class="sourceitem">' + link +
    (source.locator ? '<small>' + esc(source.locator) + '</small>' : '') + '</div>';
}
function compare(c) {
  const host = root.querySelector('#comparison');
  const rows = comparisons(c);
  const state = comparisonState(c);
  host.innerHTML = `
    <span class="eyebrow">Evidence comparison</span><h2>Choose the question</h2>
    <div class="question-modes" role="group" aria-label="Question type">
      <button type="button" data-mode="suggested" aria-controls="suggested-questions">Suggested questions</button>
      <button type="button" data-mode="custom" aria-controls="custom-question">Ask your own question</button>
    </div>
    <div id="suggested-questions">
      <label class="field">Research question<select id="compare-q"></select></label>
      <div id="pair" class="grid2"></div>
    </div>
    <div id="custom-question" hidden>
      <form class="case-question-form">
        <label class="field" for="case-question-input">Your question about ${esc(c.short)}</label>
        <textarea id="case-question-input" rows="2" maxlength="1000" required></textarea>
        <button class="btn" type="submit">Find evidence</button>
      </form>
      <div id="case-question-result" aria-live="polite" aria-atomic="true"></div>
    </div>`;
  const selector = host.querySelector('#compare-q');
  rows.forEach(([question], i) => selector.add(new Option(question, String(i))));
  selector.selectedIndex = rows[state.preset] ? state.preset : 0;
  function drawPair() {
    const row = rows[selector.selectedIndex];
    host.querySelector('#pair').innerHTML = [1, 3].map((n, i) => `
      <div class="panel"><span class="eyebrow">${i ? 'Comparison' : 'Primary evidence'}</span>
      <h3>${esc(row[n])}</h3><p>${esc(row[n + 1])}</p><div class="actions">${actionLink(row[5 + i])}</div></div>`).join('');
  }
  selector.onchange = () => {
    state.preset = selector.selectedIndex;
    saveComparison(c, state);
    drawPair();
  };
  drawPair();

  const input = host.querySelector('#case-question-input');
  const result = host.querySelector('#case-question-result');
  input.value = state.draft;
  function drawResult() {
    const question = input.value.trim();
    if (!state.submitted || question !== state.submitted) {
      result.replaceChildren();
      delete result.dataset.status;
      return;
    }
    const answer = window.FFCaseQuestions.ask(c, question, rows);
    result.dataset.status = answer.status;
    result.innerHTML = (answer.message ? '<p>' + esc(answer.message) + '</p>' : '') + answer.entries.map(entry => `
      <article class="case-answer">
        <span class="eyebrow">${esc(entry.label)}</span><h3>${esc(entry.title)}</h3>
        <p>${esc(entry.text)}</p>${entry.sources.map(customSource).join('')}
      </article>`).join('');
    if (answer.status === 'gap') {
      const search = document.createElement('a');
      search.className = 'inlinebtn';
      search.href = '#search?q=' + encodeURIComponent(question);
      search.textContent = 'Search all evidence →';
      result.append(search);
    }
  }
  input.oninput = () => {
    input.setCustomValidity('');
    state.draft = input.value;
    saveComparison(c, state);
    drawResult();
  };
  host.querySelector('.case-question-form').onsubmit = event => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.setCustomValidity('Enter a question.');
      input.reportValidity();
      return;
    }
    state.draft = input.value;
    state.submitted = input.value.trim();
    saveComparison(c, state);
    drawResult();
  };
  drawResult();
  const modes = host.querySelectorAll('.question-modes button');
  function showMode() {
    modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    host.querySelector('#suggested-questions').hidden = state.mode !== 'suggested';
    host.querySelector('#custom-question').hidden = state.mode !== 'custom';
  }
  modes.forEach(button => {
    button.onclick = () => {
      state.mode = button.dataset.mode;
      saveComparison(c, state);
      showMode();
      if (state.mode === 'custom') input.focus();
    };
  });
  showMode();
}
function fileExport(name,body,type='text/plain'){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function notesKey(c){return 'first-fire:note:v1:'+c.id;}
function getNotes(c){try{return JSON.parse(localStorage.getItem(notesKey(c)))||{};}catch{return {};}}
function renderCase(id,view='evidence'){
 const c=findCase(id);if(!c){notFound();return;}
 if(!['evidence','designs','brief'].includes(view))view='evidence';
 root.innerHTML=crumb('Cases / '+c.short)+head(c.title,c.question,c.short+' / '+cardLabel[id])+
 '<nav class="tabs" aria-label="Case sections">'+[['evidence','Evidence'],['designs','Six design options'],['brief','My research brief']].map(([v,l])=>'<a href="#case/'+id+(v==='evidence'?'':'/'+v)+'" '+(view===v?'aria-current="page"':'')+'>'+l+'</a>').join('')+'</nav><div id="casebody"></div>';
 const body=root.querySelector('#casebody');
 if(view==='evidence' && (id==='same'||id==='flex')){
   const action=id==='same'?['detector.html','Inspect the detector power and smoke readings →']:['#transfer-lab?view=sensitivity','Compare matched flight runs →'];
   body.insertAdjacentHTML('beforebegin','<div class="actions case-lab-action">'+linkbtn(action[0],action[1],'btn')+'</div>');
 }
 if(view==='evidence'){
 body.innerHTML='<div class="record"><div class="stack"><div class="panel"><span class="eyebrow">'+(id==='fm2'?'Planned experiment':'Observed record')+'</span><p>'+esc(c.record)+'</p></div><div class="panel" id="comparison"></div><div class="callout"><span class="eyebrow">Research decision</span><h3>'+esc(c.decision)+'</h3><p style="margin-top:9px">'+esc(c.reason)+'</p></div><div class="panel"><h3>What limits this conclusion?</h3><p>'+esc(c.limit)+'</p><h3 style="margin-top:21px">What to test next</h3><p>'+esc(c.next)+'</p></div></div><aside class="aside"><div class="panel"><span class="eyebrow">Source file</span><h3>Read the evidence</h3><p class="footnote">Source checked · '+esc(c.human_review)+'</p>'+sourceList(c.sources)+'</div><a class="panel toolcard" href="#case/'+id+'/designs"><span class="eyebrow">Ranked first</span><h3>'+esc(c.options[0].name)+' ↗</h3><p>'+esc(c.options[0].mechanism)+'</p></a></aside></div>';compare(c);
 }else if(view==='designs'){
 body.innerHTML='<div class="record"><div class="panel"><span class="eyebrow">Architecture review</span><h2>Six ways to handle this case</h2><p class="sub" style="margin:10px 0 16px">Ranked by fit to the decision, traceability to the original record and feasibility with the available data. The ranking is a design judgment.</p><ol class="optionlist">'+c.options.map(o=>'<li><div><h3>'+esc(o.name)+'</h3><p>'+esc(o.mechanism)+'</p><p><strong>Trade-off.</strong> '+esc(o.tradeoff)+'</p><p><strong>Acceptance check.</strong> '+esc(o.proof)+'</p></div></li>').join('')+'</ol></div><aside class="panel"><span class="eyebrow">Recommended design</span><h3>'+esc(c.options[0].name)+'</h3><p>'+esc(c.options[0].proof)+'</p><div class="actions" style="margin-top:12px">'+linkbtn('#case/'+id+'/brief','Write a brief →','btn')+'</div></aside></div>';
 }else{
 const note=getNotes(c);
 const activeQuestion = comparisonState(c);
 const sourceQuestion = activeQuestion.mode === 'custom' ? activeQuestion.submitted : '';
 const selectedQuestion = sourceQuestion && sourceQuestion !== note.sourceQuestion
   ? sourceQuestion : note.question || c.question;
 body.innerHTML='<div class="record"><div class="panel"><h2>My research brief</h2><p class="sub" style="margin:10px 0 16px">Record your interpretation and next test. Save on this browser or download a copy with the original citations.</p><form id="brief" class="answerform"><label class="field">Research question<textarea name="question" rows="2" maxlength="1000">'+esc(selectedQuestion)+'</textarea></label>'+[['decision','Your decision'],['limit','What limits this result?'],['next','Next measurement or reanalysis']].map(([k,l])=>'<label class="field">'+l+'<textarea name="'+k+'" maxlength="6000">'+esc(note[k]||'')+'</textarea></label>').join('')+'<div class="actions"><button class="btn" type="submit">Save on this device</button><button class="ghost" type="button" id="exportbrief">Download brief</button></div><span role="status" id="briefmsg"></span></form></div><aside class="panel"><h3>What to check</h3><p>'+esc(c.check)+'</p>'+sourceList(c.sources)+'</aside></div>';
 const f=body.querySelector('#brief'), values=()=>Object.fromEntries(new FormData(f));f.onsubmit=e=>{e.preventDefault();try{localStorage.setItem(notesKey(c),JSON.stringify({...values(), sourceQuestion}));f.querySelector('#briefmsg').textContent='Saved on this device.';}catch{f.querySelector('#briefmsg').textContent='Local saving is unavailable. Download your brief instead.';}};
 f.querySelector('#exportbrief').onclick=()=>{const v=values();fileExport('FIRST-FIRE-'+c.id+'-brief.txt',[c.short+' — '+c.title,v.question,'My decision: '+v.decision,'Limit: '+v.limit,'Next action: '+v.next,'Case interpretation (team review pending): '+c.decision,...c.sources.map(s=>s.title+' · '+s.locator+'\n'+s.url)].join('\n\n'));};
 }
}
async function searchPage(q){
 root.innerHTML=crumb('Evidence search')+head('Find evidence','Search the reviewed cases and investigation descriptions. Use the data explorer for individual NASA row IDs.')+'<div class="panel stack">'+searchForm(q)+'<div class="chips">'+['wire insulation smoke','burner oxygen','visible flame extinction'].map(t=>'<a class="chip" href="#search?q='+encodeURIComponent(t)+'">'+esc(t)+'</a>').join('')+'</div></div><div id="matches" class="section" aria-live="polite"></div>';bindSearch();const box=root.querySelector('#matches');const tools=document.createElement('section');tools.className='ff-tools-result';box.before(tools);window.FFToolDirectory?.showMatches(tools,q);if(!q)return;box.textContent='Searching the local evidence index…';const {items,semantic}=await window.FFSearch.search(q);if(!box.isConnected)return;
 box.innerHTML='<div class="sectionhead"><div><span class="eyebrow">'+(semantic?'Semantic + keyword retrieval':'Keyword retrieval')+'</span><h2>'+esc(items.length?'Evidence matches':'No close matches')+'</h2></div></div>'+(items.length?'<div class="panel">'+items.map(d=>'<div class="result"><span class="tag">'+esc(d.type)+'</span><h3><a href="'+attr(d.url)+'">'+esc(d.title)+'</a></h3><p>'+esc(d.lead)+'</p></div>').join('')+'</div>':'<p>Try a material, investigation name or a shorter question.</p>')+'<p class="statusline" style="margin-top:10px">A related result may not answer your question. Open its source and check the material, conditions and measured endpoint.</p>';
}
const reports={
 'answer-verification':['Answer verification and calibration','Measured effects of citation, interpretation and numerical checks.'],
 'video-measurement':['Saffire flight images','Which camera and timing references support measuring a flame?'],
 'intake':['New data and outcome intake','Stage source tables and resolve the signed lunar forecast.'],
 'signoff':['Team review record','Case review, pilot, deposition and presentation evidence.'],
 'device-and-reader':['Device and reader settings','Tier signals, private résumé processing and measured parity.'],
 'master-physics':['Physics model validation','Cabin conservation, flame equilibrium, spread and reference cases.'],
 'master-citation-audit':['Master bibliography','Access checks and archived evidence for each numbered reference.'],
 'master-requirements':['Master document implementation','What runs, how to reproduce it, and which steps need field evidence.'],
 'transport-fit':['Fit a sensor trace','Estimate exchange and sensor lag on one run and compare both models on a second run.'],
 'science-chat-audit':['Independent archive chat evaluation','Sixty-four questions, the displayed replies, original scores and failures.'],
 'advanced-methods':['Research instruments','Matching experiments, measuring sensor delay, updating a threshold and independently evaluating archive queries.'],
 'science-chat':['Archive calculations in chat','Supported operations, source receipts and measured benchmark results.'],
 'code-review':['Source code audit','Repository-level readings, validation gaps and the changes made to FIRST FIRE.'],
 'referee-replay':['Evidence checks on 100 archived chat answers','What the evidence gate changed and where it still misses the question.'],
 'challenge-projects':['Challenge project review','Public repositories, Word documents, and the comparisons they prompted in FIRST FIRE.'],
 'chat-models':['Chat model selection','Small local transformer candidates, selection trials and the Grok migration plan.'],
 'world-model':['Physics simulation design','Sealed-compartment calculations, liquid-network test errors and the proposed validation with measured sensor traces.'],
 'chat-adversarial':['Ten conversations with the first model','Read the attack prompts, ordinary follow-ups, actual answers and two failures.'],
 'chat-benchmark':['100-question chat benchmark','Frozen questions, source checks, scoring limits and failure analysis.'],
 review:['Research review','What the six studies establish, what breaks a comparison, and where evidence ends.'],
 data:['Data audit','Where the NASA rows came from and why some investigations remain catalog-only.'],
 forecast:['Forecast method','The fixed team predictions, their signed timestamp, the assumed travel model and the scoring rules.'],
 evaluation:['Blind-test protocol','How to run the two arms, protect the answer key and compare results.'],
 search:['Search retrieval checks','Reproduce the public-case queries and compare retrieval methods.'],
 submission:['Challenge handoff','Project description, a demonstration sequence, credits and remaining entrant actions.']
};
function designReview(){root.innerHTML=crumb('Cases / Design decisions')+head('Design decisions','Compare the recommended approach for each case. Open the ranking to see the five alternatives, their trade-offs and how to check them.','Architecture review')+'<div class="panel">'+FF.cases.map((c,i)=>'<div class="result"><span class="tag '+tagColor[c.id]+'">'+esc(c.short)+(i===6?' · prospective':'')+'</span><h3>'+esc(c.options[0].name)+'</h3><p>'+esc(c.options[0].mechanism)+'</p><p><strong>Acceptance check.</strong> '+esc(c.options[0].proof)+'</p><a class="inlinebtn" href="#case/'+c.id+'/designs">See all six options →</a></div>').join('')+'</div>';}
function sources(){
 const rr=FF.resources;
 root.innerHTML=crumb('Sources & methods')+head('Sources & methods','Follow the trail from the Space Apps brief to each research decision.','Research notebook')+
 '<div class="toolsgrid">'+[['#designs','Compare design decisions','Review the six ranked approaches per case and the test each one must pass.'],['#coverage','Map the data','See what the normalized archive covers and which conditions have no transferable rows.'],['#referee','Check a quotation','Test exact wording against a specific page before interpreting it.'],['demo.html','Project walkthrough','Follow the project story in a short presentation.']].map(([u,t,d])=>'<a class="panel toolcard" href="'+u+'"><h3>'+t+' ↗</h3><p>'+d+'</p></a>').join('')+'</div>'+
 '<section class="section"><div class="sectionhead"><div><span class="eyebrow">Methods library</span><h2>Read the research</h2></div></div><div class="panel">'+Object.entries(reports).filter(([k])=>FF.research.some(r=>r.name===k)).map(([k,[title,desc]])=>'<div class="result"><h3><a href="#report/'+k+'">'+title+' →</a></h3><p>'+desc+'</p></div>').join('')+'</div></section>'+
 '<div class="record section"><section class="panel"><span class="eyebrow">Original brief</span><h2>Challenge resources</h2><p>All ten resources listed by the '+out(rr.source_url+'?tab=resources','Flame in Freefall challenge')+'. General background and primary experiments have different roles in this project.</p><ol class="readlist">'+rr.resources.map(s=>'<li>'+out(s.url,s.title)+'</li>').join('')+'</ol></section>'+
 '<aside class="panel"><span class="eyebrow">Offline release</span><h2>Download the records</h2><ul class="readlist">'+[['data/tests.csv','Normalized NASA observations (CSV)'],['data/investigations.json','Source catalogue, DOIs & file hashes'],['data/cases.json','Research decisions and ranked designs'],['data/forecast.json','Forecast assumptions and snapshot'],['data/challenge-resources.json','Official challenge resource index'],['data/evidence/pages.json','Page-level quotation receipts'],['forecast-lock/fm2-v1.json','Timestamped team forecast'],['master-film.mp4','Narrated film with English captions'],['checksums.json','Release file checksums'],['first-fire-user-manual.pdf','User manual (PDF)'],['first-fire-demo.pdf','Six-slide project demonstration (PDF)']].map(([u,t])=>'<li><a href="'+u+'" download>'+t+'</a></li>').join('')+'</ul></aside></div>'+
 '<section class="panel section"><h2>What search does</h2><p>A local English-language index combines keyword matching and semantic similarity. It searches six reviewed cases, the FM² study and nineteen investigation summaries. It does not generate research findings or assign safety ratings. The Data explorer searches individual records.</p><p>The semantic model is '+out('https://huggingface.co/minishlab/potion-base-2M','Model2Vec potion-base-2M')+' (revision 389b9f6), distributed locally under its <a href="licenses/model-LICENSE.txt">MIT license</a>. Its compact English tokenizer is optimized for this corpus. If the model cannot load, the results say “Keyword retrieval.”</p><p>Photo: NASA Glenn, SIBAL fabric in a drop-tower centrifuge, from the '+out(assetPage,'FM² project page')+'. Barlow Condensed and DM Sans: SIL Open Font License. FIRST FIRE software: <a href="licenses/software.txt">MIT</a>. NASA and third-party materials retain their own terms. This is an independent challenge project.</p></section>';
}
function report(id){
 const doc=FF.research.find(r=>r.name===id);if(!doc){notFound();return;}
 root.innerHTML=crumb('Sources & methods / '+(reports[id]?.[0]||id))+'<div class="actions docactions">'+linkbtn('#sources','← All sources')+'<a class="ghost" href="research/'+attr(doc.file)+'" download>Download report</a></div><article class="panel prose">'+window.marked.parse(doc.text)+'</article>';
 root.querySelectorAll('.prose a').forEach(a=>{const raw=a.getAttribute('href');if(raw.startsWith('../dist/'))a.setAttribute('href',raw.slice(8));else if(raw.startsWith('../data/'))a.setAttribute('href',raw.slice(3));else if(raw.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}else if(reports[raw.replace(/\.md$/,'')])a.href='#report/'+raw.replace(/\.md$/,'');});
}
function notFound(){root.innerHTML=crumb('Unknown page')+head('Page not found','This link does not point to a page in this edition.')+linkbtn('#home','Return to the research desk','btn');}
let disposeForecast;
const scripts = new Map();
function loadScript(name) {
 if(name==='observation-rows.js' && window.FFAwareness?.tier?.()==='lite')name='observation-rows-lite.js';
 if(!scripts.has(name)) scripts.set(name,new Promise((resolve,reject)=>{
   const asset=document.createElement('script');asset.src=name;
   asset.onload=resolve;asset.onerror=()=>{scripts.delete(name);asset.remove();reject(new Error(name));};
   document.head.append(asset);
 }));
 return scripts.get(name);
}
window.FFLoadAsset=loadScript;
let navigation=0;
async function route(first=false){
 const visit=++navigation;
 if(disposeForecast){disposeForecast();disposeForecast=null;}
 const raw=location.hash.slice(1),breakAt=raw.indexOf('?'),path=(breakAt<0?raw:raw.slice(0,breakAt)).split('/'),p=new URLSearchParams(breakAt<0?'':raw.slice(breakAt+1)),key=path[0]||'home';
 const bundles=[];
 if(['atlas','compass','passports','data','coverage'].includes(key))bundles.push('observation-rows.js');
 if(key==='transfer-lab')bundles.push('observation-rows.js','transfer-lab.js');
 if(key==='materials-lab')bundles.push('observation-rows.js','materials-data.js','master-materials.js');
 if(key==='vehicle-designer')bundles.push('observation-rows.js','materials-data.js','physics-lab.js','transport-lab.js','master-physics-data.js','master-surrogate-data.js','master-fds-data.js','master-physics.js','master-materials.js','vehicle-designer.js');
 if(key==='master-physics')bundles.push('physics-lab.js','transport-lab.js','master-physics-data.js','master-surrogate-data.js','master-fds-data.js','master-physics.js');
 if(key==='flame-tracking')bundles.push('front-tracking.js','saffire-frames.js','flight-frames-ui.js');
 if(key==='field-guide')bundles.push('field-guide.js');
 if(key==='instruments')bundles.push('instruments.js');
 if(key==='archive-audit')bundles.push('archive-audit-data.js','archive-audit.js');
 if(key==='design-lab')bundles.push('design-lab.js');
 if(key==='rover-design')bundles.push('rover-model.js','rover-integration.js');
 if(key==='transport-lab')bundles.push('transport-lab.js','transport-fit.js');
 if(key==='code-review')bundles.push('code-review-readings.js','code-review.js');
 if(['physics','rover'].includes(key)){
  if(window.FFAwareness?.tier?.()!=='lite')bundles.push('cabin-liquid-weights.js');
  bundles.push('physics-lab.js');
 }
 if(bundles.length){
  root.innerHTML='<p role="status">Opening the research tool…</p>';
  try{for(const asset of bundles)await loadScript(asset);}
  catch{if(visit===navigation){root.innerHTML='<div class="panel"><p>The files for this view could not be opened.</p><button class="ghost" type="button">Try again</button></div>';root.querySelector('button').onclick=()=>route(first);}return;}
  if(visit!==navigation)return;
 }
 if(key==='atlas'||key==='compass'){if(key==='compass')p.set('mode','rank');window.renderDeckAtlas(root,p);}
 else if(key==='materials-lab')window.FFMaterials.render(root,p);
 else if(key==='master-physics')disposeForecast=window.FFMasterPhysics.render(root,p);
 else if(key==='instruments')window.FFInstruments.render(root,p);
 else if(key==='vehicle-designer')disposeForecast=window.FFVehicleDesigner.render(root,p);
 else if(key==='flame-tracking'){
   const stopLocal=window.FFFrontTracking.render(root),gallery=document.createElement('section');
   root.querySelector('header').after(gallery);
   const stopGallery=window.FFFlightFrames.render(gallery);
   disposeForecast=()=>{stopLocal?.();if(typeof stopGallery==='function')stopGallery();};
 }
 else if(key==='field-guide')disposeForecast=window.FFFieldGuide.render(root,p);
 else if(key==='archive-audit')window.FFArchiveAudit.render(root);
 else if(key==='session')window.FFResearchSession.render(root);
 else if(key==='awareness')window.FFAwareness.render(root);
 else if(key==='rover-design')window.FFRoverDesign.render(root,p);
 else if(key==='transfer-lab')window.FFTransferLab.render(root,p);
 else if(key==='design-lab')window.FFDesignLab.render(root);
 else if(key==='transport-lab')disposeForecast=window.FFTransportLab.render(root);
 else if(key==='code-review')window.renderCodeReview(root,p);
 else if(key==='passports')window.renderPassports(root,p);
 else if(key==='rulebook')window.FFMissionDesk.rulebook(root,p);
 else if(key==='earth')window.FFMissionDesk.earth(root,p);
 else if(key==='referee'||key==='errors'){if(key==='errors')p.set('view','errors');window.renderDeckReferee(root,p);}
 else if(key==='physics'||key==='rover'){if(key==='rover')p.set('mode','rover');window.renderPhysicsLab(root,p);}
 else if(key==='home')home();else if(key==='chat'){root.replaceChildren();window.renderChat(root);}else if(key==='benchmark'){root.replaceChildren();window.renderBenchmark(root);}else if(key==='cases')library();else if(key==='designs')designReview();else if(key==='case')renderCase(path[1],path[2]);else if(key==='search')searchPage(p.get('q')||'');
 else if(key==='sources')sources();else if(key==='report')report(path[1]);else if(key==='forecast')disposeForecast=window.renderForecast(root);
 else if(key==='data'){root.innerHTML=crumb('Data explorer')+head('Data explorer','Inspect original NASA rows or rank records by how closely their conditions match your question.','Physical Sciences Informatics')+'<div id="explorer" class="stack"></div><div class="section actions">'+linkbtn('#coverage','View coverage map →')+linkbtn('#report/data','Read the data audit →')+'</div>';window.renderExplorer(root.querySelector('#explorer'),p);}
 else if(key==='claim'){root.innerHTML=crumb('Check a claim')+head('Check a claim','Find a related experiment, compare it with your question, and decide which conclusion the evidence supports.','Research workbench')+'<div id="claimtool"></div>';window.renderClaim(root.querySelector('#claimtool'));}
 else if(key==='acrylic'){root.innerHTML=crumb('Guided exercise / Acrylic')+head('Does acrylic spread faster on Earth?','Change the oxygen conditions, shape or endpoint and see whether an Earth-to-orbit comparison still holds.','Guided exercise')+'<div id="acrylictool"></div>';window.renderAcrylic(root.querySelector('#acrylictool'));}
 else if(key==='study'){root.innerHTML=crumb('Blind test')+head('Blind test','Compare FIRST FIRE with ordinary search using the same research questions and time limits.','Evaluation lab')+'<div id="study"></div><div class="section actions">'+linkbtn('#report/evaluation','Read the protocol →')+linkbtn('#guide','Open the user guide →')+'</div>';window.renderStudy(root.querySelector('#study'));}
 else if(key==='guide'){root.innerHTML=crumb('User guide')+window.FFGuide;root.querySelectorAll('a[href^="index.html#"]').forEach(a=>a.setAttribute('href',a.getAttribute('href').slice(10)));}
 else if(key==='coverage'||key==='quotes'){root.innerHTML=crumb('Sources & methods / '+(key==='coverage'?'Coverage map':'Quotation referee'))+head(key==='coverage'?'Coverage map':'Quotation referee',key==='coverage'?'Explore which archive rows can answer a question about the surrounding atmosphere.':'Check whether the exact words occur on the cited page or section.','Evidence tools')+'<div id="workbench"></div>';window.FFWorkbench[key==='quotes'?'referee':key](root.querySelector('#workbench'));}
 else notFound();
 const active=['case','designs'].includes(key)?'cases':['report','code-review'].includes(key)?'sources':key==='acrylic'?'cases':key==='coverage'?'data':key==='search'?'home':key;
 document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 closeMenu();
 window.FFResearchSession.guide();
 window.FFAwareness.guide(key);
 window.FFIntentRouter?.applyInputs?.(key,p,root);
 window.FFProofDrawer?.attach(root);
 const title=root.querySelector('h1')?.textContent||'Research desk';document.title=(key==='home'?'Research desk':title)+' · FIRST FIRE';
 if(!first){root.focus({preventScroll:true});window.scrollTo(0,0);}
}
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();root.focus();});
const explore=document.getElementById('workspace-explore');
function closeMenu(){explore.open=false;}
explore.addEventListener('click',e=>{if(e.target.closest('a')){closeMenu();root.focus({preventScroll:true});}});
document.addEventListener('pointerdown',e=>{if(explore.open&&!explore.contains(e.target))closeMenu();});
document.addEventListener('focusin',e=>{if(explore.open&&!explore.contains(e.target))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&explore.open){e.preventDefault();closeMenu();explore.querySelector('summary').focus();}});
window.addEventListener('hashchange',()=>route(false));route(true);
})();
