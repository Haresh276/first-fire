// Only a workspace served by the local Python service can use the installed model.
(() => {
  'use strict';
  const model = 'qwen3.8:27b';
  if (!['http:', 'https:'].includes(location.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;

  let available = false;
  let lastProbe = 0;

  function detect(info) {
    available = info?.ready === true && info.workspace_context === true && info.model === model;
    lastProbe = Date.now();
    return available;
  }

  async function ready(signal) {
    if (Date.now() - lastProbe < 15000) return available;
    const response = await fetch('/api/health', {signal, cache: 'no-store', credentials: 'omit', redirect:'error'});
    return detect(response.ok && response.headers.get('content-type')?.includes('application/json')
      ? await response.json() : null);
  }

  function safeSource(source) {
    if (typeof source?.title !== 'string' || typeof source.url !== 'string') return false;
    if (/^#[\w/?=&%.-]+$/.test(source.url)) return true;
    try {
      const url = new URL(source.url);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch { return false; }
  }

  async function explain(message, turns, archive, signal) {
    try {
      if (!await ready(signal)) return archive;
      const history = turns.slice(-6).flatMap(turn => [
        {role:'user', content:turn.question.slice(0, 4000)},
        {role:'assistant', content:turn.answer.slice(0, 4000)}
      ]);
      const response = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit',
        redirect:'error', cache:'no-store', signal,
        body:JSON.stringify({message, history, caseId:archive.caseId})
      });
      if (!response.ok) return archive;
      const result = await response.json();
      if (result.model !== model || result.method !== 'local grounded synthesis' ||
          !['answered','limited'].includes(result.status) || !result.usage?.inferences ||
          !Array.isArray(result.citations) || !result.citations.length ||
          !result.citations.every(safeSource) || !result.synthesis_receipt ||
          typeof result.answer !== 'string' || !result.answer.trim()) return archive;
      return {...archive, answer:result.answer, sources:result.citations, status:result.status,
        synthesizedBy:model, model, mode:'local', latency:result.elapsed_ms};
    } catch (error) {
      if (signal.aborted) throw error;
      return archive;
    }
  }

  window.FFQwen = {explain, detect};
})();
