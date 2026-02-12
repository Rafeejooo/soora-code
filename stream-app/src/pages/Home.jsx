import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAnimeSpotlight,
  getAnimeRecentEpisodes,
  getAnimeNewReleases,
  getAnimeLatestCompleted,
  getAnimeMostPopular,
  getAnimeTopAiring,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';

export default function Home() {
  const [spotlight, setSpotlight] = useState([]);
  const [recentEps, setRecentEps] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [mostPopular, setMostPopular] = useState([]);
  const [topAiring, setTopAiring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');
  const navigate = useNavigate();
  const heroInterval = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        getAnimeSpotlight(),
        getAnimeRecentEpisodes(1),
        getAnimeNewReleases(1),
        getAnimeLatestCompleted(1),
        getAnimeMostPopular(1),
        getAnimeTopAiring(1),
      ]);

      if (results[0].status === 'fulfilled') setSpotlight(results[0].value.data.results || results[0].value.data || []);
      if (results[1].status === 'fulfilled') setRecentEps(results[1].value.data.results || results[1].value.data || []);
      if (results[2].status === 'fulfilled') setNewReleases(results[2].value.data.results || results[2].value.data || []);
      if (results[3].status === 'fulfilled') setCompleted(results[3].value.data.results || results[3].value.data || []);
      if (results[4].status === 'fulfilled') setMostPopular(results[4].value.data.results || results[4].value.data || []);
      if (results[5].status === 'fulfilled') setTopAiring(results[5].value.data.results || results[5].value.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Auto-rotate hero
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

  if (loading) return <Loading text="Loading..." />;

  const hero = spotlight[heroIdx];

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

      {/* Recent Episodes */}
      {recentEps.length > 0 && (
        <Section title="Recently Updated" items={recentEps} type="anime" />
      )}

      {/* Most Popular */}
      {mostPopular.length > 0 && (
        <Section title="Most Popular" items={mostPopular} type="anime" />
      )}

      {/* Top Airing */}
      {topAiring.length > 0 && (
        <Section title="Top Airing" items={topAiring} type="anime" />
      )}

      {/* New Releases */}
      {newReleases.length > 0 && (
        <Section title="New Releases" items={newReleases} type="anime" />
      )}

      {/* Latest Completed */}
      {completed.length > 0 && (
        <Section title="Latest Completed" items={completed} type="anime" />
      )}

      {!spotlight.length && !recentEps.length && (
        <div className="empty-state">
          <p>No data available. Make sure the Consumet API is running on <code>localhost:3000</code></p>
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
