import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  searchAnime,
  searchMoviesTMDB,
  searchGoku,
  searchLK21,
  searchManga,
  searchKomiku,
  hasTMDBKey,
  getTMDBGenres,
  discoverByGenre,
  normalizeMangaTitle,
  getAnimeMostPopular,
  getAnimeTopAiring,
  getGokuTrendingMovies,
  getGokuTrendingTV,
  getLK21HomeBundle,
  getPopularManga,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';

const ANIME_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
  'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
];

const MANGA_GENRES = [
  'Action', 'Romance', 'Fantasy', 'Comedy', 'Drama', 'Adventure',
  'Horror', 'Mystery', 'Sci-Fi', 'Supernatural', 'Sports', 'Slice of Life',
];

/* ── Theme config per section ── */
const THEME = {
  anime: {
    accent: '#7c5cfc',
    accentHover: '#9b7dff',
    glow: 'rgba(124, 92, 252, 0.25)',
    gradient: 'linear-gradient(135deg, #7c5cfc 0%, #b44dff 100%)',
    label: 'SOORANIME',
    title: 'Anime',
    subtitle: 'Find your next favorite anime',
    placeholder: 'Search anime...',
    icon: '🎬',
    cls: 'sooranime',
  },
  movie: {
    accent: '#ff6b9d',
    accentHover: '#ff85b1',
    glow: 'rgba(255, 107, 157, 0.25)',
    gradient: 'linear-gradient(135deg, #ff6b9d 0%, #e84393 100%)',
    label: 'SOORAFLIX',
    title: 'Movies & TV Shows',
    subtitle: 'Discover the latest movies and series',
    placeholder: 'Search movies & TV shows...',
    icon: '🎬',
    cls: 'sooraflix',
  },
  manga: {
    accent: '#00d4aa',
    accentHover: '#2eecc4',
    glow: 'rgba(0, 212, 170, 0.25)',
    gradient: 'linear-gradient(135deg, #00d4aa 0%, #00b894 100%)',
    label: 'SOORAMICS',
    title: 'Manga & Comics',
    subtitle: 'Find your next favorite manga, manhwa, or manhua',
    placeholder: 'Search manga, manhwa, manhua...',
    icon: '📖',
    cls: 'sooramics',
  },
};

