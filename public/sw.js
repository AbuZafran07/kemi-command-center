// KEMI service worker: caches the app SHELL only. Business data is never
// cached here -- Supabase (REST/Realtime/Storage), the AI gateway, and every
// TanStack Start server function call must always go straight to the network.
const CACHE_VERSION = "kemi-shell-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// Server function calls (TanStack Start) live under this path -- never intercept them.
const SERVER_FN_PREFIX = "/_serverFn";

const STATIC_ASSET_RE = /\.(?:js|mjs|css|png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|json|webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((error) => {
        // Precaching must never block installation of the SW itself.
        console.error("[sw] precache failed", error);
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The page asks us to activate a waiting update once the user confirms the reload.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING" || event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never cache mutations -- only GET is safe to serve from the cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin requests (Supabase REST/Realtime/Storage, the AI gateway, ...)
  // are left completely untouched -- always live, never cached.
  if (url.origin !== self.location.origin) return;

  // Server function calls carry business data; always go to the network.
  if (url.pathname.startsWith(SERVER_FN_PREFIX)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
