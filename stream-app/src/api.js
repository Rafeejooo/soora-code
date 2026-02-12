import axios from 'axios';

// ========== CONFIG ==========
const API_BASE = '/api';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

const api = axios.create({ baseURL: API_BASE, timeout: 30000 });
const tmdb = axios.create({
  baseURL: TMDB_BASE,
  timeout: 15000,
  params: { api_key: TMDB_KEY },
});

// ========== CACHE ==========
// Persistent cache backed by sessionStorage + in-memory for speed
const memCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;       // 10 min default
const MANGA_CACHE_TTL = 30 * 60 * 1000; // 30 min for slow manga fetches

const _ssKey = (k) => `soora_cache:${k}`;

const cachedGet = async (key, fetcher, ttl = CACHE_TTL) => {
  const now = Date.now();

  // 1) In-memory hit
  const mem = memCache.get(key);
  if (mem && now - mem.ts < ttl) return mem.data;

  // 2) sessionStorage hit
  try {
    const raw = sessionStorage.getItem(_ssKey(key));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (now - parsed.ts < ttl) {
        memCache.set(key, parsed);
        return parsed.data;
      }
      sessionStorage.removeItem(_ssKey(key));
    }
  } catch { /* quota exceeded or parse error — ignore */ }

  // 3) Fetch fresh
  const data = await fetcher();
  const entry = { data, ts: now };
  memCache.set(key, entry);
  try { sessionStorage.setItem(_ssKey(key), JSON.stringify(entry)); } catch {}
  return data;
};

// ========== TMDB HELPERS ==========
export const tmdbImg = (path, size = 'w500') =>
  path ? `${TMDB_IMG}/${size}${path}` : null;

export const tmdbBackdrop = (path) =>
  path ? `${TMDB_IMG}/original${path}` : null;

export const hasTMDBKey = () => !!TMDB_KEY;

const normalizeTMDB = (item) => ({
  id: item.id,
  tmdbId: item.id,
  title: item.title || item.name || 'Unknown',
  image: tmdbImg(item.poster_path),
  cover: tmdbBackdrop(item.backdrop_path),
  releaseDate: item.release_date || item.first_air_date || '',
  rating: item.vote_average ? Math.round(item.vote_average * 10) : null,
  type:
    item.media_type === 'tv' || item.number_of_seasons || item.first_air_date
      ? 'TV Series'
      : 'Movie',
  mediaType:
    item.media_type ||
    (item.number_of_seasons || item.first_air_date ? 'tv' : 'movie'),
  overview: item.overview || '',
});

// ========== ANIME (AnimeKai — primary, HiAnime — fallback, AnimePahe — tertiary) ==========

// Multi-provider search: tries AnimeKai first, enriches with HiAnime & AnimePahe results
export const searchAnime = (query, page = 1) =>
  cachedGet(`search:anime:${query}:${page}`, async () => {
    const results = await Promise.allSettled([
      api.get(`/anime/animekai/${encodeURIComponent(query)}`, { params: { page } }),
      api.get(`/anime/hianime/${encodeURIComponent(query)}`, { params: { page } }),
      api.get(`/anime/animepahe/${encodeURIComponent(query)}`),
    ]);

    const ankaiRes = results[0].status === 'fulfilled' ? results[0].value : null;
    const hiRes = results[1].status === 'fulfilled' ? results[1].value : null;
    const paheRes = results[2].status === 'fulfilled' ? results[2].value : null;

    // Merge: start with AnimeKai, then add unique titles from HiAnime & AnimePahe
    const ankaiItems = ankaiRes?.data?.results || [];
    const merged = [...ankaiItems];
    const seenTitles = new Set(ankaiItems.map(i => (i.title || '').toLowerCase().trim()));

    const addUnique = (items, provider) => {
      for (const item of items) {
        const t = (item.title || '').toLowerCase().trim();
        if (t && !seenTitles.has(t)) {
          seenTitles.add(t);
          merged.push({ ...item, _provider: provider });
        }
      }
    };

    addUnique(hiRes?.data?.results || [], 'hianime');
    addUnique(paheRes?.data?.results || [], 'animepahe');

    return {
      data: {
        results: merged,
        currentPage: ankaiRes?.data?.currentPage || 1,
        hasNextPage: ankaiRes?.data?.hasNextPage || false,
      },
    };
  });

