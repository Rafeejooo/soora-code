import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getGokuTrendingMovies,
  getGokuTrendingTV,
  getGokuRecentMovies,
  getGokuRecentTV,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';

export default function MovieHome() {
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingTV, setTrendingTV] = useState([]);
  const [recentMovies, setRecentMovies] = useState([]);
  const [recentTV, setRecentTV] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');
  const navigate = useNavigate();
  const heroInterval = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        getGokuTrendingMovies(),
        getGokuRecentMovies(),
        getGokuTrendingTV(),
        getGokuRecentTV(),
      ]);

      if (results[0].status === 'fulfilled') setTrendingMovies(results[0].value.data || []);
      if (results[1].status === 'fulfilled') setRecentMovies(results[1].value.data || []);
      if (results[2].status === 'fulfilled') setTrendingTV(results[2].value.data || []);
      if (results[3].status === 'fulfilled') setRecentTV(results[3].value.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Auto-rotate hero
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

  if (loading) return <Loading text="Loading..." theme="sooraflix" />;

  const hero = trendingMovies[heroIdx];

  // Enlarge Goku thumbnail for hero banner (250x400 → 1200x800)
  const gokuHeroImg = (url) => url ? url.replace(/\/resize\/\d+x\d+\//, '/resize/1200x800/') : url;

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

      {/* Trending Movies */}
      {trendingMovies.length > 0 && (
        <Section title="🔥 Trending Movies" items={trendingMovies} type="movie" />
      )}

      {/* Recent Movies */}
      {recentMovies.length > 0 && (
        <Section title="🎬 Recent Movies" items={recentMovies} type="movie" />
      )}

      {/* Trending TV */}
      {trendingTV.length > 0 && (
        <Section title="📺 Trending TV Shows" items={trendingTV} type="movie" />
      )}

      {/* Recent TV */}
      {recentTV.length > 0 && (
        <Section title="🆕 Recent TV Shows" items={recentTV} type="movie" />
      )}

      {!trendingMovies.length && !recentMovies.length && (
        <div className="empty-state">
          <p>No movie data available. Make sure the API server is running.</p>
        </div>
      )}
    </div>
  );
}

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
