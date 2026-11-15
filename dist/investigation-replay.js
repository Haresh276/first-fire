/* Reproduce submitted calculations using this release's local data and solvers. */
(() => {
  'use strict';
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const units = {position:'cm', oxygen:'wet vol%', co2:'wet vol%', water:'wet vol%', burned:'g', chemical:'kJ', electrical:'kJ', energy:'kJ'};
  const tableURL = 'https://doi.org/10.60555/0t15-1z43';
  const reportURL = 'https://ntrs.nasa.gov/api/citations/20170008805/downloads/20170008805.pdf#page=21';
  const forecastDigest = '9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3';

  function checklist(title) {
    const checks = [];
    function compare(path, saved, current) {
      if (Array.isArray(current) || object(current)) {
        if (Array.isArray(current) !== Array.isArray(saved) || (!object(saved) && !Array.isArray(saved))) {
          checks.push({path,status:'different',saved:'missing or different structure',current:'structured value'});return;
        }
        const keys=Object.keys(current);
        for(const k of keys) compare(path+'.'+k,saved[k],current[k]);
        for(const k of Object.keys(saved)) if(!Object.hasOwn(current,k))
          checks.push({path:path+'.'+k,status:'different',saved:'additional field',current:'absent'});
        return;
      }
      const same=typeof current==='number' ? Number.isFinite(saved) && Math.abs(saved-current)<=1e-9*Math.max(1,Math.abs(current)) : saved===current;
      checks.push({path,status:same?'match':'different',saved:typeof saved==='object'&&saved!==null?'structured value':saved??(saved===null?null:'missing'),current});
    }
    return {title,checks,compare};
  }
  function documentItems(file) {
    if (!object(file)) throw Error('Choose a FIRST FIRE investigation or cabin comparison JSON file.');
    const items=[];
    function pair(value) {
      if(!object(value) || value.schema!=='first-fire.cabin-comparison.v1' || !object(value.baseline?.entry?.record))throw Error('The file contains an incomplete cabin comparison.');
      items.push({tool:'physics',title:'Frozen baseline',record:value.baseline.entry.record});
      if(value.trial!=null){
        if(!object(value.trial?.entry?.record))throw Error('The saved comparison trial is incomplete.');
        items.push({tool:'physics',title:'Comparison trial',record:value.trial.entry.record});
        items.push({tool:'cabin-comparison',title:'Paired differences',record:value});
      }
    }
    if(file.schema==='first-fire.cabin-comparison.v1') pair(file);
    else if(file.schema==='first-fire.investigation.v1' && object(file.results)){
      for(const [tool,entry] of Object.entries(file.results)){
        if(!object(entry?.record))throw Error('A saved result is incomplete.');
        items.push({tool,title:typeof entry.title==='string'?entry.title:tool,record:entry.record});
      }
      if(file.trialComparison!=null)pair(file.trialComparison);
    }else throw Error('Choose a FIRST FIRE investigation or cabin comparison JSON file.');
    return items;
  }
  function testCabin(record,check,engine,weights) {
    if (!object(record.inputs) || !Number.isInteger(record.seconds) || record.seconds<0 || record.seconds>engine.horizon || record.seconds%engine.interval)throw Error('Invalid saved cabin inputs or sample time.');
    const message=engine.validate(record.inputs);
    if(message)throw Error(message);
    const run=engine.run(record.inputs),i=record.seconds/engine.interval,sample=run.trace[i];
    check.compare('record kind',record.kind,'simulated');
    check.compare('units',record.units,units);
    check.compare('outputs',record.outputs,{...sample,chassisWeightN:run.chassisWeight,idealFlameK:run.flame.kelvin});
    if(record.reference!=null){
      if (!Object.hasOwn(engine.saffireSpeeds,record.reference))throw Error('Unrecognized measured-speed attribution.');
      const row=record.reference==='concurrent'?'PSI-98:1:2':'PSI-98:1:3';
      check.compare('imposed speed (cm/s)',record.inputs.speed,engine.saffireSpeeds[record.reference]/10);
      const sources=Array.isArray(record.sources)?record.sources:[];
      check.compare('Saffire-I row and dataset',sources.some(source=>source?.row===row && source?.url===tableURL),true);
      check.compare('NASA slide 21',sources.some(source=>source?.url===reportURL),true);
    }
    if (record.liquidStatus === 'deferred in Lite mode') {
      check.compare('deferred liquid output', record.liquid, null);
      check.note = 'This trial deferred the liquid network. Only the cabin calculation was rerun.';
      return;
    }
    const legacy = !Object.hasOwn(record, 'liquidStatus');
    if (legacy && record.liquid == null) {
      check.note = 'This legacy record has no liquid-network result to replay.';
      return;
    }
    if (!legacy && !['evaluated', 'outside training domain'].includes(record.liquidStatus)) {
      throw Error('Unrecognized saved liquid-network status.');
    }
    if (!weights) throw Error('The trained liquid-network weights are unavailable.');
    const pred = engine.liquidPrediction(record.inputs, weights);
    check.compare('liquid status', legacy ? 'evaluated' : record.liquidStatus, pred ? 'evaluated' : 'outside training domain');
    check.compare('liquid output', record.liquid, pred ? {
      oxygenPercent:pred[i], errorPercentagePoints:Math.abs(pred[i]-sample.oxygen), training:'synthetic cabin runs'
    } : null);
  }
  function audit(item,env){
    const check=checklist(item.title),r=item.record;
    try{
      if(item.tool==='physics')testCabin(r,check,env.physics,env.weights);
      else if(item.tool==='cabin-comparison'){
        const analysis=env.pair(r.baseline,r.trial);
        check.compare('paired analysis',r.analysis,analysis);
      }else if(item.tool==='atlas'){
        const actual=env.atlas(r.id);
        if(!actual)throw Error('This archive does not contain that source row.');
        check.compare('archive',r,actual);
      }else if(item.tool==='rover-design'){
        const actual=env.rover(r.scenario);
        check.compare('solver fingerprint',r.modelSHA256,actual.modelSHA256);
        check.compare('results',r.result,actual.result);
        check.compare('source receipts',r.sources,actual.sources);
        check.compare('interpretation boundary',r.boundary,actual.boundary);
        if(r.comparison||actual.comparison)check.compare('reference scenario',r.comparison,actual.comparison);
      }else return {title:item.title,status:'included',checks:[],note:'Saved record included. This instrument has no automatic replay here.'};
    }catch(error){return {title:item.title,status:'unavailable',checks:check.checks,note:error.message};}
    return {title:item.title,status:check.checks.some(x=>x.status!=='match')?'different':'match',checks:check.checks,note:check.note};
  }

  function panel(){
    const e=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
    const box=e('section');box.className='panel aw-panel';box.id='investigation-replay';
    const title=e('h2','Replay a saved investigation');
    const hint=e('p','Open an exported JSON file to recompute cabin or modular rover results and check pinned Atlas rows against this release.');
    const label=e('label','Investigation or comparison JSON');label.className='field';
    const input=e('input');input.type='file';input.accept='.json,application/json';label.append(input);
    const status=e('p');status.setAttribute('role','status');
    const reports=e('div');reports.className='aw-list';
    let generation=0;
    input.addEventListener('change',async()=>{
      const current=++generation,file=input.files[0];reports.replaceChildren();status.textContent='';
      if(!file)return;
      try{
        status.textContent='Reading saved records…';
        const data=JSON.parse(await file.text()),items=documentItems(data),assets=new Set();
        for(const {tool,record} of items){
          if(tool==='physics'){
            assets.add('physics-lab.js');
            if(record.liquid!=null || ['evaluated','outside training domain'].includes(record.liquidStatus))assets.add('cabin-liquid-weights.js');
          }
          if(tool==='atlas')assets.add('observation-rows.js');
          if(tool==='rover-design'){assets.add('rover-model.js');assets.add('rover-integration.js');}
        }
        for(const asset of assets)await window.FFLoadAsset(asset);
        if(generation!==current || !box.isConnected)return;
        const env={physics:window.FFPhysics,weights:window.FFCabinLiquid,pair:window.FFTrialComparison.compare,
          atlas:id=>{const a=window.FFAtlasEvidence,row=a.archive().rows.find(row=>row.id===id);return row?a.investigationResult(row).record:null;},
          rover:scenario=>window.FFRoverDesign.buildRecord(scenario,window.FFRoverData,window.FFRoverModel).record};
        const results=items.map(item=>audit(item,env));
        if(data.schema==='first-fire.investigation.v1' && data.signedForecastSHA256!==forecastDigest){
          results.unshift({title:'Signed forecast reference',status:'different',checks:[],note:'The saved forecast fingerprint differs from this release.'});
        }
        if(data.question)reports.append(e('p','Saved question · '+String(data.question)));
        const words={match:'Reproduced',different:'Difference found',unavailable:'Could not replay',included:'Recorded only'};
        for(const result of results){
          const article=e('article');article.className='aw-record';
          article.append(e('h3',result.title),e('strong',words[result.status]));
          if(result.note)article.append(e('p',result.note));
          const failed=result.checks.filter(check=>check.status!=='match');
          if(failed.length){
            const dl=e('dl');dl.className='aw-metrics';
            for(const f of failed){dl.append(e('dt',f.path),e('dd','Saved '+String(f.saved)+' · current '+String(f.current)));}
            article.append(dl);
          }else if(result.status==='match')article.append(e('p',result.checks.length+' recorded values and fields matched.'));
          reports.append(article);
        }
        const reproduced=results.filter(row=>row.status==='match').length;
        status.textContent=results.length?reproduced+' of '+results.length+' items reproduced. Numeric tolerance is one part in a billion, with a 10⁻⁹ absolute floor.':'This file contains no saved tool results.';
      }catch(err){if(generation===current)status.textContent=err instanceof SyntaxError?'The selected file is not valid JSON.':err.message;}
    });
    box.append(title,hint,label,status,reports);return box;
  }
  const api={documentItems,audit,panel};
  if(typeof window!=='undefined')window.FFInvestigationReplay=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
