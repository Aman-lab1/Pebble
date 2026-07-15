// =====================================================
// Pebble Service Worker
// Version: 1.0.2
// =====================================================

const CACHE_NAME = "pebble-v1.0.2";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// ----------------------------
// INSTALL
// ----------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );

  self.skipWaiting();
});

// ----------------------------
// ACTIVATE
// ----------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// ----------------------------
// FETCH
// ----------------------------
self.addEventListener("fetch", (event) => {

  // Ignore non-GET requests
  if (event.request.method !== "GET") return;

  const request = event.request;
  const url = new URL(request.url);

  // -----------------------------------------
  // NETWORK FIRST for HTML
  // -----------------------------------------
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/"
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {

          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return networkResponse;

        })
        .catch(() => caches.match(request))
    );

    return;
  }

  // -----------------------------------------
  // CACHE FIRST for everything else
  // -----------------------------------------
  event.respondWith(
    caches.match(request).then((cachedResponse) => {

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {

        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return networkResponse;

      });

    })
  );

});