export const getAnimeInfo = (id) =>
  cachedGet(`anime:info:${id}`, () =>
    api.get('/anime/animekai/info', { params: { id } })
  );

// HiAnime info — used for malID/alID (embed fallback) and richer metadata
export const getHiAnimeInfo = (id) =>
  cachedGet(`hianime:info:${id}`, () =>
    api.get('/anime/hianime/info', { params: { id } })
  );

// AnimePahe info
export const getAnimePaheInfo = (id) =>
  cachedGet(`animepahe:info:${id}`, () =>
    api.get(`/anime/animepahe/info/${encodeURIComponent(id)}`)
  );

// Get available servers for an episode
export const getAnimeServers = (episodeId) =>
  api.get(`/anime/animekai/servers/${encodeURIComponent(episodeId)}`);

// Watch with auto-fallback: AnimeKai → HiAnime → AnimePahe
export const watchAnimeEpisode = async (episodeId, server, category, epNumber) => {
  // 1) Try AnimeKai
  try {
    const res = await api.get(`/anime/animekai/watch/${encodeURIComponent(episodeId)}`, {
      params: { server, category },
    });
    if (res.data?.sources?.length > 0) return res;
  } catch { /* continue to fallback */ }

  // Extract slug and episode number for fallback providers
  // Prefer explicitly passed epNumber (from URL params), then try to parse from ID, then default to 1
  const slugMatch = episodeId.match(/^(.+?)(?:\$|$)/);
  const epMatch = episodeId.match(/\$ep=(\d+)/);
  const epNum = epNumber ? parseInt(epNumber) : (epMatch ? parseInt(epMatch[1]) : 1);
  const slug = slugMatch ? slugMatch[1] : '';
  const searchQuery = slug.replace(/-\w{2,5}$/, '').replace(/-/g, ' ');

  // 2) Try HiAnime
  try {
    const searchRes = await api.get(`/anime/hianime/${encodeURIComponent(searchQuery)}`);
    const results = searchRes.data?.results || [];
    if (results.length > 0) {
      const infoRes = await api.get('/anime/hianime/info', { params: { id: results[0].id } });
      const eps = infoRes.data?.episodes || [];
      const targetEp = eps.find(e => e.number === epNum) || eps[epNum - 1] || eps[0];
      if (targetEp) {
        const watchRes = await api.get(`/anime/hianime/watch/${encodeURIComponent(targetEp.id)}`);
        if (watchRes.data?.sources?.length > 0) {
          watchRes.data._fallback = 'hianime';
          return watchRes;
        }
      }
    }
  } catch { /* continue to fallback */ }

  // 3) Try AnimePahe
  try {
    const searchRes = await api.get(`/anime/animepahe/${encodeURIComponent(searchQuery)}`);
    const results = searchRes.data?.results || [];
    if (results.length > 0) {
      const infoRes = await api.get(`/anime/animepahe/info/${encodeURIComponent(results[0].id)}`);
      const eps = infoRes.data?.episodes || [];
      const targetEp = eps.find(e => e.number === epNum) || eps[epNum - 1] || eps[0];
      if (targetEp) {
        const watchRes = await api.get('/anime/animepahe/watch', { params: { episodeId: targetEp.id } });
        if (watchRes.data?.sources?.length > 0) {
          watchRes.data._fallback = 'animepahe';
          return watchRes;
        }
      }
    }
  } catch { /* final fallback failed */ }

  throw new Error('Stream unavailable on all providers');
};

