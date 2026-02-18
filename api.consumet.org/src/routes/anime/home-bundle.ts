import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { ANIME } from '@consumet/extensions';

import cache from '../../utils/cache';
import { redis, REDIS_TTL } from '../../main';
import { Redis } from 'ioredis';

/**
 * /anime/home-bundle
 * Returns ALL homepage data in a single request, cached aggressively in Redis.
 * This eliminates 10+ round-trips from the frontend.
 *
 * Response shape:
 * {
 *   spotlight: [...],
 *   recentEpisodes: [...],
 *   mostPopular: [...],
 *   topAiring: [...],
 *   genres: { action: [...], romance: [...], ... }
 * }
 */

const GENRE_KEYS = [
  'action', 'romance', 'slice-of-life', 'fantasy', 'comedy', 'adventure',
  'sci-fi', 'drama', 'mystery', 'horror', 'sports', 'music',
];

// Longer TTL for the bundle since homepage data doesn't change often
const BUNDLE_TTL = Math.max(REDIS_TTL, 1800); // at least 30 min

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  const hianime = new ANIME.Hianime();
  let ankaiInstance: any = null;
  try {
    ankaiInstance = new ANIME.AnimeKai();
  } catch { /* AnimeKai may not be available */ }

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cacheKey = 'anime:home-bundle:v2';

      const fetchBundle = async () => {
        // Fetch ALL sections in parallel — this is the key optimization
        const [
          spotlightRes,
          recentRes,
          popularRes,
          airingRes,
          ...genreResults
        ] = await Promise.allSettled([
          // Core sections — try AnimeKai first, fallback to HiAnime
          (async () => {
            if (ankaiInstance) {
              try {
                const r = await ankaiInstance.fetchSpotlight();
                if (r?.results?.length > 0) return r;
              } catch { /* fallback */ }
            }
            return hianime.fetchSpotlight();
          })(),
          (async () => {
            if (ankaiInstance) {
              try {
                const r = await ankaiInstance.fetchRecentEpisodes(1);
                if (r?.results?.length > 0) return r;
              } catch { /* fallback */ }
            }
            return hianime.fetchRecentlyUpdated(1);
          })(),
          hianime.fetchMostPopular(1),
          hianime.fetchTopAiring(1),
          // All 12 genres in parallel
          ...GENRE_KEYS.map((genre) => hianime.genreSearch(genre, 1)),
        ]);

        const extract = (r: PromiseSettledResult<any>) =>
          r.status === 'fulfilled' ? (r.value?.results || r.value || []) : [];

        const genres: Record<string, any[]> = {};
        GENRE_KEYS.forEach((key, i) => {
          const items = extract(genreResults[i]);
          if (items.length > 0) genres[key] = items.slice(0, 24);
        });

        return {
          spotlight: extract(spotlightRes).slice(0, 12),
          recentEpisodes: extract(recentRes).slice(0, 24),
          mostPopular: extract(popularRes).slice(0, 24),
          topAiring: extract(airingRes).slice(0, 24),
          genres,
          _ts: Date.now(),
        };
      };

      let bundle: any;
      if (redis) {
        bundle = await cache.fetch(redis as Redis, cacheKey, fetchBundle, BUNDLE_TTL);
      } else {
        bundle = await fetchBundle();
      }

      // Set aggressive cache headers for CDN/browser caching
      reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      reply.status(200).send(bundle);
    } catch (err) {
      reply.status(500).send({
        message: 'Failed to fetch home bundle. Please try again.',
      });
    }
  });
};

export default routes;
