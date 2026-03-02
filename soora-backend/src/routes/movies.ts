import { Router, Request, Response } from 'express';
import * as consumet from '../services/consumet';
import * as tmdb from '../services/tmdb';
import { cached, cachedSWR, CACHE_TTL } from '../services/cache';
import { parallel, normalizeGoku, normalizeLK21, extractResults } from '../utils/normalize';

const qs = (v: any): string => String(v ?? '');

const router = Router();

// TMDB genre IDs for home page sections
const MOVIE_GENRE_SECTIONS = [
  { id: 28, key: 'action', label: 'Action' },
  { id: 35, key: 'comedy', label: 'Comedy' },
  { id: 18, key: 'drama', label: 'Drama' },
  { id: 27, key: 'horror', label: 'Horror' },
  { id: 10749, key: 'romance', label: 'Romance' },
  { id: 878, key: 'scifi', label: 'Sci-Fi' },
  { id: 53, key: 'thriller', label: 'Thriller' },
  { id: 16, key: 'animation', label: 'Animation' },
  { id: 10751, key: 'family', label: 'Family' },
  { id: 99, key: 'documentary', label: 'Documentary' },
];

/**
 * GET /movies/home
 * Orchestrated home page: TMDB + Goku + LK21 in parallel.
 */
router.get('/home', async (_req: Request, res: Response) => {
  try {
    const data = await cachedSWR('movies:home', async () => {
      // Phase 1: Core sections (all in parallel)
      const [
        trendingRes, popularMoviesRes, popularTVRes,
        gokuTrendMovie, gokuTrendTV, gokuRecentMovie, gokuRecentTV,
        lk21PopularRes, lk21RecentRes, lk21SeriesRes,
      ] = await parallel(
        tmdb.trending('all', 'week'),
        tmdb.popularMovies(1),
        tmdb.popularTV(1),
        consumet.movieTrending('movie', 'goku').catch(() => null),
        consumet.movieTrending('tv', 'goku').catch(() => null),
        consumet.movieRecentMovies('goku').catch(() => null),
        consumet.movieRecentShows('goku').catch(() => null),
        consumet.lk21Popular(1).catch(() => null),
        consumet.lk21Recent(1).catch(() => null),
        consumet.lk21LatestSeries(1).catch(() => null),
      );

      // Phase 2: Genre sections (10 calls in parallel via TMDB discover)
      const genrePromises = MOVIE_GENRE_SECTIONS.map((g) =>
        tmdb.discoverByGenre(g.id, 1, 'movie').catch(() => null)
      );
      const genreResults = await Promise.allSettled(genrePromises);

      const genres: Record<string, any> = {};
      MOVIE_GENRE_SECTIONS.forEach((g, i) => {
        const result = genreResults[i];
        genres[g.key] = {
          label: g.label,
          genreId: g.id,
          results: result.status === 'fulfilled' && result.value ? result.value.results.slice(0, 20) : [],
        };
      });

      return {
        trending: trendingRes?.results || [],
        popularMovies: popularMoviesRes?.results || [],
        popularTV: popularTVRes?.results || [],
        gokuTrendingMovies: (Array.isArray(gokuTrendMovie) ? gokuTrendMovie : extractResults(gokuTrendMovie)).map(normalizeGoku),
        gokuTrendingTV: (Array.isArray(gokuTrendTV) ? gokuTrendTV : extractResults(gokuTrendTV)).map(normalizeGoku),
        gokuRecentMovies: (Array.isArray(gokuRecentMovie) ? gokuRecentMovie : extractResults(gokuRecentMovie)).map(normalizeGoku),
        gokuRecentTV: (Array.isArray(gokuRecentTV) ? gokuRecentTV : extractResults(gokuRecentTV)).map(normalizeGoku),
        lk21Popular: (Array.isArray(lk21PopularRes) ? lk21PopularRes : []).map(normalizeLK21),
        lk21Recent: (Array.isArray(lk21RecentRes) ? lk21RecentRes : []).map(normalizeLK21),
        lk21Series: (Array.isArray(lk21SeriesRes) ? lk21SeriesRes : []).map(normalizeLK21),
        genres,
      };
    }, CACHE_TTL.HOME_BUNDLE);

    res.json(data);
  } catch (err: any) {
    console.error('[movies/home]', err.message);
    res.status(500).json({ error: 'Failed to load movie home' });
  }
});

