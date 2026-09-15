// This is just a dummy service worker to trigger the "Install App" prompt.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // We leave this empty so it never caches your live Google Sheets prices!
});

