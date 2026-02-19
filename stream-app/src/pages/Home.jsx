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
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';
import SkeletonSection from '../components/SkeletonSection';

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
  const [spotlight, setSpotlight] = useState([]);
  const [recentEps, setRecentEps] = useState([]);
  const [mostPopular, setMostPopular] = useState([]);
  const [topAiring, setTopAiring] = useState([]);
  const [genreData, setGenreData] = useState({}); // { action: [...], romance: [...] }
  const [heroReady, setHeroReady] = useState(false);    // hero section loaded
  const [sectionsReady, setSectionsReady] = useState(false); // base sections loaded
  const [genresReady, setGenresReady] = useState(false);     // genre sections loaded
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');

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

  /* ── Initial load — try bundle first, fallback to individual calls ── */
  useEffect(() => {
    let cancelled = false;

    const fetchViaBundle = async () => {
      try {
        const res = await getAnimeHomeBundle();
        const d = res.data || res;
        if (cancelled) return;

        // Set hero immediately for instant perceived load
        if (d.spotlight?.length > 0) {
          setSpotlight(d.spotlight);
        }
        setHeroReady(true);

        // If bundle returned completely empty, signal caller to try fallback
        const hasData = d.spotlight?.length > 0 || d.recentEpisodes?.length > 0 ||
          d.mostPopular?.length > 0 || d.topAiring?.length > 0;
        if (!hasData) {
          setSectionsReady(true);
          setGenresReady(true);
          return false;
        }

        // Set base sections — slight delay so hero renders first
        requestAnimationFrame(() => {
          if (cancelled) return;
          if (d.recentEpisodes?.length > 0) setRecentEps(d.recentEpisodes);
          if (d.mostPopular?.length > 0) setMostPopular(d.mostPopular);
          if (d.topAiring?.length > 0) setTopAiring(d.topAiring);
          setSectionsReady(true);
        });

        // Set genres with a tiny stagger for smooth render
        setTimeout(() => {
          if (cancelled) return;
          if (d.genres && Object.keys(d.genres).length > 0) setGenreData(d.genres);
          setGenresReady(true);
        }, 50);

        return true; // success
      } catch {
        return false; // fallback needed
      }
    };

    const fetchIndividual = async () => {
      // Phase 1: Spotlight only (fastest perceived load)
      try {
        const spotlightRes = await getAnimeSpotlight();
        if (cancelled) return;
        const spotData = spotlightRes.data?.results || spotlightRes.data || [];
        setSpotlight(spotData);
        setHeroReady(true);
      } catch { setHeroReady(true); }

      // Phase 2: Base sections in parallel
      const baseResults = await Promise.allSettled([
        getAnimeRecentEpisodes(1),
        getAnimeMostPopular(1),
        getAnimeTopAiring(1),
      ]);
      if (cancelled) return;

      if (baseResults[0].status === 'fulfilled') setRecentEps(baseResults[0].value.data?.results || baseResults[0].value.data || []);
      if (baseResults[1].status === 'fulfilled') setMostPopular(baseResults[1].value.data?.results || baseResults[1].value.data || []);
      if (baseResults[2].status === 'fulfilled') setTopAiring(baseResults[2].value.data?.results || baseResults[2].value.data || []);
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

  if (!heroReady) return <Loading text="Loading..." />;

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
              <button className="btn-play" onClick={() => navigate(`/anime/info?id=${encodeURIComponent(hero.id)}`)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Watch Now
              </button>
              <button className="btn-glass" onClick={() => navigate(`/anime/info?id=${encodeURIComponent(hero.id)}`)}>
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
              {/* Type + Season side by side */}
              <div className="af-top">
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
              </div>

              {/* Year picker */}
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
                    <select
                      value={!filterYear || QUICK_YEARS.includes(Number(filterYear)) ? '' : filterYear}
                      onChange={(e) => e.target.value && setFilterYear(e.target.value)}
                      className="af-year-select"
                    >
                      <option value="">Lainnya</option>
                      {ALL_YEARS.filter((y) => !QUICK_YEARS.includes(y)).map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
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

      {/* ── Default Sections (when no filter active) ── */}
      {!isFilterActive && (
        <>
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

      {!spotlight.length && !recentEps.length && (
        <div className="empty-state">
          <p>No data available. Make sure the Consumet API is running on <code>localhost:3000</code></p>
        </div>
      )}
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