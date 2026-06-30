// Iron Log — service worker
// Caches the entire app shell so it works fully offline after first load.
// Bump CACHE_NAME whenever you update app.jsx / index.html to force a refresh.

const CACHE_NAME = "iron-log-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./app.jsx",
  "./manifest.json",
  "./vendor/react.production.min.js",
  "./vendor/react-dom.production.min.js",
  "./vendor/babel.min.js",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Cache-first for app shell assets; falls back to network if not cached.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Don't try to cache cross-origin or non-GET requests
        if (event.request.method !== "GET" || !response || response.status !== 200) {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
