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
    same: /\b(?:[Ss]ame-[Rr]|SAME(?:-R)?|[Kk]apton|KAPTON|[Tt]eflon|TEFLON)\b/,
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

  function safeDirections(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(item => item && typeof item.label === 'string' && item.label.trim() &&
      typeof item.href === 'string' && window.FFDirections?.isDestination(item.href));
  }

  // A receipt or explanation still refers to its original turn. Stop at the
  // first other turn so a new question never inherits an unrelated citation.
  function evidenceHistory(context) {
    let end = context.length;
    while (end && context[end - 1].evidenceFollowup === true) end--;
    return end === context.length ? context : context.slice(0, end);
  }

  function evidenceTurn(context) {
    return evidenceHistory(context).at(-1);
  }

  function previousCase(context) {
    const turn = evidenceTurn(context);
    if (!turn || turn.status === 'abstained' || !turn.sources?.length || turn.mode === 'calculation') return;
    const cases = window.FF?.cases || [];
    if (turn.caseId) return cases.find(item => item.id === turn.caseId);
    // Older saved replies and service responses may have citations without a case ID.
    const cited = cases.filter(item => turn.sources.some(source =>
      source.url === '#case/' + item.id || item.sources.some(publication => publication.url === source.url)));
    if (cited.length === 1) return cited[0];
    const named = cited.filter(item => SUBJECTS[item.id]?.test(turn.question));
    if (named.length === 1) return named[0];
  }

  function detailRequest(text) {
    const q = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/^(?:please |(?:can|could|would) you (?:please )?)/, '');
    const referent = /\b(?:this|that|the|previous|same|its) (?:experiment|study|investigation|test|case|result|setup|procedure|finding)s?\b|\b(?:it|that|this|they|those)\b/;
    const expansion = /\b(?:detailed|detail|details|elaborate|expand|explain|describe|walk me through|tell me more|say more|what happened|how (?:did|was|were))\b/;
    return /^(?:tell me more|go on|continue|say more|(?:please )?elaborate|more details?(?: please)?|(?:explain|expand|go) (?:further|deeper)|what happened|how so)$/.test(q)
      || (referent.test(q) && expansion.test(q) && /\b(?:it|them|that|this|experiment|study|investigation|test|case|result|setup|procedure|findings?|conducted|performed|work|done|happen|detail|details|more|further|depth|please)$/.test(q));
  }

  // These are the project's source-backed passage records. Each paragraph keeps
  // its own publication and locator, including distinct flight and ground sources.
  const nomexFiber = {
    id:'saffire:fiber', title:'DuPont · Technical guide for Nomex fiber',
    url:'https://www.dupont.com/content/dam/dupont/amer/us/en/personal-protection/public/documents/en/Nomex%28R%29%20Fiber%20Technical%20Guide.pdf',
    locator:'Section I, printed p. 1, “What is Nomex?” and “Molecular structure of Nomex fiber.”',
    text:'Nomex is a family of heat-resistant fibers. Its meta-aramid polymer gives the fiber its flame resistance. One familiar use is protective clothing for firefighters.'
  };
  function caseReading(subject, fields) {
    const passages = [nomexFiber, ...(window.FFRefereePassages || [])];
    const sources = [];
    const paragraphs = [];
    for (const field of fields) {
      const passage = passages.find(item => item.id === subject.id + ':' + field);
      if (!passage) continue;
      const source = normalizeSource(passage);
      if (!source) continue;
      let index = sources.findIndex(item => item.url === source.url && item.locator === source.locator);
      if (index < 0) index = sources.push(source) - 1;
      paragraphs.push(passage.text + ' [' + (index + 1) + ']');
    }
    if (!paragraphs.length) return;
    return {caseId:subject.id, mode:'archive', evidenceKind:'archive-note', status:'limited',
      answer:subject.short + (subject.id === 'saffire' ? ' · sample 2-7' : ' · ' + subject.title) + '\n\n' + paragraphs.join('\n\n'), sources};
  }

  function contextualReading(message, history) {
    const q = message.trim().replace(/[.!?]+$/, '');
    const subjects = (window.FF?.cases || []).filter(item => SUBJECTS[item.id]?.test(q));
    if (subjects.length === 1 && subjects[0].id === 'saffire' && /^(?:(?:can|could|would) you (?:please )?)?(?:what is|what[’']s|tell me about|explain(?: to me)?(?: about)?|describe) (?:the )?nomex(?: (?:fabric|material))?$/i.test(q)) {
      return caseReading(subjects[0], ['fiber','time']);
    }
    // A new named experiment or run must be resolved on its own terms.
    if (subjects.length || /\b(?:PSI[- ]?\d+|(?:run|sample|test)\s+\d+|Apollo|Mir|BASS|ACME|Saffire)\b/i.test(q)) return;
    const subject = previousCase(history);
    if (detailRequest(q)) {
      if (subject) {
        const fields = subject.id === 'saffire' ? ['record','time','reason','ground'] : ['record','reason','limit'];
        return caseReading(subject, fields);
      }
      const turn = evidenceTurn(history);
      if (turn?.sources?.length && turn.status !== 'abstained') {
        const pinned = (window.FFRefereePassages || []).filter(p => turn.sources.some(s => s.id === p.id && s.url === p.url));
        const more = pinned.filter(p => !turn.answer.includes(p.text)).map(p => {
          const index = turn.sources.findIndex(s => s.id === p.id && s.url === p.url);
          return p.text + ' [' + (index + 1) + ']';
        });
        return {mode:'archive', status:turn.status, evidenceKind:turn.evidenceKind === 'archive-calculation' ? 'calculation-explanation' : 'archive-note',
          evidenceFollowup:true, sources:turn.sources,
          answer:[explainEvidence(turn), ...more].join('\n\n')};
      }
      return {mode:'conversation', status:'limited', sources:[],
        answer:'Which experiment would you like me to explain? Give me its name, sample number, or the material NASA tested.'};
    }
    if (!subject) return;
    if (/^(?:(?:and|so) )?(?:(?:what (?:are|were) (?:its|the|its main)|any) (?:limitations?|caveats?)|where does (?:that|this) apply)$/i.test(q)) return caseReading(subject,['limit']);
    if (subject.id === 'saffire' && /^(?:(?:and|so) )?(?:how long did (?:it|the (?:material|fabric|test|sample|experiment|burn)) (?:burn|last)|what was (?:its|the) (?:burn )?duration|what (?:actually )?(?:caught fire|burned|ignited))$/i.test(q)) return caseReading(subject,['time']);
  }

  function selectedRowLinks(analysis) {
    const rows = analysis.rows;
    const representatives = Array.isArray(analysis.groups) ? analysis.groups.map(group => group?.rows?.[0]) : [];
    const links = [];
    const seen = new Set();
    for (const id of representatives.concat(rows)) {
      if (links.length === 4) break;
      if (typeof id !== 'string' || !/^PSI-\d{1,5}(?::\d{1,8}){2}$/.test(id) || seen.has(id)) continue;
      if (representatives.includes(id) && !rows.includes(id)) continue;
      seen.add(id);
      links.push({label:id, href:'#atlas?record=' + encodeURIComponent(id)});
    }
    return safeDirections(links);
  }

  function explainEvidence(turn) {
    if (turn.status === 'abstained') return 'The archive did not verify an answer to that question.';
    if (turn.evidenceKind === 'lunar-outcome' && /0 verified lunar burn outcomes out of 4/i.test(turn.answer)) {
      return 'The project lists four planned burns. Its outcome register has no verified result for any of them yet, so we don’t know how many sustained a flame. [1]';
    }
    if (turn.evidenceKind === 'archive-calculation') {
      return turn.answer.replace(/([\d.,]+)% meet the requested condition \((\d+) of (\d+) rows\)\./g, '$2 of the $3 archive rows met the condition ($1%).')
        .replace(/Selection: /g, 'Records checked: ')
        .replace(/normalized observation rows?/gi, match => match.endsWith('rows') ? 'archive rows' : 'archive row')
        .replace(/Mean /g, 'Average ').replace(/descriptive summaries over the recorded conditions/g, 'summaries of what the archive recorded');
    }
    if (turn.evidenceKind === 'quote-only') return 'The available source supports the quoted passage. The desk could not verify a fuller interpretation. [1]';
    // Preserve numbers, restrictions and citations in claims without a hand-written gloss.
    return turn.answer.replace(/\bPMMA\b(?! \()/g, 'PMMA (acrylic)').replace(/\bvisible extinction\b/gi, 'the point when the visible flame went out');
  }

  function conversationReply(message, context) {
    const intent = message.trim().replace(/[.!?]+$/, '').toLowerCase().replace(/’/g, "'");
    if (/^(?:(?:hello|hey|hi)(?: there| first fire)?|help(?: me)?|(?:can|could|would) you help(?: me)?|i need help|how (?:does this|do you) work|what can (?:i ask|you do))$/.test(intent)) {
      return {status:'answered', mode:'conversation', sources:[],
        answer:'I can look up a NASA fire experiment, compare measurements or help you find a tool. Which experiment or cabin condition are you interested in?'};
    }
    if (/^(?:thanks|thank you)(?: so much)?$/.test(intent)) {
      return {status:'answered', mode:'conversation', evidenceFollowup:true, sources:[], answer:'You’re welcome.'};
    }
    if (/^(?:are you (?:a (?:real )?(?:person|human)|an? (?:ai|bot))|who are you)$/.test(intent)) {
      return {status:'answered', mode:'conversation', sources:[], answer:'I’m FIRST FIRE’s research assistant. I can look up published experiments and measurements in this workspace.'};
    }
    const turn = evidenceTurn(context);
    const pageRequest = /^(?:which|what) page(?: of (?:the|that|this) (?:report|paper|study))?(?: (?:can|could|should) i (?:read|check|look at)| is (?:this|that) on)?$/.test(intent);
    const sourceNumber = /^(?:(?:open|show(?: me)?|explain) )?(?:source|citation|reference)\s*(?:#|number )?\[?(\d+)\]?$/.exec(intent);
    const sourceRequest = pageRequest || !!sourceNumber || /^(?:sources?|citations?|references?|(?:please )?cite (?:your|the) sources?|(?:show(?: me)?|give me|can i see|where (?:can|do) i (?:find|see|check)|can you (?:show me|give me)) (?:the |your )?(?:sources?|citations?|references?|paper|report|rows?|data|records?|evidence)(?: (?:for|behind|from) (?:that|this|those|the)(?: (?:result|answer|calculation|number|experiment|rows|results))?)?|what(?:'s| is) (?:the|your) source|where did (?:that|this) come from|where can i check that|which (?:source|page)|what page(?: is (?:that|this) on)?)$/.test(intent);
    const plainRequest = /^(?:(?:can|could|would) you )?(?:(?:explain|say|put|summarize|rephrase) (?:that|this|it|your (?:answer|result)) (?:more simply|in (?:plain english|plain language|simple(?:r)? (?:terms|words)))|(?:in )?(?:plain english|simpler terms)(?: please)?|what does (?:that|this) mean)$/.test(intent);
    if ((sourceRequest || plainRequest) && turn && turn.mode !== 'navigation' && turn.mode !== 'conversation') {
      const sources = Array.isArray(turn.sources) ? turn.sources.map(normalizeSource).filter(Boolean) : [];
      const reply = {status:turn.status, mode:'conversation', evidenceFollowup:true, sources};
      if (plainRequest) return {...reply, answer:explainEvidence(turn)};
      if (sourceNumber) {
        const index = Number(sourceNumber[1]) - 1;
        const source = sources[index];
        return {...reply, answer:source ? source.title + ' [' + (index + 1) + ']. ' + source.locator :
          'That answer has ' + sources.length + ' cited ' + (sources.length === 1 ? 'source.' : 'sources.')};
      }
      if (turn.status === 'abstained') {
        return {...reply, answer:sources.length ? 'I couldn’t verify an answer. The related records below are leads for further reading.' : 'I couldn’t verify an answer or identify a supporting record for that question.'};
      }
      if (turn.evidenceKind === 'archive-calculation' && Array.isArray(turn.analysis?.rows)) {
        const links = selectedRowLinks(turn.analysis);
        const count = turn.analysis.rows.length;
        const answer = !count ? 'No normalized observations matched this selection.' : links.length < count
          ? 'The selection contains ' + count + ' archive rows. These are ' + links.length + ' examples. The calculation receipt on the original answer includes the full selection.'
          : 'Open the selected archive ' + (count === 1 ? 'row' : 'rows') + ' to inspect the recorded values.';
        return {...reply, answer, links};
      }
      if (sources.length) {
        const primary = sources.findIndex(source => source.url.startsWith('https:'));
        const index = /\bpage\b/.test(intent) && primary >= 0 ? primary : 0;
        const source = sources[index];
        return {...reply, answer:'The answer cites ' + source.title + ' [' + (index + 1) + '].' + (source.locator ? '\n\n' + source.locator : '')};
      }
      return {...reply, answer:'That reply did not cite a source.'};
    }
    const directions = window.FFDirections?.resolve(message, context);
    if (!directions?.answer) return null;
    return {status:'answered', mode:'navigation', sources:[], answer:directions.answer,
      links:safeDirections(directions.links)};
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
    if (threads.some(thread => thread.id === data?.current)) {
      return memory = {current:data.current, threads};
    }
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
      if (window.FFQwen?.detect(info)) return null;
      return info.ready === true && typeof info.model === 'string' ? info : null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  function history(turns) {
    return turns.slice(-MAX_HISTORY / 2).flatMap(t => [
      {role:'user', content:t.question.slice(0,4000)},
      {role:'assistant', content:t.answer.slice(0,4000)}
    ]);
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
    if (/\b(?:igniter|hardware)\b/.test(q) && /\b(?:scor(?:e|ed|ing)|classif(?:y|ied|ication)|count(?:s|ed)? as)\b/.test(q)) return null;
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

  const caseFollowups = {
    saffire:/^(?:(?:what|which) (?:material|part)(?: actually)? (?:burned|ignited)|why did (?:it|the (?:fabric|nomex)) turn black)\??$/i,
    sibal:/\b(?:aircraft|parabola)\b.*\b(?:same|that) extinction delay\b|\bboth of those runs\b.*\boxygen\b.*\bconstant\b/i,
    same:/\bmicrograph\b.*\bsample 56\b.*\balarm\b/i,
    cfig:/\bA2 run\b.*\b(?:both|too)\b/i,
    ices:/\bboth materials[’']? (?:ground )?limits\b.*\bsame amount\b/i
  };

  async function askArchive(question, previousTurns) {
    const incident = incidentReply(question, previousTurns);
    if (incident) return incident;
    const knownCases = window.FF?.cases || [];
    const selected = knownCases.filter(c => SUBJECTS[c.id]?.test(question));
    let carried = false;
    const referenced = previousCase(previousTurns);
    if (!selected.length && referenced && (caseFollowups[referenced.id]?.test(question) || /^(?:(?:and|then|so)\b\s*)?(?:what (?:would|should|did|is|are|was|were) (?:we|they|the limit|its|the next)|what next|why (?:did|does|was|is) (?:it|that|this|the (?:sample|fabric))\b|which source|what limits|what (?:does|would) (?:it|that|this)|tell me more|could (?:it|this)|what was measured)/i.test(question))) {
      selected.push(referenced);
      carried=true;
    }
    if (selected.length === 1) {
      const subject = selected[0];
      const heading = (carried ? 'Continuing with ' : 'From the archived case on ') + subject.short + '.';
      if (/\bnext\b(?!\s+to\b)|reanalysis|what (?:should|would|could) (?:we|they) test/i.test(question)) return excerpt(subject,'next',heading+'\n\nSuggested next test\n'+subject.next);
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
  function showAnswer(turn, index, retry, earlier) {
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
    if (turn.synthesizedBy === 'qwen3.8:27b') byline.append(node('small', 'Qwen 3.8 27B · local'));

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
    if(turn.evidenceKind==='archive-calculation') {
      const receiptButton=button('Download calculation',async()=>{
        receiptButton.disabled=true;
        try {
          await window.FFLoadChatEvidence();
          if(!Array.isArray(window.FF.tests))await window.FFLoadAsset('observation-rows.js');
          const history=evidenceHistory(earlier);
          const prior=history.at(-1);
          const archive=turn.previousSelection?selectedArchive(prior,window.FF):window.FF;
          const record=window.FFScienceChat.receipt(turn.calculationInput || turn.question,history,archive);
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
      'archive-clarification':'Archive calculation needs clarification',
      'lunar-outcome':'FM² observed outcome register',
      'input-needed':'Forecast inputs needed',
      'quote-only':'Source excerpt · interpretation withheld',
      'archive-note':'Supplementary archive notes · independent claim review unavailable',
      'mission-note':'Mission history summary · independent claim review unavailable',
      'withheld':'Insufficient verified evidence'
    }[turn.evidenceKind];
    article.append(byline);
    if(provenance) article.append(node('p',provenance,'rf-evidence-label'));
    const destinations = safeDirections(turn.links);
    if (destinations.length) {
      const list = node('ul', undefined, 'ffchat-destinations');
      for (const destination of destinations) {
        const item = node('li');
        const anchor = link(destination.label, destination.href);
        if (!destination.href.startsWith('#')) {
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          anchor.setAttribute('aria-label', destination.label + ' (opens in a new tab)');
          const icon = node('span', ' ↗');
          icon.setAttribute('aria-hidden', 'true');
          anchor.append(icon);
        }
        item.append(anchor);
        list.append(item);
      }
      body.append(list);
    }
    article.append(body, actions);
    for (const review of turn.reviewIds || (turn.reviewId ? [turn.reviewId] : [])) {
      const proof = window.FFDeckReferee?.proof(review);
      if (proof) article.append(proof);
    }
    const engine = window.FFDeckReferee?.route(turn.question);
    if (engine && !turn.links) article.append(link('Open '+engine[0]+' →', engine[1], 'rf-continue'));
    return article;
  }

  window.renderChat = function renderChat(root, {embedded = false} = {}) {
    stopPreviousView?.();
    const state = readStore();
    let thread = state.threads.find(t => t.id === state.current);
    let mode;
    let healthTask;
    const startHealth = () => healthTask ||= checkService().then(info=>{mode=info?'local':'archive';});
    let request;
    let editing = null;
    let stopped = false;
    let persistenceWarning = '';

    const shell = node('section', undefined, embedded ? 'ffchat ff-master-chat' : 'ffchat');
    shell.setAttribute('aria-labelledby', 'ffchat-title');
    const top = node('header', undefined, 'ffchat-toolbar');
    const title = node(embedded ? 'h2' : 'h1', 'Research chat', embedded ? 'ffchat-sr' : undefined);
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
    if (!embedded) {
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
    }

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
    const send = node('button', embedded ? undefined : 'Send', 'ffchat-send');
    if (embedded) {
      send.setAttribute('aria-label', 'Send');
      send.title = 'Send question';
    }
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
    if (!embedded) desk.append(welcome);
    desk.append(exchange, form);

    const starters = node('section', undefined, 'ffchat-starters');
    starters.setAttribute('aria-labelledby', 'ffchat-starters-title');
    const startersTitle = node('h2', 'Try a question');
    startersTitle.id = 'ffchat-starters-title';
    if (embedded) startersTitle.classList.add('ffchat-sr');
    const suggestions = node('div', undefined, 'ffchat-suggestions');
    const examples = embedded ? [
      ['Materials', 'Did the Nomex in Saffire-II ignite?'],
      ['Find a tool', 'Take me to the rover sandbox']
    ] : EXAMPLES;
    for (const [topic, question] of examples) {
      const starter = button('', () => sendMessage(question), 'ffchat-example');
      if (!embedded) starter.append(node('small', topic));
      starter.append(node('span', question));
      suggestions.append(starter);
    }
    starters.append(startersTitle, suggestions);
    shell.append(top, desk, starters);
    if (!embedded) {
      const prefs=node('details',undefined,'rf-preferences');
      const summary=node('summary','Reading preferences');
      prefs.append(summary); shell.append(prefs);
      prefs.addEventListener('toggle',async()=>{
        if(!prefs.open)return;
        try {
          await window.FFLoadAsset('referee-deck.js');
          if(!prefs.isConnected || !prefs.open)return;
          const rendered=window.FFDeckReferee.preferences(question=>{updateInput(question);input.focus();});
          rendered.open=true;
          const focused=prefs.contains(document.activeElement);
          prefs.replaceWith(rendered);
          if(focused)rendered.querySelector('summary').focus();
        }catch{summary.textContent='Reading preferences unavailable. Close and reopen to retry.';}
      });
    }
    root.replaceChildren(shell);

    function isActive() { return !stopped && shell.isConnected; }

    function save() {
      state.current = thread.id;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({version:1, current:state.current, threads:state.threads.filter(t => t.turns.length)}));
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
        exchange.append(userBubble(turn.question, i), showAnswer(turn, i, retry, turns.slice(0,i)));
      });
      if (request) {
        exchange.append(userBubble(request.message), node('p', 'Looking for evidence…', 'ffchat-wait'));
        for (const control of exchange.querySelectorAll('.ffchat-edit,.ffchat-retry')) control.disabled = true;
      }
      add.disabled = !!request || isEmpty;
      cancel.hidden = !request;
      send.hidden = !!request;
      input.readOnly = !!request;
      input.placeholder = thread.turns.length ? 'Ask a follow-up…' :
        (embedded ? 'Ask about fire or find a tool…' : 'Ask a question…');
      drawHistory();
      top.hidden = embedded && !request && historyButton.disabled && add.disabled;
      if (embedded) resizeInput();
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

    async function researchReply(message, context, working) {
      await window.FFLoadChatEvidence();
      if(working.controller.signal.aborted || !isActive())throw Error('Stopped');
      // The published detector performance is a reported figure. Row counts
      // and user-specified thresholds still belong to the archive calculator.
      const publishedDetector = /\b(?:fraction|proportion|percentage|share)\b/i.test(message)
        && /\bteflon\b/i.test(message) && /\b(?:light[ -]scattering|ISS)\b/i.test(message)
        && /\b(?:alarm threshold|below threshold|missed|failed to detect)\b/i.test(message)
        && !/\b(?:rows?|records?|normalized|kapton)\b|\d/i.test(message);
      const history = evidenceHistory(context);
      const priorCase = history.at(-1);
      const reading = contextualReading(message, history);
      if (reading) return reading;
      const saffireMaterial = priorCase?.caseId === 'saffire' && priorCase.status !== 'abstained'
        && /^(?:what|which) (?:material|part)(?: actually)? (?:burned|ignited)\??$/i.test(message);
      const engine = window.FFDeckReferee?.route(message);
      const archiveQuery=archiveRequest(message,priorCase);
      const quantitative = archiveQuery.missingScope || window.FFScienceChat?.isCandidate(archiveQuery.input,history);
      const toolRequest = engine && !quantitative && /^(?:open|use|launch|take me to|show me the|where (?:can|do) i (?:find|open|use))\b/i.test(message);
      let answer;
      const observation=!toolRequest && observedLunarOutcome(message,history,window.FF?.forecast);
      const calculation=observation || (!toolRequest && window.FFDeckReferee?.forecastAnswer(message,history));
      if (calculation) {
        answer=calculation;
      } else if(!publishedDetector && archiveQuery.missingScope) {
        answer={mode:'calculation',evidenceKind:'archive-clarification',status:'abstained',sources:[],
          answer:'Which group of archive rows do you mean? Name an investigation, material or selection to establish the denominator.'};
      } else if(!publishedDetector && quantitative) {
        if(!Array.isArray(window.FF.tests))await window.FFLoadAsset('observation-rows.js');
        const prior=priorCase;
        const archive=archiveQuery.scope?selectedArchive(prior,window.FF):window.FF;
        answer=window.FFScienceChat.answer(archiveQuery.input,history,archive);
        if(answer.analysis && archiveQuery.input!==message)answer.calculationInput=archiveQuery.input;
        if(answer.analysis && archiveQuery.scope){
          answer.previousSelection=true;
          const matches=prior.analysis.rows.length;
          answer.answer+='\n\nThis calculation starts with the '+matches+' matching '+(matches===1?'row':'rows')+' in your previous result.';
        }
      } else if (toolRequest) {
        answer = {answer:engine[2], status:'limited', sources:[], mode:'navigation'};
      } else {
        await startHealth();
        if(working.controller.signal.aborted || !isActive())throw Error('Stopped');
        answer = mode === 'local'
          ? await askService(message, context, working.controller.signal)
          : await askArchive(message, context);
        if (window.FFDeckReferee && !working.controller.signal.aborted) {
          const reviewQuestion = saffireMaterial ? 'Saffire-II sample 2-7: which material burned?' : message;
          answer = await window.FFDeckReferee.checkedReply(reviewQuestion, answer);
        }
      }
      return answer;
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
        if (working.controller.signal.aborted || !isActive()) throw Error('Stopped');
        const conversational = conversationReply(message, context);
        let answer = conversational || await new Promise((resolve,reject)=>{
          const signal=working.controller.signal;
          const abort=()=>reject(new Error('Stopped'));
          signal.addEventListener('abort',abort,{once:true});
          researchReply(message,context,working).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
        });
        const signal = working.controller.signal;
        const unverifiedSearch = answer.status === 'abstained' && answer.model === 'Archive search' &&
          !/\b(?:fabricate|invent|make up|pretend|certif(?:y|ication)|safe(?:ty)?|guarantee|actual outcome|temperature|heat release|alarm time|time to alarm|spread rate|flow threshold)\b/i.test(message);
        if (!conversational && ['archive','local'].includes(answer.mode) &&
            (unverifiedSearch || (answer.status !== 'abstained' && answer.sources?.length)) &&
            !['lunar-outcome','calculation-explanation'].includes(answer.evidenceKind)
            && localOrigin() && window.FFQwen?.explain && !signal.aborted) {
          try {
            answer = await window.FFQwen.explain(message, context, answer, signal) || answer;
          } catch {
            // The archive evidence is still readable if the local model disconnects.
          }
        }
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
            const restoreFocus = !document.getElementById('workspace-explore')?.open &&
              (shell.contains(document.activeElement) || document.activeElement === document.body);
            draw();
            if (restoreFocus) {
              if (!input.value) focusReply();
              else input.focus();
            }
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
      const route = location.hash.slice(1).split('?')[0] || 'home';
      if (route !== (embedded ? 'home' : 'chat')) stop();
    }
    function stop() {
      if (stopped) return;
      navigationDraft = request ? null : {threadId:thread.id, text:input.value, editing};
      stopped = true;
      if (stopPreviousView === stop) stopPreviousView = undefined;
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
    if(!embedded && suggested?.trim()) {
      clearEdit();
      updateInput(suggested.slice(0,MAX_MESSAGE));
    }
    draw();
    if(thread.turns.some(t=>t.evidenceKind && t.mode!=='conversation')) {
      window.FFLoadChatEvidence().then(()=>{if(isActive())draw();}).catch(()=>{});
    }
    return stop;
  };
})();
