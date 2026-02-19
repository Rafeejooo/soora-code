/**
 * SEO Utilities
 * - Clean URL builders (path-based instead of query strings)
 * - useSEO hook for dynamic meta tags, canonical, OG, and JSON-LD
 * - Schema markup generators
 */
import { useEffect } from 'react';

// ─── URL Builder Helpers ───────────────────────────────────────────

/**
 * Encode an ID for use in URL paths.
 * Preserves slashes as path separators, encodes everything else.
 */
export function encodePathId(id) {
  if (!id) return '';
  return id.split('/').map(s => encodeURIComponent(s)).join('/');
}

/** Build anime info URL: /anime/:id */
export function buildAnimeUrl(id) {
  return `/anime/${encodeURIComponent(id)}`;
}

/** Build movie info URL: /movies/:id[?type=...] — provider is auto-detected */
export function buildMovieUrl(id, type) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  const qs = params.toString();
  return `/movies/${encodePathId(id)}${qs ? '?' + qs : ''}`;
}

/** Build manga info URL: /manga/:id — provider is auto-detected */
export function buildMangaUrl(id) {
  return `/manga/${encodePathId(id)}`;
}

/**
 * Auto-detect manga provider from ID format:
 * - Starts with digits (e.g. "6372/solo-glitch-player") → mangapill
 * - Plain slug (e.g. "solo-leveling-id") → komiku
 */
export function detectMangaProvider(id) {
  if (!id) return 'mangapill';
  if (/^\d/.test(id)) return 'mangapill';
  return 'komiku';
}

/**
 * Auto-detect movie provider from ID format:
 * - Contains "watch-" → goku
 * - Purely numeric → tmdb
 * - Otherwise → lk21
 */
export function detectMovieProvider(id) {
  if (!id) return 'tmdb';
  if (id.includes('watch-')) return 'goku';
  if (/^\d+$/.test(id)) return 'tmdb';
  return 'lk21';
}

// ─── useSEO Hook ───────────────────────────────────────────────────

const SITE_NAME = 'Soora';
const BASE_URL = 'https://www.soora.fun';
const DEFAULT_TITLE = 'Soora — Nonton Anime, Film & Baca Manga Sub Indo Gratis';

/**
 * Manage document head for SEO: title, meta description, OG tags,
 * canonical link, and JSON-LD structured data.
 *
 * @param {Object} opts
 * @param {string} opts.title       - Page title
 * @param {string} opts.description - Meta description
 * @param {string} opts.canonical   - Canonical URL path (e.g. /anime/bleach-806)
 * @param {string} opts.image       - OG image URL
 * @param {string} opts.type        - OG type (website, video.movie, video.tv_show, book)
 * @param {Object} opts.schema      - JSON-LD structured data object
 */
export function useSEO({ title, description, canonical, image, type = 'website', schema } = {}) {
  useEffect(() => {
    // Title
    if (title) document.title = title;

    // Helper: set or create a meta tag
    const setMeta = (attr, key, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Meta description
    setMeta('name', 'description', description);

    // Open Graph
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:type', type);
    if (image) setMeta('property', 'og:image', image);

    // Twitter Card
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    if (image) setMeta('name', 'twitter:image', image);

    // Canonical URL
    const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : null;
    if (canonicalUrl) {
      setMeta('property', 'og:url', canonicalUrl);
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonicalUrl;
    }

    // JSON-LD Schema
    let scriptEl = document.getElementById('soora-jsonld');
    if (schema) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = 'soora-jsonld';
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(schema);
    }

    // Cleanup on unmount
    return () => {
      document.title = DEFAULT_TITLE;
      // Remove dynamic meta tags
      ['description'].forEach(name => {
        const el = document.querySelector(`meta[name="${name}"]`);
        if (el) el.removeAttribute('content');
      });
      ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name'].forEach(prop => {
        const el = document.querySelector(`meta[property="${prop}"]`);
        if (el) el.remove();
      });
      ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].forEach(name => {
        const el = document.querySelector(`meta[name="${name}"]`);
        if (el) el.remove();
      });
      const canonEl = document.querySelector('link[rel="canonical"]');
      if (canonEl) canonEl.remove();
      const schemaEl = document.getElementById('soora-jsonld');
      if (schemaEl) schemaEl.remove();
    };
  }, [title, description, canonical, image, type, schema]);
}

// ─── Schema Markup Generators ──────────────────────────────────────

/** Generate JSON-LD schema for an anime/TV series */
export function buildAnimeSchema(info, canonicalPath) {
  const title = info.title?.english || info.title?.romaji || info.title?.userPreferred || info.title || '';
  const desc = (info.description || '').replace(/<[^>]*>/g, '').slice(0, 500);
  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: title,
    description: desc,
    image: info.image || info.cover || '',
    url: `${BASE_URL}${canonicalPath}`,
    genre: info.genres || [],
    datePublished: info.releaseDate || '',
    numberOfEpisodes: info.totalEpisodes || info.episodes?.length || 0,
    ...(info.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: (info.rating / 10).toFixed(1),
        bestRating: '10',
        worstRating: '0',
      },
    }),
  };
}

/** Generate JSON-LD schema for a movie or TV show */
export function buildMovieSchema(info, type, canonicalPath) {
  const title = info.title || info.name || '';
  const desc = (info.overview || info.synopsis || info.description || '').slice(0, 500);
  const schemaType = type === 'tv' ? 'TVSeries' : 'Movie';
  const genres = (info.genres || []).map(g => typeof g === 'string' ? g : g.name).filter(Boolean);
  const rating = info.vote_average || info.rating;

  return {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
    description: desc,
    image: info.poster_path
      ? `https://image.tmdb.org/t/p/w500${info.poster_path}`
      : (info.image || info.posterImg || ''),
    url: `${BASE_URL}${canonicalPath}`,
    genre: genres,
    datePublished: info.release_date || info.first_air_date || info.releaseDate || '',
    ...(rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: typeof rating === 'number' ? rating.toFixed(1) : rating,
        bestRating: '10',
        worstRating: '0',
      },
    }),
  };
}

/** Generate JSON-LD schema for a manga/comic */
export function buildMangaSchema(info, canonicalPath) {
  const title = info.title || '';
  const desc = (info.description || '').slice(0, 500);
  const genres = (info.genres || []).filter(g => g && g.trim() && g !== 'Genres');

  return {
    '@context': 'https://schema.org',
    '@type': 'ComicSeries',
    name: title,
    description: desc,
    image: info.image || '',
    url: `${BASE_URL}${canonicalPath}`,
    genre: genres,
    author: (info.authors || []).map(a => ({ '@type': 'Person', name: a })),
    datePublished: info.releaseDate || '',
    numberOfItems: info.chapters?.length || 0,
  };
}
