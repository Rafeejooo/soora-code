import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * GET /proxy?url=...
 * Stream proxy — replicates the Vercel serverless function.
 * Proxies HLS m3u8, VTT, and video segments with required headers.
 */
router.get('/', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '');
  if (!targetUrl) return res.status(400).send('Missing url parameter');

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };

    // Add Referer/Origin based on target domain
    const host = new URL(targetUrl).hostname;
    if (host.includes('megacloud') || host.includes('rapid-cloud')) {
      headers['Referer'] = 'https://megacloud.tv/';
      headers['Origin'] = 'https://megacloud.tv';
    } else if (host.includes('uwucdn') || host.includes('uwu.ai')) {
      headers['Referer'] = 'https://uwucdn.com/';
      headers['Origin'] = 'https://uwucdn.com';
    } else if (host.includes('vizcloud') || host.includes('vidstream')) {
      headers['Referer'] = 'https://vizcloud.co/';
      headers['Origin'] = 'https://vizcloud.co';
    } else if (host.includes('biananset') || host.includes('kerapoxy')) {
      headers['Referer'] = 'https://megacloud.tv/';
      headers['Origin'] = 'https://megacloud.tv';
    }

    const response = await axios.get(targetUrl, {
      headers,
      responseType: 'arraybuffer',
      timeout: 25000,
      maxRedirects: 5,
    });

    const ct = response.headers['content-type'] || '';
    let body = Buffer.from(response.data);

    // If m3u8, rewrite internal URLs to also proxy through us
    if (targetUrl.endsWith('.m3u8') || ct.includes('mpegurl') || ct.includes('apple')) {
      let text = body.toString('utf-8');
      const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      // Use the `base` query param for proxy prefix (sent by VideoPlayer).
      // This ensures m3u8 internal URLs resolve correctly:
      //   - Via Vercel: base=/api/proxy → /api/proxy?url=...
      //   - Via stream.soora.fun: base=https://stream.soora.fun/proxy → full URL
      const proxyBase = String(req.query.base || '/proxy');

      // Rewrite KEY/MAP URIs
      text = text.replace(/URI="([^"]+)"/g, (_match: string, uri: string) => {
        const abs = uri.startsWith('http') ? uri : new URL(uri, base).href;
        return `URI="${proxyBase}?url=${encodeURIComponent(abs)}"`;
      });

      // Rewrite segment/playlist lines
      text = text
        .split('\n')
        .map((line: string) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          const abs = trimmed.startsWith('http') ? trimmed : new URL(trimmed, base).href;
          return `${proxyBase}?url=${encodeURIComponent(abs)}`;
        })
        .join('\n');

      body = Buffer.from(text, 'utf-8');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (targetUrl.endsWith('.vtt') || targetUrl.endsWith('.srt') || ct.includes('text/vtt')) {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    } else {
      res.setHeader('Content-Type', ct || 'application/octet-stream');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(body);
  } catch (err: any) {
    // Retry once with additional headers on 403
    if (err.response?.status === 403) {
      try {
        const retryHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://megacloud.tv/',
          'Origin': 'https://megacloud.tv',
        };
        const retryRes = await axios.get(targetUrl, {
          headers: retryHeaders,
          responseType: 'arraybuffer',
          timeout: 15000,
        });
        res.setHeader('Content-Type', retryRes.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(Buffer.from(retryRes.data));
        return;
      } catch { /* fall through to error */ }
    }
    console.error('[proxy]', err.message);
    res.status(err.response?.status || 502).send('Proxy error');
  }
});

/**
 * GET /manga-img?url=...
 * Manga image proxy with Referer header.
 */
router.get('/manga-img', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '');
  if (!targetUrl) return res.status(400).send('Missing url');

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'Referer': 'https://mangapill.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      responseType: 'arraybuffer',
      timeout: 15000,
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(response.data));
  } catch {
    res.status(502).send('Image proxy error');
  }
});

export default router;
