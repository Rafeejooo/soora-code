/**
 * Vercel Serverless Function — KomikPlus image proxy (fallback)
 * Proxies images from nhentai CDN. Primary loading is done directly in browser
 * via referrerPolicy="no-referrer". This proxy serves as a last-resort fallback.
 * Usage: /api/komikplus-img?url=https://t.nhentai.net/galleries/123/cover.jpg
 */

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Referer': 'https://nhentai.net/',
  'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'same-site',
};

// Try different CDN hosts if the first fails
const CDN_HOSTS = ['7', '5', '3', '2', '1', ''];

async function tryFetch(url) {
  const response = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
  if (!response.ok) throw new Error(`CDN ${response.status}`);
  return response;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url } = req.query;
  if (!url) { res.status(400).send('Missing url'); return; }

  let parsed;
  try {
    parsed = new URL(url);
    if (!parsed.hostname.includes('nhentai.net')) {
      res.status(403).send('Only nhentai CDN URLs allowed');
      return;
    }
  } catch {
    res.status(400).send('Invalid url');
    return;
  }

  // Try the requested URL, then fallback to other CDN hosts
  const prefix = parsed.hostname.startsWith('i') ? 'i' : 't';
  const urlsToTry = [url];
  for (const n of CDN_HOSTS) {
    const altHost = `${prefix}${n}.nhentai.net`;
    if (altHost !== parsed.hostname) {
      const altUrl = `${parsed.protocol}//${altHost}${parsed.pathname}${parsed.search}`;
      urlsToTry.push(altUrl);
    }
  }

  for (const tryUrl of urlsToTry.slice(0, 6)) {
    try {
      const response = await tryFetch(tryUrl);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buffer = Buffer.from(await response.arrayBuffer());
      res.send(buffer);
      return;
    } catch { /* try next host */ }
  }

  res.status(502).send('Image proxy error — all CDN hosts failed');
}
