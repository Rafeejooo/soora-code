import { FastifyInstance, FastifyRequest, FastifyReply, RegisterOptions } from 'fastify';

/**
 * Stream proxy route — proxies HLS m3u8, video segments, subtitle VTT, and encryption keys
 * with proper Referer/Origin headers to bypass CDN restrictions.
 */
const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, referer } = request.query as { url?: string; referer?: string };
    if (!url) return reply.status(400).send('Missing url');

    try {
      // Build origin from referer
      let origin = '';
      if (referer) {
        try { origin = new URL(referer).origin; } catch { origin = ''; }
      }

      let targetHost = '';
      try { targetHost = new URL(url).hostname; } catch {}
      let refHost = '';
      if (origin) try { refHost = new URL(origin).hostname; } catch {}

      // On a private VPS we always forward Referer/Origin when provided.
      // Video CDNs (owocdn, megacloud, etc.) require these headers and VPS IPs
      // are not blocked like cloud-provider IPs.
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      };
      if (referer) headers['Referer'] = referer;
      if (origin) headers['Origin'] = origin;

      let response = await fetch(url, { headers, redirect: 'follow' });

      // If 403 without Referer, retry with a generic Referer based on target URL
      if (response.status === 403 && !referer) {
        try {
          const targetOrigin = new URL(url).origin;
          headers['Referer'] = targetOrigin + '/';
          headers['Origin'] = targetOrigin;
        } catch {}
        response = await fetch(url, { headers, redirect: 'follow' });
      }

      if (!response.ok) {
        return reply.status(response.status).send(`Upstream error ${response.status}`);
      }

      // Forward content type & caching
      let ct = response.headers.get('content-type') || 'application/octet-stream';
      if (url.endsWith('.vtt') || url.includes('.vtt?')) ct = 'text/vtt; charset=utf-8';
      else if (url.endsWith('.srt') || url.includes('.srt?')) ct = 'text/plain; charset=utf-8';

      reply.header('Content-Type', ct);
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header('Cache-Control', 'public, max-age=300');

      // For m3u8 playlists, rewrite internal URLs to also go through proxy
      if (ct.includes('mpegurl') || ct.includes('m3u8') || url.includes('.m3u8')) {
        let text = await response.text();
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        const refParam = referer ? `&referer=${encodeURIComponent(referer)}` : '';

        const toAbs = (u: string) => (u.startsWith('http') ? u : baseUrl + u);

        // Rewrite #EXT-X-KEY:URI
        text = text.replace(
          /(#EXT-X-KEY:[^\n]*URI=")([^"]+)(")/g,
          (_match: string, pre: string, uri: string, post: string) => {
            const absUri = toAbs(uri.trim());
            return `${pre}/api/proxy?url=${encodeURIComponent(absUri)}${refParam}${post}`;
          },
        );

        // Rewrite #EXT-X-MAP:URI
        text = text.replace(
          /(#EXT-X-MAP:[^\n]*URI=")([^"]+)(")/g,
          (_match: string, pre: string, uri: string, post: string) => {
            const absUri = toAbs(uri.trim());
            return `${pre}/api/proxy?url=${encodeURIComponent(absUri)}${refParam}${post}`;
          },
        );

        // Rewrite segment/sub-playlist URLs
        text = text.replace(/^(?!#)(\S+.*)$/gm, (line: string) => {
          line = line.trim();
          if (!line) return line;
          const absUrl = toAbs(line);
          return `/api/proxy?url=${encodeURIComponent(absUrl)}${refParam}`;
        });

        return reply.send(text);
      } else {
        // Binary (video segments, keys, subtitles) — pass through
        const buffer = Buffer.from(await response.arrayBuffer());
        return reply.send(buffer);
      }
    } catch (e: any) {
      fastify.log.error('Stream proxy error:', e.message);
      return reply.status(502).send('Stream proxy error');
    }
  });
};

export default routes;
