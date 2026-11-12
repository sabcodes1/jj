// Service worker: gjør appen tilgjengelig uten nett.
// Bytt CACHE-navnet når filene endres, så gamle kopier ryddes bort.
const CACHE = 'styrke-v6';
const NET_WAIT = 2500; // ms å vente på nettet før lagret kopi brukes
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

  // Egne filer: prøv nettet først (så oppdateringer kommer fram), men vent ikke lenger enn NET_WAIT.
  // Med svakt nett vises lagret kopi med en gang, og den nye versjonen lagres i bakgrunnen til neste åpning.
  if (url.origin === self.location.origin) {
    const net = (async () => {
      const res = await fetch(req);
      if (res.ok) {
        const c = await caches.open(CACHE);
        await c.put(req.mode === 'navigate' ? './index.html' : req, res.clone());
      }
      return res;
    })();
    e.waitUntil(net.catch(() => {}));
    e.respondWith((async () => {
      const hit = await caches.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' && await caches.match('./index.html')) || null;
      if (!hit) return net.catch(() => Response.error());
      const late = new Promise(done => setTimeout(() => done(null), NET_WAIT));
      const res = await Promise.race([net.catch(() => null), late]);
      return res && res.ok ? res : hit;
    })());
    return;
  }

  // CDN-filer har låst versjon og endres aldri: bruk lagret kopi først.
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      // Bare CORS-svar lagres: siden sjekker filene mot en hash (SRI), og det går ikke med «opaque» svar.
      if (res.ok) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    })());
  }
});
