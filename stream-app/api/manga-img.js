/**
 * Vercel Serverless Function — Manga image proxy
 * Replicates the Vite dev middleware /manga-img for production.
 * Proxies manga images with required Referer header for CDNs.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url } = req.query;
  if (!url) { res.status(400).send('Missing url'); return; }

  try {
    const response = await fetch(url, {
      headers: { 'Referer': 'https://mangapill.com/' },
    });
    if (!response.ok) throw new Error(`CDN ${response.status}`);

    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).send('Image proxy error');
  }
}
