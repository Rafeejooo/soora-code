import NodeCache from 'node-cache';

/**
 * Availability tracking service.
 * Tracks whether content (anime/movie) has working video streams
 * based on actual watch attempts. Used to filter out unavailable
 * content from home bundles.
 *
 * - Items marked `false` are filtered from listings
 * - Items not in cache (unknown) are assumed available
 * - TTL: 1 hour — availability is re-evaluated after expiry
 */

const availabilityCache = new NodeCache({
  stdTTL: 3600,       // 1 hour
  checkperiod: 300,   // clean up every 5 min
  maxKeys: 5000,
});

type ContentType = 'anime' | 'movie';

function makeKey(type: ContentType, id: string): string {
  return `avail:${type}:${id}`;
}

/**
 * Check if content is known to be available.
 * @returns true/false if known, null if never checked
 */
export function isAvailable(type: ContentType, id: string): boolean | null {
  const val = availabilityCache.get<boolean>(makeKey(type, id));
  return val !== undefined ? val : null;
}

/**
 * Record availability result from a watch attempt.
 */
export function markAvailability(type: ContentType, id: string, available: boolean): void {
  availabilityCache.set(makeKey(type, id), available);
}

/**
 * Filter an array of items, removing those known to be unavailable.
 * Items with unknown availability are kept (assumed available).
 */
export function filterAvailable<T extends { id?: string }>(
  type: ContentType,
  items: T[],
): T[] {
  return items.filter((item) => {
    if (!item.id) return false;
    const status = isAvailable(type, String(item.id));
    // Only filter out if explicitly marked unavailable
    return status !== false;
  });
}

export function getAvailabilityStats() {
  return {
    entries: availabilityCache.keys().length,
    stats: availabilityCache.getStats(),
  };
}
