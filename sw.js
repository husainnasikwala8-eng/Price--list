// Raj Traders service worker: newest app when online, saved copy when offline, photos cached for slow networks.
const V = 'rt4-v1', IMG = 'rt4-img', MAX_IMG = 300;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V && x !== IMG).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
async function trim(c) {
  const ks = await c.keys();
  if (ks.length > MAX_IMG) await Promise.all(ks.slice(0, ks.length - MAX_IMG).map(k => c.delete(k)));
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.hostname.endsWith('googleusercontent.com')) {           // Drive photos: serve saved copy, refresh in background
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) { c.put(r, res.clone()); trim(c); } return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (u.origin !== location.origin) return;                     // Sheet and Firebase calls go straight to the network
  if (/\.(jpe?g|png|webp|mp3)$/i.test(u.pathname)) {            // ad pictures and music: saved after first load
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res.ok) { c.put(r, res.clone()); trim(c); }
      return res;
    }));
    return;
  }
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; })
    .catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
