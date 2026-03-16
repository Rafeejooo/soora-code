import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAnimeSpotlight,
  getAnimeRecentEpisodes,
  getAnimeMostPopular,
  getAnimeTopAiring,
  getAnimeByGenre,
  getAnimeAdvancedSearch,
  getAnimeHomeBundle,
  getSubIndoHomeBundle,
} from '../api';
import { buildAnimeUrl } from '../utils/seo';
import Card from '../components/Card';
import Top10Section from '../components/Top10Section';
import SkeletonHero from '../components/SkeletonHero';
import SkeletonSection from '../components/SkeletonSection';
import CustomSelect from '../components/CustomSelect';

const APP_VERSION = 'v3.2.0';
const BUILD_DATE = '2025-06-18';

/* ── page-level state cache (persists across mounts for instant back-nav) ── */
const _pageCache = { ts: 0, data: null };
const PAGE_CACHE_TTL = 10 * 60 * 1000; // 10 min

const _savePageCache = (state) => {
  _pageCache.data = state;
  _pageCache.ts = Date.now();
};

const _loadPageCache = () => {
  if (_pageCache.data && Date.now() - _pageCache.ts < PAGE_CACHE_TTL) {
    return _pageCache.data;
  }
  return null;
};

/* ── genre config ── */
const GENRE_SECTIONS = [
  { key: 'action', label: 'Action', color: '#ef4444' },
  { key: 'romance', label: 'Romance', color: '#ec4899' },
  { key: 'slice-of-life', label: 'Slice of Life', color: '#f9a8d4' },
  { key: 'fantasy', label: 'Fantasy', color: '#a78bfa' },
  { key: 'comedy', label: 'Comedy', color: '#fbbf24' },
  { key: 'adventure', label: 'Adventure', color: '#34d399' },
  { key: 'sci-fi', label: 'Sci-Fi', color: '#38bdf8' },
  { key: 'drama', label: 'Drama', color: '#f97316' },
  { key: 'mystery', label: 'Mystery', color: '#818cf8' },
  { key: 'horror', label: 'Horror', color: '#f43f5e' },
  { key: 'sports', label: 'Sports', color: '#22d3ee' },
  { key: 'music', label: 'Music', color: '#c084fc' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'movie', label: 'Movie' },
  { value: 'tv', label: 'Series' },
  { value: 'ova', label: 'OVA' },
  { value: 'ona', label: 'ONA' },
  { value: 'special', label: 'Special' },
];

const SEASON_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'winter', label: 'Winter' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
];

const currentYear = new Date().getFullYear();
const QUICK_YEARS = Array.from({ length: 8 }, (_, i) => currentYear - i);
const ALL_YEARS = Array.from({ length: 30 }, (_, i) => currentYear - i);

