// Find passages in the open case. All displayed scientific text comes from the case or its comparisons.
(function () {
  'use strict';

  const stop = new Set(('a an the in on of to for from with and or by at as about over it its this that these those '
    + 'is are was were do did does has have had can could will would be been how what which who when where '
    + 'why my me i you we they their them please tell help show give any during after before very exact '
    + 'exactly actually really reported recorded based study case investigation experiment question tests test '
    + 'results result data evidence find much many some often frequently such could those there look reached based').split(' '));

  // Equivalent terms used by visitors and by the archived experiment descriptions.
  const vocabulary = [
    ['detector', 'detectors', 'sensor', 'sensors'],
    ['alarm', 'alarms', 'alert', 'alerts', 'warning', 'warnings'],
    ['miss', 'misses', 'missed', 'missing', 'undetected'],
    ['nuisance', 'false'],
    ['smoke', 'smokes', 'smoking'],
    ['ignite', 'ignition', 'ignited', 'ignites'],
    ['burn', 'burned', 'burnt', 'burns', 'burning', 'combustion'],
    ['flame', 'flames'], ['droplet', 'droplets'],
    ['fabric', 'fabrics', 'textile', 'textiles', 'cloth'],
    ['oxygen', 'o2'], ['gravity', 'gravitational'],
    ['acrylic', 'pmma'], ['diameter', 'diameters', 'diam', 'size'],
    ['speed', 'speeds', 'fast', 'faster', 'quickly', 'velocity', 'rate'],
    ['extinction', 'extinguish', 'extinguished', 'extinguishment'],
    ['temperature', 'temperatures', 'kelvin', 'celsius', 'fahrenheit'],
    ['time', 'timing', 'long', 'duration', 'elapsed', 'delay', 'latency', 'seconds', 'second'],
    ['cause', 'caused', 'causes', 'causal'],
    ['measure', 'measures', 'measured', 'measurement', 'measurements'],
    ['compare', 'comparison', 'comparisons', 'compared', 'comparing', 'versus', 'vs', 'difference', 'different'],
    ['predict', 'probability', 'probabilities', 'likelihood', 'chance', 'forecast', 'prediction'],
    ['lunar', 'moon'], ['material', 'materials'], ['spread', 'spreads', 'spreading'],
    ['limits', 'limit', 'limitation', 'limitations', 'boundaries'],
    ['planned', 'plan', 'planning', 'proposed']
  ];
  const aliases = new Map(vocabulary.flatMap(group => group.map(word => [word, group[0]])));
  const tokens = text => String(text).toLowerCase().normalize('NFKD')
    .replace(/\bo₂\b/gu, 'o2').match(/[a-z0-9]+/g) || [];

  function terms(text) {
    return new Set(tokens(text).filter(word => !stop.has(word)).map(word => aliases.get(word) || word));
  }

  // Source indices refer to the versioned case files. A multi-study synthesis keeps each relevant citation.
  const references = {
    sibal: {record:[0], limit:[0], next:[0,1]},
    saffire: {record:[0,2], limit:[0,1], next:[0,1]},
    flex: {record:[0,1,2], limit:[0,1,2], next:[0,1]},
    same: {record:[0], limit:[0,2], next:[0,1]},
    cfig: {record:[0,1], limit:[0,1], next:[0,1]},
    ices: {record:[0,1,2], limit:[0,4], next:[0,4]},
    fm2: {record:[0], limit:[0,1,2], next:[0,1]}
  };

  function caseEntry(c, field) {
    const labels = {record:'Observed record', reason:'Case interpretation', limit:'Limits of the evidence', next:'Suggested next test'};
    const label = field === 'record' && c.id === 'fm2' ? 'Mission plan' : labels[field];
    const sources = references[c.id][field === 'reason' ? 'record' : field].map(i => c.sources[i]).filter(Boolean);
    return {title:c.short, label, text:c[field], sources};
  }

  function sourceFor(c, url) {
    const source = c.sources.find(s => s.url === url);
    if (source) return source;
    if (url.startsWith('#data?')) {
      const query = new URLSearchParams(url.split('?')[1]);
      return {title:'Original experimental record', url, locator:[query.get('study'), query.get('q')].filter(Boolean).join(' · ')};
    }
    if (url === '#forecast') return {title:'FM² forecast', url, locator:'Worked example and assumptions'};
    const doc = c.sources.find(s => s.url.split('#')[0] === url.split('#')[0]);
    if (doc && url.includes('#page=')) return {...doc, url, locator:'PDF page ' + url.split('#page=')[1]};
    return null;
  }

  function passages(c, rows) {
    const entries = [caseEntry(c, 'record'), caseEntry(c, 'reason'), caseEntry(c, 'limit')];
    for (const row of rows) {
      for (const [title, text, url] of [[row[1],row[2],row[5]], [row[3],row[4],row[6]]]) {
        const source = sourceFor(c, url);
        if (source) entries.push({title, text, label:'Comparison evidence', sources:[source]});
      }
    }
    return entries;
  }

  const scope = /\b(limits?|limitations?|caveats?|uncertaint(?:y|ies)|confound\w*|generaliz\w*|extrapolat\w*)\b/i;
  const next = /\b(next (?:experiment|test|measurement|step)|(?:test|measure) next|follow[- ]up|(?:should|could|would|can) (?:researchers|we|you|i|they) (?:test|measure)|what (?:else|next) (?:to|should))\b/i;

  function result(status, message, entries = []) { return {status, message, entries}; }

  function ask(c, question, rows = []) {
    const q = String(question || '').trim();
    const gap = result('gap', 'The available passages do not establish an answer to this question. Try the material, test number, or measurement you want to compare.');
    if (!q || !c || !references[c.id]) return gap;
    const keys = terms(q);
    if (c.id === 'same' && (keys.has('time') || /how (?:fast|quickly|soon)/i.test(q)) && /\b(alarm\w*|alert\w*|detect\w*|warn\w*)\b/i.test(q)) {
      return result('gap', 'SAME does not give a time to alarm for this question. The duration in the NASA table measures smoke generation.', [caseEntry(c, 'limit')]);
    }

    const requested = next.test(q) ? 'next' : scope.test(q) ? 'limit' : null;
    const entries = passages(c, rows);
    if (requested === 'next') entries.push(caseEntry(c, requested));
    const caseWords = terms(c.short);
    for (const name of caseWords) keys.delete(name);
    const vocabularyHere = terms(entries.map(e => e.title + ' ' + e.text).join(' '));

    // An unmeasured quantity should not bring up a passage simply because it names the same material.
    const quantities = ['temperature', 'mass', 'pressure', 'cost', 'price', 'voltage', 'humidity', 'altitude', 'budget', 'wavelength', 'manufacturer'];
    if (quantities.some(t => keys.has(t) && !vocabularyHere.has(t))) return gap;
    if ([...keys].some(key => /^(manufactur|purchas|toxic|poison|kill)/.test(key) && !vocabularyHere.has(key))) return gap;
    if ([...keys].some(k => /^\d+$/.test(k) && !vocabularyHere.has(k))) return gap;
    if (requested && (/^\s*(?:what (?:are|were) (?:the |its )?(?:main )?(?:limits?|limitations?|caveats?)|what (?:should|could|do|can) (?:we|i) (?:test|measure) next|what(?:'s| is) (?:the )?next (?:test|step|experiment))\s*\??$/i.test(q)
        || [...keys].some(k => vocabularyHere.has(k) && !['limits','measure','next','follow','up'].includes(k)))) {
      return result('evidence', '', [caseEntry(c, requested)]);
    }

    const scored = entries.map(entry => {
      const body = terms(entry.text), title = terms(entry.title);
      let hits = 0, score = 0;
      for (const key of keys) {
        if (body.has(key) || title.has(key)) {
          hits++;
          score += 1 + (title.has(key) ? 0.25 : 0);
        }
      }
      return {entry, hits, score};
    }).filter(item => item.hits >= Math.min(2, keys.size) && item.hits > 0 && item.hits / keys.size >= 0.46)
      .sort((a,b) => b.score - a.score);
    if (!scored.length) return gap;
    const best = scored[0];
    const selected = scored.filter(item => item.score >= best.score * 0.88).slice(0, 2);
    return result('evidence', '', selected.map(item => item.entry));
  }

  const api = {ask};
  if (typeof window !== 'undefined') window.FFCaseQuestions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
