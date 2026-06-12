/**
 * Service worker — network-first with cache fallback.
 * Online: always fetch fresh (updates land immediately) and refresh the cache.
 * Offline: serve the last good copy so the app still opens on flaky wifi.
 */

const CACHE = 'puzzle-talk-v1';
const CORE = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/grid.js',
  'js/solver.js',
  'js/generator.js',
  'js/themes.js',
  'js/storage.js',
  'js/speech.js',
  'js/commands.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
