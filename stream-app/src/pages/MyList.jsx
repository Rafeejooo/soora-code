import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyList, removeFromMyList } from '../utils/mylist';
import { mangaImgProxy, tmdbImg } from '../api';
import { buildAnimeUrl, buildMovieUrl, buildMangaUrl } from '../utils/seo';

const SECTION_CONFIG = {
  anime: {
    label: 'sooranime',
    accent: '#7c5cfc',
    title: 'My Anime',
    emptyIcon: (
      <svg viewBox="0 0 64 64" fill="none" width="64" height="64">
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
        <path d="M22 44V20l24 12-24 12z" fill="currentColor" opacity="0.15"/>
        <path d="M22 44V20l24 12-24 12z" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      </svg>
    ),
    emptyText: 'No anime saved yet',
    emptyDesc: 'Browse and add anime to your personal watchlist',
    browsePath: '/anime/search',
    browseLabel: 'Browse Anime',
    homePath: '/anime',
  },
  movie: {
    label: 'sooraflix',
    accent: '#ff6b9d',
    title: 'My Movies & TV',
    emptyIcon: (
      <svg viewBox="0 0 64 64" fill="none" width="64" height="64">
        <rect x="8" y="14" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
        <rect x="14" y="20" width="36" height="20" rx="2" fill="currentColor" opacity="0.08"/>
        <path d="M28 26v8l7-4-7-4z" fill="currentColor" opacity="0.2"/>
        <path d="M28 26v8l7-4-7-4z" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
      </svg>
    ),
    emptyText: 'No movies or shows saved',
    emptyDesc: 'Discover movies and TV series to add to your collection',
    browsePath: '/movies/search',
    browseLabel: 'Browse Movies',
    homePath: '/movies',
  },
  manga: {
    label: 'sooramics',
    accent: '#00d4aa',
    title: 'My Manga',
    emptyIcon: (
      <svg viewBox="0 0 64 64" fill="none" width="64" height="64">
        <rect x="16" y="8" width="32" height="44" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
        <rect x="20" y="14" width="24" height="32" rx="2" fill="currentColor" opacity="0.08"/>
        <path d="M26 22h12M26 28h10M26 34h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
      </svg>
    ),
    emptyText: 'No manga saved yet',
    emptyDesc: 'Find manga, manhwa, or manhua to read and save',
    browsePath: '/manga/search',
    browseLabel: 'Browse Manga',
    homePath: '/manga',
  },
};

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'rating', label: 'Highest Rated' },
];

