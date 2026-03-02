import { Router, Request, Response } from 'express';
import * as consumet from '../services/consumet';
import { cached, cachedSWR, CACHE_TTL } from '../services/cache';
import { parallel, extractResults } from '../utils/normalize';

const qs = (v: any): string => String(v ?? '');

const router = Router();

/**
 * GET /manga/home?lang=en
 * Orchestrated manga home: MangaPill popular + Komiku trending.
 */
router.get('/home', async (req: Request, res: Response) => {
  try {
    const lang = String(req.query.lang || 'en');

    const data = await cachedSWR(`manga:home:${lang}`, async () => {
      // Popular manga via search (MangaPill doesn't have a trending endpoint)
      const popularQueries = ['one piece', 'naruto', 'demon slayer', 'jujutsu kaisen', 'solo leveling', 'attack on titan'];
      const randomQueries = popularQueries.sort(() => Math.random() - 0.5).slice(0, 3);

      const [komikuTrend, ...searchResults] = await parallel(
        consumet.komikuTrending().catch(() => null),
        ...randomQueries.map((q) => consumet.mangaSearch(q, 'mangapill').catch(() => null)),
      );

      // Deduplicate popular results
      const allPopular: any[] = [];
      const seen = new Set<string>();
      for (const result of searchResults) {
        for (const item of extractResults(result)) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            allPopular.push(item);
          }
        }
      }

      return {
        popular: allPopular,
        komikuTrending: extractResults(komikuTrend),
      };
    }, CACHE_TTL.HOME_BUNDLE);

    res.json(data);
  } catch (err: any) {
    console.error('[manga/home]', err.message);
    res.status(500).json({ error: 'Failed to load manga home' });
  }
});

/**
 * GET /manga/info/:id?provider=mangapill&lang=en
 */
router.get('/info/:id', async (req: Request, res: Response) => {
  try {
    const id = qs(req.params.id);
    const provider = qs(req.query.provider) || 'mangapill';
    const lang2 = qs(req.query.lang) || 'en';

    const cacheKey = `manga:info:${provider}:${id}:${lang2}`;
    const data = await cached(cacheKey, () => {
      const params: Record<string, any> = {};
      if (provider === 'mangadex') params.lang = lang2;
      return consumet.mangaInfo(id, provider, params);
    }, CACHE_TTL.INFO, 'long');

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load manga info' });
  }
});

/**
 * GET /manga/read/:chapterId?provider=mangapill
 */
router.get('/read/:chapterId', async (req: Request, res: Response) => {
  try {
    const chapterId = qs(req.params.chapterId);
    const provider = qs(req.query.provider) || 'mangapill';

    const data = await cached(
      `manga:read:${provider}:${chapterId}`,
      () => consumet.mangaRead(chapterId, provider),
      CACHE_TTL.MANGA_READ, 'long'
    );

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load chapter' });
  }
});

/**
 * GET /manga/search?q=query&provider=mangapill&page=1
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = qs(req.query.q);
    const provider = qs(req.query.provider) || 'mangapill';

    if (!query) return res.status(400).json({ error: 'Missing query' });

    const data = await cached(`manga:search:${provider}:${query}`, async () => {
      if (provider === 'all') {
        // Multi-provider search
        const [pillRes, dexRes, komikuRes] = await parallel(
          consumet.mangaSearch(query, 'mangapill'),
          consumet.mangaSearch(query, 'mangadex'),
          consumet.komikuSearch(query),
        );
        return {
          mangapill: extractResults(pillRes),
          mangadex: extractResults(dexRes),
          komiku: extractResults(komikuRes),
        };
      }
      if (provider === 'komiku') {
        return consumet.komikuSearch(query);
      }
      return consumet.mangaSearch(query, provider);
    }, CACHE_TTL.SEARCH);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /manga/komiku/trending
 */
router.get('/komiku/trending', async (_req: Request, res: Response) => {
  try {
    const data = await cached('manga:komiku:trending', () => consumet.komikuTrending(), CACHE_TTL.GENRE);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load Komiku trending' });
  }
});

/**
 * GET /manga/komiku/info/:id
 */
router.get('/komiku/info/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`manga:komiku:info:${req.params.id}`,
      () => consumet.komikuInfo(qs(req.params.id)), CACHE_TTL.INFO, 'long');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get Komiku info' });
  }
});

/**
 * GET /manga/komiku/read/:chapterId
 */
router.get('/komiku/read/:chapterId', async (req: Request, res: Response) => {
  try {
    const data = await cached(`manga:komiku:read:${req.params.chapterId}`,
      () => consumet.komikuRead(qs(req.params.chapterId)), CACHE_TTL.MANGA_READ, 'long');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read Komiku chapter' });
  }
});

// ========== CATCH-ALL: Forward unmatched /manga/* to Consumet ==========
router.all('/*', async (req: Request, res: Response) => {
  try {
    const data = await consumet.passthrough(`/manga${req.path}`, req.query as Record<string, any>);
    res.json(data);
  } catch (err: any) {
    const status = err.response?.status || 502;
    const message = err.response?.data || { error: 'Upstream error' };
    res.status(status).json(message);
  }
});

export default router;