export default function Home() {
  const cached = _loadPageCache();
  const [spotlight, setSpotlight] = useState(cached?.spotlight || []);
  const [recentEps, setRecentEps] = useState(cached?.recentEps || []);
  const [mostPopular, setMostPopular] = useState(cached?.mostPopular || []);
  const [topAiring, setTopAiring] = useState(cached?.topAiring || []);
  const [genreData, setGenreData] = useState(cached?.genreData || {}); // { action: [...], romance: [...] }
  const [heroReady, setHeroReady] = useState(!!cached);    // hero section loaded
  const [sectionsReady, setSectionsReady] = useState(!!cached); // base sections loaded
  const [genresReady, setGenresReady] = useState(!!cached);     // genre sections loaded
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');

  /* Sub Indo tab state */
  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem('soora_anime_lang') || 'all';
  });
  const [subIndoData, setSubIndoData] = useState(null); // { ongoing, popular, recent }
  const [subIndoLoading, setSubIndoLoading] = useState(false);

  /* filters */
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filteredResults, setFilteredResults] = useState(null); // null = no filter active
  const [filterLoading, setFilterLoading] = useState(false);

  const navigate = useNavigate();
  const heroInterval = useRef(null);

  const isFilterActive = filterType || filterSeason || filterYear;

  // Persist anime language choice
  useEffect(() => {
    localStorage.setItem('soora_anime_lang', selectedLang);
  }, [selectedLang]);

  // Fetch Sub Indo data when tab is selected
  useEffect(() => {
    if (selectedLang !== 'id') return;
    if (subIndoData) return; // already loaded

    let cancelled = false;
    const fetchSubIndo = async () => {
      setSubIndoLoading(true);
      try {
        const bundle = await getSubIndoHomeBundle();
        if (cancelled) return;
        setSubIndoData(bundle);
      } catch (err) {
        console.warn('Sub Indo home fetch failed:', err);
        if (!cancelled) setSubIndoData({ ongoing: [], popular: [], recent: [] });
      } finally {
        if (!cancelled) setSubIndoLoading(false);
      }
    };
    fetchSubIndo();
    return () => { cancelled = true; };
  }, [selectedLang, subIndoData]);

  /* ── Initial load — try bundle first, fallback to individual calls ── */
  useEffect(() => {
    let cancelled = false;

    // If we have a page cache, skip the staggered render delays
    const hasCachedState = !!_loadPageCache();

    // Filter out anime that can't be played (not yet aired, missing ID)
    const filterPlayable = (items) => {
      if (!Array.isArray(items)) return [];
      return items.filter((item) => {
        if (!item?.id) return false;
        const status = (item.status || '').toLowerCase();
        if (status.includes('not yet aired') || status.includes('upcoming') || status.includes('not_yet_aired')) return false;
        return true;
      });
    };

    const applyBundleData = (d) => {
      const newSpotlight = d.spotlight?.length > 0 ? filterPlayable(d.spotlight) : [];
      const newRecent = d.recentEpisodes?.length > 0 ? filterPlayable(d.recentEpisodes) : [];
      const newPopular = d.mostPopular?.length > 0 ? filterPlayable(d.mostPopular) : [];
      const newAiring = d.topAiring?.length > 0 ? filterPlayable(d.topAiring) : [];
      const newGenres = d.genres && Object.keys(d.genres).length > 0 ? d.genres : {};

      if (newSpotlight.length) setSpotlight(newSpotlight);
      setHeroReady(true);
      if (newRecent.length) setRecentEps(newRecent);
      if (newPopular.length) setMostPopular(newPopular);
      if (newAiring.length) setTopAiring(newAiring);
      setSectionsReady(true);
      if (Object.keys(newGenres).length) setGenreData(newGenres);
      setGenresReady(true);

      // Persist to page cache using local values
      _savePageCache({
        spotlight: newSpotlight,
        recentEps: newRecent,
        mostPopular: newPopular,
        topAiring: newAiring,
        genreData: newGenres,
      });
    };

    const fetchViaBundle = async () => {
      try {
        const res = await getAnimeHomeBundle();
        const d = res.data || res;
        if (cancelled) return;

        const hasData = d.spotlight?.length > 0 || d.recentEpisodes?.length > 0 ||
          d.mostPopular?.length > 0 || d.topAiring?.length > 0;
        if (!hasData) {
          setHeroReady(true);
          setSectionsReady(true);
          setGenresReady(true);
          return false;
        }

        if (hasCachedState) {
          // Already showing cached data — apply silently without staggering
          applyBundleData(d);
        } else {
          // First load — stagger for smooth progressive render
          if (d.spotlight?.length > 0) setSpotlight(d.spotlight);
          setHeroReady(true);

          requestAnimationFrame(() => {
            if (cancelled) return;
            if (d.recentEpisodes?.length > 0) setRecentEps(d.recentEpisodes);
            if (d.mostPopular?.length > 0) setMostPopular(d.mostPopular);
            if (d.topAiring?.length > 0) setTopAiring(d.topAiring);
            setSectionsReady(true);
          });

          setTimeout(() => {
            if (cancelled) return;
            if (d.genres && Object.keys(d.genres).length > 0) setGenreData(d.genres);
            setGenresReady(true);

            // Save to page cache after all data applied
            _savePageCache({
              spotlight: d.spotlight?.length > 0 ? d.spotlight : [],
              recentEps: d.recentEpisodes?.length > 0 ? d.recentEpisodes : [],
              mostPopular: d.mostPopular?.length > 0 ? d.mostPopular : [],
              topAiring: d.topAiring?.length > 0 ? d.topAiring : [],
              genreData: d.genres && Object.keys(d.genres).length > 0 ? d.genres : {},
            });
          }, 50);
        }

        return true; // success
      } catch {
        return false; // fallback needed
      }
    };

    const fetchIndividual = async () => {
      let _spot = [];
      // Phase 1: Spotlight only (fastest perceived load)
      try {
        const spotlightRes = await getAnimeSpotlight();
        if (cancelled) return;
        _spot = spotlightRes.data?.results || spotlightRes.data || [];
        setSpotlight(_spot);
        setHeroReady(true);
      } catch { setHeroReady(true); }

      // Phase 2: Base sections in parallel
      const baseResults = await Promise.allSettled([
        getAnimeRecentEpisodes(1),
        getAnimeMostPopular(1),
        getAnimeTopAiring(1),
      ]);
      if (cancelled) return;

      const re = baseResults[0].status === 'fulfilled' ? filterPlayable(baseResults[0].value.data?.results || baseResults[0].value.data || []) : [];
      const mp = baseResults[1].status === 'fulfilled' ? filterPlayable(baseResults[1].value.data?.results || baseResults[1].value.data || []) : [];
      const ta = baseResults[2].status === 'fulfilled' ? filterPlayable(baseResults[2].value.data?.results || baseResults[2].value.data || []) : [];
      setRecentEps(re);
      setMostPopular(mp);
      setTopAiring(ta);
      setSectionsReady(true);

      // Phase 3: All genres in parallel
      const genreResults = await Promise.allSettled(
        GENRE_SECTIONS.map((g) => getAnimeByGenre(g.key, 1))
      );
      if (cancelled) return;

      const gd = {};
      GENRE_SECTIONS.forEach((g, i) => {
        if (genreResults[i].status === 'fulfilled') {
          gd[g.key] = genreResults[i].value.data?.results || genreResults[i].value.data || [];
        }
      });
      setGenreData(gd);
      setGenresReady(true);

      // Save to page cache
      _savePageCache({
        spotlight: _spot,
        recentEps: re,
        mostPopular: mp,
        topAiring: ta,
        genreData: gd,
      });
    };

    (async () => {
      const bundleOk = await fetchViaBundle();
      if (!bundleOk && !cancelled) await fetchIndividual();
    })();

    return () => { cancelled = true; };
  }, []);

  /* ── Filter search ── */
  useEffect(() => {
    if (!isFilterActive) {
      setFilteredResults(null);
      return;
    }

    const fetchFiltered = async () => {
      setFilterLoading(true);
      try {
        const res = await getAnimeAdvancedSearch({
          type: filterType || undefined,
          season: filterSeason || undefined,
          year: filterYear || undefined,
          sort: 'recently_updated',
          page: 1,
        });
        setFilteredResults(res.data?.results || res.data || []);
      } catch {
        setFilteredResults([]);
      }
      setFilterLoading(false);
    };

    const debounce = setTimeout(fetchFiltered, 300);
    return () => clearTimeout(debounce);
  }, [filterType, filterSeason, filterYear, isFilterActive]);

  /* ── Auto-rotate hero ── */
  useEffect(() => {
    if (spotlight.length < 2) return;
    heroInterval.current = setInterval(() => {
      setHeroIdx((i) => (i + 1) % spotlight.length);
    }, 6000);
    return () => clearInterval(heroInterval.current);
  }, [spotlight]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/anime/search?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterSeason('');
    setFilterYear('');
  };

  if (!heroReady) return (
    <div className="home-page">
      <SkeletonHero />
      <SkeletonSection />
      <SkeletonSection />
      <SkeletonSection />
    </div>
  );

  const hero = spotlight[heroIdx];

  /* ── human-readable filter summary ── */
  const filterSummary = [
    filterType && TYPE_OPTIONS.find((o) => o.value === filterType)?.label,
    filterSeason && SEASON_OPTIONS.find((o) => o.value === filterSeason)?.label,
    filterYear,
  ].filter(Boolean).join(' · ');

  return (
    <div className="home-page">
      {/* Hero Banner */}
      {hero && (
        <div className="hero-banner" key={heroIdx}>
          <div className="hero-bg">
            <img src={hero.banner || hero.image || hero.cover} alt="" />
          </div>
          <div className="hero-content">
            <div className="hero-top-row">
              <div className="hero-badge">Spotlight</div>
              {hero.quality && <div className="hero-quality">{hero.quality}</div>}
            </div>
            <h1 className="hero-title">{hero.title?.english || hero.title?.romaji || hero.title || 'Unknown'}</h1>
            {hero.description && (
              <p className="hero-desc" dangerouslySetInnerHTML={{
                __html: (typeof hero.description === 'string' ? hero.description : '').slice(0, 180) + '...'
              }} />
            )}
            <HeroMeta hero={hero} />
            <div className="hero-actions">
              <button className="btn-play" onClick={() => navigate(buildAnimeUrl(hero.id))}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Watch Now
              </button>
              <button className="btn-glass" onClick={() => navigate(buildAnimeUrl(hero.id))}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                Details
              </button>
            </div>
            {spotlight.length > 1 && (
              <div className="hero-dots">
                {spotlight.slice(0, 10).map((_, i) => (
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
            placeholder="Search anime..."
          />
        </form>
      </div>

      {/* ── Filter Panel ── */}
      <div className="af-panel">
        <div className={`af-card ${filterOpen ? 'open' : ''}`}>
          {/* Toggle header — always visible */}
          <button className="af-header" onClick={() => setFilterOpen((v) => !v)}>
            <div className="af-header-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              <span>Filter</span>
              {isFilterActive && !filterOpen && (
                <span className="af-header-count">{[filterType, filterSeason, filterYear].filter(Boolean).length}</span>
              )}
            </div>
            <svg className="af-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {/* Collapsible body */}
          <div className="af-body">
            <div className="af-body-inner">
              {/* Language toggle + Type + Season side by side */}
              <div className="af-top">
                <div className="af-group">
                  <span className="af-label">Bahasa</span>
                  <div className="af-pills">
                    <button
                      className={`af-pill ${selectedLang === 'all' ? 'active' : ''}`}
                      onClick={() => setSelectedLang('all')}
                    >
                      🌐 Semua
                    </button>
                    <button
                      className={`af-pill ${selectedLang === 'id' ? 'active' : ''}`}
                      onClick={() => setSelectedLang('id')}
                    >
                      🇮🇩 Sub Indo
                    </button>
                  </div>
                </div>
                {selectedLang !== 'id' && (
                  <>
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
                <div className="af-divider" />
                <div className="af-group">
                  <span className="af-label">Season</span>
                  <div className="af-pills">
                    {SEASON_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        className={`af-pill ${filterSeason === o.value ? 'active' : ''}`}
                        onClick={() => setFilterSeason(o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                  </>
                )}
              </div>

              {/* Year picker — only for all-languages mode */}
              {selectedLang !== 'id' && (
              <div className="af-year-section">
                <span className="af-label">Tahun</span>
                <div className="af-year-track">
                  <button
                    className={`af-year-btn ${filterYear === '' ? 'active' : ''}`}
                    onClick={() => setFilterYear('')}
                  >
                    Semua
                  </button>
                  {QUICK_YEARS.map((y) => (
                    <button
                      key={y}
                      className={`af-year-btn ${filterYear === String(y) ? 'active' : ''}`}
                      onClick={() => setFilterYear(String(y))}
                    >
                      {y}
                    </button>
                  ))}
                  <div className="af-year-more">
                    <CustomSelect
                      value={!filterYear || QUICK_YEARS.includes(Number(filterYear)) ? '' : filterYear}
                      onChange={(val) => val && setFilterYear(val)}
                      options={[{ value: '', label: 'Lainnya' }, ...ALL_YEARS.filter((y) => !QUICK_YEARS.includes(y)).map((y) => ({ value: String(y), label: String(y) }))]}
                      className="af-year-cs"
                    />
                  </div>
                </div>
              </div>
              )}

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
                    {filterSeason && (
                      <span className="af-chip">
                        {SEASON_OPTIONS.find((o) => o.value === filterSeason)?.label}
                        <button onClick={() => setFilterSeason('')} aria-label="Remove">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      </span>
                    )}
                    {filterYear && (
                      <span className="af-chip">
                        {filterYear}
                        <button onClick={() => setFilterYear('')} aria-label="Remove">
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
            {filterSummary && <span className="filter-summary-tag">{filterSummary}</span>}
          </div>
          {filterLoading ? (
            <div className="filter-loading">
              <div className="filter-spinner" />
              <span>Mencari anime...</span>
            </div>
          ) : filteredResults && filteredResults.length > 0 ? (
            <div className="filter-results-grid">
              {filteredResults.slice(0, 30).map((item) => (
                <Card key={item.id} item={item} type="anime" />
              ))}
            </div>
          ) : filteredResults !== null ? (
            <div className="filter-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6" strokeLinecap="round"/>
              </svg>
              <p>Tidak ada anime yang cocok dengan filter ini</p>
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



      {/* ── Sub Indo Content (when bahasa filter active) ── */}
      {selectedLang === 'id' && !isFilterActive && (
        <div className="subindo-content-area">
          <div className="subindo-banner">
            <span className="subindo-badge-lg">🇮🇩 Sub Indo</span>
            <p>Anime dengan subtitle Indonesia dari Samehadaku — dijamin bisa diputar dengan Sub Indo</p>
          </div>
          {subIndoLoading ? (
            <>
              <SkeletonSection />
              <SkeletonSection />
            </>
          ) : subIndoData ? (
            <>
              {/* Popular Sub Indo — uses SubIndoSection for correct Sub Indo navigation */}
              {subIndoData.popular?.length > 0 && (
                <SubIndoSection title="Anime Indonesia Saat Ini" items={subIndoData.popular} navigate={navigate} />
              )}
              {subIndoData.ongoing?.length > 0 && (
                <SubIndoSection title="Sedang Tayang" items={subIndoData.ongoing} navigate={navigate} />
              )}
              {subIndoData.recent?.length > 0 && (
                <SubIndoSection title="Baru Update" items={subIndoData.recent} navigate={navigate} />
              )}
              {subIndoData.popular?.length > 0 && (
                <SubIndoSection title="Populer" items={subIndoData.popular} navigate={navigate} />
              )}
              {!subIndoData.ongoing?.length && !subIndoData.recent?.length && !subIndoData.popular?.length && (
                <div className="filter-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <p>Tidak ada data Sub Indo tersedia saat ini</p>
                  <button className="af-reset" onClick={() => setSelectedLang('all')}>
                    Kembali ke Semua Anime
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ── Default Sections (when no filter active and not Sub Indo) ── */}
      {!isFilterActive && selectedLang !== 'id' && (
        <>
          {/* Top 10 Anime global */}
          {sectionsReady && topAiring.length > 0 && (
            <Top10Section
              title="Anime Saat Ini"
              items={topAiring}
              type="anime"
            />
          )}

          {/* Base sections — show skeleton while loading */}
          {sectionsReady ? (
            <>
              {recentEps.length > 0 && <Section title="Baru Update" items={recentEps} type="anime" />}
              {topAiring.length > 0 && <Section title="Top Airing" items={topAiring} type="anime" />}
              {mostPopular.length > 0 && <Section title="Paling Populer" items={mostPopular} type="anime" />}
            </>
          ) : (
            <>
              <SkeletonSection />
              <SkeletonSection />
              <SkeletonSection />
            </>
          )}

          {/* Genre sections — show skeletons while loading */}
          {genresReady ? (
            GENRE_SECTIONS.map((genre) => {
              const items = genreData[genre.key];
              if (!items || items.length === 0) return null;
              return (
                <Section
                  key={genre.key}
                  title={genre.label}
                  items={items}
                  type="anime"
                  accentColor={genre.color}
                />
              );
            })
          ) : (
            sectionsReady && GENRE_SECTIONS.slice(0, 4).map((g) => (
              <SkeletonSection key={`skel-${g.key}`} accentColor={g.color} />
            ))
          )}
        </>
      )}

      {!spotlight.length && !recentEps.length && !topAiring.length && !mostPopular.length && heroReady && sectionsReady && (
        <div className="empty-state">
          <p>Gagal memuat data anime. Server mungkin sedang maintenance.</p>
          <button onClick={() => { try { sessionStorage.removeItem('soora_cache:anime:home-bundle'); } catch {} window.location.reload(); }} className="af-reset" style={{ marginTop: '1rem' }}>
            Coba Lagi
          </button>
        </div>
      )}

      {/* Version Footer */}
      <footer className="app-version-footer">
        <span className="version-tag">{APP_VERSION}</span>
        <span className="version-sep">•</span>
        <span className="version-date">{BUILD_DATE}</span>
        <span className="version-sep">•</span>
        <span className="version-label">Soora Stream</span>
      </footer>
    </div>
  );
}

function Section({ title, items, type, accentColor }) {
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
        <h2 className="section-title">
          {accentColor && <span className="section-dot" style={{ background: accentColor }} />}
          {title}
        </h2>
        <div className="section-nav">
          <button
            onClick={() => scroll(-1)}
            className={`scroll-btn ${!canScrollLeft ? 'disabled' : ''}`}
            aria-label="Scroll left"
            disabled={!canScrollLeft}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            onClick={() => scroll(1)}
            className={`scroll-btn ${!canScrollRight ? 'disabled' : ''}`}
            aria-label="Scroll right"
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

/* ── HeroMeta: limits tags on mobile with +N overflow ── */
function HeroMeta({ hero }) {
  const tags = [];
  if (hero.type) tags.push(hero.type);
  if (hero.releaseDate) tags.push(hero.releaseDate);
  if (hero.sub) tags.push(`SUB: ${hero.sub}`);
  if (hero.dub > 0) tags.push(`DUB: ${hero.dub}`);
  if (hero.genres) hero.genres.slice(0, 3).forEach(g => tags.push(g));

  // On mobile show max 4, on desktop show all
  const MAX_MOBILE = 4;
  const overflow = tags.length - MAX_MOBILE;

  return (
    <div className="hero-meta">
      {tags.map((t, i) => (
        <span
          key={i}
          className={`hero-tag${i >= MAX_MOBILE ? ' hero-tag-overflow' : ''}`}
        >
          {t}
        </span>
      ))}
      {overflow > 0 && (
        <span className="hero-tag hero-tag-more">+{overflow}</span>
      )}
    </div>
  );
}

/* ── SubIndoSection: displays Samehadaku anime cards in a horizontal scroll ── */
function SubIndoSection({ title, items, navigate }) {
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
    const cardW = scrollRef.current.querySelector('.subindo-card')?.offsetWidth || 170;
    scrollRef.current.scrollBy({ left: dir * cardW * 3, behavior: 'smooth' });
  };

  const handleCardClick = (item) => {
    // Navigate directly to Watch page with Sub Indo mode + Samehadaku ID
    // This skips the search step and plays directly from Samehadaku
    const title = item.title || '';
    const samehadakuId = item.animeId || '';
    navigate(
      `/watch/anime?title=${encodeURIComponent(title)}&subIndo=1&samehadakuId=${encodeURIComponent(samehadakuId)}&ep=1`
    );
  };

  return (
    <section className="home-section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-dot" style={{ background: '#ef4444' }} />
          {title}
          <span className="subindo-section-badge">🇮🇩</span>
        </h2>
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
          {items.slice(0, 24).map((item, idx) => (
            <div
              key={item.animeId || idx}
              className="subindo-card card"
              onClick={() => handleCardClick(item)}
              role="button"
              tabIndex={0}
            >
              <div className="card-img-wrap">
                <img
                  src={item.poster || item.image || ''}
                  alt={item.title || ''}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.target.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="170" height="240" viewBox="0 0 170 240"><rect fill="%231a1a2e" width="170" height="240"/><text x="85" y="120" text-anchor="middle" fill="%23666" font-family="system-ui" font-size="12">No Image</text></svg>')}`; }}
                />
                <div className="card-overlay">
                  <div className="card-play-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
                <span className="subindo-card-badge">🇮🇩 Sub Indo</span>
              </div>
              <div className="card-info">
                <h3 className="card-title">{item.title || 'Unknown'}</h3>
                <div className="card-meta">
                  {item.type && <span className="card-tag">{item.type}</span>}
                  {item.score && <span className="card-tag card-tag-gold">★ {item.score}</span>}
                  {item.status && <span className="card-tag">{item.status}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}