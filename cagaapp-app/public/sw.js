/* Service Worker - CagaApp (Netlify PRO)
   - Precache essenziale
   - Runtime cache per Overpass + /api (Netlify redirect) + /.netlify/functions
   - Offline fallback navigazione
   - Skip waiting via UpdateBadge
*/

const VERSION = "cagaapp-sw-v4";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// NOTA: sw.js è servito da /app/sw.js, quindi "./" = "/app/"
const PRECACHE_URLS = [
  "./",
  "./offline.html",
  "./manifest.webmanifest",
  "./assets/cagapp.png",
  "./assets/caga.png",
  "./assets/walk.png"
];

// Install: cache essenziali
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS);
      self.skipWaiting();
    })()
  );
});

// Activate: pulizia cache vecchie + claim
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Messaggi dal client (UpdateBadge)
self.addEventListener("message", (event) => {
  const type = event?.data?.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
});

// Helper: stale-while-revalidate
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || null;
}

// Fetch handler
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET
  if (req.method !== "GET") return;

  // 1) NAVIGAZIONE: network-first, fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const resp = await fetch(req);
          // aggiorna shell cache (home app)
          const cache = await caches.open(STATIC_CACHE);
          cache.put("./", resp.clone());
          return resp;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match("./offline.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // 2) RUNTIME API: Overpass + Netlify (/api/* e /.netlify/functions/*)
  const isOverpass = /overpass-api\.de|overpass\.kumi\.systems|lz4\.overpass-api\.de/i.test(url.hostname);
  const isNetlifyFn = url.pathname.includes("/.netlify/functions/");
  const isApi = url.origin === self.location.origin && url.pathname.startsWith("/api/");

  if (isOverpass || isNetlifyFn || isApi) {
    event.respondWith(
      (async () => {
        const resp = await staleWhileRevalidate(req, RUNTIME_CACHE);
        if (resp) return resp;

        // fallback JSON coerente
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      })()
    );
    return;
  }

  // 3) STATIC ASSETS same-origin: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const resp = await fetch(req);
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        } catch {
          const fallback = await cache.match("./assets/cagapp.png");
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  // 4) Default: network, fallback runtime cache
  event.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        return cached || Response.error();
      }
    })()
  );
});
