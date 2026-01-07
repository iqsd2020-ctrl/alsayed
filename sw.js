const CACHE_NAME = 'manhaj-noor-v1.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './masail_database.js',
  './icon.png'
];

// 1. تثبيت Service Worker وتخزين الملفات
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('جاري تخزين ملفات التطبيق...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. تفعيل Service Worker وحذف التخزين القديم عند التحديث
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// 3. جلب الملفات (استخدام الكاش أولاً، ثم الشبكة)
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات Firebase والروابط الخارجية لضمان عمل قاعدة البيانات
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
     return; 
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // إذا وجد الملف في الكاش، قم بإرجاعه
      if (cachedResponse) {
        return cachedResponse;
      }
      // إذا لم يوجد، اطلبه من الإنترنت
      return fetch(event.request);
    })
  );
});
