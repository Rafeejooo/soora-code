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
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
