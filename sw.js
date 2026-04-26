const CACHE_NAME = 'apakabar-v1';
const ASSETS = [
  '/', 
  '/index.html', 
  '/style.css', 
  '/app.js', 
  '/game.html', 
  '/manifest.json'
];

// Install & Caching Assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Fetch Logic dengan Error Handling
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedRes => {
      // 1. Jika ada di cache, langsung kembalikan
      if (cachedRes) return cachedRes;

      // 2. Jika tidak ada, coba ambil dari network
      return fetch(e.request).catch(() => {
        // 3. JIKA NETWORK GAGAL (Domain mati/Offline)
        // Kembalikan null atau halaman offline agar tidak crash
        if (e.request.mode === 'navigate') {
          return caches.match('/game.html');
        }
        return null; 
      });
    })
  );
});