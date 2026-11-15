(() => {
  'use strict';
  const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const words = value => normalize(value).split(/\s+/).map(word => ({rovers:'rover',wheels:'wheel',parts:'components',searching:'search',modelling:'model',modeling:'model',dimensional:'3d'}[word] || word));
  const entries = doc => [...doc.querySelectorAll('#tool-list li')].map(li => {
    const a=li.querySelector('a'), title=a.textContent;
    return {li, title, href:a.getAttribute('href'), terms:words(li.textContent+' '+li.dataset.terms)};
  });
  function matches(rows, q) {
    const stop = new Set(['a','an','the','for','and','in','of','how','to','find','first','fire']);
    let terms=words(q).filter(Boolean);
    if(terms.some(word=>!stop.has(word))) terms=terms.filter(word=>!stop.has(word));
    return rows.filter(row=>terms.every(word=>row.terms.some(term=>term===word || (word.length>=3 && term.startsWith(word)))));
  }
  let catalog;
  async function showMatches(container, q) {
    const more=document.createElement('a');
    const url=new URL('tools.html',location.href); if(q) url.searchParams.set('q',q);
    more.href=url.href; more.textContent=q?'Search all tools':'Browse or search site tools';
    container.append(more);
    if(!q) return;
    try {
      catalog ||= fetch('tools.html').then(response=>{if(!response.ok) throw Error('directory unavailable'); return response.text();})
        .then(html=>entries(new DOMParser().parseFromString(html,'text/html'))).catch(error=>{catalog=null;throw error;});
      const list=matches(await catalog,q).slice(0,4);
      if(!list.length || !container.isConnected) return;
      const heading=document.createElement('h2');heading.textContent='Matching tools';
      container.prepend(heading);
      for(const row of list) {
        const a=document.createElement('a'); a.href=row.href; a.textContent=row.title; container.insertBefore(a,more);
      }
    } catch { /* The static directory link remains available. */ }
  }
  window.FFToolDirectory={showMatches};
  const directory=document.querySelector('#tool-directory');
  if(!directory)return;
  const input=directory.querySelector('[name=q]'), all=entries(document);
  const status=directory.querySelector('#tool-count'), clear=directory.querySelector('#all-tools');
  function render(q){
    const found=new Set(matches(all,q));
    for(const row of all) row.li.hidden=!found.has(row);
    status.textContent=found.size?(found.size+' '+(found.size===1?'tool':'tools')+(q?' found.':' available.')):'No matching tools. Try “rover”, “cabin” or “evidence”.';
    clear.hidden=!q;
  }
  function restore(){ input.value=(new URL(location.href).searchParams.get('q')||'').slice(0,250); render(input.value); }
  let draft=false;
  function record(q,replace) {
    const url=new URL(location.href);
    q ? url.searchParams.set('q',q) : url.searchParams.delete('q');
    if(url.href!==location.href && location.protocol!=='file:') {
      try { history[replace?'replaceState':'pushState'](null,'',url); } catch { /* Keep filtering when the browser throttles history updates. */ }
    }
  }
  input.addEventListener('input',()=>{const q=input.value.trim();record(q,draft);draft=true;render(q);});
  directory.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const q=input.value.trim();record(q,draft);draft=false;render(q);});
  addEventListener('popstate',()=>{draft=false;restore();});
  addEventListener('pageshow',event=>{if(event.persisted){draft=false;restore();}});
  // Someone may already have typed while the external script was downloading.
  // Preserve their edit; otherwise the shared URL supplies the initial query.
  if(input.value){const q=input.value.trim();record(q,true);render(q);} else restore();
})();
