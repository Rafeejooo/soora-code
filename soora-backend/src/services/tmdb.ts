import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

const client: AxiosInstance = axios.create({
  baseURL: config.tmdbBase,
  timeout: 10000,
  params: { api_key: config.tmdbKey },
});

export const hasTMDBKey = () => !!config.tmdbKey;

// ========== NORMALIZE ==========

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type?: string;
  number_of_seasons?: number;
  overview?: string;
}

export function normalizeTMDB(item: TMDBItem) {
  return {
    id: item.id,
    tmdbId: item.id,
    title: item.title || item.name || 'Unknown',
    image: item.poster_path ? `${config.tmdbImg}/w500${item.poster_path}` : null,
    cover: item.backdrop_path ? `${config.tmdbImg}/original${item.backdrop_path}` : null,
    releaseDate: item.release_date || item.first_air_date || '',
    rating: item.vote_average ? Math.round(item.vote_average * 10) : null,
    type: item.media_type === 'tv' || item.number_of_seasons || item.first_air_date ? 'TV Series' : 'Movie',
    mediaType: item.media_type || (item.number_of_seasons || item.first_air_date ? 'tv' : 'movie'),
    overview: item.overview || '',
  };
}

// ========== SEARCH & DISCOVER ==========

export async function searchMulti(query: string, page = 1) {
  const res = await client.get('/search/multi', {
    params: { query, page, include_adult: false },
  });
  return {
    results: res.data.results
      .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
      .map(normalizeTMDB),
    totalPages: res.data.total_pages,
  };
}

export async function trending(type = 'all', time = 'week') {
  const res = await client.get(`/trending/${type}/${time}`);
  return {
    results: res.data.results
      .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
      .map(normalizeTMDB),
  };
}

export async function popularMovies(page = 1) {
  const res = await client.get('/movie/popular', { params: { page } });
  return {
    results: res.data.results.map((r: any) => normalizeTMDB({ ...r, media_type: 'movie' })),
  };
}

export async function popularTV(page = 1) {
  const res = await client.get('/tv/popular', { params: { page } });
  return {
    results: res.data.results.map((r: any) => normalizeTMDB({ ...r, media_type: 'tv' })),
  };
}

export async function getGenres() {
  const [movieRes, tvRes] = await Promise.all([
    client.get('/genre/movie/list'),
    client.get('/genre/tv/list'),
  ]);
  const map = new Map<number, string>();
  [...movieRes.data.genres, ...tvRes.data.genres].forEach((g: any) => map.set(g.id, g.name));
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function discover(params: {
  mediaType?: string;
  genre?: number;
  year?: string | number;
  sort?: string;
  page?: number;
}) {
  const { mediaType = 'movie', genre, year, sort = 'popularity.desc', page = 1 } = params;
  const queryParams: Record<string, any> = { page, sort_by: sort };
  if (genre) queryParams.with_genres = genre;
  if (year) {
    if (mediaType === 'movie') queryParams.primary_release_year = year;
    else queryParams.first_air_date_year = year;
  }
  const res = await client.get(`/discover/${mediaType}`, { params: queryParams });
  return {
    results: res.data.results.map((r: any) => normalizeTMDB({ ...r, media_type: mediaType })),
    totalPages: res.data.total_pages,
  };
}

// ========== DETAILS ==========

export async function movieDetails(id: number) {
  const res = await client.get(`/movie/${id}`, {
    params: { append_to_response: 'credits,recommendations,similar,videos' },
  });
  return res.data;
}

export async function tvDetails(id: number) {
  const res = await client.get(`/tv/${id}`, {
    params: { append_to_response: 'credits,recommendations,similar,videos' },
  });
  return res.data;
}

export async function tvSeason(id: number, season: number) {
  const res = await client.get(`/tv/${id}/season/${season}`);
  return res.data;
}

export async function findDetailsByTitle(title: string, mediaType = 'movie', year = '') {
  if (!config.tmdbKey) return null;
  try {
    const searchType = mediaType === 'tv' ? 'tv' : 'movie';
    const searchRes = await client.get(`/search/${searchType}`, {
      params: { query: title, include_adult: false, ...(year ? { year } : {}) },
    });
    const results = searchRes.data?.results || [];
    if (results.length === 0) return null;
    const exact = results.find((r: any) => (r.title || r.name || '').toLowerCase() === title.toLowerCase());
    const best = exact || results[0];
    const detailRes = await client.get(`/${searchType}/${best.id}`, {
      params: { append_to_response: 'credits,recommendations,similar,videos' },
    });
    return detailRes.data;
  } catch {
    return null;
  }
}

export async function discoverByGenre(genreId: number, page = 1, mediaType = 'movie') {
  const res = await client.get(`/discover/${mediaType}`, {
    params: { with_genres: genreId, page, sort_by: 'popularity.desc' },
  });
  return {
    results: res.data.results.map((r: any) => normalizeTMDB({ ...r, media_type: mediaType })),
    totalPages: res.data.total_pages,
  };
}

export default client;
