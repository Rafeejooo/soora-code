import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio = require('cheerio');
const cheerioLoad = cheerio.load as (html: string) => any;

/**
 * Doujindesu scraper service.
 * Scrapes doujindesu.tv for manga/doujin listings, search, detail, and chapter pages.
 * Built as a lightweight replacement for @xct007/frieren-scraper's doujindesu module.
 */

const BASE_URL = 'https://doujindesu.tv';
const CDN_URL = 'https://cdn.doujindesu.dev';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
});

export interface DoujindesuItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  type?: string;
  score?: string;
  status?: string;
  chapter?: string;
}

export interface DoujindesuDetail {
  id: string;
  title: string;
  alternativeTitle?: string;
  thumbnail: string;
  synopsis?: string;
  status?: string;
  type?: string;
  author?: string;
  score?: string;
  tags: string[];
  genres: string[];
  chapters: { id: string; title: string; url: string; date?: string }[];
}

export interface DoujindesuPage {
  img: string;
  page: number;
}

/**
 * Get latest doujin from homepage
 */
export async function doujindesuLatest(page = 1): Promise<DoujindesuItem[]> {
  try {
    const url = page > 1 ? `/page/${page}/` : '/';
    const res = await client.get(url);
    const $ = cheerioLoad(res.data);
    const items: DoujindesuItem[] = [];

    $('.entries article, .listupd .bs, .entry, .manga-list .item, .latest .manga-item').each((_: number, el: any) => {
      const $el = $(el);
      const $a = $el.find('a').first();
      const href = $a.attr('href') || '';
      const title = $el.find('.ntitle, .tt, h2, h3, .title').first().text().trim() ||
                    $a.attr('title') || $a.text().trim();
      const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const chapter = $el.find('.epx, .chapter, .latest-chapter').first().text().trim();

      if (href && title) {
        const id = extractId(href);
        items.push({ id, title, url: href, thumbnail: img, chapter });
      }
    });

    // Fallback: try more generic selectors
    if (items.length === 0) {
      $('a[href*="/manga/"]').each((_: number, el: any) => {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const img = $a.find('img').first().attr('src') || '';
        const title = $a.attr('title') || $a.find('img').first().attr('alt') || $a.text().trim();

        if (href && title && !items.find(i => i.url === href)) {
          const id = extractId(href);
          items.push({ id, title, url: href, thumbnail: img });
        }
      });
    }

    return items;
  } catch (err: any) {
    console.error('[doujindesu/latest]', err.message);
    return [];
  }
}

/**
 * Search doujin by query
 */
export async function doujindesuSearch(query: string, page = 1): Promise<DoujindesuItem[]> {
  try {
    const res = await client.get('/', {
      params: { s: query, ...(page > 1 ? { paged: page } : {}) },
    });
    const $ = cheerioLoad(res.data);
    const items: DoujindesuItem[] = [];

    // Search results layout
    $('.entries article, .listupd .bs, .entry, .search-item, .manga-list .item').each((_: number, el: any) => {
      const $el = $(el);
      const $a = $el.find('a').first();
      const href = $a.attr('href') || '';
      const title = $el.find('.ntitle, .tt, h2, h3, .title').first().text().trim() ||
                    $a.attr('title') || $a.text().trim();
      const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const score = $el.find('.numscore, .score, .rating').first().text().trim();
      const type = $el.find('.type, .label').first().text().trim();

      if (href && title) {
        const id = extractId(href);
        items.push({ id, title, url: href, thumbnail: img, score, type });
      }
    });

    // Fallback generic
    if (items.length === 0) {
      $('a[href*="/manga/"]').each((_: number, el: any) => {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const img = $a.find('img').first().attr('src') || '';
        const title = $a.attr('title') || $a.find('img').first().attr('alt') || $a.text().trim();

        if (href && title && !items.find(i => i.url === href)) {
          const id = extractId(href);
          items.push({ id, title, url: href, thumbnail: img });
        }
      });
    }

    return items;
  } catch (err: any) {
    console.error('[doujindesu/search]', err.message);
    return [];
  }
}

/**
 * Get doujin detail (chapters, tags, synopsis)
 */
