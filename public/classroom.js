(() => {
  'use strict';
  const data = window.FFClassroomData;
  const el = id => document.getElementById(id);
  const baseText = Object.fromEntries([...document.querySelectorAll('[data-t]')].map(n => [n.dataset.t,n.textContent]));
  const te = {
    desk:'పరిశోధన కేంద్రం', language:'భాష', eyebrow:'తరగతి గది · NIST గది అగ్ని ప్రయోగాలు',
    title:'అలారం మోగినప్పటి కొలతలు కనుగొనండి',
    intro:'ఒక గదిలో పాలియురేథేన్ ఫోమ్ మండినప్పుడు పొగ అలారం మోగింది. NIST సారాంశంలోని రెండు కొలతలూ సరిపోలే వరుసను అసలు నమోదులో కనుగొనండి.',
    chooseRun:'ప్రయోగాన్ని ఎంచుకోండి', run1:'ప్రయోగం 1',run2:'ప్రయోగం 2',share:'ఈ ప్రయోగానికి లింకు',
    summary:'వర్క్‌బుక్ సారాంశం',alarm:'నివేదించిన అలారం సమయం',obsc:'కాంతి కిరణం క్షీణత',mic:'MIC విద్యుత్ ప్రవాహం',
    measures:'ఒక అడుగు దూరంలో పొగ వల్ల కాంతి తీవ్రత ఎంత తగ్గిందో మొదటి కొలత తెలుపుతుంది. రెండో కొలత అయనీకరణ కొలత గదిలో (MIC) ప్రవహించే విద్యుత్తు.',
    inspect:'రెండు కొలతలను పరిశీలించండి',inspectHelp:'స్లైడర్‌ను కదపండి లేదా అసలు ఫైల్‌లోని సమయ సూచికను నమోదు చేయండి. రెండు కొలతలూ ఆ ఫైల్‌లో ఇచ్చిన దశాంశ స్థానాల వరకు సరిపోతున్నాయో చూడండి.',
    counter:'అసలు సమయ సూచిక (s)',check:'ఈ వరుసను తనిఖీ చేయండి',meaning:'ఈ సమయ వ్యత్యాసం ఏమి చెబుతోంది?',
    chooseReason:'ఈ నమోదుల ఆధారంగా చెప్పగలిగే సమాధానాన్ని ఎంచుకోండి.',
    physical:'పొగ అలారం వద్దకు చేరడానికి ఇన్ని సెకన్లు పట్టింది.',
    alignment:'ఈ ప్రయోగంలో ఈ వ్యత్యాసాన్ని కలిపితే సారాంశంలోని కొలతలు అసలు నమోదుతో సరిపోతాయి. కారణం తెలుసుకోవాలంటే సమయాన్ని ఎలా నమోదు చేశారో చూడాలి.',
    universal:'NIST ప్రయోగాలన్నింటికీ, అంతరిక్ష నౌకల్లోని ప్రతి డిటెక్టర్‌కూ ఇదే సమయ సవరణ వర్తిస్తుంది.',
    checkReason:'నా వివరణను తనిఖీ చేయండి',evidence:'మీ అభ్యాస నమోదు',
    practice:'ఈ ట్యాబ్‌లో మీరు సమర్పించిన జవాబులు మాత్రమే నమోదవుతాయి. ఈ అభ్యాస ఫలితం తరగతిలో ఎంత నేర్చుకున్నారో నిర్ధారించదు.',
    download:'పేరు లేని ఆధారాల ఫైల్‌ను దించుకోండి (JSON)',peer:'మరో విద్యార్థి నమోదుతో పోల్చండి',
    peerHelp:'ఈ ప్రయోగాన్ని పూర్తిచేశాక మరో విద్యార్థి దించుకున్న ఫైల్‌ను తెరవండి. ఒకే డేటాపై మీ ఇద్దరి మొదటి ప్రయత్నాలను పోల్చండి. ఫైల్‌ను ఈ పరికరంలోనే చదువుతాం.',
    upload:'అభ్యాస JSON ఫైల్‌ను తెరవండి',next:'ఇదే ప్రశ్నను కక్ష్యలో పరిశీలించండి',
    nextHelp:'ఇక్కడ రెండు సమయ నమోదులను పోల్చారు. NASA SAME-R ప్రయోగంలో అలారం సంకేతాన్ని అర్థం చేసుకునే ముందు డిటెక్టర్‌కు విద్యుత్ సరఫరా ఉందో లేదో చూడండి.',
    detector:'NASA డిటెక్టర్ ప్రయోగాన్ని తెరవండి →',sources:'మూలాలు, కొలతల కచ్చితత్వం, ఫైళ్ల హాష్‌లు',
    precision:'రెండు విలువలూ అసలు ఫైల్‌లోని చివరి దశాంశ స్థానంలో అర యూనిట్ వరకు సరిపోతే ఆ వరుసను అంగీకరిస్తాం. ఇది ముద్రిత విలువల మధ్య పోలిక. పరికరం కొలతలోని అనిశ్చితిని వేరుగా అంచనా వేయాలి.',
    dictionary:'NIST డేటా వివరణ',zip:'అసలు ప్రయోగ ఫైళ్లు (ZIP)',book:'సారాంశ వర్క్‌బుక్ (XLSX)'
  };
  const params = new URLSearchParams(location.search);
  let language = params.get('lang') === 'te' ? 'te' : 'en';
  let active = params.get('case') === '2' ? '2' : '1';
  const t = (english,telugu) => language === 'te' ? telugu : english;
  const cases = {};
  for (const [key,run] of Object.entries(data.runs)) {
    cases[key] = {cursor:run.alarm,attempts:[],reasons:[],choice:'',feedback:'',peer:null};
  }
  const run = () => data.runs[active];
  const state = () => cases[active];
  function indexFor(r,counter) {
    const index = counter - r.rows[0][0];
    return Number.isInteger(index) && r.rows[index]?.[0] === counter ? index : -1;
  }
  function matches(r,counter) {
    const row = r.rows[indexFor(r,counter)];
    return !!row && Math.abs(row[1]-r.obsc) <= 0.000500001 && Math.abs(row[2]-r.mic) <= 0.005000001;
  }
  function sourceRow(r,counter) {
    const i = indexFor(r,counter);
    if (i < 0) return null;
    const [counter_s,obsc_pct_per_ft,mic_pa] = r.rows[i];
    return {counter_s,tsv_line:i+2,obsc_pct_per_ft,mic_pa};
  }
  function foundCounter(s,r) { return s.attempts.find(counter => matches(r,counter)); }
  function reasonText(code) { return (language === 'te' ? te : baseText)[code]; }
  function formatCounter(r,counter) {
    const difference = counter-r.alarm;
    return difference>0 ? '+'+difference : String(difference);
  }
  function caseHref() {
    const url = new URL(location.href);
    url.searchParams.set('case',active);
    url.searchParams.set('lang',language);
    return url.href;
  }
  function syncURL() {
    el('case-link').href = caseHref();
    try { history.replaceState(null,'',el('case-link').href); } catch { /* The link also works from an offline file. */ }
  }
  function renderSources() {
    const r=run();
    el('summary-locator').textContent = data.sheet+' · '+r.cells;
    el('source-files').textContent = r.file+' · '+data.sheet+'!'+r.cells;
    const list = el('hashes'); list.replaceChildren();
    for(const [label,value] of [[r.file,r.sha256],[t('Room ZIP','గది ప్రయోగాల ZIP'),data.room_sha256],[t('Workbook','వర్క్‌బుక్'),data.summary_sha256]]) {
      const dt=document.createElement('dt'),dd=document.createElement('dd');
      dt.textContent=label+' · SHA-256';dd.textContent=value;list.append(dt,dd);
    }
  }
  function drawTrace(id,column,reference,color,start,end) {
    const canvas=el(id),r=run(),width=Math.round(canvas.getBoundingClientRect().width);
    if(width<1)return;
    const height=78,dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=height*dpr;
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const rows=r.rows.slice(indexFor(r,start),indexFor(r,end)+1);
    const values=rows.map(row=>row[column]);
    const min=Math.min(reference,...values),max=Math.max(reference,...values);
    const x=counter=>5+(counter-start)*(width-10)/(end-start);
    const y=value=>height-7-(value-min)*(height-14)/(max-min||1);
    ctx.lineWidth=1;ctx.strokeStyle='#6b7268';ctx.setLineDash([4,4]);ctx.beginPath();
    ctx.moveTo(0,y(reference));ctx.lineTo(width,y(reference));ctx.stroke();
    ctx.setLineDash([]);ctx.lineWidth=2;ctx.strokeStyle=color;ctx.beginPath();
    rows.forEach((row,i)=>i?ctx.lineTo(x(row[0]),y(row[column])):ctx.moveTo(x(row[0]),y(row[column])));ctx.stroke();
    const selected=state().cursor,point=r.rows[indexFor(r,selected)];
    if(point){
      ctx.lineWidth=1;ctx.strokeStyle='#1c342c';ctx.beginPath();ctx.moveTo(x(selected),0);ctx.lineTo(x(selected),height);ctx.stroke();
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(selected),y(point[column]),3.5,0,2*Math.PI);ctx.fill();
    }
  }
  function updateCursor() {
    const r=run(),s=state(),sample=sourceRow(r,s.cursor);
    const first=r.rows[0][0],last=r.rows.at(-1)[0];
    if(!sample)return;
    el('counter').value=s.cursor;el('scrub').value=s.cursor;
    const start=Math.max(first,Math.min(last-140,r.alarm-20));
    // Keep the alarm window fixed while exploring nearby samples, then follow the cursor.
    const left=s.cursor<start||s.cursor>start+140?Math.max(first,Math.min(last-140,s.cursor-70)):start;
    drawTrace('obsc-chart',1,r.obsc,'#187459',left,left+140);
    drawTrace('mic-chart',2,r.mic,'#a95626',left,left+140);
    el('plot-note').textContent=t('Counter '+left+' to '+(left+140)+' s. The dashed line marks the workbook value and the vertical line marks your row.',
      'సమయ సూచిక '+left+' నుంచి '+(left+140)+' s వరకు · గీతల వరుస వర్క్‌బుక్ విలువను, నిలువు గీత ఎంచుకున్న వరుసను చూపుతాయి.');
    el('raw-obsc').textContent=t('Obscuration ','కాంతి క్షీణత ')+sample.obsc_pct_per_ft.toFixed(3)+' %/ft';
    el('raw-mic').textContent='MIC '+sample.mic_pa.toFixed(2)+' pA';
    el('scrub').setAttribute('aria-valuetext',sample.counter_s+' s · '+el('raw-obsc').textContent+' · '+el('raw-mic').textContent);
    el('raw-locator').textContent=r.file+' · '+t('line ','వరుస ')+sample.tsv_line;
  }
  function updateRecord() {
    let attempts=0,completed=0,rowsSubmitted=0,rowsRight=0,reasonsSubmitted=0,reasonsRight=0;
    for(const [key,s] of Object.entries(cases)){
      attempts+=s.attempts.length;
      if(s.reasons.includes('alignment'))completed++;
      if(s.attempts.length){
        rowsSubmitted++;
        if(matches(data.runs[key],s.attempts[0]))rowsRight++;
      }
      if(s.reasons.length){
        reasonsSubmitted++;
        if(s.reasons[0]==='alignment')reasonsRight++;
      }
    }
    el('progress').textContent=t('Completed runs: '+completed+' / 2 · Submitted row checks: '+attempts,
      'పూర్తయిన ప్రయోగాలు: '+completed+' / 2 · సమర్పించిన వరుస తనిఖీలు: '+attempts);
    if(rowsSubmitted)el('progress').textContent+=t(' · Correct on first row check: ',' · మొదటి తనిఖీలో సరైన వరుసలు: ')+rowsRight+' / '+rowsSubmitted;
    if(reasonsSubmitted)el('progress').textContent+=t(' · Correct on first explanation: ',' · మొదటి ప్రయత్నంలో సరైన వివరణలు: ')+reasonsRight+' / '+reasonsSubmitted;
    el('download').disabled=attempts===0;
  }
  function renderFeedback() {
    const r=run(),s=state(),matched=foundCounter(s,r);
    let feedback='';
    if(s.feedback==='invalid')feedback=t('Enter a whole-number counter present in this file.','ఈ ఫైల్‌లో ఉన్న పూర్ణ సంఖ్యను సమయ సూచికగా నమోదు చేయండి.');
    if(s.feedback==='miss')feedback=t('That row differs from the workbook. Look for agreement in both channels, then check another counter.','ఈ వరుసలోని విలువలు వర్క్‌బుక్‌తో సరిపోలలేదు. రెండు కొలతలూ సరిపోలే మరో సమయ సూచికను తనిఖీ చేయండి.');
    if(s.feedback==='hit')feedback=t('Both channels match at raw counter '+matched+' s.','అసలు సమయ సూచిక '+matched+' s వద్ద రెండు కొలతలూ సరిపోలాయి.');
    el('feedback').textContent=feedback;
    el('interpretation').hidden=matched===undefined;
    el('found').textContent=matched===undefined?'':t('Raw counter '+matched+' s minus the reported '+r.alarm+' s gives '+formatCounter(r,matched)+' s.',
      'అసలు సమయ సూచిక '+matched+' s నుంచి నివేదించిన '+r.alarm+' s తీసివేస్తే వ్యత్యాసం '+formatCounter(r,matched)+' s.');
    const selected=s.reasons.at(-1);
    let message='';
    if(selected==='alignment')message=t('Correct. The two measurements identify the row. A physical response time needs independently documented start and alarm events.',
      'సరైనది. రెండు కొలతలూ సరిపోవడం వల్ల ఆ వరుసను గుర్తించగలం. భౌతిక ప్రతిస్పందన సమయం తెలుసుకోవాలంటే ప్రారంభ ఘట్టం, అలారం మోగిన ఘట్టం విడివిడిగా నమోదై ఉండాలి.');
    else if(selected)message=t('These records establish a time alignment for this run. Use the measured channels and reconsider what they can show.',
      'ఈ నమోదులు ఈ ప్రయోగానికి సమయ సూచికలు ఎలా సరిపోతాయో చూపుతాయి. కొలతల ఆధారంగా ఏ నిర్ణయానికి రావచ్చో మరోసారి ఆలోచించండి.');
    el('reason-feedback').textContent=message;
    document.querySelectorAll('[name=reason]').forEach(input=>{input.checked=input.value===s.choice;});
    el('peer-file').disabled=!s.reasons.includes('alignment');
    el('import-label').classList.toggle('disabled',el('peer-file').disabled);
    renderPeer();
  }
  function render() {
    document.documentElement.lang=language;document.title=t(baseText.title,te.title)+' · FIRST FIRE';
    document.querySelectorAll('[data-t]').forEach(n=>{n.textContent=reasonText(n.dataset.t);});
    el('language').value=language;document.querySelectorAll('[data-run]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.run===active)));
    const r=run();el('alarm').textContent=r.alarm+' s';el('summary-obsc').textContent=r.obsc.toFixed(3)+' %/ft';el('summary-mic').textContent=r.mic.toFixed(3)+' pA';
    for(const input of [el('scrub'),el('counter')]){input.min=r.rows[0][0];input.max=r.rows.at(-1)[0];}
    el('scrub').setAttribute('aria-label',reasonText('counter'));el('peer-file').setAttribute('aria-label',reasonText('upload'));
    el('check').disabled=false;renderSources();updateCursor();renderFeedback();updateRecord();syncURL();
  }
  function selectCounter(value) {
    const n=Number(value),valid=String(value).trim()!=='' && indexFor(run(),n)>=0;
    el('check').disabled=!valid;
    state().feedback=valid?'':'invalid';
    if(valid){state().cursor=n;updateCursor();}
    renderFeedback();
  }
  el('language').addEventListener('change',()=>{language=el('language').value;render();});
  document.querySelectorAll('[data-run]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.run;el('peer-file').value='';render();}));
  for(const input of [el('scrub'),el('counter')])input.addEventListener('input',()=>selectCounter(input.value));
  el('check').addEventListener('click',()=>{
    const s=state();s.attempts.push(s.cursor);s.feedback=matches(run(),s.cursor)?'hit':'miss';renderFeedback();updateRecord();
  });
  el('reason-form').addEventListener('change',e=>{state().choice=e.target.value;});
  el('reason-form').addEventListener('submit',e=>{
    e.preventDefault();const s=state();if(foundCounter(s,run())===undefined)return;
    if(!s.choice){el('reason-feedback').textContent=t('Choose an explanation first.','ముందుగా ఒక వివరణను ఎంచుకోండి.');return;}
    s.reasons.push(s.choice);renderFeedback();updateRecord();
  });
  const format='FIRST-FIRE-NIST-classroom-v1';
  function exportRun(key) {
    const r=data.runs[key],s=cases[key];
    return {case:key,unit:data.unit,workbook_sheet:data.sheet,workbook_cells:r.cells,reported_alarm_s:r.alarm,
      workbook_obsc_pct_per_ft:r.obsc,workbook_mic_pa:r.mic,file:r.file,sha256:r.sha256,
      checks:s.attempts.map(n=>({...sourceRow(r,n),matches_both:matches(r,n),raw_minus_reported_s:n-r.alarm})),
      interpretations:[...s.reasons],first_check_correct:s.attempts.length?matches(r,s.attempts[0]):null,
      first_interpretation_correct:s.reasons.length?s.reasons[0]==='alignment':null};
  }
  el('download').addEventListener('click',()=>{
    // A portable case route omits the learner's local file path and hosting origin.
    const record={format,mode:'anonymous local practice',language,case_link:'classroom.html?case='+active+'&lang='+language,unit:data.unit,
      archive_sha256:data.room_sha256,summary_sha256:data.summary_sha256,
      runs:Object.keys(cases).filter(key=>cases[key].attempts.length).map(exportRun)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='first-fire-classroom.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function renderPeer() {
    const peer=state().peer;let result='';
    if(peer==='invalid')result=t('This file has no valid practice attempt for this run and source revision.',
      'ఈ ఫైల్‌లో ఈ ప్రయోగానికి, ఈ మూల ఫైల్ సంస్కరణకు సరిపోయే అభ్యాస ప్రయత్నం లేదు.');
    else if(peer) {
      const ours=state().attempts[0],theirs=peer.counter;
      result=t('First row checked: yours '+ours+' s, theirs '+theirs+' s. Their row '+(matches(run(),theirs)?'matches':'does not match')+' both workbook readings.',
        'మొదట తనిఖీ చేసిన వరుస: మీది '+ours+' s, వారిది '+theirs+' s. వారి వరుసలోని రెండు కొలతలూ వర్క్‌బుక్‌తో '+(matches(run(),theirs)?'సరిపోలాయి.':'సరిపోలలేదు.'));
    }
    el('peer-status').textContent=result;
  }
  el('peer-file').addEventListener('change',async()=>{
    const key=active,s=cases[key],r=data.runs[key],file=el('peer-file').files[0];if(!file)return;
    try{
      if(file.size>1024*1024)throw Error();
      const p=JSON.parse(await file.text());
      if(p.format!==format||p.archive_sha256!==data.room_sha256||p.summary_sha256!==data.summary_sha256||!Array.isArray(p.runs))throw Error();
      const entry=p.runs.find(v=>v?.case===key && v.sha256===r.sha256);
      const n=entry?.checks?.[0]?.counter_s;
      if(!Number.isInteger(n)||indexFor(r,n)<0)throw Error();
      s.peer={counter:n};
    }catch{s.peer='invalid';}
    if(active===key)renderPeer();
  });
  if(window.ResizeObserver)new ResizeObserver(updateCursor).observe(el('obsc-chart'));
  else window.addEventListener('resize',updateCursor);
  render();
})();