// Also support watching directly from a specific provider (for search results from that provider)
export const watchAnimeEpisodeByProvider = async (episodeId, provider = 'animekai', server, category) => {
  if (provider === 'hianime') {
    return api.get(`/anime/hianime/watch/${encodeURIComponent(episodeId)}`, { params: { server, category } });
  }
  if (provider === 'animepahe') {
    return api.get('/anime/animepahe/watch', { params: { episodeId } });
  }
  // Default: AnimeKai with full fallback chain
  return watchAnimeEpisode(episodeId, server, category);
};

export const getAnimeRecentEpisodes = (page = 1) =>
  cachedGet(`anime:recent:${page}`, async () => {
    // Try AnimeKai first, fallback to HiAnime
    try {
      const res = await api.get('/anime/animekai/recent-episodes', { params: { page } });
      if (res.data?.results?.length > 0 || res.data?.length > 0) return res;
    } catch { /* fallback */ }
    return api.get('/anime/hianime/recently-updated', { params: { page } });
  });

export const getAnimeSpotlight = () =>
  cachedGet('anime:spotlight', async () => {
    try {
      const res = await api.get('/anime/animekai/spotlight');
      if (res.data?.results?.length > 0 || res.data?.length > 0) return res;
    } catch { /* fallback */ }
    return api.get('/anime/hianime/spotlight');
  });

export const getAnimeNewReleases = (page = 1) =>
  cachedGet(`anime:new:${page}`, async () => {
    try {
      const res = await api.get('/anime/animekai/new-releases', { params: { page } });
      if (res.data?.results?.length > 0 || res.data?.length > 0) return res;
    } catch { /* fallback */ }
    return api.get('/anime/hianime/recently-added', { params: { page } });
  });

export const getAnimeLatestCompleted = (page = 1) =>
  cachedGet(`anime:completed:${page}`, async () => {
    try {
      const res = await api.get('/anime/animekai/latest-completed', { params: { page } });
      if (res.data?.results?.length > 0 || res.data?.length > 0) return res;
    } catch { /* fallback */ }
    return api.get('/anime/hianime/latest-completed', { params: { page } });
  });

// Additional listing endpoints from HiAnime
export const getAnimeMostPopular = (page = 1) =>
  cachedGet(`anime:popular:${page}`, () =>
    api.get('/anime/hianime/most-popular', { params: { page } })
  );

export const getAnimeTopAiring = (page = 1) =>
  cachedGet(`anime:airing:${page}`, () =>
    api.get('/anime/hianime/top-airing', { params: { page } })
  );

// ========== ANIME BROWSE: Genre, Type, Season, Advanced Search ==========

// Browse anime by genre (HiAnime primary, AnimeKai fallback)
export const getAnimeByGenre = (genre, page = 1) =>
  cachedGet(`anime:genre:${genre}:${page}`, async () => {
    try {
      const res = await api.get(`/anime/hianime/genre/${encodeURIComponent(genre)}`, { params: { page } });
      if (res.data?.results?.length > 0 || res.data?.length > 0) return res;
    } catch { /* fallback */ }
    return api.get(`/anime/animekai/genre/${encodeURIComponent(genre)}`, { params: { page } });
  });

// Browse anime by type (movie, tv, ova, ona, special)
export const getAnimeByType = (type, page = 1) =>
  cachedGet(`anime:type:${type}:${page}`, async () => {
    return api.get(`/anime/hianime/${type}`, { params: { page } });
  });

// Advanced search with combined filters (HiAnime)
// params: { type, status, season, genres, startDate, endDate, sort, page }
export const getAnimeAdvancedSearch = (params = {}) => {
  const { type, season, genres, year, sort, page = 1 } = params;
  const queryParams = { page };
  if (type) queryParams.type = type;
  if (season) queryParams.season = season;
  if (genres) queryParams.genres = genres; // comma-separated
  if (sort) queryParams.sort = sort;
  if (year) {
    // Season ranges: Winter=Jan-Mar, Spring=Apr-Jun, Summer=Jul-Sep, Fall=Oct-Dec
    const seasonStartMonth = { winter: '01', spring: '04', summer: '07', fall: '10' };
    const seasonEndMonth = { winter: '03', spring: '06', summer: '09', fall: '12' };
    if (season && seasonStartMonth[season]) {
      queryParams.startDate = `${year}-${seasonStartMonth[season]}-01`;
      queryParams.endDate = `${year}-${seasonEndMonth[season]}-28`;
    } else {
      queryParams.startDate = `${year}-01-01`;
      queryParams.endDate = `${year}-12-31`;
    }
  }
  const cacheKey = `anime:advsearch:${JSON.stringify(queryParams)}`;
  return cachedGet(cacheKey, () =>
    api.get('/anime/hianime/advanced-search', { params: queryParams })
  );
};

