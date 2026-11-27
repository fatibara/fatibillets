// FatiBillets — service worker : rend l'application installable et garde une copie du site pour un affichage sans connexion.
// Toujours le réseau d'abord (les mises à jour arrivent tout de suite) ; la copie ne sert que si Internet est coupé.
// Seuls les fichiers du site sont gardés : jamais les données Supabase ni les paiements.
const CACHE = 'fatibillets-v20';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './style.css', './logo.png', './icon-192.png']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(K => Promise.all(K.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: false }).then(m => m || caches.match(r, { ignoreSearch: true })).then(m => m || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
