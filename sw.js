/* Service Worker - منهج النور */
const CACHE_VERSION = 'v4';;
const CACHE_NAME = `manhaj-alnoor-${CACHE_VERSION}`;

// ملفات أساسية (عدّل/زد القائمة إذا رغبت لاحقاً)
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './sejo.html',
  './share-image.js',
  './icon-192.png',

  // Fonts (محلية)
  './ABO-THAR.TTF',
  './lotus-linotype-light.ttf',
  './lotus-linotype-bold.ttf',
  './amiri.ttf',
  "./MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].ttf",

  // Data (محلية)
  './headers.json',
  './texts.json',
  './Namebooks.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('manhaj-alnoor-') && k !== CACHE_NAME)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // فقط GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // فقط نفس الأصل
  if (url.origin !== self.location.origin) return;

  // تنقل SPA: ارجع index.html من الكاش إن أمكن (مع استثناء sejo.html)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      // استثناء نافذة "حول التطبيق"
      if (url.pathname.endsWith('/sejo.html')) {
        const cachedAbout = await cache.match('./sejo.html');
        if (cachedAbout) return cachedAbout;
        return fetch(req);
      }

      const cached = await cache.match('./index.html');
      if (cached) return cached;
      return fetch(req);
    })());
    return;
  }

  // Cache-first للملفات المحلية + Runtime cache للباقي
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);

      // نخزن الأنواع الشائعة: json / ttf / png / jpg / css / js
      const ct = (fresh.headers.get('content-type') || '').toLowerCase();
      const okToCache =
        fresh.ok && (
          ct.includes('application/json') ||
          ct.includes('font') ||
          ct.includes('image/') ||
          ct.includes('text/css') ||
          ct.includes('javascript') ||
          ct.includes('text/html')
        );

      if (okToCache) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      // لو فشل الجلب: حاول أي بديل من الكاش
      const fallback = await cache.match(req);
      if (fallback) return fallback;
      throw e;
    }
  })());
});