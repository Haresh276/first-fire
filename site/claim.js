/* Review a reader-mapped proposition against explicitly scoped, source-linked case records. */
(() => {
  'use strict';
  const cases = {
    sibal: {
      endpoint:'Time until visible extinction', material:'LUCI SIBAL cotton–fiberglass strip', gravity:'Simulated lunar gravity compared with 1 g',
      finding:'The LUCI SIBAL flame persisted about 45 seconds longer in the simulated lunar-gravity run than in its ground comparison.',
      alternatives:['The lunar-gravity flame persisted about 45 seconds longer.','The faster-spreading Earth flame persisted longer.','This pair gives a lifetime multiplier for any lunar fabric.'], cites:[0,1]
    },
    saffire: {
      endpoint:'Ignition of the Nomex component',material:'Saffire-II 2-7: PMMA overlapping Nomex HT90-40',gravity:'Orbital microgravity',
      finding:'The investigators report that the acrylic burned and the adjacent Nomex HT90-40 did not ignite in sample 2-7. Its blackening and the 140-second assembly duration do not establish Nomex combustion.',
      alternatives:['The adjacent Nomex was damaged without observed ignition.','The Nomex burned for 140 seconds.','Nomex will resist ignition in every spacecraft atmosphere.'],cites:[0,2]
    },
    flex: {
      endpoint:'Evidence of combustion after visible extinction',material:'FLEX-155 free-floating heptane droplet',gravity:'Orbital microgravity',
      finding:'For FLEX-155 the team inferred a cool-flame stage after the visible flame extinguished. The archived 2.7-second duration does not establish when all heat release ended.',
      alternatives:['The measurements suggest later cool-flame burning in FLEX-155.','All combustion ended at 2.7 seconds in FLEX-155.','Every heptane droplet showing a vapor cloud underwent cool-flame burning.'],cites:[0,2]
    },
    same: {
      endpoint:'Crossing the ISS light-scattering detector alarm threshold',material:'SAME Kapton or Teflon smoke in the published subsets',gravity:'Orbital microgravity',
      finding:'In the published experiment, over half the Kapton tests and two-thirds of the Teflon tests fell below the ISS light-scattering detector alarm threshold.',
      alternatives:['The detector would miss many Kapton and Teflon smoke tests in these subsets.','The detector would alarm on every Kapton and Teflon test.','The subset fractions determine the alarm delay in a lunar habitat.'],cites:[0]
    },
    cfig: {
      endpoint:'Oxygen location and hot ignition in inverse burner trials',material:'CFI-G 21202 A1/A2 ethane inverse-flame configuration',gravity:'Orbital microgravity',
      finding:'The inverse burner delivered an 85% oxygen stream into a chamber initially containing 6% ethane. A1 had no hot ignition; A2 ignited and self-extinguished after about two seconds.',
      alternatives:['The burner stream carried 85% oxygen in A1 and A2.','An 85% oxygen chamber surrounded the burner in A1 and A2.','These trials establish a safe ambient oxygen limit for solid fabrics.'],cites:[0,1]
    },
    ices: {
      endpoint:'Direction of the material-specific extinction oxygen shift',material:'P213 tape and polycarbonate in the ICES comparison',gravity:'Short simulated lunar gravity compared with a 1-g reference',
      finding:'The report places the P213 tape lunar extinction limit below its 1-g extrapolation and the polycarbonate result above its WSTF comparator. The direction depends on the material. ICES Fig. 13 and the single-material figures disagree on some lunar limits. FLINT uses Fig. 13, repeats the comparison with the alternate readings, and excludes cotton.',
      alternatives:['The two materials shifted in opposite directions relative to the stated references.','Both materials shifted in the same direction relative to those references.','Table 2 gives directly measured lunar safety limits for any sample.'],cites:[0,1]
    },
    fm2: {
      endpoint:'Published mission design and qualitative expectation',material:'FM² Synergy Pro Navy strips in the cited 2026 design',gravity:'Planned lunar-surface conditions at 8.2 psia',
      finding:'The March 2026 design describes four planned oxygen levels of 37%, 33%, 29% and 25%. The authors expected the first three to burn to threshold and the fourth to fail to ignite. The reviewed evidence contains no measured lunar outcomes.',
      alternatives:['The four entries are planned burns with a published expectation.','The four entries document completed lunar burn outcomes.','Agreement with the design expectation validates the numerical forecast.'],cites:[0,1]
    }
  };
  const KEY='first-fire.claim-review.v1';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const btn=(text,run,cls='btn')=>{const b=el('button',text,cls);b.type='button';b.onclick=run;return b;};
  const a=(text,href)=>{const n=el('a',text);n.href=href;if(/^https?:/.test(href)){n.target='_blank';n.rel='noopener noreferrer';}return n;};
  const field=(text,input)=>{const f=el('label',undefined,'field');input.setAttribute('aria-label',text);f.append(el('span',text),input);return f;};
  function select(title, options) {
    const s=el('select');
    options.forEach(([key,text])=>{const o=el('option',text);o.value=key;s.append(o);});
    return [field(title,s),s];
  }
  function download(text) {
    const url=URL.createObjectURL(new Blob([text+'\n'],{type:'text/plain;charset=utf-8'}));
    const l=a('Download review',url);l.download='FIRST-FIRE-claim-review.txt';l.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function sourceLinks(parent,sources) {
    for(const s of sources) {
      const d=el('div',undefined,'sourceitem');
      d.append(a(s.title,s.url),el('small',s.locator||''));parent.append(d);
    }
  }
  window.renderClaim = function renderClaim(root) {
    const all=window.FF.cases.filter(c=>cases[c.id]),lookup=Object.fromEntries(all.map(c=>[c.id,c]));
    root.replaceChildren();const wrap=el('section',undefined,'panel stack');
    const claim=el('textarea');claim.rows=3;claim.maxLength=2000;claim.required=true;claim.placeholder='Example: The 85% oxygen in CFI-G was the gas surrounding the burner.';
    const form=el('form',undefined,'stack'), go=el('button','Find relevant cases','btn');go.type='submit';
    const suggestions=el('div',undefined,'stack'),review=el('div',undefined,'stack'),result=el('div',undefined,'stack');
    wrap.append(el('h2','Review a claim against a recorded experiment'),el('p','Describe the claim you want to check, then identify the conditions and assertion you mean.'));
    form.append(field('Your claim or research question',claim),go);wrap.append(form,suggestions,review,result);root.append(wrap);
    let rev=0;
    const clear=()=>{rev++;suggestions.replaceChildren();review.replaceChildren();result.replaceChildren();};
    claim.oninput=clear;
    const saved=el('div');wrap.append(saved);
    function savedView(){
      saved.replaceChildren();
      let text='';try{text=localStorage.getItem(KEY)||'';}catch{return;}
      if(!text)return;
      const d=el('details');d.append(el('summary','Last saved review on this device'));
      const p=el('pre',text);p.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit';
      d.append(p,btn('Download saved review',()=>download(text),'ghost'),document.createTextNode(' '),btn('Clear saved review',()=>{
        try{localStorage.removeItem(KEY);savedView();}catch{p.textContent='This browser could not clear its stored review.';}
      },'ghost'));saved.append(d);
    }
    savedView();
    function finish(status,context,statement,sources,limit,next,extraLink){
      result.replaceChildren();
      const output=el('section',undefined,'panel stack');output.tabIndex=-1;
      output.append(el('p','Claim review','eyebrow'),el('h3',status),el('p',statement,'callout'));
      output.append(el('h4','Your claim'),el('p',claim.value.trim()));
      if(context.length)output.append(el('h4','Context you selected'),el('p',context.join(' · ')));
      output.append(el('h4',sources.length?'Limits on transfer':'Evidence still needed'),el('p',limit),el('h4','Next measurement or check'),el('p',next));
      if(sources.length){output.append(el('h4','Original evidence'));sourceLinks(output,sources);}
      if(extraLink)output.append(a('Open the full research case',extraLink));
      const report=[status,'Reader’s wording: '+claim.value.trim(),'Reader-selected context: '+(context.join(' · ')||'unspecified'),
        'Finding: '+statement,'Limits: '+limit,'Next: '+next,...sources.map(s=>s.title+' — '+s.locator+'\n'+s.url)].join('\n\n');
      const actions=el('div',undefined,'actions'),statusEl=el('p');statusEl.setAttribute('role','status');
      actions.append(btn('Save review on this device',()=>{try{localStorage.setItem(KEY,report);savedView();statusEl.textContent='Saved. The latest review is available on this device.';}catch{statusEl.textContent='Local saving is unavailable. Use Download review.';}}),
        btn('Download review',()=>download(report),'ghost'));output.append(actions,statusEl);result.append(output);output.focus({preventScroll:true});
    }
    function unlisted(){
      review.replaceChildren();finish('Insufficient case evidence',[],'No curated source has been selected for this claim.',[],
        'Related search suggestions identify reading material. They do not establish an outcome for an unlisted material or experiment.',
        'Locate the primary record for the actual material, environment and endpoint. Record its run identifier and how the endpoint was observed.');
    }
    function compare(id){
      result.replaceChildren();review.replaceChildren();if(!id)return;if(id==='other'){unlisted();return;}
      const c=lookup[id], att=cases[id];if(!c||!att){unlisted();return;}
      const block=el('section',undefined,'panel stack');block.append(el('p','Selected source context','eyebrow'),el('h3',c.short+' · '+c.title),
        el('p',c.record),a('Inspect the full record and caveats','#case/'+id),el('h4','Map your intended scope'));
      const fields=[['endpoint','Endpoint in your question'],['material','Material or specimen in your question'],['gravity','Gravity or platform in your question']];
      const controls={};
      for(const [key,title] of fields){
        const [f,s]=select(title,[['','Choose…'],['match',att[key]],['different','Different endpoint, specimen or environment'],['unknown','Unreported or uncertain']]);
        block.append(f);controls[key]=s;
      }
      const alt=[['','Choose…'],['recorded',att.alternatives[0]],['inconsistent',att.alternatives[1]],['transfer',att.alternatives[2]],['unknown','My wording means something else or I am unsure']];
      // Use the source order for alternatives, not an external model's reading of free text.
      const [pf,prop]=select('Which assertion or hypothesis do you want to assess?',alt);block.append(pf);
      const reviewBtn=btn('Compare with the source',()=>{
        const picks=fields.map(([key,title])=>[title,controls[key].value,controls[key].selectedOptions[0].textContent]);
        const context=picks.map(([title,,val])=>title+': '+val);
        if(prop.value)context.push('Your mapped assertion: '+prop.selectedOptions[0].textContent);
        const missing=picks.filter(([,key])=>key!=='match');
        const sources=att.cites.map(i=>c.sources[i]).filter(Boolean);
        if(missing.length || !['recorded','inconsistent'].includes(prop.value)){
          const uncertain=missing.map(x=>x[0]).join(', ');
          finish('Insufficient support for the mapped claim',context,uncertain?'The chosen record does not establish the claim with the context you supplied.':'The chosen case does not establish this broader or unspecified assertion.',
            sources,(uncertain?'Resolve '+uncertain+'. ':'')+c.limit,c.next,'#case/'+id);return;
        }
        const status=prop.value==='recorded'?'Supported within the recorded scope':'Mapped assertion conflicts with the source';
        finish(status,context,att.finding,sources,c.limit,c.next,'#case/'+id);
      });
      Object.values(controls).concat(prop).forEach(s=>s.onchange=()=>result.replaceChildren());
      block.append(el('p','The comparison applies to the assertion and conditions you select. Review your original wording for extra claims.','note'),reviewBtn);review.append(block);
    }
    form.onsubmit=async ev=>{
      ev.preventDefault();clear();const id=rev,txt=claim.value.trim();if(!txt)return;
      suggestions.append(el('p','Finding related cases…'));
      let returned=[];
      try{returned=(await window.FFSearch.search(txt)).items||[];}catch{}
      if(id!==rev || !root.isConnected)return;
      suggestions.replaceChildren();const top=returned.filter(i=>i.type==='Case').slice(0,3);
      suggestions.append(el('h3','Choose a case to compare'),el('p',top.length?'Suggested by search. Select one only if it addresses your question.':'Search found no close case. You can select a case from the complete list or record the gap.'));
      const options=[['','Select a case…'],['other','No applicable case / evidence missing']];
      for(const hit of top){const caseId=hit.url.replace('#case/','');if(lookup[caseId])options.push([caseId,'Suggested · '+lookup[caseId].title]);}
      all.filter(c=>!options.some(([key])=>key===c.id)).forEach(c=>options.push([c.id,c.short+' · '+c.title]));
      const [f,s]=select('Case for comparison',options);suggestions.append(f);s.onchange=()=>compare(s.value);
    };
  };
})();
