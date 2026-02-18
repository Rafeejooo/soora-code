import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { MANGA } from '@consumet/extensions';

import cache from '../../utils/cache';
import { redis, REDIS_TTL } from '../../main';
import { Redis } from 'ioredis';

/**
 * /manga/home-bundle
 * Returns pre-built manga homepage data for a given language in a single request.
 * Eliminates 12+ sequential search calls from the frontend.
 *
 * Query params:
 *   ?lang=en  (default: en, supports: en, id)
 *
 * Response shape:
 * {
 *   sections: { Trending: [...], Action: [...], Romance: [...], Fantasy: [...] },
 *   heroItems: [...],
 * }
 */

const POPULAR_QUERIES: Record<string, { label: string; queries: string[] }[]> = {
  en: [
    { label: 'Trending', queries: ['solo leveling', 'one piece', 'jujutsu kaisen'] },
    { label: 'Action', queries: ['demon slayer', 'attack on titan', 'chainsaw man'] },
    { label: 'Romance', queries: ['horimiya', 'kaguya sama', 'my dress up darling'] },
    { label: 'Fantasy', queries: ['mushoku tensei', 'shield hero', 'overlord'] },
  ],
  id: [
    { label: 'Trending', queries: ['solo leveling', 'one piece', 'jujutsu kaisen'] },
    { label: 'Action', queries: ['demon slayer', 'naruto', 'chainsaw man'] },
    { label: 'Romance', queries: ['horimiya', 'kaguya sama', 'spy x family'] },
    { label: 'Fantasy', queries: ['mushoku tensei', 'overlord', 'shield hero'] },
  ],
};

const BUNDLE_TTL = Math.max(REDIS_TTL, 1800); // at least 30 min

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  // Initialize providers
  let mangapill: any;
  let komiku: any;

  try {
    mangapill = new MANGA.MangaPill();
  } catch { /* provider may not be available */ }

  try {
    // Komiku provider
    const Komiku = (MANGA as any).Komiku;
    if (Komiku) komiku = new Komiku();
  } catch { /* optional */ }

  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const lang = ((request.query as any).lang as string) || 'en';
    const useKomiku = lang === 'id' && komiku;

    try {
      const cacheKey = `manga:home-bundle:${lang}:v2`;

      const fetchBundle = async () => {
        const provider = useKomiku ? komiku : mangapill;
        if (!provider) throw new Error('No manga provider available');

        const querySections = POPULAR_QUERIES[lang] || POPULAR_QUERIES.en;
        const seen = new Set<string>();

        // Flatten ALL search queries and fire them ALL in parallel
        const allQueries: { label: string; query: string }[] = [];
        for (const sec of querySections) {
          for (const q of sec.queries) {
            allQueries.push({ label: sec.label, query: q });
          }
        }

        const allResults = await Promise.allSettled(
          allQueries.map((aq) => provider.search(aq.query))
        );

        // Group results by section label
        const sections: Record<string, any[]> = {};
        const heroItems: any[] = [];

        let idx = 0;
        for (const sec of querySections) {
          const items: any[] = [];
          for (const _q of sec.queries) {
            const result = allResults[idx];
            if (result.status === 'fulfilled') {
              const list = result.value?.results || result.value || [];
              for (const item of list) {
                if (!seen.has(item.id)) {
                  seen.add(item.id);
                  const entry = useKomiku ? { ...item, provider: 'komiku' } : item;
                  items.push(entry);
                }
              }
            }
            idx++;
          }
          sections[sec.label] = items.slice(0, 24);

          // Build hero items from Trending section
          if (sec.label === 'Trending' && items.length > 0) {
            const nonNovel = items.filter((i: any) => {
              const id = (i.id || '').toLowerCase();
              const title = (typeof i.title === 'string' ? i.title : '').toLowerCase();
              return !id.includes('novel') && !title.includes('novel') &&
                     !id.includes('light-novel') && !title.includes('light novel');
            });
            heroItems.push(...nonNovel.slice(0, 6));
          }
        }

        return {
          sections,
          heroItems,
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
        message: 'Failed to fetch manga home bundle.',
      });
    }
  });
};

export default routes;
