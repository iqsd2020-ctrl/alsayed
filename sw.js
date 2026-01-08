const CACHE_NAME = 'manhaj-noor-v11';
const ASSETS_TO_CACHE = [
'./',
'./index.html',
'./style.css',
'./script.js',
'./masail_database.js',
'./icon.png'
];
self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
console.log('جاري تخزين ملفات التطبيق...');
return cache.addAll(ASSETS_TO_CACHE);
})
);
});
self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then((keys) => {
return Promise.all(
keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
);
})
);
});
self.addEventListener('fetch', (event) => {
if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
return;
}
event.respondWith(
caches.match(event.request).then((cachedResponse) => {
if (cachedResponse) {
return cachedResponse;
}
return fetch(event.request);
})
);
});
