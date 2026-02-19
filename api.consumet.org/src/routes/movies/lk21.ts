import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import axios from 'axios';
import * as cheerio from 'cheerio';

import cache from '../../utils/cache';
import { redis, REDIS_TTL } from '../../main';
import { Redis } from 'ioredis';

/**
 * /movies/lk21
 * Indonesian movie/series provider — scrapes LK21 (LayarKaca21) and NontonDrama.
 *
 * Updated for the current (2026) HTML structure:
 *   Listing pages:  div.gallery-grid > article
 *   Detail pages:   div.movie-info
 *   Stream sources: ul#player-list > li > a[data-url]
 *   Search:         JSON API at {search_url}/search.php?s=&page=
 */

const LK21_URL = process.env.LK21_URL || 'https://tv15.lk21official.my';
const ND_URL = process.env.ND_URL || 'https://tv14.nontondrama.click';
const BUNDLE_TTL = Math.max(REDIS_TTL || 300, 1800); // 30 min

const axiosOpts = { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } };

// ─── In-memory cache (fallback when no Redis) ───
const _memStore = new Map<string, { data: any; ts: number }>();
const MEM_DEFAULT_TTL = 300; // 5 min

async function memCache<T>(key: string, fetcher: () => Promise<T>, ttl: number = MEM_DEFAULT_TTL): Promise<T> {
  const now = Date.now();
  const cached = _memStore.get(key);
  if (cached && now - cached.ts < ttl * 1000) return cached.data as T;
  const data = await fetcher();
  _memStore.set(key, { data, ts: now });
  // Evict old entries periodically (keep map size manageable)
  if (_memStore.size > 200) {
    for (const [k, v] of _memStore) {
      if (now - v.ts > ttl * 1000 * 2) _memStore.delete(k);
    }
  }
  return data;
}

// ─── Interfaces ───

interface ILK21Movie {
  _id: string;
  title: string;
  type: 'movie' | 'series';
  posterImg: string;
  rating: string;
  qualityResolution: string;
  genres: string[];
  year?: string;
  duration?: string;
  episode?: number;
  season?: string;
}

interface ILK21MovieDetails {
  _id: string;
  title: string;
  type: 'movie' | 'series';
  posterImg: string;
  rating: string;
  quality: string;
  qualityResolution: string;
  releaseDate: string;
  synopsis: string;
  duration: string;
  trailerUrl: string;
  directors: string[];
  countries: string[];
  genres: string[];
  casts: string[];
  status?: string;
  seasons?: { season: number; totalEpisodes: number }[];
  latestEpisode?: string;
}

interface ILK21Stream {
  provider: string;
  url: string;
  directUrl?: string; // Direct HLS m3u8 URL (extracted from embed)
  type?: string;      // 'hls' | 'embed'
}

interface ILK21SearchResult {
  _id: string;
  title: string;
  type: 'movie' | 'series';
  posterImg: string;
  rating: string;
  year: string;
  quality: string;
  episode?: number;
  season?: string;
  genres: string[];
}

// ─── Scraper helpers (updated for 2026 HTML) ───

/**
 * Scrape movie listings from gallery-grid > article structure.
 * Used by /latest, /populer, /release, /rating, /genre/:g, /country/:c, /year/:y
 */
