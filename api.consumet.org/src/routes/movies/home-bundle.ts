import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { MOVIES } from '@consumet/extensions';

import cache from '../../utils/cache';
import { redis, REDIS_TTL } from '../../main';
import { Redis } from 'ioredis';
import { applyWarpToProvider } from '../../utils/warp';

/**
 * /movies/home-bundle
 * Returns ALL movie homepage data in a single request, cached in Redis.
 * Eliminates 14+ round-trips from the frontend.
 *
 * Response shape:
 * {
 *   trendingMovies: [...],
 *   trendingTV: [...],
 *   recentMovies: [...],
 *   recentTV: [...],
 * }
 */
const BUNDLE_TTL = Math.max(REDIS_TTL, 1800); // at least 30 min

// ─── In-memory cache (fallback when no Redis) ───
const _memStore = new Map<string, { data: any; ts: number }>();
async function memCache<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
  const now = Date.now();
  const cached = _memStore.get(key);
  if (cached && now - cached.ts < ttl * 1000) return cached.data as T;
  const data = await fetcher();
  _memStore.set(key, { data, ts: now });
  return data;
}

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  const goku = new MOVIES.Goku();
  applyWarpToProvider(goku, fastify.log);

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cacheKey = 'movies:home-bundle:v1';

      const fetchBundle = async () => {
        // Fetch ALL base sections in parallel
        const [
          trendingMoviesRes,
          trendingTVRes,
          recentMoviesRes,
          recentTVRes,
        ] = await Promise.allSettled([
          goku.fetchTrendingMovies(),
          goku.fetchTrendingTvShows(),
          goku.fetchRecentMovies(),
          goku.fetchRecentTvShows(),
        ]);

        const extract = (r: PromiseSettledResult<any>) =>
          r.status === 'fulfilled' ? (r.value?.results || r.value || []) : [];

        return {
          trendingMovies: extract(trendingMoviesRes).slice(0, 24),
          trendingTV: extract(trendingTVRes).slice(0, 24),
          recentMovies: extract(recentMoviesRes).slice(0, 24),
          recentTV: extract(recentTVRes).slice(0, 24),
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
      reply.status(500).send({
        message: 'Failed to fetch movie home bundle.',
      });
    }
  });
};

export default routes;
