/* Chat is local to this tab. Text from users, imported storage and responses only enters text nodes. */
(() => {
  'use strict';

  const STORAGE_KEY = 'first-fire.chat.v1';
  const MAX_MESSAGE = 2000;
  const MAX_HISTORY = 12;
  const EXAMPLES = [
    ['Materials', 'Did the Nomex ignite in Saffire-II sample 2-7?', 'saffire'],
    ['Measurements', 'What happened after the visible flame disappeared in FLEX-155?', 'flex'],
    ['Lunar forecast', 'Have any of the four FM² burns been observed on the Moon?', 'fm2']
  ];
  const SUBJECTS = {
    sibal: /\b(?:sibal|luci)\b/i,
    saffire: /\b(?:saffire[ -]?(?:ii|2)\b|nomex|2-7\b)/i,
    flex: /\b(?:flex(?:-\d+)?|heptane|c03h201|c12h201)\b/i,
    same: /\b(?:same-r|kapton|teflon)\b|\bSAME\b/,
    cfig: /\b(?:cfi[ -]?g|21202|21088a1)\b/i,
    ices: /\b(?:ices|p213|polycarbonate)\b/i,
    fm2: /\bfm(?:2\b|²)|synergy pro navy/i
  };
  const RESPONSE_STATUSES = new Set(['answered', 'limited', 'abstained']);
  let stopPreviousView;
  let memory;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(label, onClick, className) {
    const control = node('button', label, className);
    control.type = 'button';
    control.addEventListener('click', onClick);
    return control;
  }

  function link(label, url, className) {
    const anchor = node('a', label, className);
    anchor.href = url;
    return anchor;
  }

  function sourceURL(raw) {
    if (typeof raw !== 'string') return null;
    if (/^#(?:case\/[\w-]+(?:\/[\w-]+)?|data(?:\?[^\s]*)?|report\/[\w-]+|forecast|sources|acrylic|study|guide|benchmark)$/.test(raw)) return raw;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null;
    } catch { return null; }
  }

  function normalizeSource(source) {
    if (!source || typeof source.title !== 'string') return null;
    const url = sourceURL(source.url);
    return url && {id: String(source.id || ''), title: source.title.slice(0,350), locator: String(source.locator || '').slice(0,1600), url};
  }

  function newThread() {
    return {id: globalThis.crypto?.randomUUID?.() || String(Date.now()) + String(Math.random()).slice(2), turns: []};
  }

  function readStore() {
    if (memory) return memory;
    let data;
    try { data = JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { /* private browsing */ }
    if (data?.version === 1 && Array.isArray(data.threads)) {
      const threads = data.threads.filter(t => typeof t?.id === 'string' && Array.isArray(t.turns));
      for (const thread of threads) {
        thread.turns = thread.turns.filter(t => typeof t?.question === 'string' && typeof t.answer === 'string')
          .map(t => ({...t, sources: Array.isArray(t.sources) ? t.sources.map(normalizeSource).filter(Boolean) : []}));
      }
      if (threads.length) return memory = {version: 1, threads, current: threads.find(t=>t.id===data.current)?.id || threads[0].id};
    }
    const first = newThread();
    return memory = {version: 1, current: first.id, threads: [first]};
  }

  function questionTitle(text) {
    return text.length > 58 ? text.slice(0,55).replace(/\s+\S*$/, '') + '…' : text;
  }

  function localOrigin() {
    return ['http:', 'https:'].includes(location.protocol) && ['127.0.0.1','localhost','[::1]'].includes(location.hostname);
  }

  async function checkService() {
    if (!localOrigin()) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('/api/health', {cache:'no-store', credentials:'omit', signal:controller.signal});
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return null;
      const info = await response.json();
      return info.ready === true && typeof info.model === 'string' ? info : null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  function history(turns) {
    return turns.filter(t=>t.mode === 'local').flatMap(t => [
      {role:'user', content:t.question.slice(0,4000)},
      {role:'assistant', content:t.answer.slice(0,4000)}
    ]).slice(-MAX_HISTORY);
  }

  async function askService(message, turns, signal) {
    const response = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit', cache:'no-store',
      body:JSON.stringify({message, history:history(turns)}), signal
    });
    if (!response.ok) throw Error('The local service returned HTTP ' + response.status + '.');
    const answer = await response.json();
    if (!RESPONSE_STATUSES.has(answer.status) || typeof answer.answer !== 'string' || !answer.answer.trim() || !Array.isArray(answer.citations)) {
      throw Error('The local service returned an unreadable answer.');
    }
    return {
      answer:answer.answer, status:answer.status, sources:answer.citations.map(normalizeSource).filter(Boolean),
      mode:'local', model:typeof answer.model === 'string' ? answer.model : '', latency:answer.elapsed_ms
    };
  }

  function excerpt(caseData, item, answer) {
    return {
      answer, status:'limited', mode:'archive', model:'Stored case excerpt', caseId:caseData.id,
      sources:[...caseData.sources.slice(0,2),{title:'Open the '+caseData.short+' case',url:'#case/'+caseData.id,locator:'FIRST FIRE case notes'}]
        .map(s=>normalizeSource({...s,id:s.id || caseData.id})).filter(Boolean), item
    };
  }

  // Use the published mission records and the same intent patterns as chat/incidents.py.
  function incidentReply(question, previousTurns) {
    const data = window.FF?.incidents;
    if (!data) return null;
    const normal = text => text.normalize('NFKD').toLowerCase().replace(/[–−]/g, '-').trim();
    const test = (pattern, q) => new RegExp(pattern).test(q);
    const full = (pattern, q) => test('^(?:' + pattern + ')$', q);
    const matching = q => data.records.filter(record => test(record.match, q));
    const removeNames = (q, records) => records.reduce((text, record) =>
      text.replace(new RegExp('(?:' + record.match + ")(?:[’']s)?", 'g'), ' ').trim(), q);
    const intents = q => Object.keys(data.intents).filter(key => test(data.intents[key], q));
    const followup = q => test(data.reference, q) || (full(data.followup, q) && intents(q).length > 0);
    function earlier() {
      for (const turn of [...previousTurns].reverse()) {
        const q = normal(turn.question);
        if (test(data.research, q)) break;
        const records = matching(q);
        if (records.length) return test(data.unknown_named, removeNames(q, records)) ? [] : records;
        if (test(data.unknown_named, q) || !followup(q)) break;
      }
      return [];
    }
    function abstain(reason, name = '') {
      return {status:'abstained', answer:data.messages[reason].replace('{name}', name), sources:[], mode:'archive'};
    }
    const q = normal(question);
    let records = matching(q);
    const rest = removeNames(q, records);
    if (test(data.research, q)) return records.length ? abstain('mixed') : null;
    if (test(data.unknown_named, rest)) return abstain('unknown');
    const comparePrevious = records.length > 0 && test(data.compare_reference, q);
    if (comparePrevious) records = [...new Set([...earlier(), ...records])];
    if (!records.length && followup(q)) records = earlier();
    if (!records.length) {
      if (test(data.unknown, q)) return abstain(/\bapollo\b/.test(q) ? 'ambiguous' : 'unknown');
      return null;
    }
    const facets = intents(rest.replace(/\s+/g, ' ').trim());
    if (!facets.length && records.length > 1 && (comparePrevious || test(data.compare, q))) facets.push('comparison');
    if (!facets.length && (full(data.overview, rest) || comparePrevious)) facets.push('overview');
    const paragraphs = new Set();
    const sources = new Map();
    for (const record of records) {
      if (!facets.length || facets.some(key => !record.facts[key])) return abstain('unsupported', record.name);
      for (const key of facets) {
        for (const fact of record.facts[key]) {
          if (!sources.has(fact.source)) sources.set(fact.source, normalizeSource(data.sources[fact.source]));
          const number = Array.from(sources.keys()).indexOf(fact.source) + 1;
          paragraphs.add(fact.text + ' [' + number + ']');
        }
      }
    }
    return {answer:[...paragraphs].join('\n\n'), status:'answered', sources:[...sources.values()], mode:'archive'};
  }

  async function askArchive(question, previousTurns) {
    const incident = incidentReply(question, previousTurns);
    if (incident) return incident;
    const knownCases = window.FF?.cases || [];
    const selected = knownCases.filter(c => SUBJECTS[c.id]?.test(question));
    let carried = false;
    if (!selected.length && /^(?:(?:and|then|so)\b\s*)?(?:what (?:would|should|did|is|are|was|were) (?:we|they|the limit|its|the next)|what next|why\b|which source|what (?:about|limits)|what (?:does|would) (?:it|that|this)|tell me more|could (?:it|this)|what was measured)/i.test(question)) {
      const last = previousTurns.at(-1);
      const referenced = knownCases.find(c => c.id === last?.caseId);
      if (referenced) {selected.push(referenced);carried=true;}
    }
    if (selected.length === 1) {
      const subject = selected[0];
      const heading = (carried ? 'Continuing with ' : 'From the archived case on ') + subject.short + '.';
      if (/next|reanalysis|what (?:should|would|could) (?:we|they) test/i.test(question)) return excerpt(subject,'next',heading+'\n\nSuggested next test\n'+subject.next);
      if (/caveat|limitations?|limits|boundar|transfer|apply (?:it|this)/i.test(question)) return excerpt(subject,'limits',heading+'\n\nLimits of this comparison\n'+subject.limit);
      return excerpt(subject,'case',heading+'\n\nRecorded finding\n'+subject.record+'\n\nCase interpretation\n'+subject.decision);
    }
    if (!window.FFSearch) throw Error('The search index is missing from this copy of the dashboard.');
    const found = await window.FFSearch.search(question);
    const candidates = found.items.filter(item=>item.matches > 0 && item.score >= 0.36).slice(0,3);
    const sources = candidates.map(item=>normalizeSource({id:item.url,title:item.title,url:item.url,locator:item.lead})).filter(Boolean);
    return {
      answer:sources.length ? 'These archive records share terms with your question. Check the material, conditions and measurement in each source before drawing a conclusion.' : 'I could not identify an applicable case in the archive. Try an investigation, material or run identifier, or open the Data explorer to inspect individual records.',
      status:'abstained', sources, mode:'archive', model:'Archive search'
    };
  }

  // Citation actions use the same URL validation as the source list.
  function showAnswer(turn, index, retry) {
    const article = node('article', undefined, 'ffchat-reply');
    article.tabIndex = -1;
    article.setAttribute('aria-label', 'FIRST FIRE answer');
    const byline = node('div', undefined, 'ffchat-byline');
    const mark = node('img');
    mark.src = 'icon.svg';
    mark.alt = '';
    mark.width = 24;
    mark.height = 24;
    byline.append(mark, node('span', 'First Fire'));

    const sources = node('details', undefined, 'ffchat-sources');
    const sourceLinks = [];
    if (turn.sources.length) {
      const label = turn.status === 'abstained' ? 'Related records' : 'Sources';
      sources.append(node('summary', label + ' (' + turn.sources.length + ')'));
      const list = node('ol');
      for (const source of turn.sources) {
        const anchor = link(source.title, source.url);
        if (!source.url.startsWith('#')) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
        }
        const item = node('li');
        item.append(anchor);
        if (source.locator) item.append(node('small', source.locator));
        list.append(item);
        sourceLinks.push(anchor);
      }
      sources.append(list);
    }

    const body = node('div', undefined, 'ffchat-answer-text');
    for (const paragraph of turn.answer.split(/\n\s*\n/)) {
      const p = node('p');
      for (const part of paragraph.split(/(\[\d+\])/)) {
        const citation = /^\[(\d+)\]$/.exec(part);
        const source = citation && sourceLinks[Number(citation[1]) - 1];
        if (source) {
          const reference = button(part, () => {
            sources.open = true;
            source.focus();
          }, 'ffchat-cite');
          reference.setAttribute('aria-label', 'Show source ' + citation[1]);
          p.append(reference);
        } else {
          p.append(document.createTextNode(part));
        }
      }
      body.append(p);
    }
    const actions = node('div', undefined, 'ffchat-answer-actions');
    if (sourceLinks.length) actions.append(sources);
    const retryButton = button('Retry answer', () => retry(index), 'ffchat-quiet ffchat-retry');
    retryButton.title = 'Get a new answer in a separate chat';
    actions.append(retryButton);
    article.append(byline, body, actions);
    return article;
  }

  window.renderChat = function renderChat(root) {
    stopPreviousView?.();
    const state = readStore();
    let thread = state.threads.find(t => t.id === state.current);
    let mode;
    let healthTask;
    let request;
    let editing = null;
    let stopped = false;
    let persistenceWarning = '';

    const shell = node('section', undefined, 'ffchat');
    shell.setAttribute('aria-labelledby', 'ffchat-title');
    const top = node('header', undefined, 'ffchat-toolbar');
    const title = node('h1', 'Research chat');
    title.id = 'ffchat-title';
    const tools = node('div', undefined, 'ffchat-tools');
    const historyWrap = node('div', undefined, 'ffchat-history');
    const recent = node('section', undefined, 'ffchat-recent');
    recent.id = 'ffchat-recent';
    recent.setAttribute('aria-label', 'Chat history');
    recent.hidden = true;
    const historyButton = button('History', () => toggleHistory(recent.hidden), 'ffchat-tool ffchat-history-toggle');
    historyButton.setAttribute('aria-controls', recent.id);
    historyButton.setAttribute('aria-expanded', 'false');
    historyWrap.append(historyButton, recent);
    const add = button('New chat', startNew, 'ffchat-tool ffchat-new');
    tools.append(historyWrap, add);
    top.append(title, tools);

    const desk = node('div', undefined, 'ffchat-desk');
    const welcome = node('div', undefined, 'ffchat-welcome');
    const welcomeCopy = node('div');
    welcomeCopy.append(node('h2', 'What would you like to know?'),
      node('p', 'Explore NASA’s fire experiments, spacecraft incidents, and lunar forecasts.'));
    const photo = node('img');
    photo.src = 'sibal.png';
    photo.alt = 'Two flames spreading along fabric in a NASA Glenn drop-tower experiment.';
    photo.width = 558;
    photo.height = 522;
    const figure = node('figure');
    figure.append(photo, node('figcaption', 'SIBAL experiment · NASA Glenn'));
    welcome.append(welcomeCopy, figure);

    const exchange = node('div', undefined, 'ffchat-exchange');
    exchange.setAttribute('role', 'log');
    exchange.setAttribute('aria-live', 'off');
    exchange.setAttribute('aria-label', 'Messages');
    const form = node('form', undefined, 'ffchat-form');
    const editNotice = node('div', undefined, 'ffchat-branch');
    const label = node('label', 'Your question', 'ffchat-sr');
    label.htmlFor = 'ffchat-question';
    const input = node('textarea');
    input.id = label.htmlFor;
    input.rows = 1;
    input.maxLength = MAX_MESSAGE;
    input.placeholder = 'Ask a question…';
    const hint = node('span', 'Enter to send. Shift and Enter for a new line.', 'ffchat-sr');
    hint.id = 'ffchat-input-hint';
    input.setAttribute('aria-describedby', hint.id);
    const send = node('button', 'Send', 'ffchat-send');
    send.type = 'submit';
    const cancel = button('Stop reply', () => {
      if (request) {
        request.userStopped = true;
        request.controller.abort();
      }
    }, 'ffchat-send ffchat-stop');
    const composer = node('div', undefined, 'ffchat-composer');
    composer.append(label, hint, input, send, cancel);
    const feedback = node('div', undefined, 'ffchat-feedback');
    feedback.setAttribute('role', 'status');
    const error = node('div', undefined, 'ffchat-error');
    error.setAttribute('role', 'alert');
    form.append(editNotice, composer, error, feedback);
    desk.append(welcome, exchange, form);

    const starters = node('section', undefined, 'ffchat-starters');
    starters.setAttribute('aria-labelledby', 'ffchat-starters-title');
    const startersTitle = node('h2', 'Try a question');
    startersTitle.id = 'ffchat-starters-title';
    const suggestions = node('div', undefined, 'ffchat-suggestions');
    for (const [topic, question] of EXAMPLES) {
      const starter = button('', () => sendMessage(question), 'ffchat-example');
      starter.append(node('small', topic), node('span', question));
      suggestions.append(starter);
    }
    starters.append(startersTitle, suggestions);
    shell.append(top, desk, starters);
    root.replaceChildren(shell);

    function isActive() { return !stopped && shell.isConnected; }

    function save() {
      state.current = thread.id;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        persistenceWarning = '';
      } catch {
        persistenceWarning = 'Tab storage is unavailable. Reloading may clear this chat.';
      }
    }

    function resizeInput() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 180) + 'px';
    }

    function updateInput(text) {
      input.value = text;
      resizeInput();
    }

    function clearEdit() {
      editing = null;
      editNotice.hidden = true;
      editNotice.replaceChildren();
    }

    function toggleHistory(open) {
      recent.hidden = !open;
      historyButton.setAttribute('aria-expanded', String(open));
    }

    function threadTitle(t) {
      const original = state.threads.find(other => other.id !== t.id && other.turns[0]?.question === t.turns[0]?.question);
      if (original) {
        const difference = t.turns.findIndex((turn, i) => original.turns[i]?.question !== turn.question);
        if (difference > 0) return questionTitle(t.turns[difference].question);
      }
      return questionTitle(t.turns[0].question);
    }

    function drawHistory() {
      const conversations = state.threads.filter(t => t.turns.length).slice().reverse();
      historyButton.disabled = !conversations.length || !!request;
      const list = node('ul');
      for (const conversation of conversations) {
        const item = node('li');
        const title = threadTitle(conversation);
        const control = button(title, () => switchThread(conversation), 'ffchat-history-link');
        if (conversation.revision) control.append(node('small', 'Reply ' + conversation.revision));
        if (conversation.id === thread.id) control.setAttribute('aria-current', 'true');
        item.append(control);
        list.append(item);
      }
      recent.replaceChildren(node('h2', 'Chat history'), list);
    }

    function switchThread(next) {
      if (request) return;
      thread = next;
      toggleHistory(false);
      clearEdit();
      error.replaceChildren();
      feedback.textContent = '';
      updateInput('');
      save();
      draw();
      if (next.turns.length) focusReply();
    }

    function startNew() {
      if (request) return;
      let empty = state.threads.find(t => !t.turns.length);
      if (!empty) {
        empty = newThread();
        state.threads.push(empty);
      }
      switchThread(empty);
      input.focus();
    }

    function beginEdit(index) {
      editing = index;
      editNotice.hidden = false;
      editNotice.replaceChildren(node('span', 'Your edit will open in a new chat.'),
        button('Cancel edit', () => {
          clearEdit();
          updateInput('');
          input.focus();
        }, 'ffchat-quiet'));
      updateInput(thread.turns[index].question);
      input.focus();
    }

    function userBubble(text, index) {
      const article = node('article', undefined, 'ffchat-question');
      article.setAttribute('aria-label', 'Your message');
      article.append(node('p', text));
      if (index !== undefined) {
        const edit = button('Edit question', () => beginEdit(index), 'ffchat-edit ffchat-quiet');
        article.append(edit);
      }
      return article;
    }

    function retry(index) {
      if (request) return;
      sendMessage(thread.turns[index].question, index, true);
    }

    function draw() {
      const turns = request?.context || thread.turns;
      const isEmpty = !turns.length && !request;
      welcome.hidden = !isEmpty;
      starters.hidden = !isEmpty;
      exchange.hidden = isEmpty;
      desk.classList.toggle('ffchat-fresh', isEmpty);
      exchange.replaceChildren();
      turns.forEach((turn, i) => {
        exchange.append(userBubble(turn.question, i), showAnswer(turn, i, retry));
      });
      if (request) {
        exchange.append(userBubble(request.message), node('p', 'Looking for evidence…', 'ffchat-wait'));
        for (const control of exchange.querySelectorAll('.ffchat-edit,.ffchat-retry')) control.disabled = true;
      }
      add.disabled = !!request || isEmpty;
      cancel.hidden = !request;
      send.hidden = !!request;
      input.readOnly = !!request;
      input.placeholder = thread.turns.length ? 'Ask a follow-up…' : 'Ask a question…';
      drawHistory();
    }

    function focusReply() {
      const reply = exchange.querySelector('.ffchat-reply:last-child');
      if (!reply) return;
      reply.focus({preventScroll:true});
      const position = reply.getBoundingClientRect();
      if (position.top < 0 || position.top > window.innerHeight - 100) {
        reply.scrollIntoView({block:'start', behavior:'instant'});
      }
    }

    function saveBranch(context, retrying) {
      const fork = newThread();
      if (retrying) {
        fork.retryRoot = thread.retryRoot || thread.id;
        fork.revision = 2 + state.threads.filter(t => t.retryRoot === fork.retryRoot).length;
      }
      fork.turns = context;
      state.threads.push(fork);
      thread = fork;
    }

    async function sendMessage(raw, branchIndex = editing, retrying = false) {
      if (request || !isActive()) return;
      const message = raw.trim();
      if (!message || message.length > MAX_MESSAGE) {
        error.textContent = !message ? 'Enter a question to send.' : 'Shorten your question to 2,000 characters.';
        input.focus();
        return;
      }
      toggleHistory(false);
      error.replaceChildren();
      feedback.textContent = '';
      updateInput('');
      editNotice.hidden = true;
      const context = thread.turns.slice(0, branchIndex === null ? undefined : branchIndex);
      const working = {controller:new AbortController(), message, context, userStopped:false};
      request = working;
      draw();
      cancel.focus({preventScroll:true});
      const timer = setTimeout(() => working.controller.abort(), 150000);
      try {
        await healthTask;
        if (working.controller.signal.aborted || !isActive()) throw Error('Stopped');
        const answer = mode === 'local'
          ? await askService(message, context, working.controller.signal)
          : await askArchive(message, context);
        if (working.controller.signal.aborted || !isActive()) throw Error('Stopped');
        if (branchIndex !== null) saveBranch(context, retrying);
        thread.turns.push({question:message, ...answer});
        clearEdit();
        save();
        feedback.classList.toggle('ffchat-sr', !persistenceWarning);
        feedback.textContent = persistenceWarning || 'Answer ready.';
      } catch (problem) {
        if (!isActive()) return;
        if (branchIndex !== null) beginEdit(branchIndex);
        updateInput(message);
        feedback.classList.remove('ffchat-sr');
        if (working.userStopped) {
          feedback.textContent = 'Reply stopped. You can edit or resend your question.';
        } else {
          const message = working.controller.signal.aborted ? 'The reply timed out.' : 'The reply could not be loaded.';
          error.append(node('span', message + ' Send your question again.'));
          if (mode === 'local') {
            error.append(button('Search saved records', () => {
              mode = 'archive';
              sendMessage(input.value, branchIndex, retrying);
            }, 'ffchat-quiet'));
          }
        }
      } finally {
        clearTimeout(timer);
        if (request === working) {
          request = null;
          if (isActive()) {
            draw();
            if (!input.value) focusReply();
            else input.focus();
          }
        }
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      sendMessage(input.value);
    });
    input.addEventListener('input', resizeInput);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229 &&
          !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        sendMessage(input.value);
      }
    });
    function outsideHistory(event) {
      if (!recent.hidden && !historyWrap.contains(event.target)) toggleHistory(false);
    }
    function escapeHistory(event) {
      if (event.key === 'Escape' && !recent.hidden) {
        event.preventDefault();
        toggleHistory(false);
        historyButton.focus();
      }
    }
    function onHashChange() {
      if (location.hash.split('?')[0] !== '#chat') stop();
    }
    function stop() {
      stopped = true;
      request?.controller.abort();
      document.removeEventListener('pointerdown', outsideHistory);
      document.removeEventListener('focusin', outsideHistory);
      document.removeEventListener('keydown', escapeHistory);
      window.removeEventListener('hashchange', onHashChange);
    }
    stopPreviousView = stop;
    document.addEventListener('pointerdown', outsideHistory);
    document.addEventListener('focusin', outsideHistory);
    document.addEventListener('keydown', escapeHistory);
    window.addEventListener('hashchange', onHashChange);
    clearEdit();
    draw();
    healthTask = checkService().then(info => { mode = info ? 'local' : 'archive'; });
  };
})();
