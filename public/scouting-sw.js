// Service worker for /scouting only: keeps the page and the files it loads on
// the phone, so it still opens at a venue with no signal. Scouting data itself
// is saved by the page (localStorage), not here. Every other page on the site
// is left alone.

const CACHE = "scouting-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/scouting")).catch(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// Network first, falling back to the saved copy (the page itself).
async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    const saved = await cache.match(cacheKey);
    if (saved) return saved;
    throw new Error("offline");
  }
}

// Saved copy first (build files have unique names, so they never go stale).
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function fromScoutingPage(event) {
  if (!event.clientId) return false;
  const client = await self.clients.get(event.clientId);
  return Boolean(client && new URL(client.url).pathname.startsWith("/scouting"));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === "/scouting") {
    event.respondWith(networkFirst(request, "/scouting"));
    return;
  }

  const asset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/icon.png" ||
    url.pathname === "/apple-icon.png";
  if (!asset) return;
  event.respondWith(
    (async () => ((await fromScoutingPage(event)) ? cacheFirst(request) : fetch(request)))(),
  );
});
