/**
 * Manga Offline Storage — IndexedDB wrapper
 * ──────────────────────────────────────────
 * Stores manga chapter images as blobs in IndexedDB for offline reading.
 * No backend required — 100% client-side browser storage.
 *
 * DB Schema:
 *   manga_store (object store)
 *     - manga:{id}       → { id, title, cover, provider, chapters: [chId,...], updatedAt }
 *     - chapter:{chId}   → { chapterId, mangaId, title, chapterNum, provider, pageCount, totalSize, downloadedAt }
 *     - page:{chId}:{n}  → { chapterId, pageNum, blob, mimeType }
 */

const DB_NAME = 'soora_manga_offline';
const DB_VERSION = 1;
const STORE = 'manga_store';

/* ── Open DB singleton ── */
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

/* ── Low-level helpers ── */
async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAllKeys() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── Manga metadata ── */
export async function saveMangaMeta(mangaId, { title, cover, provider }) {
  const key = `manga:${mangaId}`;
  const existing = await dbGet(key);
  const chapters = existing?.chapters || [];
  await dbPut(key, { id: mangaId, title, cover, provider, chapters, updatedAt: Date.now() });
}

export async function getMangaMeta(mangaId) {
  return dbGet(`manga:${mangaId}`);
}

export async function getAllDownloadedManga() {
  const keys = await dbGetAllKeys();
  const mangaKeys = keys.filter((k) => typeof k === 'string' && k.startsWith('manga:'));
  const results = [];
  for (const key of mangaKeys) {
    const meta = await dbGet(key);
    if (meta && meta.chapters && meta.chapters.length > 0) {
      results.push(meta);
    }
  }
  return results;
}

/* ── Chapter download ── */

/**
 * Download a chapter's images and save to IndexedDB.
 * @param {Object} params
 * @param {string} params.mangaId
 * @param {string} params.chapterId
 * @param {string} params.chapterTitle
 * @param {string|number} params.chapterNum
 * @param {string} params.provider
 * @param {string} params.mangaTitle
 * @param {string} params.mangaCover
 * @param {Array<{img: string, page: number}>} params.pages - array of page objects with img URLs
 * @param {function} [params.onProgress] - callback(downloaded, total)
 * @returns {Promise<{success: boolean, pageCount: number, totalSize: number}>}
 */
export async function downloadChapter({
  mangaId, chapterId, chapterTitle, chapterNum, provider,
  mangaTitle, mangaCover, pages, onProgress,
}) {
  const total = pages.length;
  let downloaded = 0;
  let totalSize = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const url = page.img;
    if (!url) continue;

    try {
      // Fetch image as blob
      const res = await fetch(url, { referrerPolicy: 'no-referrer', mode: 'cors' });
      if (!res.ok) {
        // Try via manga-img proxy if direct fails
        const proxyUrl = `/api/manga-img?url=${encodeURIComponent(url)}`;
        const proxyRes = await fetch(proxyUrl);
        if (!proxyRes.ok) throw new Error(`HTTP ${proxyRes.status}`);
        const blob = await proxyRes.blob();
        totalSize += blob.size;
        await dbPut(`page:${chapterId}:${i}`, {
          chapterId, pageNum: i, blob, mimeType: blob.type,
        });
      } else {
        const blob = await res.blob();
        totalSize += blob.size;
        await dbPut(`page:${chapterId}:${i}`, {
          chapterId, pageNum: i, blob, mimeType: blob.type,
        });
      }
    } catch (err) {
      console.warn(`Failed to download page ${i + 1}:`, err.message);
      // Save a placeholder so we know it failed
      await dbPut(`page:${chapterId}:${i}`, {
        chapterId, pageNum: i, blob: null, mimeType: null, error: true,
      });
    }

    downloaded++;
    if (onProgress) onProgress(downloaded, total);
  }

  // Save chapter metadata
  await dbPut(`chapter:${chapterId}`, {
    chapterId, mangaId, title: chapterTitle, chapterNum,
    provider, pageCount: total, totalSize, downloadedAt: Date.now(),
  });

  // Update manga metadata — add chapter to list
  await saveMangaMeta(mangaId, { title: mangaTitle, cover: mangaCover, provider });
  const mangaMeta = await getMangaMeta(mangaId);
  if (!mangaMeta.chapters.includes(chapterId)) {
    mangaMeta.chapters.push(chapterId);
    await dbPut(`manga:${mangaId}`, mangaMeta);
  }

  return { success: true, pageCount: total, totalSize };
}

/* ── Read offline chapter ── */

/**
 * Check if a chapter is downloaded.
 */
export async function isChapterDownloaded(chapterId) {
  const meta = await dbGet(`chapter:${chapterId}`);
  return !!meta;
}

/**
 * Get chapter metadata.
 */
export async function getChapterMeta(chapterId) {
  return dbGet(`chapter:${chapterId}`);
}

/**
 * Get all pages for a downloaded chapter as blob URLs.
 * Returns array of { pageNum, url, mimeType } — url is a blob: URL.
 * Caller should revoke blob URLs when done.
 */
export async function getOfflinePages(chapterId) {
  const meta = await dbGet(`chapter:${chapterId}`);
  if (!meta) return null;

  const pages = [];
  for (let i = 0; i < meta.pageCount; i++) {
    const page = await dbGet(`page:${chapterId}:${i}`);
    if (page && page.blob) {
      const url = URL.createObjectURL(page.blob);
      pages.push({ pageNum: i, url, mimeType: page.mimeType });
    } else {
      pages.push({ pageNum: i, url: null, mimeType: null, error: true });
    }
  }
  return pages;
}

/* ── Delete chapter ── */

export async function deleteChapter(chapterId) {
  const meta = await dbGet(`chapter:${chapterId}`);
  if (meta) {
    // Delete all pages
    for (let i = 0; i < meta.pageCount; i++) {
      await dbDelete(`page:${chapterId}:${i}`);
    }
    // Remove from manga chapters list
    const mangaMeta = await getMangaMeta(meta.mangaId);
    if (mangaMeta) {
      mangaMeta.chapters = mangaMeta.chapters.filter((c) => c !== chapterId);
      await dbPut(`manga:${mangaMeta.id}`, mangaMeta);
      // If no more chapters, delete manga meta too
      if (mangaMeta.chapters.length === 0) {
        await dbDelete(`manga:${mangaMeta.id}`);
      }
    }
    // Delete chapter meta
    await dbDelete(`chapter:${chapterId}`);
  }
}

/* ── Delete entire manga ── */

export async function deleteManga(mangaId) {
  const meta = await getMangaMeta(mangaId);
  if (meta) {
    for (const chId of meta.chapters) {
      const chMeta = await dbGet(`chapter:${chId}`);
      if (chMeta) {
        for (let i = 0; i < chMeta.pageCount; i++) {
          await dbDelete(`page:${chId}:${i}`);
        }
        await dbDelete(`chapter:${chId}`);
      }
    }
    await dbDelete(`manga:${mangaId}`);
  }
}

/* ── Storage estimate ── */

export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    return { usage: est.usage || 0, quota: est.quota || 0 };
  }
  return { usage: 0, quota: 0 };
}

/**
 * Get all downloaded chapters for a specific manga.
 */
export async function getDownloadedChapters(mangaId) {
  const meta = await getMangaMeta(mangaId);
  if (!meta || !meta.chapters?.length) return [];
  const chapters = [];
  for (const chId of meta.chapters) {
    const ch = await dbGet(`chapter:${chId}`);
    if (ch) chapters.push(ch);
  }
  return chapters;
}