/**
 * GET /movies/info/:id?type=movie|tv
 * TMDB details + optional Goku/LK21 match for streaming.
 */
router.get('/info/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(qs(req.params.id));
    const type = qs(req.query.type) || 'movie';

    const data = await cached(`movies:info:${type}:${id}`, async () => {
      const details = type === 'tv' ? await tmdb.tvDetails(id) : await tmdb.movieDetails(id);
      return details;
    }, CACHE_TTL.INFO, 'long');

    res.json(data);
  } catch (err: any) {
    console.error('[movies/info]', err.message);
    res.status(500).json({ error: 'Failed to load movie info' });
  }
});

/**
 * GET /movies/tv-season/:id/:season
 */
router.get('/tv-season/:id/:season', async (req: Request, res: Response) => {
  try {
    const id = parseInt(qs(req.params.id));
    const season = parseInt(qs(req.params.season));
    const data = await cached(`movies:tv-season:${id}:${season}`,
      () => tmdb.tvSeason(id, season), CACHE_TTL.INFO, 'long');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load season' });
  }
});

/**
 * GET /movies/search?q=query&page=1
 * Multi-provider search: TMDB + Goku + LK21.
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = qs(req.query.q);
    const page = parseInt(qs(req.query.page) || '1');
    if (!query) return res.status(400).json({ error: 'Missing query' });

    const data = await cached(`movies:search:${query}:${page}`, async () => {
      const [tmdbRes, gokuRes, lk21Res] = await parallel(
        tmdb.searchMulti(query, page),
        consumet.movieSearch(query, 'goku').catch(() => null),
        consumet.lk21Search(query).catch(() => null),
      );

      return {
        tmdb: tmdbRes || { results: [], totalPages: 0 },
        goku: { results: extractResults(gokuRes).map(normalizeGoku) },
        lk21: { results: extractResults(lk21Res).map(normalizeLK21) },
      };
    }, CACHE_TTL.SEARCH);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /movies/stream?title=&tmdbId=&year=&type=movie|tv&season=&episode=
 * Orchestrated streaming — finds best provider and returns sources.
 */
