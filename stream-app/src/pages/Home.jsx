import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAnimeSpotlight,
  getAnimeRecentEpisodes,
  getAnimeMostPopular,
  getAnimeTopAiring,
  getAnimeByGenre,
  getAnimeAdvancedSearch,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';

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
const YEAR_OPTIONS = [
  { value: '', label: 'Semua' },
  ...Array.from({ length: 30 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: String(y) };
  }),
];

export default function Home() {
  const [spotlight, setSpotlight] = useState([]);
  const [recentEps, setRecentEps] = useState([]);
  const [mostPopular, setMostPopular] = useState([]);
  const [topAiring, setTopAiring] = useState([]);
  const [genreData, setGenreData] = useState({}); // { action: [...], romance: [...] }
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');

  /* filters */
  const [filterType, setFilterType] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filteredResults, setFilteredResults] = useState(null); // null = no filter active
  const [filterLoading, setFilterLoading] = useState(false);

  const navigate = useNavigate();
  const heroInterval = useRef(null);

  const isFilterActive = filterType || filterSeason || filterYear;

  /* ── Initial load ── */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch spotlight + base sections
      const baseResults = await Promise.allSettled([
        getAnimeSpotlight(),
        getAnimeRecentEpisodes(1),
        getAnimeMostPopular(1),
        getAnimeTopAiring(1),
      ]);

      if (baseResults[0].status === 'fulfilled') setSpotlight(baseResults[0].value.data.results || baseResults[0].value.data || []);
      if (baseResults[1].status === 'fulfilled') setRecentEps(baseResults[1].value.data.results || baseResults[1].value.data || []);
      if (baseResults[2].status === 'fulfilled') setMostPopular(baseResults[2].value.data.results || baseResults[2].value.data || []);
      if (baseResults[3].status === 'fulfilled') setTopAiring(baseResults[3].value.data.results || baseResults[3].value.data || []);

      // Fetch genre sections in parallel (first 6 for initial load)
      const initialGenres = GENRE_SECTIONS.slice(0, 6);
      const genreResults = await Promise.allSettled(
        initialGenres.map((g) => getAnimeByGenre(g.key, 1))
      );

      const gd = {};
      initialGenres.forEach((g, i) => {
        if (genreResults[i].status === 'fulfilled') {
          gd[g.key] = genreResults[i].value.data.results || genreResults[i].value.data || [];
        }
      });
      setGenreData(gd);
      setLoading(false);

      // Then lazy-load the remaining genres
      const remainingGenres = GENRE_SECTIONS.slice(6);
      if (remainingGenres.length > 0) {
        const moreResults = await Promise.allSettled(
          remainingGenres.map((g) => getAnimeByGenre(g.key, 1))
        );
        setGenreData((prev) => {
          const updated = { ...prev };
          remainingGenres.forEach((g, i) => {
            if (moreResults[i].status === 'fulfilled') {
              updated[g.key] = moreResults[i].value.data.results || moreResults[i].value.data || [];
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

  if (loading) return <Loading text="Loading..." />;

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
            <div className="hero-meta">
              {hero.type && <span className="hero-tag">{hero.type}</span>}
              {hero.releaseDate && <span className="hero-tag">{hero.releaseDate}</span>}
              {hero.sub && <span className="hero-tag">SUB: {hero.sub}</span>}
              {hero.dub > 0 && <span className="hero-tag">DUB: {hero.dub}</span>}
              {hero.genres && hero.genres.slice(0, 3).map(g => <span className="hero-tag" key={g}>{g}</span>)}
            </div>
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
      <div className="anime-filter-panel">
        {/* Type pills */}
        <div className="filter-row">
          <span className="filter-label">Tipe</span>
          <div className="filter-pills">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`filter-pill ${filterType === o.value ? 'active' : ''}`}
                onClick={() => setFilterType(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Season pills */}
        <div className="filter-row">
          <span className="filter-label">Season</span>
          <div className="filter-pills">
            {SEASON_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`filter-pill ${filterSeason === o.value ? 'active' : ''}`}
                onClick={() => setFilterSeason(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Year select */}
        <div className="filter-row">
          <span className="filter-label">Tahun</span>
          <div className="filter-pills">
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="filter-select-modern">
              {YEAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter chips + reset */}
        {isFilterActive && (
          <div className="filter-active-bar">
            <div className="filter-active-chips">
              {filterType && (
                <span className="filter-chip">
                  {TYPE_OPTIONS.find((o) => o.value === filterType)?.label}
                  <button onClick={() => setFilterType('')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </span>
              )}
              {filterSeason && (
                <span className="filter-chip">
                  {SEASON_OPTIONS.find((o) => o.value === filterSeason)?.label}
                  <button onClick={() => setFilterSeason('')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </span>
              )}
              {filterYear && (
                <span className="filter-chip">
                  {filterYear}
                  <button onClick={() => setFilterYear('')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </span>
              )}
            </div>
            <button className="filter-reset-btn" onClick={clearFilters}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
              Reset Semua
            </button>
          </div>
        )}
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
              <button className="filter-reset-btn" onClick={clearFilters}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
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
          {/* Curated sections */}
          {recentEps.length > 0 && <Section title="Baru Update" items={recentEps} type="anime" />}
          {topAiring.length > 0 && <Section title="Top Airing" items={topAiring} type="anime" />}
          {mostPopular.length > 0 && <Section title="Paling Populer" items={mostPopular} type="anime" />}

          {/* Genre sections */}
          {GENRE_SECTIONS.map((genre) => {
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
          })}
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
