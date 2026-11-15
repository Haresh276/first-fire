(() => {
  'use strict';
  const sources={challenge:'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/',lunar:'https://ntrs.nasa.gov/citations/20250006779',mars:'https://ntrs.nasa.gov/citations/20130010991',fm:'https://ntrs.nasa.gov/citations/20260001966'};
  const chapters=[['Combustion, heat transfer and gravity',3],['Oxygen, pressure and material screening',6],['The investigations, including FM²',8],['How low gravity is produced',12],['Probability and scoring',13],['Data engineering and retrieval',15],['Reading sources and citations',17],['Cabin chemistry and liquid networks',20],['Atmosphere and material design',22],['Moon and Mars',24],['Glossary and misconceptions',26],['Original build map',31],['Citations and source-status key',32],['Claims and corrections',37]];
  const instruments=[
    ['Cabin and materials','See what changes when you choose a different material, oxygen level or suit pressure.','#materials-lab?tab=atmosphere'],
    ['Pressurized Rover Fire Case','Compare cabin materials, fire timelines and response options.','rover-fire-case.html'],
    ['Physics and validation','Inspect temperature, pressure, life support, references and model errors.','#master-physics'],
    ['Research chat','Ask your own question. Inspect its scope, checks and supporting evidence.','#chat'],
    ['Fixed FM² forecast','Read the four predictions, probability model and signed timestamp.','#forecast'],
    ['Compare experiments','Select compatible FLEX runs before revealing the outcomes.','#transfer-lab'],
    ['Design the next lunar test','Choose the oxygen setting for a follow-up specimen.','#design-lab'],
    ['Measure a flame front','Measure motion in NASA’s Saffire-I camera frames or calibrate a video from your device.','#flame-tracking'],
    ['Register a new forecast','Fix the design and predictions for a second material, then resolve trials against their official sources.','forecast-register.html'],
    ['Research record','Collect a matched comparison, tracer run, forecast decision and archive calculation.','#session']
  ];
  const rehearsal=[
    [25, "Haresh", "What will sustain spread?", "Define sustained spread after the igniter shuts off. Introduce the four planned FM² fabric burns.", "#forecast"],
    [50, "Haresh", "When does the Earth test transfer?", "Separate flaming and smouldering cotton. ICES Fig. 13 and the single-material figures disagree on some lunar values.", "#materials-lab?tab=margins"],
    [35, "Haresh", "What is in the archive?", "Distinguish the challenge Atlas source rows from normalized observations used in numerical queries.", "#atlas"],
    [40, "Haresh", "Where is the gap?", "Open one orbit row and the empty Moon column. Identify the partial-gravity tests performed on Earth.", "#atlas"],
    [195, "Samuel", "Investigate a habitat", "Atlas (35 s), Compass (35 s), Rulebook (30 s), Referee (45 s), then the rover fire case (50 s). Select an item and compare its fan-on and fan-off oxygen limits.", "#atlas"],
    [60, "Haresh", "Make a forecast that can lose", "Show the sealed v1 record and its four probabilities. Score a hypothetical outcome against the comparator.", "#forecast"],
    [60, "Haresh", "FLINT, the engine", "Trace the fitted Earth points and held-out lunar limits. Compare mean errors and explain how combustion products change the FM² oxygen reading.", "flint.html"],
    [45, "Samuel", "Why a rover: the hardest fire case", "Show why lunar buoyancy can sustain a cabin fire with fans off. Compare a gas flood with suited venting, including the crew effects and pressure extrapolation.", "rover-fire-case.html"],
    [40, "Samuel", "Inspect an error", "Show the planted quotation and its original source. Open the saved benchmark to inspect a failure.", "#referee"],
    [40, "Hamsika", "Apply the evidence on Earth", "Use the oxygen-ward case to distinguish a physical analogy from the measurements that a hospital would need.", "#earth"],
    [30, "Haresh", "What still needs evidence?", "Identify the missing lunar spread measurement. The blind pilot, independent sign-offs and official FM² outcomes are pending.", "#master-physics"],
    [40, "Haresh", "Round 1 feedback", "Use recorded judge feedback if available. Otherwise show the matched FLEX comparison and the effect of requiring the same test day.", "#transfer-lab"],
    [30, "Haresh", "Close", "Credit the team’s confirmed contributions and return to the signed forecast and scoring rule.", "#forecast"]
  ];
  const quiz=[
  [
    "The project",
    "What is FIRST FIRE?",
    "A research desk for comparing spacecraft fire experiments. It links an engineer’s decision to a source and fixes four predictions before lunar outcomes are available.",
    "#field-guide"
  ],
  [
    "The project",
    "What can a judge reproduce here?",
    "Open the sealed forecast, trace a calculated count to the archive, and count records that match the gravity, pressure and oxygen of one habitat simultaneously.",
    "#compass"
  ],
  [
    "The project",
    "Who would use it?",
    "An engineer can inspect a proposed material, a researcher can plan a follow-up test, and a student can explore how gravity changes oxygen transport.",
    "#field-guide"
  ],
  [
    "The project",
    "Why the name FIRST FIRE?",
    "NASA designed FM² to study fire on the lunar surface. The name refers to that planned experiment and the team’s advance forecast.",
    "#forecast"
  ],
  [
    "Science",
    "Why might weak gravity sustain spread at lower oxygen?",
    "Too little oxidizer can starve the flame. Fast flow can increase cooling and cause blowoff. Between those regimes a material can sustain spread at a lower oxygen fraction. Geometry and flow direction matter.",
    "#materials-lab?tab=airflow"
  ],
  [
    "Science",
    "Does every material become more flammable at lunar gravity?",
    "In the short-duration five-material study, three limits fell below the Earth extrapolation and two lay above it. The result depends on the material and the definition of the limit.",
    "#materials-lab?tab=margins"
  ],
  [
    "Science",
    "What does NASA’s Table 2 measure?",
    "The authors derived conservative oxygen margins by extrapolating ground-test trends. Inspect the flaming or smouldering endpoint before using a number.",
    "#materials-lab?tab=margins"
  ],
  [
    "Science",
    "Why consider 34% oxygen in a cabin?",
    "NASA studied using less nitrogen and lower total pressure to reduce the change in nitrogen pressure before a spacewalk. In the worked example, 34% of 56.5 kPa gives 19.2 kPa dry oxygen partial pressure. The higher oxygen fraction changes material fire behaviour.",
    "#materials-lab?tab=atmosphere"
  ],
  [
    "Science",
    "What exactly is FM²?",
    "The March 2026 design uses four 2 × 20 cm strips of Synergy Pro Navy with bottom ignition in a 14.4 L chamber at 8.2 psia. Cameras, radiometers and sensors observe the burns at four starting oxygen fractions.",
    "#forecast"
  ],
  [
    "Science",
    "What does a “yes” mean?",
    "The official record must establish self-sustained spread beyond the igniter-influenced region after nominal ignition. A brief flash alone does not qualify.",
    "forecast-lock/fm2-v1.json"
  ],
  [
    "Science",
    "Why choose a 26% mean and a 1.5-point spread?",
    "These are the team’s stated judgements for a shared limiting-oxygen threshold. The chosen mean is the high end of NASA’s expected 24–26% limit. The normal model puts its central 80% between about 24.08 and 27.92%.",
    "#forecast"
  ],
  [
    "Science",
    "What if the experimental design changes?",
    "Apply the void conditions in the sealed record and report which burns remain scoreable. Substantive changes need a separately timestamped forecast.",
    "forecast-lock/fm2-v1.json"
  ],
  [
    "Data",
    "Where did the data come from?",
    "The core Atlas preserves nonempty source rows from NASA’s Physical Sciences Informatics collection. Its investigation cards identify a source DOI and original table. The broader catalogue also contains context sources.",
    "#atlas"
  ],
  [
    "Data",
    "Why are there both 1,622 and 1,058 rows?",
    "The core Atlas contains 1,622 source rows from 16 tables and 15 investigations. The numerical workspace uses 1,058 individually identifiable observations. A multi-setting source row cannot automatically count as one experiment.",
    "#report/data"
  ],
  [
    "Data",
    "Which transformations did you decline?",
    "Missing values stay missing. A fan command alone cannot establish a flow velocity. Burner oxygen and ambient oxygen have separate fields because they describe different physical conditions.",
    "#data"
  ],
  [
    "Data",
    "How can someone audit the files?",
    "Download the source tables, compare their SHA-256 values with the manifest and rerun the normalization and release checks from the repository.",
    "checksums.json"
  ],
  [
    "Forecast",
    "What makes this forecast testable?",
    "The signed file defines the event, probabilities, comparator, void rules and score. A reported outcome can therefore favour the team model or its comparator.",
    "forecast-lock/fm2-v1.json"
  ],
  [
    "Forecast",
    "Who chose the comparator?",
    "The team turned NASA’s qualitative expectations into 90%, 90%, 90% and 10% for comparison. NASA supplied the qualitative expectations.",
    "#forecast"
  ],
  [
    "Forecast",
    "What does the signed timestamp establish?",
    "The timestamp binds the forecast bytes to 14 November 2026 at 12:57:06 UTC. Authorship, physical accuracy and the eventual score are separate questions.",
    "forecast-lock/README.txt"
  ],
  [
    "Forecast",
    "What happens if the fourth burn sustains?",
    "Its squared error is smaller for the team’s probability of about 25.25% than for the 10% comparator. The overall mean score also depends on the other resolved burns and the scope rules.",
    "#forecast"
  ],
  [
    "Forecast",
    "How much could four burns tell us?",
    "They could constrain sustained spread for one fabric in this defined chamber and atmosphere. Other materials, geometries or flow conditions require additional evidence.",
    "#design-lab"
  ],
  [
    "Technology",
    "Where does the model enter an answer?",
    "The chat routes the question to an instrument or selects stored passages. Code computes archive quantities and checks evidence. The proof drawer shows what was verified for the particular answer.",
    "#chat"
  ],
  [
    "Technology",
    "Why use a small local model?",
    "A small selector can retrieve stored evidence on a laptop. The published ablations separate retrieval from selection. Most static research instruments also run without inference or a key.",
    "#benchmark"
  ],
  [
    "Technology",
    "What does the historical 78/100 benchmark mean?",
    "Each answer had to satisfy the recorded fact, behaviour and citation rubric. The separate 24-question set scored 14/24. The current evidence gate and numerical suites have their own reports.",
    "#report/answer-verification"
  ],
  [
    "Technology",
    "How far has the physics model been checked?",
    "The worked case conserves species and energy. Three prescribed methane burner traces from NIST FDS test gas balance. The SIBAL flight comparison exposes the error in moving a front-speed estimate from one flow direction to another.",
    "#master-physics"
  ],
  [
    "Technology",
    "Did the liquid network earn its place?",
    "The trained liquid network beat a plain recurrent model on the held-out runs. The chemistry-informed interpolation table had lower error, so the trained network did not qualify to replace the solver.",
    "#report/master-physics"
  ],
  [
    "Technology",
    "How was SI used?",
    "The public disclosure describes assisted coding, research, drafting, model selection and generated assets. The review log lets team members confirm their actual contributions.",
    "team-handoff.html"
  ],
  [
    "Impact",
    "What claims are outside the evidence?",
    "These tools do not certify a material or establish a Moon-surface outcome. The bundled archive has no Mars-surface fire rows. Earth centrifuge experiments at Mars-like acceleration do exist.",
    "https://ntrs.nasa.gov/citations/20130010991"
  ],
  [
    "Impact",
    "Why might this matter in India?",
    "A Gaganyaan cabin or an oxygen-enriched hospital ward raises questions about material, pressure and ventilation. The At Home page leads from that physical analogy to the new measurement required in the local setting.",
    "#earth"
  ],
  [
    "Impact",
    "What happens when a lunar result is published?",
    "Check the official source, identify the test and actual conditions, apply the sealed resolution rules and score the eligible burns together. Report the number resolved and voided.",
    "forecast-lock/fm2-v1.json"
  ],
  [
    "Impact",
    "What would the next month of work measure?",
    "Calibrate real camera frames against known dimensions, compare cabin predictions with independent sensor traces, and run the masked participant comparison against ordinary search.",
    "#flame-tracking"
  ],
  [
    "Impact",
    "What if the team’s forecast is wrong?",
    "A poor score is a reportable result. Keep the original bytes, publish the attributable outcomes and show where the observation differed from the prediction.",
    "#forecast"
  ]
];
  const el=(tag,t,cls)=>{const e=document.createElement(tag);if(t!=null)e.textContent=t;if(cls)e.className=cls;return e;};
  function a(t,href,cls){const n=el('a',t,cls);n.href=href;if(href.startsWith('https:')){n.target='_blank';n.rel='noopener';}return n;}
  function btn(t,fn){const n=el('button',t,'ghost');n.type='button';n.onclick=fn;return n;}
  const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  function render(root,p=new URLSearchParams()){
    let timer=0;const header=el('header',null,'pagetitle');header.append(el('h1','Field guide'),el('p','Use the team’s science guide, reproduce a calculation, or rehearse the demonstration.','sub'));
    const tabs=el('nav',null,'master-tabs');tabs.setAttribute('aria-label','Field guide sections');const selected=p.get('tab')||'tools';
    for(const [v,t] of [['tools','Instruments'],['learn','Learn'],['judges','Judge walkthrough'],['handoff','Team handoff']]){const n=a(t,'#field-guide?tab='+v);if(selected===v)n.setAttribute('aria-current','page');tabs.append(n);}
    const body=el('div',null,'stack');root.replaceChildren(header,tabs,body);
    if(selected==='learn'){
      const panel=el('section',null,'panel stack');panel.append(el('h2','Science reader'),el('p','Thirty-eight printable pages include the original teaching chapters, complete glossary, source register and checked claims, with a release note on published partial-gravity evidence.'),a('Download the science field guide (PDF)','first-fire-field-guide.pdf','btn'));const list=el('ul','', 'readlist');for(const [title,page] of chapters){const li=el('li');li.append(a(title,'first-fire-field-guide.pdf#page='+page));list.append(li);}panel.append(list);body.append(panel);const manuals=el('div',null,'actions');manuals.append(a('User manual (PDF)','first-fire-user-manual.pdf','ghost'),a('Technical manual with FM² methods (PDF)','first-fire-technical-manual.pdf','ghost'));body.append(manuals);
      const qs=el('section',null,'panel stack'),choices=el('div',null,'stack'),filter=el('input'),label=el('label','Search the 32 judge questions','field');
      filter.type='search';label.append(filter);qs.append(el('h2','Practice explaining the evidence'),label,choices);
      function search(){choices.replaceChildren();const term=filter.value.trim().toLowerCase();let group='';for(const [g,q,ans,href] of quiz){if(![g,q,ans].join(' ').toLowerCase().includes(term))continue;if(g!==group){choices.append(el('h3',g));group=g;}const d=el('details');d.append(el('summary',q),el('p',ans),a('Inspect the evidence →',href));choices.append(d);}if(!choices.children.length)choices.append(el('p','No matching questions. Try a material, instrument or topic.'));}
      filter.oninput=search;search();body.append(qs,a('Download the classroom worksheet (PDF)','master-worksheet.pdf','inlinebtn'));
    }else if(selected==='judges'){
      const quick=el('section',null,'panel stack');quick.append(el('h2','A minute with the evidence'),el('p','Open the fixed forecast, inspect the empty Moon column, then test a quotation against its original page.'));
      const acts=el('div',null,'actions');[['Fixed forecast','#forecast'],['Atlas','#atlas'],['Test the quotation','#referee'],['Narrated 30-second film','master-film.mp4']].forEach(([t,h])=>acts.append(a(t,h,'ghost')));quick.append(acts);body.append(quick);
      const stage=el('section',null,'run-summary stack'),controls=el('div',null,'actions'),title=el('h2'),script=el('p'),badge=el('span',null,'eyebrow'),instrument=a('Open this instrument ↗','#forecast','ghost'),elapsed=el('p');elapsed.setAttribute('aria-label','Rehearsal clock');
      let idx=0,started=null,offset=0;const total=()=>offset+(started===null?0:(performance.now()-started)/1000);
      function tick(){const seconds=total(),start=rehearsal.slice(0,idx).reduce((n,r)=>n+r[0],0);elapsed.textContent='Elapsed '+clock(seconds)+' · planned segment '+clock(start)+'–'+clock(start+rehearsal[idx][0])+' · complete run '+clock(rehearsal.reduce((sum,row)=>sum+row[0],0));}
      function show(){const [,speaker,t,copy,url]=rehearsal[idx];badge.textContent=speaker+' · '+(idx+1)+' of '+rehearsal.length;title.textContent=t;script.textContent=copy;instrument.href=url;instrument.target='_blank';instrument.rel='noopener';prev.disabled=idx===0;next.disabled=idx===rehearsal.length-1;tick();}
      const prev=btn('Previous',()=>{idx--;show();}),next=btn('Next',()=>{idx++;show();}),play=btn('Start timer',()=>{if(started===null){started=performance.now();timer=setInterval(tick,250);play.textContent='Pause timer';}else{offset=total();started=null;clearInterval(timer);play.textContent='Resume timer';}tick();});
      controls.append(prev,next,play,instrument);stage.append(badge,title,script,elapsed,controls);body.append(stage,a('Print the full Round 2 run sheet','master-round2.pdf'),a('Download the 13-slide Round 2 presentation (PDF)','master-round2-slides.pdf'),a('Edit the Round 2 presentation (PowerPoint)','master-round2-slides.pptx'),a('Open the six-slide project demonstration','demo.html'));show();
    }else if(selected==='handoff'){
      const panel=el('section',null,'panel stack');panel.append(el('h2','Submission materials'));for(const [t,h] of [['One-page judge brief','judge-brief.pdf'],['Download FIRST FIRE for offline use','offline.html'],['Public project summary and data sources','#report/submission'],['Implementation and remaining evidence','#report/master-requirements'],['Download the 15-investigation NASA data pack','challenge-data-pack.zip'],['Prepare the forecast DOI deposition','forecast-deposition.zip'],['Team review log and pilot instructions','team-handoff.html'],['SI disclosure and credits','team-handoff.html'],['Original project challenge',sources.challenge],['Prepare new NASA tables or verify official outcomes','#report/intake'],['Fixed forecast and timestamp','#forecast']])panel.append(a(t,h));body.append(panel);
    }else {
      const feature=el('section',null,'field-feature'),copy=el('div',null,'stack'),photo=el('figure'),img=el('img');
      img.src='sibal.png';img.alt='A strip of SIBAL fabric burning during a NASA ground-based reduced-gravity experiment.';img.width=640;img.height=410;
      copy.append(el('p','FM² case study','eyebrow'),el('h2','Would the flame keep moving once the igniter switches off?'),el('p','Inspect four probabilities fixed before the lunar experiment. Change the oxygen assumptions, then see which additional burn would tell you the most.'),a('Examine the four burns →','#forecast','btn'));
      photo.append(img,el('figcaption','SIBAL in a drop-tower centrifuge · NASA Glenn'));feature.append(copy,photo);body.append(feature);
      const deck=el('div',null,'master-tools');for(const [t,desc,h] of instruments){const card=a('',h,'panel stack');card.append(el('h2',t),el('p',desc));deck.append(card);}body.append(deck);}
    return ()=>clearInterval(timer);
  }
  window.FFFieldGuide={render};
})();
