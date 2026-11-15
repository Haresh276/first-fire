/* Narrow source-backed facets. Original-page and independent-review bindings are
   reproduced at release creation. Quantities are checked again against the source cells. */
(() => {
  'use strict';
  const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
  const subjects={luci:/\b(?:sibal|luci|new shepard)\b/i,saffire:/\b(?:saffire|nomex|2-7)\b/i,flex_tp:/\b(?:flex|heptane|droplet|cool.flame)\b/i,
    'same-cdc':/\b(?:same|shuttle detector|smoke detector|iss detector|teflon smoke|kapton smoke)\b/i,ices:/\b(?:ices|p213|polycarbonate|wstf|NASA Test 1)\b/i,
    fm2:/\b(?:fm[- ]?2|synergy pro|lunar fabric|lunar burn)\b/i,kimber:/\b(?:cfi|burner|21202|inverse ethane)\b/i,'acrylic-rods':/\b(?:rods?|cylinders?|what does pmma mean|pmma stand for)\b/i};
  const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/[−–—]/g,'-');
  const noInference=/\b(?:invent|fabricate|make up|guarantee|certif\w*|safe for|always|on mars|operational risk|hypothetical|if|extrapolate.*(?:moon|mars)|separate effect|sole cause)\b/i;
  function values(s){
    return [...norm(s).replace(/\b(?:one|two|three|four|five)\b/g,w=>String(['zero','one','two','three','four','five'].indexOf(w)))
      .replace(/(?:fm2|p213|o2|co2|n2)/g,'').matchAll(/(?<![\w.])(?:\d+(?:\.\d+)?|\.\d+)/g)].map(m=>Number(m[0]));
  }
  function numbers(card){
    if(!values(card.claim).length)return {state:'na',reason:'The bound claim contains no quantity.'};
    const original=norm(card.quote),claimed=values(card.claim), direct=values(original);
    let operands;
    if(card.id==='sibal-base'||card.id==='sibal-tip'){
      const row=original.match(card.id==='sibal-base'?/flame base ([.\d]+) ([.\d]+)/:/flame tip ([.\d]+) ([.\d]+)/);
      if(!row||!original.includes('(mm/s)'))return {state:'fail',reason:'The spread-rate cells or units are missing.'};
      operands=row.slice(1).map(Number);
    }else if(card.id==='flex-gases'){
      const m=original.match(/([.\d]+)\/([.\d]+)\/([.\d]+) o2\/n2\/co2, ([.\d]+)-atm/);
      operands=m?.slice(1).map((n,i)=>Number(n)*(i<3?100:1));
    }else if(card.id==='saffire-flow'){
      const m=original.match(/([.\d]+) cm\/s concurrent ~ ([.\d]+)/);operands=m?.slice(1).map(Number);
    }else if(card.id==='fm2-start'){
      const levels=[...original.matchAll(/start at ([.\d]+)%/g)].map(m=>Number(m[1]));operands=[levels.length,...levels];
    }else if(card.id==='ices-endpoints'){
      const m=original.match(/([.\d]+) second extinction limit rather than the ([.\d]+) cm.*nasa test (\d+)/);
      operands=m?.slice(1).map(Number);
    }
    const ok=operands?JSON.stringify(claimed)===JSON.stringify(operands):claimed.every(n=>direct.includes(n));
    return {state:ok?'pass':'fail',reason:ok?'Checked the stated quantities against the bound source excerpt and registered field or unit conversion.':'A number or source-field binding differed from the registered excerpt.'};
  }
  const urlbase=s=>String(s||'').split('#')[0].split('?')[0];
  async function reviewed(q,turn,ff){
    q=norm(q);if(!globalThis.FFSourceClaims?.cards||noInference.test(q))return null;
    const docs={...ff.evidence.documents,...globalThis.FFSourceClaims.documents},sourceUrls=(turn.sources||[]).map(s=>urlbase(s.url));
    const mentioned=Object.keys(subjects).filter(k=>subjects[k].test(q));
    const eligible=globalThis.FFSourceClaims.cards.filter(c=>{
      const doc=docs[c.doc];
      const grounded=mentioned.length?mentioned.includes(c.doc):[doc.url,doc.canonical_url].some(u=>sourceUrls.includes(urlbase(u)));
      if(!grounded||!new RegExp(c.facets,'i').test(q))return false;
      if(/would|could/.test(q) && !/compar|referen|both|arrows|reported|observed/.test(q))return false;
      if(/rod|cylinder/.test(q)&&c.doc==='saffire'&&!/\bsaffire\b/i.test(q))return false;
      if(/(?:c12h201|flex[ -]?120)/.test(q) && ['flex-gases','flex-observation'].includes(c.id) && !/155|159/.test(q))return false;
      if(/(?:c03h201|flex[ -]?155)/.test(q) && c.id==='flex-instrument' && !/120|124/.test(q))return false;
      if(c.doc==='fm2' && /actual|already|observed|completed|succeeded/.test(q))return false;
      return true;
    });
    // A scope-free question must be tied to one specific source document by retrieval.
    if(!eligible.length || !mentioned.length&&new Set(eligible.map(c=>c.doc)).size>1)return null;
    const chosen=eligible.map(c=>({card:c,score:(q.match(new RegExp(c.facets,'ig'))||[]).length})).sort((a,b)=>b.score-a.score).slice(0,2);
    const out=[],sources=[],ratings=[];
    for(const {card:c} of chosen){
      const doc=docs[c.doc],binding=JSON.stringify([c.id,doc.sha256,c.location,c.quote,c.claim]);
      if(await sha(binding)!==c.binding)return null;
      const numeric=numbers(c);
      if(numeric.state==='fail')continue;
      const applied=c.verdict==='supported';
      // An unapproved interpretation falls back to the actual original, including its
      // source units; unrelated emitted quantities or estimates are never accepted.
      const measured=values(c.quote).length>0;
      if(!applied && measured && numeric.state!=='pass')continue;
      const html=doc.format==='html',url=(doc.canonical_url||doc.url).split('#')[0]+(html?'#S':'#page=')+c.location;
      const shorter={'saffire-flow':'20 cm/s Concurrent ~ 22.1','ices-endpoints':'5 second extinction limit rather than the 15 cm'};
      const safeQuote=shorter[c.id]||c.quote;
      if(!c.quote.includes(safeQuote))continue;
      const text=applied?c.claim:'“'+safeQuote+'”';
      const locator=(html?'HTML section S':'PDF viewer page ')+c.location;
      const pos=sources.findIndex(s=>s.url===url);
      const idx=pos<0?sources.push({id:c.id,title:doc.title,url,locator}):pos+1;
      out.push(text+' ['+idx+']');ratings.push({id:c.id,supported:applied,numeric});
    }
    if(!out.length)return null;
    return {answer:out.join('\n\n'),sources,ratings};
  }
  globalThis.FFReviewedSources={reviewed,numbers};
})();
