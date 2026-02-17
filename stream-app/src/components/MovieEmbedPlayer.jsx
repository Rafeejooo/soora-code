import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MovieEmbedPlayer — iframe-based embed player for movies/TV with multi-server support.
 * Uses TMDB IDs.
 */

const EMBED_SERVERS = [
  // ✅ Tested & confirmed working (Feb 2026)
  {
    name: 'VidSrc.icu',
    buildUrl: (tmdbId, type, season, ep) =>
      type === 'tv'
        ? `https://vidsrc.icu/embed/tv/${tmdbId}/${season}/${ep}`
        : `https://vidsrc.icu/embed/movie/${tmdbId}`,
  },
  {
    name: 'AutoEmbed',
    buildUrl: (tmdbId, type, season, ep) =>
      type === 'tv'
        ? `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${ep}`
        : `https://player.autoembed.cc/embed/movie/${tmdbId}`,
  },
  {
    name: 'VidLink',
    buildUrl: (tmdbId, type, season, ep) =>
      type === 'tv'
        ? `https://vidlink.pro/tv/${tmdbId}/${season}/${ep}?primaryColor=7c5cfc&secondaryColor=7c5cfc&autoplay=true&iconColor=7c5cfc`
        : `https://vidlink.pro/movie/${tmdbId}?primaryColor=7c5cfc&secondaryColor=7c5cfc&autoplay=true&iconColor=7c5cfc`,
  },
  {
    name: 'VidSrc.su',
    buildUrl: (tmdbId, type, season, ep) =>
      type === 'tv'
        ? `https://vidsrc.su/embed/tv/${tmdbId}/${season}/${ep}`
        : `https://vidsrc.su/embed/movie/${tmdbId}`,
  },
];

const LOAD_TIMEOUT = 12;

export default function MovieEmbedPlayer({ tmdbId, mediaType = 'movie', season = 1, episode = 1 }) {
  const availableServers = EMBED_SERVERS;

  const [activeServer, setActiveServer] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [showNextHint, setShowNextHint] = useState(false);
  const timerRef = useRef(null);

  const server = availableServers[activeServer] || availableServers[0];
  const url = server?.buildUrl(tmdbId, mediaType, season, episode);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowNextHint(false);
    timerRef.current = setTimeout(() => setShowNextHint(true), LOAD_TIMEOUT * 1000);
  }, []);

  useEffect(() => {
    setIframeKey((k) => k + 1);
    setShowNextHint(false);
    startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeServer, startTimer]);

  const tryNextServer = useCallback(() => {
    const next = (activeServer + 1) % availableServers.length;
    setActiveServer(next);
  }, [activeServer, availableServers.length]);

  return (
    <div className="anime-embed-container">
      <div className="embed-server-bar">
        <span className="embed-server-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          Server:
        </span>
        {availableServers.map((s, i) => (
          <button
            key={i}
            className={`embed-srv-btn ${i === activeServer ? 'active' : ''}`}
            onClick={() => setActiveServer(i)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="embed-player-wrap">
        <iframe
          key={iframeKey}
          src={url}
          frameBorder="0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Movie Player"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>

      {showNextHint && availableServers.length > 1 && (
        <div className="embed-hint embed-hint-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Not loading?
          <button className="embed-srv-btn active" style={{ marginLeft: 8, fontSize: '0.75rem' }} onClick={tryNextServer}>
            Try {availableServers[(activeServer + 1) % availableServers.length]?.name} →
          </button>
        </div>
      )}

      {!showNextHint && (
        <div className="embed-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          If video doesn't load, try a different server above
        </div>
      )}
    </div>
  );
}
