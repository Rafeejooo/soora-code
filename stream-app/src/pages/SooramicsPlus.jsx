import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getHomePage, searchBooks, getBookDetail, getTaggedBooks, getRelatedBooks,
  getBookCover, getBookThumb, getPageUrl, getPageThumbUrl, komikImgProxy,
} from '../komikplusApi';
import {
  getDoujindesuLatest, searchDoujindesu, getDoujindesuDetail,
  getDoujindesuChapterPages, doujindesuImgProxy,
  getDoujindesuGenres, getDoujindesuByGenre,
} from '../api';
import { addToMyList, removeFromMyList, isInMyList, getMyList } from '../utils/mylist';
import Loading from '../components/Loading';
import SkeletonHero from '../components/SkeletonHero';
import SkeletonSection from '../components/SkeletonSection';
import CustomSelect from '../components/CustomSelect';
import Landing from './Landing';

/* ════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════ */

/** Home page horizontal-scroll sections (fetched via tag API) */
const HOME_SECTIONS = [
  { key: 'popular_en', label: 'Popular (English)', tagId: '12227', sort: 'popular', color: '#f43f5e' },
  { key: 'popular_jp', label: 'Popular (Japanese)', tagId: '6346', sort: 'popular', color: '#a78bfa' },
  { key: 'manga', label: 'Manga', tagId: '33172', sort: 'popular', color: '#38bdf8' },
  { key: 'doujinshi', label: 'Doujinshi', tagId: '33173', sort: 'popular', color: '#fbbf24' },
  { key: 'popular_cn', label: 'Chinese', tagId: '29963', sort: 'popular', color: '#34d399' },
];

/** Language filter options (used with nhentai search syntax: language:xxx) */
const LANG_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'english', label: '🌐 English' },
  { value: 'japanese', label: '🇯🇵 Japanese' },
  { value: 'chinese', label: '🇨🇳 Chinese' },
];

/** Type filter options (used with nhentai search syntax: category:xxx) */
const TYPE_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'manga', label: 'Manga' },
  { value: 'doujinshi', label: 'Doujinshi' },
];

/** All available tags for multi-select filtering (nhentai tag names) */
const ALL_TAGS = [
  'big breasts', 'sole female', 'sole male', 'group', 'anal', 'full color',
  'stockings', 'schoolgirl uniform', 'glasses', 'ahegao', 'nakadashi', 'blowjob',
  'paizuri', 'defloration', 'x-ray', 'femdom', 'maid', 'swimsuit', 'milf',
  'yuri', 'futanari', 'tentacles', 'bondage', 'incest', 'netorare',
  'monster girl', 'elf', 'mind break', 'dark skin', 'threesome', 'double penetration',
  'uncensored', 'mosaic censorship', 'collar', 'lingerie', 'nurse', 'pregnant',
  'cosplaying', 'tomboy', 'tsundere', 'childhood friend', 'harem', 'foot fetish',
  'sister', 'mother', 'teacher', 'demon girl', 'witch', 'bunny girl', 'vampire',
  'succubus', 'kemonomimi', 'catgirl', 'fox girl', 'wolf girl', 'schoolboy uniform',
  'garter belt', 'twintails', 'ponytail', 'bob cut', 'long hair', 'short hair',
  'big ass', 'small breasts', 'oppai loli', 'hairy', 'dildo', 'sex toys',
  'masturbation', 'fingering', 'handjob', 'boobjob', 'footjob', 'cunnilingus',
  'deepthroat', 'facial', 'creampie', 'bukkake', 'gangbang', 'orgy',
  'public', 'cheating', 'blackmail', 'drugs', 'drunk', 'sleeping', 'hypnosis',
  'time stop', 'transformation', 'gender bender', 'crossdressing', 'trap',
  'furry', 'monster', 'alien', 'robot', 'anthology', 'full censorship',
  'multi-work series', 'story arc', 'artbook', 'webtoon', 'tankoubon',
  'males only', 'females only', 'ffm threesome', 'mmf threesome', 'old man', 'dilf',
];

const SORT_OPTIONS = [
  { value: '', label: 'Recent' },
  { value: 'popular', label: 'Popular' },
  { value: 'popular-today', label: 'Popular Today' },
  { value: 'popular-week', label: 'Popular Week' },
];

/** Doujindesu genre list (hardcoded fallback + dynamic fetch) */
const DJ_GENRES = [
  { name: 'Action', slug: 'action' },
  { name: 'Adult', slug: 'adult' },
  { name: 'Adventure', slug: 'adventure' },
  { name: 'Big Oppai', slug: 'big-oppai' },
  { name: 'Comedy', slug: 'comedy' },
  { name: 'Drama', slug: 'drama' },
  { name: 'Ecchi', slug: 'ecchi' },
  { name: 'Fantasy', slug: 'fantasy' },
  { name: 'Gender Bender', slug: 'gender-bender' },
  { name: 'Harem', slug: 'harem' },
  { name: 'Horror', slug: 'horror' },
  { name: 'Lolicon', slug: 'lolicon' },
  { name: 'Martial Arts', slug: 'martial-arts' },
  { name: 'Mature', slug: 'mature' },
  { name: 'Mecha', slug: 'mecha' },
  { name: 'Mystery', slug: 'mystery' },
  { name: 'NTR', slug: 'ntr' },
  { name: 'Parody', slug: 'parody' },
  { name: 'Psychological', slug: 'psychological' },
  { name: 'Romance', slug: 'romance' },
  { name: 'School Life', slug: 'school-life' },
  { name: 'Sci-Fi', slug: 'sci-fi' },
  { name: 'Seinen', slug: 'seinen' },
  { name: 'Shotacon', slug: 'shotacon' },
  { name: 'Shoujo', slug: 'shoujo' },
  { name: 'Shounen', slug: 'shounen' },
  { name: 'Slice of Life', slug: 'slice-of-life' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Supernatural', slug: 'supernatural' },
  { name: 'Tentacle', slug: 'tentacle' },
  { name: 'Tragedy', slug: 'tragedy' },
  { name: 'Vanilla', slug: 'vanilla' },
  { name: 'Yuri', slug: 'yuri' },
];

const MYLIST_SORT = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'title', label: 'Title A-Z' },
];

/** Build nhentai search query from filter selections */
const buildFilterQuery = (lang, type, genres) => {
  const parts = [];
  if (lang) parts.push(`language:${lang}`);
  if (type) parts.push(`category:${type}`);
  genres.forEach((g) => parts.push(`tag:"${g}"`));
  return parts.join(' ');
};

const SPEED_VALUES = [0, 0.8, 2, 4.5];
const SPEED_LABELS = ['Off', 'Lambat', 'Sedang', 'Cepat'];

/* ── Image CDN fallback: cycle hosts → proxy → give up ── */
const CDN_NUMBERS = ['5', '3', '2', '1', ''];
const handleImgFallback = (e) => {
  const attempt = parseInt(e.target.dataset.attempt || '0', 10);
  if (!e.target.dataset.originalSrc) e.target.dataset.originalSrc = e.target.src;
  const original = e.target.dataset.originalSrc;
  if (attempt < CDN_NUMBERS.length) {
    e.target.dataset.attempt = String(attempt + 1);
    const num = CDN_NUMBERS[attempt];
    e.target.src = original.replace(/\/\/(i|t)\d*\.nhentai\.net/, `//$1${num}.nhentai.net`);
  } else if (attempt === CDN_NUMBERS.length) {
    e.target.dataset.attempt = String(attempt + 1);
    e.target.src = komikImgProxy(original);
  } else {
    e.target.style.opacity = '0.15';
  }
};

/* ════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════ */

