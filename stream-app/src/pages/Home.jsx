import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSubIndoHomeBundle,
  getSubIndoSections,
  getSubIndoGenre,
} from '../api';
import Card from '../components/Card';
import Top10Section from '../components/Top10Section';
import SkeletonHero from '../components/SkeletonHero';
import SkeletonSection from '../components/SkeletonSection';

const APP_VERSION = 'v4.0.0';
const BUILD_DATE = '2026-05-31';

/* page-level cache for instant back-nav */
const _pageCache = { ts: 0, data: null };
const PAGE_CACHE_TTL = 10 * 60 * 1000;
const _savePageCache = (data) => { _pageCache.data = data; _pageCache.ts = Date.now(); };
const _loadPageCache = () => (_pageCache.data && Date.now() - _pageCache.ts < PAGE_CACHE_TTL ? _pageCache.data : null);

/* Genre filter chips — samehadaku genres, friendly labels */
const GENRE_CHIPS = [
  { id: '', label: 'Semua' },
  { id: 'action', label: 'Aksi' },
  { id: 'isekai', label: 'Isekai' },
  { id: 'romance', label: 'Romansa' },
  { id: 'comedy', label: 'Komedi' },
  { id: 'fantasy', label: 'Fantasi' },
  { id: 'slice-of-life', label: 'Slice of Life' },
  { id: 'adventure', label: 'Petualangan' },
  { id: 'drama', label: 'Drama' },
  { id: 'mystery', label: 'Misteri' },
  { id: 'supernatural', label: 'Supernatural' },
  { id: 'sports', label: 'Olahraga' },
  { id: 'school', label: 'Sekolah' },
];

/* samehadaku item → card-shaped (id, title, image, _subIndo so Card routes to Sub Indo watch) */
const toCard = (a) => ({
  id: a.animeId || a.id,
  animeId: a.animeId || a.id,
  title: a.title,
  image: a.poster || a.image || '',
  type: a.type || 'TV',
  sub: 1,
  rating: a.score ? Math.round(parseFloat(a.score) * 10) : null,
  _subIndo: true,
});

