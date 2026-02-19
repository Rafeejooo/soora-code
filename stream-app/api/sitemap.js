/**
 * Dynamic Sitemap Generator (Vercel Serverless Function)
 *
 * Fetches popular anime, movies, and manga from the backend API
 * and generates a sitemap.xml with clean URLs.
 *
 * Access: GET /api/sitemap  (rewritten from /sitemap.xml)
 */
import axios from 'axios';

const API_BASE = process.env.VITE_API_URL || 'https://api.soora.fun';
const SITE_URL = 'https://www.soora.fun';

function encodePathId(id) {
  if (!id) return '';
  return id.split('/').map(s => encodeURIComponent(s)).join('/');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildUrlEntry(loc, changefreq = 'weekly', priority = '0.7', lastmod = null) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export default async function handler(req, res) {
  try {
    const urls = [];

    // Static pages
    urls.push(buildUrlEntry(`${SITE_URL}/`, 'daily', '1.0'));
    urls.push(buildUrlEntry(`${SITE_URL}/anime`, 'daily', '0.9'));
    urls.push(buildUrlEntry(`${SITE_URL}/movies`, 'daily', '0.9'));
    urls.push(buildUrlEntry(`${SITE_URL}/manga`, 'daily', '0.9'));
    urls.push(buildUrlEntry(`${SITE_URL}/anime/search`, 'weekly', '0.6'));
    urls.push(buildUrlEntry(`${SITE_URL}/movies/search`, 'weekly', '0.6'));
    urls.push(buildUrlEntry(`${SITE_URL}/manga/search`, 'weekly', '0.6'));

    const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

    // Fetch anime lists in parallel
    const [spotlightRes, popularAnimeRes, topAiringRes, popularMangaRes] = await Promise.allSettled([
      api.get('/anime/animekai/spotlight'),
      api.get('/anime/animekai/most-popular'),
      api.get('/anime/animekai/top-airing'),
      api.get('/manga/mangapill/popular'),
    ]);

    // Process anime spotlight
    if (spotlightRes.status === 'fulfilled') {
      const items = spotlightRes.value.data?.results || spotlightRes.value.data || [];
      items.forEach(item => {
        if (item.id) {
          urls.push(buildUrlEntry(
            `${SITE_URL}/anime/${encodeURIComponent(item.id)}`,
            'weekly', '0.8'
          ));
        }
      });
    }

    // Process popular anime
    if (popularAnimeRes.status === 'fulfilled') {
      const items = popularAnimeRes.value.data?.results || popularAnimeRes.value.data || [];
      items.forEach(item => {
        if (item.id) {
          urls.push(buildUrlEntry(
            `${SITE_URL}/anime/${encodeURIComponent(item.id)}`,
            'weekly', '0.7'
          ));
        }
      });
    }

    // Process top airing
    if (topAiringRes.status === 'fulfilled') {
      const items = topAiringRes.value.data?.results || topAiringRes.value.data || [];
      items.forEach(item => {
        if (item.id) {
          urls.push(buildUrlEntry(
            `${SITE_URL}/anime/${encodeURIComponent(item.id)}`,
            'daily', '0.8'
          ));
        }
      });
    }

    // Process popular manga
    if (popularMangaRes.status === 'fulfilled') {
      const items = popularMangaRes.value.data?.results || popularMangaRes.value.data || [];
      items.forEach(item => {
        if (item.id) {
          urls.push(buildUrlEntry(
            `${SITE_URL}/manga/${encodePathId(item.id)}`,
            'weekly', '0.7'
          ));
        }
      });
    }

    // Try to fetch trending movies (Goku) and LK21
    const [trendingMoviesRes, trendingTVRes, lk21Res] = await Promise.allSettled([
      api.get('/movies/goku/trending-movies'),
      api.get('/movies/goku/trending-tv'),
      api.get('/movies/lk21/home'),
    ]);

    if (trendingMoviesRes.status === 'fulfilled') {
      const items = trendingMoviesRes.value.data?.results || trendingMoviesRes.value.data || [];
      items.forEach(item => {
        if (item.id) {
          urls.push(buildUrlEntry(
            `${SITE_URL}/movies/${encodePathId(item.id)}?type=movie`,
            'weekly', '0.7'
          ));
        }
      });
    }

    if (trendingTVRes.status === 'fulfilled') {
      const items = trendingTVRes.value.data?.results || trendingTVRes.value.data || [];
      items.forEach(item => {
        if (item.id) {
          urls.push(buildUrlEntry(
            `${SITE_URL}/movies/${encodePathId(item.id)}?type=tv`,
            'weekly', '0.7'
          ));
        }
      });
    }

    if (lk21Res.status === 'fulfilled') {
      const data = lk21Res.value.data;
      const allItems = [
        ...(data?.recentMovies || []),
        ...(data?.recentSeries || []),
        ...(data?.trendingMovies || []),
        ...(data?.trendingSeries || []),
      ];
      allItems.forEach(item => {
        const id = item.lk21Id || item.id;
        const mt = item.mediaType || 'movie';
        if (id) {
          urls.push(buildUrlEntry(
            `${SITE_URL}/movies/${encodePathId(id)}?type=${mt}`,
            'weekly', '0.7'
          ));
        }
      });
    }

    // Deduplicate URLs by loc
    const seen = new Set();
    const uniqueUrls = urls.filter(entry => {
      const locMatch = entry.match(/<loc>(.*?)<\/loc>/);
      if (!locMatch) return true;
      const loc = locMatch[1];
      if (seen.has(loc)) return false;
      seen.add(loc);
      return true;
    });

    const today = new Date().toISOString().split('T')[0];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls.join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    res.status(200).send(sitemap);
  } catch (err) {
    console.error('Sitemap generation error:', err.message);
    // Return a minimal sitemap on error
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE_URL}/anime</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE_URL}/movies</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${SITE_URL}/manga</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
</urlset>`;
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(fallback);
  }
}
