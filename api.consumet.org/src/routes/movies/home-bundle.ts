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
        bundle = await fetchBundle();
      }

      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      reply.status(200).send(bundle);
    } catch (err) {
      reply.status(500).send({
        message: 'Failed to fetch movie home bundle.',
      });
    }
  });
};

export default routes;
