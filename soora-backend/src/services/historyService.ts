import NodeCache from 'node-cache';

/**
 * Watch History Service
 * Tracks user watch progress per content item.
 * Linked to userId from AuthContext.
 * TTL: 7 days (604800 seconds)
 */

const historyCache = new NodeCache({
  stdTTL: 604800,     // 7 days
  checkperiod: 3600,  // clean up every hour
  maxKeys: 50000,     // max 50k entries
});

export interface HistoryEntry {
  id: string;            // contentId (animeId or tmdbId)
  userId: string;
  title: string;
  image: string;
  type: 'anime' | 'movie' | 'tv';
  episodeId?: string;
  episodeNumber?: number;
  episodeTitle?: string;
  progress: number;      // 0-1 (percentage watched)
  currentTime: number;   // seconds
  duration: number;      // total duration in seconds
  lastWatched: number;   // timestamp ms
  watchUrl: string;      // full URL to resume
  genre?: string;
}

function makeKey(userId: string, id: string, episodeNumber?: number): string {
  return `history:${userId}:${id}:${episodeNumber ?? 'movie'}`;
}

function getUserPrefix(userId: string): string {
  return `history:${userId}:`;
}

/**
 * Save or update a history entry.
 */
export function saveHistory(entry: HistoryEntry): void {
  const key = makeKey(entry.userId, entry.id, entry.episodeNumber);
  historyCache.set(key, entry);
}

/**
 * Get all history entries for a user, sorted by lastWatched DESC.
 */
export function getUserHistory(userId: string): HistoryEntry[] {
  const prefix = getUserPrefix(userId);
  const keys = historyCache.keys().filter((k) => k.startsWith(prefix));
  const entries: HistoryEntry[] = [];

  for (const key of keys) {
    const entry = historyCache.get<HistoryEntry>(key);
    if (entry) entries.push(entry);
  }

  return entries.sort((a, b) => b.lastWatched - a.lastWatched);
}

/**
 * Get in-progress entries (progress 5%-90%) — "Continue Watching".
 */
export function getInProgress(userId: string): HistoryEntry[] {
  return getUserHistory(userId).filter(
    (e) => e.progress >= 0.05 && e.progress < 0.90
  );
}

/**
 * Get a specific entry.
 */
export function getEntry(userId: string, id: string, episodeNumber?: number): HistoryEntry | null {
  const key = makeKey(userId, id, episodeNumber);
  return historyCache.get<HistoryEntry>(key) || null;
}

/**
 * Delete a specific entry.
 */
export function deleteEntry(userId: string, id: string, episodeNumber?: number): void {
  const key = makeKey(userId, id, episodeNumber);
  historyCache.del(key);
}

/**
 * Clear all history for a user.
 */
export function clearUserHistory(userId: string): void {
  const prefix = getUserPrefix(userId);
  const keys = historyCache.keys().filter((k) => k.startsWith(prefix));
  historyCache.del(keys);
}

export function getHistoryStats() {
  return {
    totalEntries: historyCache.keys().length,
    stats: historyCache.getStats(),
  };
}
