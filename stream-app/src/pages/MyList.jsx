import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyList, removeFromMyList } from '../utils/mylist';
import { mangaImgProxy } from '../api';
import { buildAnimeUrl, buildMovieUrl, buildMangaUrl } from '../utils/seo';
import CustomSelect from '../components/CustomSelect';

/* -- Section definitions -- */
const SECTIONS = [
  { key: 'anime', label: 'Anime', accent: '#7c5cfc', path: '/anime/mylist', homePath: '/anime', browsePath: '/anime/search', browseLabel: 'Browse Anime' },
  { key: 'movie', label: 'Movies & TV', accent: '#ff6b9d', path: '/movies/mylist', homePath: '/movies', browsePath: '/movies/search', browseLabel: 'Browse Movies' },
  { key: 'manga', label: 'Manga', accent: '#00d4aa', path: '/manga/mylist', homePath: '/manga', browsePath: '/manga/search', browseLabel: 'Browse Manga' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently Added' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'rating', label: 'Highest Rated' },
];

export default function MyList({ section = 'anime' }) {
  const [items, setItems] = useState([]);
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [removing, setRemoving] = useState(null);
  const navigate = useNavigate();

  const config = SECTIONS.find((s) => s.key === section) || SECTIONS[0];
  const allItems = useMemo(() => getMyList(), [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counts per section (for tab badges)
  const counts = useMemo(() => ({
    anime: allItems.filter((i) => i.listType === 'anime').length,
    movie: allItems.filter((i) => i.listType === 'movie').length,
    manga: allItems.filter((i) => i.listType === 'manga' || i.listType === 'komikplus').length,
  }), [allItems]);

  const totalCount = counts.anime + counts.movie + counts.manga;

  /* -- Load list -- */
  const loadList = useCallback(() => {
    const list = getMyList().filter((i) => {
      if (section === 'manga') return i.listType === 'manga' || i.listType === 'komikplus';
      return i.listType === section;
    });
    setItems(list);
  }, [section]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const handler = () => loadList();
    window.addEventListener('mylist-changed', handler);
    return () => window.removeEventListener('mylist-changed', handler);
  }, [loadList]);

  // Reset search when switching sections
  useEffect(() => { setSearchQuery(''); }, [section]);

  /* -- Computed display list -- */
  const displayItems = (() => {
    let list = [...items];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((item) => {
        const t = typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji || '');
        return t.toLowerCase().includes(q);
      });
    }
    if (sortBy === 'title') {
      list.sort((a, b) => {
        const ta = typeof a.title === 'string' ? a.title : (a.title?.english || a.title?.romaji || '');
        const tb = typeof b.title === 'string' ? b.title : (b.title?.english || b.title?.romaji || '');
        return ta.localeCompare(tb);
      });
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return list;
  })();

  /* -- Handlers -- */
  const handleRemove = (e, item) => {
    e.stopPropagation();
    setRemoving(`${item.listType}-${item.id}`);
    setTimeout(() => {
      removeFromMyList(item.id, item.listType);
      setRemoving(null);
    }, 350);
  };

  const handleClick = (item) => {
    if (section === 'anime') navigate(buildAnimeUrl(item.id));
    else if (section === 'manga') navigate(buildMangaUrl(item.id));
    else navigate(buildMovieUrl(item.tmdbId || item.id, item.mediaType || 'movie'));
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
    if (item.rating) parts.push(`\u2605 ${typeof item.rating === 'number' && item.rating > 10 ? (item.rating / 10).toFixed(1) : item.rating}`);
    return parts.join(' \u00b7 ');
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isRecentlyAdded = (ts) => ts && (Date.now() - ts) < 24 * 60 * 60 * 1000;

  return (
    <div className="ml2-page" style={{ '--ml2-accent': config.accent }}>
      {/* Hero header */}
      <div className="ml2-hero">
        <div className="ml2-hero-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${config.accent} 15%, transparent) 0%, transparent 70%)` }} />
        <div className="ml2-hero-content">
          <div className="ml2-hero-title-row">
            <h1 className="ml2-hero-title">My Collection</h1>
            {totalCount > 0 && (
              <span className="ml2-hero-total">{totalCount} titles</span>
            )}
          </div>

          {/* Section tabs */}
          <div className="ml2-tabs">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                className={`ml2-tab ${section === s.key ? 'ml2-tab-active' : ''}`}
                onClick={() => navigate(s.path)}
                style={section === s.key ? { '--tab-accent': s.accent } : undefined}
              >
                <span className="ml2-tab-label">{s.label}</span>
                {counts[s.key] > 0 && (
                  <span className="ml2-tab-count" style={section === s.key ? { background: s.accent } : undefined}>
                    {counts[s.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ml2-body">
        {/* Controls bar */}
        {items.length > 0 && (
          <div className="ml2-controls">
            <div className="ml2-search-wrap">
              <svg className="ml2-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="ml2-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search in ${config.label.toLowerCase()}...`}
              />
              {searchQuery && (
                <button className="ml2-search-clear" onClick={() => setSearchQuery('')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="ml2-controls-right">
              <CustomSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} className="ml2-sort-select" />
              <div className="ml2-view-toggle">
                <button className={`ml2-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </button>
                <button className={`ml2-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} title="List view">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                    <rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {displayItems.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="ml2-grid">
              {displayItems.map((item, idx) => {
                const key = `${item.listType}-${item.id}`;
                const isRemoving = removing === key;
                const isNew = isRecentlyAdded(item.addedAt);
                return (
                  <div
                    key={key}
                    className={`ml2-card ${isRemoving ? 'ml2-card-removing' : ''}`}
                    onClick={() => handleClick(item)}
                    style={{ animationDelay: `${Math.min(idx * 40, 600)}ms` }}
                  >
                    <div className="ml2-card-poster">
                      <img
                        src={getItemImage(item)}
                        alt={getItemTitle(item)}
                        loading="lazy"
                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%23181828" width="200" height="300"/><text x="100" y="150" fill="%23444" font-size="14" text-anchor="middle">No Image</text></svg>'; }}
                      />
                      <div className="ml2-card-shine" />
                      <div className="ml2-card-overlay">
                        <button className="ml2-card-play" onClick={(e) => { e.stopPropagation(); handleClick(item); }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </button>
                      </div>
                      <button className="ml2-card-remove" onClick={(e) => handleRemove(e, item)} title="Remove from list">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                      {isNew && <span className="ml2-card-new">NEW</span>}
                      {item.rating && (
                        <span className="ml2-card-rating">
                          {'\u2605'} {typeof item.rating === 'number' && item.rating > 10 ? (item.rating / 10).toFixed(1) : item.rating}
                        </span>
                      )}
                    </div>
                    <div className="ml2-card-info">
                      <h3 className="ml2-card-title">{getItemTitle(item)}</h3>
                      <p className="ml2-card-meta">{getItemSubtitle(item)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ml2-list">
              {displayItems.map((item, idx) => {
                const key = `${item.listType}-${item.id}`;
                const isRemoving = removing === key;
                const isNew = isRecentlyAdded(item.addedAt);
                return (
                  <div
                    key={key}
                    className={`ml2-list-item ${isRemoving ? 'ml2-list-removing' : ''}`}
                    onClick={() => handleClick(item)}
                    style={{ animationDelay: `${Math.min(idx * 30, 400)}ms` }}
                  >
                    <div className="ml2-list-poster">
                      <img
                        src={getItemImage(item)}
                        alt={getItemTitle(item)}
                        loading="lazy"
                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="%23181828" width="200" height="300"/></svg>'; }}
                      />
                      {isNew && <span className="ml2-list-new">NEW</span>}
                    </div>
                    <div className="ml2-list-info">
                      <h3 className="ml2-list-title">{getItemTitle(item)}</h3>
                      <p className="ml2-list-meta">{getItemSubtitle(item)}</p>
                      {item.addedAt && <p className="ml2-list-date">Added {formatDate(item.addedAt)}</p>}
                    </div>
                    <div className="ml2-list-actions">
                      <button className="ml2-list-play" onClick={(e) => { e.stopPropagation(); handleClick(item); }} title="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </button>
                      <button className="ml2-list-remove" onClick={(e) => handleRemove(e, item)} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : items.length > 0 && searchQuery ? (
          <div className="ml2-empty">
            <div className="ml2-empty-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </div>
            <p className="ml2-empty-title">No results for &quot;{searchQuery}&quot;</p>
            <p className="ml2-empty-desc">Try a different search term</p>
            <button className="ml2-empty-btn" onClick={() => setSearchQuery('')}>Clear Search</button>
          </div>
        ) : (
          <div className="ml2-empty">
            <div className="ml2-empty-illustration">
              <div className="ml2-empty-circle" style={{ background: `radial-gradient(circle, color-mix(in srgb, ${config.accent} 20%, transparent) 0%, transparent 70%)` }}>
                <svg viewBox="0 0 80 80" fill="none" width="80" height="80">
                  <rect x="12" y="18" width="56" height="44" rx="8" stroke={config.accent} strokeWidth="1.5" opacity="0.3" />
                  <rect x="18" y="24" width="44" height="32" rx="4" fill={config.accent} opacity="0.08" />
                  <polygon points="36,34 36,50 50,42" fill={config.accent} opacity="0.4" />
                </svg>
              </div>
            </div>
            <p className="ml2-empty-title">Your {config.label} list is empty</p>
            <p className="ml2-empty-desc">Start exploring and save titles you want to watch later</p>
            <div className="ml2-empty-actions">
              <button className="ml2-empty-btn ml2-empty-btn-primary" style={{ background: config.accent }} onClick={() => navigate(config.browsePath)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                {config.browseLabel}
              </button>
              <button className="ml2-empty-btn" onClick={() => navigate(config.homePath)}>Go to Home</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
