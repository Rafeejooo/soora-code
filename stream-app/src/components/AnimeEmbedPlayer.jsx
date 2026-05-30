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

/**
 * Anime embed servers — curated 2026-05-30. Dead domains removed
 * (2anime.xyz parked, autoembed.cc gone, vidsrc.icu gone, anicrush 522).
 *
 * `sandbox: true` → iframe runs sandboxed: blocks pop-ups, redirects and
 * top-window navigation = no ad pop-ups. Only set on servers that still PLAY
 * while sandboxed. Servers that need top-navigation/pop-ups to start playback
 * are left `sandbox: false` (they'd break otherwise) — those keep a minimal
 * `allow` + `referrerPolicy=no-referrer` instead.
 */
const EMBED_SERVERS = [
  {
    // VidLink — verified alive 2026-05-30, format confirmed from vidlink.pro docs:
    // /anime/{malId}/{episode}/{sub|dub}
    name: 'VidLink',
    buildUrl: (malId, _alId, ep) =>
      malId ? `https://vidlink.pro/anime/${malId}/${ep}/sub?fallback=true&primaryColor=7c5cfc&secondaryColor=7c5cfc&autoplay=true&iconColor=7c5cfc` : null,
    idType: 'mal',
    sandbox: true, // plays sandboxed → ad pop-ups/redirects blocked
  },
  {
    // VidSrc.cc v2 — anime via MAL id. Stable format `animal{mal}`.
    name: 'VidSrc',
    buildUrl: (malId, _alId, ep) =>
      malId ? `https://vidsrc.cc/v2/embed/anime/ani${malId}/${ep}/sub?autoPlay=true` : null,
    idType: 'mal',
    sandbox: true,
  },
  {
    // Dub variant on VidLink for shows that only have dub or user wants dub.
    name: 'VidLink Dub',
    buildUrl: (malId, _alId, ep) =>
      malId ? `https://vidlink.pro/anime/${malId}/${ep}/dub?fallback=true&primaryColor=7c5cfc&autoplay=true` : null,
    idType: 'mal',
    sandbox: true,
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
  // Sandbox kills ad pop-ups/redirects but only on servers that still play sandboxed.
  const useSandbox = server?.sandbox === true;

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
            title={s.sandbox ? 'Ad-blocked (sandboxed)' : 'May show provider ads'}
          >
            {s.name}
            {s.sandbox && <span className="embed-srv-noad" aria-label="ad-blocked">⦸</span>}
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
          {...(useSandbox ? { sandbox: 'allow-same-origin allow-scripts allow-forms allow-presentation' } : {})}
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
