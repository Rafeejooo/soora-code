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

  // Manually (or auto) advance to the next server.
  const tryNextServer = useCallback(() => {
    setActiveServer((cur) => (cur + 1) % availableServers.length);
  }, [availableServers.length]);

  // Start a countdown — if the current server hasn't visibly started by then,
  // AUTO-rotate to the next one (once per server, so we don't loop forever).
  // After a full cycle, just surface the manual "Ganti server" pulse.
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowNextHint(false);
    timerRef.current = setTimeout(() => {
      setAutoTried((prev) => {
        if (prev.has(activeServer) || prev.size >= availableServers.length - 1) {
          // Already auto-tried this one (or exhausted) → show manual hint, stop.
          setShowNextHint(true);
          return prev;
        }
        const next = new Set(prev).add(activeServer);
        setActiveServer((cur) => (cur + 1) % availableServers.length);
        return next;
      });
    }, LOAD_TIMEOUT * 1000);
  }, [activeServer, availableServers.length]);

  // When server changes, force iframe reload + restart timer
  useEffect(() => {
    setIframeKey((k) => k + 1);
    setShowNextHint(false);
    startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeServer, startTimer]);

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
        {/* Minimal, unobtrusive "switch server" control — auto-rotation handles
            the common case; this is the manual escape hatch. */}
        {availableServers.length > 1 && (
          <button
            className={`embed-switch-btn ${showNextHint ? 'pulse' : ''}`}
            onClick={tryNextServer}
            title="Ganti server jika video tidak jalan"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Ganti server
          </button>
        )}
      </div>
    </div>
  );
}