// Get anime genre list
export const getAnimeGenreList = () =>
  cachedGet('anime:genres', async () => {
    try {
      const res = await api.get('/anime/hianime/genres');
      if (res.data?.length > 0) return res;
    } catch { /* fallback */ }
    return api.get('/anime/animekai/genre/list');
  });

// ========== MOVIES / TV (TMDB) ==========
export const searchMoviesTMDB = (query, page = 1) =>
  cachedGet(`tmdb:search:${query}:${page}`, async () => {
    const res = await tmdb.get('/search/multi', {
      params: { query, page, include_adult: false },
    });
    return {
      data: {
        results: res.data.results
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
          .map(normalizeTMDB),
        totalPages: res.data.total_pages,
      },
    };
  });

export const getMovieDetailsTMDB = (id) =>
  cachedGet(`tmdb:movie:${id}`, async () => {
    const res = await tmdb.get(`/movie/${id}`, {
      params: { append_to_response: 'credits,recommendations,similar,videos' },
    });
    return { data: res.data };
  });

export const getTVDetailsTMDB = (id) =>
  cachedGet(`tmdb:tv:${id}`, async () => {
    const res = await tmdb.get(`/tv/${id}`, {
      params: { append_to_response: 'credits,recommendations,similar,videos' },
    });
    return { data: res.data };
  });

export const getTVSeasonTMDB = (id, season) =>
  cachedGet(`tmdb:tv:${id}:s${season}`, async () => {
    const res = await tmdb.get(`/tv/${id}/season/${season}`);
    return { data: res.data };
  });

// Search TMDB by title and return full details (credits, recommendations, similar)
// Used to enrich Goku data with TMDB metadata (cast images, recs, backdrop, etc.)
export const findTMDBDetailsByTitle = (title, mediaType = 'movie', year = '') =>
  cachedGet(`tmdb:find:${title}:${mediaType}:${year}`, async () => {
    if (!TMDB_KEY) return { data: null };
    try {
      const searchType = mediaType === 'tv' ? 'tv' : 'movie';
      const searchRes = await tmdb.get(`/search/${searchType}`, {
        params: { query: title, include_adult: false, ...(year ? { year } : {}) },
      });
      const results = searchRes.data?.results || [];
      if (results.length === 0) return { data: null };
      // Pick best match (first result, or exact title match)
      const exact = results.find(
        (r) => (r.title || r.name || '').toLowerCase() === title.toLowerCase()
      );
      const best = exact || results[0];
      // Fetch full details with credits, recs, similar
      const detailRes = await tmdb.get(`/${searchType}/${best.id}`, {
        params: { append_to_response: 'credits,recommendations,similar,videos' },
      });
      return { data: detailRes.data };
    } catch {
      return { data: null };
    }
  });

export const getTrendingTMDB = (type = 'all', time = 'week') =>
  cachedGet(`tmdb:trending:${type}:${time}`, async () => {
    const res = await tmdb.get(`/trending/${type}/${time}`);
    return {
      data: {
        results: res.data.results
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
          .map(normalizeTMDB),
      },
    };
  });

export const getPopularMovies = (page = 1) =>
  cachedGet(`tmdb:popular:movie:${page}`, async () => {
    const res = await tmdb.get('/movie/popular', { params: { page } });
    return {
      data: {
        results: res.data.results.map((r) =>
          normalizeTMDB({ ...r, media_type: 'movie' })
        ),
      },
    };
  });

