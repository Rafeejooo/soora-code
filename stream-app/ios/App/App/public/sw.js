/**
 * Soora Service Worker v1
 * ─────────────────────────
 * Caching strategies:
 *   • Cache-first  → CSS, JS, fonts, images (static assets)
 *   • Network-first → HTML navigations (SPA shell)
 *   • Network-only  → /api/*, streaming (m3u8/ts), POST requests
 *
 * Features:
 *   • Versioned caches with auto-cleanup on activate
 *   • Offline fallback page when network & cache both miss
 *   • Skip waiting on new version for instant update
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `soora-static-${CACHE_VERSION}`;
const PAGES_CACHE   = `soora-pages-${CACHE_VERSION}`;
const IMG_CACHE     = `soora-images-${CACHE_VERSION}`;
const FONT_CACHE    = `soora-fonts-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';

// Max items in image cache (LRU-like: oldest evicted on overflow)
const IMG_CACHE_LIMIT = 200;

// All cache names we manage
const EXPECTED_CACHES = [STATIC_CACHE, PAGES_CACHE, IMG_CACHE, FONT_CACHE];

// ─── Pre-cache list (app shell) ───
const PRECACHE_URLS = [
  '/',
  OFFLINE_URL,
  '/manifest.json',
  '/soranime.svg',
  '/soora.svg',
];

// ─── Helpers ───
const isNavigationRequest = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

const isAPIRequest = (url) =>
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/api');

const isStreamingRequest = (url) => {
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  return ['m3u8', 'ts', 'mp4', 'webm', 'mkv'].includes(ext) ||
    url.pathname.includes('/stream') ||
    url.pathname.includes('/embed') ||
    url.hostname.includes('gogoanime') ||
    url.hostname.includes('vidstream') ||
    url.hostname.includes('hls') ||
    url.hostname.includes('vidsrc');
};

const isImageRequest = (request, url) => {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('image/')) return true;
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico'].includes(ext);
};

const isFontRequest = (url) => {
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  return ['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext) ||
    url.hostname.includes('fonts.gstatic.com');
};

const isStaticAsset = (url) => {
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  return ['js', 'css', 'json'].includes(ext) && !isAPIRequest(url);
};

// Trim image cache to limit
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems);
  }
}

// ─── INSTALL ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE — clean up old caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('soora-') && !EXPECTED_CACHES.includes(name))
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests entirely
  if (request.method !== 'GET') return;

  // Skip chrome-extension, data URIs, etc.
  if (!url.protocol.startsWith('http')) return;

  // ─── NETWORK-ONLY: APIs & streaming ───
  if (isAPIRequest(url) || isStreamingRequest(url)) {
    // Don't call respondWith — let the browser handle normally
    return;
  }

  // ─── NETWORK-FIRST: HTML / navigation requests ───
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a clone of successful navigations
          if (response.ok) {
            const clone = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // ─── CACHE-FIRST: Fonts ───
  if (isFontRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(FONT_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ─── CACHE-FIRST: Static assets (JS, CSS) ───
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ─── CACHE-FIRST: Images (with LRU trim) ───
  if (isImageRequest(request, url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMG_CACHE).then((cache) => {
              cache.put(request, clone);
              trimCache(IMG_CACHE, IMG_CACHE_LIMIT);
            });
          }
          return response;
        }).catch(() => {
          // Return transparent 1x1 GIF as fallback for broken images
          return new Response(
            Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0)),
            { headers: { 'Content-Type': 'image/gif' } }
          );
        });
      })
    );
    return;
  }

  // ─── DEFAULT: Stale-while-revalidate for anything else ───
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// ─── Listen for skipWaiting message from client ───
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
