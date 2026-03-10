import { Router, Request, Response } from 'express';
import { cached, CACHE_TTL } from '../services/cache';

const router = Router();

const API_ROOT = 'https://nhentai.net';

const API_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://nhentai.net/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

async function fetchNhentai(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt));
    const response = await fetch(url, { headers: API_HEADERS });
    if (response.status === 403 && attempt < retries - 1) continue;
    if (!response.ok) throw new Error(`Upstream error ${response.status}`);
    return response.json();
  }
  throw new Error('All retries exhausted');
}

/**
 * GET /komikplus?action=home&page=1
 * GET /komikplus?action=search&query=xxx&page=1&sort=popular
 * GET /komikplus?action=book&id=123
 * GET /komikplus?action=related&id=123
 * GET /komikplus?action=tagged&tagId=1&page=1&sort=popular
 */
router.get('/', async (req: Request, res: Response) => {
  const { action, page, query, id, tagId, sort } = req.query;
  if (!action) return res.status(400).json({ error: 'Missing action parameter' });

  let url: string;

  switch (action) {
    case 'home':
      url = `${API_ROOT}/api/galleries/all?page=${page || 1}`;
      break;
    case 'search':
      if (!query) return res.status(400).json({ error: 'Missing query parameter' });
      url = `${API_ROOT}/api/galleries/search?query=${encodeURIComponent(String(query))}&page=${page || 1}${sort ? `&sort=${sort}` : ''}`;
      break;
    case 'book':
      if (!id) return res.status(400).json({ error: 'Missing id parameter' });
      url = `${API_ROOT}/api/gallery/${id}`;
      break;
    case 'related':
      if (!id) return res.status(400).json({ error: 'Missing id parameter' });
      url = `${API_ROOT}/api/gallery/${id}/related`;
      break;
    case 'tagged':
      if (!tagId) return res.status(400).json({ error: 'Missing tagId parameter' });
      url = `${API_ROOT}/api/galleries/tagged?tag_id=${tagId}&page=${page || 1}${sort === 'popular' ? '&sort=popular' : ''}`;
      break;
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  const cacheKey = `komikplus:${action}:${id || tagId || query || ''}:${page || 1}:${sort || ''}`;

  try {
    const data = await cached(cacheKey, () => fetchNhentai(url), CACHE_TTL.SEARCH);
    res.json(data);
  } catch (err: any) {
    console.error('[komikplus]', err.message);
    res.status(502).json({ error: 'KomikPlus proxy error', message: err.message });
  }
});

/**
 * GET /komikplus/img?url=...
 * Image proxy for nhentai CDN images (last-resort fallback)
 */
router.get('/img', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '');
  if (!targetUrl) return res.status(400).send('Missing url');

  // Only allow nhentai CDN domains
  try {
    const parsed = new URL(targetUrl);
    if (!parsed.hostname.endsWith('nhentai.net')) {
      return res.status(400).send('Invalid domain');
    }
  } catch {
    return res.status(400).send('Invalid URL');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': API_HEADERS['User-Agent'],
        'Referer': 'https://nhentai.net/',
      },
    });
    if (!response.ok) return res.status(response.status).send('Upstream error');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  } catch {
    res.status(502).send('Image proxy error');
  }
});

export default router;