export default function Home() {
  const cached = _loadPageCache();
  const [bundle, setBundle] = useState(cached?.bundle || null);     // { ongoing, popular, recent, top10 }
  const [sections, setSections] = useState(cached?.sections || null); // { sections:[{key,title}], data:{key:[items]} }
  const [ready, setReady] = useState(!!cached);
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');

  /* genre filter */
  const [filterOpen, setFilterOpen] = useState(false);
  const [genre, setGenre] = useState('');
  const [genreResults, setGenreResults] = useState(null);
  const [genreLoading, setGenreLoading] = useState(false);

  const navigate = useNavigate();
  const heroInterval = useRef(null);

  /* ── load home bundle + themed sections ── */
  useEffect(() => {
    let cancelled = false;
    if (_loadPageCache()) { setReady(true); return; }
    (async () => {
      const [b, s] = await Promise.all([
        getSubIndoHomeBundle().catch(() => null),
        getSubIndoSections().catch(() => null),
      ]);
      if (cancelled) return;
      setBundle(b);
      setSections(s);
      setReady(true);
      _savePageCache({ bundle: b, sections: s });
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── genre filter fetch ── */
  useEffect(() => {
    if (!genre) { setGenreResults(null); return; }
    let cancelled = false;
    setGenreLoading(true);
    getSubIndoGenre(genre)
      .then((items) => { if (!cancelled) setGenreResults(items); })
      .catch(() => { if (!cancelled) setGenreResults([]); })
      .finally(() => { if (!cancelled) setGenreLoading(false); });
    return () => { cancelled = true; };
  }, [genre]);

  /* ── hero rotates through popular ── */
  const heroPool = (bundle?.popular || []).filter((a) => a.poster || a.image).slice(0, 8);
  useEffect(() => {
    if (heroPool.length < 2) return;
    heroInterval.current = setInterval(() => setHeroIdx((i) => (i + 1) % heroPool.length), 6000);
    return () => clearInterval(heroInterval.current);
  }, [heroPool.length]);

  const hero = heroPool[heroIdx];

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) navigate(`/anime/search?q=${encodeURIComponent(searchVal.trim())}`);
  };

  const goWatch = (a) => navigate(
    `/watch/anime?title=${encodeURIComponent(a.title || '')}&subIndo=1&samehadakuId=${encodeURIComponent(a.animeId || a.id || '')}&ep=1`
  );

  const top10 = (bundle?.top10?.length ? bundle.top10 : bundle?.popular || []).map(toCard);
  const recentCards = (bundle?.recent || []).map(toCard);
  const ongoingCards = (bundle?.ongoing || []).map(toCard);

  return (
    <div className="home-page sooranime-home">
      {/* ── Hero ── */}
      {hero ? (
        <div className="hero-banner" key={heroIdx}>
          <div className="hero-bg">
            <img src={hero.poster || hero.image} alt="" referrerPolicy="no-referrer" />
          </div>
          <div className="hero-content">
            <div className="hero-top-row">
              <div className="hero-badge">🇮🇩 Sub Indo</div>
              {hero.type && <div className="hero-quality">{hero.type}</div>}
            </div>
            <h1 className="hero-title">{hero.title || 'Unknown'}</h1>
            {hero.synopsis && (
              <p className="hero-desc">{String(hero.synopsis).slice(0, 180)}…</p>
            )}
            <div className="hero-meta">
              {hero.score && <span className="hero-tag">★ {hero.score}</span>}
              {hero.status && <span className="hero-tag">{hero.status}</span>}
              {hero.type && <span className="hero-tag">{hero.type}</span>}
            </div>
            <div className="hero-actions">
              <button className="btn-play" onClick={() => goWatch(hero)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Tonton Sekarang
              </button>
            </div>
            {heroPool.length > 1 && (
              <div className="hero-dots">
                {heroPool.map((_, i) => (
                  <button key={i} className={`hero-dot ${i === heroIdx ? 'active' : ''}`} onClick={() => setHeroIdx(i)} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : !ready ? (
        <SkeletonHero />
      ) : null}

      {/* ── Search ── */}
      <div className="home-search">
        <form onSubmit={handleSearch} className="home-search-form">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Cari anime..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
        </form>
      </div>

      {/* ── Genre filter (simple chip rail) ── */}
      <div className="genre-filter">
        <button className={`genre-filter-toggle ${filterOpen ? 'open' : ''}`} onClick={() => setFilterOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
          Genre
          {genre && <span className="genre-filter-active-dot" />}
        </button>
        <div className="genre-chip-rail">
          {GENRE_CHIPS.map((g) => (
            <button
              key={g.id}
              className={`genre-chip ${genre === g.id ? 'active' : ''}`}
              onClick={() => setGenre(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Genre results (when a genre is picked) ── */}
      {genre ? (
        <div className="genre-results">
          <h2 className="section-title">{GENRE_CHIPS.find((g) => g.id === genre)?.label}</h2>
          {genreLoading ? (
            <SkeletonSection />
          ) : (genreResults?.length ? (
            <div className="genre-grid">
              {genreResults.map((a) => <Card key={a.animeId || a.id} item={toCard(a)} type="anime" />)}
            </div>
          ) : (
            <div className="filter-empty">
              <p>Tidak ada anime untuk genre ini.</p>
              <button className="genre-chip" onClick={() => setGenre('')}>Kembali</button>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ── SECTION 1: Top 10 ── */}
          {ready && top10.length > 0 && (
            <Top10Section title="Top 10 Anime Saat Ini" items={top10} type="anime" />
          )}

          {/* ── SECTION 2: Mungkin Kamu Suka (ongoing mix) ── */}
          {ready ? (
            ongoingCards.length > 0 && <Section title="Sedang Tayang Sekarang" items={ongoingCards} accent="#a78bfa" />
          ) : <SkeletonSection />}

          {/* ── Themed curated sections ── */}
          {ready && sections?.sections?.length ? (
            sections.sections.map((sec, i) => {
              const items = (sections.data?.[sec.key] || []).map(toCard);
              if (!items.length) return null;
              const accents = ['#ef4444', '#38bdf8', '#34d399', '#fbbf24', '#ec4899', '#818cf8', '#f97316'];
              return <Section key={sec.key} title={sec.title} items={items} accent={accents[i % accents.length]} />;
            })
          ) : (!ready ? (<><SkeletonSection /><SkeletonSection /></>) : null)}

          {/* ── Baru Update ── */}
          {ready && recentCards.length > 0 && (
            <Section title="Baru Update" items={recentCards} accent="#22d3ee" />
          )}

          {ready && !top10.length && !ongoingCards.length && !recentCards.length && (
            <div className="empty-state">
              <p>Gagal memuat data anime. Coba lagi sebentar.</p>
              <button onClick={() => { try { sessionStorage.removeItem('soora_cache:subindo:home-bundle'); } catch {} window.location.reload(); }} className="genre-chip" style={{ marginTop: '1rem' }}>
                Coba Lagi
              </button>
            </div>
          )}
        </>
      )}

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

/* ── horizontal scroll section using the shared Card ── */
function Section({ title, items, accent }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [check, items]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const cardW = scrollRef.current.querySelector('.card')?.offsetWidth || 180;
    scrollRef.current.scrollBy({ left: dir * cardW * 3, behavior: 'smooth' });
  };

  return (
    <section className="home-section">
      <div className="section-header">
        <h2 className="section-title">
          {accent && <span className="section-dot" style={{ background: accent }} />}
          {title}
        </h2>
        <div className="section-nav">
          <button onClick={() => scroll(-1)} className={`scroll-btn ${!canLeft ? 'disabled' : ''}`} disabled={!canLeft} aria-label="Scroll left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button onClick={() => scroll(1)} className={`scroll-btn ${!canRight ? 'disabled' : ''}`} disabled={!canRight} aria-label="Scroll right">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div className="card-row-wrapper">
        {canLeft && <div className="row-fade row-fade-left" />}
        {canRight && <div className="row-fade row-fade-right" />}
        <div className="card-row" ref={scrollRef}>
          {items.slice(0, 24).map((item) => (
            <Card key={item.id} item={item} type="anime" />
          ))}
        </div>
      </div>
    </section>
  );
}
