// Catalogue IDs and schema keys form the public links. Display titles can change independently.
export const viewNames = {
  workbench: '3D workbench', assembly: 'Assembly', conditions: 'Test conditions', results: 'Calculated results',
  evidence: 'Assembly evidence', review: 'Mission review'
};

const views = [
  ['workbench', 'rover model viewer 3d simulation'], ['assembly', 'build components subsystems'],
  ['conditions', 'scenario environment parameters inputs'], ['results', 'engineering calculations budgets outputs'],
  ['evidence', 'selected component sources references'], ['review', 'A/B compare designs research export']
];
// Opening a control brings it into view. Starting runs, importing files and editing designs require user action.
const controls = [
  ['workbench/drive','Traverse controls','[data-tool="drive"]','manual drive movement steering wheels','drive'],
  ['workbench/inspect','Component inspection','#inspect-slot','inspect installed subsystem parts 3d model','inspect'],
  ['workbench/cabin-test','Cabin tracer test','[data-tool="fire"]','fire smoke ventilation fan two zone release detector','fire'],
  ['workbench/route-plan','Route plan','#route-preset','waypoints course map Jezero Perseverance Sol 15 traverse'],
  ['workbench/field-comparison','Independent field trial','#field-panel h3','observation csv position error validate drive comparison'],
  ['workbench/scenario','Reference scenarios','#example','examples baseline design settings'],
  ['workbench/environment','Drive environment','#drive-world','world Earth Mars Moon orbit free fall','drive'],
  ['workbench/illumination','Drive illumination','#drive-phase','day night sunlight','drive'],
  ['workbench/terrain','Drive terrain','#drive-terrain','LOLA lunar south pole DEM grade test course flat rolling','drive'],
  ['workbench/run','Run planned traverse','#play-route','route replay playback waypoints','drive'],
  ['workbench/playback','Playback speed','#drive-rate','4x 12x fast slow replay','drive'],
  ['workbench/waypoints','Waypoint coordinates','#point-x','map route coordinates x z metres add'],
  ['workbench/telemetry','Run telemetry','.run-report h2','elevation profile battery distance elapsed replay'],
  ['workbench/drive-assumptions','Drive assumptions','#drive-assumptions summary','friction wheel speed slip vehicle parameters'],
  ['workbench/export-track','Export telemetry CSV','#export-track','download drive run track route'],
  ['workbench/save-plan','Save route plan','#export-plan','export download json waypoints'],
  ['workbench/load-plan','Load route plan','#import-plan','import json route waypoints'],
  ['workbench/camera','Rover camera','#reset-camera','rotate orbit zoom viewer reset'],
  ['workbench/release-zone','Tracer release zone','#fire-origin','cabin test equipment bay crew space smoke source','fire'],
  ['workbench/sensor-zone','Tracer sensor zone','#fire-sensor','cabin test detector placement sampling','fire'],
  ['workbench/fan','Cabin fan exchange','#fire-fan','ventilation tracer flow mixing litres per second','fire'],
  ['workbench/tracer-time','Tracer playback time','#fire-seek','cabin fire elapsed tracer test','fire'],
  ['review/sources','Agency research','.mr-library input[type="search"]','search primary evidence sources measurements NASA international partners'],
  ['review/team-evidence','Add team evidence','.mr-team-form input','organization unverified custom source record'],
  ['review/baseline','Save comparison baseline','.mr-actions button','snapshot A B compare current design'],
  ['review/export','Export review JSON','.mr-actions button:last-child','share download engineering comparison']
];
const layers = {exterior:'Exterior',cutaway:'Cutaway',exploded:'Exploded'};
const overlays = {gravity:'Gravity',power:'Solar power',thermal:'Radiator exchange',access:'Airlock gas loss',ventilation:'Cabin ventilation',suppression:'Agent discharge'};
const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

export function buildDestinations({catalog,schema,partNames,metricGroups,driveFields}) {
  const destinations = [];
  function add(path,title,group,terms='',extra={}) {
    const label = normalize(title);
    destinations.push({path,title,group,label,words:normalize([title,group,path,terms].join(' ')),...extra});
  }
  for (const [path,terms] of views) add(path,viewNames[path],'Workspace view',terms);
  for (const [path,title,target,terms,tool] of controls) add(path,title,viewNames[path.split('/')[0]],terms,{target,tool});
  for (const [id,name] of Object.entries(layers)) {
    add('workbench/layer/'+id,name+' view','3D model','layer geometry vehicle components',{target:'[data-layer="'+id+'"]',layer:id});
  }
  for (const [id,name] of Object.entries(overlays)) {
    add('workbench/overlay/'+id,name+' overlay','3D model','engineering overlay diagram',{target:'#scene-overlay',overlay:id});
  }
  for (const [key,[title,unit]] of Object.entries(driveFields)) {
    add('workbench/drive/'+key,title,'Drive assumptions',unit+' traverse control',{target:'#drive-'+key});
  }
  for (const [key,spec] of Object.entries(schema.properties.conditions.properties)) {
    add('conditions/'+key,spec.title,'Test conditions',spec.group+' '+(spec.unit||'')+' '+(spec.enum||[]).join(' '),{target:'#field-'+key});
  }
  for (const [key,title,rows] of metricGroups) {
    add('results/'+key,title,'Calculated results',rows.map(row=>row.slice(1).join(' ')).join(' '),{target:'#result-'+key});
  }
  for (const [slot,title] of Object.entries(partNames)) {
    add('assembly/slot/'+slot,title+' selection','Assembly',slot+' component subsystem',{target:'#part-'+slot});
    add('evidence/'+slot,title+' evidence','Assembly evidence',slot+' sources references',{target:'#evidence-'+slot+' h3'});
  }
  for (const part of catalog.parts) {
    add('assembly/part/'+part.id,part.title,partNames[part.slot]+' · Catalog part',part.scope+' '+part.origin+' '+part.sourceIds.join(' '),{part,target:'#part-preview-title'});
  }
  return destinations;
}

