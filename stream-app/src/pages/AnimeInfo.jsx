import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnimeInfo, getHiAnimeInfo } from '../api';
import { useSEO, buildAnimeSchema, buildAnimeUrl } from '../utils/seo';
import Loading from '../components/Loading';

export default function AnimeInfo() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeRange, setActiveRange] = useState(0);
  const [epSearch, setEpSearch] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ankaiResult, hiResult] = await Promise.allSettled([
          getAnimeInfo(id),
          getHiAnimeInfo(id),
        ]);

        const ankaiInfo = ankaiResult.status === 'fulfilled' ? ankaiResult.value.data : null;
        const hiInfo = hiResult.status === 'fulfilled' ? hiResult.value.data : null;
        const hasValidAnkai = ankaiInfo?.title && (ankaiInfo.episodes?.length > 0 || ankaiInfo.totalEpisodes > 0);

        const merged = hasValidAnkai ? ankaiInfo : (hiInfo || ankaiInfo);
        if (!merged || (!merged.title && !merged.description)) {
          throw new Error('No data found');
        }
        setInfo(merged);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
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

  if (!id) return <div className="error-msg">No anime ID provided</div>;
  if (loading) return <Loading text="Loading anime info..." />;
  if (error) return <div className="error-msg">{error}</div>;
  if (!info) return <div className="error-msg">No data found</div>;

  const title =
    info.title?.english || info.title?.romaji || info.title?.userPreferred || info.title || 'Unknown';

  const episodes = info.episodes || [];

  // Build episode ranges (smart chunking)
  const CHUNK = episodes.length > 100 ? 50 : episodes.length > 36 ? 25 : episodes.length;
  const ranges = [];
  for (let i = 0; i < episodes.length; i += CHUNK) {
    const chunk = episodes.slice(i, i + CHUNK);
    const first = chunk[0]?.number || i + 1;
    const last = chunk[chunk.length - 1]?.number || i + chunk.length;
    ranges.push({ label: `${first}-${last}`, start: i, end: i + chunk.length });
  }

  // Filter by search or by active range
  const displayEps = epSearch.trim()
    ? episodes.filter(ep => {
        const q = epSearch.trim().toLowerCase();
        return String(ep.number).includes(q) || (ep.title && ep.title.toLowerCase().includes(q));
      })
    : episodes.slice(ranges[activeRange]?.start || 0, ranges[activeRange]?.end || episodes.length);

  return (
    <div className="info-page">
      {/* Cinematic backdrop */}
      <div className="info-backdrop">
        <img src={info.cover || info.image} alt="" />
      </div>

      <button className="back-btn" onClick={() => navigate(-1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="m15 18-6-6 6-6"/></svg>
        Back
      </button>

      <div className="info-content">
        <div className="info-header">
          <div className="info-poster">
            <img
              src={info.image || info.cover}
              alt={title}
              onError={(e) => { e.target.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="320" viewBox="0 0 220 320"><rect fill="%231a1a2e" width="220" height="320"/><text x="110" y="160" text-anchor="middle" fill="%23666" font-family="system-ui" font-size="13">No Image</text></svg>')}`; }}
            />
          </div>
          <div className="info-details">
            <h1>{title}</h1>
            {info.title?.romaji && info.title.romaji !== title && (
              <p className="info-alt-title">{info.title.romaji}</p>
            )}

            <div className="info-meta">
              {info.type && <span className="badge badge-accent">{info.type}</span>}
              {info.status && <span className="badge">{info.status}</span>}
              {info.releaseDate && <span className="badge">{info.releaseDate}</span>}
              {info.totalEpisodes && <span className="badge">{info.totalEpisodes} eps</span>}
              {info.rating && <span className="badge badge-gold">{info.rating}%</span>}
              {info.duration && <span className="badge">{info.duration} min</span>}
            </div>

            {info.genres && (
              <div className="info-genres">
                {info.genres.map((g) => (
                  <span className="genre-tag" key={g}>{g}</span>
                ))}
              </div>
            )}

            {info.description && (
              <div className="description" dangerouslySetInnerHTML={{ __html: info.description }} />
            )}

            {episodes.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-primary"
                  onClick={() => navigate(
                    `/watch/anime?episodeId=${encodeURIComponent(episodes[0].id)}&title=${encodeURIComponent(title)}&ep=${episodes[0].number || 1}&animeId=${encodeURIComponent(id)}`
                  )}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Watch Now
                </button>
                <button
                  className="btn-glass"
                  onClick={() => navigate(
                    `/watch/anime?episodeId=${encodeURIComponent(episodes[0].id)}&title=${encodeURIComponent(title)}&ep=${episodes[0].number || 1}&animeId=${encodeURIComponent(id)}&subIndo=1`
                  )}
                  title="Tonton dengan subtitle Indonesia dari Samehadaku"
                >
                  🇮🇩 Sub Indo
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.75rem' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" width="18" height="18">
                    <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    No episodes available from streaming providers yet. Try Sub Indo as an alternative.
                  </span>
                </div>
                <button
                  className="btn-glass"
                  onClick={() => navigate(
                    `/watch/anime?title=${encodeURIComponent(title)}&animeId=${encodeURIComponent(id)}&subIndo=1`
                  )}
                  title="Coba cari versi Sub Indo dari Samehadaku"
                >
                  🇮🇩 Try Sub Indo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Episode List */}
        {episodes.length > 0 && (
          <div className="episode-section">
            <div className="episode-section-header">
              <h2>Episodes ({episodes.length})</h2>
              {episodes.length > 12 && (
                <div className="ep-search-wrap">
                  <svg className="ep-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    className="ep-search-input"
                    placeholder="Search ep..."
                    value={epSearch}
                    onChange={e => { setEpSearch(e.target.value); }}
                  />
                  {epSearch && (
                    <button className="ep-search-clear" onClick={() => setEpSearch('')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Range tabs */}
            {ranges.length > 1 && !epSearch && (
              <div className="ep-range-tabs">
                {ranges.map((r, i) => (
                  <button
                    key={i}
                    className={`ep-range-tab ${i === activeRange ? 'active' : ''}`}
                    onClick={() => setActiveRange(i)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            <div className="episodes-grid">
              {displayEps.map((ep) => (
                <button
                  className="ep-btn"
                  key={ep.id}
                  onClick={() =>
                    navigate(
                      `/watch/anime?episodeId=${encodeURIComponent(ep.id)}&title=${encodeURIComponent(title)}&ep=${ep.number || ''}&animeId=${encodeURIComponent(id)}`
                    )
                  }
                >
                  <span className="ep-num">EP {ep.number || '?'}</span>
                  {ep.title && ep.title !== String(ep.number) && (
                    <span className="ep-title">
                      {ep.title.length > 25 ? ep.title.slice(0, 25) + '...' : ep.title}
                    </span>
                  )}
                </button>
              ))}
              {epSearch && displayEps.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1/-1', padding: '1rem 0' }}>
                  No episodes match "{epSearch}"
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
