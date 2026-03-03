import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnimeInfo } from '../api';
import { buildAnimeUrl, buildMovieUrl } from '../utils/seo';
import { addToMyList, removeFromMyList, isInMyList } from '../utils/mylist';

/**
 * CardPopup — Netflix-style hover card with trailer/preview support.
 * Rendered via portal at document.body with position:fixed.
 */
export default function CardPopup({ item, type, style: posStyle, onMouseEnter, onMouseLeave, onClose }) {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const [inList, setInList] = useState(() => isInMyList(item.id, type));
  const trailerTimer = useRef(null);
  const iframeRef = useRef(null);

  const { left, top, width, position, arrowLeft } = posStyle || {};

  // Fetch detailed info on mount — use single orchestrated endpoint
  useEffect(() => {
    let cancelled = false;
    const fetchInfo = async () => {
      setLoading(true);
      try {
        if (type === 'anime') {
          const res = await getAnimeInfo(item.id);
          const data = res.data;
          if (!cancelled) setInfo(data);
        } else {
          if (!cancelled) setInfo(item);
        }
      } catch {
        if (!cancelled) setInfo(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInfo();
    return () => { cancelled = true; };
  }, [item.id, type]);

  // Auto-play trailer after 1.5s if available
  useEffect(() => {
    if (!info) return;
    const trailerId = info.trailer?.id;
    if (trailerId) {
      trailerTimer.current = setTimeout(() => {
        setShowTrailer(true);
      }, 1500);
    }
    return () => clearTimeout(trailerTimer.current);
  }, [info]);

  // Listen for mylist changes
  useEffect(() => {
    const handler = () => setInList(isInMyList(item.id, type));
    window.addEventListener('mylist-changed', handler);
    return () => window.removeEventListener('mylist-changed', handler);
  }, [item.id, type]);

  const title = info
    ? (info.title?.english || info.title?.romaji || info.title?.userPreferred || info.title || item.title || 'Unknown')
    : (typeof item.title === 'object' ? item.title?.english || item.title?.romaji || item.title?.userPreferred : item.title) || 'Unknown';

  const description = info?.description || info?.overview || item.overview || '';
  let cleanDesc = description.replace(/<[^>]*>/g, '');
  cleanDesc = cleanDesc
    .replace(/\b(Country|Premiered|Date aired|Broadcast|Duration|Status|Score|Producers|Studios|Source|Licensors|Genres|Episodes|Aired|Rating|Type|Popularity|Members|Favorites|Synonyms|Japanese|English|French|German|Spanish|Native|Romaji)\s*:\s*[^.]*?(?=\s+(?:Country|Premiered|Date aired|Broadcast|Duration|Status|Score|Producers|Studios|Source|Licensors|Genres|Episodes|Aired|Rating|Type|Popularity|Members|Favorites|Synonyms|Japanese|English|French|German|Spanish|Native|Romaji)\s*:|$)/gi, '')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const genres = info?.genres || item?.genres || [];
  const rating = info?.rating || item?.rating;
  const episodes = info?.episodes || [];
  const trailer = info?.trailer;
  const totalEps = info?.totalEpisodes || item?.totalEpisodes;
  const status = info?.status || item?.status || '';
  const coverImg = info?.cover || info?.image || item?.cover || item?.image || '';
  const posterImg = info?.image || item?.image || '';

  const handlePlay = useCallback((e) => {
    e.stopPropagation();
    if (type === 'anime') {
      if (episodes.length > 0) {
        navigate(`/watch/anime?episodeId=${encodeURIComponent(episodes[0].id)}&title=${encodeURIComponent(title)}&ep=${episodes[0].number || 1}&animeId=${encodeURIComponent(item.id)}`);
      } else {
        navigate(buildAnimeUrl(item.id));
      }
    } else {
      const mt = item.mediaType || 'movie';
      navigate(buildMovieUrl(item.id || item.tmdbId, mt));
    }
  }, [type, episodes, title, item, navigate]);

  const handleInfo = useCallback((e) => {
    e.stopPropagation();
    if (type === 'anime') {
      navigate(buildAnimeUrl(item.id));
    } else {
      const mt = item.mediaType || 'movie';
      navigate(buildMovieUrl(item.id || item.tmdbId, mt));
    }
  }, [type, item, navigate]);

  const toggleList = useCallback((e) => {
    e.stopPropagation();
    if (inList) {
      removeFromMyList(item.id, type);
    } else {
      addToMyList({
        ...item,
        title: typeof item.title === 'object'
          ? item.title.english || item.title.romaji || item.title.userPreferred || 'Unknown'
          : item.title || 'Unknown',
        listType: type,
      });
    }
    setInList(!inList);
  }, [inList, item, type]);

  const ratingDisplay = rating
    ? (typeof rating === 'number' && rating > 10 ? (rating / 10).toFixed(1) : rating)
    : null;

  const inlineStyle = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
  };

  return (
    <div
      className={`card-popup ${position === 'above' ? 'popup-above' : 'popup-below'}`}
      style={inlineStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="cpop-pointer" style={{ left: `${arrowLeft}px` }} />

      {/* Preview area — trailer or cover image */}
      <div className="cpop-preview">
        {showTrailer && trailer?.id ? (
          <iframe
            ref={iframeRef}
            className="cpop-trailer-iframe"
            src={`https://www.youtube.com/embed/${trailer.id}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailer.id}&start=0`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="Trailer"
          />
        ) : (
          <img
            className="cpop-preview-img"
            src={coverImg || posterImg}
            alt=""
            loading="eager"
          />
        )}
        <div className="cpop-preview-gradient" />
        {/* Trailer indicator */}
        {trailer?.id && !showTrailer && (
          <div className="cpop-trailer-badge">
            <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Trailer loading...
          </div>
        )}
        {showTrailer && (
          <button
            className="cpop-mute-btn"
            onClick={(e) => { e.stopPropagation(); setShowTrailer(false); }}
            title="Stop trailer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      <div className="cpop-body">
        {/* Action buttons row */}
        <div className="cpop-action-row">
          <button className="cpop-circle-btn cpop-circle-primary" onClick={handlePlay} title="Play">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <button className={`cpop-circle-btn ${inList ? 'cpop-circle-active' : ''}`} onClick={toggleList} title={inList ? 'Remove from list' : 'Add to list'}>
            {inList ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
            )}
          </button>
          <div className="cpop-spacer" />
          <button className="cpop-circle-btn" onClick={handleInfo} title="More info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>

        {/* Title */}
        <h4 className="cpop-title">{title}</h4>

        {/* Meta row */}
        <div className="cpop-meta-row">
          {ratingDisplay && (
            <span className="cpop-match">
              {ratingDisplay > 10 ? ratingDisplay : ratingDisplay + '%'} Match
            </span>
          )}
          {status && (
            <span className={`cpop-status-tag ${status.toLowerCase() === 'ongoing' ? 'ongoing' : ''}`}>
              {status}
            </span>
          )}
          {totalEps > 0 && <span className="cpop-eps-tag">{totalEps} EP</span>}
          {item.sub > 0 && <span className="cpop-lang-tag accent">SUB</span>}
          {item.dub > 0 && <span className="cpop-lang-tag green">DUB</span>}
        </div>

        {/* Genres */}
        {genres.length > 0 && (
          <div className="cpop-genre-row">
            {(Array.isArray(genres) ? genres : []).slice(0, 3).map((g, i) => (
              <span key={typeof g === 'string' ? g : g.name || i}>
                {i > 0 && <span className="cpop-genre-dot">•</span>}
                {typeof g === 'string' ? g : g.name}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {loading ? (
          <div className="cpop-loading">
            <div className="cpop-skeleton" />
            <div className="cpop-skeleton short" />
          </div>
        ) : cleanDesc ? (
          <p className="cpop-desc">{cleanDesc.length > 100 ? cleanDesc.slice(0, 100) + '…' : cleanDesc}</p>
        ) : null}
      </div>
    </div>
  );
}
