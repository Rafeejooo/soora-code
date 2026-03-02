import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

/**
 * Consumet API client — talks to localhost:3000 (same VPS).
 * Internal latency ~0-2ms, so we can make many parallel calls cheaply.
 */
const client: AxiosInstance = axios.create({
  baseURL: config.consumetUrl,
  timeout: 10000,
});

// ========== ANIME ==========

export async function animeSearch(query: string, page = 1, provider = 'animekai') {
  const res = await client.get(`/anime/${provider}/${encodeURIComponent(query)}`, { params: { page } });
  return res.data;
}

export async function animeInfo(id: string, provider = 'animekai') {
  const res = await client.get(`/anime/${provider}/info`, { params: { id } });
  return res.data;
}

export async function animeSpotlight(provider = 'animekai') {
  const res = await client.get(`/anime/${provider}/spotlight`);
  return res.data;
}

export async function animeRecentEpisodes(page = 1, provider = 'animekai') {
  const res = await client.get(`/anime/${provider}/recent-episodes`, { params: { page } });
  return res.data;
}

export async function animeMostPopular(page = 1) {
  const res = await client.get('/anime/hianime/most-popular', { params: { page } });
  return res.data;
}

export async function animeTopAiring(page = 1) {
  const res = await client.get('/anime/hianime/top-airing', { params: { page } });
  return res.data;
}

export async function animeByGenre(genre: string, page = 1, provider = 'hianime') {
  const res = await client.get(`/anime/${provider}/genre/${encodeURIComponent(genre)}`, { params: { page } });
  return res.data;
}

export async function animeAdvancedSearch(params: Record<string, any>) {
  const res = await client.get('/anime/hianime/advanced-search', { params });
  return res.data;
}

export async function animeServers(episodeId: string) {
  const res = await client.get(`/anime/animekai/servers/${encodeURIComponent(episodeId)}`);
  return res.data;
}

export async function animeWatch(episodeId: string, provider = 'animekai', params: Record<string, any> = {}) {
  if (provider === 'animepahe') {
    const res = await client.get('/anime/animepahe/watch', { params: { episodeId } });
    return res.data;
  }
  const res = await client.get(`/anime/${provider}/watch/${encodeURIComponent(episodeId)}`, { params });
  return res.data;
}

// ========== MOVIES ==========

export async function movieSearch(query: string, provider = 'goku') {
  const res = await client.get(`/movies/${provider}/${encodeURIComponent(query)}`);
  return res.data;
}

export async function movieInfo(id: string, provider = 'goku') {
  const res = await client.get(`/movies/${provider}/info`, { params: { id } });
  return res.data;
}

export async function movieWatch(episodeId: string, mediaId: string, provider = 'goku') {
  const res = await client.get(`/movies/${provider}/watch`, { params: { episodeId, mediaId } });
  return res.data;
}

export async function movieTrending(type = 'movie', provider = 'goku') {
  const res = await client.get(`/movies/${provider}/trending`, { params: { type } });
  return res.data;
}

export async function movieRecentMovies(provider = 'goku') {
  const res = await client.get(`/movies/${provider}/recent-movies`);
  return res.data;
}

export async function movieRecentShows(provider = 'goku') {
  const res = await client.get(`/movies/${provider}/recent-shows`);
  return res.data;
}

// ========== LK21 ==========

export async function lk21Popular(page = 1) {
  const res = await client.get('/movies/lk21/popular', { params: { page } });
  return res.data;
}

export async function lk21Recent(page = 1) {
  const res = await client.get('/movies/lk21/recent', { params: { page } });
  return res.data;
}

export async function lk21TopRated(page = 1) {
  const res = await client.get('/movies/lk21/top-rated', { params: { page } });
  return res.data;
}

export async function lk21LatestSeries(page = 1) {
  const res = await client.get('/movies/lk21/series', { params: { page } });
  return res.data;
}

export async function lk21PopularSeries(page = 1) {
  const res = await client.get('/movies/lk21/series/popular', { params: { page } });
  return res.data;
}

export async function lk21Search(query: string) {
  const res = await client.get(`/movies/lk21/search/${encodeURIComponent(query)}`);
  return res.data;
}

export async function lk21Info(id: string) {
  const res = await client.get(`/movies/lk21/info/${encodeURIComponent(id)}`);
  return res.data;
}

export async function lk21SeriesInfo(id: string) {
  const res = await client.get(`/movies/lk21/series/info/${encodeURIComponent(id)}`);
  return res.data;
}

export async function lk21MovieStreams(id: string) {
  const res = await client.get(`/movies/lk21/streams/${encodeURIComponent(id)}`);
  return res.data;
}

export async function lk21SeriesStreams(id: string, season = 1, episode = 1) {
  const res = await client.get(`/movies/lk21/series/streams/${encodeURIComponent(id)}`, {
    params: { season, episode },
  });
  return res.data;
}

// ========== MANGA ==========

export async function mangaSearch(query: string, provider = 'mangapill') {
  const res = await client.get(`/manga/${provider}/${encodeURIComponent(query)}`);
  return res.data;
}

export async function mangaInfo(id: string, provider = 'mangapill', params: Record<string, any> = {}) {
  if (provider === 'mangadex') {
    const res = await client.get(`/manga/mangadex/info/${encodeURIComponent(id)}`, { params });
    return res.data;
  }
  const res = await client.get(`/manga/${provider}/info`, { params: { id, ...params } });
  return res.data;
}

export async function mangaRead(chapterId: string, provider = 'mangapill') {
  if (provider === 'mangadex') {
    const res = await client.get(`/manga/mangadex/read/${encodeURIComponent(chapterId)}`);
    return res.data;
  }
  const res = await client.get(`/manga/${provider}/read`, { params: { chapterId } });
  return res.data;
}

export async function komikuTrending() {
  const res = await client.get('/manga/komiku/trending');
  return res.data;
}

export async function komikuSearch(query: string) {
  const res = await client.get(`/manga/komiku/${encodeURIComponent(query)}`);
  return res.data;
}

export async function komikuInfo(id: string) {
  const res = await client.get('/manga/komiku/info', { params: { id } });
  return res.data;
}

export async function komikuRead(chapterId: string) {
  const res = await client.get('/manga/komiku/read', { params: { chapterId } });
  return res.data;
}

// ========== RAW PASSTHROUGH ==========
// For any route not explicitly orchestrated, proxy to Consumet
export async function passthrough(path: string, params: Record<string, any> = {}) {
  const res = await client.get(path, { params });
  return res.data;
}

export default client;
