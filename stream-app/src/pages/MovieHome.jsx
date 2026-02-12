import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getGokuTrendingMovies,
  getGokuTrendingTV,
  getGokuRecentMovies,
  getGokuRecentTV,
  getTMDBGenres,
  getTrendingTMDB,
  getPopularMovies,
  getPopularTV,
  discoverByGenre,
  discoverTMDB,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';

/* ── filter options ── */
const TYPE_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'movie', label: 'Movie' },
  { value: 'tv', label: 'TV Series' },
];

const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Populer' },
  { value: 'vote_average.desc', label: 'Rating Tertinggi' },
  { value: 'primary_release_date.desc', label: 'Terbaru' },
  { value: 'revenue.desc', label: 'Revenue' },
];

const currentYear = new Date().getFullYear();
const QUICK_YEARS = Array.from({ length: 8 }, (_, i) => currentYear - i);
const ALL_YEARS = Array.from({ length: 30 }, (_, i) => currentYear - i);

/* genre sections with accent colors */
const GENRE_SECTIONS = [
  { id: 28, label: 'Action', color: '#ef4444' },
  { id: 35, label: 'Comedy', color: '#fbbf24' },
  { id: 18, label: 'Drama', color: '#f97316' },
  { id: 27, label: 'Horror', color: '#f43f5e' },
  { id: 10749, label: 'Romance', color: '#ec4899' },
  { id: 878, label: 'Sci-Fi', color: '#38bdf8' },
  { id: 53, label: 'Thriller', color: '#818cf8' },
  { id: 16, label: 'Animation', color: '#a78bfa' },
  { id: 10751, label: 'Family', color: '#34d399' },
  { id: 99, label: 'Documentary', color: '#22d3ee' },
];

