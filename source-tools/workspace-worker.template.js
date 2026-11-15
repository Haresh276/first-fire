// Only bundled public workspace documents participate in saved-mode recovery.
// The build binds each saved file to one release.
const CACHE = 'first-fire-workspace-__REVISION__';
const ROOT = '/research-workspace/';
const FILES = __INTEGRITY__;
const SAVED = '_ff_saved';
const optional = path => /^\/(?:research-workspace\/)?(?:fonts\/|earth(?:-|\.)|icon\.)/.test(path);
const verifiedRequest = (path, integrity, signal) =>
  new Request(path, {integrity, signal, cache:'no-cache', credentials:'omit', priority:'low'});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      // A missing illustration or font may degrade the saved presentation, but
      // does not invalidate the verified chat and evidence snapshot.
      const extras = Promise.allSettled(Object.entries(FILES).filter(([path]) => optional(path))
        .map(([path, integrity]) => cache.add(verifiedRequest(path, integrity, controller.signal))));
      const entries = Object.entries(FILES).filter(([path]) => !optional(path));
      for (let i = 0; i < entries.length; i += 3) {
        await cache.addAll(entries.slice(i, i + 3).map(([path, integrity]) =>
          verifiedRequest(path, integrity)));
      }
      await extras;
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    } finally { clearTimeout(timer); controller.abort(); }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('first-fire-workspace-') && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function isWorkspace(path) {
  return path === ROOT || path === ROOT.slice(0, -1) || path === ROOT + 'index.html';
}
function savedDocument(path) {
  if (path === '/' || isWorkspace(path)) return ROOT + 'index.html';
  if (path.endsWith('.html') && Object.hasOwn(FILES, path)) return path;
  // The material observer opens this NASA source table as a top-level download.
  if (path === '/data/raw/PSI-99-experimental.csv' && Object.hasOwn(FILES, path)) return path;
}
async function navigate(request, url) {
  const cache = await caches.open(CACHE);
  const documentPath = savedDocument(url.pathname);
  if (url.searchParams.has(SAVED)) {
    const page = await cache.match(documentPath);
    if (page) return page;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  let response;
  try {
    response = await fetch(request, {signal: controller.signal});
    if (response.type === 'opaqueredirect' || (response.status < 500 && response.status !== 408)) return response;
  } catch { /* A failed connection can occur even when navigator.onLine is true. */ }
  finally { clearTimeout(timer); }
  const saved = await cache.match(documentPath);
  if (saved) {
    if (documentPath.endsWith('.csv')) return saved;
    if (url.pathname === '/') url.pathname = ROOT;
    url.searchParams.set(SAVED, '1');
    return Response.redirect(url.href, 302);
  }
  return response || Response.error();
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    if (savedDocument(url.pathname)) event.respondWith(navigate(request, url));
    return;
  }
  if (!event.clientId || !Object.hasOwn(FILES, url.pathname)) return;
  event.respondWith((async () => {
    const client = await self.clients.get(event.clientId);
    // Serve files from the verified edition only to its own recovery document.
    // Regular sessions always see what the current deployment serves.
    if (client && new URL(client.url).searchParams.has(SAVED)) {
      const cache = await caches.open(CACHE);
      const match = await cache.match(url.pathname);
      if (match) return match;
      return new Response('Unavailable in the saved workspace.', {status:503,headers:{'Cache-Control':'no-store'}});
    }
    try { return await fetch(request); }
    catch { return new Response('Connection unavailable.', {status:503,headers:{'Cache-Control':'no-store'}}); }
  })());
});