export const getPopularTV = (page = 1) =>
  cachedGet(`tmdb:popular:tv:${page}`, async () => {
    const res = await tmdb.get('/tv/popular', { params: { page } });
    return {
      data: {
        results: res.data.results.map((r) =>
          normalizeTMDB({ ...r, media_type: 'tv' })
        ),
      },
    };
  });

// ========== TMDB GENRES & DISCOVER ==========
export const getTMDBGenres = () =>
  cachedGet('tmdb:genres', async () => {
    const [movieRes, tvRes] = await Promise.all([
      tmdb.get('/genre/movie/list'),
      tmdb.get('/genre/tv/list'),
    ]);
    const map = new Map();
    [...movieRes.data.genres, ...tvRes.data.genres].forEach((g) =>
      map.set(g.id, g.name)
    );
    return { data: Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)) };
  });

export const discoverByGenre = (genreId, page = 1, mediaType = 'movie') =>
  cachedGet(`tmdb:discover:${mediaType}:${genreId}:${page}`, async () => {
    const res = await tmdb.get(`/discover/${mediaType}`, {
      params: {
        with_genres: genreId,
        page,
        sort_by: 'popularity.desc',
      },
    });
    return {
      data: {
        results: res.data.results.map((r) =>
          normalizeTMDB({ ...r, media_type: mediaType })
        ),
        totalPages: res.data.total_pages,
      },
    };
  });

/**
 * Advanced TMDB discover — supports genre, year, sort, and media type filters.
 * @param {{ mediaType?: 'movie'|'tv', genre?: number, year?: string|number, sort?: string, page?: number }} params
 */
export const discoverTMDB = ({ mediaType = 'movie', genre, year, sort = 'popularity.desc', page = 1 } = {}) => {
  const key = `tmdb:adv:${mediaType}:${genre || ''}:${year || ''}:${sort}:${page}`;
  return cachedGet(key, async () => {
    const params = { page, sort_by: sort };
    if (genre) params.with_genres = genre;
    if (year) {
      if (mediaType === 'movie') {
        params.primary_release_year = year;
      } else {
        params.first_air_date_year = year;
      }
    }
    const res = await tmdb.get(`/discover/${mediaType}`, { params });
    return {
      data: {
        results: res.data.results.map((r) =>
          normalizeTMDB({ ...r, media_type: mediaType })
        ),
        totalPages: res.data.total_pages,
      },
    };
  });
};

// ========== MOVIE / TV STREAMING (Goku — primary, FlixHQ — fallback) ==========
// Goku returns accessible HLS m3u8 sources with multiple quality levels.

