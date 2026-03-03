import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnimeInfo, getHiAnimeInfo } from '../api';
import { useSEO, buildAnimeSchema, buildAnimeUrl } from '../utils/seo';

/* ===== Skeleton Loader (inline, no extra component) ===== */
function AnimeInfoSkeleton() {
  return (
    <div className="info-page">
      <div className="info-backdrop">
        <div className="skel-shimmer" style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="info-content" style={{ position: 'relative', zIndex: 10 }}>
        <div className="info-header">
          <div className="info-poster">
            <div className="skel-shimmer skel-poster" />
          </div>
          <div className="info-details" style={{ flex: 1, minWidth: 0 }}>
            <div className="skel-shimmer skel-title" />
            <div className="skel-shimmer skel-subtitle" />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
              {[60, 70, 50, 55, 45].map((w, i) => (
                <div key={i} className="skel-shimmer skel-badge" style={{ width: `${w}px` }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {[55, 65, 50, 60].map((w, i) => (
                <div key={i} className="skel-shimmer skel-genre" style={{ width: `${w}px` }} />
              ))}
            </div>
            <div style={{ marginTop: '0.8rem' }}>
              {[100, 95, 90, 70].map((w, i) => (
                <div key={i} className="skel-shimmer skel-text" style={{ width: `${w}%` }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <div className="skel-shimmer skel-btn" />
              <div className="skel-shimmer skel-btn-sm" />
            </div>
          </div>
        </div>
        {/* Skeleton episode grid */}
        <div style={{ marginTop: '2rem' }}>
          <div className="skel-shimmer" style={{ width: '180px', height: '24px', borderRadius: '6px', marginBottom: '1rem' }} />
          <div className="episodes-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="skel-shimmer skel-ep" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Description with expand/collapse ===== */
function ExpandableDescription({ html }) {
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const descRef = useRef(null);

  useEffect(() => {
    if (descRef.current) {
      setNeedsExpand(descRef.current.scrollHeight > 120);
    }
  }, [html]);

  return (
    <div className="desc-wrap">
      <div
        ref={descRef}
        className={`description-v2 ${expanded ? 'expanded' : ''}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {needsExpand && (
        <button className="desc-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? (
            <>
              Show Less
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="m18 15-6-6-6 6"/></svg>
            </>
          ) : (
            <>
              Show More
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="m6 9 6 6 6-6"/></svg>
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ===== Main Component ===== */
export default function AnimeInfo() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeRange, setActiveRange] = useState(0);
  const [epSearch, setEpSearch] = useState('');
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const [sortNewest, setSortNewest] = useState(false);
  const epSectionRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      setPosterLoaded(false);
      setBackdropLoaded(false);
      setActiveRange(0);
      setEpSearch('');
      setSortNewest(false);

      try {
        // Use the orchestrated backend endpoint first (faster, pre-merged)
        const res = await getAnimeInfo(id);
        if (!cancelled) {
          const data = res.data;
          if (!data || (!data.title && !data.description)) {
            throw new Error('No data found');
          }
          setInfo(data);
          setLoading(false);
        }
      } catch {
        // Fallback: parallel fetch both providers
        if (cancelled) return;
        try {
          const [ankaiResult, hiResult] = await Promise.allSettled([
            getAnimeInfo(id),
            getHiAnimeInfo(id),
          ]);
          if (cancelled) return;

          const ankaiInfo = ankaiResult.status === 'fulfilled' ? ankaiResult.value.data : null;
          const hiInfo = hiResult.status === 'fulfilled' ? hiResult.value.data : null;
          const hasValidAnkai = ankaiInfo?.title && (ankaiInfo.episodes?.length > 0 || ankaiInfo.totalEpisodes > 0);

          const merged = hasValidAnkai ? ankaiInfo : (hiInfo || ankaiInfo);
          if (!merged || (!merged.title && !merged.description)) {
            throw new Error('No data found');
          }
          setInfo(merged);
        } catch (err) {
          if (!cancelled) setError(err.response?.data?.message || err.message);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    };
    fetchInfo();
    return () => { cancelled = true; };
  }, [id]);

  // Derive SEO data (must be before early returns to satisfy Rules of Hooks)
  const seoTitle = info
    ? (info.title?.english || info.title?.romaji || info.title?.userPreferred || info.title || 'Unknown')
    : '';
  const seoCanonical = id ? buildAnimeUrl(id) : '';
  const seoEpCount = info?.totalEpisodes || info?.episodes?.length || 0;
  const seoStatus = info?.status || '';
  const seoGenres = info?.genres || [];

  useSEO(info ? {
    title: `Nonton Anime ${seoTitle} Sub Indo Gratis Tanpa Iklan${seoEpCount ? ` [${seoEpCount} Episode]` : ''} | HD - Soora`,
    description: `Nonton streaming anime ${seoTitle} subtitle Indonesia full episode HD gratis tanpa iklan.${seoEpCount ? ` ${seoEpCount} episode tersedia.` : ''}${seoStatus ? ` Status: ${seoStatus}.` : ''}${seoGenres.length ? ` Genre: ${seoGenres.slice(0, 3).join(', ')}.` : ''} Update episode terbaru setiap hari. Kualitas tinggi tanpa buffering hanya di Soora.`,
    canonical: seoCanonical,
    image: info.image || info.cover || '',
    type: 'video.tv_show',
    schema: buildAnimeSchema(info, seoCanonical),
  } : {});

  const title = useMemo(() =>
    info?.title?.english || info?.title?.romaji || info?.title?.userPreferred || info?.title || 'Unknown',
    [info]
  );

  const episodes = useMemo(() => {
    const eps = info?.episodes || [];
    return sortNewest ? [...eps].reverse() : eps;
  }, [info, sortNewest]);

  // Build episode ranges (smart chunking) - memoized
  const ranges = useMemo(() => {
    const CHUNK = episodes.length > 100 ? 50 : episodes.length > 36 ? 25 : episodes.length;
    const r = [];
    for (let i = 0; i < episodes.length; i += CHUNK) {
      const chunk = episodes.slice(i, i + CHUNK);
      const first = chunk[0]?.number || i + 1;
      const last = chunk[chunk.length - 1]?.number || i + chunk.length;
      r.push({ label: `${first}–${last}`, start: i, end: i + chunk.length });
    }
    return r;
  }, [episodes]);

  // Filter by search or by active range - memoized
  const displayEps = useMemo(() => {
    if (epSearch.trim()) {
      const q = epSearch.trim().toLowerCase();
      return episodes.filter(ep =>
        String(ep.number).includes(q) || (ep.title && ep.title.toLowerCase().includes(q))
      );
    }
    return episodes.slice(ranges[activeRange]?.start || 0, ranges[activeRange]?.end || episodes.length);
  }, [episodes, epSearch, ranges, activeRange]);

  const handleEpClick = useCallback((ep) => {
    navigate(
      `/watch/anime?episodeId=${encodeURIComponent(ep.id)}&title=${encodeURIComponent(title)}&ep=${ep.number || ''}&animeId=${encodeURIComponent(id)}`
    );
  }, [navigate, title, id]);

  const scrollToEpisodes = useCallback(() => {
    epSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!id) return <div className="error-msg">No anime ID provided</div>;
  if (loading) return <AnimeInfoSkeleton />;
  if (error) return (
    <div className="info-error-page">
      <div className="info-error-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" width="48" height="48">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
        </svg>
        <h2>Failed to Load</h2>
        <p>{error}</p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
          <button className="btn-glass" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
  if (!info) return <div className="error-msg">No data found</div>;

  const ratingPercent = info.rating ? (typeof info.rating === 'number' ? info.rating : parseFloat(info.rating)) : null;
  const ratingStars = ratingPercent ? (ratingPercent / 20).toFixed(1) : null;

  return (
    <div className="info-page">
      {/* Cinematic backdrop with fade-in */}
      <div className={`info-backdrop ${backdropLoaded ? 'loaded' : ''}`}>
        <img
          src={info.cover || info.image}
          alt=""
          loading="eager"
          onLoad={() => setBackdropLoaded(true)}
        />
      </div>

      <button className="back-btn" onClick={() => navigate(-1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m15 18-6-6 6-6"/></svg>
        Back
      </button>

      <div className="info-content">
        <div className="info-header">
          <div className={`info-poster ${posterLoaded ? 'loaded' : ''}`}>
            <img
              src={info.image || info.cover}
              alt={title}
              loading="eager"
              onLoad={() => setPosterLoaded(true)}
              onError={(e) => { e.target.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="320" viewBox="0 0 220 320"><rect fill="%231a1a2e" width="220" height="320"/><text x="110" y="160" text-anchor="middle" fill="%23666" font-family="system-ui" font-size="13">No Image</text></svg>')}`; }}
            />
            {/* Rating overlay on poster */}
            {ratingStars && (
              <div className="poster-rating">
                <svg viewBox="0 0 24 24" fill="var(--gold)" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>{ratingStars}</span>
              </div>
            )}
          </div>
          <div className="info-details">
            <h1 className="info-title-main">{title}</h1>
            {info.title?.romaji && info.title.romaji !== title && (
              <p className="info-alt-title">{info.title.romaji}</p>
            )}
            {info.title?.native && (
              <p className="info-native-title">{info.title.native}</p>
            )}

            <div className="info-meta">
              {info.type && <span className="badge badge-accent">{info.type}</span>}
              {info.status && (
                <span className={`badge ${info.status.toLowerCase() === 'ongoing' ? 'badge-ongoing' : info.status.toLowerCase() === 'completed' ? 'badge-completed' : ''}`}>
                  <span className={`status-dot ${info.status.toLowerCase()}`} />
                  {info.status}
                </span>
              )}
              {info.releaseDate && (
                <span className="badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  {info.releaseDate}
                </span>
              )}
              {(info.totalEpisodes || episodes.length > 0) && (
                <span className="badge badge-ep-count" onClick={scrollToEpisodes} style={{ cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {info.totalEpisodes || episodes.length} eps
                </span>
              )}
              {ratingPercent && (
                <span className="badge badge-gold">
                  <svg viewBox="0 0 24 24" fill="var(--gold)" width="12" height="12"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {ratingPercent}%
                </span>
              )}
              {info.duration && (
                <span className="badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  {info.duration} min
                </span>
              )}
              {info.season && <span className="badge">{info.season}</span>}
              {info.studios && info.studios.length > 0 && (
                <span className="badge">{info.studios[0]}</span>
              )}
            </div>

            {info.genres && info.genres.length > 0 && (
              <div className="info-genres">
                {info.genres.map((g) => (
                  <span className="genre-tag" key={g}>{g}</span>
                ))}
              </div>
            )}

            {info.description && <ExpandableDescription html={info.description} />}

            {/* Action buttons */}
            <div className="info-actions">
              {episodes.length > 0 ? (
                <>
                  <button
                    className="btn-primary btn-glow"
                    onClick={() => navigate(
                      `/watch/anime?episodeId=${encodeURIComponent(episodes[0].id)}&title=${encodeURIComponent(title)}&ep=${episodes[0].number || 1}&animeId=${encodeURIComponent(id)}`
                    )}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Watch EP 1
                  </button>
                  <button
                    className="btn-glass"
                    onClick={() => navigate(
                      `/watch/anime?episodeId=${encodeURIComponent(episodes[episodes.length - 1].id)}&title=${encodeURIComponent(title)}&ep=${episodes[episodes.length - 1].number || episodes.length}&animeId=${encodeURIComponent(id)}`
                    )}
                    title="Watch latest episode"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
                    Latest EP {episodes[episodes.length - 1].number || episodes.length}
                  </button>
                  <button
                    className="btn-sub-indo"
                    onClick={() => navigate(
                      `/watch/anime?episodeId=${encodeURIComponent(episodes[0].id)}&title=${encodeURIComponent(title)}&ep=${episodes[0].number || 1}&animeId=${encodeURIComponent(id)}&subIndo=1`
                    )}
                    title="Tonton dengan subtitle Indonesia"
                  >
                    🇮🇩 Sub Indo
                  </button>
                </>
              ) : (
                <div className="no-ep-notice">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" width="18" height="18">
                    <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                  <span>No episodes available yet. Try Sub Indo as an alternative.</span>
                  <button
                    className="btn-sub-indo"
                    onClick={() => navigate(
                      `/watch/anime?title=${encodeURIComponent(title)}&animeId=${encodeURIComponent(id)}&subIndo=1`
                    )}
                  >
                    🇮🇩 Try Sub Indo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Additional Info Grid */}
        {(info.countryOfOrigin || info.popularity || info.season || info.startDate) && (
          <div className="info-extra-grid">
            {info.countryOfOrigin && (
              <div className="info-extra-item">
                <span className="info-extra-label">Country</span>
                <span className="info-extra-value">{info.countryOfOrigin}</span>
              </div>
            )}
            {info.popularity && (
              <div className="info-extra-item">
                <span className="info-extra-label">Popularity</span>
                <span className="info-extra-value">#{info.popularity}</span>
              </div>
            )}
            {info.season && (
              <div className="info-extra-item">
                <span className="info-extra-label">Season</span>
                <span className="info-extra-value">{info.season} {info.releaseDate || ''}</span>
              </div>
            )}
            {info.studios && info.studios.length > 0 && (
              <div className="info-extra-item">
                <span className="info-extra-label">Studio</span>
                <span className="info-extra-value">{info.studios.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Episode List */}
        {episodes.length > 0 && (
          <div className="episode-section-v2" ref={epSectionRef}>
            <div className="ep-section-top">
              <div className="ep-section-title-row">
                <h2>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  Episodes
                  <span className="ep-count-badge">{episodes.length}</span>
                </h2>
                <div className="ep-controls">
                  <button
                    className={`ep-sort-btn ${sortNewest ? 'active' : ''}`}
                    onClick={() => { setSortNewest(!sortNewest); setActiveRange(0); }}
                    title={sortNewest ? 'Sort oldest first' : 'Sort newest first'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                      {sortNewest
                        ? <path d="M3 4h13M3 8h9M3 12h5M17 8v8M17 16l-3-3M17 16l3-3"/>
                        : <path d="M3 4h13M3 8h9M3 12h5M17 16V8M17 8l-3 3M17 8l3 3"/>
                      }
                    </svg>
                    {sortNewest ? 'Newest' : 'Oldest'}
                  </button>
                  {episodes.length > 12 && (
                    <div className="ep-search-wrap">
                      <svg className="ep-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      <input
                        className="ep-search-input"
                        placeholder="Search episode..."
                        value={epSearch}
                        onChange={e => setEpSearch(e.target.value)}
                      />
                      {epSearch && (
                        <button className="ep-search-clear" onClick={() => setEpSearch('')}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Range tabs */}
            {ranges.length > 1 && !epSearch && (
              <div className="ep-range-tabs-v2">
                {ranges.map((r, i) => (
                  <button
                    key={i}
                    className={`ep-range-tab-v2 ${i === activeRange ? 'active' : ''}`}
                    onClick={() => setActiveRange(i)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <div className="episodes-grid-v2">
              {displayEps.map((ep) => (
                <button
                  className="ep-card"
                  key={ep.id}
                  onClick={() => handleEpClick(ep)}
                >
                  <div className="ep-card-number">{ep.number || '?'}</div>
                  <div className="ep-card-info">
                    <span className="ep-card-label">Episode {ep.number || '?'}</span>
                    {ep.title && ep.title !== String(ep.number) && (
                      <span className="ep-card-title">
                        {ep.title.length > 40 ? ep.title.slice(0, 40) + '…' : ep.title}
                      </span>
                    )}
                  </div>
                  <svg className="ep-card-play" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
              ))}
              {epSearch && displayEps.length === 0 && (
                <div className="ep-no-results">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" width="32" height="32"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <p>No episodes match "<strong>{epSearch}</strong>"</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
