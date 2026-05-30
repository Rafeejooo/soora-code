import { Router, Request, Response } from 'express';
import * as consumet from '../services/consumet';
import { cached, cachedSWR, CACHE_TTL, shortCache } from '../services/cache';
import { parallel, deduplicateAnime, extractResults } from '../utils/normalize';
import { markAvailability, filterAvailable } from '../services/availability';
import { reportRouteError } from '../services/telegram';

const qs = (v: any): string => String(v ?? '');

const router = Router();

// ========== SUB INDO (Samehadaku via sankavollerei) PROXY ==========
// Frontend hit sankavollerei directly → slow + anti-bot from user IPs.
// Proxy through the VPS (fast path + server-side cache) instead.
import axios from 'axios';
const SAMEHADAKU = 'https://www.sankavollerei.com/anime/samehadaku';
const shClient = axios.create({
  baseURL: SAMEHADAKU,
  timeout: 20000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
});

const shGet = async (path: string) => {
  const res = await shClient.get(path);
  return res.data?.data ?? res.data ?? null;
};

// Home bundle (ongoing + popular + recent) — single cached call
router.get('/subindo/home', async (req: Request, res: Response) => {
  try {
    const data = await cachedSWR('subindo:home', async () => {
      const [ongoing, popular, recent, home] = await parallel(
        shGet('/ongoing').catch(() => null),
        shGet('/popular').catch(() => null),
        shGet('/recent').catch(() => null),
        shGet('/home').catch(() => null),
      );
      const list = (d: any) => (d?.animeList || (Array.isArray(d) ? d : []));
      const top10 = home?.top10?.animeList || home?.top10 || [];
      return { ongoing: list(ongoing), popular: list(popular), recent: list(recent), top10 };
    }, CACHE_TTL.HOME_BUNDLE);
    res.json(data);
  } catch (err: any) {
    reportRouteError(req, err, 'subindo/home');
    res.json({ ongoing: [], popular: [], recent: [] });
  }
});

// Genre listing proxy
router.get('/subindo/genre/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`subindo:genre:${req.params.id}`, () => shGet(`/genres/${req.params.id}`), CACHE_TTL.HOME_BUNDLE);
    res.json(data || { animeList: [] });
  } catch (err: any) {
    reportRouteError(req, err, 'subindo/genre');
    res.json({ animeList: [] });
  }
});

// Themed home sections — curated, non-generic. One cached call builds them all.
const SUBINDO_SECTIONS = [
  { key: 'suka',     title: 'Mungkin Kamu Suka',          genres: ['fantasy', 'adventure'] },
  { key: 'aksi',     title: 'Aksi Tanpa Henti',           genres: ['action', 'super-power'] },
  { key: 'isekai',   title: 'Menjelajah ke Dunia Lain',   genres: ['isekai', 'reincarnation'] },
  { key: 'hangat',   title: 'Hangat di Hati',             genres: ['slice-of-life', 'comedy'] },
  { key: 'pilihan',  title: 'Karya Pilihan',              genres: ['seinen', 'drama'] },
  { key: 'misteri',  title: 'Penuh Misteri & Tegang',     genres: ['mystery', 'supernatural'] },
  { key: 'sekolah',  title: 'Cerita Masa Sekolah',        genres: ['school', 'romance'] },
];

router.get('/subindo/sections', async (req: Request, res: Response) => {
  try {
    const data = await cachedSWR('subindo:sections', async () => {
      // Fetch each section's genres in parallel, dedup, cap 18 per section
      const out: Record<string, any[]> = {};
      const seenGlobal = new Set<string>();
      await Promise.all(SUBINDO_SECTIONS.map(async (sec) => {
        const lists = await Promise.all(
          sec.genres.map((g) => shGet(`/genres/${g}`).then((d: any) => d?.animeList || []).catch(() => []))
        );
        const merged: any[] = [];
        const seen = new Set<string>();
        for (const list of lists) {
          for (const a of list) {
            const id = a.animeId || a.id;
            if (id && !seen.has(id)) { seen.add(id); merged.push(a); }
          }
        }
        out[sec.key] = merged.slice(0, 18);
      }));
      return { sections: SUBINDO_SECTIONS.map((s) => ({ key: s.key, title: s.title })), data: out };
    }, CACHE_TTL.HOME_BUNDLE);
    res.json(data);
  } catch (err: any) {
    reportRouteError(req, err, 'subindo/sections');
    res.json({ sections: [], data: {} });
  }
});

router.get('/subindo/search', async (req: Request, res: Response) => {
  try {
    const q = qs(req.query.q);
    if (!q) return res.json({ animeList: [] });
    const data = await cached(`subindo:search:${q}`, () => shGet(`/search?q=${encodeURIComponent(q)}`), CACHE_TTL.SEARCH);
    res.json(data || { animeList: [] });
  } catch (err: any) {
    reportRouteError(req, err, 'subindo/search');
    res.json({ animeList: [] });
  }
});

