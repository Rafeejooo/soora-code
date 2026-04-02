import { Router, Request, Response } from 'express';
import { cached, CACHE_TTL } from '../services/cache';
import * as doujindesu from '../services/doujindesu';
import { reportRouteError } from '../services/telegram';

const router = Router();

/**
 * GET /doujindesu/genres
 * List available genres
 */
router.get('/genres', async (req: Request, res: Response) => {
  try {
    const data = await cached('doujindesu:genres', () => doujindesu.doujindesuGenres(), CACHE_TTL.SEARCH * 6);
    res.json(data);
  } catch (err: any) {
    console.error('[doujindesu/genres]', err.message);
    reportRouteError(req, err, 'doujindesu/genres');
    res.status(500).json({ error: 'Failed to load genres' });
  }
});

/**
 * GET /doujindesu/genre/:slug?page=1
 * Browse by genre
 */
router.get('/genre/:slug', async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const page = parseInt(String(req.query.page || '1'), 10);
    const data = await cached(`doujindesu:genre:${slug}:${page}`, () => doujindesu.doujindesuByGenre(slug, page), CACHE_TTL.SEARCH);
    res.json(data);
  } catch (err: any) {
    console.error('[doujindesu/genre]', err.message);
    reportRouteError(req, err, 'doujindesu/genre');
    res.status(500).json({ error: 'Failed to load genre' });
  }
});

/**
 * GET /doujindesu/latest?page=1
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const data = await cached(`doujindesu:latest:${page}`, () => doujindesu.doujindesuLatest(page), CACHE_TTL.SEARCH);
    res.json(data);
  } catch (err: any) {
    console.error('[doujindesu/latest]', err.message);
    reportRouteError(req, err, 'doujindesu/latest');
    res.status(500).json({ error: 'Failed to load latest' });
  }
});

/**
 * GET /doujindesu/search?q=query&page=1
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '');
    const page = parseInt(String(req.query.page || '1'), 10);
    if (!query) return res.status(400).json({ error: 'Missing query' });
    const data = await cached(`doujindesu:search:${query}:${page}`, () => doujindesu.doujindesuSearch(query, page), CACHE_TTL.SEARCH);
    res.json(data);
  } catch (err: any) {
    console.error('[doujindesu/search]', err.message);
    reportRouteError(req, err, 'doujindesu/search');
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /doujindesu/detail/:id
 */
router.get('/detail/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = await cached(`doujindesu:detail:${id}`, () => doujindesu.doujindesuDetail(id), CACHE_TTL.INFO, 'long');
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err: any) {
    console.error('[doujindesu/detail]', err.message);
    reportRouteError(req, err, 'doujindesu/detail');
    res.status(500).json({ error: 'Failed to load detail' });
  }
});

/**
 * GET /doujindesu/read/:chapterId
 */
router.get('/read/:chapterId', async (req: Request, res: Response) => {
  try {
    const chapterId = String(req.params.chapterId);
    const data = await cached(`doujindesu:read:${chapterId}`, () => doujindesu.doujindesuRead(chapterId), CACHE_TTL.MANGA_READ, 'long');
    res.json(data);
  } catch (err: any) {
    console.error('[doujindesu/read]', err.message);
    reportRouteError(req, err, 'doujindesu/read');
    res.status(500).json({ error: 'Failed to load chapter' });
  }
});

/**
 * GET /doujindesu/img?url=...
 * Image proxy for doujindesu CDN images (requires Referer header)
 */
router.get('/img', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '');
  if (!targetUrl) return res.status(400).send('Missing url');
  try {
    const result = await doujindesu.doujindesuProxyImage(targetUrl);
    if (!result) return res.status(502).send('Image proxy error');
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(result.data);
  } catch {
    res.status(502).send('Image proxy error');
  }
});

export default router;