function scrapeMovies(html: string): ILK21Movie[] {
  const $ = cheerio.load(html);
  const payload: ILK21Movie[] = [];

  $('div.gallery-grid > article').each((_i, el) => {
    const article = $(el);
    const link = article.find('figure > a');
    const href = link.attr('href') || '';
    const movieId = href.replace(/^\//, '').replace(/\/$/, '');
    if (!movieId) return;

    // Genre from meta or figcaption
    const genreMeta = article.find('meta[itemprop="genre"]').attr('content') || '';
    const genres = genreMeta ? genreMeta.split(',').map((g: string) => g.trim()).filter(Boolean) : [];

    // Poster
    const posterDiv = link.find('div.poster');
    const img = posterDiv.find('picture img');
    const posterImg = img.attr('src') || '';

    // Title from img alt or figcaption h3
    const titleAlt = (img.attr('alt') || '').replace(/\s*\(\d{4}\)\s*$/, '').trim();
    const titleH3 = link.find('figcaption h3.poster-title').text().trim();
    const title = titleH3 || titleAlt;

    // Rating
    const rating = posterDiv.find('span.rating span[itemprop="ratingValue"]').text().trim();

    // Quality label (HD, SD, etc.)
    const qualityResolution = posterDiv.find('span.label').text().trim();

    // Year
    const year = posterDiv.find('span.year').text().trim();

    // Duration
    const duration = posterDiv.find('span.duration').text().trim();

    payload.push({
      _id: movieId,
      title,
      type: 'movie',
      posterImg,
      rating,
      qualityResolution,
      genres,
      year,
      duration,
    });
  });

  return payload;
}

/**
 * Scrape series listings. Same gallery-grid structure but with episode/season spans.
 */
function scrapeSeries(html: string): ILK21Movie[] {
  const $ = cheerio.load(html);
  const payload: ILK21Movie[] = [];

  $('div.gallery-grid > article').each((_i, el) => {
    const article = $(el);
    const link = article.find('figure > a');
    const href = link.attr('href') || '';
    const seriesId = href.replace(/^\//, '').replace(/\/$/, '');
    if (!seriesId) return;

    const genreMeta = article.find('meta[itemprop="genre"]').attr('content') || '';
    const genres = genreMeta ? genreMeta.split(',').map((g: string) => g.trim()).filter(Boolean) : [];

    const posterDiv = link.find('div.poster');
    const img = posterDiv.find('picture img');
    const posterImg = img.attr('src') || '';

    const titleAlt = (img.attr('alt') || '').replace(/\s*\(\d{4}\)\s*$/, '').trim();
    const titleH3 = link.find('figcaption h3.poster-title').text().trim();
    const title = titleH3 || titleAlt;

    const rating = posterDiv.find('span.rating span[itemprop="ratingValue"]').text().trim()
      || posterDiv.find('span.rating').text().replace(/[^\d.]/g, '').trim();

    const year = posterDiv.find('span.year').text().trim();

    // Episode count: <span class="episode"><strong>12</strong></span>
    const episodeText = posterDiv.find('span.episode strong').text().trim();
    const episode = episodeText ? Number(episodeText) : 0;

    // Season: <span class="duration">S.13</span>
    const seasonText = posterDiv.find('span.duration').text().trim();

    payload.push({
      _id: seriesId,
      title,
      type: 'series',
      posterImg,
      rating,
      qualityResolution: '',
      genres,
      year,
      episode,
      season: seasonText,
    });
  });

  return payload;
}

/**
 * Scrape movie detail page (div.movie-info).
 */
function scrapeMovieDetails(html: string, movieId: string): ILK21MovieDetails {
  const $ = cheerio.load(html);

  // Parse title from h1: "Nonton {Title} ({Year}) Sub Indo di Lk21"
  const h1 = $('div.movie-info h1').text().trim();
  const titleMatch = h1.match(/^Nonton\s+(.+?)\s*(?:\(\d{4}\))?\s*Sub\s+Indo/i);
  const title = titleMatch ? titleMatch[1].trim() : h1.replace(/^Nonton\s+/, '').replace(/\s+Sub Indo.*$/i, '').trim();

  // Info tag spans: rating, quality, resolution, duration
  const infoTags: string[] = [];
  $('div.movie-info div.info-tag').children().each((_i, el) => {
    const tag = $(el);
    if (!tag.hasClass('broken-line')) {
      const text = tag.text().trim();
      if (text) infoTags.push(text);
    }
  });

  const rating = infoTags[0] || '';
  const quality = infoTags[1] || '';
  const qualityResolution = infoTags[2] || '';
  const duration = infoTags[3] || '';

  // Genres and countries from tag-list
  const genres: string[] = [];
  const countries: string[] = [];
  $('div.movie-info div.tag-list span.tag a').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('/genre/')) genres.push(text);
    else if (href.includes('/country/')) countries.push(text);
  });

  // Synopsis
  const synopsis = $('div.meta-info div.synopsis').text().trim();

  // Detail section: directors, casts, release date, etc.
  const directors: string[] = [];
  const casts: string[] = [];
  let releaseDate = '';
  $('div.meta-info div.detail p').each((_i, el) => {
    const span = $(el).find('span').text().trim().toLowerCase();
    if (span.startsWith('sutradara')) {
      $(el).find('a').each((_j, a) => { directors.push($(a).text().trim()); });
    } else if (span.startsWith('bintang')) {
      $(el).find('a').each((_j, a) => { casts.push($(a).text().trim()); });
    } else if (span.startsWith('release')) {
      $(el).find('span').remove();
      releaseDate = $(el).text().trim();
    }
  });

  // Poster from detail section picture
  let posterImg = $('div.meta-info div.detail picture img').attr('src') || '';
  if (!posterImg) {
    // Fallback: player poster
    posterImg = $('video#videoAd').attr('poster') || '';
  }

  // Trailer: look for YouTube fancybox link or player action trailer link
  const trailerUrl = $('a.yt-lightbox').attr('href') || $('a.fancybox').attr('href') || '';

  return {
    _id: movieId,
    title,
    type: 'movie',
    posterImg,
    rating,
    quality,
    qualityResolution,
    releaseDate,
    synopsis,
    duration,
    trailerUrl,
    directors,
    countries,
    genres,
    casts,
  };
}