export async function doujindesuDetail(mangaId: string): Promise<DoujindesuDetail | null> {
  try {
    const url = mangaId.startsWith('http') ? mangaId : `${BASE_URL}/manga/${mangaId}/`;
    const res = await client.get(url);
    const $ = cheerioLoad(res.data);

    const title = $('h1.entry-title, h1, .manga-title').first().text().trim() || 'Unknown';
    const alternativeTitle = $('.alternative, .alter, .other-name').first().text().trim();
    const thumbnail = $('img.attachment-post-thumbnail, .thumb img, .manga-thumb img, .series-thumb img').first().attr('src') || '';
    const synopsis = $('.entry-content p, .synopsis p, .desc, .manga-summary p').first().text().trim();

    // Extract metadata
    const status = extractMeta($, 'Status');
    const type = extractMeta($, 'Type') || extractMeta($, 'Tipe');
    const author = extractMeta($, 'Author') || extractMeta($, 'Pengarang');
    const score = extractMeta($, 'Score') || extractMeta($, 'Rating');

    // Tags & Genres
    const tags: string[] = [];
    const genres: string[] = [];
    $('.mgen a, .genre-info a, .seriestugenre a, .tag-links a, .tags a').each((_: number, el: any) => {
      const text = $(el).text().trim();
      if (text) {
        const href = $(el).attr('href') || '';
        if (href.includes('genre') || href.includes('category')) {
          genres.push(text);
        } else {
          tags.push(text);
        }
      }
    });

    // If no distinction, put all in tags
    if (genres.length === 0) {
      tags.length = 0;
      $('.mgen a, .genre-info a, .seriestugenre a, .tag-links a, .tags a').each((_: number, el: any) => {
        const text = $(el).text().trim();
        if (text) tags.push(text);
      });
    }

    // Chapters
    const chapters: DoujindesuDetail['chapters'] = [];
    $('.eplister li a, .chapter-list a, #chapter_list a, .chapters li a, .bixbox ul li a').each((_: number, el: any) => {
      const $a = $(el);
      const href = $a.attr('href') || '';
      const chTitle = $a.find('.chapternum, .chapter-title, .lch').text().trim() ||
                      $a.text().trim();
      const date = $a.find('.chapterdate, .chapter-date').text().trim();

      if (href) {
        const chId = extractChapterId(href);
        chapters.push({ id: chId, title: chTitle, url: href, date });
      }
    });

    return {
      id: mangaId,
      title,
      alternativeTitle,
      thumbnail,
      synopsis,
      status,
      type,
      author,
      score,
      tags,
      genres,
      chapters,
    };
  } catch (err: any) {
    console.error('[doujindesu/detail]', err.message);
    return null;
  }
}

/**
 * Get chapter pages (images)
 */
export async function doujindesuRead(chapterId: string): Promise<DoujindesuPage[]> {
  try {
    const url = chapterId.startsWith('http') ? chapterId : `${BASE_URL}/${chapterId}/`;
    const res = await client.get(url);
    const $ = cheerioLoad(res.data);
    const pages: DoujindesuPage[] = [];

    // Try multiple selectors for chapter images
    // Pattern 1: Standard reader
    $('#readerarea img, .reader-area img, .chapter-content img, .reading-content img, #content img').each((i: number, el: any) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || '';
      if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('banner') && !src.includes('avatar')) {
        pages.push({ img: src.trim(), page: pages.length + 1 });
      }
    });

    // Pattern 2: JSON in script tag (some doujin sites embed images in JS)
    if (pages.length === 0) {
      const scripts = $('script').toArray().map((s: any) => $(s).html() || '');
      for (const script of scripts) {
        // Look for image arrays
        const imgMatch = script.match(/images\s*[:=]\s*(\[[\s\S]*?\])/);
        if (imgMatch) {
          try {
            const imgArr = JSON.parse(imgMatch[1]);
            imgArr.forEach((src: string, i: number) => {
              if (typeof src === 'string' && (src.startsWith('http') || src.startsWith('/'))) {
                pages.push({ img: src, page: i + 1 });
              }
            });
          } catch { /* not valid JSON */ }
        }
        // Another pattern: ts_reader
        const tsMatch = script.match(/ts_reader\.run\(([\s\S]*?)\)/);
        if (tsMatch) {
          try {
            const data = JSON.parse(tsMatch[1]);
            const sources = data.sources || [];
            if (sources[0]?.images) {
              sources[0].images.forEach((src: string, i: number) => {
                pages.push({ img: src, page: i + 1 });
              });
            }
          } catch { /* parse error */ }
        }
      }
    }

    return pages;
  } catch (err: any) {
    console.error('[doujindesu/read]', err.message);
    return [];
  }
}

/**
 * Proxy an image from doujindesu CDN with proper headers
 */
