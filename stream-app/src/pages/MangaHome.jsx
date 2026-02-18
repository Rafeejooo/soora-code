import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  searchManga,
  getPopularManga,
  normalizeMangaTitle,
  mangaImgProxy,
  isMangaNovel,
  isManhwa,
  getMangaContentType,
  searchKomiku,
  getMangaHomeBundle,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';
import SkeletonSection from '../components/SkeletonSection';

/* ── Section configs per language ── */
const POPULAR_QUERIES = [
  { label: 'Trending', queries: ['solo leveling', 'one piece', 'jujutsu kaisen'] },
  { label: 'Action', queries: ['demon slayer', 'attack on titan', 'chainsaw man'] },
  { label: 'Romance', queries: ['horimiya', 'kaguya sama', 'my dress up darling'] },
  { label: 'Fantasy', queries: ['mushoku tensei', 'shield hero', 'overlord'] },
];

const KOMIKU_QUERIES = [
  { label: 'Trending', queries: ['solo leveling', 'one piece', 'jujutsu kaisen'] },
  { label: 'Action', queries: ['demon slayer', 'naruto', 'chainsaw man'] },
  { label: 'Romance', queries: ['horimiya', 'kaguya sama', 'spy x family'] },
  { label: 'Fantasy', queries: ['mushoku tensei', 'overlord', 'shield hero'] },
];

/* ── Filter options ── */
const TYPE_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'manga', label: 'Manga' },
  { value: 'manhwa', label: 'Manhwa / Manhua' },
  { value: 'novel', label: 'Light Novel' },
];

const GENRE_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'action', label: 'Action', queries: ['demon slayer', 'attack on titan', 'chainsaw man', 'black clover', 'one punch man'] },
  { value: 'romance', label: 'Romance', queries: ['horimiya', 'kaguya sama', 'my dress up darling', 'fruits basket', 'your lie in april'] },
  { value: 'fantasy', label: 'Fantasy', queries: ['mushoku tensei', 'shield hero', 'overlord', 'sword art online', 're zero'] },
  { value: 'comedy', label: 'Comedy', queries: ['grand blue', 'spy x family', 'gintama', 'mob psycho'] },
  { value: 'horror', label: 'Horror', queries: ['junji ito', 'berserk', 'tokyo ghoul', 'parasyte'] },
  { value: 'sports', label: 'Sports', queries: ['haikyuu', 'slam dunk', 'blue lock', 'kuroko basketball'] },
  { value: 'sci-fi', label: 'Sci-Fi', queries: ['dr stone', 'steins gate', 'psycho pass', 'ghost in the shell'] },
  { value: 'slice-of-life', label: 'Slice of Life', queries: ['march comes in like a lion', 'barakamon', 'yotsuba', 'a silent voice'] },
];

