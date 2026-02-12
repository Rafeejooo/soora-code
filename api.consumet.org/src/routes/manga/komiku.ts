import { FastifyRequest, FastifyReply, FastifyInstance, RegisterOptions } from 'fastify';

const BASE = 'https://komiku.org';
const API_BASE = 'https://api.komiku.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Parse search results HTML from api.komiku.org
function parseSearchResults(html: string) {
  const results: any[] = [];
  // Each result is in <div class="bge"> ... </div>
  const cards = html.split('<div class="bge">').slice(1);

  for (const card of cards) {
    // Manga link: /manga/slug/
    const linkMatch = card.match(/href=["'](\/manga\/[^"']+)["']/);
    if (!linkMatch) continue;

    const slug = linkMatch[1].replace(/^\/manga\//, '').replace(/\/$/, '');
    const id = slug;

    // Title from <h3>
    const titleMatch = card.match(/<h3>([^<]+)<\/h3>/);
    const title = titleMatch ? titleMatch[1].trim() : slug;

    // Thumbnail image
    const imgMatch = card.match(/src=["']([^"']+)["'][^>]*class=["'][^"']*lazy/i)
      || card.match(/<img[^>]*src=["']([^"']+thumbnail[^"']*)["']/i)
      || card.match(/<img[^>]*src=["'](https?:\/\/thumbnail\.komiku[^"']+)["']/i);
    const image = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : null;

    // Type (Manhwa/Manga/Manhua)
    const typeMatch = card.match(/<b>(\w+)<\/b>/);
    const mangaType = typeMatch ? typeMatch[1] : '';

    // Latest chapter
    const latestMatch = card.match(/Terbaru[\s\S]*?<span>(Chapter\s*[\d.]+)<\/span>/i);
    const latestChapter = latestMatch ? latestMatch[1] : '';

    results.push({
      id: slug,
      title,
      image,
      type: mangaType,
      latestChapter,
      provider: 'komiku',
    });
  }

  return results;
}

// Parse manga info page
function parseMangaInfo(html: string, slug: string) {
  // Title
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim().replace(/^Komik\s+/i, '').replace(/^Baca\s+/i, '').trim() : slug;

  // OG image
  const ogImg = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const image = ogImg ? ogImg[1].replace(/&amp;/g, '&') : null;

  // Description
  const descMatch = html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i);
  let description = descMatch ? descMatch[1].replace(/^Baca Komik .+? gratis\.\s*/i, '').trim() : '';

  // Genres
  const genresSet = new Set<string>();
  const genreMatches = html.matchAll(/genre\/([^\/]+)\//gi);
  for (const m of genreMatches) {
    const g = m[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    genresSet.add(g);
  }
  const genres = [...genresSet];

  // Status
  const statusMatch = html.match(/Status[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const status = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  // Chapters: look for chapter links with titles
  const chapters: any[] = [];
  const chapterRegex = /href=["'](\/[^"']*chapter[^"']*)["'][^>]*title=["']([^"']+)["']/gi;
  const seen = new Set<string>();
  let match;
  while ((match = chapterRegex.exec(html)) !== null) {
    const chPath = match[1];
    if (seen.has(chPath)) continue;
    seen.add(chPath);

    const chTitle = match[2].trim();
    // Extract chapter number
    const numMatch = chPath.match(/chapter[_-]?([\d]+(?:[.-]\d+)?)/i);
    const chNum = numMatch ? numMatch[1] : '';

    chapters.push({
      id: chPath.replace(/^\//, '').replace(/\/$/, ''),
      title: chTitle,
      chapter: chNum,
    });
  }

  // Sort chapters by number (descending)
  chapters.sort((a, b) => parseFloat(b.chapter || '0') - parseFloat(a.chapter || '0'));

  return {
    id: slug,
    title,
    image,
    description,
    genres,
    status,
    chapters,
    provider: 'komiku',
  };
}

// Parse chapter page images
function parseChapterPages(html: string) {
  const pages: any[] = [];
  // Images from img.komiku.org
  const imgRegex = /<img[^>]*src=["'](https?:\/\/img\.komiku\.org[^"']+)["']/gi;
  let match;
  let idx = 1;
  while ((match = imgRegex.exec(html)) !== null) {
    pages.push({
      img: match[1],
      page: idx++,
    });
  }
  return pages;
}

const routes = async (fastify: FastifyInstance, options: RegisterOptions) => {

  fastify.get('/', (_, rp) => {
    rp.status(200).send({
      intro: 'Welcome to the Komiku provider (Indonesian manga)',
      routes: ['/:query', '/info', '/read'],
    });
  });

  // Search: GET /manga/komiku/:query
  fastify.get('/:query', async (request: FastifyRequest, reply: FastifyReply) => {
    const { query } = request.params as { query: string };

    try {
      const url = `${API_BASE}/?post_type=manga&s=${encodeURIComponent(query)}`;
      const html = await fetchHTML(url);
      const results = parseSearchResults(html);

      reply.status(200).send({
        currentPage: 1,
        hasNextPage: false,
        results,
      });
    } catch (err: any) {
      reply.status(500).send({ message: err.message || 'Search failed' });
    }
  });

  // Info: GET /manga/komiku/info?id=slug
  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.query as { id: string }).id;
    if (!id) return reply.status(400).send({ message: 'id is required' });

    try {
      const url = `${BASE}/manga/${encodeURIComponent(id)}/`;
      const html = await fetchHTML(url);
      const info = parseMangaInfo(html, id);

      reply.status(200).send(info);
    } catch (err: any) {
      reply.status(500).send({ message: err.message || 'Failed to fetch manga info' });
    }
  });

  // Read: GET /manga/komiku/read?chapterId=solo-leveling-chapter-01
  fastify.get('/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const chapterId = (request.query as { chapterId: string }).chapterId;
    if (!chapterId) return reply.status(400).send({ message: 'chapterId is required' });

    try {
      const url = `${BASE}/${encodeURIComponent(chapterId).replace(/%2F/g, '/')}/`;
      const html = await fetchHTML(url);
      const pages = parseChapterPages(html);

      if (pages.length === 0) {
        return reply.status(404).send({ message: 'No pages found for this chapter' });
      }

      reply.status(200).send(pages);
    } catch (err: any) {
      reply.status(500).send({ message: err.message || 'Failed to fetch chapter pages' });
    }
  });

  // Trending: GET /manga/komiku/trending
  fastify.get('/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const html = await fetchHTML(`${BASE}/other/hot/`);
      const results = parseSearchResults(html);
      reply.status(200).send({ results });
    } catch (err: any) {
      reply.status(500).send({ message: err.message || 'Failed to fetch trending' });
    }
  });
};

export default routes;