router.get('/subindo/anime/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`subindo:info:${req.params.id}`, () => shGet(`/anime/${req.params.id}`), CACHE_TTL.INFO);
    res.json(data || {});
  } catch (err: any) {
    reportRouteError(req, err, 'subindo/anime');
    res.status(502).json({ error: 'fetch failed' });
  }
});

router.get('/subindo/episode/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`subindo:ep:${req.params.id}`, () => shGet(`/episode/${req.params.id}`), CACHE_TTL.STREAM);
    res.json(data || {});
  } catch (err: any) {
    reportRouteError(req, err, 'subindo/episode');
    res.status(502).json({ error: 'fetch failed' });
  }
});

router.get('/subindo/server/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`subindo:srv:${req.params.id}`, () => shGet(`/server/${req.params.id}`), CACHE_TTL.STREAM);
    res.json(data || {});
  } catch (err: any) {
    reportRouteError(req, err, 'subindo/server');
    res.status(502).json({ error: 'fetch failed' });
  }
});

// ========== GENRE CONFIG (matches frontend) ==========
const GENRE_SECTIONS = [
  'action', 'romance', 'slice-of-life', 'fantasy', 'comedy', 'adventure',
  'sci-fi', 'drama', 'mystery', 'horror', 'sports', 'music',
];

/**
 * GET /anime/home
 * Orchestrated home page — 1 request replaces 16+ frontend calls.
 * Returns: { spotlight, recentEpisodes, mostPopular, topAiring, genres: { action: [...], ... } }
 */
router.get('/home', async (req: Request, res: Response) => {
  try {
    const data = await cachedSWR('anime:home', async () => {
      // Run ALL calls in parallel (core + genres) — no sequential phases
      const genrePromises = GENRE_SECTIONS.map((genre) =>
        consumet.animeByGenre(genre, 1, 'hianime')
          .catch(() => consumet.animeByGenre(genre, 1, 'animekai').catch(() => null))
      );

      const [spotlight, recentEps, mostPopular, topAiring, ...genreResults] = await parallel(
        consumet.animeSpotlight('animekai')
          .catch(() => consumet.animeSpotlight('hianime'))
          .catch(() => null),
        consumet.animeRecentEpisodes(1, 'animekai')
          .then((d) => (extractResults(d).length > 0 ? d : null))
          .catch(() => consumet.passthrough('/anime/hianime/recently-updated', { page: 1 }).catch(() => null)),
        consumet.animeMostPopular(1)
          .catch(() => consumet.passthrough('/anime/animekai/most-popular', { page: 1 }).catch(() => null)),
        consumet.animeTopAiring(1)
          .catch(() => consumet.passthrough('/anime/animekai/top-airing', { page: 1 }).catch(() => null)),
        ...genrePromises,
      );

      // Filter out anime that clearly can't be watched (not yet aired, no ID)
      const NON_PLAYABLE_STATUSES = ['not yet aired', 'upcoming', 'not_yet_aired'];
      const isPlayable = (item: any) => {
        if (!item?.id) return false;
        const status = (item.status || '').toLowerCase().trim();
        if (NON_PLAYABLE_STATUSES.some((s) => status.includes(s))) return false;
        return true;
      };
      const filterPlayable = (items: any[]) => items.filter(isPlayable);

      const genres: Record<string, any[]> = {};
      GENRE_SECTIONS.forEach((genre, i) => {
        const items = extractResults(genreResults[i]);
        genres[genre] = filterPlayable(items).slice(0, 24);
      });

      return {
        spotlight: filterAvailable('anime', filterPlayable(extractResults(spotlight))),
        recentEpisodes: filterAvailable('anime', filterPlayable(extractResults(recentEps))),
        mostPopular: filterAvailable('anime', filterPlayable(extractResults(mostPopular))),
        topAiring: filterAvailable('anime', filterPlayable(extractResults(topAiring))),
        genres,
      };
    }, CACHE_TTL.HOME_BUNDLE, (d: any) => {
      // Don't cache if all sections are empty (all providers failed)
      const total = (d.spotlight?.length || 0) + (d.recentEpisodes?.length || 0) +
        (d.mostPopular?.length || 0) + (d.topAiring?.length || 0);
      return total > 0;
    });

    res.json(data);
  } catch (err: any) {
    console.error('[anime/home]', err.message);
    reportRouteError(req, err, 'anime/home');
    res.status(500).json({ error: 'Failed to load anime home' });
  }
});

