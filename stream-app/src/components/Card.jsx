import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { addToMyList, removeFromMyList, isInMyList } from '../utils/mylist';
import { mangaImgProxy, getMangaContentType } from '../api';
import { buildAnimeUrl, buildMovieUrl, buildMangaUrl } from '../utils/seo';
import CardPopup from './CardPopup';

export default function Card({ item, type = 'anime' }) {
  const navigate = useNavigate();
  const [inList, setInList] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupStyle, setPopupStyle] = useState(null);
  const cardRef = useRef(null);
  const hoverTimer = useRef(null);
  const leaveTimer = useRef(null);

  useEffect(() => {
    setInList(isInMyList(item.id, type));
    const handler = () => setInList(isInMyList(item.id, type));
    window.addEventListener('mylist-changed', handler);
    return () => window.removeEventListener('mylist-changed', handler);
  }, [item.id, type]);

  const handleClick = () => {
    if (type === 'anime') {
      navigate(buildAnimeUrl(item.id));
    } else if (type === 'manga') {
      navigate(buildMangaUrl(item.id));
    } else if (item.provider === 'lk21') {
      const mt = item.mediaType || 'movie';
      navigate(buildMovieUrl(item.lk21Id || item.id, mt));
    } else {
      const mt = item.mediaType || 'movie';
      navigate(buildMovieUrl(item.id, mt));
    }
  };

  const toggleList = (e) => {
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
  };

  // Calculate popup position (fixed to viewport)
  const calcPopupStyle = useCallback(() => {
    if (!cardRef.current) return null;
    const rect = cardRef.current.getBoundingClientRect();
    const popupW = 270;
    const popupH = 260;
    const gap = 10;

    // Horizontal: center on card, clamp to viewport
    let left = rect.left + rect.width / 2 - popupW / 2;
    if (left < 12) left = 12;
    if (left + popupW > window.innerWidth - 12) left = window.innerWidth - popupW - 12;

    // Vertical: prefer below, fallback above
    const spaceBelow = window.innerHeight - rect.bottom;
    let top;
    let position;
    if (spaceBelow >= popupH + gap) {
      top = rect.bottom + gap;
      position = 'below';
    } else {
      top = rect.top - popupH - 4;
      if (top < 8) top = 8;
      position = 'above';
    }

    // Arrow position (horizontal center of card)
    const arrowLeft = rect.left + rect.width / 2 - left;

    return { left, top, width: popupW, position, arrowLeft };
  }, []);

  // Kill popup on parent row scroll or window scroll
  const cancelPopup = useCallback(() => {
    clearTimeout(hoverTimer.current);
    clearTimeout(leaveTimer.current);
    setShowPopup(false);
    setHovered(false);
  }, []);

  useEffect(() => {
    const row = cardRef.current?.closest('.card-row');
    if (row) {
      row.addEventListener('scroll', cancelPopup, { passive: true });
      return () => row.removeEventListener('scroll', cancelPopup);
    }
  }, [cancelPopup]);

  // Also cancel on window scroll
  useEffect(() => {
    if (!showPopup) return;
    window.addEventListener('scroll', cancelPopup, { passive: true });
    return () => window.removeEventListener('scroll', cancelPopup);
  }, [showPopup, cancelPopup]);

  const handleMouseEnter = useCallback(() => {
    clearTimeout(leaveTimer.current);
    setHovered(true);
    // No popup for manga cards
    if (type === 'manga') return;
    hoverTimer.current = setTimeout(() => {
      const style = calcPopupStyle();
      if (style) {
        setPopupStyle(style);
        setShowPopup(true);
      }
    }, 700);
  }, [calcPopupStyle, type]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimer.current);
    setHovered(false);
    leaveTimer.current = setTimeout(() => {
      setShowPopup(false);
    }, 300);
  }, []);

  const handlePopupEnter = useCallback(() => {
    clearTimeout(leaveTimer.current);
    setHovered(true);
  }, []);

  const handlePopupLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setShowPopup(false);
      setHovered(false);
    }, 200);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(hoverTimer.current);
      clearTimeout(leaveTimer.current);
    };
  }, []);

  const isManga = type === 'manga';
  const rawTitle =
    item.title?.english || item.title?.romaji || item.title?.userPreferred || item.title || 'No Title';
  // Fix MangaPill concatenated titles
  const title = isManga && typeof rawTitle === 'string'
    ? (() => { const i = rawTitle.search(/[a-z][A-Z]/); return i >= 2 && rawTitle.length - i - 1 >= 4 ? rawTitle.slice(0, i + 1) : rawTitle; })()
    : rawTitle;
  // MangaDex/Komiku images don't need the manga proxy
  const rawImg = item.image || item.cover || '';
  const imgSrc = isManga
    ? ((rawImg.includes('mangadex.org') || rawImg.includes('komiku.org')) ? rawImg : mangaImgProxy(rawImg))
    : rawImg;

  // SVG data URI fallback for broken images (no external dependency)
  const fallbackImg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect fill="%231a1a2e" width="300" height="400"/><text x="150" y="190" text-anchor="middle" fill="%23666" font-family="system-ui" font-size="14">No Image</text><rect x="125" y="130" width="50" height="40" rx="4" fill="none" stroke="%23555" stroke-width="2"/><circle cx="138" cy="145" r="4" fill="%23555"/><path d="M125 165 l15-12 10 8 12-6 13 10" fill="none" stroke="%23555" stroke-width="1.5"/></svg>')}`;

  return (
    <div
      className={`card ${hovered ? 'card-hovered' : ''}`}
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="card-img-wrapper">
        <img
          src={imgSrc || fallbackImg}
          alt={title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (e.target.src !== fallbackImg) e.target.src = fallbackImg;
          }}
        />
        <div className="card-shine" />
        <div className="card-overlay">
          {isManga ? (
            <div className="card-play-circle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              </svg>
            </div>
          ) : (
            <div className="card-play-circle">
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            </div>
          )}
        </div>
        {item.rating && (
          <div className="card-rating">
            <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            {item.rating}%
          </div>
        )}
        <button
          className={`card-bookmark ${inList ? 'active' : ''}`}
          onClick={toggleList}
          title={inList ? 'Remove from My List' : 'Add to My List'}
        >
          {inList ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          )}
        </button>
      </div>
      <div className="card-body">
        <div className="card-title">{title}</div>
        <div className="card-meta">
          {isManga ? (
            <span className={`card-type-badge manga-type ${(item.id || '').includes('-novel') ? 'novel-type' : ''}`}>
              {getMangaContentType(item)}
            </span>
          ) : (
            <>
              {item.type && <span className="card-type-badge">{item.type}</span>}
              {item.sub > 0 && <span className="card-badge-sub">SUB</span>}
              {item.dub > 0 && <span className="card-badge-dub">DUB</span>}
              {!item.sub && item.subOrDub && <span className="card-badge-sub">{item.subOrDub}</span>}
              {item.episodes > 0 && !item.sub && <span className="card-meta-eps">{item.episodes} eps</span>}
            </>
          )}
        </div>
      </div>

      {showPopup && popupStyle && createPortal(
        <CardPopup
          item={item}
          type={type}
          style={popupStyle}
          onMouseEnter={handlePopupEnter}
          onMouseLeave={handlePopupLeave}
          onClose={cancelPopup}
        />,
        document.body
      )}
    </div>
  );
}