router.get('/stream', async (req: Request, res: Response) => {
  try {
    const title = qs(req.query.title);
    const tmdbId = qs(req.query.tmdbId);
    const year = qs(req.query.year);
    const type = qs(req.query.type);
    const season = qs(req.query.season);
    const episode = qs(req.query.episode);
    if (!title) return res.status(400).json({ error: 'Missing title' });

    const cacheKey = type === 'tv'
      ? `movies:stream:${tmdbId}:s${season}e${episode}`
      : `movies:stream:${tmdbId}`;

    const data = await cached(cacheKey, async () => {
      const providers = ['goku', 'flixhq'];
      const title = qs(req.query.title);
    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const titleNorm = normalize(title);

      for (const provider of providers) {
        try {
          // 1) Search
          const searchRes = await consumet.movieSearch(String(title), provider);
          const results = extractResults(searchRes);
          if (results.length === 0) continue;

          // Score matches
          const scored = results.map((r: any) => {
            let score = 0;
            const rTitle = normalize(r.title);
            if (rTitle === titleNorm) score += 10;
            else if (rTitle.includes(titleNorm) || titleNorm.includes(rTitle)) score += 5;
            const typeFilter = type === 'tv' ? 'TV Series' : 'Movie';
            if (r.type === typeFilter) score += 3;
            if (year && r.releaseDate && r.releaseDate.startsWith(String(year))) score += 2;
            return { ...r, _score: score };
          });
          scored.sort((a: any, b: any) => b._score - a._score);
          const match = scored[0];

          // 2) Get info
          const info = await consumet.movieInfo(match.id, provider);
          const episodes = info.episodes || [];

          if (type === 'tv') {
            const targetEp = episodes.find(
              (ep: any) => ep.season === parseInt(String(season)) && ep.number === parseInt(String(episode))
            );
            if (!targetEp) continue;
            const watchRes = await consumet.movieWatch(targetEp.id, match.id, provider);
            if (watchRes?.sources?.length > 0) {
              return { ...watchRes, _provider: provider, _mediaTitle: info.title || title, _episodeTitle: targetEp.title };
            }
          } else {
            const ep = episodes[0] || episodes;
            if (!ep?.id) continue;
            const watchRes = await consumet.movieWatch(ep.id, match.id, provider);
            if (watchRes?.sources?.length > 0) {
              return { ...watchRes, _provider: provider, _mediaTitle: info.title || title };
            }
          }
        } catch { continue; }
      }
      return { error: 'No streaming sources found', sources: [] };
    }, CACHE_TTL.STREAM);

    res.json(data);
  } catch (err: any) {
    console.error('[movies/stream]', err.message);
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

/**
 * GET /movies/discover?mediaType=&genre=&year=&sort=&page=
 */
router.get('/discover', async (req: Request, res: Response) => {
  try {
    const mediaType = qs(req.query.mediaType) || 'movie';
    const genre = qs(req.query.genre);
    const year = qs(req.query.year);
    const sort = qs(req.query.sort) || 'popularity.desc';
    const page = qs(req.query.page) || '1';
    const params = {
      mediaType,
      genre: genre ? parseInt(genre) : undefined,
      year: year || undefined,
      sort,
      page: parseInt(page),
    };
    const cacheKey = `movies:discover:${JSON.stringify(params)}`;
    const data = await cached(cacheKey, () => tmdb.discover(params), CACHE_TTL.GENRE);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Discover failed' });
  }
});

/**
 * GET /movies/genres
 */
router.get('/genres', async (_req: Request, res: Response) => {
  try {
    const data = await cached('movies:genres', () => tmdb.getGenres(), CACHE_TTL.TMDB, 'long');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load genres' });
  }
});

/**
 * GET /movies/trending?type=all&time=week
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const type = qs(req.query.type) || 'all';
    const time = qs(req.query.time) || 'week';
    const data = await cached(`movies:trending:${type}:${time}`, () => tmdb.trending(type, time), CACHE_TTL.GENRE);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load trending' });
  }
});

/**
 * GET /movies/find-tmdb?title=&type=movie&year=
 */
router.get('/find-tmdb', async (req: Request, res: Response) => {
  try {
    const title = qs(req.query.title);
    const ftype = qs(req.query.type) || 'movie';
    const fyear = qs(req.query.year);
    if (!title) return res.status(400).json({ error: 'Missing title' });
    const data = await cached(
      `movies:find-tmdb:${title}:${ftype}:${fyear}`,
      () => tmdb.findDetailsByTitle(title, ftype, fyear),
      CACHE_TTL.TMDB, 'long'
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'TMDB lookup failed' });
  }
});

// ========== GOKU DIRECT ==========

router.get('/goku/info/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`goku:info:${req.params.id}`,
      () => consumet.movieInfo(qs(req.params.id), 'goku'), CACHE_TTL.INFO, 'long');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get Goku info' });
  }
});

// ========== LK21 DIRECT ==========

router.get('/lk21/info/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`lk21:info:${req.params.id}`,
      () => consumet.lk21Info(qs(req.params.id)), CACHE_TTL.INFO, 'long');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get LK21 info' });
  }
});

router.get('/lk21/series/info/:id', async (req: Request, res: Response) => {
  try {
    const data = await cached(`lk21:series:info:${req.params.id}`,
      () => consumet.lk21SeriesInfo(qs(req.params.id)), CACHE_TTL.INFO, 'long');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get LK21 series info' });
  }
});

router.get('/lk21/streams/:id', async (req: Request, res: Response) => {
  try {
    const data = await consumet.lk21MovieStreams(qs(req.params.id));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get LK21 streams' });
  }
});

router.get('/lk21/series/streams/:id', async (req: Request, res: Response) => {
  try {
    const season = parseInt(qs(req.query.season) || '1');
    const episode = parseInt(qs(req.query.episode) || '1');
    const data = await consumet.lk21SeriesStreams(qs(req.params.id), season, episode);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get LK21 series streams' });
  }
});

export default router;
