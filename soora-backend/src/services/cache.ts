import NodeCache from 'node-cache';

// Two-tier caching: short TTL for dynamic data, long TTL for stable data
const shortCache = new NodeCache({ stdTTL: 600, checkperiod: 120, maxKeys: 2000 }); // 10 min
const longCache = new NodeCache({ stdTTL: 1800, checkperiod: 300, maxKeys: 5000 }); // 30 min

export const CACHE_TTL = {
  HOME_BUNDLE: 900,    // 15 min — home pages
  INFO: 1800,          // 30 min — anime/movie info
  SEARCH: 600,         // 10 min — search results
  GENRE: 900,          // 15 min — genre listings
  STREAM: 300,         // 5 min — streaming sources (change frequently)
  MANGA_READ: 3600,    // 1 hour — manga chapter pages (static)
  TMDB: 1800,          // 30 min — TMDB data (stable)
};

/**
 * Get from cache or fetch fresh data.
 * @param key - Cache key
 * @param fetcher - Async function to fetch data
 * @param ttl - Time to live in seconds
 * @param tier - 'short' or 'long'
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.SEARCH,
  tier: 'short' | 'long' = 'short'
): Promise<T> {
  const store = tier === 'long' ? longCache : shortCache;
  const hit = store.get<T>(key);
  if (hit !== undefined) return hit;

  const data = await fetcher();
  store.set(key, data, ttl);
  return data;
}

/**
 * Stale-while-revalidate: return stale data instantly, refresh in background.
 */
export async function cachedSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL.HOME_BUNDLE
): Promise<T> {
  const store = shortCache;
  const hit = store.get<T>(key);
  if (hit !== undefined) {
    // Check remaining TTL — if < 25% left, revalidate in background
    const remaining = store.getTtl(key);
    if (remaining && remaining - Date.now() < ttl * 250) {
      fetcher().then((data) => store.set(key, data, ttl)).catch(() => {});
    }
    return hit;
  }

  const data = await fetcher();
  store.set(key, data, ttl);
  return data;
}

/** Clear all caches */
export function clearCache(): void {
  shortCache.flushAll();
  longCache.flushAll();
}

/** Get cache stats */
export function getCacheStats() {
  return {
    short: shortCache.getStats(),
    long: longCache.getStats(),
    shortKeys: shortCache.keys().length,
    longKeys: longCache.keys().length,
  };
}
