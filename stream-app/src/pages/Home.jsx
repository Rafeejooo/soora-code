import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSubIndoHomeBundle, getSubIndoSections } from '../api';
import Card from '../components/Card';
import SkeletonHero from '../components/SkeletonHero';
import SkeletonSection from '../components/SkeletonSection';

const APP_VERSION = 'v4.1.0';
const BUILD_DATE = '2026-05-31';

const _pageCache = { ts: 0, data: null };
const PAGE_CACHE_TTL = 10 * 60 * 1000;
const _savePageCache = (data) => { _pageCache.data = data; _pageCache.ts = Date.now(); };
const _loadPageCache = () => (_pageCache.data && Date.now() - _pageCache.ts < PAGE_CACHE_TTL ? _pageCache.data : null);

/* samehadaku item → card-shaped (Card routes _subIndo → Sub Indo watch) */
const toCard = (a) => ({
  id: a.animeId || a.id,
  animeId: a.animeId || a.id,
  title: a.title,
  image: a.poster || a.image || '',
  type: a.type || 'TV',
  sub: 1,
  rating: a.score ? Math.round(parseFloat(a.score) * 10) : null,
  score: a.score,
  status: a.status,
  synopsis: a.synopsis || a.description || '',
  genres: (a.genreList || a.genres || []).map?.((g) => g.title || g) || [],
  _subIndo: true,
});

export default function Home() {
  const cached = _loadPageCache();
  const [bundle, setBundle] = useState(cached?.bundle || null);
  const [sections, setSections] = useState(cached?.sections || null);
  const [ready, setReady] = useState(!!cached);
  const [heroIdx, setHeroIdx] = useState(0);
  const [searchVal, setSearchVal] = useState('');

  const navigate = useNavigate();
  const heroInterval = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (_loadPageCache()) { setReady(true); return; }
    (async () => {
      const [b, s] = await Promise.all([
        getSubIndoHomeBundle().catch(() => null),
        getSubIndoSections().catch(() => null),
      ]);
      if (cancelled) return;
      setBundle(b); setSections(s); setReady(true);
      _savePageCache({ bundle: b, sections: s });
    })();
    return () => { cancelled = true; };
  }, []);

  const heroPool = (bundle?.popular || []).filter((a) => a.poster || a.image).slice(0, 8);
  useEffect(() => {
    if (heroPool.length < 2) return;
    heroInterval.current = setInterval(() => setHeroIdx((i) => (i + 1) % heroPool.length), 6500);
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

  const top10 = (bundle?.top10?.length ? bundle.top10 : bundle?.popular || []).slice(0, 10).map(toCard);
  const ongoing = (bundle?.ongoing || []).map(toCard);
  const recent = (bundle?.recent || []).map(toCard);

  // build the themed rows list (key,title,items)
  const themed = (sections?.sections || [])
    .map((sec) => ({ ...sec, items: (sections?.data?.[sec.key] || []).map(toCard) }))
    .filter((s) => s.items.length);

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
      ) : !ready ? <SkeletonHero /> : null}

      {/* ── Search ── */}
      <div className="home-search">
        <form onSubmit={handleSearch} className="home-search-form">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Cari anime..." value={searchVal} onChange={(e) => setSearchVal(e.target.value)} />
        </form>
      </div>

      {!ready && <><SkeletonSection /><SkeletonSection /></>}

      {/* ── SECTION 1: Top 10 — numbered rank rail ── */}
      {ready && top10.length > 0 && (
        <RankRow title="Top 10 Minggu Ini" eyebrow="Paling Ditonton" items={top10} onPick={goWatch} />
      )}

      {/* ── SECTION 2: Featured spotlight (big cards + synopsis) ── */}
      {ready && ongoing.length > 0 && (
        <FeaturedRow title="Sedang Tayang Sekarang" eyebrow="Update Tiap Minggu" items={ongoing.slice(0, 8)} onPick={goWatch} />
      )}

      {/* ── Themed rows — alternate featured/standard so it's not monotone ── */}
      {ready && themed.map((sec, i) => (
        i % 3 === 1
          ? <FeaturedRow key={sec.key} title={sec.title} items={sec.items.slice(0, 8)} onPick={goWatch} />
          : <Row key={sec.key} title={sec.title} items={sec.items} />
      ))}

      {/* ── Baru Update ── */}
      {ready && recent.length > 0 && <Row title="Baru Update" items={recent} />}

      {ready && !top10.length && !ongoing.length && !recent.length && (
        <div className="empty-state">
          <p>Gagal memuat data anime. Coba lagi sebentar.</p>
          <button onClick={() => { try { sessionStorage.removeItem('soora_cache:subindo:home-bundle'); } catch {} window.location.reload(); }} className="btn-play" style={{ marginTop: '1rem' }}>Coba Lagi</button>
        </div>
      )}

      <footer className="app-version-footer">
        <span className="version-tag">{APP_VERSION}</span>
        <span className="version-sep">•</span>
        <span className="version-label">Soora Stream</span>
      </footer>
    </div>
  );
}

/* ── Section header (hooky, no color dot) ── */
function SectionHead({ title, eyebrow }) {
  return (
    <div className="srow-head">
      {eyebrow && <span className="srow-eyebrow">{eyebrow}</span>}
      <h2 className="srow-title">{title}</h2>
    </div>
  );
}

/* ── Standard row: native scroll-snap, no arrow buttons, drag-friendly ── */
function Row({ title, eyebrow, items }) {
  return (
    <section className="srow">
      <SectionHead title={title} eyebrow={eyebrow} />
      <div className="srow-scroll">
        {items.slice(0, 24).map((item) => (
          <div className="srow-cell" key={item.id}>
            <Card item={item} type="anime" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Featured row: larger landscape cards with title + meta + synopsis (Netflix/CR style) ── */
function FeaturedRow({ title, eyebrow, items, onPick }) {
  return (
    <section className="srow srow-featured">
      <SectionHead title={title} eyebrow={eyebrow} />
      <div className="frow-scroll">
        {items.map((a) => (
          <button className="fcard" key={a.id} onClick={() => onPick(a)}>
            <div className="fcard-art">
              <img src={a.image} alt={a.title} loading="lazy" referrerPolicy="no-referrer"
                onError={(e) => { e.target.style.opacity = 0; }} />
              <div className="fcard-grad" />
              <span className="fcard-badge">🇮🇩 Sub Indo</span>
              {a.score && <span className="fcard-score">★ {a.score}</span>}
              <div className="fcard-play"><svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
            </div>
            <div className="fcard-body">
              <h3 className="fcard-title">{a.title}</h3>
              <div className="fcard-tags">
                {a.type && <span>{a.type}</span>}
                {a.status && <span>{a.status}</span>}
                {a.genres?.slice(0, 2).map((g) => <span key={g}>{g}</span>)}
              </div>
              {a.synopsis && <p className="fcard-syn">{String(a.synopsis).slice(0, 120)}…</p>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Rank row: Top 10 with big numerals ── */
function RankRow({ title, eyebrow, items, onPick }) {
  return (
    <section className="srow srow-rank">
      <SectionHead title={title} eyebrow={eyebrow} />
      <div className="rrow-scroll">
        {items.map((a, i) => (
          <button className="rcard" key={a.id} onClick={() => onPick(a)}>
            <span className="rcard-num" data-n={i + 1}>{i + 1}</span>
            <div className="rcard-art">
              <img src={a.image} alt={a.title} loading="lazy" referrerPolicy="no-referrer" />
              <div className="rcard-play"><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
