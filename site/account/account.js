(() => {
  'use strict';

  const el = id => document.getElementById(id);
  const providerNames = {google: 'Google', github: 'GitHub'};
  const providerIds = Object.keys(providerNames);
  const status = el('status');
  const retry = el('retry');
  const signout = el('signout');
  let revision = 0;

  function reset() {
    revision++;
    el('heading').textContent = 'Sign in';
    el('description').textContent = 'Choose an account to use with FIRST FIRE.';
    el('notice').textContent = '';
    el('providers').hidden = false;
    for (const id of providerIds) el(id).disabled = true;
    retry.hidden = true;
    signout.hidden = true;
    signout.disabled = true;
    document.querySelector('#auth-submit')?.remove();
    status.textContent = 'Checking availability…';
  }

  async function readAuth(endpoint) {
    const response = await fetch('/api/auth/' + endpoint, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {Accept: 'application/json'},
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Account service unavailable');
    }
    return response.json();
  }

  function showError(message) {
    status.textContent = message;
    retry.hidden = false;
  }

  async function refresh() {
    reset();
    const current = revision;
    if (!navigator.onLine || location.protocol === 'file:') {
      showError('Account access needs an internet connection.');
      return;
    }
    const [session, providers] = await Promise.allSettled([readAuth('session'), readAuth('providers')]);
    if (current !== revision) return;
    if (session.status !== 'fulfilled') {
      showError('Could not reach the account service. You can still use the research workspace.');
      return;
    }
    if (session.value?.user) {
      const {name, email} = session.value.user;
      el('heading').textContent = 'Your account';
      el('description').textContent = [name, email].filter(Boolean).join(' · ') || 'You are signed in.';
      el('providers').hidden = true;
      signout.hidden = false;
      signout.disabled = false;
      status.textContent = '';
      return;
    }
    if (new URLSearchParams(location.search).has('error')) {
      el('notice').textContent = 'Sign-in did not complete. Try again or choose another available provider.';
    }
    if (providers.status !== 'fulfilled' || !providers.value || typeof providers.value !== 'object') {
      showError('Could not load the sign-in providers.');
      return;
    }
    const unavailable = [];
    for (const id of providerIds) {
      const ready = providers.value[id]?.id === id;
      el(id).disabled = !ready;
      if (!ready) unavailable.push(providerNames[id]);
    }
    status.textContent = unavailable.length ? unavailable.join(' and ') + ' sign-in is not configured yet.' : '';
    retry.hidden = !unavailable.length;
  }

  async function submit(action) {
    const current = ++revision;
    for (const id of providerIds) el(id).disabled = true;
    signout.disabled = true;
    retry.hidden = true;
    status.textContent = action === 'signout' ? 'Signing out…' : 'Opening sign-in…';
    try {
      const {csrfToken} = await readAuth('csrf');
      if (current !== revision) return;
      if (typeof csrfToken !== 'string' || !csrfToken) throw new Error('Missing form token');
      const form = document.createElement('form');
      form.id = 'auth-submit';
      form.method = 'post';
      form.action = '/api/auth/' + action;
      for (const [name, value] of Object.entries({csrfToken, callbackUrl: '/account/'})) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    } catch {
      if (current === revision) showError('The account service could not complete that request. Check your connection and try again.');
    }
  }

  for (const id of providerIds) el(id).addEventListener('click', () => submit('signin/' + id));
  signout.addEventListener('click', () => submit('signout'));
  retry.addEventListener('click', refresh);
  window.addEventListener('pageshow', refresh);
  window.addEventListener('pagehide', reset);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
})();