export default function Search({ searchType }) {
  const { type: paramType } = useParams();
  const type = searchType || paramType || 'anime';
  const theme = THEME[type] || THEME.anime;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialGenre = searchParams.get('genre') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Genre state
  const [tmdbGenres, setTmdbGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [genreLabel, setGenreLabel] = useState('');

  // Discover / trending items (shown when idle)
  const [discover, setDiscover] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverLabel, setDiscoverLabel] = useState('');

  // Debounce ref
  const debounceRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load TMDB genres on mount for movie type
  useEffect(() => {
    if (type === 'movie' && hasTMDBKey()) {
      getTMDBGenres()
        .then((res) => setTmdbGenres(res.data))
        .catch(() => {});
    }
  }, [type]);

  // ── Fetch discover/trending items on mount ──
  useEffect(() => {
    const fetchDiscover = async () => {
      setDiscoverLoading(true);
      try {
        if (type === 'anime') {
          const [popRes, airRes] = await Promise.allSettled([
            getAnimeMostPopular(1),
            getAnimeTopAiring(1),
          ]);
          const popular = popRes.status === 'fulfilled' ? (popRes.value.data?.results || popRes.value.data || []) : [];
          const airing = airRes.status === 'fulfilled' ? (airRes.value.data?.results || airRes.value.data || []) : [];
          // Merge, dedup, shuffle
          const seen = new Set();
          const merged = [];
          [...airing, ...popular].forEach(i => {
            if (!seen.has(i.id)) { seen.add(i.id); merged.push(i); }
          });
          setDiscover(merged.sort(() => Math.random() - 0.5).slice(0, 18));
          setDiscoverLabel('Trending Anime');
        } else if (type === 'movie') {
          const movieLang = localStorage.getItem('soora_movie_lang') || 'en';
          if (movieLang === 'id') {
            try {
              const bundleRes = await getLK21HomeBundle();
              const d = bundleRes.data || bundleRes;
              const normLK = (arr) => (arr || []).map(item => ({
                id: item._id || item.id,
                lk21Id: item._id || item.id,
                title: item.title || 'Unknown',
                image: item.posterImg || item.image || '',
                type: item.type === 'series' ? 'TV Series' : 'Movie',
                mediaType: item.type === 'series' ? 'tv' : 'movie',
                rating: item.rating || '',
                provider: 'lk21',
              }));
              const all = [
                ...normLK(d.popularMovies),
                ...normLK(d.recentMovies),
                ...normLK(d.latestSeries),
              ];
              const seen = new Set();
              const merged = [];
              all.forEach(i => { if (!seen.has(i.id)) { seen.add(i.id); merged.push(i); } });
              setDiscover(merged.sort(() => Math.random() - 0.5).slice(0, 18));
              setDiscoverLabel('Film Trending Indonesia');
            } catch {
              setDiscover([]);
            }
          } else {
            const [mRes, tRes] = await Promise.allSettled([
              getGokuTrendingMovies(),
              getGokuTrendingTV(),
            ]);
            const movies = mRes.status === 'fulfilled' ? (mRes.value.data || []) : [];
            const tv = tRes.status === 'fulfilled' ? (tRes.value.data || []) : [];
            const seen = new Set();
            const merged = [];
            [...movies, ...tv].forEach(i => {
              if (!seen.has(i.id)) { seen.add(i.id); merged.push(i); }
            });
            setDiscover(merged.sort(() => Math.random() - 0.5).slice(0, 18));
            setDiscoverLabel('Trending Movies & TV');
          }
        } else if (type === 'manga') {
          const res = await getPopularManga();
          const items = res.data?.results || [];
          setDiscover(items.sort(() => Math.random() - 0.5).slice(0, 18));
          setDiscoverLabel('Popular Manga');
        }
      } catch { /* ignore */ }
      setDiscoverLoading(false);
    };
    fetchDiscover();
  }, [type]);

  // When genre/query changes via URL
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const g = searchParams.get('genre') || '';
    setQuery(q);
    setSelectedGenre(g);

    if (g) {
      fetchByGenre(g);
    } else if (q) {
      doSearch(q);
    } else {
      setResults([]);
    }
  }, [type, searchParams.toString()]);

  const doSearch = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedGenre('');
    setGenreLabel('');

    try {
      let res;
      if (type === 'movie') {
        const movieLang = localStorage.getItem('soora_movie_lang') || 'en';
        if (movieLang === 'id') {
          res = await searchLK21(q);
          if (res.data?.results) {
            res.data.results = res.data.results.map(item => ({
              ...item,
              provider: 'lk21',
              lk21Id: item._id || item.id,
              image: item.posterImg || item.image || '',
              mediaType: item.type === 'series' ? 'tv' : 'movie',
            }));
          }
        } else {
          res = await searchGoku(q);
        }
      } else if (type === 'manga') {
        const mangaLang = localStorage.getItem('soora_manga_lang') || 'en';
        if (mangaLang === 'id') {
          res = await searchKomiku(q);
          if (res.data?.results) {
            res.data.results = res.data.results.map(item => ({ ...item, provider: 'komiku' }));
          }
        } else {
          res = await searchManga(q);
        }
      } else {
        res = await searchAnime(q);
      }
      setResults(res.data.results || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchByGenre = async (genreId) => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      if (type === 'movie') {
        const [movieRes, tvRes] = await Promise.all([
          discoverByGenre(genreId, 1, 'movie'),
          discoverByGenre(genreId, 1, 'tv'),
        ]);
        setResults([
          ...(movieRes.data.results || []),
          ...(tvRes.data.results || []),
        ].sort((a, b) => (b.rating || 0) - (a.rating || 0)));
        const g = tmdbGenres.find((x) => String(x.id) === String(genreId));
        setGenreLabel(g ? g.name : '');
      } else if (type === 'manga') {
        setGenreLabel(genreId);
        const mangaLang = localStorage.getItem('soora_manga_lang') || 'en';
        if (mangaLang === 'id') {
          const res = await searchKomiku(genreId);
          const items = (res.data?.results || []).map(item => ({ ...item, provider: 'komiku' }));
          setResults(items);
        } else {
          const res = await searchManga(genreId);
          setResults(res.data?.results || []);
        }
      } else {
        const genreName = genreId;
        setGenreLabel(genreName);
        const res = await searchAnime(genreName);
        setResults(res.data.results || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Debounced auto-search (500ms) ──
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      // Clear results when input is empty
      setResults([]);
      setGenreLabel('');
      setError(null);
      setSearchParams({});
      return;
    }

    debounceRef.current = setTimeout(() => {
      setSearchParams({ q: val.trim() });
    }, 500);
  }, [setSearchParams]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim()) {
      setSearchParams({ q: query.trim() });
    }
  };

  const handleGenreClick = (genre) => {
    const genreKey = type === 'movie' ? String(genre.id) : genre;
    if (String(selectedGenre) === String(genreKey)) {
      setSearchParams({});
      setSelectedGenre('');
      setGenreLabel('');
      setResults([]);
    } else {
      setSearchParams({ genre: genreKey });
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setGenreLabel('');
    setSelectedGenre('');
    setSearchParams({});
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const genres = type === 'movie' ? tmdbGenres : type === 'manga' ? MANGA_GENRES : ANIME_GENRES;

  const hasSearchResults = results.length > 0;
  const hasQuery = !!searchParams.get('q');
  const hasGenre = !!selectedGenre;
  const showDiscover = !loading && !hasSearchResults && !hasQuery && !hasGenre && discover.length > 0;

  return (
    <div className={`browse-page browse-${theme.cls}`}>
      {/* ── Hero header with gradient ── */}
      <div className="browse-hero" style={{ '--browse-accent': theme.accent, '--browse-glow': theme.glow, '--browse-gradient': theme.gradient }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-content">
          <span className="browse-badge" style={{ background: theme.gradient }}>{theme.label}</span>
          <h1 className="browse-title">{theme.title}</h1>
          <p className="browse-subtitle">{theme.subtitle}</p>

          {/* ── Search bar ── */}
          <div className="browse-search-wrap">
            <form className="browse-search-bar" onSubmit={handleSearch} style={{ '--browse-accent': theme.accent, '--browse-glow': theme.glow }}>
              <svg className="browse-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                value={query}
                onChange={handleInputChange}
                placeholder={theme.placeholder}
                autoFocus
              />
              {query && (
                <button type="button" className="browse-clear-btn" onClick={clearSearch} aria-label="Clear">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button type="submit" className="browse-submit-btn" style={{ background: theme.gradient }}>
                Search
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Genre chips ── */}
      {genres.length > 0 && (
        <div className="browse-genres" style={{ '--browse-accent': theme.accent, '--browse-glow': theme.glow }}>
          <div className="browse-genres-scroll">
            {genres.map((g) => {
              const key = type === 'movie' ? g.id : g;
              const label = type === 'movie' ? g.name : g;
              const isActive = String(selectedGenre) === String(key);
              return (
                <button
                  key={key}
                  className={`browse-genre-chip ${isActive ? 'active' : ''}`}
                  onClick={() => handleGenreClick(g)}
                  style={isActive ? { background: theme.glow, borderColor: theme.accent, color: theme.accent } : {}}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="browse-body">
        {/* Loading */}
        {loading && <Loading text="Searching..." theme={type === 'manga' ? 'sooramics' : type === 'movie' ? 'sooraflix' : ''} />}

        {/* Error */}
        {error && <div className="browse-error">{error}</div>}

        {/* Search results */}
        {!loading && hasSearchResults && (
          <div className="browse-results">
            <div className="browse-results-header">
              <h2 style={{ color: theme.accent }}>
                {genreLabel || `Results for "${searchParams.get('q')}"`}
              </h2>
              <span className="browse-result-count">{results.length} found</span>
            </div>
            <div className="card-grid">
              {results.map((item) => (
                <Card
                  key={item.id}
                  item={{
                    ...item,
                    title: type === 'manga' ? normalizeMangaTitle(item.title) : item.title,
                  }}
                  type={type === 'manga' ? 'manga' : type === 'movie' ? 'movie' : 'anime'}
                />
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && !error && results.length === 0 && (hasQuery || hasGenre) && (
          <div className="browse-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ color: theme.accent, opacity: 0.5 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p>No results found{hasQuery ? ` for "${searchParams.get('q')}"` : ''}</p>
            <button className="browse-try-again" style={{ color: theme.accent }} onClick={clearSearch}>Clear search</button>
          </div>
        )}

        {/* ── Discover / Trending section (shown when idle) ── */}
        {showDiscover && (
          <div className="browse-discover">
            <div className="browse-discover-header">
              <div className="browse-discover-line" style={{ background: theme.gradient }} />
              <h2>{discoverLabel}</h2>
              <div className="browse-discover-line" style={{ background: theme.gradient }} />
            </div>
            <div className="card-grid">
              {discover.map((item) => (
                <Card
                  key={item.id}
                  item={{
                    ...item,
                    title: type === 'manga' ? normalizeMangaTitle(item.title) : item.title,
                  }}
                  type={type === 'manga' ? 'manga' : type === 'movie' ? 'movie' : 'anime'}
                />
              ))}
            </div>
          </div>
        )}

        {discoverLoading && !hasQuery && !hasGenre && !loading && (
          <Loading text={`Loading ${type === 'movie' ? 'trending' : type === 'manga' ? 'popular' : 'trending'}...`} theme={type === 'manga' ? 'sooramics' : type === 'movie' ? 'sooraflix' : ''} />
        )}
      </div>
    </div>
  );
}
