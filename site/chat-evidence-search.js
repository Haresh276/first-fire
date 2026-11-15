// Static hosts can retrieve the same attributed paragraphs as the local service.
(() => {
  'use strict';
  const stop = new Set('a about after all an and any are as at be before by can could did do does during explain for from give had has have how i in into is it me of on or our please research should show tell than that the their these they this those to us was we were what when where which who why will with would you'.split(' '));
  const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[–−]/g,'-').replace(/₂/g,'2');
  function words(text) {
    return [...new Set((normalize(text).match(/[a-z]+\d*|\d+(?:\.\d+)?/g)||[]).filter(w=>!stop.has(w)).map(w=>w.length>4?w.replace(/(?:es|s)$/,''):w))];
  }
  let cache;
  function index(registry) {
    if (cache?.registry === registry) return cache;
    const df = new Map(), docs = [];
    for (const [id, doc] of Object.entries(registry.docs)) {
      if (id.split(':').length>2) continue; // Exact source rows already have a dedicated lookup.
      const body = new Set(words(doc.text)), title = new Set(words(doc.title+' '+id.split(':')[0]));
      const all = new Set([...body,...title]);
      for (const w of all) df.set(w,(df.get(w)||0)+1);
      docs.push({id, doc, title, body});
    }
    cache = {registry, docs, df};
    return cache;
  }
  async function answer(question,history) {
    if (!window.FFChatPassages) await window.FFLoadAsset?.('chat-passages.js');
    const registry = window.FFChatPassages;
    if (!registry) return null;
    const {docs,df} = index(registry);
    const query = normalize(question);
    // Exact source values, personal data, commands and approval require dedicated evidence.
    if (/\b(?:guarantee|certify|fabricate|invent|override|ignore|password|receipt number|unpublished|fictional|imaginary|attached|upload|my file|my log|cricket|stock price|recipe)\b/.test(query)) return null;
    const terms=words(question);
    const prior=(history||[]).at(-1);
    const carry=/^(?:and |why|what about|which source|tell me more|what (?:next|was measured))\b/.test(query);
    const reference=carry ? prior?.passageReceipt?.ids?.[0]?.split(':')[0] : null;
    const weights=terms.map(w=>Math.log(1+(docs.length+.5)/((df.get(w)||0)+.5)));
    const total=weights.reduce((a,b)=>a+b,0);
    if (!total) return null;
    const ranked=docs.map(item=>{
      let sum=0,n=0;
      terms.forEach((w,i)=>{
        if (item.body.has(w)||item.title.has(w)) {
          n++;sum+=weights[i]*(item.body.has(w)&&item.title.has(w)?1.2:1);
        }
      });
      const priorTopic=reference && item.id.startsWith(reference+':');
      return {...item,n,score:sum/total+(priorTopic ? .06 : 0)};
    }).filter(r=>r.n>=2 && r.score>=.48).sort((a,b)=>b.score-a.score);
    const first=ranked[0];
    if (!first || first.score<.57) return null;
    const numbers=query.match(/\b\d+(?:\.\d+)?\b/g)||[];
    if (numbers.some(n=>!words(first.doc.text+' '+first.doc.title).includes(n))) return null;
    const selected=[first];
    if (ranked[1]?.score>=Math.max(.6,first.score*.90) && ranked[1].doc.text!==first.doc.text) selected.push(ranked[1]);
    return {mode:'archive',status:'limited',evidenceKind:'bound-passages',
      answer:selected.map(({doc},i)=>doc.text+' ['+(i+1)+']').join('\n\n'),
      sources:selected.map(({id,doc:{title,url,locator}})=>({id,title,url,locator})),
      passageReceipt:{version:registry.version,ids:selected.map(r=>r.id)}};
  }
  window.FFChatEvidenceSearch={answer};
})();
