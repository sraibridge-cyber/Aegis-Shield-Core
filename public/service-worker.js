/* AEGIS 44 service worker — generated at build time */
const VERSION = "ble-1";
const CACHE = "aegis44-" + VERSION;
const PRECACHE = ["./","./assets/clock-sWdOvu5h.js","./assets/download-GqGer48n.js","./assets/fade-in-D70zKjr9.js","./assets/free-B5aUqako.js","./assets/gauge-cziwSQul.js","./assets/index-CL6IUdNY.js","./assets/index-VLdJOqoS.css","./assets/index-wHtT6qdu.js","./assets/install-BcBqnI2t.js","./assets/install-CmYWRgZ4.js","./assets/layer-stack-Dv5SLYdk.js","./assets/memory-BFUxe0H2.js","./assets/mind-BTRhqqfo.js","./assets/nerve-JbMXvKD5.js","./assets/backup-9f3c2a.js","./assets/ble-9f3c2a.js","./assets/ble-panel-9f3c2a.js","./assets/identity-9f3c2a.js","./assets/instance-9f3c2a.js","./assets/persist-9f3c2a.js","./assets/recovery-9f3c2a.js","./assets/guide-9f3c2a.js","./assets/guide-content-9f3c2a.js","./assets/rank-9f3c2a.js","./assets/selftest-4a7c1e.js","./assets/soul-DJ_k70Fw.js","./assets/verify-KPAhcwj-.js","./assets/wiring-P1LhyUQl.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/mark.svg","./index.html","./manifest.json"];
const INDEX = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      caches.match(INDEX).then((hit) => hit || fetch(req).catch(() => caches.match(INDEX)))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(INDEX));
    })
  );
});