/**
 * Scrape series detail page (div.movie-info) — same structure with status/seasons.
 */
function scrapeSeriesDetails(html: string, seriesId: string): ILK21MovieDetails {
  const $ = cheerio.load(html);

  const h1 = $('div.movie-info h1').text().trim();
  const titleMatch = h1.match(/^Nonton\s+(?:Serial\s+)?(.+?)\s*(?:\(\d{4}\))?\s*Sub\s+Indo/i);
  const title = titleMatch ? titleMatch[1].trim() : h1.replace(/^Nonton\s+(?:Serial\s+)?/, '').replace(/\s+Sub Indo.*$/i, '').trim();

  const infoTags: string[] = [];
  $('div.movie-info div.info-tag').children().each((_i, el) => {
    const tag = $(el);
    if (!tag.hasClass('broken-line')) {
      const text = tag.text().trim();
      if (text) infoTags.push(text);
    }
  });

  const rating = infoTags[0] || '';
  // For series, info tags can be: rating, age-rating, release-date, origin, status
  const status = infoTags[infoTags.length - 1]?.toLowerCase() || '';

  const genres: string[] = [];
  const countries: string[] = [];
  $('div.movie-info div.tag-list span.tag a').each((_i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('/genre/')) genres.push(text);
    else if (href.includes('/country/')) countries.push(text);
  });

  const synopsis = $('div.meta-info div.synopsis').text().trim();

  const directors: string[] = [];
  const casts: string[] = [];
  let releaseDate = '';
  $('div.meta-info div.detail p').each((_i, el) => {
    const span = $(el).find('span').text().trim().toLowerCase();
    if (span.startsWith('sutradara')) {
      $(el).find('a').each((_j, a) => { directors.push($(a).text().trim()); });
    } else if (span.startsWith('bintang')) {
      $(el).find('a').each((_j, a) => { casts.push($(a).text().trim()); });
    } else if (span.startsWith('release')) {
      $(el).find('span').remove();
      releaseDate = $(el).text().trim();
    }
  });

  let posterImg = $('div.meta-info div.detail picture img').attr('src') || '';
  if (!posterImg) posterImg = $('video#videoAd').attr('poster') || '';

  const trailerUrl = $('div.player-content > iframe').attr('src') || '';

  // Latest episode link
  const latestEpisode = $('div.meta-info p a').first().text().trim() || '';

  // Seasons: parse from episode-list sections if present
  const seasons: { season: number; totalEpisodes: number }[] = [];
  const epsElem = $('div.episode-list, div.serial-wrapper > div.episode-list');
  if (epsElem.length > 0) {
    for (let i = epsElem.length; i >= 1; i--) {
      seasons.push({
        season: i,
        totalEpisodes: $(epsElem[epsElem.length - i]).find('a').length,
      });
    }
  }

  return {
    _id: seriesId,
    title,
    type: 'series',
    posterImg,
    rating,
    quality: '',
    qualityResolution: '',
    releaseDate,
    synopsis,
    duration: '',
    trailerUrl,
    directors,
    countries,
    genres,
    casts,
    status: status || undefined,
    seasons: seasons.length > 0 ? seasons : undefined,
    latestEpisode: latestEpisode || undefined,
  };
}

/**
 * Scrape stream sources from ul#player-list > li > a.
 * New structure uses data-url/data-server attributes.
 */
