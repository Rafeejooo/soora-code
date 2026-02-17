/**
 * KomikPlus API helpers — wraps the komik+ proxy endpoints
 * Images are loaded DIRECTLY from nhentai CDN with referrerPolicy="no-referrer"
 * to bypass Cloudflare hotlink protection (browser handles CF challenges natively).
 * Only the API data is proxied (to bypass CORS on JSON endpoints).
 */

// ─── Image URL helpers ───
// nhentai CDN: use non-numbered hosts for maximum compatibility
const IMG_HOST = 'i7.nhentai.net';
const THUMB_HOST = 't7.nhentai.net';

// Map single-char type to file extension
const typeToExt = (t) => {
  switch (t) {
    case 'j': return 'jpg';
    case 'p': return 'png';
    case 'g': return 'gif';
    case 'w': return 'webp';
    default: return 'jpg';
  }
};

// ─── Direct CDN URLs (use with referrerPolicy="no-referrer" on <img>) ───
export const getGalleryImageUrl = (mediaId, pageNum, ext = 'jpg') =>
  `https://${IMG_HOST}/galleries/${mediaId}/${pageNum}.${ext}`;

export const getGalleryThumbUrl = (mediaId, pageNum, ext = 'jpg') =>
  `https://${THUMB_HOST}/galleries/${mediaId}/${pageNum}t.${ext}`;

export const getCoverUrl = (mediaId) =>
  `https://${THUMB_HOST}/galleries/${mediaId}/cover.jpg`;

export const getSmallCoverUrl = (mediaId, ext = 'jpg') =>
  `https://${THUMB_HOST}/galleries/${mediaId}/thumb.${ext}`;

// Build page image URL from book data (direct, no proxy)
export const getPageUrl = (book, pageIdx) => {
  const page = book.images?.pages?.[pageIdx];
  const ext = page ? typeToExt(page.t) : 'jpg';
  return getGalleryImageUrl(book.media_id, pageIdx + 1, ext);
};

// Build page thumb URL from book data (direct, no proxy)
export const getPageThumbUrl = (book, pageIdx) => {
  const page = book.images?.pages?.[pageIdx];
  const ext = page ? typeToExt(page.t) : 'jpg';
  return getGalleryThumbUrl(book.media_id, pageIdx + 1, ext);
};

// Build cover URL from book (direct, no proxy)
export const getBookCover = (book) => {
  if (!book?.media_id) return '';
  const ext = book.images?.cover ? typeToExt(book.images.cover.t) : 'jpg';
  return `https://${THUMB_HOST}/galleries/${book.media_id}/cover.${ext}`;
};

// Build small thumb URL from book (direct, no proxy)
export const getBookThumb = (book) => {
  if (!book?.media_id) return '';
  const ext = book.images?.thumbnail ? typeToExt(book.images.thumbnail.t) : 'jpg';
  return `https://${THUMB_HOST}/galleries/${book.media_id}/thumb.${ext}`;
};

// Legacy proxy helper (kept as last-resort fallback)
export const komikImgProxy = (url) => {
  if (!url) return '';
  return `/api/komikplus-img?url=${encodeURIComponent(url)}`;
};

// ─── API calls (JSON only — these still need proxy for CORS) ───
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const komikApi = async (params, retries = 3) => {
  const qs = new URLSearchParams(params).toString();
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) await delay(800 * attempt); // back off between retries
      const res = await fetch(`/api/komikplus?${qs}`);
      if (res.status === 403 && attempt < retries - 1) continue; // CF challenge, retry
      if (!res.ok) throw new Error(`KomikPlus API error ${res.status}`);
      return res.json();
    } catch (e) {
      if (attempt >= retries - 1) throw e;
    }
  }
};

/** Browse homepage — returns { result: Book[], num_pages, per_page } */
export const getHomePage = (page = 1) =>
  komikApi({ action: 'home', page: String(page) });

/** Search — returns { result: Book[], num_pages, per_page } */
export const searchBooks = (query, page = 1, sort = '') =>
  komikApi({ action: 'search', query, page: String(page), ...(sort ? { sort } : {}) });

/** Book detail — returns Book */
export const getBookDetail = (id) =>
  komikApi({ action: 'book', id: String(id) });

/** Related books — returns Book (with result array) */
export const getRelatedBooks = (id) =>
  komikApi({ action: 'related', id: String(id) });

/** Tagged — returns { result: Book[], num_pages, per_page } */
export const getTaggedBooks = (tagId, page = 1, sort = '') =>
  komikApi({ action: 'tagged', tagId: String(tagId), page: String(page), sort });
