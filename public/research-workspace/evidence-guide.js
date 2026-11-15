/* Curated question-to-evidence descriptors; source accessions are stable NASA PSI keys.
   The ordering is deterministic endpoint fit, then specimen fit; never a hazard score. */
(function(root){
  'use strict';
  const tasks={spread:'Flame spread and materials',detection:'Smoke and detector response',extinction:'Suppression and visible extinction'};
  const specimens={any:'Any specimen',fabric:'Woven fabric',polymer:'Polymer or insulation',droplet:'Liquid droplet'};
  // Qualitative capsules cite the report (where applicable); the PSI table records setup and sample.
  const studies=[
    ['PSI-98','Saffire-I','spread',['fabric'],'Large cotton–fiberglass strip burned in both airflow directions. The flight report gives two different average front speeds.','The two burns used the same specimen in sequence. They do not isolate a direction effect or measure a lunar rate.','https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21','index.html#atlas?record=PSI-98:1:2','Saffire-I flight report, slide 21'],
    ['PSI-99','Saffire-II','spread',['polymer','fabric'],'Sample 2-7 placed an acrylic strip next to Nomex. The upstream acrylic was consumed; the Nomex did not ignite under these test conditions.','The assembly burn duration is not a Nomex burn duration. Geometry, material and endpoint must travel with the result.','https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=29','index.html#case/saffire','Saffire-II flight report, sample 2-7'],
    ['PSI-25','BASS-II','spread',['polymer','fabric'],'The experimental table includes thin PMMA film, Nomex and SIBAL fabric in forced flow. Compare the specimen and gas concentrations before transferring a result.','A fan display setting is not a calibrated cabin velocity. A gas reading alone does not measure flame-front travel.',null,'index.html#atlas?study=PSI-25'],
    ['PSI-101','SAME-R','detection',['polymer'],'Heated spacecraft materials produced aerosols for detector studies; smoke properties and detector sensitivities vary with material.','Particle production or a low signal is not by itself a missed alarm. Match power state, threshold, instrument and exposure.','https://www.nist.gov/news-events/news/2018/05/nistnasa-study-shows-one-detector-doesnt-fit-all-smoke-spacecraft','detector.html','NIST/NASA detector comparison'],
    ['PSI-102','SAME','detection',['polymer'],'Records pair source materials with generation conditions for spacecraft smoke. Compare aging and flow before interpreting detector response.','A material-settings row is not an alarm outcome. Report the measurement available rather than assigning a pass or fail.',null,'index.html#atlas?study=PSI-102'],
    ['PSI-69','FLEX','extinction',['droplet'],'Droplet experiments recorded visible burning and extinction under controlled oxygen and diluent settings. Some runs show evidence of later cool-flame burning.','Disappearance of visible light does not prove that all chemistry stopped. A droplet test is not a solid-cabin suppression rating.','https://ntrs.nasa.gov/api/citations/20150023456/downloads/20150023456.pdf#page=189','index.html#atlas?record=PSI-69%3A1%3A156','NASA FLEX final report, test C03H201'],
    ['PSI-68','FLEX-2','extinction',['droplet'],'The archive describes follow-on liquid-fuel experiments. Its test-condition entries can help locate candidate comparisons.','A listed condition is not a measured extinction outcome. Retrieve the run and diagnostics before treating it as a result.',null,'index.html#atlas?study=PSI-68']
  ].map(([id,name,task,forms,finding,limit,report,local,reportTitle])=>Object.freeze({id,name,task,forms,finding,limit,report,local,reportTitle,url:'https://psi.nasa.gov/physci/repo/data/investigations/'+id}));
  function rank(task='spread',specimen='any'){
    if(!Object.hasOwn(tasks,task)||!Object.hasOwn(specimens,specimen)) throw new RangeError('Unknown evidence filter');
    const byEndpoint=studies.filter(s=>s.task===task || (s.id==='PSI-25' && task==='extinction')).map(s=>s.id==='PSI-25' && task==='extinction'?{...s,finding:'BASS-II investigated extinction of solid samples, including fabric and polymer, under forced flow. Its archive identifies specimens and gas conditions for follow-up.',limit:'The gas log alone does not give an extinction threshold, and stopping a sample flame does not size an extinguisher for a rover.'}:s);
    const direct=byEndpoint.filter(s=>specimen==='any'||s.forms.includes(specimen));
    return {task,specimen,direct,related:byEndpoint.filter(s=>!direct.includes(s)),total:studies.length};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={tasks,specimens,studies,rank};
  if(!root.document)return;
  const $=id=>root.document.getElementById(id),e=(tag,txt)=>{const n=root.document.createElement(tag);n.textContent=txt;return n};
  function a(url,label){const n=e('a',label);n.href=url;return n}
  const endpoint=$('endpoint'),specimen=$('specimen');if(!endpoint||!specimen)return;
  const params=new URLSearchParams(root.location.search),valid=(map,k,fallback)=>Object.hasOwn(map,k)?k:fallback;
  for(const [map,el,key,def] of [[tasks,endpoint,'task','spread'],[specimens,specimen,'specimen','any']]){
    for(const [v,label] of Object.entries(map)){const op=e('option',label);op.value=v;el.append(op)}
    el.value=valid(map,params.get(key),def);
  }
  function render(){
    const {direct,related,total}=rank(endpoint.value,specimen.value);
    $('count').textContent=direct.length?direct.length+' of '+total+' selected studies match the chosen endpoint'+(specimen.value==='any'?'.':' and specimen family.'):'No direct match in these '+total+' studies. The studies below address the endpoint with a different specimen.';
    const list=$('matches');list.replaceChildren();
    for(const [group,arr] of [['Endpoint match',direct],['Different specimen',related]]){
      for(const s of arr){
        const card=e('article',''); card.className='result-card';
        const tag=e('span',group+(group==='Endpoint match'&&specimen.value!=='any'?' · specimen match':''));tag.className='fit';
        const heading=e('h2',s.name),meta=e('span',s.id);meta.className='accession';heading.append(meta);
        const limit=e('p','');limit.className='limit';limit.append(e('strong','What it cannot tell you. '),s.limit);
        const links=e('div','');links.className='record-links';links.append(a(s.local,'Inspect in FIRST FIRE'),a(s.url,'NASA PSI record'));if(s.report)links.append(a(s.report,s.reportTitle));
        card.append(tag,heading,e('p',s.finding),limit,links);list.append(card);
      }
    }
  }
  function update(){render();try{const u=new URL(root.location.href);u.searchParams.set('task',endpoint.value);u.searchParams.set('specimen',specimen.value);root.history.replaceState(null,'',u)}catch{}}
  endpoint.addEventListener('change',update);specimen.addEventListener('change',update);render();
})(typeof window==='undefined'?{}:window);
