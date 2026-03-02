/**
 * Utility: run promises in parallel, return results + nulls for failures.
 * Unlike Promise.allSettled, returns clean data array.
 */
export async function parallel<T>(...tasks: Promise<T>[]): Promise<(T | null)[]> {
  const results = await Promise.allSettled(tasks);
  return results.map((r) => (r.status === 'fulfilled' ? r.value : null));
}

/**
 * Normalize anime title for dedup across providers.
 */
export function normalizeForDedup(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .trim()
    .replace(/\s*\((?:dub|sub|dubbed|subbed|tv|ova|ona|special|movie|hd|uncensored|censored|bd)\)/gi, '')
    .replace(/\s*-\s*(dub|sub|dubbed|subbed)$/i, '')
    .replace(/\s*(?:season|part|cour)\s*\d+/gi, '')
    .replace(/\s*\d+(?:st|nd|rd|th)\s+season/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicate anime results from multiple providers.
 */
export function deduplicateAnime(primary: any[], ...others: any[][]): any[] {
  const merged = [...primary];
  const seenNorm = new Set(primary.map((i) => normalizeForDedup(i.title)));
  const seenExact = new Set(primary.map((i) => (i.title || '').toLowerCase().trim()));

  for (const items of others) {
    for (const item of items) {
      const norm = normalizeForDedup(item.title);
      const exact = (item.title || '').toLowerCase().trim();
      if (norm && !seenNorm.has(norm) && !seenExact.has(exact)) {
        seenNorm.add(norm);
        seenExact.add(exact);
        merged.push(item);
      }
    }
  }

  return merged;
}

/**
 * Normalize Goku items to standard format.
 */
export function normalizeGoku(item: any) {
  return {
    id: item.id,
    title: item.title || 'Unknown',
    image: item.image || '',
    type: item.type || 'Movie',
    releaseDate: item.releaseDate || '',
    duration: item.duration || '',
    mediaType: item.type === 'TV Series' ? 'tv' : 'movie',
    season: item.season || '',
    latestEpisode: item.latestEpisode || '',
  };
}

/**
 * Normalize LK21 items to standard format.
 */
export function normalizeLK21(item: any) {
  return {
    id: item._id,
    lk21Id: item._id,
    title: item.title || 'Unknown',
    image: item.posterImg || '',
    type: item.type === 'series' ? 'TV Series' : 'Movie',
    mediaType: item.type === 'series' ? 'tv' : 'movie',
    rating: item.rating || '',
    qualityResolution: item.qualityResolution || '',
    genres: item.genres || [],
    episode: item.episode || null,
    provider: 'lk21',
  };
}

/**
 * Normalize manga title (handle MangaPill concatenation bug).
 */
export function normalizeMangaTitle(title: any): string {
  if (!title) return 'Unknown';
  if (typeof title !== 'string') {
    return title.english || title.romaji || title.userPreferred || title.native || 'Unknown';
  }
  const idx = title.search(/[a-z][A-Z]/);
  if (idx !== -1 && idx >= 2 && title.length - idx - 1 >= 4) {
    return title.slice(0, idx + 1);
  }
  return title;
}

/**
 * Safe array extraction from different API response shapes.
 */
export function extractResults(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data?.results)) return data.data.results;
  return [];
}