// Helper: search FlixHQ/HiMovies for a title and return the best match
const _searchMovieProvider = async (provider, title, year, type) => {
  const res = await api.get(`/movies/${provider}/${encodeURIComponent(title)}`);
  const results = res.data?.results || [];
  if (results.length === 0) return null;

  // Try to match by title + year + type for best accuracy
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const titleNorm = normalize(title);
  const typeFilter = type === 'tv' ? 'TV Series' : 'Movie';

  // Prioritize: exact title + correct type + matching year
  const scored = results.map((r) => {
    let score = 0;
    const rTitle = normalize(r.title);
    if (rTitle === titleNorm) score += 10;
    else if (rTitle.includes(titleNorm) || titleNorm.includes(rTitle)) score += 5;
    if (r.type === typeFilter) score += 3;
    if (year && r.releaseDate && r.releaseDate.startsWith(String(year))) score += 2;
    return { ...r, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored[0] || results[0];
};

// Get streaming sources for a movie
export const getMovieStreamingSources = async (title, tmdbId, year) =>
  cachedGet(`stream:movie:${tmdbId}`, async () => {
    const providers = ['goku', 'flixhq'];

    for (const provider of providers) {
      try {
        // 1) Search for the movie
        const match = await _searchMovieProvider(provider, title, year, 'movie');
        if (!match) continue;

        // 2) Get info (which includes the episodeId for movies)
        const infoRes = await api.get(`/movies/${provider}/info`, { params: { id: match.id } });
        const info = infoRes.data;
        const episode = info.episodes?.[0] || info.episodes;

        if (!episode?.id) continue;

        // 3) Get streaming sources
        const watchRes = await api.get(`/movies/${provider}/watch`, {
          params: { episodeId: episode.id, mediaId: match.id },
        });

        if (watchRes.data?.sources?.length > 0) {
          return {
            data: {
              ...watchRes.data,
              _provider: provider,
              _mediaTitle: info.title || title,
            },
          };
        }
      } catch {
        continue; // try next provider
      }
    }

    throw new Error('No streaming sources found');
  });

// Get streaming sources for a TV episode
export const getTVStreamingSources = async (title, tmdbId, season, episode, year) =>
  cachedGet(`stream:tv:${tmdbId}:s${season}e${episode}`, async () => {
    const providers = ['goku', 'flixhq'];

    for (const provider of providers) {
      try {
        // 1) Search for the TV show
        const match = await _searchMovieProvider(provider, title, year, 'tv');
        if (!match) continue;

        // 2) Get info (includes all episodes with season/number)
        const infoRes = await api.get(`/movies/${provider}/info`, { params: { id: match.id } });
        const info = infoRes.data;
        const episodes = info.episodes || [];

        // 3) Find the matching episode by season + episode number
        const targetEp = episodes.find(
          (ep) => ep.season === season && ep.number === episode
        );
        if (!targetEp) continue;

        // 4) Get streaming sources
        const watchRes = await api.get(`/movies/${provider}/watch`, {
          params: { episodeId: targetEp.id, mediaId: match.id },
        });

        if (watchRes.data?.sources?.length > 0) {
          return {
            data: {
              ...watchRes.data,
              _provider: provider,
              _mediaTitle: info.title || title,
              _episodeTitle: targetEp.title,
            },
          };
        }
      } catch {
        continue; // try next provider
      }
    }

    throw new Error('No streaming sources found for this episode');
  });

// ========== GOKU INFO & DIRECT STREAMING ==========
export const getGokuInfo = (gokuId) =>
  cachedGet(`goku:info:${gokuId}`, async () => {
    const res = await api.get('/movies/goku/info', { params: { id: gokuId } });
    return { data: res.data };
  });

// Stream directly by Goku ID (skips search, much faster)
export const getGokuMovieStream = (gokuId) =>
  cachedGet(`goku:stream:movie:${gokuId}`, async () => {
    const infoRes = await api.get('/movies/goku/info', { params: { id: gokuId } });
    const info = infoRes.data;
    const ep = info.episodes?.[0];
    if (!ep?.id) throw new Error('No episode found');
    const watchRes = await api.get('/movies/goku/watch', {
      params: { episodeId: ep.id, mediaId: gokuId },
    });
    if (!watchRes.data?.sources?.length) throw new Error('No sources');
    return { data: { ...watchRes.data, _provider: 'goku', _mediaTitle: info.title } };
  });

export const getGokuTVStream = (gokuId, season, episode) =>
  cachedGet(`goku:stream:tv:${gokuId}:s${season}e${episode}`, async () => {
    const infoRes = await api.get('/movies/goku/info', { params: { id: gokuId } });
    const info = infoRes.data;
    const episodes = info.episodes || [];
    const targetEp = episodes.find((ep) => ep.season === season && ep.number === episode);
    if (!targetEp) throw new Error('Episode not found');
    const watchRes = await api.get('/movies/goku/watch', {
      params: { episodeId: targetEp.id, mediaId: gokuId },
    });
    if (!watchRes.data?.sources?.length) throw new Error('No sources');
    return { data: { ...watchRes.data, _provider: 'goku', _mediaTitle: info.title, _episodeTitle: targetEp.title } };
  });

// ========== GOKU MOVIE LISTINGS ==========
// Normalize Goku items to match our Card component format
const normalizeGoku = (item) => ({
  id: item.id,
  title: item.title || 'Unknown',
  image: item.image || '',
  type: item.type || 'Movie',
  releaseDate: item.releaseDate || '',
  duration: item.duration || '',
  mediaType: item.type === 'TV Series' ? 'tv' : 'movie',
  season: item.season || '',
  latestEpisode: item.latestEpisode || '',
});

export const getGokuTrendingMovies = () =>
  cachedGet('goku:trending:movie', async () => {
    const res = await api.get('/movies/goku/trending', { params: { type: 'movie' } });
    return { data: (Array.isArray(res.data) ? res.data : res.data?.results || []).map(normalizeGoku) };
  });

export const getGokuTrendingTV = () =>
  cachedGet('goku:trending:tv', async () => {
    const res = await api.get('/movies/goku/trending', { params: { type: 'tv' } });
    return { data: (Array.isArray(res.data) ? res.data : res.data?.results || []).map(normalizeGoku) };
  });

export const getGokuRecentMovies = () =>
  cachedGet('goku:recent:movie', async () => {
    const res = await api.get('/movies/goku/recent-movies');
    return { data: (Array.isArray(res.data) ? res.data : res.data?.results || []).map(normalizeGoku) };
  });

export const getGokuRecentTV = () =>
  cachedGet('goku:recent:tv', async () => {
    const res = await api.get('/movies/goku/recent-shows');
    return { data: (Array.isArray(res.data) ? res.data : res.data?.results || []).map(normalizeGoku) };
  });

// Search movies/TV via Goku (no TMDB key needed)
export const searchGoku = async (query) => {
  const res = await api.get(`/movies/goku/${encodeURIComponent(query)}`);
  const items = (res.data?.results || []).map(normalizeGoku);
  return { data: { results: items } };
};

// ========== MANGA (MangaPill — primary, MangaHere — fallback) ==========
const normalizeMangaTitle = (title) => {
  if (!title) return 'Unknown';
  if (typeof title !== 'string') {
    return title.english || title.romaji || title.userPreferred || title.native || 'Unknown';
  }
  // MangaPill concatenates two title variants without separator
  // e.g., "Solo Leveling NovelSolo Leveling Official Light Novel"
  const idx = title.search(/[a-z][A-Z]/);
  if (idx !== -1 && idx >= 2 && title.length - idx - 1 >= 4) {
    return title.slice(0, idx + 1);
  }
  return title;
};

// Proxy manga images through our server to add required Referer header
export const mangaImgProxy = (url) => {
  if (!url) return '';
  if (url.includes('readdetectiveconan.com') || url.includes('mangapill')) {
    return `/manga-img?url=${encodeURIComponent(url)}`;
  }
  return url;
};

// Detect if a MangaPill item is actually a novel (not a manga/manhwa)
export const isMangaNovel = (item) => {
  if (!item) return false;
  const id = (item.id || '').toLowerCase();
  const title = (typeof item.title === 'string' ? item.title : '').toLowerCase();
  return id.includes('-novel') || /\bnovel\b/i.test(title) || /\blight novel\b/i.test(title);
};

// Get content type label for a manga item
export const getMangaContentType = (item) => {
  if (isMangaNovel(item)) return 'Novel';
  const title = (typeof item.title === 'string' ? item.title : '').toLowerCase();
  if (title.includes('manhwa') || title.includes('manhua')) return 'Manhwa';
  return 'Manga';
};

export const searchManga = (query, page = 1) =>
  cachedGet(`manga:search:${query}:${page}`, async () => {
    try {
      const res = await api.get(`/manga/mangapill/${encodeURIComponent(query)}`);
      return res;
    } catch {
      return api.get(`/manga/mangahere/${encodeURIComponent(query)}`, { params: { page } });
    }
  }, MANGA_CACHE_TTL);

export const getMangaInfo = (id, provider = 'mangapill') =>
  cachedGet(`manga:info:${provider}:${id}`, () => {
    if (provider === 'mangahere') {
      return api.get('/manga/mangahere/info', { params: { id } });
    }
    return api.get('/manga/mangapill/info', { params: { id } });
  }, MANGA_CACHE_TTL);

export const getMangaChapterPages = (chapterId, provider = 'mangapill') =>
  cachedGet(`manga:read:${provider}:${chapterId}`, () => {
    if (provider === 'mangahere') {
      return api.get('/manga/mangahere/read', { params: { chapterId } });
    }
    return api.get('/manga/mangapill/read', { params: { chapterId } });
  }, MANGA_CACHE_TTL);

// MangaPill doesn't have latestmanga/bygenre, use search with popular terms
export const getPopularManga = () =>
  cachedGet('manga:popular', async () => {
    const queries = ['one piece', 'naruto', 'demon slayer', 'jujutsu kaisen', 'solo leveling', 'attack on titan'];
    const randomQueries = queries.sort(() => Math.random() - 0.5).slice(0, 3);
    const results = await Promise.allSettled(
      randomQueries.map((q) => api.get(`/manga/mangapill/${encodeURIComponent(q)}`))
    );
    const all = [];
    const seen = new Set();
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        (r.value.data?.results || []).forEach((item) => {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            all.push(item);
          }
        });
      }
    });
    return { data: { results: all } };
  }, MANGA_CACHE_TTL);

