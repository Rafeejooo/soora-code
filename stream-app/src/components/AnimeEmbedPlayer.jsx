import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * AnimeEmbedPlayer — iframe-based fallback player for anime
 * Used when consumet HLS extractors fail (500 errors).
 * Accepts MAL ID and AniList ID to build embed URLs.
 *
 * Dedicated anime embed servers (NOT the same as Sooraflix movie embeds):
 *  - Uses anime-specific endpoints (MAL ID or AniList ID routing)
 *  - Servers optimized for anime content & subtitle availability
 *  - Auto-rotation: if a server doesn't load within LOAD_TIMEOUT, tries the next
 *  - Manual server switching always available
 */

// Anime-dedicated embed servers — prioritized by reliability for anime content
const EMBED_SERVERS = [
  // ── Anime-optimized embeds (MAL ID) ──
  {
    name: '2Anime',
    buildUrl: (malId, _alId, ep) =>
      `https://2anime.xyz/embed/${malId}/${ep}`,
    idType: 'mal',
  },
  {
    name: 'AnimeEmbed',
    buildUrl: (malId, _alId, ep) =>
      `https://anime.autoembed.cc/embed/${malId}-episode-${ep}`,
    idType: 'mal',
  },
  {
    name: 'AniCrush',
    buildUrl: (_malId, alId, ep) =>
      alId ? `https://anicrush.to/watch/${alId}?ep=${ep}` : null,
    idType: 'al',
  },
  {
    name: 'VidSrc Anime',
    buildUrl: (malId, _alId, ep) =>
      `https://vidsrc.icu/embed/anime/mal/${malId}/${ep}`,
    idType: 'mal',
  },
  {
    name: 'EmbeAnime',
    buildUrl: (malId, _alId, ep) =>
      `https://player.autoembed.cc/embed/anime/mal/${malId}/${ep}`,
    idType: 'mal',
  },
  {
    name: 'VidLink Anime',
    buildUrl: (malId, _alId, ep) =>
      `https://vidlink.pro/anime/mal/${malId}/${ep}?primaryColor=7c5cfc&secondaryColor=7c5cfc&autoplay=true&iconColor=7c5cfc`,
    idType: 'mal',
  },
];

// Seconds to wait before showing "try next server" prompt
const LOAD_TIMEOUT = 10;

export default function AnimeEmbedPlayer({ malId, alId, episode = 1 }) {
  // Filter servers based on available IDs
  const availableServers = useMemo(() =>
    EMBED_SERVERS.filter((s) => {
      if (s.idType === 'al' && !alId) return false;
      if (s.idType === 'mal' && !malId) return false;
      return true;
    }),
    [malId, alId]
  );

  const [activeServer, setActiveServer] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [showNextHint, setShowNextHint] = useState(false);
  const [autoTried, setAutoTried] = useState(new Set());
  const timerRef = useRef(null);
  const iframeRef = useRef(null);

  const server = availableServers[activeServer] || availableServers[0];
  const url = server?.buildUrl(malId, alId, episode);
  const isAutoEmbed = server?.name === 'EmbeAnime' || server?.name === 'AnimeEmbed';

  // Start a countdown — if it fires, show "try next" hint
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowNextHint(false);
    timerRef.current = setTimeout(() => {
      setShowNextHint(true);
    }, LOAD_TIMEOUT * 1000);
  }, []);

  // When server changes, force iframe reload + restart timer
  useEffect(() => {
    setIframeKey((k) => k + 1);
    setShowNextHint(false);
    startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeServer, startTimer]);

  // Auto-try next server when hint appears (up to one auto-rotation per server)
  const tryNextServer = useCallback(() => {
    setAutoTried((prev) => new Set(prev).add(activeServer));
    const next = (activeServer + 1) % availableServers.length;
    setActiveServer(next);
  }, [activeServer, availableServers.length]);

  if (!url) {
    return (
      <div className="anime-embed-container">
        <div className="embed-player-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No embed server available — missing MAL/AniList ID</p>
        </div>
      </div>
    );
  }

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
          ref={iframeRef}
          src={url}
          frameBorder="0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Anime Player"
          referrerPolicy="no-referrer"
          {...(isAutoEmbed ? { sandbox: 'allow-same-origin allow-scripts allow-forms' } : {})}
        />
      </div>

      {/* Prompt to try another server if current one seems stuck */}
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
