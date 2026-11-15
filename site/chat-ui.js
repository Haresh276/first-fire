/* Chat is local to this tab. Text from users, imported storage and responses only enters text nodes. */
(() => {
  'use strict';

  const STORAGE_KEY = 'first-fire.chat.v1';
  const MAX_MESSAGE = 2000;
  const MAX_HISTORY = 12;
  const EXAMPLES = [
    ['Materials', 'Did the Nomex ignite in Saffire-II sample 2-7?', 'saffire'],
    ['Archive calculation', 'Compare mean burn duration for methanol and heptane in FLEX.', 'flex'],
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
  let navigationDraft;

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
    if(raw==='data/tests.csv')return raw;
    if (/^#(?:case\/[\w-]+(?:\/[\w-]+)?|data(?:\?[^\s]*)?|report\/[\w-]+|physics(?:\?mode=rover)?|referee(?:\?view=errors)?|atlas|compass|passports|rulebook|earth|forecast|sources|acrylic|study|guide|benchmark)$/.test(raw)) return raw;
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
    const threads = [];
    if (data?.version === 1 && Array.isArray(data.threads)) {
      for (const thread of data.threads) {
        if (typeof thread?.id !== 'string' || !Array.isArray(thread.turns)) continue;
        thread.turns = thread.turns.filter(t => typeof t?.question === 'string' && typeof t.answer === 'string')
          .map(t => ({...t, sources: Array.isArray(t.sources) ? t.sources.map(normalizeSource).filter(Boolean) : []}));
        if (thread.turns.length) threads.push(thread);
      }
    }
    // Reopening Chat in this document uses memory. A new document always starts a fresh conversation.
    const first = newThread();
    threads.push(first);
    return memory = {current: first.id, threads};
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
    const extraSubjects=records.length && /\b(?:nomex|saffire|flex-?\d*|gas burner|hospital|rover|gaganyaan|mercury|sibal|luci|teflon|synergy pro|fm2)\b/i.test(q);
    if(extraSubjects)return abstain('mixed');
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

  // Translate only surface forms of existing archive predicates. Unbound nouns, units,
  // negations and conjunctions must reach the strict parser so it can ask for clarification.
  const digits=['zero','one','two','three','four','five','six','seven','eight','nine','ten',
    'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const tens=['twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const smallNumber=digits.join('|');
  const writtenNumber='(?:'+tens.join('|')+')(?:[ -](?:'+digits.slice(1,10).join('|')+'))?|'+smallNumber+'|an?';
  const measuredUnits='(?:minutes?|mins?|seconds?|secs?|millimet(?:er|re)s?|centimet(?:er|re)s?|percent(?:age)?|percentage points?|atmospheres?|psia|kpa|mmhg|bar|mm|cm|mg/s|cm/s|mm/s|m/s|atm|g)\\b|%';
  const writtenWithUnit=new RegExp('\\b('+writtenNumber+')(?=\\s+(?:'+measuredUnits+'))','gi');
  const archiveRowNoun='(?:rows?|records?|observations?|runs?|entries|samples?|tests?)';
  const membership=new RegExp('\\b('+archiveRowNoun+')\\s+(?:that\\s+|which\\s+)?(?:use[sd]?|using|contain(?:s|ed)?|containing)\\s+','gi');
  const accessionOrStudy='(?:PSI[- ]?\\d+|[\\w]+(?:-[\\w]+)*)';
  const studyContains=new RegExp('\\b(?:does|did|do)\\s+(?:the\\s+)?('+accessionOrStudy+')\\s+(?:contain|include|have|hold)\\b','gi');
  function calculatorInput(question) {
    function translate(clause) {
      return clause
        .replace(/\b(PSI[- ]?\d+|[a-z][\w-]*)\s+study\b/gi,(original,name)=>{
          const lower=name.toLowerCase().replace(/^psi[- ]?/,'psi-');
          return window.FF?.investigations?.some(i=>[i.name,i.accession].some(s=>s.toLowerCase()===lower))?name:original;
        })
        .replace(/\b(?:belong(?:s|ed|ing)?\s+to|(?:are|were|is)\s+part\s+of)\b/gi,'in')
        .replace(studyContains,'in $1')
        .replace(membership,'$1 with ')
        .replace(/\b(?:using|used)\s+(?:the\s+)?(?:fuel|material)\b/gi,'with material')
        .replace(/\b(normal|inverse)[- ]flames?\b(?!\s+(?:duration|time|extinction|diameter))/gi,'$1')
        .replace(/\bdroplets\b/gi,'droplet')
        .replace(/\b(?:(?:does|did|do)\s+not|never)\s+exceed\b/gi,'at most')
        .replace(/\bexceed(?:s|ed|ing)?\b/gi,'above')
        .replace(writtenWithUnit,match=>{
          const words=match.toLowerCase().split(/[ -]/);
          if(words[0]==='a'||words[0]==='an')return '1';
          const ten=tens.indexOf(words[0]);
          return String(ten<0?digits.indexOf(words[0]):(ten+2)*10+(words[1]?digits.indexOf(words[1]):0));
        });
    }
    // Quoted specimen labels are data: preserving punctuation and spelling is essential for an exact match.
    return question.split(/("[^"]*"|“[^”]*”)/).map((part,i)=>i%2?part:translate(part)).join('');
  }

  const groupReference=/\b(?:those|these|them|their|its|it|(?:that|this|the (?:previous|same)) (?:study|group|subset|selection|set|investigation|samples?|runs?|tests?|observations?|records?|rows?))\b/i;
  const quantifier=/\b(?:how many|count|number of|total|percent(?:age)?|share|fraction|proportion|mean|median|average|range|lowest|highest|smallest|largest|maximum|minimum)\b/i;
  function archiveRequest(question,prior) {
    const input=calculatorInput(question);
    const plain=input.replace(/"[^"]*"|“[^”]*”/g,'');
    const follow=/^(?:and\b|of those\b|among those\b|for those\b|what about\b|how about\b|within those\b|which of (?:those|them)\b)/i.test(plain);
    const scoped=groupReference.test(plain) && (quantifier.test(plain) || (follow && !!prior?.analysis?.plan));
    if(!scoped)return {input};
    if(prior?.evidenceKind!=='archive-calculation' || !Array.isArray(prior.analysis?.rows))return {input,missingScope:true};
    const resolved=input.split(/("[^"]*"|“[^”]*”)/).map((clause,i)=>i%2?clause:
      clause.replace(/\b(?:that|this|the (?:previous|same)) (?:study|group|subset|selection|set|investigation|samples?|runs?|tests?|observations?|records?|rows?)\b/gi,'those')
        .replace(/\bits\b/gi,'their')).join('');
    return {input:/^of those\b/i.test(resolved)?resolved:'Of those, '+resolved,scope:true};
  }

  // The previous numerator is the population for "of those". This also preserves
  // the denominator of a new percentage when a previous selection used a numeric limit.
  function selectedArchive(prior,archive) {
    const ids=new Set(prior.analysis.rows);
    return {...archive,tests:archive.tests.filter(row=>ids.has(row.record_id))};
  }

  function observedLunarOutcome(question, previous, forecast) {
    if(!forecast || !Array.isArray(forecast.burns))return null;
    const q=question.normalize('NFKC').toLowerCase();
    const explicit=/\bfm[- ]?2\b|flammability of materials on the moon|(?:lunar|moon) (?:surface )?(?:fabric )?(?:burns?|tests?)|burns? on the moon|synergy pro navy/.test(q);
    const mentionsOutcome=/\b(?:succeed(?:ed)?|fail(?:ed)?|success(?:es|ful)?|outcomes?|results?|burned|sustained|spread|resolved|completed|(?:been|were|are) (?:observed|reported|verified|confirmed))\b/.test(q);
    const resumed=previous.at(-1)?.evidenceKind==='lunar-outcome' && mentionsOutcome &&
      /^(?:and |how many|what (?:share|percent|fraction|rate)|what about|of those|have any|did any)/.test(q);
    if(!explicit && !resumed)return null;
    if(/\b(?:hypothetical(?:ly)?|simulate[d]?|suppos(?:e|ing)|imagine|if|what if|assuming|brier|assume)\b/.test(q))return null;
    const observation=/\b(?:observed|actual(?:ly)?|measured|verified|confirmed|completed|already|succeeded|failed|flew|flown|so far|to date|in reality|results? (?:are|were|available)|did .*?(?:burn|spread|happen)|have .*?(?:burned|sustained|spread|reported|returned))\b/.test(q);
    const rate=/\b(?:success rate|observed rate|fraction|percentage|percent|share|proportion)\b/.test(q);
    const predictive=/\b(?:predict(?:ed|ion)?|forecast|expects?|expected|estimate[d]?|chance|odds|model|likely)\b/.test(q);
    if(!observation && (!rate || predictive))return null;
    if(!observation && !/\b(?:success|successes|successful|succeed|failed|failure|burned|completed|sustain(?:ed)?)\b/.test(q))return null;
    const resolved=forecast.burns.filter(b=>b.outcome===true || b.outcome===false || b.outcome==='yes' || b.outcome==='no');
    const yes=resolved.filter(b=>b.outcome===true || b.outcome==='yes').length;
    const sources=[{id:'fm2-outcomes',title:'FIRST FIRE · public FM² outcome register',url:'#forecast',locator:'Release dated '+forecast.as_of+' · recorded outcomes for the four planned burns'}];
    const design=forecast.sources.find(s=>s.id==='lpsc-slides');
    if(design)sources.push(normalizeSource(design));
    let answer='The '+forecast.as_of+' release records '+resolved.length+' verified lunar burn outcomes out of '+forecast.burns.length+' planned FM² tests. [1]';
    if(!resolved.length)answer+=' With zero resolved tests, the observed success fraction is undefined. There is no measured success percentage to report. [1]';
    else answer+=' Of those '+resolved.length+' resolved tests, '+yes+' sustained spread ('+(100*yes/resolved.length).toFixed(2)+'%). [1]';
    if(design)answer+='\n\nNASA’s experiment design specifies the planned starting atmospheres. The published predictions can be compared with official outcomes once those outcomes are recorded. [2]';
    return {mode:'archive',evidenceKind:'lunar-outcome',status:resolved.length?'answered':'limited',answer,sources};
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
  function showAnswer(turn, index, retry, earlier, correct) {
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
        const proof=window.FFProofDrawer?.drawer(source,turn.verification);
        if(proof)item.append(proof);
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
    if(turn.evidenceKind==='archive-calculation' && window.FFScienceChat) {
      const receiptButton=button('Download calculation',async()=>{
        receiptButton.disabled=true;
        try {
          if(!Array.isArray(window.FF.tests))await window.FFLoadAsset('observation-rows.js');
          const prior=earlier.at(-1);
          const archive=turn.previousSelection?selectedArchive(prior,window.FF):window.FF;
          const record=window.FFScienceChat.receipt(turn.calculationInput || turn.question,earlier,archive);
          if(!record)throw Error('Calculation unavailable');
          record.question=turn.question;
          if(turn.calculationInput)record.calculation_input=turn.calculationInput;
          if(turn.previousSelection || (prior?.analysis?.plan && /^(?:and |of those|among those|for those|what about|how about|now\b|instead\b|only\b|within those|which of (?:those|them))/i.test(turn.question))){
            record.previous_question=prior.question;
            if(turn.previousSelection)record.previous_selection={count:prior.analysis.rows.length,row_ids:prior.analysis.rows};
          }
          const uri=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
          const download=document.createElement('a');
          download.href=uri;download.download='first-fire-archive-calculation.json';download.click();
          setTimeout(()=>URL.revokeObjectURL(uri),1000);
        } catch {
          receiptButton.textContent='Could not open the archive. Retry download';
        } finally {receiptButton.disabled=false;}
      },'ffchat-quiet');
      actions.append(receiptButton);
    }
    const retryButton = button('Retry answer', () => retry(index), 'ffchat-quiet ffchat-retry');
    retryButton.title = 'Get a new answer in a separate chat';
    actions.append(retryButton);
    const provenance={
      'checked':'Checked against the cited experiment',
      'calculation':'Calculated with the FM² threshold model',
      'archive-calculation':'Calculated from NASA observation rows',
      'tool-calculation':'Reproduced by the research tool',
      'archive-clarification':'Archive calculation needs clarification',
      'lunar-outcome':'FM² observed outcome register',
      'input-needed':'Forecast inputs needed',
      'quote-only':'Source excerpt · interpretation withheld',
      'archive-note':'Supplementary archive notes · independent claim review unavailable',
      'mission-note':'Mission history summary · independent claim review unavailable',
      'withheld':'Insufficient verified evidence'
    }[turn.evidenceKind];
    article.append(byline);
    if(turn.intent){
      const hint=node('div',undefined,'ff-intent');
      hint.append(node('strong',turn.intent.label));
      const toggle=button('Not what I meant',()=>{choices.hidden=!choices.hidden;toggle.setAttribute('aria-expanded',String(!choices.hidden));if(!choices.hidden)choices.querySelector('button')?.focus();},'ffchat-quiet');
      toggle.setAttribute('aria-expanded','false');
      const choices=node('div',undefined,'actions');choices.hidden=true;
      for(const [type,[label]] of Object.entries(window.FFIntentRouter.routes)){
        if(type!==turn.intent.type)choices.append(button(label,()=>correct(index,type),'ghost'));
      }
      hint.append(toggle,choices);article.append(hint);
    }
    if(provenance) article.append(node('p',provenance,'rf-evidence-label'));
    article.append(body, actions);
    if(turn.verification){
      const drawer=window.FFEvidenceDesk.panel(turn);const depth=window.FFReaderDevice?.readingNote?.(turn);
      if(depth instanceof Node)drawer.append(depth);
      article.append(drawer);
    }
    for (const review of turn.reviewIds || (turn.reviewId ? [turn.reviewId] : [])) {
      const proof = window.FFDeckReferee?.proof(review);
      if (proof) article.append(proof);
    }
    const route=turn.intent;
    if(route && !['archive','incident','abstain'].includes(route.type))article.append(link('Open '+route.label+' →',route.href,'rf-continue'));
    else if(!route){const engine=window.FFDeckReferee?.route(turn.question);if(engine)article.append(link('Open '+engine[0]+' →',engine[1],'rf-continue'));}
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
    input.autocomplete = 'off';
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
    if (window.FFDeckReferee) shell.append(window.FFDeckReferee.preferences(question => {
      updateInput(question);
      input.focus();
    }));
    root.replaceChildren(shell);

    function isActive() { return !stopped && shell.isConnected; }

    function save() {
      state.current = thread.id;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({version:1, threads:state.threads.filter(t => t.turns.length)}));
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
        exchange.append(userBubble(turn.question, i), showAnswer(turn, i, retry, turns.slice(0,i),(idx,type)=>sendMessage(thread.turns[idx].question,idx,true,type)));
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

    async function sendMessage(raw, branchIndex = editing, retrying = false, chosenIntent=null) {
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
        if (working.controller.signal.aborted || !isActive()) throw Error('Stopped');
        const engine = window.FFDeckReferee?.route(message);
        const archiveQuery=archiveRequest(message,context.at(-1));
        const quantitative = archiveQuery.missingScope || window.FFScienceChat?.isCandidate(archiveQuery.input,context);
        const router=window.FFIntentRouter, verifier=window.FFEvidenceDesk;
        let intent=router.detect(message,context);
        if(intent.refs?.ids.length && !Array.isArray(window.FF.tests)){
          await window.FFLoadAsset('observation-rows.js');intent=router.detect(message,context);
        }
        if(quantitative && !['forecast','compare','physics','compass','referee','incident'].includes(intent.type) && !intent.boundary)intent=router.intent('archive');
        if(chosenIntent && intent.type!==chosenIntent){
          const params=['compass','physics'].includes(chosenIntent)?router.inputFields(message.normalize('NFKC').toLowerCase(),chosenIntent):{};
          intent=router.intent(chosenIntent,params,{corrected:true});
        }
        const toolRequest = engine && !quantitative && /^(?:open|use|launch|take me to|show me the|where (?:can|do) i (?:find|open|use))\b/i.test(message);
        let answer;
        const observation=(!chosenIntent||chosenIntent==='abstain')&&!toolRequest && observedLunarOutcome(message,context,window.FF?.forecast);
        const forecastInput=intent.type==='forecast'&&!/fm[- ]?2|synergy|lunar burn/i.test(message.normalize('NFKC'))&&!context.at(-1)?.calculation?'FM2 '+message:message;
        const calculation=observation || (intent.type==='forecast'&&!toolRequest && (verifier.toolAnswer(intent,message,window.FF)||window.FFDeckReferee?.forecastAnswer(forecastInput,context)));
        if (calculation) {
          answer=calculation;
          if(observation)intent=router.intent('abstain',{}, {boundary:'observations'});
          else if(forecastInput!==message)answer.forecastInput=forecastInput;
        } else if(['compare','compass','rulebook','physics','referee'].includes(intent.type) || intent.type==='record'&&intent.params.record && /^(?:open|inspect|show|read|find|list|look up|pull up|give me the row)\b/i.test(message)){
          if(['compare','compass','record'].includes(intent.type)&&!Array.isArray(window.FF.tests))await window.FFLoadAsset('observation-rows.js');
          if(intent.type==='physics'&&!window.FFPhysics)await window.FFLoadAsset('physics-lab.js');
          if(intent.type==='referee')answer=await verifier.checkSubmitted(message,intent);
          else answer=verifier.toolAnswer(intent,message,window.FF)||verifier.clarify('Choose the source row in the Atlas.');
        } else if(intent.type==='archive'&&archiveQuery.missingScope) {
          answer={mode:'calculation',evidenceKind:'archive-clarification',status:'abstained',sources:[],
            answer:'Which group of archive rows do you mean? Name an investigation, material or selection to establish the denominator.'};
        } else if(intent.type==='archive'&&quantitative) {
          if(!Array.isArray(window.FF.tests))await window.FFLoadAsset('observation-rows.js');
          const prior=context.at(-1);
          const archive=archiveQuery.scope?selectedArchive(prior,window.FF):window.FF;
          answer=window.FFScienceChat.answer(archiveQuery.input,context,archive);
          if(answer.analysis && archiveQuery.input!==message)answer.calculationInput=archiveQuery.input;
          if(answer.analysis && archiveQuery.scope){
            answer.previousSelection=true;
            answer.answer+='\n\nThis calculation starts with the '+prior.analysis.rows.length+' matching rows in your previous result.';
          }
        } else if(intent.type==='abstain'&&!toolRequest) {
          answer=verifier.decline('I don’t have a source that establishes an answer to that question. Name an experiment, incident or measured quantity, or choose the intended tool.');
        } else if(chosenIntent && intent.corrected) {
          answer=verifier.clarify('This question needs more information for '+intent.label+'. Edit the question or open the selected tool.');
        } else if (toolRequest) {
          answer = {answer:engine[2], status:'limited', sources:[], mode:'navigation'};
        } else {
          await healthTask;
          if(working.controller.signal.aborted || !isActive())throw Error('Stopped');
          answer = mode === 'local'
            ? await askService(message, context, working.controller.signal)
            : await askArchive(message, context);
          if (window.FFDeckReferee && !working.controller.signal.aborted) {
            answer = await window.FFDeckReferee.checkedReply(message, answer);
          }
        }
        answer=await verifier.gate(message,answer,context,intent);
        const {type,label,href,params}=intent;answer.intent={type,label,href,params};
        verifier.remember(message,answer);
        if (working.controller.signal.aborted || !isActive()) throw Error('Stopped');
        if (branchIndex !== null) saveBranch(context, retrying);
        thread.turns.push({question:message, ...answer});
        if(answer.evidenceKind==='archive-calculation') {
          document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{
            tool:'chat',title:'Archive question',summary:message+' — '+answer.answer.split('\n')[0],
            record:{question:message,answer:answer.answer,sources:answer.sources,analysis:answer.analysis}
          }}));
        } else {
          document.dispatchEvent(new CustomEvent('ff-research-result',{detail:{tool:'chat',invalid:true}}));
        }
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
      if (stopped) return;
      navigationDraft = request ? null : {threadId:thread.id, text:input.value, editing};
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
    if (navigationDraft?.threadId === thread.id) {
      if (navigationDraft.editing !== null) beginEdit(navigationDraft.editing);
      updateInput(navigationDraft.text);
      navigationDraft = null;
    }
    const suggested=new URLSearchParams(location.hash.split('?')[1]||'').get('q');
    if(suggested?.trim()) {
      clearEdit();
      updateInput(suggested.slice(0,MAX_MESSAGE));
    }
    draw();
    healthTask = checkService().then(info => { mode = info ? 'local' : 'archive'; });
  };
})();
