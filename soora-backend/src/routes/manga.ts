import { Router, Request, Response } from 'express';
import * as consumet from '../services/consumet';
import { cached, cachedSWR, CACHE_TTL } from '../services/cache';
import { parallel, extractResults } from '../utils/normalize';

const qs = (v: any): string => String(v ?? '');

const router = Router();

/**
 * GET /manga/home?lang=en
 * Orchestrated manga home — returns heroItems + sections matching frontend layout.
 */
router.get('/home', async (req: Request, res: Response) => {
  try {
    const lang = String(req.query.lang || 'en');

    const data = await cachedSWR(`manga:home:v2:${lang}`, async () => {
      // Section configs matching frontend POPULAR_QUERIES / KOMIKU_QUERIES
      const SECTION_QUERIES: Record<string, string[]> = lang === 'id'
        ? {
            Trending: ['solo leveling', 'one piece', 'jujutsu kaisen'],
            Action: ['demon slayer', 'naruto', 'chainsaw man'],
            Romance: ['horimiya', 'kaguya sama', 'spy x family'],
            Fantasy: ['mushoku tensei', 'overlord', 'shield hero'],
          }
        : {
            Trending: ['solo leveling', 'one piece', 'jujutsu kaisen'],
            Action: ['demon slayer', 'attack on titan', 'chainsaw man'],
            Romance: ['horimiya', 'kaguya sama', 'my dress up darling'],
            Fantasy: ['mushoku tensei', 'shield hero', 'overlord'],
          };

      const isKomiku = lang === 'id';
      const searchFn = isKomiku
        ? (q: string) => consumet.komikuSearch(q).catch(() => null)
        : (q: string) => consumet.mangaSearch(q, 'mangapill').catch(() => null);

      // Fire ALL queries in parallel (12 total)
      const allEntries: { label: string; query: string }[] = [];
      for (const [label, queries] of Object.entries(SECTION_QUERIES)) {
        for (const q of queries) allEntries.push({ label, query: q });
      }

      const allResults = await parallel(...allEntries.map((e) => searchFn(e.query)));

      // Group results by section label
      const sections: Record<string, any[]> = {};
      const seen = new Set<string>();
      let idx = 0;

      for (const [label, queries] of Object.entries(SECTION_QUERIES)) {
        const items: any[] = [];
        for (const _q of queries) {
          const result = allResults[idx];
          for (const item of extractResults(result)) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              items.push(isKomiku ? { ...item, provider: 'komiku' } : item);
            }
          }
          idx++;
        }
        sections[label] = items;
      }

      // Build hero from Trending (skip novels)
      const heroItems = (sections['Trending'] || [])
        .filter((i: any) => {
          const t = (i.title || '').toLowerCase();
          return !t.includes('novel') && !t.includes('light novel');
        })
        .slice(0, 6);

      return { heroItems, sections };
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
