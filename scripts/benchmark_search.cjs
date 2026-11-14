#!/usr/bin/env node
/* Reproduce the authored search probes with the shipping search function. No network, dependencies, or trained-on-test weights. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file));
const json = file => JSON.parse(read(file));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

// Frozen before the first run. Each target is a case route rather than the whole investigation.
const probes = [
  ['sibal','SIBAL','Does slower spread imply a shorter flame lifetime in lunar gravity?'],
  ['sibal','SIBAL','The cloth was still alight when the plane finished its arc. Can that run tell us when it went out?'],
  ['sibal','SIBAL','Fabric on a spinning rocket was compared with an upright sample on Earth. Which outcome lasted longer?'],
  ['saffire','Saffire-II','Did the darkened Nomex catch fire beside the acrylic in Saffire-II?'],
  ['saffire','Saffire-II','A 140 second burn was reported for the assembly. Which piece provided the fuel?'],
  ['saffire','Saffire-II','Is discoloration of a neighboring fabric enough to establish its ignition?'],
  ['flex','FLEX','Does the end of a visible heptane flame mean combustion has stopped?'],
  ['flex','FLEX','A droplet shrank after the camera went dark. What can be inferred about the chemical endpoint?'],
  ['flex','FLEX','Distinguish a vapor cloud with inconclusive evidence from a sustained reaction after the glow disappeared.'],
  ['same','SAME','Which smoke escaped notice by the station light scattering alarm?'],
  ['same','SAME','Can microscopy of particles tell us whether the installed warning instrument triggered?'],
  ['same','SAME','Would a strong response to silicone rubber establish that the sensor also catches emissions from fluoropolymer insulation?'],
  ['cfig','CFI-G','In the inverse ethane case, was 85 percent oxygen in the chamber or the burner?'],
  ['cfig','CFI-G','Two trials fed the same oxidiser mixture through a porous sphere. Why did only one light?'],
  ['cfig','CFI-G','Which measurements count toward a search for oxygen rich air surrounding the fuel?'],
  ['ices','ICES','Did all materials shift their oxygen limit the same way in short lunar-gravity tests?'],
  ['ices','ICES','Ground screening made conflicting errors for plastics. Which result was actually measured?'],
  ['ices','ICES','Can the conservative correction in table two stand in for an observed ignition boundary?']
];
const negatives = [
  'What is the next train departure from Berlin to Paris?',
  'At what exact oxygen concentration will my new untested spacesuit liner ignite on the Moon?',
  'What is the latest flight result for every lunar fabric burn?',
  'the and an'
];
function engine(withModel) {
  const built = ['records.js','model.js','search.js'].every(name => fs.existsSync(path.join(ROOT,'docs',name)));
  const window = {};
  const context = vm.createContext({window,atob,document:{
    createElement:()=>({remove(){}}),head:{append:script=>script.onerror()}
  }});
  if (built) {
    vm.runInContext(read('docs/records.js').toString(),context);
    if (withModel) vm.runInContext(read('docs/model.js').toString(),context);
  } else {
    window.FF = {cases:json('data/cases.json'),investigations:json('data/investigations.json')};
    if (withModel) {
      const tensor=read('data/model/model.safetensors');
      const len=Number(tensor.readBigUInt64LE());
      const metadata=JSON.parse(tensor.subarray(8,8+len)).embeddings;
      const vocab=json('data/model/tokenizer.json').model.vocab;
      const weights=tensor.subarray(8+len);
      if(metadata.dtype!=='F32'||metadata.shape[0]*metadata.shape[1]*4!==weights.length) throw Error('Unexpected model shape');
      window.FFModel={dim:metadata.shape[1],vocab,weights:weights.toString('base64')};
    }
  }
  const source=read(built?'docs/search.js':'site/search.js');
  vm.runInContext(source.toString(),context);
  return {search:window.FFSearch.search,source:built?'docs':'source-equivalent',sourceHash:hash(source),
    corpusHash:hash(JSON.stringify([window.FF.cases,window.FF.investigations])),docs:window.FF.cases.length+window.FF.investigations.length};
}
async function main(){
  const keyword=engine(false), hybrid=engine(true);
  const results=[],sanity=[];
  for(const [target,,query] of probes){
    const row={target,query};
    for(const [mode,e] of Object.entries({keyword,hybrid})){
      const response=await e.search(query);
      if(response.semantic !== (mode==='hybrid')) throw Error('Unexpected semantic mode');
      const found=response.items.findIndex(d=>d.url==='#case/'+target);
      row[mode]={rank:found<0?null:found+1,top:response.items[0]?.url??null};
    }
    results.push(row);
  }
  for(const query of negatives) {
    const row={query};
    for(const [mode,e] of Object.entries({keyword,hybrid})) {
      const r=await e.search(query);
      row[mode]={returned:r.items.length,top:r.items[0]?.url??null};
    }
    sanity.push(row);
  }
  const metrics={};
  for(const mode of ['keyword','hybrid']){
    const ranks=results.map(r=>r[mode].rank??Infinity);
    metrics[mode]={
      top1:ranks.filter(r=>r===1).length,top3:ranks.filter(r=>r<=3).length,
      top8:ranks.filter(r=>r<=8).length,mrr8:ranks.reduce((sum,rank)=>sum+1/rank,0)/ranks.length
    };
  }
  console.log(JSON.stringify({mode:hybrid.source,documents:hybrid.docs,query_count:probes.length,
    search_sha256:hybrid.sourceHash,corpus_sha256:hybrid.corpusHash,probe_sha256:hash(JSON.stringify({probes,negatives})),metrics,results,sanity},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
