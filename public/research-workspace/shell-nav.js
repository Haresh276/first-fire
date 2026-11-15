/* Native disclosure links remain usable while the desk's scientific tools load. */
(() => {
  'use strict';
  const explore = document.getElementById('workspace-explore');
  const summary = explore.querySelector('summary');
  const current = document.getElementById('ff-current-module');
  const links = Array.from(document.querySelectorAll('.ff-shell-header [data-nav], .ff-shell-footer [data-nav]'));
  const groups = Array.from(explore.querySelectorAll('.ff-shell-group'), group => Array.from(group.querySelectorAll('a')));
  const ordered = groups.flat();
  const aliases = {case:'cases', designs:'cases', acrylic:'cases', report:'sources', 'code-review':'sources',
    coverage:'data', errors:'referee', quotes:'referee', rover:'physics'};
  const names = {home:'Research desk', search:'Evidence search', claim:'Check a claim', coverage:'Archive coverage',
    'archive-audit':'Archive audit', 'materials-lab':'Materials Lab', 'master-physics':'Cabin physics',
    'vehicle-designer':'Vehicle designer', 'flame-tracking':'Flame tracking', quotes:'Quotation referee'};

  function setView(key, params, heading) {
    const module = aliases[key] || key;
    const rover = key === 'rover' || (key === 'physics' && params.get('mode') === 'rover');
    const match = links.find(link => link.dataset.nav === module &&
      (module !== 'physics' || link.hash.includes('?mode=rover') === rover));
    links.forEach(link => {
      if (link === match) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const label = match?.querySelector('span')?.textContent || match?.textContent.trim();
    let view = names[key] || label || heading || 'Page not found';
    if ((key === 'case' || key === 'report') && heading) view = heading;
    if (key === 'data' && params.get('study')) view += ' · ' + params.get('study');
    // The brand is the shell's single home link; breadcrumb trails still name their origin.
    document.querySelectorAll('#content .breadcrumb a[href="#home"]').forEach(link => {
      const origin = document.createElement('span');
      origin.textContent = link.textContent;
      link.replaceWith(origin);
    });
    current.textContent = view;
    current.title = view;
    explore.open = false;
  }

  function readLocation() {
    const [path, query] = location.hash.slice(1).split('?');
    setView(path.split('/')[0] || 'home', new URLSearchParams(query));
  }

  explore.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Escape' && explore.open) {
      event.preventDefault();
      explore.open = false;
      summary.focus();
      return;
    }
    const link = event.target.closest('a');
    const index = ordered.indexOf(link);
    const group = groups.findIndex(items => items.includes(link));
    let next;
    if (event.target === summary) {
      if (event.key === 'ArrowDown') next = ordered[0];
      if (event.key === 'ArrowUp') next = ordered[ordered.length - 1];
    } else if (index >= 0) {
      if (event.key === 'Home') next = ordered[0];
      if (event.key === 'End') next = ordered[ordered.length - 1];
      if (event.key === 'ArrowDown') next = ordered[(index + 1) % ordered.length];
      if (event.key === 'ArrowUp') next = ordered[(index - 1 + ordered.length) % ordered.length];
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const adjacent = groups[(group + offset + groups.length) % groups.length];
        next = adjacent[Math.min(groups[group].indexOf(link), adjacent.length - 1)];
      }
    }
    if (next) {
      event.preventDefault();
      explore.open = true;
      next.focus();
    }
  });

  function closeOutside(event) {
    if (explore.open && !explore.contains(event.target)) explore.open = false;
  }
  document.addEventListener('pointerdown', closeOutside);
  document.addEventListener('focusin', closeOutside);
  explore.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    explore.open = false;
    if (link.target === '_blank') summary.focus();
    else if (link.getAttribute('href').startsWith('#')) document.getElementById('content').focus({preventScroll:true});
  });
  window.FFShellNav = {setView};
  window.addEventListener('hashchange', readLocation);
  readLocation();
})();