function scrapeStreamSources(html: string): ILK21Stream[] {
  const $ = cheerio.load(html);
  const payload: ILK21Stream[] = [];

  $('ul#player-list > li > a').each((_i, el) => {
    const a = $(el);
    const url = a.attr('data-url') || a.attr('href') || '';
    const provider = a.attr('data-server') || a.text().trim();

    if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
      payload.push({ provider: provider.toUpperCase(), url });
    }
  });

  // Also check player-select (mobile dropdown) as fallback
  if (payload.length === 0) {
    $('select#player-select option').each((_i, el) => {
      const opt = $(el);
      const url = opt.attr('value') || '';
      const provider = opt.attr('data-server') || opt.text().replace('GANTI PLAYER ', '').trim();
      if (url && !url.startsWith('#')) {
        payload.push({ provider: provider.toUpperCase(), url });
      }
    });
  }

  return payload;
}

/**
 * Extract direct HLS m3u8 URLs from LK21 embed sources.
 * Supports: P2P (cloud.hownetwork.xyz), TURBOVIP (emturbovid.com).
 * Others fall back to embed URL.
 */
async function extractDirectStreams(embedSources: ILK21Stream[]): Promise<ILK21Stream[]> {
  const results = await Promise.allSettled(
    embedSources.map(async (src) => {
      try {
        // Step 1: Fetch the playeriframe.sbs page to get the inner iframe URL
        const embedRes = await axios.get(src.url, { ...axiosOpts, timeout: 10000 });
        const $embed = cheerio.load(embedRes.data);
        const innerSrc = $embed('.embed-container iframe').attr('src') || '';
        if (!innerSrc) return { ...src, type: 'embed' as const };

        const prov = src.provider.toUpperCase();

        // P2P: cloud.hownetwork.xyz — POST api2.php to get HLS URL
        if (prov === 'P2P' && innerSrc.includes('hownetwork')) {
          const idMatch = innerSrc.match(/[?&]id=([^&]+)/);
          if (idMatch) {
            const apiUrl = new URL(innerSrc);
            const api2 = `${apiUrl.origin}/api2.php?id=${idMatch[1]}`;
            const apiRes = await axios.post(api2, { r: src.url, d: apiUrl.hostname }, {
              ...axiosOpts,
              timeout: 10000,
              headers: {
                ...axiosOpts.headers,
                'Content-Type': 'application/json',
                'Referer': src.url,
                'Origin': apiUrl.origin,
              },
            });
            const hlsUrl = apiRes.data?.file;
            if (hlsUrl && hlsUrl.includes('.m3u8')) {
              return {
                provider: src.provider,
                url: hlsUrl,
                directUrl: hlsUrl,
                type: 'hls' as const,
              };
            }
          }
        }

        // TURBOVIP: emturbovid.com — scrape urlPlay variable
        if (prov === 'TURBOVIP' && (innerSrc.includes('turbovid') || innerSrc.includes('turbovi'))) {
          const turbRes = await axios.get(innerSrc, {
            ...axiosOpts,
            timeout: 10000,
            headers: { ...axiosOpts.headers, 'Referer': src.url },
          });
          const urlMatch = turbRes.data.match(/urlPlay\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
          if (urlMatch) {
            return {
              provider: src.provider,
              url: urlMatch[1],
              directUrl: urlMatch[1],
              type: 'hls' as const,
            };
          }
        }

        // CAST: f16px.com has no CSP — embed inner URL directly (bypasses playeriframe.sbs CSP)
        if (prov === 'CAST' && innerSrc.includes('f16px.com')) {
          return {
            provider: src.provider,
            url: innerSrc,
            type: 'embed' as const,
          };
        }

        // HYDRAX: short.icu has X-Frame-Options: SAMEORIGIN — cannot be embedded, skip
        if (prov === 'HYDRAX') {
          return null;
        }

        // Fallback: return embed URL
        return { ...src, type: 'embed' as const };
      } catch {
        return { ...src, type: 'embed' as const };
      }
    })
  );

  const mapped = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : ({ ...embedSources[i], type: 'embed' } as ILK21Stream)
  );
  return mapped.filter((s): s is ILK21Stream => s !== null);
}

/**
 * Extract search_url from LK21 page body data attribute.
 * The search API is on a separate domain (set via body[data-search_url]).
 */
