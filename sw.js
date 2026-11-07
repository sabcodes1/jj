// Service worker: gjør appen tilgjengelig uten nett.
// Bytt CACHE-navnet når filene endres, så gamle kopier ryddes bort.
const CACHE = 'styrke-v5';
const LOCAL = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.40.0/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.40.0/dist/fonts/tabler-icons.woff2?v3.40.0'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(LOCAL);
    // CDN-filer hentes hver for seg, så én feil ikke stopper installasjonen.
    await Promise.all(CDN.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('styrke-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Synk-API-et skal aldri caches.
  if (url.pathname.includes('/api/')) return;

  // Egne filer: prøv nettet først (så oppdateringer kommer fram), ellers bruk lagret kopi.
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const c = await caches.open(CACHE);
          c.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
        }
        return res;
      } catch (err) {
        const hit = await caches.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' && await caches.match('./index.html'));
        return hit || Response.error();
      }
    })());
    return;
  }

  // CDN-filer har låst versjon og endres aldri: bruk lagret kopi først.
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    })());
  }
});
