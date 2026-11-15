/* Hybrid retrieval over published case reviews and NASA investigation descriptions. */
(() => {
  'use strict';
  const noise = new Set('a an is are was were where which who we it in on to how the why can with or from what do does of for and at after during when have had nasa fire evidence experiment results'.split(' '));
  const words = text => String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
  const terms = text => words(text).filter(w => !noise.has(w));
  const context = {
    sibal:'spread speed persistence duration lifetime gravity short test early observation still burning oxygen history aircraft sounding rocket',
    saffire:'component damage ignition burn black burnt cloth charred acrylic strip protecting fabric soot discoloration',
    flex:'invisible cool flame droplets suppression extinguishment endpoint carbon dioxide evaporation after visible flame went out',
    same:'smoke alarms warning detector sensor missed alarms false negative wire insulation particles threshold',
    cfig:'oxygen concentration oxygen fraction burner jet injection ambient cabin air inside out inverse ethane stream',
    ices:'opposite limits Earth extrapolation screening tape plastics terrestrial qualification oxygen cutoff materials',
    fm2:'prediction future lunar Moon material thresholds forecast four burns likelihood uncertainty scoring'
  };
  let docs, modelPromise;
  function corpus() {
    if(docs) return docs;
    docs = [...window.FF.cases.map(c => ({type:'Case',title:c.short+' · '+c.title,url:'#case/'+c.id,body:c.question+' '+c.record+' '+c.reason+' '+c.limit,lead:c.question,keywords:context[c.id]||''})),
      ...window.FF.investigations.map(i => ({type:'Investigation',title:i.name+' · '+i.accession,url:'#data?study='+i.accession,body:i.title+' '+i.summary+' '+i.coverage,lead:i.summary,keywords:i.hardware+' '+i.category+' '+i.name}))];
    for (const d of docs) { d.tokens=terms(d.title+' '+d.title+' '+d.body+' '+d.keywords); d.count=new Map();for(const w of d.tokens)d.count.set(w,1+(d.count.get(w)||0));}
    return docs;
  }
  function loadModel(){
    if(window.FFSearchVectors) return Promise.resolve(window.FFSearchVectors);
    if(!modelPromise) modelPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='search-vectors.js';s.onload=()=>resolve(window.FFSearchVectors);s.onerror=()=>{s.remove();modelPromise=null;reject(Error('Model unavailable'));};document.head.append(s);});
    return modelPromise;
  }
  let matrix, scales;
  function bytes(encoded){return Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0)).buffer;}
  function encode(txt,model){
    if(!matrix){matrix=new Int8Array(bytes(model.weights));scales=new Float32Array(bytes(model.scales));}
    const v=new Float64Array(model.dim), ids=[];
    for(const w of words(txt).flatMap(w=>w.split('-'))){let start=0,parts=[];while(start<w.length){let end=w.length,id;while(end>start){const token=(start?'##':'')+w.slice(start,end);if(Object.hasOwn(model.vocab,token)){id=model.vocab[token];break;}end--;}if(id===undefined){parts=[];break;}parts.push(id);start=end;}ids.push(...parts);}
    for(const id of ids)for(let j=0;j<v.length;j++)v[j]+=matrix[id*v.length+j]*scales[id];
    let norm=Math.sqrt(v.reduce((v,x)=>v+x*x,0));if(norm)for(let i=0;i<v.length;i++)v[i]/=norm;return v;
  }
  async function search(query){
    const rows=corpus(), keys=[...new Set(terms(query))];if(!keys.length)return {items:[],semantic:false};
    let model;
    const device=window.navigator;
    const lite=window.FFAwareness ? window.FFAwareness.tier()==='lite' : device?.connection?.saveData || (device?.deviceMemory>0 && device.deviceMemory<=2);
    if(!lite){try{model=await loadModel();}catch{model=null;}}
    const avg=rows.reduce((n,d)=>n+d.tokens.length,0)/rows.length;
    const queryVec=model?encode(query,model):null;
    const ranked=rows.map(d=>{
      let lexical=0,matches=0;
      for(const k of keys){const tf=d.count.get(k)||0;if(!tf)continue;matches++;const df=rows.filter(x=>x.count.has(k)).length;const idf=Math.log(1+(rows.length-df+.5)/(df+.5));lexical+=idf*tf*2.2/(tf+1.2*(.25+.75*d.tokens.length/avg));}
      let semantic=0;if(model){if(!d.vec)d.vec=encode(d.title+' '+d.keywords+' '+d.lead,model);for(let i=0;i<d.vec.length;i++)semantic+=queryVec[i]*d.vec[i];}
      const score=(1-Math.exp(-lexical/5))*.61+Math.max(0,semantic)*.39;
      return {...d,score,semantic,matches};
    }).filter(i=>i.matches>0||i.semantic>.52).sort((a,b)=>b.score-a.score);
    return {items:ranked.slice(0,8),semantic:!!model};
  }
  window.FFSearch={search};
})();
