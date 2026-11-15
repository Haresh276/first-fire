/* Research workspace adapter for the independently maintained rover-design/model.mjs calculator. */
(() => {
  'use strict';

  const tool = 'rover-design';
  const boundary = 'These are modeled engineering budgets. Inputs and hybrid hardware interfaces are unverified. Flame spread, extinguishment and material qualification require matching measurements.';
  const partTitles = {cabin:'Cabin',chassis:'Chassis',wheels:'Wheel set',power:'Power supply',thermal:'Thermal control',
    lifeSupport:'Life support',access:'Crew access',detection:'Detector',suppression:'Suppression',material:'Material coupon',payload:'Payload'};
  const sectionTitles = {mobility:'Mass and wheel loading',power:'Electrical energy',thermal:'Radiator heat balance',
    air:'Cabin atmosphere and crew',coupon:'Material reaction',tracer:'Tracer and detector',flow:'Ventilation',
    suppression:'Suppression inventory',sourcing:'Material sourcing'};
  const exampleNames = {'lunar-cellulose':'Moon day · cellulose', 'lunar-pe':'Moon day · polyethylene', 'mars-night-pe':'Mars night · polyethylene'};
  const format = new Intl.NumberFormat('en-US',{maximumFractionDigits:3});
  const print = n => n == null ? 'Withheld' : typeof n === 'number' ? (n && Math.abs(n)<.001 ? n.toExponential(2) : format.format(n)) : String(n);
  const copy = v => structuredClone(v);

  function buildRecord(scenario, data, model) {
    const result = model.simulate(scenario, data.catalog, data.schema);
    const sources = result.sourceIds.map(id => {
      const row = data.sources.find(s => s.id===id);
      if (!row) throw Error('Missing source record: '+id);
      return {id, title:row.title, url:row.url, locator:row.locator, role:row.role, boundary:row.limits};
    });
    const baseline=data.examples['lunar-cellulose'], changedInputs=[];
    for(const [slot,part] of Object.entries(scenario.parts)) {
      if(part!==baseline.parts[slot]) changedInputs.push({field:'parts.'+slot,label:partTitles[slot],from:baseline.parts[slot],to:part});
    }
    for(const [key,value] of Object.entries(scenario.conditions)) {
      if(value===baseline.conditions[key]) continue;
      const spec=data.schema.properties.conditions.properties[key];
      changedInputs.push({field:'conditions.'+key,label:spec.title,from:baseline.conditions[key],to:value,unit:spec.unit||null});
    }
    const summary = scenario.conditions.world+' · '+scenario.conditions.phase+' · '+print(result.mobility.massKg)+' kg assembled · '+print(result.power.endWh)+' Wh stored at the end of the scenario';
    return {tool, title:scenario.name, summary, record:{kind:'simulated',schema:'first-fire.rover-design.v1',
      scenario:copy(scenario), result, sources, comparison:{reference:'lunar-cellulose',changedInputs}, modelSHA256:data.modelSHA256, boundary}};
  }
  function render(root) {
    const data=globalThis.FFRoverData, model=globalThis.FFRoverModel;
    const e=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
    const button=(text,action,cls='ghost')=>{const el=e('button',text,cls);el.type='button';el.onclick=action;return el;};
    const link=(text,href)=>{const a=e('a',text,'inlinebtn');a.href=href;return a;};
    function label(text,input) {const l=e('label',text,'field');input.setAttribute('aria-label',text);l.append(input);return l;}
    function select(entries) {const s=e('select');for(const [value,title] of entries)s.add(new Option(title,value));return s;}
    const wrap=e('div',null,'rd-lab'), header=e('header',null,'pagetitle');
    header.append(e('h1','Rover design lab'),e('p','Build a vehicle, change one condition and carry the calculated budgets and source records into your investigation.','sub'));
    root.replaceChildren(wrap); wrap.append(header);
    const first=data.examples['lunar-cellulose'];
    let scenario=copy(first), current=null;
    const previous=window.FFAwareness?.previous?.(tool)?.scenario;
    if(previous){try{model.simulate(previous,data.catalog,data.schema);scenario=copy(previous);}catch{/* Previous schemas can be incompatible. */}}
    const baseline=model.simulate(first,data.catalog,data.schema);
    const controls=e('section',null,'panel rd-inputs'), actions=e('div',null,'actions');
    const example=select([['','Current design'],...Object.entries(exampleNames)]), name=e('input');name.maxLength=80;
    example.value=previous?'':'lunar-cellulose';example.options[0].disabled=true;
    const status=e('p',null,'small');status.setAttribute('role','status');
    const partsBox=e('section',null,'panel rd-inputs'), conditionsBox=e('section',null,'panel rd-inputs');
    partsBox.append(e('h2','Selected parts'));conditionsBox.append(e('h2','Conditions'));
    const partWidgets=new Map(), fieldWidgets=new Map(), groups=new Map();
    function sync() {
      name.value=scenario.name;
      for(const [slot,w] of partWidgets){
        const id=scenario.parts[slot], p=data.catalog.parts.find(p=>p.slot===slot&&p.id===id);
        w.picker.value=id;w.alias.value=scenario.customNames?.[slot]||'';
        w.info.textContent=p.origin+' · '+p.scope;
      }
      for(const [key,field] of fieldWidgets)field.value=scenario.conditions[key]??'';
    }
    for(const slot of Object.keys(first.parts)){
      const choices=data.catalog.parts.filter(p=>p.slot===slot);
      const picker=select(choices.map(p=>[p.id,p.title])), info=e('p',null,'small'), alias=e('input');
      alias.type='text';alias.maxLength=80;
      const card=e('div',null,'rd-part'), details=e('details');details.append(e('summary','Source and custom name'),info,label('Custom '+partTitles[slot].toLowerCase()+' name',alias));
      card.append(label(partTitles[slot],picker),details);partsBox.append(card);partWidgets.set(slot,{picker,info,alias});
      picker.onchange=()=>{
        scenario=model.selectPart(scenario,slot,picker.value,data.catalog);
        if(scenario.customNames)delete scenario.customNames[slot];
        example.value='';sync();calculate();
      };
      alias.oninput=()=>{
        const names={...scenario.customNames}, value=alias.value.trim();
        if(value)names[slot]=value;else delete names[slot];
        scenario.customNames=names;example.value='';calculate();
      };
    }
    for(const [key,spec] of Object.entries(data.schema.properties.conditions.properties)){
      let group=groups.get(spec.group);
      if(!group){
        const details=e('details');details.append(e('summary',spec.group));group=e('div',null,'rd-fields');details.append(group);
        groups.set(spec.group,group);conditionsBox.append(details);
      }
      const field=spec.enum ? select(spec.enum.map(x=>[x,x])) : e('input');
      if(!spec.enum){
        if(spec.type==='string'){field.type='text';if(spec.maxLength)field.maxLength=spec.maxLength;}
        else{field.type='number';field.min=spec.minimum;field.max=spec.maximum;field.step=spec.type==='integer'?'1':'any';}
      }
      group.append(label(spec.title+(spec.unit?' ('+spec.unit+')':''),field));fieldWidgets.set(key,field);
      field.addEventListener(spec.enum?'change':'input',()=>{
        const value=['integer','number'].includes(spec.type)?field.valueAsNumber:field.value;
        if(key==='world'||key==='phase'){
          const {world,phase}=scenario.conditions;
          scenario=model.setEnvironment(scenario,key==='world'?value:world,key==='phase'?value:phase);
          sync();
        }else scenario.conditions[key]=value;
        example.value='';calculate();
      });
    }
    const output=e('section',null,'panel rd-output'), metrics=e('div',null,'rd-totals'), info=e('div'),refs=e('details');
    const refList=e('div');refs.append(e('summary','Sources for this assembly'),refList);
    const capture=button('Add to investigation',()=>{
      if(!current)return;
      document.dispatchEvent(new CustomEvent('ff-research-result',{detail:current}));
      location.hash='awareness';
    },'btn');
    const drive=button('Open this design in 3D',()=>{
      if(!current)return;
      try{
        sessionStorage.setItem('first-fire.rover-workbench.scenario.v1',JSON.stringify(scenario));
        const recipeLink=screen.querySelector('a[href]');
        const query=recipeLink ? new URL(recipeLink.href).search : '';
        location.assign('rover-workbench/prototype/index.html'+query+'#workbench');
      }catch{
        status.textContent='Your browser could not transfer this design. Open the 3D rover workbench from the navigation.';
      }
    });
    actions.append(drive,capture,link('Return to investigation','#awareness'));
    output.append(e('h2','Calculated budgets'),metrics,actions,info,refs);
    controls.append(label('Reference scenario',example),label('Design name',name));
    wrap.append(controls,output,status,partsBox,conditionsBox);
    const total=(heading,value)=>{const p=e('div');p.append(e('span',heading),e('strong',value));return p;};
    let refreshMaterialScreen;
    function calculate() {
      try{current=buildRecord(scenario,data,model);}
      catch(err){current=null;refreshMaterialScreen?.();drive.disabled=true;capture.disabled=true;status.textContent='Check the scenario. '+err.message;metrics.replaceChildren();info.replaceChildren();refList.replaceChildren();return;}
      status.textContent='';drive.disabled=false;capture.disabled=false;
      const r=current.record.result;
      refreshMaterialScreen?.();
      metrics.replaceChildren(total('Assembled mass',print(r.mobility.massKg)+' kg'),total('Final stored energy',print(r.power.endWh)+' Wh'),
        total('Coupon energy',r.coupon?print(r.coupon.netChemicalPotentialKJ)+' kJ':'Withheld'));
      info.replaceChildren(e('p',boundary,'small'));
      const changes=current.record.comparison.changedInputs, compared=e('details');
      compared.append(e('summary','Changed inputs compared with the Moon cellulose reference ('+changes.length+')'));
      if(changes.length){
        const list=e('ul');
        for(const change of changes)list.append(e('li',change.label+' · '+print(change.from)+' → '+print(change.to)+(change.unit?' '+change.unit:'')));
        compared.append(list);
      }else compared.append(e('p','The part selections and numerical conditions match the reference.'));
      info.append(compared);
      for(const [key,title] of Object.entries(sectionTitles)){
        const details=e('details'), spec=data.resultSchema.properties[key], values=r[key];
        details.append(e('summary',title),e('p',spec.description,'small'));
        if(values==null){details.append(e('p','Unavailable for this configuration.'));info.append(details);continue;}
        const table=e('table'),thead=e('thead'),headers=e('tr'),body=e('tbody');
        for(const title of ['Quantity','Current design','Moon cellulose reference']){
          const th=e('th',title);th.scope='col';headers.append(th);
        }
        thead.append(headers);table.append(thead,body);
        for(const [field,amount] of Object.entries(values)){
          const rule=spec.properties[field],row=e('tr'),name=e('th',rule.description||field);name.scope='row';
          const valueText=v=>print(v)+(v!=null && rule.unit?' '+rule.unit:'');
          row.append(name,e('td',valueText(amount)),e('td',valueText(baseline[key]?.[field])));body.append(row);
        }
        details.append(table);info.append(details);
      }
      refList.replaceChildren(...current.record.sources.map(source=>{
        const p=e('p'),a=link(source.title,source.url);a.target='_blank';a.rel='noopener noreferrer';
        p.append(a,e('span',[source.locator,source.boundary].filter(Boolean).join(' · '),'small'));return p;
      }));
    }
    example.onchange=()=>{scenario=copy(data.examples[example.value]);sync();calculate();};
    name.oninput=()=>{scenario.name=name.value;example.value='';calculate();};
    sync();calculate();
    const screen=e('section','Loading cabin material screening…','panel rd-inputs');
    output.after(screen);
    import('../material-screening.mjs').then(({mountMaterialScreen,roverReturn,roverEnvironment})=>{
      if(!screen.isConnected)return;
      refreshMaterialScreen=mountMaterialScreen(screen,{
        from:'rover',fixedFan:true,params:new URLSearchParams(location.hash.split('?')[1] || ''),
        read:()=>roverEnvironment(scenario,current?.record.result),snapshot:()=>scenario,
        apply:(environment,saved)=>{
          const restored=roverReturn(scenario,environment,saved,data,model);
          scenario=restored.scenario;example.value='';sync();calculate();return restored.message;
        }
      });
    }).catch(()=>{screen.textContent='The material screening model could not load.';});
  }
  globalThis.FFRoverDesign={render,buildRecord};
  if(typeof module!=='undefined'&&module.exports)module.exports={buildRecord};
})();