export async function doujindesuProxyImage(imageUrl: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const response = await axios.get(imageUrl, {
      headers: {
        'Referer': `${BASE_URL}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      responseType: 'arraybuffer',
      timeout: 15000,
    });
    return {
      data: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'image/jpeg',
    };
  } catch {
    return null;
  }
}

/**
 * Get list of available genres from the site
 */
export async function doujindesuGenres(): Promise<{ name: string; slug: string; url: string }[]> {
  try {
    const res = await client.get('/');
    const $ = cheerioLoad(res.data);
    const genres: { name: string; slug: string; url: string }[] = [];
    const seen = new Set<string>();

    // Try sidebar/menu genre links
    $('a[href*="/genre/"], a[href*="/genres/"], .genre-list a, .sidebar .widget a[href*="genre"]').each((_: number, el: any) => {
      const href = $(el).attr('href') || '';
      const name = $(el).text().trim();
      if (!href || !name || name.length > 40) return;
      const slugMatch = href.match(/\/genres?\/([^/]+)/);
      if (slugMatch && !seen.has(slugMatch[1])) {
        seen.add(slugMatch[1]);
        genres.push({ name, slug: slugMatch[1], url: href });
      }
    });

    // Also try from the manga detail pages if we already have some cached data
    if (genres.length === 0) {
      // Fallback: try to get genres from a genre listing page
      try {
        const genrePage = await client.get('/genre/');
        const $g = cheerioLoad(genrePage.data);
        $g('a[href*="/genre/"]').each((_: number, el: any) => {
          const href = $g(el).attr('href') || '';
          const name = $g(el).text().trim();
          if (!href || !name || name.length > 40) return;
          const slugMatch = href.match(/\/genre\/([^/]+)/);
          if (slugMatch && !seen.has(slugMatch[1])) {
            seen.add(slugMatch[1]);
            genres.push({ name, slug: slugMatch[1], url: href });
          }
        });
      } catch { /* genre page might not exist */ }
    }

    return genres;
  } catch (err: any) {
    console.error('[doujindesu/genres]', err.message);
    return [];
  }
}

/**
 * Browse doujin by genre slug
 */
export async function doujindesuByGenre(genreSlug: string, page = 1): Promise<DoujindesuItem[]> {
  try {
    const url = page > 1 ? `/genre/${genreSlug}/page/${page}/` : `/genre/${genreSlug}/`;
    const res = await client.get(url);
    const $ = cheerioLoad(res.data);
    const items: DoujindesuItem[] = [];

    $('.entries article, .listupd .bs, .entry, .manga-list .item, .latest .manga-item').each((_: number, el: any) => {
      const $el = $(el);
      const $a = $el.find('a').first();
      const href = $a.attr('href') || '';
      const title = $el.find('.ntitle, .tt, h2, h3, .title').first().text().trim() ||
                    $a.attr('title') || $a.text().trim();
      const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const score = $el.find('.numscore, .score, .rating').first().text().trim();
      const type = $el.find('.type, .label').first().text().trim();
      const chapter = $el.find('.epx, .chapter, .latest-chapter').first().text().trim();

      if (href && title) {
        const id = extractId(href);
        items.push({ id, title, url: href, thumbnail: img, score, type, chapter });
      }
    });

    // Fallback
    if (items.length === 0) {
      $('a[href*="/manga/"]').each((_: number, el: any) => {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const img = $a.find('img').first().attr('src') || '';
        const title = $a.attr('title') || $a.find('img').first().attr('alt') || $a.text().trim();
        if (href && title && !items.find(i => i.url === href)) {
          const id = extractId(href);
          items.push({ id, title, url: href, thumbnail: img });
        }
      });
    }

    return items;
  } catch (err: any) {
    console.error('[doujindesu/byGenre]', err.message);
    return [];
  }
}

// ── Helpers ──

function extractId(url: string): string {
  // https://doujindesu.tv/manga/some-title/ → some-title
  const match = url.match(/\/manga\/([^/]+)/);
  if (match) return match[1];
  // Fallback: last path segment
  const parts = url.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || url;
}

function extractChapterId(url: string): string {
  // https://doujindesu.tv/some-chapter-slug/ → some-chapter-slug
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || url;
  } catch {
    const parts = url.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || url;
  }
}

function extractMeta($: any, label: string): string {
  let value = '';
  // Try table format: <th>Label</th><td>Value</td>
  $(`th:contains("${label}")`).each((_: number, el: any) => {
    const td = $(el).next('td');
    if (td.length) value = td.text().trim();
  });
  if (value) return value;

  // Try list format: <b>Label:</b> Value
  $(`b:contains("${label}"), span:contains("${label}"), strong:contains("${label}")`).each((_: number, el: any) => {
    const parent = $(el).parent();
    const text = parent.text().replace($(el).text(), '').trim().replace(/^[:\s]+/, '');
    if (text) value = text;
  });
  return value;
}
