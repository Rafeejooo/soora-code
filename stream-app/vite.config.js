import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // Manga image proxy — CDN requires Referer: https://mangapill.com/
    {
      name: 'manga-image-proxy',
      configureServer(server) {
        server.middlewares.use('/manga-img', async (req, res) => {
          const params = new URL(req.url, 'http://localhost').searchParams;
          const url = params.get('url');
          if (!url) { res.statusCode = 400; res.end('Missing url'); return; }
          try {
            const response = await fetch(url, {
              headers: { 'Referer': 'https://mangapill.com/' },
            });
            if (!response.ok) throw new Error(`CDN ${response.status}`);
            res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            const buffer = await response.arrayBuffer();
            res.end(Buffer.from(buffer));
          } catch {
            res.statusCode = 502;
            res.end('Image proxy error');
          }
        });
      },
    },
    // Stream proxy — forwards HLS m3u8/ts/key requests with required Referer & Origin
    // KomikPlus IMAGE proxy — must register BEFORE the API proxy
    // because Connect mount paths match prefixes, and /api/komikplus
    // would catch /api/komikplus-img requests otherwise.
    {
      name: 'komikplus-img-proxy',
      configureServer(server) {
        server.middlewares.use('/api/komikplus-img', async (req, res) => {
          const params = new URL(req.url, 'http://localhost').searchParams;
          const url = params.get('url');
          if (!url) { res.statusCode = 400; res.end('Missing url'); return; }

          const BROWSER_HEADERS = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://nhentai.net/',
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-site',
          };

          let parsed;
          try { parsed = new URL(url); } catch { res.statusCode = 400; res.end('Invalid url'); return; }
          const prefix = parsed.hostname.startsWith('i') ? 'i' : 't';
          const CDN_NUMS = ['7', '5', '3', '2', '1', ''];
          const urlsToTry = [url];
          for (const n of CDN_NUMS) {
            const altHost = `${prefix}${n}.nhentai.net`;
            if (altHost !== parsed.hostname) {
              urlsToTry.push(`${parsed.protocol}//${altHost}${parsed.pathname}${parsed.search}`);
            }
          }

          for (const tryUrl of urlsToTry.slice(0, 6)) {
            try {
              const response = await fetch(tryUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
              if (!response.ok) continue;
              res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.setHeader('Access-Control-Allow-Origin', '*');
              const buffer = await response.arrayBuffer();
              res.end(Buffer.from(buffer));
              return;
            } catch { /* try next */ }
          }
          res.statusCode = 502;
          res.end('All CDN hosts failed');
        });
      },
    },
    // KomikPlus API proxy (JSON data only)
    {
      name: 'komikplus-api-proxy',
      configureServer(server) {
        server.middlewares.use('/api/komikplus', async (req, res) => {
          const params = new URL(req.url, 'http://localhost').searchParams;
          const action = params.get('action');
          if (!action) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing action' })); return; }

          const API_ROOT = 'https://nhentai.net';
          let url;
          const page = params.get('page') || '1';
          const query = params.get('query');
          const id = params.get('id');
          const tagId = params.get('tagId');
          const sort = params.get('sort');

          switch (action) {
            case 'home':  url = `${API_ROOT}/api/galleries/all?page=${page}`; break;
            case 'search': url = `${API_ROOT}/api/galleries/search?query=${encodeURIComponent(query || '')}&page=${page}${sort ? `&sort=${sort}` : ''}`; break;
            case 'book':   url = `${API_ROOT}/api/gallery/${id}`; break;
            case 'related': url = `${API_ROOT}/api/gallery/${id}/related`; break;
            case 'tagged':  url = `${API_ROOT}/api/galleries/tagged?tag_id=${tagId}&page=${page}${sort === 'popular' ? '&sort=popular' : ''}`; break;
            default:
              res.statusCode = 400; res.end(JSON.stringify({ error: `Unknown action: ${action}` })); return;
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
              if (response.status === 403 && attempt < 2) continue;
              if (!response.ok) { res.statusCode = response.status; res.end(`Upstream error ${response.status}`); return; }
              const data = await response.text();
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=300');
              res.end(data);
              return;
            } catch (e) {
              if (attempt >= 2) {
                res.statusCode = 502;
                res.end(JSON.stringify({ error: e.message }));
                return;
              }
            }
          }
        });
      },
    },
    // Stream proxy — forwards HLS m3u8/ts/key requests with required Referer & Origin
    {
      name: 'stream-proxy',
      configureServer(server) {
        server.middlewares.use('/api/proxy', async (req, res) => {
          const params = new URL(req.url, 'http://localhost').searchParams;
          const url = params.get('url');
          const referer = params.get('referer') || '';
          if (!url) { res.statusCode = 400; res.end('Missing url'); return; }

          try {
            // Build origin from referer
            let origin = '';
            if (referer) {
              try { origin = new URL(referer).origin; } catch { origin = ''; }
            }

            // Determine if target domain matches referer domain (needs special headers)
            let targetHost = '';
            try { targetHost = new URL(url).hostname; } catch {}
            let refHost = '';
            if (origin) try { refHost = new URL(origin).hostname; } catch {}

            // Only send Referer/Origin when the target domain relates to the embed domain
            // (some CDNs like raffaellocdn reject requests with foreign Referer)
            const needsHeaders = referer && (
              targetHost === refHost ||
              targetHost.includes('uwucdn') ||
              targetHost.includes('megacloud') ||
              targetHost.includes('megafiles') ||
              targetHost.includes('vizcloud') ||
              url.includes('.key') ||
              url.includes('mon.key')
            );

            const headers = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            };
            if (needsHeaders) {
              if (referer) headers['Referer'] = referer;
              if (origin) headers['Origin'] = origin;
            }

            let response = await fetch(url, { headers, redirect: 'follow' });

            // If 403 and we didn't send headers, retry WITH headers
            if (response.status === 403 && !needsHeaders && referer) {
              if (referer) headers['Referer'] = referer;
              if (origin) headers['Origin'] = origin;
              response = await fetch(url, { headers, redirect: 'follow' });
            }

            if (!response.ok) {
              res.statusCode = response.status;
              res.end(`Upstream error ${response.status}`);
              return;
            }

            // Forward content type & caching
            let ct = response.headers.get('content-type') || 'application/octet-stream';
            // Force correct MIME for subtitle files (browsers reject tracks with wrong type)
            if (url.endsWith('.vtt') || url.includes('.vtt?')) ct = 'text/vtt; charset=utf-8';
            else if (url.endsWith('.srt') || url.includes('.srt?')) ct = 'text/plain; charset=utf-8';
            res.setHeader('Content-Type', ct);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=300');

            // For m3u8 playlists, rewrite internal URLs AND key URIs to also go through proxy
            if (ct.includes('mpegurl') || ct.includes('m3u8') || url.includes('.m3u8')) {
              let text = await response.text();
              const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
              const refParam = referer ? `&referer=${encodeURIComponent(referer)}` : '';

              // Helper to make absolute URL
              const toAbs = (u) => u.startsWith('http') ? u : baseUrl + u;

              // Rewrite #EXT-X-KEY:URI="..." so encryption keys go through proxy
              text = text.replace(/(#EXT-X-KEY:[^\n]*URI=")([^"]+)(")/g, (match, pre, uri, post) => {
                const absUri = toAbs(uri.trim());
                return `${pre}/api/proxy?url=${encodeURIComponent(absUri)}${refParam}${post}`;
              });

              // Rewrite #EXT-X-MAP:URI="..." (init segments)
              text = text.replace(/(#EXT-X-MAP:[^\n]*URI=")([^"]+)(")/g, (match, pre, uri, post) => {
                const absUri = toAbs(uri.trim());
                return `${pre}/api/proxy?url=${encodeURIComponent(absUri)}${refParam}${post}`;
              });

              // Rewrite non-comment lines (segment URLs, sub-playlist URLs)
              text = text.replace(/^(?!#)(\S+.*)$/gm, (line) => {
                line = line.trim();
                if (!line) return line;
                const absUrl = toAbs(line);
                return `/api/proxy?url=${encodeURIComponent(absUrl)}${refParam}`;
              });

              res.end(text);
            } else {
              // Binary (video segments, keys, subtitles) — stream through
              const buffer = await response.arrayBuffer();
              res.end(Buffer.from(buffer));
            }
          } catch (e) {
            console.error('Stream proxy error:', e.message);
            res.statusCode = 502;
            res.end('Stream proxy error');
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      // Proxy consumet API calls but NOT /api/proxy or /api/manga-img (handled by plugins above)
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Skip paths handled by the stream-proxy and manga-img-proxy plugins
        bypass(req) {
          if (req.url.startsWith('/api/proxy')) return req.url;
          if (req.url.startsWith('/api/manga-img')) return req.url;
          if (req.url.startsWith('/api/komikplus')) return req.url;
        },
      },
    },
  },
})