export default function MyList({ section = 'anime' }) {
  const [items, setItems] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [removing, setRemoving] = useState(null); // item id being removed (for animation)
  const navigate = useNavigate();
  const config = SECTION_CONFIG[section] || SECTION_CONFIG.anime;

  const loadList = useCallback(() => {
    const all = getMyList();
    setItems(all.filter((i) => i.listType === section));
  }, [section]);

  useEffect(() => {
    loadList();
    const handler = () => loadList();
    window.addEventListener('mylist-changed', handler);
    return () => window.removeEventListener('mylist-changed', handler);
  }, [loadList]);

  // Filtered + sorted items
  const displayItems = (() => {
    let list = [...items];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => {
        const t = typeof i.title === 'string' ? i.title : (i.title?.english || i.title?.romaji || '');
        return t.toLowerCase().includes(q);
      });
    }

    // Sort
    if (sortBy === 'title') {
      list.sort((a, b) => {
        const ta = typeof a.title === 'string' ? a.title : (a.title?.english || a.title?.romaji || '');
        const tb = typeof b.title === 'string' ? b.title : (b.title?.english || b.title?.romaji || '');
        return ta.localeCompare(tb);
      });
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    // 'recent' = default order (addedAt desc)

    return list;
  })();

  const handleRemove = (e, item) => {
    e.stopPropagation();
    setRemoving(`${item.listType}-${item.id}`);
    setTimeout(() => {
      removeFromMyList(item.id, item.listType);
      setRemoving(null);
    }, 300);
  };

  const handleClick = (item) => {
    if (section === 'anime') {
      navigate(buildAnimeUrl(item.id));
    } else if (section === 'manga') {
      navigate(buildMangaUrl(item.id));
    } else {
      const mt = item.mediaType || 'movie';
      navigate(buildMovieUrl(item.tmdbId || item.id, mt));
    }
  };

  const getItemImage = (item) => {
    if (section === 'manga' && item.image) return mangaImgProxy(item.image);
    return item.image || '';
  };

  const getItemTitle = (item) => {
    if (typeof item.title === 'string') return item.title;
    return item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Unknown';
  };

  const getItemSubtitle = (item) => {
    const parts = [];
    if (item.type) parts.push(item.type);
    if (item.releaseDate) parts.push(String(item.releaseDate).slice(0, 4));
    if (item.rating) parts.push(`★ ${typeof item.rating === 'number' && item.rating > 10 ? (item.rating / 10).toFixed(1) : item.rating}`);
    return parts.join(' · ');
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="ml-page" style={{ '--ml-accent': config.accent }}>
      {/* Header */}
      <div className="ml-header">
        <div className="ml-header-top">
          <div className="ml-header-info">
            <span className="ml-section-badge" style={{ background: config.accent }}>
              {config.label}
            </span>
            <h1 className="ml-title">{config.title}</h1>
            <p className="ml-count">
              {items.length} {items.length === 1 ? 'title' : 'titles'}
              {searchQuery && ` · ${displayItems.length} found`}
            </p>
          </div>
        </div>

        {/* Controls bar */}
        {items.length > 0 && (
          <div className="ml-controls">
            <div className="ml-search-wrap">
              <svg className="ml-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                className="ml-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${config.title.toLowerCase()}...`}
              />
              {searchQuery && (
                <button className="ml-search-clear" onClick={() => setSearchQuery('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>

            <div className="ml-controls-right">
              {/* Sort dropdown */}
              <select
                className="ml-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {/* View toggle */}
              <div className="ml-view-toggle">
                <button
                  className={`ml-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                </button>
                <button
                  className={`ml-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="List view"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <rect x="3" y="4" width="18" height="4" rx="1"/>
                    <rect x="3" y="10" width="18" height="4" rx="1"/>
                    <rect x="3" y="16" width="18" height="4" rx="1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {displayItems.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="ml-grid">
            {displayItems.map((item) => {
              const key = `${item.listType}-${item.id}`;
              const isRemoving = removing === key;
              return (
                <div
                  key={key}
                  className={`ml-card ${isRemoving ? 'ml-card-removing' : ''}`}
                  onClick={() => handleClick(item)}
                >
                  <div className="ml-card-poster">
                    <img
                      src={getItemImage(item)}
                      alt={getItemTitle(item)}
                      loading="lazy"
                      onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%23181828" width="200" height="300"/><text x="100" y="150" fill="%23444" font-size="14" text-anchor="middle">No Image</text></svg>'; }}
                    />
                    <div className="ml-card-overlay">
                      <button className="ml-card-play">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </button>
                    </div>
                    <button
                      className="ml-card-remove"
                      onClick={(e) => handleRemove(e, item)}
                      title="Remove"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                    {item.rating && (
                      <span className="ml-card-rating">
                        ★ {typeof item.rating === 'number' && item.rating > 10 ? (item.rating / 10).toFixed(1) : item.rating}
                      </span>
                    )}
                  </div>
                  <div className="ml-card-info">
                    <h3 className="ml-card-title">{getItemTitle(item)}</h3>
                    <p className="ml-card-meta">{getItemSubtitle(item)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ml-list">
            {displayItems.map((item) => {
              const key = `${item.listType}-${item.id}`;
              const isRemoving = removing === key;
              return (
                <div
                  key={key}
                  className={`ml-list-item ${isRemoving ? 'ml-card-removing' : ''}`}
                  onClick={() => handleClick(item)}
                >
                  <div className="ml-list-poster">
                    <img
                      src={getItemImage(item)}
                      alt={getItemTitle(item)}
                      loading="lazy"
                      onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%23181828" width="200" height="300"/></svg>'; }}
                    />
                  </div>
                  <div className="ml-list-info">
                    <h3 className="ml-list-title">{getItemTitle(item)}</h3>
                    <p className="ml-list-meta">{getItemSubtitle(item)}</p>
                    {item.addedAt && (
                      <p className="ml-list-date">Added {formatDate(item.addedAt)}</p>
                    )}
                  </div>
                  <div className="ml-list-actions">
                    <button className="ml-list-play" onClick={(e) => { e.stopPropagation(); handleClick(item); }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <button className="ml-list-remove" onClick={(e) => handleRemove(e, item)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : items.length > 0 && searchQuery ? (
        /* Search yielded no results */
        <div className="ml-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ opacity: 0.3 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p className="ml-empty-title">No matches for "{searchQuery}"</p>
          <p className="ml-empty-desc">Try a different search term</p>
          <button className="ml-empty-btn" onClick={() => setSearchQuery('')}>
            Clear Search
          </button>
        </div>
      ) : (
        /* Empty list */
        <div className="ml-empty">
          <div className="ml-empty-icon">{config.emptyIcon}</div>
          <p className="ml-empty-title">{config.emptyText}</p>
          <p className="ml-empty-desc">{config.emptyDesc}</p>
          <div className="ml-empty-actions">
            <button
              className="ml-empty-btn ml-empty-btn-primary"
              style={{ background: config.accent }}
              onClick={() => navigate(config.browsePath)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              {config.browseLabel}
            </button>
            <button className="ml-empty-btn" onClick={() => navigate(config.homePath)}>
              Go to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
