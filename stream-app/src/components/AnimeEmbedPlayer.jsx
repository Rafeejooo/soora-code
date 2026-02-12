import { useState, useRef, useEffect } from 'react';

/**
 * AnimeEmbedPlayer — iframe-based fallback player for anime
 * Used when consumet HLS extractors fail (500 errors).
 * Accepts MAL ID and AniList ID to build embed URLs.
 */

const EMBED_SERVERS = [
  {
    name: 'Server 1',
    buildUrl: (malId, alId, ep) =>
      `https://vidlink.pro/anime/${alId}/${ep}?primaryColor=7c5cfc&secondaryColor=7c5cfc&autoplay=true&iconColor=7c5cfc`,
  },
  {
    name: 'Server 2',
    buildUrl: (malId, alId, ep) =>
      `https://2anime.xyz/embed/${alId}-episode-${ep}`,
  },
  {
    name: 'Server 3',
    buildUrl: (malId, alId, ep) =>
      `https://vidsrc.cc/v2/embed/anime/mal/${malId}/${ep}`,
  },
];

export default function AnimeEmbedPlayer({ malId, alId, episode = 1 }) {
  const [activeServer, setActiveServer] = useState(0);
  const [iframeKey, setIframeKey] = useState(0); // force iframe reload on server change
  const iframeRef = useRef(null);

  const url = EMBED_SERVERS[activeServer].buildUrl(malId, alId, episode);

  // Force re-render iframe when server changes
  useEffect(() => {
    setIframeKey((k) => k + 1);
  }, [activeServer]);

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
        {EMBED_SERVERS.map((s, i) => (
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
          ref={iframeRef}
          src={url}
          frameBorder="0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Anime Player"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </div>
      <div className="embed-hint">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        If video doesn't load, try a different server above
      </div>
    </div>
  );
}
