import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAnimeInfo, getHiAnimeInfo } from '../api';
import { buildAnimeUrl, buildMovieUrl } from '../utils/seo';

/**
 * CardPopup — rendered via portal at document.body with position:fixed.
 * Receives pre-calculated style from Card for smart above/below placement.
 */
export default function CardPopup({ item, type, style: posStyle, onMouseEnter, onMouseLeave, onClose }) {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const { left, top, width, position, arrowLeft } = posStyle || {};

  // Fetch detailed info on mount
  useEffect(() => {
    let cancelled = false;
    const fetchInfo = async () => {
      setLoading(true);
      try {
        if (type === 'anime') {
          const [ankaiRes, hiRes] = await Promise.allSettled([
            getAnimeInfo(item.id),
            getHiAnimeInfo(item.id),
          ]);
          const ankai = ankaiRes.status === 'fulfilled' ? ankaiRes.value.data : null;
          const hi = hiRes.status === 'fulfilled' ? hiRes.value.data : null;
          const hasAnkai = ankai?.title && (ankai.episodes?.length > 0 || ankai.totalEpisodes > 0);
          if (!cancelled) setInfo(hasAnkai ? { ...ankai, trailer: ankai.trailer || hi?.trailer } : (hi || ankai));
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

  const title = info
    ? (info.title?.english || info.title?.romaji || info.title?.userPreferred || info.title || item.title || 'Unknown')
    : (typeof item.title === 'object' ? item.title?.english || item.title?.romaji || item.title?.userPreferred : item.title) || 'Unknown';

  const description = info?.description || info?.overview || item.overview || '';
  let cleanDesc = description.replace(/<[^>]*>/g, '');
  // Strip metadata fields that HiAnime sends as continuous text (not newline-separated)
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

  const handlePlay = (e) => {
    e.stopPropagation();
    if (type === 'anime') {
      if (trailer?.id) {
        window.open(`https://www.youtube.com/watch?v=${trailer.id}`, '_blank');
      } else if (episodes.length > 0) {
        navigate(`/watch/anime?episodeId=${encodeURIComponent(episodes[0].id)}&title=${encodeURIComponent(title)}&ep=${episodes[0].number || 1}&animeId=${encodeURIComponent(item.id)}`);
      } else {
        navigate(buildAnimeUrl(item.id));
      }
    } else {
      const mt = item.mediaType || 'movie';
      navigate(buildMovieUrl(item.id || item.tmdbId, mt));
    }
  };

  const handleInfo = (e) => {
    e.stopPropagation();
    if (type === 'anime') {
      navigate(buildAnimeUrl(item.id));
    } else {
      const mt = item.mediaType || 'movie';
      navigate(buildMovieUrl(item.id || item.tmdbId, mt));
    }
  };

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
      <div
        className="cpop-pointer"
        style={{ left: `${arrowLeft}px` }}
      />

      <div className="cpop-body">
        <div className="cpop-title-row">
          <h4 className="cpop-title">{title}</h4>
          {rating > 0 && (
            <span className="cpop-rating">
              <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              {typeof rating === 'number' && rating > 10 ? (rating / 10).toFixed(1) : rating}
            </span>
          )}
        </div>

        <div className="cpop-meta">
          {info?.type && <span className="cpop-tag">{info.type}</span>}
          {info?.status && <span className="cpop-tag">{info.status}</span>}
          {totalEps > 0 && <span className="cpop-tag">{totalEps} eps</span>}
          {item.sub > 0 && <span className="cpop-tag cpop-tag-accent">SUB</span>}
          {item.dub > 0 && <span className="cpop-tag cpop-tag-green">DUB</span>}
        </div>

        {genres.length > 0 && (
          <div className="cpop-genres">
            {(Array.isArray(genres) ? genres : []).slice(0, 3).map((g, i) => (
              <span key={typeof g === 'string' ? g : g.name || i} className="cpop-genre">
                {typeof g === 'string' ? g : g.name}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div className="cpop-loading">
            <div className="cpop-skeleton" />
            <div className="cpop-skeleton short" />
          </div>
        ) : cleanDesc ? (
          <p className="cpop-desc">{cleanDesc.length > 120 ? cleanDesc.slice(0, 120) + '...' : cleanDesc}</p>
        ) : null}

        <div className="cpop-actions">
          <button className="cpop-btn cpop-btn-primary" onClick={handlePlay}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {trailer?.id ? 'Trailer' : 'Play'}
          </button>
          <button className="cpop-btn cpop-btn-ghost" onClick={handleInfo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            Info
          </button>
        </div>
      </div>
    </div>
  );
}