export default function MangaHome() {
  const [sections, setSections] = useState({});
  const [heroReady, setHeroReady] = useState(false);
  const [loadedSections, setLoadedSections] = useState(new Set()); // track which sections are loaded
  const [searchVal, setSearchVal] = useState('');
  const [heroItems, setHeroItems] = useState([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem('soora_manga_lang') || 'en';
  });

  /* ── Filters ── */
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filteredResults, setFilteredResults] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const heroInterval = useRef(null);
  const navigate = useNavigate();

  const isFilterActive = filterType || filterGenre;

  // Persist language choice
  useEffect(() => {
    localStorage.setItem('soora_manga_lang', selectedLang);
  }, [selectedLang]);

  // ── Apply filters (genre = server search, type = client filter) ──
  useEffect(() => {
    if (!isFilterActive) {
      setFilteredResults(null);
      return;
    }

    const fetchFiltered = async () => {
      setFilterLoading(true);
      const useKomiku = selectedLang === 'id';
      const searchFn = useKomiku ? searchKomiku : searchManga;
      const providerTag = useKomiku ? 'komiku' : null;

      try {
        let items = [];
        const seen = new Set();

        // If genre selected, use genre-specific queries; otherwise use broad popular
        const genreConfig = GENRE_OPTIONS.find((g) => g.value === filterGenre);
        const queries = genreConfig?.queries || ['one piece', 'naruto', 'solo leveling', 'demon slayer', 'jujutsu kaisen'];

        const results = await Promise.allSettled(queries.map((q) => searchFn(q)));
        results.forEach((r) => {
          if (r.status === 'fulfilled') {
            (r.value.data?.results || []).forEach((item) => {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                items.push(providerTag ? { ...item, provider: providerTag } : item);
              }
            });
          }
        });

        // Client-side type filter
        if (filterType === 'manga') {
          items = items.filter((i) => !isMangaNovel(i) && !isManhwa(i));
        } else if (filterType === 'manhwa') {
          items = items.filter((i) => isManhwa(i));
        } else if (filterType === 'novel') {
          items = items.filter((i) => isMangaNovel(i));
        }

        setFilteredResults(items);
      } catch {
        setFilteredResults([]);
      }
      setFilterLoading(false);
    };

    const debounce = setTimeout(fetchFiltered, 300);
    return () => clearTimeout(debounce);
  }, [filterType, filterGenre, selectedLang, isFilterActive]);

  useEffect(() => {
    let cancelled = false;

    const fetchViaBundle = async () => {
      try {
        const res = await getMangaHomeBundle(selectedLang);
        const d = res.data || res;
        if (cancelled) return false;

        // Hero first — instant perceived load
        if (d.heroItems?.length > 0) {
          setHeroItems(d.heroItems);
        }
        setHeroReady(true);

        // Stagger sections for smooth appearance
        if (d.sections) {
          const labels = Object.keys(d.sections);
          labels.forEach((label, i) => {
            setTimeout(() => {
              if (cancelled) return;
              setSections((prev) => ({ ...prev, [label]: d.sections[label] || [] }));
              setLoadedSections((prev) => new Set([...prev, label]));
            }, i * 30);
          });
        }

        return true;
      } catch {
        return false;
      }
    };

    const fetchIndividual = async () => {
      setHeroReady(false);
      setSections({});
      setLoadedSections(new Set());
      setHeroItems([]);

      const useKomiku = selectedLang === 'id';
      const queries = useKomiku ? KOMIKU_QUERIES : POPULAR_QUERIES;
      const searchFn = useKomiku ? searchKomiku : searchManga;
      const providerTag = useKomiku ? 'komiku' : null;
      const seen = new Set();

      // Flatten ALL search queries and fire them ALL in parallel (12 calls at once)
      const allQueries = [];
      for (const sec of queries) {
        for (const q of sec.queries) {
          allQueries.push({ label: sec.label, query: q });
        }
      }

      const allResults = await Promise.allSettled(
        allQueries.map((aq) => searchFn(aq.query))
      );

      if (cancelled) return;

      // Group results by section label
      const sectionMap = {};
      const heroList = [];

      let idx = 0;
      for (const sec of queries) {
        const items = [];
        for (const _q of sec.queries) {
          const result = allResults[idx];
          if (result.status === 'fulfilled') {
            (result.value.data?.results || []).forEach((item) => {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                items.push(providerTag ? { ...item, provider: providerTag } : item);
              }
            });
          }
          idx++;
        }
        sectionMap[sec.label] = items;

        if (sec.label === 'Trending' && items.length > 0) {
          heroList.push(...items.filter((i) => !isMangaNovel(i)).slice(0, 6));
        }
      }

      // Hero first
      if (heroList.length > 0) setHeroItems(heroList);
      setHeroReady(true);

      // Stagger section renders
      const labels = queries.map((q) => q.label);
      labels.forEach((label, i) => {
        setTimeout(() => {
          if (cancelled) return;
          setSections((prev) => ({ ...prev, [label]: sectionMap[label] || [] }));
          setLoadedSections((prev) => new Set([...prev, label]));
        }, i * 30);
      });
    };

    // Reset state
    setHeroReady(false);
    setSections({});
    setLoadedSections(new Set());
    setHeroItems([]);

    (async () => {
      const ok = await fetchViaBundle();
      if (!ok && !cancelled) await fetchIndividual();
    })();

    return () => { cancelled = true; };
  }, [selectedLang]);

  // Auto-rotate hero
  useEffect(() => {
    if (heroItems.length < 2) return;
    heroInterval.current = setInterval(() => {
      setHeroIdx((i) => (i + 1) % Math.min(heroItems.length, 6));
    }, 6000);
    return () => clearInterval(heroInterval.current);
  }, [heroItems]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/manga/search?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterGenre('');
  };

  if (!heroReady) return <Loading text="Loading manga..." theme="sooramics" />;

  const hero = heroItems[heroIdx];

  return (
    <div className="home-page sooramics-page">
      {/* Hero Banner */}
      {hero && (
        <div className="hero-banner sooramics-hero" key={heroIdx}>
          <div className="hero-bg">
            <img src={hero.image?.includes('komiku.org') ? hero.image : mangaImgProxy(hero.image)} alt="" referrerPolicy="no-referrer" />
          </div>
          <div className="hero-content">
            <div className="hero-top-row">
              <div className="hero-badge sooramics-badge">{getMangaContentType(hero)}</div>
            </div>
            <h1 className="hero-title">{normalizeMangaTitle(hero.title)}</h1>
            {hero.description && (
              <p className="hero-desc">
                {hero.description.length > 180
                  ? hero.description.slice(0, 180) + '...'
                  : hero.description}
              </p>
            )}
            <div className="hero-actions">
              <button
                className="btn-play sooramics-btn-play"
                onClick={() => navigate(`/manga/info?id=${encodeURIComponent(hero.id)}&provider=${hero.provider || 'mangapill'}`)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                </svg>
                Read Now
              </button>
              <button
                className="btn-glass"
                onClick={() => navigate(`/manga/info?id=${encodeURIComponent(hero.id)}&provider=${hero.provider || 'mangapill'}`)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                Details
              </button>
            </div>
            {heroItems.length > 1 && (
              <div className="hero-dots">
                {heroItems.slice(0, 6).map((_, i) => (
                  <button
                    key={i}
                    className={`hero-dot ${i === heroIdx ? 'active' : ''}`}
                    onClick={() => setHeroIdx(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="home-search">
        <form onSubmit={handleSearch} className="home-search-form">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search manga, manhwa, manhua..."
          />
        </form>
      </div>

      {/* ── Filter Panel ── */}
      <div className="af-panel">
        <div className={`af-card ${filterOpen ? 'open' : ''}`}>
          <button className="af-header" onClick={() => setFilterOpen((v) => !v)}>
            <div className="af-header-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              <span>Filter</span>
              {isFilterActive && !filterOpen && (
                <span className="af-header-count">{[filterType, filterGenre].filter(Boolean).length}</span>
              )}
            </div>
            <svg className="af-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          <div className="af-body">
            <div className="af-body-inner">
              {/* Language + Type side by side */}
              <div className="af-top">
                <div className="af-group">
                  <span className="af-label">Bahasa</span>
                  <div className="af-pills">
                    <button
                      className={`af-pill ${selectedLang === 'en' ? 'active' : ''}`}
                      onClick={() => setSelectedLang('en')}
                    >
                      🌐 English
                    </button>
                    <button
                      className={`af-pill ${selectedLang === 'id' ? 'active' : ''}`}
                      onClick={() => setSelectedLang('id')}
                    >
                      🇮🇩 Indonesia
                    </button>
                  </div>
                </div>
                <div className="af-divider" />
                <div className="af-group">
                  <span className="af-label">Tipe</span>
                  <div className="af-pills">
                    {TYPE_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        className={`af-pill ${filterType === o.value ? 'active' : ''}`}
                        onClick={() => setFilterType(o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Genre pills */}
              <div className="af-genre-section">
                <span className="af-label">Genre</span>
                <div className="af-pills">
                  {GENRE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      className={`af-pill ${filterGenre === o.value ? 'active' : ''}`}
                      onClick={() => setFilterGenre(o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active summary bar */}
              {isFilterActive && (
                <div className="af-active-bar">
                  <div className="af-chips">
                    {filterType && (
                      <span className="af-chip">
                        {TYPE_OPTIONS.find((o) => o.value === filterType)?.label}
                        <button onClick={() => setFilterType('')} aria-label="Remove">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </span>
                    )}
                    {filterGenre && (
                      <span className="af-chip">
                        {GENRE_OPTIONS.find((o) => o.value === filterGenre)?.label}
                        <button onClick={() => setFilterGenre('')} aria-label="Remove">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </span>
                    )}
                  </div>
                  <button className="af-reset" onClick={clearFilters}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                    </svg>
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Results ── */}
      {isFilterActive && (
        <div className="filter-results-area">
          <div className="filter-results-header">
            <h2>Hasil Pencarian</h2>
            <span className="filter-summary-tag">
              {[
                filterType && TYPE_OPTIONS.find((o) => o.value === filterType)?.label,
                filterGenre && GENRE_OPTIONS.find((o) => o.value === filterGenre)?.label,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
          {filterLoading ? (
            <div className="filter-loading">
              <div className="filter-spinner" />
              <span>Mencari manga...</span>
            </div>
          ) : filteredResults && filteredResults.length > 0 ? (
            <div className="filter-results-grid">
              {filteredResults.slice(0, 30).map((item) => (
                <Card key={item.id} item={item} type="manga" />
              ))}
            </div>
          ) : filteredResults !== null ? (
            <div className="filter-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6" strokeLinecap="round"/>
              </svg>
              <p>Tidak ada manga yang cocok dengan filter ini</p>
              <button className="af-reset" onClick={clearFilters}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                </svg>
                Reset Filter
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Default Sections (when no filter active) ── */}
      {!isFilterActive && (
        <>
          {(selectedLang === 'id' ? KOMIKU_QUERIES : POPULAR_QUERIES).map((sec) => (
            loadedSections.has(sec.label) ? (
              sections[sec.label]?.length > 0 && (
                <div key={sec.label} className="section-fade-in">
                  <Section title={sec.label} items={sections[sec.label]} type="manga" />
                </div>
              )
            ) : (
              <SkeletonSection key={`skel-${sec.label}`} />
            )
          ))}
        </>
      )}

      {!isFilterActive && loadedSections.size >= (selectedLang === 'id' ? KOMIKU_QUERIES : POPULAR_QUERIES).length && Object.values(sections).every((s) => !s?.length) && (
        <div className="empty-state">
          <p>No manga available. Make sure the Consumet API is running on <code>localhost:3000</code></p>
        </div>
      )}
    </div>
  );
}

/* isManhwa is now imported from ../api */

function Section({ title, items, type }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, items]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const cardW = scrollRef.current.querySelector('.card')?.offsetWidth || 200;
    scrollRef.current.scrollBy({ left: dir * cardW * 3, behavior: 'smooth' });
  };

  return (
    <section className="home-section">
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <div className="section-nav">
          <button
            onClick={() => scroll(-1)}
            className={`scroll-btn ${!canScrollLeft ? 'disabled' : ''}`}
            disabled={!canScrollLeft}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            onClick={() => scroll(1)}
            className={`scroll-btn ${!canScrollRight ? 'disabled' : ''}`}
            disabled={!canScrollRight}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div className="card-row-wrapper">
        {canScrollLeft && <div className="row-fade row-fade-left" />}
        {canScrollRight && <div className="row-fade row-fade-right" />}
        <div className="card-row" ref={scrollRef}>
          {items.slice(0, 20).map((item) => (
            <Card key={item.id} item={item} type={type} />
          ))}
        </div>
      </div>
    </section>
  );
}