export function searchDestinations(destinations,query) {
  const text = normalize(query), tokens = text.split(' ').filter(Boolean);
  if (!tokens.length) return destinations.slice();
  const hits = [];
  for (const entry of destinations) {
    if (!tokens.every(token=>entry.words.includes(token))) continue;
    const rank = entry.label===text ? 0 : entry.label.startsWith(text) ? 1 : entry.label.includes(text) ? 2 : tokens.every(token=>entry.label.includes(token)) ? 3 : 4;
    hits.push({entry,rank});
  }
  return hits.sort((a,b)=>a.rank-b.rank).map(hit=>hit.entry);
}

export function resolveDestination(entries,hash) {
  const raw = hash.replace(/^#/,'');
  if (raw==='find' || raw.startsWith('find?')) return {view:'workbench',query:new URLSearchParams(raw.split('?').slice(1).join('?')).get('q')||''};
  const item = entries.find(entry=>entry.path===raw);
  const parent = raw.split('/')[0];
  return {view:Object.hasOwn(viewNames,parent)?parent:'workbench',item};
}

const byId = id=>document.getElementById(id);
function element(tag,text) {
  const node=document.createElement(tag);node.textContent=text;return node;
}
function reveal(target,focus) {
  if (!target) return;
  for (let parent=target.parentElement;parent;parent=parent.parentElement) if(parent.tagName==='DETAILS') parent.open=true;
  // Disabled controls can still be located via their caption, even on an open cabin or unavailable run.
  if (target.disabled) target=target.closest('label')||target.parentElement;
  if (!target.matches('button,input,select,summary,textarea,a[href],[tabindex]')) target.tabIndex=-1;
  if (focus) target.focus({preventScroll:true});
  target.scrollIntoView({block:'center'});
}

export function mountFinder(entries,{getSelectedPart,onInstall}) {
  const query=byId('finder-query'),matches=byId('finder-matches'),list=byId('finder-list'),more=byId('finder-more'),preview=byId('part-preview');
  const form=byId('finder-form'),root=byId('workbench-finder');
  let all=false,activePart=null;
  const searchHash=()=>query.value.trim()?'#find?'+new URLSearchParams({q:query.value.trim()}):'#find';
  function showMatches() {
    const hits=searchDestinations(entries,query.value), shown=all?hits:hits.slice(0,9);
    list.replaceChildren();
    for (const entry of shown) {
      const row=document.createElement('li'),link=element('a',entry.title);
      link.href='#'+entry.path;link.append(element('small',entry.group));row.append(link);list.append(row);
    }
    more.hidden=shown.length===hits.length;
    byId('finder-count').textContent=hits.length ? (shown.length===hits.length?String(hits.length):shown.length+' of '+hits.length)+' '+(hits.length===1?'destination':'destinations') : 'No matching destinations. Try a component name, control or unit.';
    matches.hidden=false;
  }
  function close() {matches.hidden=true;}
  function refreshPart() {
    if (!activePart) {preview.hidden=true;return;}
    const part=activePart,installed=getSelectedPart(part.slot)===part.id;
    const header=element('h3',part.title);header.id='part-preview-title';header.tabIndex=-1;
    const install=element('button',installed?'Installed in current design':'Install this component');install.type='button';install.disabled=installed;
    install.addEventListener('click',()=>{onInstall(part.slot,part.id);refreshPart();byId('part-preview-title').focus({preventScroll:true});});
    preview.replaceChildren(element('small','Catalog part · '+part.origin),header,element('p',part.scope),install);
    preview.hidden=false;
  }
  function apply(destination,scroll) {
    close();activePart=destination.item?.part||null;refreshPart();
    if ('query' in destination) {
      query.value=destination.query;all=false;showMatches();reveal(query,true);return;
    }
    const item=destination.item;
    if (!item?.target) {
      if(scroll || (item && item.path!=='workbench')) reveal(document.querySelector('#views a[aria-current]'),true);
      return;
    }
    if (item.tool) document.querySelector('[data-tool="'+item.tool+'"]')?.click();
    if (item.layer) document.querySelector(item.target)?.click();
    if (item.overlay) {
      const select=byId('scene-overlay');select.value=item.overlay;select.dispatchEvent(new Event('change'));
    }
    reveal(document.querySelector(item.target)||(destination.view==='results' ? byId('notes') : null),true);
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const hash=searchHash();
    if (location.hash===hash) showMatches();else location.hash=hash;
  });
  query.addEventListener('input',()=>{all=false;showMatches();});
  query.addEventListener('focus',()=>{if(matches.hidden)showMatches();});
  query.addEventListener('click',()=>{if(matches.hidden)showMatches();});
  query.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();showMatches();list.querySelector('a')?.focus();}});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();query.focus();close();}});
  byId('finder-close').addEventListener('click',()=>{query.focus();close();});
  more.addEventListener('click',()=>{const previous=list.children.length;all=true;showMatches();list.children[previous]?.querySelector('a')?.focus();});
  list.addEventListener('click',event=>{
    const link=event.target.closest('a');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    // Native link navigation adds the destination. Preserve the live results as its Back entry.
    const hash=searchHash();
    if(location.hash!==hash) history.pushState(null,'',hash);
  });
  return {apply,refreshPart,resolve:hash=>resolveDestination(entries,hash)};
}
