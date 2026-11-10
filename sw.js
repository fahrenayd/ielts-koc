// IELTS Koç — service worker (internetsiz çalışma)
// İçerik veya kod değiştiğinde VERSION'u artır: telefon yeni sürümü indirir.
const VERSION = '2.0.0';
const CACHE = 'ielts-koc-' + VERSION;

const APP_FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './icons/icon-192.png', './icons/icon-512.png', './js/app.js', './js/charts.js', './js/content.js', './js/db.js', './js/eval.js', './js/planner.js', './js/qengine.js', './js/recorder.js', './js/results.js', './js/scoring.js', './js/screens/grammar.js', './js/screens/listening.js', './js/screens/me.js', './js/screens/mistakes.js', './js/screens/mock.js', './js/screens/onboarding.js', './js/screens/placement.js', './js/screens/practice.js', './js/screens/reading.js', './js/screens/settings.js', './js/screens/speaking.js', './js/screens/today.js', './js/screens/vocab.js', './js/screens/writing.js', './js/srs.js', './js/store.js', './js/tts.js', './js/util.js',
  './content/index.json'
];

// content/index.json içindeki tüm "file" alanlarını topla
function contentFiles(index) {
  const out = [];
  for (const list of Object.values(index)) {
    if (Array.isArray(list)) for (const item of list) if (item && item.file) out.push('./content/' + item.file);
  }
  return out;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_FILES.map((u) => new Request(u, { cache: 'reload' })));
    const res = await fetch('./content/index.json', { cache: 'reload' });
    const index = await res.json();
    await cache.addAll(contentFiles(index).map((u) => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
      return Response.error();
    }
  })());
});