/**
 * GET /anime/info/:id
 * Orchestrated info — merges AnimeKai + HiAnime in parallel.
 * Returns: { ...mergedInfo, malId, alId }
 */
router.get('/info/:id', async (req: Request, res: Response) => {
  try {
    const id = qs(req.params.id);
    const data = await cached(`anime:info:${id}`, async () => {
      const [ankaiInfo, hiInfo] = await parallel(
        consumet.animeInfo(id, 'animekai'),
        consumet.animeInfo(id, 'hianime'),
      );

      const hasValidAnkai = ankaiInfo?.title && (ankaiInfo.episodes?.length > 0 || ankaiInfo.totalEpisodes > 0);
      const merged = hasValidAnkai ? ankaiInfo : (hiInfo || ankaiInfo);

      // Extract MAL/AL IDs from HiAnime
      let malId = hiInfo?.malID || null;
      let alId = hiInfo?.alID || null;

      // If no IDs from HiAnime, try Jikan as last resort
      if (!malId && merged?.title) {
        try {
          const axios = (await import('axios')).default;
          const title = merged.title?.english || merged.title?.romaji || merged.title?.userPreferred || merged.title || '';
          const jikanRes = await axios.get('https://api.jikan.moe/v4/anime', {
            params: { q: title, limit: 1, sfw: true },
            timeout: 5000,
          });
          malId = jikanRes.data?.data?.[0]?.mal_id || null;
        } catch { /* skip */ }
      }

      return { ...merged, malId, alId };
    }, CACHE_TTL.INFO, 'long');

    if (!data || (!data.title && !data.description)) {
      return res.status(404).json({ error: 'Anime not found' });
    }
    res.json(data);
  } catch (err: any) {
    console.error('[anime/info]', err.message);
    reportRouteError(req, err, 'anime/info');
    res.status(500).json({ error: 'Failed to load anime info' });
  }
});

/**
 * GET /anime/search?q=query&page=1
 * Multi-provider search with server-side dedup.
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = qs(req.query.q);
    const page = parseInt(qs(req.query.page) || '1');
    if (!query) return res.status(400).json({ error: 'Missing query parameter q' });

    const data = await cached(`anime:search:${query}:${page}`, async () => {
      const [ankaiRes, hiRes, paheRes] = await parallel(
        consumet.animeSearch(query, page, 'animekai'),
        consumet.animeSearch(query, page, 'hianime'),
        consumet.animeSearch(query, 1, 'animepahe'),
      );

      const ankaiItems = extractResults(ankaiRes);
      const hiItems = extractResults(hiRes);
      const paheItems = extractResults(paheRes);

      const merged = deduplicateAnime(ankaiItems, hiItems, paheItems);

      return {
        results: merged,
        currentPage: ankaiRes?.currentPage || page,
        hasNextPage: ankaiRes?.hasNextPage || false,
      };
    }, CACHE_TTL.SEARCH);

    res.json(data);
  } catch (err: any) {
    console.error('[anime/search]', err.message);
    reportRouteError(req, err, 'anime/search');
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /anime/watch/:episodeId?server=&category=&epNumber=
 * Fallback chain: AnimeKai → HiAnime → AnimePahe (all server-side).
 * Does NOT cache empty/failed results.
 */