/** Horizontal-scroll section (matches Home/MangaHome pattern) */
function HScrollSection({ title, items, color, onItemClick }) {
  const scrollRef = useRef(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 10);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
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
    const w = scrollRef.current.querySelector('.kp-card')?.offsetWidth || 155;
    scrollRef.current.scrollBy({ left: dir * w * 3, behavior: 'smooth' });
  };

  if (!items?.length) return null;

  return (
    <section className="home-section">
      <div className="section-header">
        <h2 className="section-title">
          {color && <span className="section-dot" style={{ background: color }} />}
          {title}
        </h2>
        <div className="section-nav">
          <button onClick={() => scroll(-1)} className={`scroll-btn ${!canL ? 'disabled' : ''}`} disabled={!canL}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button onClick={() => scroll(1)} className={`scroll-btn ${!canR ? 'disabled' : ''}`} disabled={!canR}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>
      <div className="card-row-wrapper">
        {canL && <div className="row-fade row-fade-left" />}
        {canR && <div className="row-fade row-fade-right" />}
        <div className="card-row" ref={scrollRef}>
          {items.slice(0, 25).map((book) => (
            <div key={book.id} className="kp-card kp-card-row-item" onClick={() => onItemClick(book.id)}>
              <div className="kp-card-img-wrap">
                <img
                  src={getBookThumb(book)}
                  alt={book.title?.pretty || ''}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (!e.target.dataset.retried) { e.target.dataset.retried = '1'; e.target.src = getBookCover(book); }
                    else handleImgFallback(e);
                  }}
                />
              </div>
              <div className="kp-card-body">
                <div className="kp-card-title">{book.title?.pretty || book.title?.english || `#${book.id}`}</div>
                <div className="kp-card-meta">{book.num_pages}p • ❤️ {book.num_favorites || 0}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════ */
export default function SooramicsPlus() {
  // ── View management ──
  const [view, setView] = useState('landing');   // landing | home | browse | mylist | detail | reader
  const [prevView, setPrevView] = useState('home');

  // ── Home sections ──
  const [homeRecent, setHomeRecent] = useState([]);
  const [homeSections, setHomeSections] = useState({});
  const [homeLoading, setHomeLoading] = useState(true);
  const [heroItems, setHeroItems] = useState([]);
  const [heroIdx, setHeroIdx] = useState(0);
  const heroInterval = useRef(null);

  // ── Home filters ──
  const [homeFilterOpen, setHomeFilterOpen] = useState(false);
  const [homeFilterLang, setHomeFilterLang] = useState('');
  const [homeFilterType, setHomeFilterType] = useState('');
  const [homeFilterGenres, setHomeFilterGenres] = useState([]);
  const [homeFilterSort, setHomeFilterSort] = useState('');
  const [homeTagSearch, setHomeTagSearch] = useState('');
  const [homeFilteredResults, setHomeFilteredResults] = useState(null);
  const [homeFilterLoading, setHomeFilterLoading] = useState(false);

  // ── Browse ──
  const [browseBooks, setBrowseBooks] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [searchVal, setSearchVal] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [browseLang, setBrowseLang] = useState('');
  const [browseType, setBrowseType] = useState('');
  const [browseGenres, setBrowseGenres] = useState([]);
  const [browseTagSearch, setBrowseTagSearch] = useState('');
  const [filterSort, setFilterSort] = useState('');

  // ── My List ──
  const [myListItems, setMyListItems] = useState([]);
  const [myListSearch, setMyListSearch] = useState('');
  const [myListSort, setMyListSort] = useState('recent');
  const [removing, setRemoving] = useState(null);

  // ── Detail ──
  const [detailBook, setDetailBook] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [relatedBooks, setRelatedBooks] = useState([]);

  // ── Reader ──
  const [readMode, setReadMode] = useState('vertical');
  const [readerPage, setReaderPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [scrollSpeed, setScrollSpeed] = useState(0);
  const [imgErrors, setImgErrors] = useState({});
  const readerRef = useRef(null);
  const pageRefs = useRef([]);
  const autoScrollRef = useRef(null);
  const scrollSpeedRef = useRef(0);

  const isFilterActive = browseLang || browseType || browseGenres.length > 0;
  const isHomeFilterActive = homeFilterLang || homeFilterType || homeFilterGenres.length > 0;

  // ── Content mode toggle: nhentai (original) vs doujindesu ──
  const [contentMode, setContentMode] = useState('nhentai'); // 'nhentai' | 'doujindesu'

  // ── Doujindesu: Home / Latest ──
  const [djLatest, setDjLatest] = useState([]);
  const [djLatestLoading, setDjLatestLoading] = useState(false);
  const [djLatestPage, setDjLatestPage] = useState(1);
  const [djLatestHasNext, setDjLatestHasNext] = useState(false);

  // ── Doujindesu: Browse / Search ──
  const [djBrowseItems, setDjBrowseItems] = useState([]);
  const [djBrowseLoading, setDjBrowseLoading] = useState(false);
  const [djBrowsePage, setDjBrowsePage] = useState(1);
  const [djBrowseHasNext, setDjBrowseHasNext] = useState(false);
  const [djSearchVal, setDjSearchVal] = useState('');
  const [djSearchMode, setDjSearchMode] = useState(false);
  const [djSearchQuery, setDjSearchQuery] = useState('');

  // ── Doujindesu: Detail ──
  const [djDetail, setDjDetail] = useState(null);
  const [djDetailLoading, setDjDetailLoading] = useState(false);

  // ── Doujindesu: Reader (chapter-based) ──
  const [djChapterPages, setDjChapterPages] = useState([]);
  const [djChapterLoading, setDjChapterLoading] = useState(false);
  const [djCurrentChapter, setDjCurrentChapter] = useState(null); // { id, title, idx }

  // ── Doujindesu: Genre Filter ──
  const [djGenres, setDjGenres] = useState(DJ_GENRES);
  const [djFilterOpen, setDjFilterOpen] = useState(false);
  const [djFilterGenre, setDjFilterGenre] = useState(''); // genre slug
  const [djGenreSearch, setDjGenreSearch] = useState('');
  const [djGenreResults, setDjGenreResults] = useState([]);
  const [djGenreLoading, setDjGenreLoading] = useState(false);
  const [djGenrePage, setDjGenrePage] = useState(1);
  const [djGenreHasNext, setDjGenreHasNext] = useState(false);
  // Home genre filter
  const [djHomeFilterOpen, setDjHomeFilterOpen] = useState(false);
  const [djHomeFilterGenre, setDjHomeFilterGenre] = useState('');
  const [djHomeGenreSearch, setDjHomeGenreSearch] = useState('');
  const [djHomeGenreResults, setDjHomeGenreResults] = useState(null);
  const [djHomeGenreLoading, setDjHomeGenreLoading] = useState(false);

  const isDjFilterActive = !!djFilterGenre;
  const isDjHomeFilterActive = !!djHomeFilterGenre;

  /* ── helper: navigate to view ── */
  const goView = useCallback((next) => {
    setView((cur) => { setPrevView(cur); return next; });
    window.scrollTo(0, 0);
  }, []);

  /* ═══════════════════════════════════
     HOME: Fetch category sections
     ═══════════════════════════════════ */
  useEffect(() => {
    if (view !== 'home' || homeRecent.length > 0) return;
    const fetchHome = async () => {
      setHomeLoading(true);
      try {
        const [recentRes, ...secRes] = await Promise.allSettled([
          getHomePage(1),
          ...HOME_SECTIONS.map((s) => getTaggedBooks(s.tagId, 1, s.sort)),
        ]);
        if (recentRes.status === 'fulfilled') {
          const recent = recentRes.value.result || [];
          setHomeRecent(recent);
          setHeroItems(recent.slice(0, 6));
        }
        const sd = {};
        HOME_SECTIONS.forEach((sec, i) => {
          if (secRes[i].status === 'fulfilled') sd[sec.key] = secRes[i].value.result || [];
        });
        setHomeSections(sd);
      } catch (e) { console.error('Home load:', e); }
      finally { setHomeLoading(false); }
    };
    fetchHome();
  }, [view, homeRecent.length]);

  // Hero auto-rotate
  useEffect(() => {
    if (heroItems.length < 2) return;
    heroInterval.current = setInterval(() => setHeroIdx((i) => (i + 1) % Math.min(heroItems.length, 6)), 6000);
    return () => clearInterval(heroInterval.current);
  }, [heroItems]);

  /* ═══════════════════════════════════
     HOME: Filter effect
     ═══════════════════════════════════ */
  useEffect(() => {
    if (!isHomeFilterActive) {
      setHomeFilteredResults(null);
      return;
    }
    const fetchFiltered = async () => {
      setHomeFilterLoading(true);
      try {
        const query = buildFilterQuery(homeFilterLang, homeFilterType, homeFilterGenres);
        const sort = homeFilterSort || '';
        const data = await searchBooks(query, 1, sort);
        setHomeFilteredResults(data.result || []);
      } catch {
        setHomeFilteredResults([]);
      }
      setHomeFilterLoading(false);
    };
    const debounce = setTimeout(fetchFiltered, 300);
    return () => clearTimeout(debounce);
  }, [homeFilterLang, homeFilterType, homeFilterGenres, homeFilterSort, isHomeFilterActive]);

  /* ═══════════════════════════════════
     BROWSE: Load data
     ═══════════════════════════════════ */
  const loadBrowse = useCallback(async (page = 1, query = '', filterQuery = '', sort = '') => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      let data;
      const finalQuery = query || filterQuery;
      if (finalQuery) data = await searchBooks(finalQuery, page, sort);
      else data = await getHomePage(page);
      setBrowseBooks(data.result || []);
      setBrowseTotalPages(Math.min(data.num_pages || 1, 100));
      setBrowsePage(page);
    } catch (e) { setBrowseError(e.message); }
    finally { setBrowseLoading(false); }
  }, []);

  useEffect(() => {
    if (view !== 'browse' || searchMode) return;
    const filterQuery = buildFilterQuery(browseLang, browseType, browseGenres);
    loadBrowse(1, '', filterQuery, filterSort);
  }, [view, browseLang, browseType, browseGenres, filterSort, searchMode, loadBrowse]);

  /* ═══════════════════════════════════
     MY LIST: Sync from localStorage
     ═══════════════════════════════════ */
  const loadMyList = useCallback(() => {
    setMyListItems(getMyList().filter((i) => i.listType === 'komikplus' || i.listType === 'doujindesu'));
  }, []);

  // Load my list on mount (for badge count) + when viewing
  useEffect(() => { loadMyList(); }, [loadMyList]);
  useEffect(() => {
    const handler = () => loadMyList();
    window.addEventListener('mylist-changed', handler);
    return () => window.removeEventListener('mylist-changed', handler);
  }, [loadMyList]);

  /* ═══════════════════════════════════
     READER: Intersection, auto-scroll, keyboard
     ═══════════════════════════════════ */
  useEffect(() => {
    if (view !== 'reader' || readMode !== 'vertical') return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { const idx = parseInt(e.target.dataset.page, 10); if (!isNaN(idx)) setReaderPage(idx); } }),
      { threshold: 0.5 },
    );
    pageRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [view, readMode, detailBook]);

  useEffect(() => { scrollSpeedRef.current = scrollSpeed; }, [scrollSpeed]);

  useEffect(() => {
    if (view !== 'reader' || readMode !== 'vertical' || scrollSpeed === 0) {
      if (autoScrollRef.current) { cancelAnimationFrame(autoScrollRef.current); autoScrollRef.current = null; }
      return;
    }
    const step = () => {
      if (scrollSpeedRef.current === 0) { autoScrollRef.current = null; return; }
      window.scrollBy(0, SPEED_VALUES[scrollSpeedRef.current]);
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
    return () => { if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current); };
  }, [scrollSpeed, readMode, view]);

  useEffect(() => {
    if (view !== 'reader' || readMode !== 'page') return;
    const h = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const totalReaderPages = detailBook?.images?.pages?.length || 0;
  const goNext = () => { if (readerPage < totalReaderPages - 1) setReaderPage((p) => p + 1); };
  const goPrev = () => { if (readerPage > 0) setReaderPage((p) => p - 1); };

  const handleReaderTap = (e) => {
    if (e.target.closest('.mangareader-topbar') || e.target.closest('.mangareader-bottombar')) return;
    if (readMode === 'page') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const third = rect.width / 3;
      if (x < third) goPrev(); else if (x > third * 2) goNext(); else setShowControls((v) => !v);
      return;
    }
    setShowControls((v) => !v);
  };

  const handleReaderImgError = (e, idx) => {
    const attempt = parseInt(e.target.dataset.attempt || '0', 10);
    if (!e.target.dataset.originalSrc) e.target.dataset.originalSrc = e.target.src;
    const original = e.target.dataset.originalSrc;
    if (attempt < CDN_NUMBERS.length) {
      e.target.dataset.attempt = String(attempt + 1);
      e.target.src = original.replace(/\/\/(i|t)\d*\.nhentai\.net/, `//$1${CDN_NUMBERS[attempt]}.nhentai.net`);
    } else if (attempt === CDN_NUMBERS.length) {
      e.target.dataset.attempt = String(attempt + 1);
      e.target.src = komikImgProxy(original);
    } else {
      setImgErrors((prev) => ({ ...prev, [idx]: true }));
    }
  };

  /* ═══════════════════════════════════
     HANDLERS
     ═══════════════════════════════════ */
  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchVal.trim();
    if (!q) { clearSearch(); return; }
    setSearchMode(true);
    setSearchQuery(q);
    if (view !== 'browse') goView('browse');
    loadBrowse(1, q);
  };
  const clearSearch = () => { setSearchMode(false); setSearchVal(''); setSearchQuery(''); const fq = buildFilterQuery(browseLang, browseType, browseGenres); loadBrowse(1, '', fq, filterSort); };
  const clearFilters = () => { setBrowseLang(''); setBrowseType(''); setBrowseGenres([]); setBrowseTagSearch(''); setFilterSort(''); };
  const clearHomeFilters = () => { setHomeFilterLang(''); setHomeFilterType(''); setHomeFilterGenres([]); setHomeFilterSort(''); setHomeTagSearch(''); };
  const goPage = (p) => { window.scrollTo({ top: 0, behavior: 'smooth' }); if (searchMode) loadBrowse(p, searchQuery); else { const fq = buildFilterQuery(browseLang, browseType, browseGenres); loadBrowse(p, '', fq, filterSort); } };

  const openDetail = async (bookId) => {
    setDetailLoading(true);
    setDetailBook(null);
    setRelatedBooks([]);
    goView('detail');
    try {
      const [d, r] = await Promise.allSettled([getBookDetail(bookId), getRelatedBooks(bookId)]);
      if (d.status === 'fulfilled') setDetailBook(d.value);
      if (r.status === 'fulfilled') setRelatedBooks(r.value?.result || []);
    } catch (e) { setBrowseError(e.message); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => {
    setDetailBook(null); setRelatedBooks([]); setImgErrors({});
    setView(prevView === 'detail' || prevView === 'reader' ? 'home' : prevView);
  };

  const openReader = (startPage = 0) => {
    setReaderPage(startPage); goView('reader');
    setShowControls(true); setScrollSpeed(0); setImgErrors({});
  };

  const closeReader = () => {
    setView('detail'); setScrollSpeed(0); setImgErrors({});
  };

  const toggleMyListItem = () => {
    if (!detailBook) return;
    const id = String(detailBook.id);
    if (isInMyList(id, 'komikplus')) {
      removeFromMyList(id, 'komikplus');
    } else {
      addToMyList({
        id, title: detailBook.title?.pretty || detailBook.title?.english || `#${detailBook.id}`,
        image: getBookCover(detailBook), type: 'doujin', listType: 'komikplus',
        rating: null, releaseDate: detailBook.upload_date ? new Date(detailBook.upload_date * 1000).getFullYear().toString() : '',
      });
    }
    loadMyList();
  };

  const handleMyListRemove = (e, item) => {
    e.stopPropagation();
    const lt = item.listType || 'komikplus';
    setRemoving(`kp-${item.id}`);
    setTimeout(() => { removeFromMyList(item.id, lt); setRemoving(null); }, 300);
  };

  // MyList display items (filtered + sorted)
  const myListDisplay = (() => {
    let list = [...myListItems];
    if (myListSearch.trim()) {
      const q = myListSearch.toLowerCase();
      list = list.filter((i) => (typeof i.title === 'string' ? i.title : '').toLowerCase().includes(q));
    }
    if (myListSort === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return list;
  })();

  /* ═══════════════════════════════════
     DOUJINDESU: Fetch Latest (Home)
     ═══════════════════════════════════ */
  const loadDjLatest = useCallback(async (page = 1) => {
    setDjLatestLoading(true);
    try {
      const res = await getDoujindesuLatest(page);
      const data = res?.data || res;
      setDjLatest(data.results || []);
      setDjLatestHasNext(!!data.hasNextPage);
      setDjLatestPage(page);
    } catch (e) { console.error('DJ latest:', e); }
    finally { setDjLatestLoading(false); }
  }, []);

  useEffect(() => {
    if (contentMode !== 'doujindesu' || view !== 'home' || djLatest.length > 0) return;
    loadDjLatest(1);
  }, [contentMode, view, djLatest.length, loadDjLatest]);

  /* ═══════════════════════════════════
     DOUJINDESU: Browse / Search
     ═══════════════════════════════════ */
  const loadDjBrowse = useCallback(async (page = 1, query = '') => {
    setDjBrowseLoading(true);
    try {
      const res = query
        ? await searchDoujindesu(query, page)
        : await getDoujindesuLatest(page);
      const data = res?.data || res;
      setDjBrowseItems(data.results || []);
      setDjBrowseHasNext(!!data.hasNextPage);
      setDjBrowsePage(page);
    } catch (e) { console.error('DJ browse:', e); }
    finally { setDjBrowseLoading(false); }
  }, []);

  useEffect(() => {
    if (contentMode !== 'doujindesu' || view !== 'browse' || djSearchMode) return;
    if (djFilterGenre) return; // genre filter handles its own loading
    loadDjBrowse(1);
  }, [contentMode, view, djSearchMode, loadDjBrowse, djFilterGenre]);

  /* ═══════════════════════════════════
     DOUJINDESU: Fetch genres (once)
     ═══════════════════════════════════ */
  useEffect(() => {
    if (contentMode !== 'doujindesu') return;
    getDoujindesuGenres().then((res) => {
      const data = res?.data || res;
      if (Array.isArray(data) && data.length > 0) setDjGenres(data);
    }).catch(() => { /* keep fallback */ });
  }, [contentMode]);

  /* ═══════════════════════════════════
     DOUJINDESU: Browse genre filter effect
     ═══════════════════════════════════ */
  const loadDjGenre = useCallback(async (slug, page = 1) => {
    setDjGenreLoading(true);
    try {
      const res = await getDoujindesuByGenre(slug, page);
      const data = res?.data || res;
      const items = Array.isArray(data) ? data : (data.results || []);
      setDjGenreResults(items);
      setDjGenreHasNext(items.length >= 15);
      setDjGenrePage(page);
    } catch { setDjGenreResults([]); }
    finally { setDjGenreLoading(false); }
  }, []);

  useEffect(() => {
    if (contentMode !== 'doujindesu' || view !== 'browse' || !djFilterGenre) return;
    loadDjGenre(djFilterGenre, 1);
  }, [contentMode, view, djFilterGenre, loadDjGenre]);

  /* ═══════════════════════════════════
     DOUJINDESU: Home genre filter effect
     ═══════════════════════════════════ */
  useEffect(() => {
    if (contentMode !== 'doujindesu' || !isDjHomeFilterActive) {
      setDjHomeGenreResults(null);
      return;
    }
    const fetchGenre = async () => {
      setDjHomeGenreLoading(true);
      try {
        const res = await getDoujindesuByGenre(djHomeFilterGenre, 1);
        const data = res?.data || res;
        setDjHomeGenreResults(Array.isArray(data) ? data : (data.results || []));
      } catch { setDjHomeGenreResults([]); }
      setDjHomeGenreLoading(false);
    };
    fetchGenre();
  }, [contentMode, djHomeFilterGenre, isDjHomeFilterActive]);

  /* ── Doujindesu: Search handler ── */
  const handleDjSearch = (e) => {
    e.preventDefault();
    const q = djSearchVal.trim();
    if (!q) { clearDjSearch(); return; }
    setDjSearchMode(true);
    setDjSearchQuery(q);
    if (view !== 'browse') goView('browse');
    loadDjBrowse(1, q);
  };
  const clearDjSearch = () => {
    setDjSearchMode(false); setDjSearchVal(''); setDjSearchQuery('');
    loadDjBrowse(1);
  };
  const clearDjFilter = () => { setDjFilterGenre(''); setDjGenreSearch(''); setDjGenreResults([]); };
  const clearDjHomeFilter = () => { setDjHomeFilterGenre(''); setDjHomeGenreSearch(''); };

  /* ── Doujindesu: Open detail ── */
  const openDjDetail = async (mangaId) => {
    setDjDetailLoading(true);
    setDjDetail(null);
    setDjChapterPages([]);
    goView('detail');
    try {
      const res = await getDoujindesuDetail(mangaId);
      const data = res?.data || res;
      setDjDetail(data);
    } catch (e) { console.error('DJ detail:', e); }
    finally { setDjDetailLoading(false); }
  };

  const closeDjDetail = () => {
    setDjDetail(null); setDjChapterPages([]);
    setView(prevView === 'detail' || prevView === 'reader' ? 'home' : prevView);
  };

  /* ── Doujindesu: Open reader (chapter) ── */
  const openDjReader = async (chapter, chapterIdx) => {
    setDjChapterLoading(true);
    setDjCurrentChapter({ id: chapter.id, title: chapter.title, idx: chapterIdx });
    setReaderPage(0);
    goView('reader');
    setShowControls(true);
    setScrollSpeed(0);
    setImgErrors({});
    try {
      const res = await getDoujindesuChapterPages(chapter.id);
      const data = res?.data || res;
      setDjChapterPages(data.pages || []);
    } catch (e) { console.error('DJ read:', e); }
    finally { setDjChapterLoading(false); }
  };

  const closeDjReader = () => {
    setDjChapterPages([]);
    setView('detail');
    setScrollSpeed(0);
    setImgErrors({});
  };

  /* ── Doujindesu: Navigate chapters ── */
  const djChapters = djDetail?.chapters || [];
  const djHasPrevChapter = djCurrentChapter && djCurrentChapter.idx < djChapters.length - 1;
  const djHasNextChapter = djCurrentChapter && djCurrentChapter.idx > 0;

  const djGoChapter = async (dir) => {
    if (!djCurrentChapter || !djDetail) return;
    const newIdx = djCurrentChapter.idx + (dir === 'next' ? -1 : 1);
    if (newIdx < 0 || newIdx >= djChapters.length) return;
    const ch = djChapters[newIdx];
    await openDjReader(ch, newIdx);
  };

  /* ── Doujindesu: My list toggle ── */
  const toggleDjMyListItem = () => {
    if (!djDetail) return;
    const id = String(djDetail.id);
    if (isInMyList(id, 'doujindesu')) {
      removeFromMyList(id, 'doujindesu');
    } else {
      addToMyList({
        id, title: djDetail.title || 'Untitled',
        image: doujindesuImgProxy(djDetail.thumbnail), type: 'doujin', listType: 'doujindesu',
        rating: djDetail.score || null, releaseDate: '',
      });
    }
    loadMyList();
  };

  /* ── Doujindesu: Reader page navigation ── */
  const djTotalReaderPages = djChapterPages.length;
  const djGoNext = () => { if (readerPage < djTotalReaderPages - 1) setReaderPage((p) => p + 1); };
  const djGoPrev = () => { if (readerPage > 0) setReaderPage((p) => p - 1); };

  const handleDjReaderTap = (e) => {
    if (e.target.closest('.mangareader-topbar') || e.target.closest('.mangareader-bottombar')) return;
    if (readMode === 'page') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const third = rect.width / 3;
      if (x < third) djGoPrev(); else if (x > third * 2) djGoNext(); else setShowControls((v) => !v);
      return;
    }
    setShowControls((v) => !v);
  };

  const handleDjReaderImgError = (e, idx) => {
    setImgErrors((prev) => ({ ...prev, [idx]: true }));
  };

  /* ═══════════════════════════════════════════════════════════
     SEARCH BAR (shared between Home and Browse)
     ═══════════════════════════════════════════════════════════ */
  const SearchBar = contentMode === 'doujindesu' ? (
    <div className="home-search">
      <form onSubmit={handleDjSearch} className="home-search-form">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input value={djSearchVal} onChange={(e) => setDjSearchVal(e.target.value)} placeholder="Search doujindesu..." />
      </form>
      {djSearchMode && (
        <div className="kp-search-active">
          Results for &ldquo;<strong>{djSearchQuery}</strong>&rdquo; &bull;{' '}
          <button onClick={clearDjSearch} className="kp-link">Clear</button>
        </div>
      )}
    </div>
  ) : (
    <div className="home-search">
      <form onSubmit={handleSearch} className="home-search-form">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input value={searchVal} onChange={(e) => setSearchVal(e.target.value)} placeholder="Search books..." />
      </form>
      {searchMode && (
        <div className="kp-search-active">
          Results for &ldquo;<strong>{searchQuery}</strong>&rdquo; &bull;{' '}
          <button onClick={clearSearch} className="kp-link">Clear</button>
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     NAV BAR
     ═══════════════════════════════════════════════════════════ */
  const NavBar = (
    <div className="kp-back-bar">
      <div className="kp-nav-left">
        <button className="btn-glass kp-nav-back" onClick={() => goView('landing')} title="Back to Soora">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <span className="kp-brand">soor<span className="kp-accent">amics+</span></span>
      </div>

      {/* Mode Toggle */}
      <div className="kp-mode-toggle">
        <button
          className={`kp-mode-btn ${contentMode === 'nhentai' ? 'active' : ''}`}
          onClick={() => { setContentMode('nhentai'); goView('home'); }}
        >NH</button>
        <button
          className={`kp-mode-btn ${contentMode === 'doujindesu' ? 'active' : ''}`}
          onClick={() => { setContentMode('doujindesu'); goView('home'); }}
        >DJ</button>
      </div>

      <div className="kp-nav-tabs">
        {[
          { key: 'home', label: 'Home', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
          { key: 'browse', label: 'Browse', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg> },
          { key: 'mylist', label: 'My List', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg>, badge: myListItems.length },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`kp-nav-tab ${view === tab.key ? 'active' : ''}`}
            onClick={() => { if (tab.key === 'browse' && browseBooks.length === 0 && !browseLoading) loadBrowse(1); goView(tab.key); }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge > 0 && <span className="kp-nav-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     VIEW: LANDING
     ═══════════════════════════════════════════════════════════ */
  if (view === 'landing') {
    return <Landing showSooramicsPlus onSooramicsPlusClick={() => goView('home')} />;
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: READER (DOUJINDESU)
     ═══════════════════════════════════════════════════════════ */
  if (view === 'reader' && contentMode === 'doujindesu') {
    const bookTitle = djDetail?.title || 'Doujindesu';
    const chTitle = djCurrentChapter?.title || '';

    if (djChapterLoading) {
      return <div className="home-page sooramicsplus-page"><Loading text="Loading chapter..." /></div>;
    }

    return (
      <div className={`mangareader-page ${readMode === 'page' ? 'mangareader-page-mode' : ''}`} ref={readerRef}>
        {/* Top bar */}
        <div className={`mangareader-topbar ${showControls ? 'visible' : ''}`}>
          <button className="mangareader-back" onClick={closeDjReader}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="mangareader-title-area">
            <span className="mangareader-manga-title">{bookTitle}</span>
            <span className="mangareader-ch-title">{chTitle}</span>
          </div>
          {readMode === 'vertical' && (
            <button className={`mangareader-autoscroll-btn ${scrollSpeed > 0 ? 'active' : ''}`} onClick={() => setScrollSpeed((s) => (s + 1) % 4)} title={`Auto Scroll: ${SPEED_LABELS[scrollSpeed]}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              {scrollSpeed > 0 && <span className="mangareader-speed-badge">{scrollSpeed}x</span>}
            </button>
          )}
          <div className="mangareader-mode-toggle">
            <button className={readMode === 'vertical' ? 'active' : ''} onClick={() => setReadMode('vertical')} title="Vertical Scroll">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h8M8 14h8" /></svg>
            </button>
            <button className={readMode === 'page' ? 'active' : ''} onClick={() => { setReadMode('page'); setScrollSpeed(0); }} title="Page by Page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="2" y="3" width="8" height="18" rx="1" /><rect x="14" y="3" width="8" height="18" rx="1" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mangareader-content" onClick={handleDjReaderTap}>
          {readMode === 'vertical' ? (
            <div className="mangareader-vertical">
              {djChapterPages.map((pg, i) => (
                <div key={i} className="mangareader-img-wrap" ref={(el) => (pageRefs.current[i] = el)} data-page={i}>
                  {imgErrors[i] ? (
                    <div className="mangareader-img-error">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
                      <span>Failed to load page {i + 1}</span>
                    </div>
                  ) : (
                    <img src={doujindesuImgProxy(pg.img)} alt={`Page ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" onError={(e) => handleDjReaderImgError(e, i)} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mangareader-single">
              {djChapterPages[readerPage] && (imgErrors[readerPage] ? (
                <div className="mangareader-img-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
                  <span>Failed to load page {readerPage + 1}</span>
                </div>
              ) : (
                <img src={doujindesuImgProxy(djChapterPages[readerPage].img)} alt={`Page ${readerPage + 1}`} referrerPolicy="no-referrer" onError={(e) => handleDjReaderImgError(e, readerPage)} />
              ))}
              <div className="mangareader-tap-zones"><div className="tap-zone tap-prev" /><div className="tap-zone tap-menu" /><div className="tap-zone tap-next" /></div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className={`mangareader-bottombar ${showControls ? 'visible' : ''}`}>
          <div className="mangareader-nav">
            <button className="mangareader-nav-btn" disabled={readerPage <= 0} onClick={djGoPrev}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 18l-6-6 6-6" /></svg> Prev
            </button>
            <span className="mangareader-page-indicator">{readerPage + 1} / {djChapterPages.length}</span>
            <button className="mangareader-nav-btn" disabled={readerPage >= djChapterPages.length - 1} onClick={djGoNext}>
              Next <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          {readMode === 'page' && (
            <input type="range" className="mangareader-slider" min="0" max={Math.max(djChapterPages.length - 1, 0)} value={readerPage} onChange={(e) => setReaderPage(parseInt(e.target.value, 10))} />
          )}
          {readMode === 'vertical' && scrollSpeed > 0 && (
            <div className="mangareader-autoscroll-bar">
              <span className="mangareader-as-label">Auto Scroll</span>
              <div className="mangareader-as-speeds">
                {[1, 2, 3].map((s) => (
                  <button key={s} className={`mangareader-as-speed ${scrollSpeed === s ? 'active' : ''}`} onClick={() => setScrollSpeed(s)}>{SPEED_LABELS[s]}</button>
                ))}
              </div>
              <button className="mangareader-as-stop" onClick={() => setScrollSpeed(0)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            </div>
          )}
          {/* Chapter navigation */}
          <div className="mangareader-chapter-nav" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px', gap: 8 }}>
            <button className="mangareader-nav-btn" disabled={!djHasPrevChapter} onClick={() => djGoChapter('prev')} style={{ fontSize: 12 }}>
              ← Prev Chapter
            </button>
            <button className="mangareader-nav-btn" disabled={!djHasNextChapter} onClick={() => djGoChapter('next')} style={{ fontSize: 12 }}>
              Next Chapter →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: READER (nhentai — original)
     ═══════════════════════════════════════════════════════════ */
  if (view === 'reader' && detailBook) {
    const pages = detailBook.images?.pages || [];
    const bookTitle = detailBook.title?.pretty || detailBook.title?.english || `#${detailBook.id}`;

    return (
      <div className={`mangareader-page ${readMode === 'page' ? 'mangareader-page-mode' : ''}`} ref={readerRef}>
        {/* Top bar */}
        <div className={`mangareader-topbar ${showControls ? 'visible' : ''}`}>
          <button className="mangareader-back" onClick={closeReader}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div className="mangareader-title-area">
            <span className="mangareader-manga-title">{bookTitle}</span>
            <span className="mangareader-ch-title">{pages.length} pages</span>
          </div>
          {readMode === 'vertical' && (
            <button className={`mangareader-autoscroll-btn ${scrollSpeed > 0 ? 'active' : ''}`} onClick={() => setScrollSpeed((s) => (s + 1) % 4)} title={`Auto Scroll: ${SPEED_LABELS[scrollSpeed]}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              {scrollSpeed > 0 && <span className="mangareader-speed-badge">{scrollSpeed}x</span>}
            </button>
          )}
          <div className="mangareader-mode-toggle">
            <button className={readMode === 'vertical' ? 'active' : ''} onClick={() => setReadMode('vertical')} title="Vertical Scroll">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h8M8 14h8" /></svg>
            </button>
            <button className={readMode === 'page' ? 'active' : ''} onClick={() => { setReadMode('page'); setScrollSpeed(0); }} title="Page by Page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="2" y="3" width="8" height="18" rx="1" /><rect x="14" y="3" width="8" height="18" rx="1" /></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mangareader-content" onClick={handleReaderTap}>
          {readMode === 'vertical' ? (
            <div className="mangareader-vertical">
              {pages.map((_, i) => (
                <div key={i} className="mangareader-img-wrap" ref={(el) => (pageRefs.current[i] = el)} data-page={i}>
                  {imgErrors[i] ? (
                    <div className="mangareader-img-error">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
                      <span>Failed to load page {i + 1}</span>
                    </div>
                  ) : (
                    <img src={getPageUrl(detailBook, i)} alt={`Page ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" onError={(e) => handleReaderImgError(e, i)} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mangareader-single">
              {pages[readerPage] && (imgErrors[readerPage] ? (
                <div className="mangareader-img-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
                  <span>Failed to load page {readerPage + 1}</span>
                </div>
              ) : (
                <img src={getPageUrl(detailBook, readerPage)} alt={`Page ${readerPage + 1}`} referrerPolicy="no-referrer" onError={(e) => handleReaderImgError(e, readerPage)} />
              ))}
              <div className="mangareader-tap-zones"><div className="tap-zone tap-prev" /><div className="tap-zone tap-menu" /><div className="tap-zone tap-next" /></div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className={`mangareader-bottombar ${showControls ? 'visible' : ''}`}>
          <div className="mangareader-nav">
            <button className="mangareader-nav-btn" disabled={readerPage <= 0} onClick={goPrev}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 18l-6-6 6-6" /></svg> Prev
            </button>
            <span className="mangareader-page-indicator">{readerPage + 1} / {pages.length}</span>
            <button className="mangareader-nav-btn" disabled={readerPage >= pages.length - 1} onClick={goNext}>
              Next <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
          {readMode === 'page' && (
            <input type="range" className="mangareader-slider" min="0" max={pages.length - 1} value={readerPage} onChange={(e) => setReaderPage(parseInt(e.target.value, 10))} />
          )}
          {readMode === 'vertical' && scrollSpeed > 0 && (
            <div className="mangareader-autoscroll-bar">
              <span className="mangareader-as-label">Auto Scroll</span>
              <div className="mangareader-as-speeds">
                {[1, 2, 3].map((s) => (
                  <button key={s} className={`mangareader-as-speed ${scrollSpeed === s ? 'active' : ''}`} onClick={() => setScrollSpeed(s)}>{SPEED_LABELS[s]}</button>
                ))}
              </div>
              <button className="mangareader-as-stop" onClick={() => setScrollSpeed(0)}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: DETAIL (DOUJINDESU)
     ═══════════════════════════════════════════════════════════ */
  if (view === 'detail' && contentMode === 'doujindesu') {
    const inList = djDetail ? isInMyList(String(djDetail.id), 'doujindesu') : false;

    return (
      <div className="home-page sooramicsplus-page">
        {NavBar}

        {djDetailLoading ? (
          <Loading text="Loading detail..." />
        ) : djDetail ? (
          <div className="kp-detail">
            {/* Top section */}
            <div className="kp-detail-top">
              <div className="kp-detail-cover">
                <img src={doujindesuImgProxy(djDetail.thumbnail)} alt="Cover" referrerPolicy="no-referrer" onError={(e) => { e.target.style.opacity = '0.15'; }} />
              </div>
              <div className="kp-detail-info">
                <h1 className="kp-detail-title">{djDetail.title || 'Untitled'}</h1>
                {djDetail.alternativeTitle && <p className="kp-detail-subtitle">{djDetail.alternativeTitle}</p>}
                <div className="kp-detail-tags">
                  {(djDetail.genres || []).map((g) => (
                    <span key={g} className="kp-tag">{g}</span>
                  ))}
                  {(djDetail.tags || []).map((t) => (
                    <span key={t} className="kp-tag" style={{ opacity: 0.7 }}>{t}</span>
                  ))}
                </div>
                <div className="kp-detail-meta">
                  {djDetail.status && <span>📖 {djDetail.status}</span>}
                  {djDetail.type && <span>📁 {djDetail.type}</span>}
                  {djDetail.author && <span>✍️ {djDetail.author}</span>}
                  {djDetail.score && <span>⭐ {djDetail.score}</span>}
                  <span>📑 {djDetail.chapters?.length || 0} chapter{djDetail.chapters?.length !== 1 ? 's' : ''}</span>
                </div>
                {djDetail.synopsis && (
                  <p className="kp-detail-subtitle" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, opacity: 0.8 }}>{djDetail.synopsis}</p>
                )}
                <div className="kp-detail-actions">
                  {djDetail.chapters?.length > 0 && (
                    <button className="btn-play sooramicsplus-btn-play" onClick={() => openDjReader(djDetail.chapters[djDetail.chapters.length - 1], djDetail.chapters.length - 1)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
                      Read Ch.1
                    </button>
                  )}
                  <button className={`btn-glass kp-mylist-btn ${inList ? 'in-list' : ''}`} onClick={toggleDjMyListItem}>
                    {inList ? (
                      <><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg> Saved</>
                    ) : (
                      <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg> Save</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Chapters list */}
            {djDetail.chapters?.length > 0 && (
              <section className="kp-pages-section">
                <h2 className="section-title">Chapters ({djDetail.chapters.length})</h2>
                <div className="kp-chapters-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {djDetail.chapters.map((ch, idx) => (
                    <button
                      key={ch.id}
                      className="btn-glass"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', textAlign: 'left', fontSize: 13 }}
                      onClick={() => openDjReader(ch, idx)}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title || `Chapter ${idx + 1}`}</span>
                      {ch.date && <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 8, flexShrink: 0 }}>{ch.date}</span>}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="empty-state"><p>Manga not found.</p><button className="btn-glass" onClick={closeDjDetail}>Go Back</button></div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: DETAIL (nhentai — original)
     ═══════════════════════════════════════════════════════════ */
  if (view === 'detail') {
    const inList = detailBook ? isInMyList(String(detailBook.id), 'komikplus') : false;

    return (
      <div className="home-page sooramicsplus-page">
        {NavBar}

        {detailLoading ? (
          <Loading text="Loading detail..." />
        ) : detailBook ? (
          <div className="kp-detail">
            {/* Top section */}
            <div className="kp-detail-top">
              <div className="kp-detail-cover">
                <img src={getBookCover(detailBook)} alt="Cover" referrerPolicy="no-referrer" onError={handleImgFallback} />
              </div>
              <div className="kp-detail-info">
                <h1 className="kp-detail-title">{detailBook.title?.pretty || detailBook.title?.english || 'Untitled'}</h1>
                {detailBook.title?.japanese && <p className="kp-detail-subtitle">{detailBook.title.japanese}</p>}
                <div className="kp-detail-tags">
                  {(detailBook.tags || []).map((tag) => (
                    <span key={tag.id} className="kp-tag">{tag.name}</span>
                  ))}
                </div>
                <div className="kp-detail-meta">
                  <span>📖 {detailBook.num_pages} pages</span>
                  <span>❤️ {detailBook.num_favorites || 0}</span>
                  <span>🆔 #{detailBook.id}</span>
                  {detailBook.upload_date && <span>🗓️ {new Date(detailBook.upload_date * 1000).toLocaleDateString()}</span>}
                </div>
                <div className="kp-detail-actions">
                  <button className="btn-play sooramicsplus-btn-play" onClick={() => openReader(0)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
                    Read Now
                  </button>
                  <button className={`btn-glass kp-mylist-btn ${inList ? 'in-list' : ''}`} onClick={toggleMyListItem}>
                    {inList ? (
                      <><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg> Saved</>
                    ) : (
                      <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></svg> Save</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Page thumbnails */}
            <section className="kp-pages-section">
              <h2 className="section-title">Pages ({detailBook.num_pages})</h2>
              <div className="kp-pages-grid">
                {(detailBook.images?.pages || []).map((_, idx) => (
                  <div key={idx} className="kp-page-thumb" onClick={() => openReader(idx)}>
                    <img src={getPageThumbUrl(detailBook, idx)} alt={`Page ${idx + 1}`} loading="lazy" referrerPolicy="no-referrer" onError={handleImgFallback} />
                    <span className="kp-page-num">{idx + 1}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Related books */}
            {relatedBooks.length > 0 && (
              <HScrollSection title="Related" items={relatedBooks} color="#f43f5e" onItemClick={openDetail} />
            )}
          </div>
        ) : (
          <div className="empty-state"><p>Book not found.</p><button className="btn-glass" onClick={closeDetail}>Go Back</button></div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: MY LIST
     ═══════════════════════════════════════════════════════════ */
  if (view === 'mylist') {
    return (
      <div className="home-page sooramicsplus-page">
        {NavBar}

        {/* Header */}
        <div className="kp-ml-header">
          <div className="kp-ml-info">
            <span className="kp-ml-badge">sooramics+</span>
            <h1 className="kp-ml-title">My List</h1>
            <p className="kp-ml-count">
              {myListItems.length} {myListItems.length === 1 ? 'title' : 'titles'}
              {myListSearch && ` · ${myListDisplay.length} found`}
            </p>
          </div>

          {myListItems.length > 0 && (
            <div className="kp-ml-controls">
              <div className="kp-ml-search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                <input value={myListSearch} onChange={(e) => setMyListSearch(e.target.value)} placeholder="Search saved..." className="kp-ml-search" />
                {myListSearch && (
                  <button className="kp-ml-search-clear" onClick={() => setMyListSearch('')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <CustomSelect className="kp-ml-sort-cs" value={myListSort} onChange={setMyListSort} options={MYLIST_SORT} />
            </div>
          )}
        </div>

        {/* Content */}
        {myListDisplay.length > 0 ? (
          <div className="kp-grid" style={{ paddingTop: 8 }}>
            {myListDisplay.map((item) => {
              const isRemoving = removing === `kp-${item.id}`;
              const isDj = item.listType === 'doujindesu';
              return (
                <div key={`${item.listType}-${item.id}`} className={`kp-card ${isRemoving ? 'kp-card-removing' : ''}`} onClick={() => isDj ? openDjDetail(item.id) : openDetail(item.id)}>
                  <div className="kp-card-img-wrap">
                    <img src={item.image} alt={item.title || ''} loading="lazy" referrerPolicy="no-referrer" onError={handleImgFallback} />
                    {isDj && <span className="kp-card-badge" style={{ position: 'absolute', top: 4, left: 4, background: '#a78bfa', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>DJ</span>}
                    <button className="kp-card-remove-btn" onClick={(e) => handleMyListRemove(e, item)} title="Remove">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="kp-card-body">
                    <div className="kp-card-title">{item.title || `#${item.id}`}</div>
                    {item.releaseDate && <div className="kp-card-meta">{item.releaseDate}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : myListItems.length > 0 && myListSearch ? (
          <div className="kp-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ opacity: 0.3 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <p>No matches for &ldquo;{myListSearch}&rdquo;</p>
            <button className="btn-glass" onClick={() => setMyListSearch('')}>Clear Search</button>
          </div>
        ) : (
          <div className="kp-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="56" height="56" style={{ opacity: 0.2 }}>
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            <p className="kp-empty-title">No saved items yet</p>
            <p className="kp-empty-desc">Browse and save books to build your personal collection</p>
            <button className="btn-play sooramicsplus-btn-play" onClick={() => goView('browse')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              Browse Books
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: BROWSE (DOUJINDESU)
     ═══════════════════════════════════════════════════════════ */
  if (view === 'browse' && contentMode === 'doujindesu') {
    const displayItems = isDjFilterActive ? djGenreResults : djBrowseItems;
    const isLoading = isDjFilterActive ? djGenreLoading : djBrowseLoading;
    const genreLabel = isDjFilterActive ? djGenres.find(g => g.slug === djFilterGenre)?.name : '';
    const filteredDjGenres = djGenreSearch
      ? djGenres.filter(g => g.name.toLowerCase().includes(djGenreSearch.toLowerCase()))
      : djGenres;

    return (
      <div className="home-page sooramicsplus-page">
        {NavBar}
        {SearchBar}

        {/* Genre Filter Panel */}
        <div className="af-panel">
          <div className={`af-card ${djFilterOpen ? 'open' : ''}`}>
            <button className="af-header" onClick={() => setDjFilterOpen((v) => !v)}>
              <div className="af-header-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                <span>Genre</span>
                {isDjFilterActive && !djFilterOpen && <span className="af-header-count">1</span>}
              </div>
              <svg className="af-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="af-body">
              <div className="af-body-inner">
                <div className="af-genre-section">
                  <span className="af-label">Genre {isDjFilterActive && <span className="af-tag-count">(1)</span>}</span>
                  <div className="af-tag-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input className="af-tag-search" value={djGenreSearch} onChange={(e) => setDjGenreSearch(e.target.value)} placeholder="Search genres..." />
                    {djGenreSearch && (
                      <button className="af-tag-search-clear" onClick={() => setDjGenreSearch('')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  <div className="af-pills af-pills-scroll">
                    {filteredDjGenres.map((g) => (
                      <button
                        key={g.slug}
                        className={`af-pill ${djFilterGenre === g.slug ? 'active' : ''}`}
                        onClick={() => { setDjFilterGenre(djFilterGenre === g.slug ? '' : g.slug); setDjSearchMode(false); }}
                      >{g.name}</button>
                    ))}
                    {filteredDjGenres.length === 0 && (
                      <span className="af-more-hint">No genres found for &ldquo;{djGenreSearch}&rdquo;</span>
                    )}
                  </div>
                </div>
                {isDjFilterActive && (
                  <div className="af-active-bar">
                    <div className="af-chips">
                      <span className="af-chip">
                        {genreLabel}
                        <button onClick={clearDjFilter} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                      </span>
                    </div>
                    <button className="af-reset" onClick={clearDjFilter}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="filter-loading"><div className="filter-spinner" /><span>Loading...</span></div>
        ) : displayItems.length === 0 ? (
          <div className="filter-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6" strokeLinecap="round" /></svg>
            <p>No results found{isDjFilterActive ? ` for genre "${genreLabel}"` : ''}.</p>
            {isDjFilterActive && <button className="af-reset" onClick={clearDjFilter}>Reset Filter</button>}
          </div>
        ) : (
          <>
            {isDjFilterActive && (
              <div className="filter-results-area" style={{ paddingBottom: 0, marginBottom: '0.5rem' }}>
                <div className="filter-results-header">
                  <h2>Genre: {genreLabel}</h2>
                  <span className="filter-summary-tag">{displayItems.length} results</span>
                </div>
              </div>
            )}
            <div className="kp-grid">
              {displayItems.map((item) => (
                <div key={item.id} className="kp-card" onClick={() => openDjDetail(item.id)}>
                  <div className="kp-card-img-wrap">
                    <img src={doujindesuImgProxy(item.thumbnail)} alt={item.title || ''} loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.target.style.opacity = '0.15'; }} />
                    {item.type && <span className="kp-card-badge" style={{ position: 'absolute', top: 4, left: 4, background: '#a78bfa', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>{item.type}</span>}
                  </div>
                  <div className="kp-card-body">
                    <div className="kp-card-title">{item.title || 'Untitled'}</div>
                    <div className="kp-card-meta">
                      {item.score && `⭐ ${item.score}`}
                      {item.chapter && ` • ${item.chapter}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="kp-pagination">
              {isDjFilterActive ? (
                <>
                  <button className="btn-glass" disabled={djGenrePage <= 1} onClick={() => loadDjGenre(djFilterGenre, djGenrePage - 1)}>← Prev</button>
                  <span className="kp-page-info">Page {djGenrePage}</span>
                  <button className="btn-glass" disabled={!djGenreHasNext} onClick={() => loadDjGenre(djFilterGenre, djGenrePage + 1)}>Next →</button>
                </>
              ) : (
                <>
                  <button className="btn-glass" disabled={djBrowsePage <= 1} onClick={() => { const q = djSearchMode ? djSearchQuery : ''; loadDjBrowse(djBrowsePage - 1, q); }}>← Prev</button>
                  <span className="kp-page-info">Page {djBrowsePage}</span>
                  <button className="btn-glass" disabled={!djBrowseHasNext} onClick={() => { const q = djSearchMode ? djSearchQuery : ''; loadDjBrowse(djBrowsePage + 1, q); }}>Next →</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: BROWSE (nhentai — original)
     ═══════════════════════════════════════════════════════════ */
  if (view === 'browse') {
    return (
      <div className="home-page sooramicsplus-page">
        {NavBar}
        {SearchBar}

        {/* Filter Panel */}
        <div className="af-panel">
          <div className={`af-card ${filterOpen ? 'open' : ''}`}>
            <button className="af-header" onClick={() => setFilterOpen((v) => !v)}>
              <div className="af-header-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                <span>Filter</span>
                {isFilterActive && !filterOpen && <span className="af-header-count">{[browseLang, browseType].filter(Boolean).length + browseGenres.length}</span>}
              </div>
              <svg className="af-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="af-body">
              <div className="af-body-inner">
                <div className="af-top">
                  <div className="af-group">
                    <span className="af-label">Bahasa</span>
                    <div className="af-pills">
                      {LANG_OPTIONS.map((o) => (
                        <button key={o.value} className={`af-pill ${browseLang === o.value ? 'active' : ''}`} onClick={() => { setBrowseLang(o.value); setSearchMode(false); }}>{o.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="af-divider" />
                  <div className="af-group">
                    <span className="af-label">Tipe</span>
                    <div className="af-pills">
                      {TYPE_OPTIONS.map((o) => (
                        <button key={o.value} className={`af-pill ${browseType === o.value ? 'active' : ''}`} onClick={() => { setBrowseType(o.value); setSearchMode(false); }}>{o.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tag multi-select with search */}
                <div className="af-genre-section">
                  <span className="af-label">Tag {browseGenres.length > 0 && <span className="af-tag-count">({browseGenres.length})</span>}</span>
                  <div className="af-tag-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input
                      className="af-tag-search"
                      value={browseTagSearch}
                      onChange={(e) => setBrowseTagSearch(e.target.value)}
                      placeholder="Search tags..."
                    />
                    {browseTagSearch && (
                      <button className="af-tag-search-clear" onClick={() => setBrowseTagSearch('')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  <div className="af-pills af-pills-scroll">
                    {(browseTagSearch
                      ? ALL_TAGS.filter((t) => t.toLowerCase().includes(browseTagSearch.toLowerCase()))
                      : ALL_TAGS.slice(0, 20)
                    ).map((tag) => (
                      <button
                        key={tag}
                        className={`af-pill ${browseGenres.includes(tag) ? 'active' : ''}`}
                        onClick={() => {
                          setBrowseGenres((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                          );
                          setSearchMode(false);
                        }}
                      >{tag}</button>
                    ))}
                    {!browseTagSearch && ALL_TAGS.length > 20 && (
                      <span className="af-more-hint">Search for more tags...</span>
                    )}
                    {browseTagSearch && ALL_TAGS.filter((t) => t.toLowerCase().includes(browseTagSearch.toLowerCase())).length === 0 && (
                      <span className="af-more-hint">No tags found for "{browseTagSearch}"</span>
                    )}
                  </div>
                </div>

                <div className="af-top" style={{ marginTop: 4 }}>
                  <div className="af-group">
                    <span className="af-label">Sort</span>
                    <div className="af-pills">
                      {SORT_OPTIONS.map((o) => (
                        <button key={o.value} className={`af-pill ${filterSort === o.value ? 'active' : ''}`} onClick={() => { setFilterSort(o.value); setSearchMode(false); }}>{o.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {isFilterActive && (
                  <div className="af-active-bar">
                    <div className="af-chips">
                      {browseLang && (
                        <span className="af-chip">
                          {LANG_OPTIONS.find((o) => o.value === browseLang)?.label}
                          <button onClick={() => setBrowseLang('')} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                        </span>
                      )}
                      {browseType && (
                        <span className="af-chip">
                          {TYPE_OPTIONS.find((o) => o.value === browseType)?.label}
                          <button onClick={() => setBrowseType('')} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                        </span>
                      )}
                      {browseGenres.map((tag) => (
                        <span key={tag} className="af-chip">
                          {tag}
                          <button onClick={() => setBrowseGenres((prev) => prev.filter((t) => t !== tag))} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                        </span>
                      ))}
                    </div>
                    <button className="af-reset" onClick={clearFilters}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {browseLoading ? (
          <div className="filter-loading"><div className="filter-spinner" /><span>Loading...</span></div>
        ) : browseError ? (
          <div className="empty-state"><p>Error: {browseError}</p></div>
        ) : browseBooks.length === 0 ? (
          <div className="empty-state"><p>No results found.</p></div>
        ) : (
          <>
            <div className="kp-grid">
              {browseBooks.map((book) => (
                <div key={book.id} className="kp-card" onClick={() => openDetail(book.id)}>
                  <div className="kp-card-img-wrap">
                    <img
                      src={getBookThumb(book)}
                      alt={book.title?.pretty || ''}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { if (!e.target.dataset.retried) { e.target.dataset.retried = '1'; e.target.src = getBookCover(book); } else handleImgFallback(e); }}
                    />
                  </div>
                  <div className="kp-card-body">
                    <div className="kp-card-title">{book.title?.pretty || book.title?.english || `#${book.id}`}</div>
                    <div className="kp-card-meta">{book.num_pages}p • ❤️ {book.num_favorites || 0}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="kp-pagination">
              <button className="btn-glass" disabled={browsePage <= 1} onClick={() => goPage(browsePage - 1)}>← Prev</button>
              <span className="kp-page-info">Page {browsePage} / {browseTotalPages}</span>
              <button className="btn-glass" disabled={browsePage >= browseTotalPages} onClick={() => goPage(browsePage + 1)}>Next →</button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: HOME (DOUJINDESU)
     ═══════════════════════════════════════════════════════════ */
  if (contentMode === 'doujindesu' && (view === 'home' || (!['browse', 'mylist', 'detail', 'reader', 'landing'].includes(view)))) {
    if (djLatestLoading && djLatest.length === 0) {
      return (
        <div className="home-page sooramicsplus-page">
          {NavBar}
          <SkeletonHero theme="sooramicsplus" />
          <SkeletonSection />
          <SkeletonSection />
        </div>
      );
    }

    return (
      <div className="home-page sooramicsplus-page">
        {NavBar}

        {/* Hero area — doujindesu branding */}
        {djLatest.length > 0 && (
          <div className="hero-banner sooramicsplus-hero" style={{ minHeight: 180 }}>
            <div className="hero-bg">
              <img src={doujindesuImgProxy(djLatest[0].thumbnail)} alt="" referrerPolicy="no-referrer" onError={(e) => { e.target.style.opacity = '0.1'; }} />
            </div>
            <div className="hero-content">
              <div className="hero-top-row">
                <div className="hero-badge sooramicsplus-badge" style={{ background: '#a78bfa' }}>doujindesu</div>
              </div>
              <h1 className="hero-title">{djLatest[0].title || 'Latest'}</h1>
              <div className="hero-actions">
                <button className="btn-play sooramicsplus-btn-play" onClick={() => openDjDetail(djLatest[0].id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
                  Open
                </button>
                <button className="btn-glass" onClick={() => openDjDetail(djLatest[0].id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                  Details
                </button>
              </div>
            </div>
          </div>
        )}

        {SearchBar}

        {/* Genre Filter Panel */}
        <div className="af-panel">
          <div className={`af-card ${djHomeFilterOpen ? 'open' : ''}`}>
            <button className="af-header" onClick={() => setDjHomeFilterOpen((v) => !v)}>
              <div className="af-header-left">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
                <span>Genre</span>
                {isDjHomeFilterActive && !djHomeFilterOpen && <span className="af-header-count">1</span>}
              </div>
              <svg className="af-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="af-body">
              <div className="af-body-inner">
                <div className="af-genre-section">
                  <span className="af-label">Genre {isDjHomeFilterActive && <span className="af-tag-count">(1)</span>}</span>
                  <div className="af-tag-search-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input className="af-tag-search" value={djHomeGenreSearch} onChange={(e) => setDjHomeGenreSearch(e.target.value)} placeholder="Search genres..." />
                    {djHomeGenreSearch && (
                      <button className="af-tag-search-clear" onClick={() => setDjHomeGenreSearch('')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  <div className="af-pills af-pills-scroll">
                    {(djHomeGenreSearch
                      ? djGenres.filter(g => g.name.toLowerCase().includes(djHomeGenreSearch.toLowerCase()))
                      : djGenres
                    ).map((g) => (
                      <button
                        key={g.slug}
                        className={`af-pill ${djHomeFilterGenre === g.slug ? 'active' : ''}`}
                        onClick={() => setDjHomeFilterGenre(djHomeFilterGenre === g.slug ? '' : g.slug)}
                      >{g.name}</button>
                    ))}
                    {djHomeGenreSearch && djGenres.filter(g => g.name.toLowerCase().includes(djHomeGenreSearch.toLowerCase())).length === 0 && (
                      <span className="af-more-hint">No genres found for &ldquo;{djHomeGenreSearch}&rdquo;</span>
                    )}
                  </div>
                </div>
                {isDjHomeFilterActive && (
                  <div className="af-active-bar">
                    <div className="af-chips">
                      <span className="af-chip">
                        {djGenres.find(g => g.slug === djHomeFilterGenre)?.name || djHomeFilterGenre}
                        <button onClick={clearDjHomeFilter} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                      </span>
                    </div>
                    <button className="af-reset" onClick={clearDjHomeFilter}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Genre Filter Results ── */}
        {isDjHomeFilterActive && (
          <div className="filter-results-area">
            <div className="filter-results-header">
              <h2>Genre: {djGenres.find(g => g.slug === djHomeFilterGenre)?.name || djHomeFilterGenre}</h2>
            </div>
            {djHomeGenreLoading ? (
              <div className="filter-loading"><div className="filter-spinner" /><span>Loading...</span></div>
            ) : djHomeGenreResults && djHomeGenreResults.length > 0 ? (
              <div className="kp-grid" style={{ paddingTop: 0 }}>
                {djHomeGenreResults.slice(0, 30).map((item) => (
                  <div key={item.id} className="kp-card" onClick={() => openDjDetail(item.id)}>
                    <div className="kp-card-img-wrap">
                      <img src={doujindesuImgProxy(item.thumbnail)} alt={item.title || ''} loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.target.style.opacity = '0.15'; }} />
                    </div>
                    <div className="kp-card-body">
                      <div className="kp-card-title">{item.title || 'Untitled'}</div>
                      <div className="kp-card-meta">
                        {item.score && `⭐ ${item.score}`}
                        {item.chapter && ` • ${item.chapter}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : djHomeGenreResults !== null ? (
              <div className="filter-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6" strokeLinecap="round" /></svg>
                <p>Tidak ada hasil untuk genre ini</p>
                <button className="af-reset" onClick={clearDjHomeFilter}>Reset Filter</button>
              </div>
            ) : null}
          </div>
        )}

        {/* Latest grid */}
        {!isDjHomeFilterActive && djLatest.length > 0 && (
          <>
            <section className="home-section">
              <div className="section-header">
                <h2 className="section-title">
                  <span className="section-dot" style={{ background: '#a78bfa' }} />
                  Latest
                </h2>
              </div>
            </section>
            <div className="kp-grid">
              {djLatest.map((item) => (
                <div key={item.id} className="kp-card" onClick={() => openDjDetail(item.id)}>
                  <div className="kp-card-img-wrap">
                    <img
                      src={doujindesuImgProxy(item.thumbnail)}
                      alt={item.title || ''}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.target.style.opacity = '0.15'; }}
                    />
                    {item.type && <span style={{ position: 'absolute', top: 4, left: 4, background: '#a78bfa', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>{item.type}</span>}
                  </div>
                  <div className="kp-card-body">
                    <div className="kp-card-title">{item.title || 'Untitled'}</div>
                    <div className="kp-card-meta">
                      {item.score && `⭐ ${item.score}`}
                      {item.chapter && ` • ${item.chapter}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="kp-pagination">
              <button className="btn-glass" disabled={djLatestPage <= 1} onClick={() => loadDjLatest(djLatestPage - 1)}>← Prev</button>
              <span className="kp-page-info">Page {djLatestPage}</span>
              <button className="btn-glass" disabled={!djLatestHasNext} onClick={() => loadDjLatest(djLatestPage + 1)}>Next →</button>
            </div>
          </>
        )}

        {!isDjHomeFilterActive && djLatest.length === 0 && !djLatestLoading && (
          <div className="empty-state"><p>No data available. Try refreshing.</p></div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     VIEW: HOME (nhentai — original / default)
     ═══════════════════════════════════════════════════════════ */
  if (homeLoading && homeRecent.length === 0) return (
    <div className="home-page sooramicsplus-page">
      {NavBar}
      <SkeletonHero theme="sooramicsplus" />
      <SkeletonSection />
      <SkeletonSection />
      <SkeletonSection />
    </div>
  );

  const hero = heroItems[heroIdx];

  return (
    <div className="home-page sooramicsplus-page">
      {NavBar}

      {/* Hero Banner */}
      {hero && (
        <div className="hero-banner sooramicsplus-hero" key={heroIdx}>
          <div className="hero-bg">
            <img src={getBookCover(hero)} alt="" referrerPolicy="no-referrer" onError={handleImgFallback} />
          </div>
          <div className="hero-content">
            <div className="hero-top-row">
              <div className="hero-badge sooramicsplus-badge">sooramics+</div>
            </div>
            <h1 className="hero-title">{hero.title?.pretty || hero.title?.english || `#${hero.id}`}</h1>
            <div className="hero-actions">
              <button className="btn-play sooramicsplus-btn-play" onClick={() => openDetail(hero.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
                Open
              </button>
              <button className="btn-glass" onClick={() => openDetail(hero.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                Details
              </button>
            </div>
            {heroItems.length > 1 && (
              <div className="hero-dots">
                {heroItems.slice(0, 6).map((_, i) => (
                  <button key={i} className={`hero-dot ${i === heroIdx ? 'active' : ''}`} onClick={() => setHeroIdx(i)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search (leads to browse) */}
      {SearchBar}

      {/* ── Filter Panel (MangaHome style) ── */}
      <div className="af-panel">
        <div className={`af-card ${homeFilterOpen ? 'open' : ''}`}>
          <button className="af-header" onClick={() => setHomeFilterOpen((v) => !v)}>
            <div className="af-header-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
              <span>Filter</span>
              {isHomeFilterActive && !homeFilterOpen && (
                <span className="af-header-count">{[homeFilterLang, homeFilterType].filter(Boolean).length + homeFilterGenres.length}</span>
              )}
            </div>
            <svg className="af-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m6 9 6 6 6-6" /></svg>
          </button>

          <div className="af-body">
            <div className="af-body-inner">
              {/* Language + Type side by side */}
              <div className="af-top">
                <div className="af-group">
                  <span className="af-label">Bahasa</span>
                  <div className="af-pills">
                    {LANG_OPTIONS.map((o) => (
                      <button key={o.value} className={`af-pill ${homeFilterLang === o.value ? 'active' : ''}`} onClick={() => setHomeFilterLang(o.value)}>{o.label}</button>
                    ))}
                  </div>
                </div>
                <div className="af-divider" />
                <div className="af-group">
                  <span className="af-label">Tipe</span>
                  <div className="af-pills">
                    {TYPE_OPTIONS.map((o) => (
                      <button key={o.value} className={`af-pill ${homeFilterType === o.value ? 'active' : ''}`} onClick={() => setHomeFilterType(o.value)}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tag multi-select with search */}
              <div className="af-genre-section">
                <span className="af-label">Tag {homeFilterGenres.length > 0 && <span className="af-tag-count">({homeFilterGenres.length})</span>}</span>
                <div className="af-tag-search-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  <input
                    className="af-tag-search"
                    value={homeTagSearch}
                    onChange={(e) => setHomeTagSearch(e.target.value)}
                    placeholder="Search tags..."
                  />
                  {homeTagSearch && (
                    <button className="af-tag-search-clear" onClick={() => setHomeTagSearch('')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <div className="af-pills af-pills-scroll">
                  {(homeTagSearch
                    ? ALL_TAGS.filter((t) => t.toLowerCase().includes(homeTagSearch.toLowerCase()))
                    : ALL_TAGS.slice(0, 20)
                  ).map((tag) => (
                    <button
                      key={tag}
                      className={`af-pill ${homeFilterGenres.includes(tag) ? 'active' : ''}`}
                      onClick={() =>
                        setHomeFilterGenres((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                    >{tag}</button>
                  ))}
                  {!homeTagSearch && ALL_TAGS.length > 20 && (
                    <span className="af-more-hint">Search for more tags...</span>
                  )}
                  {homeTagSearch && ALL_TAGS.filter((t) => t.toLowerCase().includes(homeTagSearch.toLowerCase())).length === 0 && (
                    <span className="af-more-hint">No tags found for "{homeTagSearch}"</span>
                  )}
                </div>
              </div>

              {/* Sort */}
              <div className="af-top" style={{ marginTop: 4 }}>
                <div className="af-group">
                  <span className="af-label">Sort</span>
                  <div className="af-pills">
                    {SORT_OPTIONS.map((o) => (
                      <button key={o.value} className={`af-pill ${homeFilterSort === o.value ? 'active' : ''}`} onClick={() => setHomeFilterSort(o.value)}>{o.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Active summary bar */}
              {isHomeFilterActive && (
                <div className="af-active-bar">
                  <div className="af-chips">
                    {homeFilterLang && (
                      <span className="af-chip">
                        {LANG_OPTIONS.find((o) => o.value === homeFilterLang)?.label}
                        <button onClick={() => setHomeFilterLang('')} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                      </span>
                    )}
                    {homeFilterType && (
                      <span className="af-chip">
                        {TYPE_OPTIONS.find((o) => o.value === homeFilterType)?.label}
                        <button onClick={() => setHomeFilterType('')} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                      </span>
                    )}
                    {homeFilterGenres.map((tag) => (
                      <span key={tag} className="af-chip">
                        {tag}
                        <button onClick={() => setHomeFilterGenres((prev) => prev.filter((t) => t !== tag))} aria-label="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="11" height="11"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                      </span>
                    ))}
                  </div>
                  <button className="af-reset" onClick={clearHomeFilters}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Results ── */}
      {isHomeFilterActive && (
        <div className="filter-results-area">
          <div className="filter-results-header">
            <h2>Hasil Filter</h2>
            <span className="filter-summary-tag">
              {[
                homeFilterLang && LANG_OPTIONS.find((o) => o.value === homeFilterLang)?.label,
                homeFilterType && TYPE_OPTIONS.find((o) => o.value === homeFilterType)?.label,
                ...homeFilterGenres,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
          {homeFilterLoading ? (
            <div className="filter-loading"><div className="filter-spinner" /><span>Mencari...</span></div>
          ) : homeFilteredResults && homeFilteredResults.length > 0 ? (
            <div className="kp-grid" style={{ paddingTop: 0 }}>
              {homeFilteredResults.slice(0, 30).map((book) => (
                <div key={book.id} className="kp-card" onClick={() => openDetail(book.id)}>
                  <div className="kp-card-img-wrap">
                    <img
                      src={getBookThumb(book)}
                      alt={book.title?.pretty || ''}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => { if (!e.target.dataset.retried) { e.target.dataset.retried = '1'; e.target.src = getBookCover(book); } else handleImgFallback(e); }}
                    />
                  </div>
                  <div className="kp-card-body">
                    <div className="kp-card-title">{book.title?.pretty || book.title?.english || `#${book.id}`}</div>
                    <div className="kp-card-meta">{book.num_pages}p • ❤️ {book.num_favorites || 0}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : homeFilteredResults !== null ? (
            <div className="filter-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M8 11h6" strokeLinecap="round" /></svg>
              <p>Tidak ada hasil yang cocok dengan filter ini</p>
              <button className="af-reset" onClick={clearHomeFilters}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                Reset Filter
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Default Sections (when no filter active) ── */}
      {!isHomeFilterActive && (
        <>
          {homeRecent.length > 0 && (
            <HScrollSection title="Recently Added" items={homeRecent} color="#f43f5e" onItemClick={openDetail} />
          )}

          {HOME_SECTIONS.map((sec) => {
            const items = homeSections[sec.key];
            if (!items?.length) return null;
            return <HScrollSection key={sec.key} title={sec.label} items={items} color={sec.color} onItemClick={openDetail} />;
          })}
        </>
      )}

      {!isHomeFilterActive && homeRecent.length === 0 && Object.keys(homeSections).length === 0 && !homeLoading && (
        <div className="empty-state"><p>No data available. Try refreshing.</p></div>
      )}
    </div>
  );
}
