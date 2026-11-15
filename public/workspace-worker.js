// Only bundled public workspace documents participate in saved-mode recovery.
// The build binds each saved file to one release.
const CACHE = 'first-fire-workspace-192a69b5012da20469a1';
const ROOT = '/research-workspace/';
const FILES = {"/data/raw/PSI-99-experimental.csv":"sha256-PCQ5C574bz0euquRGho8yVqHWa6/QgYjcTcObUsxuKw=","/flint-coefficients.js":"sha256-OA/toiVGlSuKlPSEmmFFbhY89T7aSMnAn8OeSz95ufM=","/flint-solid.js":"sha256-crCjhZsRftMJnovsyjCwJEPwFf0S9ffZ+iwTxAuVNhI=","/fonts/barlow-bold.ttf":"sha256-fd4wf6iH/GX/WDDPrad6fezF2ujTyBbJ05uj8a8cTtc=","/fonts/dm-bold.ttf":"sha256-Ko5/cT7nn7zN7zzvXHh6/0dYApn32mAUSWHn2y7AghE=","/fonts/dm-regular.ttf":"sha256-sK4+iafT7ysYOLtLHOsLF8w0Na8GHu6AnXaqYj/xFuk=","/icon.svg":"sha256-TOmrO/l9mu7VF37ypRAB0xQjV22wg9stHgyNlvy/Wl0=","/material-observer-evidence.js":"sha256-ws+OP7OjaowyUhwv5qWZ+odrdrb6Oc7QXSyboF/TeZw=","/material-observer-model.js":"sha256-6friWCgEeYAVXxjOnIloghX7hPcBI1qEzY9kWuQXqDg=","/material-observer.css":"sha256-nHktAarja467SM3y1LVgXMhV//qgaf6dfh3AHDAFBOU=","/material-observer.html":"sha256-Ywt0iEPHt7uglzI4JbxYf5kaRI+9nrb6XPzglqEy4jM=","/material-observer.js":"sha256-oXiZjwl+TXdlH55CEituy+UH6nfhJXtEp3OkDzcGyQc=","/material-screening.mjs":"sha256-i6CrIaV378iLkkRoXg8YxaLK0ptw7+xx6ruMy6I5W2g=","/research-workspace/awareness.js":"sha256-hwEPJsPTAKERCbz6wJM2foc90c/AbxwObuTQIZA/CXA=","/research-workspace/cabin-liquid-weights.js":"sha256-KQDa7ji1Sq1QDCDvq0YlvZHc4Wzsflfq3IBy2ITs0Zo=","/research-workspace/design-lab.js":"sha256-2ejG2UNkNWTDdHV6QzdPo1hHnw2c+dgdjssRoHkHGHU=","/research-workspace/earth-map.webp":"sha256-xpbNS6Dn7j7jj4x6dgxB6ocneHZJM0zOgHuhG+ECcIc=","/research-workspace/earth-poster.webp":"sha256-dkHuyd6HDLhw/1uapBM/T4AoASn1vW4x8zgQVHtI8H0=","/research-workspace/earth.js":"sha256-0dBMXDdMv+SXJlVOTESRLNHHeolArqEZ3dY2bowVWgk=","/research-workspace/fm2-worked-example.png":"sha256-xjQrMtGNQpgAzXZoKExWFVYjW5qLkdxKoSxcVIOuuHE=","/research-workspace/fonts/barlow-bold.ttf":"sha256-fd4wf6iH/GX/WDDPrad6fezF2ujTyBbJ05uj8a8cTtc=","/research-workspace/fonts/dm-bold.ttf":"sha256-Ko5/cT7nn7zN7zzvXHh6/0dYApn32mAUSWHn2y7AghE=","/research-workspace/fonts/dm-regular.ttf":"sha256-sK4+iafT7ysYOLtLHOsLF8w0Na8GHu6AnXaqYj/xFuk=","/research-workspace/forecast-ui.js":"sha256-cj4cg8ya3bjOlLg8HJ+6uungOuKFO+DDN5rd6iPC3EQ=","/research-workspace/homepage.css":"sha256-yx4j+dTzs+/B8l1q9PX/aF1CLBEQ7uRctRXFhVa/HMU=","/research-workspace/icon.svg":"sha256-TOmrO/l9mu7VF37ypRAB0xQjV22wg9stHgyNlvy/Wl0=","/research-workspace/index.html":"sha256-erBQzzDea/QwbuINgILRZlZIDY9PVONNM1YAwrbmN+4=","/research-workspace/intent-router.js":"sha256-3POnEWR9IPd6dkVZCKpH1pYkqi//XnXJpO6YvPpA3sE=","/research-workspace/investigation-replay.js":"sha256-SH/cLPXsED8RdhKIP2qrxnOrGBdNcC+0J8P+0ED3IO4=","/research-workspace/judge-awareness.js":"sha256-tkualvyLkOyQhXGpCPvQ7EP/p2ULWy+DgbabkGhr890=","/research-workspace/judge-experiment.js":"sha256-AjZe8XMkxhkeObfJzJdiYrlPqBghPbmUijje/N8sezI=","/research-workspace/judge-lab.css":"sha256-fKUlkBE8TVqO7eZ7QedP7kNZ8ZdxODTSsJ2E1FbEJEs=","/research-workspace/judge-lab.html":"sha256-o7DsriqDiFAusnh1fbb8bh2RrAWAX2CdaWwn7oErZag=","/research-workspace/judge-lab.js":"sha256-eU1lNGD0NhSnPrYrmJtveVr7q9kUb4lfQm0pt0fdoDQ=","/research-workspace/judge-reader.js":"sha256-IWy80glDEk6Es3VJvnSNjLd+tlPw2Qan9o7Q6ByVm5s=","/research-workspace/observation-rows.js":"sha256-uNoeJ3RVwWJJQDLFQRnlabY5X0f8s2tMJdg//xtRGWI=","/research-workspace/physics-lab.js":"sha256-Tks2HQ5bFv7OUzni7yOux7kSEQ7V16bUtfHXfFCuIK8=","/research-workspace/reader-device.js":"sha256-HGGWRUBI0behb4u1qICEcF2CI2vQh16cnxHQ5LfnT1M=","/research-workspace/records.js":"sha256-2PN7pbLNs+jQ6xcoLMy4XKeEDmhyUX2H1I9bfn7KZ0I=","/research-workspace/referee-deck.js":"sha256-axgs4zHpA3CWnIua5ljg523LGTR5uMdaaIKwTkkiL54=","/research-workspace/referee-passages.js":"sha256-qgDDuLgjnntiFJ4Ru2hlXYpoWC+XTd2fu4SXm/Xd6wc=","/research-workspace/referee-reviews.js":"sha256-OBLlvHWCZD/v+eUmbk+xpMX+40Y4LHsjqYCItjYh1+k=","/research-workspace/research-session.js":"sha256-qr8uueqIOvfIWctVdfTLl3CPAPCMuVEwk4k0tBXAOcw=","/research-workspace/rover-concept.png":"sha256-Na+xovLMLtzeu348F3j47rqPxy3TPLI7q1EVNH4gLsI=","/research-workspace/rover-hero.js":"sha256-WEtWdWNQbRKxAQphfxCrR+UBo+o+02JyzvsDxPDktp4=","/research-workspace/rover-integration.js":"sha256-9cMND860DNdD5CSta5eevV8yEeYudTDigVviVFf3bxE=","/research-workspace/rover-model.js":"sha256-9ArmaR+1xVsUzTx/ZaCmH+AnR0cXT1A6PupXDgpxE6w=","/research-workspace/rover-workbench/examples/jezero-sol15-plan.json":"sha256-wA3xeCjx2XPsAmnT9CWsMmEwmOzT/bS6PLWhgI9p4nM=","/research-workspace/rover-workbench/examples/lunar-cellulose.json":"sha256-cDBgE6WbzD+Cn6PtA+AOiO2Aj+BGtyquoqFh7y9oM7U=","/research-workspace/rover-workbench/examples/lunar-pe.json":"sha256-Oe92xi9jnfLA6PUlgqFAd4qywa1zitKLzMjob9kxvWA=","/research-workspace/rover-workbench/examples/mars-night-pe.json":"sha256-Rm+gFViVhleCv7NYWgH5cuYh2b7/Ls4ZfWmwsG6oJGY=","/research-workspace/rover-workbench/examples/results.json":"sha256-E5k1eNYa2PItK8nQZGDQhGOc0z+Xy2bQZf0pcqPet9s=","/research-workspace/rover-workbench/parts.json":"sha256-Gr6IsR+eGLkcEcf1RmhsptDRAXfNmO8KJTmYHhRCVOk=","/research-workspace/rover-workbench/prototype/app.mjs":"sha256-nY92GB4yaVlXoFSGYZAwOzZ5z/yeleUuesmoAqlxlaA=","/research-workspace/rover-workbench/prototype/field-comparison.mjs":"sha256-5nGqFRkgPYjcl6ZsTdo7lIt6CsgDd9a1NoSiDrQVeZ0=","/research-workspace/rover-workbench/prototype/finder.css":"sha256-hLvo59l9bc8hcjw+LoLKBb8DIG6jiPmSkdUntJi0Was=","/research-workspace/rover-workbench/prototype/finder.mjs":"sha256-idR4H31/STpho8qAk/Mx9yL1z2MnwrBXHdfZZdskIUY=","/research-workspace/rover-workbench/prototype/fonts/dm-bold.ttf":"sha256-Ko5/cT7nn7zN7zzvXHh6/0dYApn32mAUSWHn2y7AghE=","/research-workspace/rover-workbench/prototype/fonts/dm-license.txt":"sha256-mvNhkDMkN/Xs0Jl03kPB98d6MQqZbN2M6yVii0WIQOE=","/research-workspace/rover-workbench/prototype/fonts/dm-regular.ttf":"sha256-sK4+iafT7ysYOLtLHOsLF8w0Na8GHu6AnXaqYj/xFuk=","/research-workspace/rover-workbench/prototype/index.html":"sha256-vXD35/PotwFOm/rJgNllRH5ihij8Yn7mlcJ3AJ25Odg=","/research-workspace/rover-workbench/prototype/lola-grid.mjs":"sha256-P78XVxb4UXKTI7qko0Pg738YCxV0b5ghfRZgqQUMhFg=","/research-workspace/rover-workbench/prototype/mission-review.css":"sha256-i7zHkGpNcAwP/9e9SnrKE2EdtRg2VY/fDm8Wth/iKJU=","/research-workspace/rover-workbench/prototype/mission-review.mjs":"sha256-YNc3ZFiYAV/15NkQDwdI7LpRbBJKQz+SUMcXj4H8CI0=","/research-workspace/rover-workbench/prototype/model.mjs":"sha256-0qmw0gb6QZ0VJC1ImqPLZxbLJCg0YRJPDG+L514M2OI=","/research-workspace/rover-workbench/prototype/route-charts.mjs":"sha256-3RzFJD1/t2FJk2xTMw9U3Awcw6itfq3cYMwV/vy4/lk=","/research-workspace/rover-workbench/prototype/scene/hardware.mjs":"sha256-HniGoMKlNRpcm5LQREF7w1Ow1T1SB/pxR6aKpIzsh5s=","/research-workspace/rover-workbench/prototype/scene/landscape.mjs":"sha256-dHHL7yEpT/m0FyMk9yRJBWic7gl9PTne6YypOw9xA3g=","/research-workspace/rover-workbench/prototype/scene/overlays.mjs":"sha256-iAO38uzeBcGUYWS1LxVKdU9+ZDbdZE2gETIcFlyHHgA=","/research-workspace/rover-workbench/prototype/scene/scene.mjs":"sha256-n5vPuuhp/27hSR+h24e6bkQI/KQJXjbFDhDcWPdj6uc=","/research-workspace/rover-workbench/prototype/scene/software.mjs":"sha256-86GXT96sGV0fjSD5ogrx3B2H7MstHvpf9UoqcVObqfY=","/research-workspace/rover-workbench/prototype/scene/vendor/THREE-LICENSE.txt":"sha256-hS4OhpkWm/n2/ca9o+aC0HjcvHOLXTPnTfWUchv/Jx0=","/research-workspace/rover-workbench/prototype/scene/vendor/three.module.min.js":"sha256-PmkKx9GAsKrfCJG+o57sZD4p4tPnXJmxholRhmX2m6Y=","/research-workspace/rover-workbench/prototype/style.css":"sha256-6W7s00nvLSV+uiHYHKtInVUdq9Box4FRwcKKzxISzlg=","/research-workspace/rover-workbench/prototype/traverse.mjs":"sha256-1GK/1L6xZ3Uej1opVlnwi0N1uVpgHHGcLkFvOVOpLMw=","/research-workspace/rover-workbench/prototype/workbench.css":"sha256-Zm7KHshVLNaDNECWkrBT/4S384T4mo3O/rAmpOJhi+A=","/research-workspace/rover-workbench/prototype/workbench.mjs":"sha256-Y9Yl7OfI0e4mUQqYLdWqqfpkyRAjNYY469FJAKFNQOM=","/research-workspace/rover-workbench/scenario.schema.json":"sha256-TgG1/nGBCj93zZK4ZwkTBjO+LdhGY47ktnh9kJRopvs=","/research-workspace/rover-workbench/sources.json":"sha256-JbldHZQnvkS84P9LkSFJ+DQgf5ED8dpW7U+jEli+oCc=","/research-workspace/rover-workbench/terrain/jezero-route.json":"sha256-x6ayjCBnja6wU2tWNQCbM8mWUU64Bi1utphARo1OSKE=","/research-workspace/rover-workbench/terrain/lola-samples.mjs":"sha256-7X04KakfCSkb6WgRzvINWaOwNBzKaJBoincx3GddQ7c=","/research-workspace/rover-workbench/terrain/lola.json":"sha256-eOSDDMbq3E4QAXnGKUtJgVAu8BuRiPiHbmsR+F0abss=","/research-workspace/science-chat.js":"sha256-f2O/m8vTLUDdbS3QOjdPELX3YlKW0xtXdu2tW2UxnUw=","/research-workspace/search.js":"sha256-C+6KDahEfCmYeRUfk7hSuxweR6RHtk2OwhbmXUQsPcY=","/research-workspace/sibal.png":"sha256-IOcRP/j9Fet3Vd/zZ8MMZKcNRdN1GdOatgGqUGZGd8I=","/research-workspace/spread-scene.js":"sha256-CfLOB1CsNZrb4pXwSUObYn1AUSo0Avm4tBE7VrUkYto=","/research-workspace/tool-directory.css":"sha256-lW2ZlI7xckmI/cX+7ZMgyxTf4DPQGeS2pM4U7OUmpfU=","/research-workspace/tool-directory.js":"sha256-X4MLFd0kwBFKvID1QUlzoOCU8xUx9034wiCXSn/3wa4=","/research-workspace/tools.html":"sha256-F74j3tiKlc/PWNnpOVMhtaVFZQtu5kvDySZ72BMp/Sw=","/research-workspace/transfer-lab.js":"sha256-xnm0d0ibIVJpqfF2c2s27NU6Ix6Vgm423pVtyREIKZc=","/research-workspace/transport-fit.js":"sha256-1mBHxWhfiKoF8K05Oh4vxzXdlMxPkEqWLOoM4J2g4G4=","/research-workspace/transport-lab.js":"sha256-psNF6ksCZh74gEEM9rVuWL/hYG8/IqsCzMEmRlkkSzQ=","/research-workspace/trial-comparison.js":"sha256-sy9P+KI0uVfDBxyIZ9W1om3/+9VkY2R5pRnFuwxbrjk=","/research-workspace/workspace-core.js":"sha256-rSA5rlkLkK87tarMyc/Azd7QsCwmE0Z6WRoUUKaRSwQ=","/research-workspace/workspace.css":"sha256-sYQdj77k8b0ecMwJ1ISU8W1yyZ+2W4Kk6zKWtM7IQJY="};
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
