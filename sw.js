// Простой офлайн-кэш: код — сеть в приоритете, картинки — из кэша (только успешные ответы)
const CACHE = 'yar-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/data.js', 'manifest.webmanifest', 'assets/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (req, res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (/\.(jpg|png|svg)$/.test(req.url)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => put(req, res))));
  } else {
    e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req)));
  }
});
