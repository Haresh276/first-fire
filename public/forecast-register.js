/* Work with a separate material forecast and preserve its original byte identity. */
(() => {
  'use strict';
  const schema='first-fire.material-forecast.v1';
  function trials(text){
    const ids=new Set(),rows=text.trim().split(/\r?\n/);
    if(rows.length>40)throw Error('Use up to 40 trials.');
    return rows.map((row,i)=>{
      const fields=row.split(',').map(s=>s.trim());
      if(fields.length!==3||fields.some(s=>!s))throw Error('Enter three comma-separated values on line '+(i+1)+'.');
      const [id,p,c]=fields,probability=Number(p),comparator=Number(c);
      if(ids.has(id)||id.length>80)throw Error('Use a unique trial identifier of up to 80 characters.');
      if(![probability,comparator].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Use probabilities from zero to one.');
      ids.add(id);return {id,probability,comparator};
    });
  }
  function validate(obj){
    if(obj?.schema!==schema||!['material','source','event'].every(k=>typeof obj[k]==='string'&&obj[k].trim())||!Array.isArray(obj.trials)||!obj.trials.length||obj.trials.some(t=>typeof t?.id!=='string'||/[\r\n,]/.test(t.id)||typeof t.probability!=='number'||typeof t.comparator!=='number'))throw Error('Choose a FIRST FIRE material forecast file.');
    trials(obj.trials.map(t=>[t.id,t.probability,t.comparator].join(',')).join('\n'));
    return obj;
  }
  function score(burns,outcomes){
    if(burns.length!==outcomes.length||outcomes.some(o=>!['yes','no','pending','void'].includes(o)))throw Error('Each trial needs one outcome.');
    let resolved=0,model=0,reference=0;
    outcomes.forEach((outcome,i)=>{if(outcome==='pending'||outcome==='void')return;resolved++;const y=Number(outcome==='yes');model+=(burns[i].probability-y)**2;reference+=(burns[i].comparator-y)**2;});
    return {total:burns.length,resolved,modelBrier:resolved?model/resolved:null,comparatorBrier:resolved?reference/resolved:null};
  }
  if(typeof module!=='undefined')module.exports={trials,validate,score};
  if(typeof document==='undefined')return;
  const byId=id=>document.getElementById(id),el=(t,text)=>{const n=document.createElement(t);if(text)n.textContent=text;return n;};
  const bytes=obj=>new TextEncoder().encode(JSON.stringify(obj,null,2)+'\n');
  const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
  function download(name,b){const url=URL.createObjectURL(new Blob([b],{type:'application/json'})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  byId('make').onsubmit=async e=>{e.preventDefault();try{const {trials:lines,...fields}=Object.fromEntries(new FormData(e.target));
    const b=bytes(validate({schema,...fields,trials:trials(lines),createdUTC:new Date().toISOString(),scoring:'Paired mean squared probability error on resolved yes/no trials. Pending or void trials are excluded. Report coverage.'}));
    const h=await digest(b);download('material-forecast-'+h.slice(0,12)+'.json',b);byId('created').textContent='SHA-256 '+h+'. The creation date uses this device’s clock. Obtain an independent timestamp on these bytes before outcome publication.';
  }catch(err){byId('created').textContent=err.message;}};
  let forecast,hash,revision=0;
  byId('file').onchange=async e=>{const generation=++revision,f=e.target.files[0];forecast=null;byId('resolve').hidden=true;byId('score').textContent='';byId('outcomes').replaceChildren();byId('id').textContent='';if(!f)return;
    try{if(f.size>250000)throw Error('Choose a forecast smaller than 250 kB.');const b=await f.arrayBuffer(),o=validate(JSON.parse(new TextDecoder().decode(b))),h=await digest(b);
      if(generation!==revision)return;forecast=o;hash=h;byId('id').textContent=o.material+' · SHA-256 '+h+' · '+o.event;for(const t of o.trials){const fs=el('fieldset'),sel=el('select'),label=el('label','Outcome');
        for(const value of ['pending','yes','no','void'])sel.append(new Option(value,value));label.append(sel);fs.append(el('legend',t.id),label);
        for(const [kind,type] of [['Official source URL','url'],['Observation date','date'],['Locator and decision rationale','text']]){const l=el('label',kind),input=el('input');input.type=type;l.append(input);fs.append(l);}
        sel.onchange=()=>fs.querySelectorAll('input').forEach(n=>n.required=sel.value!=='pending');byId('outcomes').append(fs);}byId('resolve').hidden=false;
    }catch(err){if(generation===revision)byId('id').textContent=err.message;}};
  byId('resolve').onsubmit=e=>{e.preventDefault();if(!forecast)return;const outcomes=[...byId('outcomes').children].map((fs,i)=>{const [source,date,reason]=[...fs.querySelectorAll('input')].map(n=>n.value.trim());return {id:forecast.trials[i].id,outcome:fs.querySelector('select').value,source,date,reason};});
    if(outcomes.some(o=>o.outcome!=='pending'&&(!/^https?:\/\//i.test(o.source)||!o.date||!o.reason))){byId('score').textContent='Include a public source, date and decision rationale for each resolved or void trial.';return;}
    const result=score(forecast.trials,outcomes.map(r=>r.outcome));byId('score').textContent=result.resolved+' of '+result.total+' resolved. '+(result.resolved?'Mean Brier score '+result.modelBrier.toFixed(4)+' · comparator '+result.comparatorBrier.toFixed(4)+'.':'Scores are pending.');
    download('material-resolution-'+hash.slice(0,12)+'.json',bytes({schema:'first-fire.material-resolution.v1',forecastSHA256:hash,outcomes,result}));
  };
})();
