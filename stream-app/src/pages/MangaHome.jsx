import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  searchManga,
  getPopularManga,
  normalizeMangaTitle,
  mangaImgProxy,
  isMangaNovel,
  getMangaContentType,
  searchMangaDex,
  searchKomiku,
  getKomikuTrending,
  MANGA_LANGUAGES,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';

const POPULAR_QUERIES = [
  { label: 'Trending', queries: ['solo leveling', 'one piece', 'jujutsu kaisen'] },
  { label: 'Action', queries: ['demon slayer', 'attack on titan', 'chainsaw man'] },
  { label: 'Romance', queries: ['horimiya', 'kaguya sama', 'my dress up darling'] },
  { label: 'Fantasy', queries: ['mushoku tensei', 'shield hero', 'overlord'] },
];

export default function MangaHome() {
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const [heroItems, setHeroItems] = useState([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [selectedLang, setSelectedLang] = useState(() => {
    return localStorage.getItem('soora_manga_lang') || 'en';
  });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const heroInterval = useRef(null);
  const navigate = useNavigate();

  // Persist language choice
  useEffect(() => {
    localStorage.setItem('soora_manga_lang', selectedLang);
  }, [selectedLang]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const allResults = {};
      const heroList = [];
      const seen = new Set();
      const useKomiku = selectedLang === 'id';
      const useMangaDex = !useKomiku && selectedLang !== 'en';

      const fetchSection = async (label, queries) => {
        let searchFn;
        let providerTag;
        if (useKomiku) {
          searchFn = searchKomiku;
          providerTag = 'komiku';
        } else if (useMangaDex) {
          searchFn = searchMangaDex;
          providerTag = 'mangadex';
        } else {
          searchFn = searchManga;
          providerTag = null;
        }

        const results = await Promise.allSettled(
          queries.map((q) => searchFn(q))
        );
        const items = [];
        results.forEach((r) => {
          if (r.status === 'fulfilled') {
            (r.value.data?.results || []).forEach((item) => {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                // Inject provider so Card navigates correctly
                items.push(providerTag ? { ...item, provider: providerTag } : item);
              }
            });
          }
        });
        return items;
      };

      for (const sec of POPULAR_QUERIES) {
        const items = await fetchSection(sec.label, sec.queries);
        allResults[sec.label] = items;
        if (sec.label === 'Trending' && items.length > 0) {
          // Only show actual manga/manhwa in hero, not novels
          heroList.push(...items.filter((i) => !isMangaNovel(i)).slice(0, 6));
        }
      }

      setSections(allResults);
      setHeroItems(heroList);
      setLoading(false);
    };
    fetchData();
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

  if (loading) return <Loading text="Loading manga..." theme="sooramics" />;

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

      {/* Language Selector */}
      <div className="manga-lang-section">
        <div className="manga-lang-bar">
          <span className="manga-lang-label">Language</span>
          <button
            className="manga-lang-current"
            onClick={() => setShowLangPicker(!showLangPicker)}
          >
            {MANGA_LANGUAGES.find((l) => l.code === selectedLang)?.flag || '🌐'}{' '}
            {MANGA_LANGUAGES.find((l) => l.code === selectedLang)?.label || selectedLang}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d={showLangPicker ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
            </svg>
          </button>
        </div>
        {showLangPicker && (
          <div className="manga-lang-grid">
            {MANGA_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                className={`manga-lang-item ${selectedLang === lang.code ? 'active' : ''}`}
                onClick={() => { setSelectedLang(lang.code); setShowLangPicker(false); }}
              >
                <span className="manga-lang-flag">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        )}
        {selectedLang !== 'en' && (
          <p className="manga-lang-note">
            📖 Manga info pages will show chapters in {MANGA_LANGUAGES.find((l) => l.code === selectedLang)?.label || selectedLang} using {selectedLang === 'id' ? 'Komiku' : 'MangaDex'}
          </p>
        )}
      </div>

      {/* Sections */}
      {POPULAR_QUERIES.map((sec) => (
        sections[sec.label]?.length > 0 && (
          <Section key={sec.label} title={sec.label} items={sections[sec.label]} type="manga" />
        )
      ))}

      {Object.values(sections).every((s) => !s?.length) && (
        <div className="empty-state">
          <p>No manga available. Make sure the Consumet API is running on <code>localhost:3000</code></p>
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