router.get('/watch/:episodeId', async (req: Request, res: Response) => {
  try {
    const episodeId = qs(req.params.episodeId);
    const server = qs(req.query.server);
    const category = qs(req.query.category);
    const epNumber = qs(req.query.epNumber);
    const cacheKey = `anime:watch:${episodeId}:${server}:${category}`;

    // Check cache first — only return cached data if it has valid sources
    const cachedData = shortCache.get<any>(cacheKey);
    if (cachedData?.sources?.length > 0) {
      return res.json(cachedData);
    }

    // 1) Try AnimeKai directly (fastest path)
    try {
      const result = await consumet.animeWatch(episodeId, 'animekai', { ...(server && { server }), ...(category && { category }) });
      if (result?.sources?.length > 0) {
        shortCache.set(cacheKey, result, CACHE_TTL.STREAM);
        markAvailability('anime', episodeId.split('$')[0], true);
        return res.json(result);
      }
    } catch { /* continue */ }

    // Extract slug and ep number for fallback providers
    const slugMatch = episodeId.match(/^(.+?)(?:\$|$)/);
    const epMatch = episodeId.match(/\$ep=(\d+)/);
    const epNum = epNumber ? parseInt(String(epNumber)) : (epMatch ? parseInt(epMatch[1]) : 1);
    const slug = slugMatch ? slugMatch[1] : '';
    const searchQuery = slug
      .replace(/-(dub|sub|raw|eng|jpn)$/i, '')
      .replace(/-\d+$/, '')
      .replace(/-\w{2,5}$/, '')
      .replace(/-/g, ' ')
      .trim();

    // 2) Try HiAnime + AnimePahe in PARALLEL (not sequential — saves ~10s)
    const tryProvider = async (provider: string): Promise<any> => {
      const searchRes = await consumet.animeSearch(searchQuery, 1, provider);
      const results = extractResults(searchRes);
      if (results.length === 0) return null;
      const infoRes = await consumet.animeInfo(results[0].id, provider);
      const eps = infoRes?.episodes || [];
      const targetEp = eps.find((e: any) => e.number === epNum) || eps[epNum - 1] || eps[0];
      if (!targetEp) return null;
      const watchRes = await consumet.animeWatch(targetEp.id, provider);
      if (watchRes?.sources?.length > 0) return { ...watchRes, _fallback: provider };
      return null;
    };

    const [hiResult, paheResult] = await parallel(
      tryProvider('hianime').catch(() => null),
      tryProvider('animepahe').catch(() => null),
    );

    const fallbackResult = hiResult || paheResult;
    if (fallbackResult) {
      shortCache.set(cacheKey, fallbackResult, CACHE_TTL.STREAM);
      markAvailability('anime', episodeId.split('$')[0], true);
      return res.json(fallbackResult);
    }

    // All providers failed — mark unavailable, do NOT cache this
    markAvailability('anime', episodeId.split('$')[0], false);
    res.json({ error: 'All providers failed', sources: [] });
  } catch (err: any) {
    console.error('[anime/watch]', err.message);
    reportRouteError(req, err, 'anime/watch');
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

/**
 * GET /anime/servers/:episodeId
 */
router.get('/servers/:episodeId', async (req: Request, res: Response) => {
  try {
    const data = await consumet.animeServers(qs(req.params.episodeId));
    res.json(data);
  } catch (err: any) {
    reportRouteError(req, err, 'anime/servers');
    res.status(500).json({ error: 'Failed to get servers' });
  }
});

/**
 * GET /anime/genre/:genre?page=1
 */
router.get('/genre/:genre', async (req: Request, res: Response) => {
  try {
    const genre = qs(req.params.genre);
    const page = parseInt(qs(req.query.page) || '1');

    const data = await cached(`anime:genre:${genre}:${page}`, async () => {
      try {
        const result = await consumet.animeByGenre(genre, page, 'hianime');
        if (extractResults(result).length > 0) return result;
      } catch { /* fallback */ }
      return consumet.animeByGenre(genre, page, 'animekai');
    }, CACHE_TTL.GENRE);

    res.json(data);
  } catch (err: any) {
    reportRouteError(req, err, 'anime/genre');
    res.status(500).json({ error: 'Failed to load genre' });
  }
});

/**
 * GET /anime/filter?type=&season=&year=&genres=&sort=&page=
 */
router.get('/filter', async (req: Request, res: Response) => {
  try {
    const type = qs(req.query.type);
    const season = qs(req.query.season);
    const genres = qs(req.query.genres);
    const year = qs(req.query.year);
    const sort = qs(req.query.sort);
    const page = qs(req.query.page) || '1';
    const params: Record<string, any> = { page: parseInt(page) };
    if (type) params.type = type;
    if (season) params.season = season;
    if (genres) params.genres = genres;
    if (sort) params.sort = sort;
    if (year) {
      const seasonStartMonth: Record<string, string> = { winter: '01', spring: '04', summer: '07', fall: '10' };
      const seasonEndMonth: Record<string, string> = { winter: '03', spring: '06', summer: '09', fall: '12' };
      if (season && seasonStartMonth[season]) {
        params.startDate = `${year}-${seasonStartMonth[season]}-01`;
        params.endDate = `${year}-${seasonEndMonth[season]}-28`;
      } else {
        params.startDate = `${year}-01-01`;
        params.endDate = `${year}-12-31`;
      }
    }

    const cacheKey = `anime:filter:${JSON.stringify(params)}`;
    const data = await cached(cacheKey, () => consumet.animeAdvancedSearch(params), CACHE_TTL.SEARCH);
    res.json(data);
  } catch (err: any) {
    reportRouteError(req, err, 'anime/filter');
    res.status(500).json({ error: 'Filter failed' });
  }
});

// ========== CATCH-ALL: Forward unmatched /anime/* to Consumet ==========
router.all('/*', async (req: Request, res: Response) => {
  try {
    const data = await consumet.passthrough(`/anime${req.path}`, req.query as Record<string, any>);
    res.json(data);
  } catch (err: any) {
    const status = err.response?.status || 502;
    const message = err.response?.data || { error: 'Upstream error' };
    res.status(status).json(message);
  }
});

export default router;