// ========== MANGADEX (Multi-language support) ==========
export const MANGA_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'id', label: 'Indonesian', flag: '🇮🇩' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'zh-hk', label: 'Chinese (Traditional)', flag: '🇭🇰' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'es-la', label: 'Spanish (LATAM)', flag: '🇲🇽' },
  { code: 'pt-br', label: 'Portuguese (Brazil)', flag: '🇧🇷' },
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { code: 'th', label: 'Thai', flag: '🇹🇭' },
  { code: 'vi', label: 'Vietnamese', flag: '🇻🇳' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷' },
  { code: 'pl', label: 'Polish', flag: '🇵🇱' },
  { code: 'ms', label: 'Malay', flag: '🇲🇾' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
];

export const searchMangaDex = (query, page = 1) =>
  cachedGet(`mangadex:search:${query}:${page}`, async () => {
    return api.get(`/manga/mangadex/${encodeURIComponent(query)}`, { params: { page } });
  }, MANGA_CACHE_TTL);

export const getMangaDexInfo = (id, lang = 'en') =>
  cachedGet(`mangadex:info:${id}:${lang}`, async () => {
    return api.get(`/manga/mangadex/info/${encodeURIComponent(id)}`, { params: { lang } });
  }, MANGA_CACHE_TTL);

export const getMangaDexChapterPages = (chapterId) =>
  cachedGet(`mangadex:read:${chapterId}`, async () => {
    return api.get(`/manga/mangadex/read/${encodeURIComponent(chapterId)}`);
  }, MANGA_CACHE_TTL);

export const getMangaDexLanguages = (id) =>
  cachedGet(`mangadex:langs:${id}`, async () => {
    return api.get(`/manga/mangadex/info/${encodeURIComponent(id)}/languages`);
  }, MANGA_CACHE_TTL);

// ========== KOMIKU (Indonesian manga — komiku.org) ==========
export const searchKomiku = (query) =>
  cachedGet(`komiku:search:${query}`, async () => {
    return api.get(`/manga/komiku/${encodeURIComponent(query)}`);
  }, MANGA_CACHE_TTL);

export const getKomikuInfo = (id) =>
  cachedGet(`komiku:info:${id}`, async () => {
    return api.get(`/manga/komiku/info`, { params: { id } });
  }, MANGA_CACHE_TTL);

export const getKomikuChapterPages = (chapterId) =>
  cachedGet(`komiku:read:${chapterId}`, async () => {
    return api.get(`/manga/komiku/read`, { params: { chapterId } });
  }, MANGA_CACHE_TTL);

export const getKomikuTrending = () =>
  cachedGet(`komiku:trending`, async () => {
    return api.get(`/manga/komiku/trending`);
  }, MANGA_CACHE_TTL);

export { normalizeMangaTitle };

export default api;
