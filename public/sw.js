// PLANORA service worker — exists mainly to satisfy Chrome's PWA installability
// check (a registered service worker + fetch handler is required for the
// "Install app" prompt). Deliberately minimal and network-first everywhere so it
// never serves stale dashboard/auth data: nothing is cached except the bare
// offline fallback shown only when a navigation truly can't reach the network.

const OFFLINE_CACHE = "planora-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first: always try the network so live data is never stale; only on an
// actual network failure for a page navigation do we show the offline fallback.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});
