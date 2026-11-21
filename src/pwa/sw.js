/*
 * Service worker template: the build (pwaPlugin in vite.config.ts) fills in the cache
 * version and the file list, and writes it to dist/sw.js. Not type-checked or bundled.
 *
 * - Install: cache every file of this build, so the game runs offline.
 * - Page loads: network first (a new deploy shows up on the next launch when online), falling
 *   back to the cached page offline or when the network is too slow.
 * - Everything else: cache first. Builds use hashed file names, so cached files never go stale.
 * - Activate: drop older builds' caches and take over open pages.
 */
const CACHE = 'steel-vulture-__VERSION__';
const FILES = __FILES__;
const NETWORK_TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('steel-vulture-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(req.mode === 'navigate' ? page(req) : asset(req));
});

async function page(req) {
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    if (res.ok) return res;
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const cached = await caches.match(self.registration.scope, { ignoreSearch: true, ignoreVary: true });
    if (cached) return cached;
    throw err;
  }
}

async function asset(req) {
  // ignoreVary: servers may send `Vary: Origin`, and module scripts are requested with an
  // Origin header the precache request didn't have. Hashed file names make this safe.
  const cached = await caches.match(req, { ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
  }
  return res;
}
