import { Router, Request, Response } from 'express';
import * as consumet from '../services/consumet';
import { cached, cachedSWR, CACHE_TTL } from '../services/cache';
import { parallel, deduplicateAnime, extractResults } from '../utils/normalize';

const qs = (v: any): string => String(v ?? '');

const router = Router();

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
router.get('/home', async (_req: Request, res: Response) => {
  try {
    const data = await cachedSWR('anime:home', async () => {
      // Run ALL calls in parallel (core + genres) — no sequential phases
      const genrePromises = GENRE_SECTIONS.map((genre) =>
        consumet.animeByGenre(genre, 1, 'hianime')
          .catch(() => consumet.animeByGenre(genre, 1, 'animekai').catch(() => null))
      );

      const [spotlight, recentEps, mostPopular, topAiring, ...genreResults] = await parallel(
        consumet.animeSpotlight('animekai').catch(() => consumet.animeSpotlight('hianime')),
        consumet.animeRecentEpisodes(1, 'animekai')
          .then((d) => (extractResults(d).length > 0 ? d : null))
          .catch(() => consumet.passthrough('/anime/hianime/recently-updated', { page: 1 }).catch(() => null)),
        consumet.animeMostPopular(1),
        consumet.animeTopAiring(1),
        ...genrePromises,
      );

      const genres: Record<string, any[]> = {};
      GENRE_SECTIONS.forEach((genre, i) => {
        const items = extractResults(genreResults[i]);
        genres[genre] = items.slice(0, 24);
      });

      return {
        spotlight: extractResults(spotlight),
        recentEpisodes: extractResults(recentEps),
        mostPopular: extractResults(mostPopular),
        topAiring: extractResults(topAiring),
        genres,
      };
    }, CACHE_TTL.HOME_BUNDLE);

    res.json(data);
  } catch (err: any) {
    console.error('[anime/home]', err.message);
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
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /anime/watch/:episodeId?server=&category=&epNumber=
 * Fallback chain: AnimeKai → HiAnime → AnimePahe (all server-side).
 */
router.get('/watch/:episodeId', async (req: Request, res: Response) => {
  try {
    const episodeId = qs(req.params.episodeId);
    const server = qs(req.query.server);
    const category = qs(req.query.category);
    const epNumber = qs(req.query.epNumber);

    const data = await cached(`anime:watch:${episodeId}:${server}:${category}`, async () => {
      // 1) Try AnimeKai
      try {
        const result = await consumet.animeWatch(episodeId, 'animekai', { ...(server && { server }), ...(category && { category }) });
        if (result?.sources?.length > 0) return result;
      } catch { /* continue */ }

      // Extract slug and ep number for fallback
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

      // 2) Try HiAnime
      try {
        const searchRes = await consumet.animeSearch(searchQuery, 1, 'hianime');
        const results = extractResults(searchRes);
        if (results.length > 0) {
          const infoRes = await consumet.animeInfo(results[0].id, 'hianime');
          const eps = infoRes?.episodes || [];
          const targetEp = eps.find((e: any) => e.number === epNum) || eps[epNum - 1] || eps[0];
          if (targetEp) {
            const watchRes = await consumet.animeWatch(targetEp.id, 'hianime');
            if (watchRes?.sources?.length > 0) {
              return { ...watchRes, _fallback: 'hianime' };
            }
          }
        }
      } catch { /* continue */ }

      // 3) Try AnimePahe
      try {
        const searchRes = await consumet.animeSearch(searchQuery, 1, 'animepahe');
        const results = extractResults(searchRes);
        if (results.length > 0) {
          const infoRes = await consumet.animeInfo(results[0].id, 'animepahe');
          const eps = infoRes?.episodes || [];
          const targetEp = eps.find((e: any) => e.number === epNum) || eps[epNum - 1] || eps[0];
          if (targetEp) {
            const watchRes = await consumet.animeWatch(targetEp.id, 'animepahe');
            if (watchRes?.sources?.length > 0) {
              return { ...watchRes, _fallback: 'animepahe' };
            }
          }
        }
      } catch { /* final fallback failed */ }

      return { error: 'Stream unavailable on all providers', sources: [] };
    }, CACHE_TTL.STREAM);

    res.json(data);
  } catch (err: any) {
    console.error('[anime/watch]', err.message);
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
