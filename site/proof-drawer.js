/* One disclosure for the source, bound receipt, completed checks and original artifact. */
(() => {
  'use strict';
  const text=(tag,value)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;};
  const safe=raw=>typeof raw==='string' && (/^https:\/\//i.test(raw)||/^#(?:[a-z][\w/-]*)(?:\?[^\s]*)?$/i.test(raw)||/^(?:data\/tests\.csv|data\/raw\/[\w.-]+\.csv|forecast-lock\/fm2-v1\.(?:json|tsr))$/.test(raw))?raw:null;
  const same=(a,b)=>a && b && a.split('#')[0].replace('?attachment=true','')===b.split('#')[0].replace('?attachment=true','');
  const seal='9f565bc7195936bde5faff67841c5e1e6537581bc4fc560018838fbf996a8fa3';
  function resolve(source,context={},ff=globalThis.FF){
    if(!source||!safe(source.url))return null;
    let title=source.title||'Source',locator=source.locator||'',hash='',doi='',original=source.url,binding='No pinned file fingerprint for this source.';
    const studies=ff?.investigations||[];
    const anchor=ff?.evidence?.anchors?.[source.id],docs={...ff?.evidence?.documents,...globalThis.FFSourceClaims?.documents};
    const doc=anchor?docs[anchor.document]:Object.values(docs).find(d=>same(source.url,d.url)||same(source.url,d.canonical_url));
    const study=studies.find(s=>s.url===source.url||s.tables.some(t=>same(t.url,source.url)||t.file===source.url));
    const historical=globalThis.FFMissionReceipts?.find(r=>r.source.url===source.url);
    if(historical){
      hash=historical.documentSHA256;binding='Verified NASA HTML snapshot SHA-256';locator=locator||historical.source.locator;
    }else if(doc){
      hash=doc.sha256;title=doc.title;binding='Pinned publisher file SHA-256';
      if(anchor)locator=anchor.page?'PDF viewer page '+anchor.page:'section '+anchor.section_id;
      if(!locator&&source.url.includes('#page='))locator='PDF viewer page '+source.url.split('#page=')[1];
    }else if(study){
      const table=study.tables.find(t=>same(t.url,source.url)||t.file===source.url);
      doi=study.doi;title=study.title||study.name;
      if(table){hash=table.sha256;original=table.url;binding='NASA source table SHA-256';if(!locator)locator=table.name;}
      else if(!locator)locator='NASA PSI investigation '+study.accession;
    }else if(/^#forecast$|^#report\/forecast$|forecast-lock\/fm2-v1/.test(source.url)){
      title='Team Code Blooded · FM² forecast v1';original='forecast-lock/fm2-v1.json';hash=seal;
      binding='RFC 3161 timestamped forecast file SHA-256';locator=locator||'Four preregistered probabilities and scoring rules';
    }
    const checks=context.checks?Object.entries(context.checks).map(([k,c])=>k+' '+c.state).join(' · '):
      (hash?'Pinned artifact located. A specific interpretation has no recorded check here.':'Source link available. No independent claim review is attached here.');
    const citation=title+'. '+(locator?locator+'. ':'')+(doi?'NASA Physical Sciences Informatics. https://doi.org/'+doi:original.startsWith('#')?new URL(original,globalThis.location?.href||'https://example.invalid/').href:original);
    return {title,locator,hash,binding,checks,original,doi,citation};
  }
  function drawer(source,context){
    const proof=resolve(source,context);if(!proof)return null;
    const box=text('details');box.className='ff-proof';box.dataset.ffProof='true';
    const label=text('summary','Proof and citation');box.append(label);
    const list=text('dl');box.append(list);
    const line=(name,content)=>{const dt=text('dt',name),dd=text('dd');if(typeof content==='string')dd.textContent=content;else dd.append(content);list.append(dt,dd);};
    line('Source',proof.title+(proof.locator?' · '+proof.locator:''));
    line('Receipt',proof.binding+(proof.hash?' · '+proof.hash:''));
    line('Checks',proof.checks);
    const a=text('a',proof.doi?'Open NASA source table or investigation':'Open original');a.href=proof.original;if(/^https:/.test(proof.original)){a.target='_blank';a.rel='noopener noreferrer';}
    line('Original',a);
    if(proof.hash===seal){const signature=text('a','Download the signed timestamp');signature.href='forecast-lock/fm2-v1.tsr';signature.download='fm2-v1.tsr';box.append(signature,' · ');}
    const copy=text('button','Copy citation');copy.type='button';copy.className='ghost';
    const feedback=text('span','');feedback.setAttribute('role','status');
    copy.onclick=async()=>{
      try{await navigator.clipboard.writeText(proof.citation);feedback.textContent=' Citation copied.';}
      catch{const field=text('textarea');field.value=proof.citation;field.readOnly=true;field.setAttribute('aria-label','Citation to copy');box.append(field);field.focus();field.select();feedback.textContent=' Citation selected for copying.';}
    };
    box.append(copy,feedback);return box;
  }
  let observer,owner;
  function attach(root){
    if(!root)return;
    const decorate=(scope)=>{
      if(scope.nodeType!==1)return;
      const links=[...(scope.matches?.('a[href]')?[scope]:[]),...scope.querySelectorAll('a[href]')];
      for(const a of links){
        const raw=a.getAttribute('href');
        if(a.dataset.ffProof || a.closest('.ff-proof, .ffchat, nav, header, .breadcrumb') || !raw)continue;
        if(!/^https:\/\/(?:[^/]+\.)?(?:nasa\.gov|nist\.gov|ncbi\.nlm\.nih\.gov|doi\.org|crossref\.org|nature\.com|jaxa\.(?:go\.)?jp|isro\.gov\.in)(?:[/?#]|$)|^data\/raw\/|^forecast-lock\/fm2-v1\.json/.test(raw))continue;
        const tr=a.closest('tr');
        const printedLocation=a.textContent.match(/\b(?:slide|page|figure|table)\s+[\w.-]+/i)?.[0];
        const locator=printedLocation || a.parentElement?.querySelector('small')?.textContent || (tr?.dataset?.sourceRow?'CSV row '+tr.dataset.sourceRow:'');
        const details=drawer({url:raw,title:a.textContent.trim(),locator});if(details){a.dataset.ffProof='true';a.after(details);}
      }
    };
    if(owner!==root){observer?.disconnect();owner=root;observer=new MutationObserver(list=>{for(const entry of list)for(const added of entry.addedNodes)decorate(added);});observer.observe(root,{childList:true,subtree:true});}
    decorate(root);
  }
  globalThis.FFProofDrawer={attach,drawer,resolve};
})();
