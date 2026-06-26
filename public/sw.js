/**
 * WaterParty Service Worker
 *
 * Caches media/images served from /api/media/ so they load
 * instantly from cache on repeat views (cache-first strategy).
 *
 * Cache name: waterparty-media-v1
 * Max entries: 500 (oldest evicted when full)
 */

const MEDIA_CACHE = 'waterparty-media-v1';
const MEDIA_PATTERN = /\/api\/media\//;
const MAX_CACHE_ENTRIES = 500;

// ─── Install: activate immediately ────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ─── Activate: claim clients, clean old caches ────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Claim all clients so the SW controls pages immediately
      await self.clients.claim();

      // Delete any old caches (version mismatch)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((name) => {
          if (name !== MEDIA_CACHE) {
            return caches.delete(name);
          }
        })
      );
    })()
  );
});

// ─── Fetch: cache-first for /api/media/ ──────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept /api/media/ requests
  if (!MEDIA_PATTERN.test(url.pathname)) return;

  event.respondWith(cacheFirst(event.request));
});

/**
 * Cache-first strategy:
 * 1. Check cache for a match
 * 2. If found, return cached response immediately
 * 3. If not found, fetch from network, cache it, then return
 *
 * Responses are cloned before caching because the body can only be consumed once.
 */
async function cacheFirst(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Only cache successful responses (200 OK)
    if (response.ok) {
      // Evict oldest entries if at capacity
      await evictIfNeeded(cache);

      // Clone so we can cache one and return the other
      const responseToCache = response.clone();
      // Fire-and-forget caching (don't block the response)
      cache.put(request, responseToCache).catch(() => {});
    }

    return response;
  } catch (error) {
    // Network failed — if we had a cached response we would've returned it above.
    // Return a transparent 1x1 PNG as a graceful fallback so the UI doesn't break.
    console.error('[SW] Media fetch failed:', error);
    return new Response(null, {
      status: 504,
      statusText: 'Gateway Timeout',
    });
  }
}

/**
 * If the cache has reached MAX_CACHE_ENTRIES, delete the oldest entries
 * (the first entries in the cache, which are the oldest by insertion order).
 */
async function evictIfNeeded(cache) {
  const keys = await cache.keys();
  if (keys.length >= MAX_CACHE_ENTRIES) {
    // Delete the oldest 10% of entries
    const toDelete = Math.max(1, Math.floor(keys.length * 0.1));
    await Promise.all(
      keys.slice(0, toDelete).map((key) => cache.delete(key))
    );
  }
}