export default function MovieHome() {
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingTV, setTrendingTV] = useState([]);
  const [recentMovies, setRecentMovies] = useState([]);
  const [recentTV, setRecentTV] = useState([]);
  const [genreData, setGenreData] = useState({});
  const [allGenres, setAllGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');

  /* filters */
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSort, setFilterSort] = useState('popularity.desc');
  const [filteredResults, setFilteredResults] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const navigate = useNavigate();
  const heroInterval = useRef(null);

  const isFilterActive = filterType || filterGenre || filterYear || filterSort !== 'popularity.desc';

  /* ── Initial load ── */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch base sections + genres in parallel
      const [baseResults, genresRes] = await Promise.all([
        Promise.allSettled([
          getGokuTrendingMovies(),
          getGokuRecentMovies(),
          getGokuTrendingTV(),
          getGokuRecentTV(),
        ]),
        getTMDBGenres().catch(() => ({ data: [] })),
      ]);

      if (baseResults[0].status === 'fulfilled') setTrendingMovies(baseResults[0].value.data || []);
      if (baseResults[1].status === 'fulfilled') setRecentMovies(baseResults[1].value.data || []);
      if (baseResults[2].status === 'fulfilled') setTrendingTV(baseResults[2].value.data || []);
      if (baseResults[3].status === 'fulfilled') setRecentTV(baseResults[3].value.data || []);

      if (genresRes.data) setAllGenres(genresRes.data);

      setLoading(false);

      // Lazy-load genre sections (first 5 then rest)
      const initialGenres = GENRE_SECTIONS.slice(0, 5);
      const genreResults = await Promise.allSettled(
        initialGenres.map((g) => discoverByGenre(g.id, 1, 'movie'))
      );
      const gd = {};
      initialGenres.forEach((g, i) => {
        if (genreResults[i].status === 'fulfilled') {
          gd[g.id] = genreResults[i].value.data?.results || [];
        }
      });
      setGenreData(gd);

      const remaining = GENRE_SECTIONS.slice(5);
      if (remaining.length > 0) {
        const moreResults = await Promise.allSettled(
          remaining.map((g) => discoverByGenre(g.id, 1, 'movie'))
        );
        setGenreData((prev) => {
          const updated = { ...prev };
          remaining.forEach((g, i) => {
            if (moreResults[i].status === 'fulfilled') {
              updated[g.id] = moreResults[i].value.data?.results || [];
            }
          });
          return updated;
        });
      }
    };
    fetchData();
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
        if (filterType) {
          // Single media type
          const res = await discoverTMDB({
            mediaType: filterType,
            genre: filterGenre || undefined,
            year: filterYear || undefined,
            sort: filterSort,
            page: 1,
          });
          setFilteredResults(res.data?.results || []);
        } else {
          // Both movie + tv
          const [movieRes, tvRes] = await Promise.allSettled([
            discoverTMDB({ mediaType: 'movie', genre: filterGenre || undefined, year: filterYear || undefined, sort: filterSort, page: 1 }),
            discoverTMDB({ mediaType: 'tv', genre: filterGenre || undefined, year: filterYear || undefined, sort: filterSort, page: 1 }),
          ]);
          const movies = movieRes.status === 'fulfilled' ? movieRes.value.data?.results || [] : [];
          const tvs = tvRes.status === 'fulfilled' ? tvRes.value.data?.results || [] : [];
          // Merge and sort by popularity (fallback)
          const merged = [...movies, ...tvs].sort((a, b) => (b.rating || 0) - (a.rating || 0));
          setFilteredResults(merged.slice(0, 40));
        }
      } catch {
        setFilteredResults([]);
      }
      setFilterLoading(false);
    };

    const debounce = setTimeout(fetchFiltered, 300);
    return () => clearTimeout(debounce);
  }, [filterType, filterGenre, filterYear, filterSort, isFilterActive]);

  /* ── Auto-rotate hero ── */
  useEffect(() => {
    if (trendingMovies.length < 2) return;
    heroInterval.current = setInterval(() => {
      setHeroIdx((i) => (i + 1) % Math.min(trendingMovies.length, 8));
    }, 6000);
    return () => clearInterval(heroInterval.current);
  }, [trendingMovies]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/movies/search?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterGenre('');
    setFilterYear('');
    setFilterSort('popularity.desc');
  };

  if (loading) return <Loading text="Loading..." theme="sooraflix" />;

  const hero = trendingMovies[heroIdx];
  const gokuHeroImg = (url) => url ? url.replace(/\/resize\/\d+x\d+\//, '/resize/1200x800/') : url;

  /* human-readable filter summary */
  const activeFilterCount = [filterType, filterGenre, filterYear, filterSort !== 'popularity.desc' ? filterSort : ''].filter(Boolean).length;
  const filterSummary = [
    filterType && TYPE_OPTIONS.find((o) => o.value === filterType)?.label,
    filterGenre && allGenres.find((g) => g.id === Number(filterGenre))?.name,
    filterYear,
    filterSort !== 'popularity.desc' && SORT_OPTIONS.find((o) => o.value === filterSort)?.label,
  ].filter(Boolean).join(' · ');

  return (
    <div className="home-page sooraflix-page">
      {/* Hero Banner */}
      {hero && (
        <div className="hero-banner sooraflix-hero" key={heroIdx}>
          <div className="hero-bg">
            <img src={gokuHeroImg(hero.image)} alt="" />
          </div>
          <div className="hero-content">
            <div className="hero-top-row">
              <div className="hero-badge sooraflix-badge">Trending</div>
              {hero.duration && <div className="hero-quality">{hero.duration}</div>}
            </div>
            <h1 className="hero-title">{hero.title || 'Unknown'}</h1>
            <div className="hero-meta">
              {hero.type && <span className="hero-tag">{hero.type}</span>}
              {hero.releaseDate && <span className="hero-tag">{hero.releaseDate}</span>}
            </div>
            <div className="hero-actions">
              <button className="btn-play sooraflix-btn-play" onClick={() => navigate(`/movies/info?id=${encodeURIComponent(hero.id)}&type=${hero.mediaType || 'movie'}`)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Watch Now
              </button>
              <button className="btn-glass" onClick={() => navigate(`/movies/info?id=${encodeURIComponent(hero.id)}&type=${hero.mediaType || 'movie'}`)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                Details
              </button>
            </div>
            {trendingMovies.length > 1 && (
              <div className="hero-dots">
                {trendingMovies.slice(0, 8).map((_, i) => (
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
            placeholder="Search movies & TV shows..."
          />
        </form>
      </div>

      {/* ── Filter Panel ── */}
      <div className="af-panel">
        <div className={`af-card ${filterOpen ? 'open' : ''}`}>
          {/* Toggle header */}
          <button className="af-header" onClick={() => setFilterOpen((v) => !v)}>
            <div className="af-header-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              <span>Filter</span>
              {isFilterActive && !filterOpen && (
                <span className="af-header-count">{activeFilterCount}</span>
              )}
            </div>
            <svg className="af-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {/* Collapsible body */}
          <div className="af-body">
            <div className="af-body-inner">
              {/* Type + Sort side by side */}
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
                  <span className="af-label">Urutan</span>
                  <div className="af-pills">
                    {SORT_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        className={`af-pill ${filterSort === o.value ? 'active' : ''}`}
                        onClick={() => setFilterSort(o.value)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Genre picker */}
              {allGenres.length > 0 && (
                <div className="af-year-section">
                  <span className="af-label">Genre</span>
                  <div className="af-genre-track">
                    <button
                      className={`af-pill ${filterGenre === '' ? 'active' : ''}`}
                      onClick={() => setFilterGenre('')}
                    >
                      Semua
                    </button>
                    {allGenres.map((g) => (
                      <button
                        key={g.id}
                        className={`af-pill ${filterGenre === String(g.id) ? 'active' : ''}`}
                        onClick={() => setFilterGenre(String(g.id))}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                    {filterGenre && (
                      <span className="af-chip">
                        {allGenres.find((g) => g.id === Number(filterGenre))?.name}
                        <button onClick={() => setFilterGenre('')} aria-label="Remove">
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
                    {filterSort !== 'popularity.desc' && (
                      <span className="af-chip">
                        {SORT_OPTIONS.find((o) => o.value === filterSort)?.label}
                        <button onClick={() => setFilterSort('popularity.desc')} aria-label="Remove">
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
              <span>Mencari film...</span>
            </div>
          ) : filteredResults && filteredResults.length > 0 ? (
            <div className="filter-results-grid">
              {filteredResults.slice(0, 40).map((item) => (
                <Card key={`${item.mediaType}-${item.id}`} item={item} type="movie" />
              ))}
            </div>
          ) : filteredResults !== null ? (
            <div className="filter-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6" strokeLinecap="round"/>
              </svg>
              <p>Tidak ada film yang cocok dengan filter ini</p>
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
          {trendingMovies.length > 0 && <Section title="Trending Movies" items={trendingMovies} type="movie" />}
          {recentMovies.length > 0 && <Section title="Recent Movies" items={recentMovies} type="movie" />}
          {trendingTV.length > 0 && <Section title="Trending TV Shows" items={trendingTV} type="movie" />}
          {recentTV.length > 0 && <Section title="Recent TV Shows" items={recentTV} type="movie" />}

          {/* Genre sections */}
          {GENRE_SECTIONS.map((genre) => {
            const items = genreData[genre.id];
            if (!items || items.length === 0) return null;
            return (
              <Section
                key={genre.id}
                title={genre.label}
                items={items}
                type="movie"
                accentColor={genre.color}
              />
            );
          })}
        </>
      )}

      {!trendingMovies.length && !recentMovies.length && (
        <div className="empty-state">
          <p>No movie data available. Make sure the API server is running.</p>
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
          <button onClick={() => scroll(-1)} className={`scroll-btn ${!canScrollLeft ? 'disabled' : ''}`} disabled={!canScrollLeft}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button onClick={() => scroll(1)} className={`scroll-btn ${!canScrollRight ? 'disabled' : ''}`} disabled={!canScrollRight}>
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
