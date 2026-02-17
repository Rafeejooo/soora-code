/**
 * Vercel Serverless Function — KomikPlus API proxy
 * Proxies requests to the nhentai API with proper headers to avoid CORS.
 * Routes:
 *   /api/komikplus?action=home&page=1
 *   /api/komikplus?action=search&query=xxx&page=1
 *   /api/komikplus?action=book&id=123
 *   /api/komikplus?action=related&id=123
 *   /api/komikplus?action=tagged&tagId=1&page=1&sort=popular
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action, page, query, id, tagId, sort } = req.query;
  if (!action) { res.status(400).json({ error: 'Missing action parameter' }); return; }

  const API_ROOT = 'https://nhentai.net';
  let url;

  switch (action) {
    case 'home':
      url = `${API_ROOT}/api/galleries/all?page=${page || 1}`;
      break;
    case 'search':
      if (!query) { res.status(400).json({ error: 'Missing query parameter' }); return; }
      url = `${API_ROOT}/api/galleries/search?query=${encodeURIComponent(query)}&page=${page || 1}${sort ? `&sort=${sort}` : ''}`;
      break;
    case 'book':
      if (!id) { res.status(400).json({ error: 'Missing id parameter' }); return; }
      url = `${API_ROOT}/api/gallery/${id}`;
      break;
    case 'related':
      if (!id) { res.status(400).json({ error: 'Missing id parameter' }); return; }
      url = `${API_ROOT}/api/gallery/${id}/related`;
      break;
    case 'tagged':
      if (!tagId) { res.status(400).json({ error: 'Missing tagId parameter' }); return; }
      url = `${API_ROOT}/api/galleries/tagged?tag_id=${tagId}&page=${page || 1}${sort === 'popular' ? '&sort=popular' : ''}`;
      break;
    default:
      res.status(400).json({ error: `Unknown action: ${action}` });
      return;
  }

  const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://nhentai.net/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };

  // Retry up to 3 times with delay for CF 403
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 600 * attempt));
      const response = await fetch(url, { headers: API_HEADERS });
      if (response.status === 403 && attempt < 2) continue; // CF challenge, retry
      if (!response.ok) {
        res.status(response.status).json({ error: `Upstream error ${response.status}` });
        return;
      }
      const data = await response.json();
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).json(data);
      return;
    } catch (e) {
      if (attempt >= 2) {
        res.status(502).json({ error: 'KomikPlus proxy error', message: e.message });
        return;
      }
    }
  }
}
