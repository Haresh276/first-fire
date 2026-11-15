/* Render recorded answers and rebuild all displayed totals from the individual criteria. */
(function () {
  'use strict';

  const armKeys = ['firstfire', 'chatgpt'];
  const groups = {science: 'Science and evidence', workflow: 'Reproducible actions'};
  const $ = id => document.getElementById(id);
  const data = window.FFRoverScorecard;
  const initialSummary = $('summary').textContent;
  const number = new Intl.NumberFormat('en', {maximumFractionDigits: 2});
  let selected = 0;
  let answerOpen = false;
  const asList = value => Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
  const displayScore = value => number.format(value);

  function make(tag, text, className) {
    const node = document.createElement(tag);
    if (typeof text === 'string') node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function categoryOf(task, criterion) {
    return criterion.category || task.category;
  }

  function armName(id) {
    return data.arms[id].name;
  }

  function validate(input) {
    if (!input || !Array.isArray(input.tasks) || !input.tasks.length) return false;
    if (!armKeys.every(id => typeof input.arms?.[id]?.name === 'string' && input.arms[id].name.trim())) return false;
    const ids = new Set();
    for (const task of input.tasks) {
      if (typeof task.id !== 'string' || !task.id || ids.has(task.id) || !task.title || !task.prompt) return false;
      if (!Array.isArray(task.criteria) || !task.criteria.length) return false;
      ids.add(task.id);
      for (const criterion of task.criteria) {
        if (!Object.hasOwn(groups, categoryOf(task, criterion)) || !criterion.label ||
          !Number.isFinite(criterion.max) || criterion.max <= 0) return false;
        for (const arm of armKeys) {
          const points = criterion[arm];
          if (points == null) continue;
          if (typeof task.answers?.[arm] !== 'string' || !task.answers[arm].trim()) return false;
          if (!Number.isFinite(points) || points < 0 || points > criterion.max) return false;
        }
      }
    }
    return true;
  }

  function safeLink(link) {
    if (!link || typeof link.url !== 'string' || !link.url.trim()) return null;
    let url;
    try {
      url = new URL(link.url, window.location.href);
    } catch { return null; }
    const sameFolderFile = window.location.protocol === 'file:' && url.protocol === 'file:' &&
      !link.url.startsWith('//') && !/^[A-Za-z][A-Za-z\d+.-]*:/.test(link.url);
    if (!['http:', 'https:'].includes(url.protocol) && !sameFolderFile) return null;
    const anchor = make('a', link.title || link.label || 'Open record');
    anchor.href = link.url;
    if (url.origin !== window.location.origin) anchor.rel = 'noopener noreferrer';
    return anchor;
  }

  function appendLinks(container, links) {
    for (const record of asList(links)) {
      const anchor = safeLink(record);
      if (anchor) container.append(anchor);
    }
  }

  function sumCriteria(criteria, arm) {
    const total = {points: 0, possible: 0, missing: 0, count: 0};
    for (const c of criteria) {
      if (c[arm] == null) {
        total.missing += 1;
        continue;
      }
      total.points += c[arm];
      total.possible += c.max;
      total.count += 1;
    }
    return total;
  }

  function scoreText(score) {
    return score.count ? displayScore(score.points) + ' / ' + displayScore(score.possible) : 'Unscored';
  }

  function overview() {
    const host = $('totals');
    host.replaceChildren();
    for (const [group, title] of Object.entries(groups)) {
      const criteria = data.tasks.flatMap(task => task.criteria.filter(c => categoryOf(task, c) === group));
      if (!criteria.length) continue;
      const card = make('section', '', 'category ' + group);
      card.append(make('h2', title));
      const grid = make('div', '', 'score-grid');
      for (const arm of armKeys) {
        const score = sumCriteria(criteria, arm);
        const box = make('div', '', 'arm-score');
        box.append(make('div', armName(arm), 'arm-name'));
        const result = make('div', score.count ? displayScore(score.points) : 'Unscored',
          score.count ? 'number' : 'number unscored');
        if (score.count) result.append(make('span', '/ ' + displayScore(score.possible)));
        box.append(result);
        if (score.missing) {
          box.append(make('p', score.missing + ' of ' + criteria.length +
            (criteria.length === 1 ? ' check has' : ' checks have') + ' no recorded score.', 'partial'));
        }
        grid.append(box);
      }
      card.append(grid);
      host.append(card);
    }
  }

  function scoreTable(task, category) {
    const criteria = task.criteria.filter(c => categoryOf(task, c) === category);
    if (!criteria.length) return null;
    const table = make('table');
    table.append(make('caption', groups[category]));
    const headRow = table.createTHead().insertRow();
    for (const heading of ['Scoring criterion', ...armKeys.map(armName)]) {
      const cell = make('th', heading);
      cell.scope = 'col';
      headRow.append(cell);
    }
    const body = table.createTBody();
    for (const criterion of criteria) {
      const row = body.insertRow();
      const label = make('th', criterion.label);
      label.scope = 'row';
      row.append(label);
      for (const arm of armKeys) {
        const cell = row.insertCell();
        const value = criterion[arm] == null ? 'Unscored' :
          displayScore(criterion[arm]) + ' / ' + displayScore(criterion.max);
        cell.append(make('span', value, 'points'));
        if (criterion.notes?.[arm]) cell.append(make('p', criterion.notes[arm], 'why'));
      }
    }
    const totalRow = table.createTFoot().insertRow();
    totalRow.className = 'summary-row';
    const totalLabel = make('th', 'Question subtotal');
    totalLabel.scope = 'row';
    totalRow.append(totalLabel);
    for (const arm of armKeys) totalRow.insertCell().textContent = scoreText(sumCriteria(criteria, arm));
    return table;
  }

  function answerPanels(task) {
    const container = make('section', '', 'answer-block');
    const bar = make('div', '', 'answer-title');
    const toggle = make('button');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', 'paired-answers');
    bar.append(make('h3', 'Recorded answers'), toggle);
    const answers = make('div', '', 'answers');
    answers.id = 'paired-answers';
    const panels = [];
    function label() {
      const both = panels.every(panel => panel.open);
      toggle.setAttribute('aria-expanded', String(both));
      toggle.textContent = both ? 'Collapse both' : 'Read both';
    }
    for (const arm of armKeys) {
      const disclosure = make('details', '', 'answer');
      disclosure.open = answerOpen;
      const summary = make('summary', armName(arm));
      const raw = task.answers?.[arm];
      disclosure.append(summary, make('pre', typeof raw === 'string' && raw.trim() ? raw : 'No captured answer is available for this arm.'));
      panels.push(disclosure);
      answers.append(disclosure);
      disclosure.addEventListener('toggle', label);
    }
    toggle.addEventListener('click', () => {
      answerOpen = !panels.every(panel => panel.open);
      for (const panel of panels) panel.open = answerOpen;
      label();
    });
    label();
    container.append(bar, answers);
    return container;
  }

  function renderTask() {
    const task = data.tasks[selected];
    const host = $('task');
    host.replaceChildren();
    host.append(make('h3', task.title, 'task-heading'), make('blockquote', task.prompt, 'prompt'));
    for (const category of Object.keys(groups)) {
      const table = scoreTable(task, category);
      if (table) host.append(table);
    }
    host.append(answerPanels(task));
    const ids = new Set(asList(task.sources));
    const sources = asList(data.sources).filter(source => ids.has(source.id));
    if (sources.length || task.links?.length) {
      const container = make('div', '', 'source-box');
      container.append(make('h4', 'Sources and run records'));
      const links = make('div', '', 'links');
      appendLinks(links, [...sources, ...asList(task.links)]);
      container.append(links);
      host.append(container);
    }
    $('task-picker').value = String(selected);
    $('back').disabled = selected === 0;
    $('next').disabled = selected === data.tasks.length - 1;
    $('position').textContent = 'Question ' + (selected + 1) + ' of ' + data.tasks.length;
  }

  function choose(index, writeAddress) {
    if (!Number.isInteger(index) || index < 0 || index >= data.tasks.length) return;
    selected = index;
    renderTask();
    if (writeAddress) {
      // replaceState preserves a judge's place in the document while switching cards.
      try {
        history.replaceState(null, '', '#q=' + encodeURIComponent(data.tasks[index].id));
      } catch { /* file:// previews can disable history writes */ }
    }
  }

  function hashChoice() {
    const id = new URLSearchParams(location.hash.slice(1)).get('q');
    return data.tasks.findIndex(task => task.id === id);
  }

  function methodList(id, title, items, ordered) {
    const strings = asList(items).filter(item => typeof item === 'string' && item.trim());
    if (!strings.length) return;
    const section = $(id);
    section.append(make('h3', title));
    const list = make(ordered ? 'ol' : 'ul');
    for (const sentence of strings) list.append(make('li', sentence));
    section.append(list);
  }

  function enableLiveReplay() {
    const examples = {
      genuine: {file: 'W2-genuine.json', label: 'Original file'},
      distance: {file: 'W2-altered.json', label: 'Edited distance'},
      source: {file: 'source-edit.json', label: 'Edited source locator'}
    };
    const buttons = [...document.querySelectorAll('[data-example]')];
    const verdict = $('replay-verdict');
    let frame;
    let ready;

    function openFrame() {
      if (frame) return frame;
      frame = make('iframe');
      frame.title = 'Live FIRST FIRE rover experiment';
      frame.src = 'judge-lab.html#conditions';
      // Set the listener before inserting the iframe, including when it opens from cache.
      ready = new Promise(resolve => frame.addEventListener('load', resolve, {once: true}));
      $('live-lab').append(frame);
      return frame;
    }

    function deadline(promise, milliseconds, message) {
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error(message)), milliseconds);
        promise.then(value => {
          clearTimeout(timeout);
          resolve(value);
        }, error => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }

    async function replayNative(file, bytes) {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      const input = doc?.getElementById('import');
      const status = doc?.getElementById('file-status');
      if (!win || !input || typeof input.onchange !== 'function' || !status ||
          typeof win.DataTransfer !== 'function') {
        throw new Error('This browser needs a manual file replay.');
      }
      const transfer = new win.DataTransfer();
      transfer.items.add(new win.File([bytes], file, {type: 'application/json'}));
      input.files = transfer.files;
      let observer;
      const report = new Promise(resolve => {
        // The existing instrument writes its verdict after parsing and recomputing the imported trial.
        observer = new win.MutationObserver(() => {
          const text = status.textContent.trim();
          if (/^(Replay verified\b|File not applied\b)/.test(text)) resolve(text);
        });
        observer.observe(status, {childList: true, characterData: true, subtree: true});
      });
      try {
        input.dispatchEvent(new win.Event('change', {bubbles: true}));
        return await deadline(report, 10000, 'The lab did not return a verdict in time.');
      } finally {
        observer.disconnect();
      }
    }

    function manual(message) {
      verdict.dataset.result = 'error';
      verdict.textContent = message + ' Download the file below and choose “Replay a file” in the rover lab.';
      $('manual-replay').open = true;
    }

    async function run(button) {
      const example = examples[button.dataset.example];
      if (!example) return;
      for (const control of buttons) {
        control.setAttribute('aria-pressed', String(control === button));
        control.disabled = true;
      }
      try {
        if (window.location.protocol === 'file:') {
          manual('The offline edition uses the browser’s file picker.');
          return;
        }
        verdict.dataset.result = 'loading';
        verdict.textContent = 'Opening ' + example.label.toLowerCase() + ' in the rover lab…';
        openFrame();
        const response = await fetch('rover-scorecard-files/' + example.file);
        if (!response.ok) throw new Error('The example file could not be opened.');
        const bytes = await response.arrayBuffer();
        await deadline(ready, 15000, 'The rover lab did not finish loading.');
        const text = await replayNative(example.file, bytes);
        verdict.dataset.result = text.startsWith('Replay verified') ? 'verified' : 'rejected';
        verdict.textContent = example.label + ' — ' + text;
      } catch (error) {
        manual(error.message || 'Automatic replay is unavailable.');
      } finally {
        for (const control of buttons) control.disabled = false;
      }
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => run(button));
    }
    $('try-lab').addEventListener('toggle', () => {
      if ($('try-lab').open) openFrame();
    });
  }

  if (!validate(data)) {
    $('loading').textContent = 'The evaluation record could not be loaded. Reopen the scorecard with its results file to view the recorded scores.';
    return;
  }

  $('title').textContent = data.title || 'Rover answers, side by side';
  $('summary').textContent = data.summary || initialSummary;
  $('run-date').textContent = data.date || 'Unreported';
  $('task-count').textContent = String(data.tasks.length);
  $('loading').hidden = true;
  $('results').hidden = false;
  overview();
  for (const [i, task] of data.tasks.entries()) {
    const option = make('option', String(i + 1) + '. ' + task.title);
    option.value = String(i);
    $('task-picker').append(option);
  }

  for (const arm of armKeys) {
    const details = make('section', '', 'arm-detail');
    const record = data.arms[arm];
    details.append(make('h3', armName(arm)));
    if (record.detail) details.append(make('p', record.detail));
    if (record.note) details.append(make('p', record.note));
    $('arms').append(details);
  }
  enableLiveReplay();
  methodList('protocol', 'Procedure', data.protocol, true);
  methodList('limits', 'What this run covers', data.limits, false);
  appendLinks($('downloads'), data.links);
  const initialIndex = hashChoice();
  choose(initialIndex >= 0 ? initialIndex : 0, false);
  if (initialIndex >= 0) $('review').scrollIntoView();
  $('task-picker').addEventListener('change', event => choose(Number(event.target.value), true));
  $('back').addEventListener('click', () => choose(selected - 1, true));
  $('next').addEventListener('click', () => choose(selected + 1, true));
  window.addEventListener('hashchange', () => {
    const index = hashChoice();
    if (index !== -1) choose(index, false);
  });
})();
