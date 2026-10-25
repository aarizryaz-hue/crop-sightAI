'use strict';
const CACHE = 'cropsight-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png'];
const STATIC = new Set(SHELL);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  // Wait for existing tabs to close. Never discard a worker's in-memory photos on update.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('cropsight-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const isShell = event.request.mode === 'navigate' && ['/', '/index.html', '/settings'].includes(url.pathname);
  if (isShell) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put('/', copy))); }
      return response;
    }).catch(() => caches.match('/')));
  } else if (STATIC.has(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
  }
  // No API responses, submitted photos, results, privacy contact data or reports enter CacheStorage.
});
