/* Reading preferences for the small judging page. Parser libraries are loaded from the
   bundled site only after a user chooses a file. The original document stays in memory. */
(() => {
  'use strict';
  const deskKey = 'first-fire.investigation-desk.v1';
  const fieldKey = 'first-fire.judge-reader-field.v1';
  const reader = window.FFReaderDevice;
  const tiers = ['auto','lite','standard','pro'];
  const parsers = new Set(['vendor/resume/pdfjs-classic.js','vendor/resume/jszip.min.js']);
  const parserLoads = new Map();
  function loadParser(path) {
    if (!parsers.has(path)) return Promise.reject(Error('Unknown document format.'));
    if (!parserLoads.has(path)) parserLoads.set(path,new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = path;
      script.onload = resolve;
      script.onerror = () => { parserLoads.delete(path); script.remove(); reject(Error('The local document reader could not load. You can select the reading level yourself.')); };
      document.head.append(script);
    }));
    return parserLoads.get(path);
  }
  function readDesk() {
    const raw = sessionStorage.getItem(deskKey);
    if (!raw) return {version:1,records:{},active:false};
    const data = JSON.parse(raw);
    if (data?.version === 1 && data.records && typeof data.records === 'object' && !Array.isArray(data.records)) return data;
    return null;
  }
  function preferences() {
    const result = {};
    try {
      const desk = readDesk();
      if (Object.hasOwn(reader.levels,desk?.level)) result.level = desk.level;
      if (tiers.includes(desk?.display)) result.display = desk.display;
    } catch { /* The user can still choose settings when tab storage is unavailable. */ }
    return result;
  }
  function share(settings) {
    try {
      const desk = readDesk();
      if (!desk) return;
      if (Object.hasOwn(reader.levels,settings.level)) desk.level = settings.level;
      if (tiers.includes(settings.display)) desk.display = settings.display;
      if (typeof settings.question === 'string' && settings.question.trim()) {
        desk.question = settings.question.trim().slice(0,480);
        desk.active = true;
      }
      sessionStorage.setItem(deskKey,JSON.stringify(desk));
    } catch { /* The current page keeps its own preferences in memory. */ }
  }
  function savedField() {
    try { const value = sessionStorage.getItem(fieldKey); if (Object.hasOwn(reader.examples,value)) return value; } catch {}
    return 'general';
  }
  function element(tag,text) {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    return el;
  }
  function labeled(text,input) {
    const label=element('label',text);
    label.append(input);
    return label;
  }
  function mount() {
    const host=document.getElementById('reader-profile');
    if (!host || !reader || host.childElementCount) return;
    const box=element('details'), field=element('select'), upload=element('input');
    const level=document.getElementById('level'), message=element('p');
    const example=element('button'), note=element('p');
    const question=document.getElementById('question'), form=document.getElementById('question-form');
    let generation=0;
    for (const [id,entry] of Object.entries(reader.examples)) field.add(new Option(entry.label,id));
    field.value=savedField();
    upload.type='file';upload.accept='.pdf,.docx,.txt,.md';
    message.setAttribute('role','status');example.type='button';example.className='quiet';
    function showExample() {
      note.textContent=reader.examples[field.value].note;
      example.textContent=reader.examples[field.value].question;
      try {sessionStorage.setItem(fieldKey,field.value);} catch {}
    }
    field.onchange=() => {generation++;message.textContent='';showExample();};
    level.addEventListener('change',()=>{generation++;message.textContent='';});
    example.onclick=() => {question.value=reader.examples[field.value].question;question.dispatchEvent(new Event('input',{bubbles:true}));form.requestSubmit();};
    upload.onchange=async() => {
      const file=upload.files[0]; const call=++generation;
      upload.value='';if (!file) return;
      message.textContent='Reading the document on this device…';
      try {
        const suggestion=reader.suggest(await reader.extract(file,loadParser));
        if (generation!==call || !host.isConnected) return;
        field.value=suggestion.field;level.value=suggestion.level;
        level.dispatchEvent(new Event('change',{bubbles:true}));
        share({level:suggestion.level});showExample();message.textContent=suggestion.reason;
      } catch(e) {if (generation===call) message.textContent=e.message || 'Could not read the document. Choose a level directly.';}
    };
    box.append(element('summary','Choose examples for your field'),labeled('Field',field),note,example,
      labeled('Suggest a reading level from a document',upload),
      element('p','Optional PDF, Word (.docx), text or Markdown under 8 MB. The browser reads the document locally. Only your level and example field are remembered in this tab.'),message);
    host.append(box);showExample();
  }
  window.FFJudgeReader={preferences,share};
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
