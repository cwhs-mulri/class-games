// 오프라인 캐시: HTML은 네트워크 우선, 나머지(js·css·이미지·글꼴)는 캐시를 먼저 보여 주고 뒤에서 갱신
const VERSION = 'v1';
const CACHE = 'class-games-' + VERSION;
const CORE = [
  '/', '/index.html', '/hub.css', '/manifest.webmanifest', '/shared/pwa.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/img/energy-city.webp', '/img/century.webp',
  '/vendor/three.min.js',
  '/energy-city/', '/energy-city/style.css', '/energy-city/engine.js', '/energy-city/city3d.js', '/energy-city/app.js',
  '/century/', '/century/style.css', '/century/engine.js', '/century/world3d.js', '/century/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('class-games-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('/'))));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => {
    const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => cached);
    return cached || net;
  }));
});
