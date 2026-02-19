import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getMangaInfo, normalizeMangaTitle, mangaImgProxy, isMangaNovel, getMangaContentType,
  getKomikuInfo, searchKomiku,
} from '../api';
import { useSEO, buildMangaSchema, buildMangaUrl, detectMangaProvider } from '../utils/seo';
import Loading from '../components/Loading';

// Build cover image URL from manga ID when API info doesn't provide one
const buildCoverUrl = (id) => {
  if (!id) return null;
  const numId = id.split('/')[0]; // "6372/solo-glitch-player" → "6372"
  if (!numId || !/^\d+$/.test(numId)) return null;
  return `https://cdn.readdetectiveconan.com/file/mangapill/i/${numId}.jpeg`;
};

export default function MangaInfo() {
  const params = useParams();
  const id = params['*'] || ''; // splat captures the full ID including slashes
  const provider = detectMangaProvider(id); // auto-detect: digit-prefix → mangapill, slug → komiku
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc');
  const [descExpanded, setDescExpanded] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const [coverError, setCoverError] = useState(false);
  const [usedProvider, setUsedProvider] = useState(provider); // tracks actual provider used

  // Read persisted language
  const selectedLang = localStorage.getItem('soora_manga_lang') || 'en';

  useEffect(() => {
    if (!id) return;
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      setCoverError(false);

      // ── Direct Komiku path: provider is 'komiku' ──
      if (provider === 'komiku') {
        try {
          const res = await getKomikuInfo(id);
          if (res.data) {
            setInfo(res.data);
            setUsedProvider('komiku');
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Komiku direct fetch failed:', e.message);
          setError('Failed to load manga from Komiku');
          setLoading(false);
          return;
        }
      }

      // ── Indonesian language: search Komiku by title ──
      if (selectedLang === 'id' && provider !== 'komiku') {
        try {
          const defaultRes = await getMangaInfo(id, provider);
          const title = defaultRes.data?.title;
          if (title) {
            const searchRes = await searchKomiku(normalizeMangaTitle(title));
            const results = searchRes.data?.results || [];
            if (results.length > 0) {
              const komikuId = results[0].id;
              const komikuInfo = await getKomikuInfo(komikuId);
              if (komikuInfo.data && komikuInfo.data.chapters && komikuInfo.data.chapters.length > 0) {
                if (!komikuInfo.data.image && defaultRes.data?.image) {
                  komikuInfo.data.image = defaultRes.data.image;
                }
                setInfo(komikuInfo.data);
                setUsedProvider('komiku');
                setLoading(false);
                return;
              }
            }
          }
          // No Komiku chapters found — show default provider data
          if (defaultRes.data) {
            setInfo(defaultRes.data);
            setUsedProvider(provider);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Komiku search failed, falling back:', e.message);
        }
      }

      // ── Default provider fetch (English / fallback) ──
      try {
        const res = await getMangaInfo(id, provider);
        if (!res.data || (!res.data.title && !res.data.description)) {
          throw new Error('No data found');
        }
        setInfo(res.data);
        setUsedProvider(provider);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load manga info');
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [id, provider, selectedLang]);

  // SEO hook (must be before early returns to satisfy Rules of Hooks)
  const seoTitle = info ? normalizeMangaTitle(info.title) : '';
  const seoContentType = info ? getMangaContentType({ id, title: info.title }) : 'Manga';
  const seoCanonical = id ? buildMangaUrl(id) : '';
  const seoChapterCount = info?.chapters?.length || 0;

  useSEO(info ? {
    title: `Baca ${seoContentType} ${seoTitle} Bahasa Indonesia Chapter Terlengkap | Gratis - Soora`,
    description: `Baca ${seoContentType.toLowerCase()} ${seoTitle} bahasa Indonesia chapter terlengkap gratis.${seoChapterCount ? ` ${seoChapterCount} chapter tersedia.` : ''} Manga trending terbaru sub Indo, update chapter terbaru hanya di Soora.`,
    canonical: seoCanonical,
    image: info.image || '',
    type: 'book',
    schema: buildMangaSchema({ ...info, title: seoTitle }, seoCanonical),
  } : {});

  if (!id) return <div className="error-msg">No manga ID provided</div>;
  if (loading) return <Loading text="Loading manga info..." theme="sooramics" />;
  if (error) return (
    <div className="mangainfo-error-page">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="56" height="56">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
      </svg>
      <p className="mangainfo-error-text">{error}</p>
      <div className="mangainfo-error-actions">
        <button className="btn-play sooramics-btn-play" onClick={() => window.location.reload()}>Try Again</button>
        <button className="btn-glass" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    </div>
  );
  if (!info) return <div className="error-msg">No data found</div>;

  const title = normalizeMangaTitle(info.title);
  const isNovel = isMangaNovel({ id, title: info.title });
  const contentType = getMangaContentType({ id, title: info.title });
  const chapters = info.chapters || [];

  const genres = (info.genres || []).filter((g) => g && g.trim() && g !== 'Genres');

  // Sort chapters by number
  const getChNum = (ch) => {
    if (ch.chapter != null && ch.chapter !== '') return parseFloat(ch.chapter) || 0;
    return parseFloat(ch.id?.match(/chapter[_-]?([\d.]+)/)?.[1] || '0');
  };
  const sortedChapters = [...chapters].sort((a, b) => {
    return sortOrder === 'desc' ? getChNum(b) - getChNum(a) : getChNum(a) - getChNum(b);
  });

  // Filter chapters by search
  const filteredChapters = chapterSearch.trim()
    ? sortedChapters.filter((ch) => {
        const q = chapterSearch.trim().toLowerCase();
        const chTitle = (ch.title || ch.chapter || '').toLowerCase();
        const chNum = ch.chapter || ch.id?.match(/chapter[_-]?([\d.]+)/)?.[1] || '';
        return chTitle.includes(q) || String(chNum).includes(q);
      })
    : sortedChapters;
  const displayChapters = showAllChapters ? filteredChapters : filteredChapters.slice(0, 50);

  const status = info.status || '';
  const description = info.description || '';

  // Use API image, fallback to CDN constructed URL
  // Komiku images don't need the manga proxy
  const rawImage = info.image || buildCoverUrl(id);
  const coverSrc = rawImage
    ? (rawImage.includes('komiku.org') ? rawImage : mangaImgProxy(rawImage))
    : null;
  const isLongDesc = description.length > 300;

  // Determine which manga ID to pass for reader navigation
  const readerMangaId = id;
  const readerProvider = usedProvider;

  const firstChapter = sortedChapters[sortedChapters.length - 1] || sortedChapters[0];
  const lastChapter = sortedChapters[0];

  return (
    <div className="mangainfo-page sooramics-page">
      {/* Backdrop banner — blurred cover */}
      {coverSrc && !coverError && (
        <div className="mangainfo-backdrop">
          <img src={coverSrc} alt="" referrerPolicy="no-referrer" onError={() => setCoverError(true)} />
          <div className="mangainfo-backdrop-overlay" />
        </div>
      )}

      {/* Floating back button */}
      <button className="manga-back-btn" onClick={() => navigate(-1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </button>



      {/* ===== HERO HEADER ===== */}
      <div className="mangainfo-header">
        <div className="mangainfo-cover">
          {coverSrc && !coverError ? (
            <img src={coverSrc} alt={title} referrerPolicy="no-referrer" onError={() => setCoverError(true)} />
          ) : (
            <div className="mangainfo-cover-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="48" height="48">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              </svg>
              <span>No Cover</span>
            </div>
          )}
        </div>

        <div className="mangainfo-meta">
          <div className="mangainfo-type-badge">
            <span className={`mangainfo-badge ${isNovel ? 'mangainfo-badge-novel' : ''}`}>{contentType}</span>
            {status && <span className="mangainfo-badge mangainfo-badge-status">{status}</span>}
          </div>

          <h1 className="mangainfo-title">{title}</h1>

          {info.altTitles && info.altTitles.length > 0 && (
            <p className="mangainfo-alt">
              {info.altTitles.map((t) =>
                typeof t === 'string' ? t : Object.values(t).join(', ')
              ).join(' / ')}
            </p>
          )}

          {/* Stats row */}
          <div className="mangainfo-stats">
            {chapters.length > 0 && (
              <div className="mangainfo-stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
                <span>{chapters.length} Chapters</span>
              </div>
            )}
            {info.releaseDate && (
              <div className="mangainfo-stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <span>{info.releaseDate}</span>
              </div>
            )}
            {info.authors && info.authors.length > 0 && (
              <div className="mangainfo-stat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span>{info.authors.join(', ')}</span>
              </div>
            )}
          </div>

          {genres.length > 0 && (
            <div className="mangainfo-genres">
              {genres.map((g) => (
                <span key={g} className="mangainfo-genre">{g}</span>
              ))}
            </div>
          )}

          {description && (
            <div className="mangainfo-desc-wrap">
              <p className={`mangainfo-desc ${!descExpanded && isLongDesc ? 'mangainfo-desc-clamp' : ''}`}>
                {description}
              </p>
              {isLongDesc && (
                <button className="mangainfo-desc-toggle" onClick={() => setDescExpanded(!descExpanded)}>
                  {descExpanded ? 'Show Less' : 'Read More'}
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="mangainfo-actions">
            {chapters.length > 0 && (
              <>
                <button
                  className="mangainfo-btn-primary"
                  onClick={() => navigate(`/manga/read?id=${encodeURIComponent(readerMangaId)}&chapterId=${encodeURIComponent(firstChapter.id)}&provider=${readerProvider}`)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                    <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                  </svg>
                  {isNovel ? 'Start Reading Novel' : 'Start Reading'}
                </button>
                {lastChapter && lastChapter !== firstChapter && (
                  <button
                    className="mangainfo-btn-secondary"
                    onClick={() => navigate(`/manga/read?id=${encodeURIComponent(readerMangaId)}&chapterId=${encodeURIComponent(lastChapter.id)}&provider=${readerProvider}`)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>
                    </svg>
                    Latest
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== CHAPTER LIST ===== */}
      {chapters.length > 0 && (
        <div className="mangainfo-chapters">
          <div className="mangainfo-chapters-head">
            <h2>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
              Chapters
              <span className="mangainfo-chapters-count">{filteredChapters.length}</span>
            </h2>
            <div className="mangainfo-chapters-controls">
              <div className="mangainfo-ch-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  placeholder="Search chapter..."
                />
              </div>
              <button className="manga-sort-btn" onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  {sortOrder === 'desc' ? (
                    <path d="M12 5v14M5 12l7 7 7-7"/>
                  ) : (
                    <path d="M12 19V5M19 12l-7-7-7 7"/>
                  )}
                </svg>
                {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
              </button>
            </div>
          </div>

          <div className="mangainfo-chapter-list">
            {displayChapters.map((ch, i) => {
              const chNum = ch.chapter || ch.id?.match(/chapter[_-]?([\d.]+)/)?.[1] || `${i + 1}`;
              const chTitle = ch.title && ch.title !== `Chapter ${chNum}` ? ch.title : null;
              const chLang = ch.translatedLanguage;
              return (
                <div
                  key={ch.id || i}
                  className="mangainfo-chapter-item"
                  onClick={() => navigate(`/manga/read?id=${encodeURIComponent(readerMangaId)}&chapterId=${encodeURIComponent(ch.id)}&provider=${readerProvider}`)}
                >
                  <div className="mangainfo-ch-left">
                    <span className="mangainfo-ch-number">{chNum}</span>
                    <div className="mangainfo-ch-text">
                      <span className="mangainfo-chapter-name">
                        {chTitle || `Chapter ${chNum}`}
                      </span>
                      {ch.releaseDate && <span className="mangainfo-chapter-date">{ch.releaseDate}</span>}
                    </div>
                  </div>
                  <svg className="mangainfo-ch-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              );
            })}
            {filteredChapters.length === 0 && chapterSearch && (
              <div className="mangainfo-ch-empty">No chapters matching "{chapterSearch}"</div>
            )}
          </div>

          {!showAllChapters && filteredChapters.length > 50 && (
            <button className="manga-load-more" onClick={() => setShowAllChapters(true)}>
              Show All {filteredChapters.length} Chapters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