async function getSearchUrl(): Promise<string> {
  try {
    const res = await axios.get(LK21_URL, { ...axiosOpts, maxRedirects: 3 });
    const $ = cheerio.load(res.data);
    const searchUrl = $('body').attr('data-search_url') || '';
    return searchUrl;
  } catch {
    return '';
  }
}

let _cachedSearchUrl: string | null = null;
let _searchUrlTs = 0;
const SEARCH_URL_TTL = 3600000; // 1 hour

async function resolveSearchUrl(): Promise<string> {
  if (_cachedSearchUrl && Date.now() - _searchUrlTs < SEARCH_URL_TTL) return _cachedSearchUrl;
  _cachedSearchUrl = await getSearchUrl();
  _searchUrlTs = Date.now();
  return _cachedSearchUrl;
}

/**
 * Search via the LK21 JSON API (search.php).
 * Falls back to scraping listing pages if the JSON API is Cloudflare-protected.
 */
async function searchLK21(query: string, page: number = 1): Promise<{ results: ILK21SearchResult[]; totalPages: number }> {
  // Strategy 1: Try the JSON search API (may be Cloudflare-blocked)
  try {
    const searchBaseUrl = await resolveSearchUrl();
    if (searchBaseUrl) {
      const apiUrl = `${searchBaseUrl}search.php?s=${encodeURIComponent(query)}&page=${page}`;
      const res = await axios.get(apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${LK21_URL}/search?s=${encodeURIComponent(query)}`,
          'Origin': LK21_URL,
          'Accept': 'application/json, text/plain, */*',
        },
      });

      const data = res.data;
      const items: any[] = data?.data || data?.items || [];
      const totalPages = Number(data?.totalPages || data?.total_pages || 1);
      const thumbnailUrl = 'https://poster.lk21.party/wp-content/uploads/';

      const results: ILK21SearchResult[] = items.map((item: any) => {
        let posterImg = '';
        if (item.poster) {
          try { posterImg = new URL(item.poster, thumbnailUrl).toString(); }
          catch { posterImg = item.poster; }
        }
        const isSeriesItem = !!(item.episode || item.season);
        return {
          _id: (item.slug || '').replace(/^\//, ''),
          title: (item.title || '').replace(/\s*\(\d{4}\)\s*$/, '').trim(),
          type: isSeriesItem ? 'series' as const : 'movie' as const,
          posterImg,
          rating: String(item.rating || ''),
          year: String(item.year || ''),
          quality: String(item.quality || ''),
          episode: item.episode ? Number(item.episode) : undefined,
          season: item.season ? `S.${item.season}` : undefined,
          genres: [],
        };
      });

      if (results.length > 0) return { results, totalPages };
    }
  } catch {
    // JSON API failed (likely Cloudflare-protected), fall through to Strategy 2
  }

  // Strategy 2: Scrape multiple listing pages and filter by query
  // Scrape populer, latest, rating from both LK21 (movies) and ND (series) for broader coverage
  try {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    // Use in-memory cache for the listing pool (avoid re-scraping on every search)
    const poolCacheKey = `lk21:search-pool:p${page}`;
    const fetchPool = async () => {
      const urls = [
        `${LK21_URL}/populer${Number(page) > 1 ? `/page/${page}` : ''}`,
        `${LK21_URL}/latest${Number(page) > 1 ? `/page/${page}` : ''}`,
        `${LK21_URL}/rating${Number(page) > 1 ? `/page/${page}` : ''}`,
        `${ND_URL}/populer${Number(page) > 1 ? `/page/${page}` : ''}`,
        `${ND_URL}/latest-series${Number(page) > 1 ? `/page/${page}` : ''}`,
        `${ND_URL}/rating${Number(page) > 1 ? `/page/${page}` : ''}`,
      ];

      const responses = await Promise.allSettled(urls.map(u => axios.get(u, axiosOpts)));
      const pool: ILK21SearchResult[] = [];
      const seen = new Set<string>();

      const toSearchResult = (item: ILK21Movie): ILK21SearchResult => ({
        _id: item._id,
        title: item.title,
        type: item.type,
        posterImg: item.posterImg,
        rating: item.rating,
        year: item.year || '',
        quality: item.qualityResolution,
        episode: item.episode,
        season: item.season,
        genres: item.genres,
      });

      for (const resp of responses) {
        if (resp.status !== 'fulfilled') continue;
        const html = resp.value.data;
        const movies = scrapeMovies(html);
        const series = scrapeSeries(html);

        for (const item of [...movies, ...series]) {
          if (!seen.has(item._id)) {
            seen.add(item._id);
            pool.push(toSearchResult(item));
          }
        }
      }
      return pool;
    };

    const pool = await memCache(poolCacheKey, fetchPool, 600); // cache pool for 10 min

    // Fuzzy-ish matching: all query words must appear in title or slug
    const allResults = pool.filter(item => {
      const titleLower = item.title.toLowerCase();
      const slugLower = item._id.toLowerCase();
      return queryWords.every(w => titleLower.includes(w) || slugLower.includes(w));
    });

    return { results: allResults, totalPages: 1 };
  } catch {
    return { results: [], totalPages: 0 };
  }
}

// ─── Routes ───

const routes = async (fastify: FastifyInstance, _options: RegisterOptions) => {

  // GET /movies/lk21/ — latest movies
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${LK21_URL}/latest${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:movies:latest:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeMovies(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch LK21 movies.' });
    }
  });

  // GET /movies/lk21/popular — popular movies
  fastify.get('/popular', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${LK21_URL}/populer${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:movies:popular:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeMovies(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch popular LK21 movies.' });
    }
  });

  // GET /movies/lk21/recent — recent releases
  fastify.get('/recent', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${LK21_URL}/release${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:movies:recent:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeMovies(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch recent LK21 movies.' });
    }
  });

  // GET /movies/lk21/top-rated
  fastify.get('/top-rated', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${LK21_URL}/rating${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:movies:top-rated:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeMovies(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch top-rated LK21 movies.' });
    }
  });

  // GET /movies/lk21/search/:query — search movies & series via JSON API
  fastify.get('/search/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { query } = request.params as any;
      const { page = 1 } = request.query as any;
      const cacheKey = `lk21:search:${query}:p${page}`;

      const fetch = async () => searchLK21(query, Number(page));

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to search LK21.' });
    }
  });

  // GET /movies/lk21/info/:id — movie details
  fastify.get('/info/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const infoUrl = `${LK21_URL}/${id}`;
      const cacheKey = `lk21:info:movie:${id}`;

      const fetch = async () => {
        const res = await axios.get(infoUrl, axiosOpts);
        return scrapeMovieDetails(res.data, id);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch LK21 movie details.' });
    }
  });

  // GET /movies/lk21/streams/:id — movie stream sources (with direct HLS extraction)
  fastify.get('/streams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const streamUrl = `${LK21_URL}/${id}`;
      const cacheKey = `lk21:streams:hls:movie:${id}`;

      const fetchAndExtract = async () => {
        const res = await axios.get(streamUrl, axiosOpts);
        const embedSources = scrapeStreamSources(res.data);
        // Extract direct HLS URLs from embed sources
        return extractDirectStreams(embedSources);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetchAndExtract, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetchAndExtract);
      }
      reply.status(200).send({ sources: data });
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch LK21 streams.' });
    }
  });

  // ─── Series endpoints ───

  // GET /movies/lk21/series — latest series
  fastify.get('/series', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${ND_URL}/latest-series${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:series:latest:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeSeries(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch LK21 series.' });
    }
  });

  // GET /movies/lk21/series/popular
  fastify.get('/series/popular', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${ND_URL}/populer${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:series:popular:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeSeries(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch popular LK21 series.' });
    }
  });

  // GET /movies/lk21/series/recent — recent release series
  fastify.get('/series/recent', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${ND_URL}/release${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:series:recent:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeSeries(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch recent LK21 series.' });
    }
  });

  // GET /movies/lk21/series/top-rated
  fastify.get('/series/top-rated', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = 1 } = request.query as any;
      const url = `${ND_URL}/rating${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:series:top-rated:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeSeries(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch top-rated LK21 series.' });
    }
  });

  // GET /movies/lk21/series/info/:id — series details
  fastify.get('/series/info/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const infoUrl = `${ND_URL}/${id}`;
      const cacheKey = `lk21:info:series:${id}`;

      const fetch = async () => {
        const res = await axios.get(infoUrl, axiosOpts);
        return scrapeSeriesDetails(res.data, id);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch LK21 series details.' });
    }
  });

  // GET /movies/lk21/series/streams/:id — series stream sources (with direct HLS extraction)
  fastify.get('/series/streams/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const { season = 1, episode = 1 } = request.query as any;

      // Build NontonDrama stream URL: {seriesId}-season-{s}-episode-{e}-{year}
      const parts = id.split('-');
      const year = parts.pop();
      const seriesSlug = parts.join('-');
      const streamUrl = `${ND_URL}/${seriesSlug}-season-${season}-episode-${episode}-${year}`;
      const cacheKey = `lk21:streams:hls:series:${id}:s${season}e${episode}`;

      const fetchAndExtract = async () => {
        const res = await axios.get(streamUrl, axiosOpts);
        const embedSources = scrapeStreamSources(res.data);
        return extractDirectStreams(embedSources);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetchAndExtract, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetchAndExtract);
      }
      reply.status(200).send({ sources: data });
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch LK21 series streams.' });
    }
  });

  // ─── Filter endpoints ───

  // GET /movies/lk21/genre/:genre
  fastify.get('/genre/:genre', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { genre } = request.params as any;
      const { page = 1 } = request.query as any;
      const url = `${LK21_URL}/genre/${genre}${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:genre:${genre}:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeMovies(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: `Failed to fetch LK21 movies for genre: ${(request.params as any).genre}` });
    }
  });

  // GET /movies/lk21/country/:country
  fastify.get('/country/:country', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { country } = request.params as any;
      const { page = 1 } = request.query as any;
      const url = `${LK21_URL}/country/${country}${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:country:${country}:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeMovies(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: `Failed to fetch LK21 movies for country: ${(request.params as any).country}` });
    }
  });

  // GET /movies/lk21/year/:year
  fastify.get('/year/:year', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { year } = request.params as any;
      const { page = 1 } = request.query as any;
      const url = `${LK21_URL}/year/${year}${Number(page) > 1 ? `/page/${page}` : ''}`;
      const cacheKey = `lk21:year:${year}:${page}`;

      const fetch = async () => {
        const res = await axios.get(url, axiosOpts);
        return scrapeMovies(res.data);
      };

      let data;
      if (redis) {
        data = await cache.fetch(redis as Redis, cacheKey, fetch, REDIS_TTL || 300);
      } else {
        data = await memCache(cacheKey, fetch);
      }
      reply.status(200).send(data);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: `Failed to fetch LK21 movies for year: ${(request.params as any).year}` });
    }
  });

  // ─── Home Bundle (for MovieHome ID mode) ───
  fastify.get('/home-bundle', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cacheKey = 'lk21:home-bundle:v2';

      const fetchBundle = async () => {
        const [
          popularMoviesRes,
          recentMoviesRes,
          topRatedRes,
          latestSeriesRes,
          popularSeriesRes,
        ] = await Promise.allSettled([
          axios.get(`${LK21_URL}/populer`, axiosOpts),
          axios.get(`${LK21_URL}/release`, axiosOpts),
          axios.get(`${LK21_URL}/rating`, axiosOpts),
          axios.get(`${ND_URL}/latest-series`, axiosOpts),
          axios.get(`${ND_URL}/populer`, axiosOpts),
        ]);

        const extractMovies = (r: PromiseSettledResult<any>) =>
          r.status === 'fulfilled' ? scrapeMovies(r.value.data) : [];
        const extractSeries = (r: PromiseSettledResult<any>) =>
          r.status === 'fulfilled' ? scrapeSeries(r.value.data) : [];

        return {
          popularMovies: extractMovies(popularMoviesRes).slice(0, 24),
          recentMovies: extractMovies(recentMoviesRes).slice(0, 24),
          topRatedMovies: extractMovies(topRatedRes).slice(0, 24),
          latestSeries: extractSeries(latestSeriesRes).slice(0, 24),
          popularSeries: extractSeries(popularSeriesRes).slice(0, 24),
          _ts: Date.now(),
        };
      };

      let bundle: any;
      if (redis) {
        bundle = await cache.fetch(redis as Redis, cacheKey, fetchBundle, BUNDLE_TTL);
      } else {
        bundle = await memCache(cacheKey, fetchBundle, BUNDLE_TTL);
      }

      reply.status(200).send(bundle);
    } catch (err) {
      fastify.log.error(err);
      reply.status(500).send({ message: 'Failed to fetch LK21 home bundle.' });
    }
  });
};

export default routes;
