import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  searchAnime,
  searchMoviesTMDB,
  searchGoku,
  searchManga,
  searchMangaDex,
  searchKomiku,
  hasTMDBKey,
  getTMDBGenres,
  discoverByGenre,
  normalizeMangaTitle,
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

export default function Search({ searchType }) {
  const { type: paramType } = useParams();
  const type = searchType || paramType || 'anime';
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

  // Load TMDB genres on mount for movie type
  useEffect(() => {
    if (type === 'movie' && hasTMDBKey()) {
      getTMDBGenres()
        .then((res) => setTmdbGenres(res.data))
        .catch(() => {});
    }
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
        // Use Goku search primarily (no API key needed)
        res = await searchGoku(q);
      } else if (type === 'manga') {
        const mangaLang = localStorage.getItem('soora_manga_lang') || 'en';
        if (mangaLang === 'id') {
          res = await searchKomiku(q);
          if (res.data?.results) {
            res.data.results = res.data.results.map(item => ({ ...item, provider: 'komiku' }));
          }
        } else if (mangaLang !== 'en') {
          res = await searchMangaDex(q);
          if (res.data?.results) {
            res.data.results = res.data.results.map(item => ({ ...item, provider: 'mangadex' }));
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
        } else if (mangaLang !== 'en') {
          const res = await searchMangaDex(genreId);
          const items = (res.data?.results || []).map(item => ({ ...item, provider: 'mangadex' }));
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

  const handleSearch = (e) => {
    e.preventDefault();
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

  const genres = type === 'movie' ? tmdbGenres : type === 'manga' ? MANGA_GENRES : ANIME_GENRES;
  const isMangaGenre = type === 'manga';

  return (
    <div className={`search-page ${type === 'manga' ? 'sooramics-page' : ''}`}>
      <div className="search-page-header">
        <h1>{type === 'movie' ? 'Movies & TV Shows' : type === 'manga' ? 'Manga & Comics' : 'Anime'}</h1>
        <p className="search-subtitle">
          {type === 'movie'
            ? 'Discover the latest movies and series'
            : type === 'manga'
            ? 'Find your next favorite manga, manhwa, or manhua'
            : 'Find your next favorite anime'}
        </p>
      </div>

      <div className="search-container">
        <form className="search-bar" onSubmit={handleSearch}>
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              type === 'movie'
                ? 'Search movies & TV shows...'
                : type === 'manga'
                ? 'Search manga, manhwa, manhua...'
                : 'Search anime...'
            }
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </div>

      {/* Genre chips */}
      {genres.length > 0 && (
        <div className="genre-filter-section">
          <div className="genre-chips-wrap">
            {genres.map((g) => {
              const key = type === 'movie' ? g.id : g;
              const label = type === 'movie' ? g.name : g;
              const isActive = String(selectedGenre) === String(key);
              return (
                <button
                  key={key}
                  className={`genre-chip ${isActive ? 'active' : ''}`}
                  onClick={() => handleGenreClick(g)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading && <Loading text="Searching..." theme={type === 'manga' ? 'sooramics' : type === 'movie' ? 'sooraflix' : ''} />}
      {error && <div className="error-msg">{error}</div>}

      {!loading && results.length > 0 && (
        <div className="search-results-section">
          <h2 className="section-title">
            {genreLabel
              ? `${genreLabel}`
              : `Results for "${searchParams.get('q')}"`}
            <span className="result-count">{results.length} found</span>
          </h2>
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

      {!loading && !error && results.length === 0 && (initialQuery || selectedGenre) && (
        <div className="empty-state">
          No results found
          {initialQuery ? ` for "${initialQuery}"` : ''}
        </div>
      )}

      {!loading && !initialQuery && !selectedGenre && (
        <div className="empty-state">
          Start typing or select a genre to discover{' '}
          {type === 'movie' ? 'movies & TV shows' : type === 'manga' ? 'manga' : 'anime'}
        </div>
      )}
    </div>
  );
}
