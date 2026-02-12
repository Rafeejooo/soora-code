import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';
import { MANGA } from '@consumet/extensions';
import axios from 'axios';

import cache from '../../utils/cache';
import { redis, REDIS_TTL } from '../../main';
import { Redis } from 'ioredis';

const MANGADEX_API = 'https://api.mangadex.org';

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {
  const mangadex = new MANGA.MangaDex();

  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro: `Welcome to the mangadex provider: check out the provider's website @ ${mangadex.toString.baseUrl}`,
      routes: ['/:query', '/info/:id', '/read/:chapterId', '/info/:id/lang/:lang'],
      documentation: 'https://docs.consumet.org/#tag/mangadex',
    });
  });

  // --- SEARCH ---
  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const { query } = request.params as { query: string };
    const { page } = request.query as { page?: number };

    try {
      const res = redis
        ? await cache.fetch(
            redis as Redis,
            `mangadex:search:${query}:${page ?? 1}`,
            () => mangadex.search(query, page),
            REDIS_TTL,
          )
        : await mangadex.search(query, page);

      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({
        message: 'Something went wrong. Please try again later.',
      });
    }
  });

  // --- INFO (default English) ---
  fastify.get('/info/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = decodeURIComponent((request.params as { id: string }).id);
    const { lang } = request.query as { lang?: string };

    // If a language is specified, use the custom multi-lang endpoint
    if (lang && lang !== 'en') {
      return fetchInfoWithLang(id, lang, reply);
    }

    try {
      const res = redis
        ? await cache.fetch(
            redis as Redis,
            `mangadex:info:${id}`,
            () => mangadex.fetchMangaInfo(id),
            REDIS_TTL,
          )
        : await mangadex.fetchMangaInfo(id);

      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({
        message: 'Something went wrong. Please try again later.',
      });
    }
  });

  // --- INFO with custom language (fetches chapters in specified language) ---
  async function fetchInfoWithLang(mangaId: string, lang: string, reply: FastifyReply) {
    const cacheKey = `mangadex:info:${mangaId}:${lang}`;
    const fetcher = async () => {
      // 1) Fetch manga metadata
      const metaRes = await axios.get(`${MANGADEX_API}/manga/${mangaId}`, {
        params: { includes: ['cover_art', 'author', 'artist'] },
      });
      const manga = metaRes.data.data;
      const attrs = manga.attributes;

      // Extract cover
      const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art');
      const coverFile = coverRel?.attributes?.fileName;
      const image = coverFile
        ? `https://uploads.mangadex.org/covers/${mangaId}/${coverFile}`
        : '';

      // Build manga info
      const info: any = {
        id: mangaId,
        title: attrs.title?.en || attrs.title?.['ja-ro'] || Object.values(attrs.title || {})[0] || 'Unknown',
        altTitles: attrs.altTitles || [],
        description: attrs.description?.en || attrs.description?.[lang] || Object.values(attrs.description || {})[0] || '',
        genres: (attrs.tags || [])
          .filter((t: any) => t.attributes?.group === 'genre')
          .map((t: any) => t.attributes?.name?.en || ''),
        themes: (attrs.tags || [])
          .filter((t: any) => t.attributes?.group === 'theme')
          .map((t: any) => t.attributes?.name?.en || ''),
        status: attrs.status || 'unknown',
        releaseDate: attrs.year || null,
        image,
        chapters: [] as any[],
      };

      // 2) Fetch ALL chapters in specified language (paginated)
      let offset = 0;
      const limit = 96;
      let hasMore = true;
      while (hasMore) {
        const chapRes = await axios.get(`${MANGADEX_API}/manga/${mangaId}/feed`, {
          params: {
            offset,
            limit,
            'order[volume]': 'desc',
            'order[chapter]': 'desc',
            'translatedLanguage[]': lang,
          },
        });
        const chapters = chapRes.data.data || [];
        for (const ch of chapters) {
          info.chapters.push({
            id: ch.id,
            title: ch.attributes.title || '',
            chapter: ch.attributes.chapter || '',
            chapterNumber: ch.attributes.chapter,
            volumeNumber: ch.attributes.volume,
            pages: ch.attributes.pages,
            translatedLanguage: ch.attributes.translatedLanguage,
          });
        }
        offset += limit;
        hasMore = chapters.length === limit && offset < (chapRes.data.total || 0);
      }

      return info;
    };

    try {
      const res = redis
        ? await cache.fetch(redis as Redis, cacheKey, fetcher, REDIS_TTL)
        : await fetcher();
      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({
        message: 'Something went wrong. Please try again later.',
      });
    }
  }

  // --- AVAILABLE LANGUAGES for a manga ---
  fastify.get('/info/:id/languages', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = decodeURIComponent((request.params as { id: string }).id);
    const cacheKey = `mangadex:langs:${id}`;

    const fetcher = async () => {
      const res = await axios.get(`${MANGADEX_API}/manga/${id}/feed`, {
        params: { limit: 0 },
      });
      // MangaDex doesn't directly list languages, so we fetch a batch and aggregate
      const aggRes = await axios.get(`${MANGADEX_API}/manga/${id}/aggregate`);
      // Alternative: fetch small batch and scan translatedLanguage
      const feedRes = await axios.get(`${MANGADEX_API}/manga/${id}/feed`, {
        params: { limit: 100, offset: 0, 'order[chapter]': 'desc' },
      });
      const langs = new Set<string>();
      for (const ch of feedRes.data.data || []) {
        if (ch.attributes?.translatedLanguage) {
          langs.add(ch.attributes.translatedLanguage);
        }
      }
      return { languages: Array.from(langs).sort() };
    };

    try {
      const res = redis
        ? await cache.fetch(redis as Redis, cacheKey, fetcher, REDIS_TTL)
        : await fetcher();
      reply.status(200).send(res);
    } catch (err) {
      reply.status(500).send({ message: 'Something went wrong.' });
    }
  });

  // --- READ CHAPTER ---
  fastify.get(
    '/read/:chapterId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { chapterId } = request.params as { chapterId: string };

      try {
        const res = redis
          ? await cache.fetch(
              redis as Redis,
              `mangadex:read:${chapterId}`,
              () => mangadex.fetchChapterPages(chapterId),
              REDIS_TTL,
            )
          : await mangadex.fetchChapterPages(chapterId);

        reply.status(200).send(res);
      } catch (err) {
        reply.status(500).send({
          message: 'Something went wrong. Please try again later.',
        });
      }
    },
  );
};

export default routes;
