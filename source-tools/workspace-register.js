(() => {
  if (!('serviceWorker' in navigator) || !self.isSecureContext ||
      location.pathname.split('/')[1] !== 'research-workspace') return;
  const url = new URL(location.href);
  if (url.searchParams.has('_ff_saved')) {
    const message = document.createElement('aside');
    message.setAttribute('aria-label', 'Connection status');
    message.style.cssText = 'padding:.55rem 1rem;background:#18242d;color:#fff;text-align:center;font:14px system-ui';
    const retry = document.createElement('a');
    retry.style.cssText = 'color:#fff;text-decoration:underline';
    retry.textContent = 'Try the live site';
    const liveURL = () => {
      const address = new URL(location.href);
      address.searchParams.delete('_ff_saved');
      retry.href = address.href;
    };
    liveURL();
    addEventListener('hashchange', liveURL);
    message.append('Using the saved research workspace. ', retry);
    document.body.prepend(message);
  }
  const register = () => navigator.serviceWorker.register('/workspace-worker.js', {scope:'/',updateViaCache:'none'}).catch(() => {
    // Private browsing or a full disk can disable offline storage.
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (window.requestIdleCallback) requestIdleCallback(register, {timeout:2000});
    else setTimeout(register, 0);
  }, {once:true});
})();
