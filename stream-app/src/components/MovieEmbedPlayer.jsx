import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MovieEmbedPlayer — iframe-based embed player for movies/TV with multi-server support.
 * Uses TMDB IDs.
 */

/**
 * Movie/TV embed servers — curated 2026-05-30. Dead domains removed
 * (vidsrc.icu NXDOMAIN, player.autoembed.cc NXDOMAIN).
 * `sandbox: true` blocks ad pop-ups/redirects; only on servers that play sandboxed.
 */
const EMBED_SERVERS = [
  {
    name: 'VidLink',
    buildUrl: (tmdbId, type, season, ep) =>
      type === 'tv'
        ? `https://vidlink.pro/tv/${tmdbId}/${season}/${ep}?primaryColor=7c5cfc&secondaryColor=7c5cfc&autoplay=true&iconColor=7c5cfc`
        : `https://vidlink.pro/movie/${tmdbId}?primaryColor=7c5cfc&secondaryColor=7c5cfc&autoplay=true&iconColor=7c5cfc`,
    sandbox: true,
  },
  {
    name: 'VidSrc',
    buildUrl: (tmdbId, type, season, ep) =>
      type === 'tv'
        ? `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${ep}?autoPlay=true`
        : `https://vidsrc.cc/v2/embed/movie/${tmdbId}?autoPlay=true`,
    sandbox: true,
  },
  {
    name: 'VidSrc.su',
    buildUrl: (tmdbId, type, season, ep) =>
      type === 'tv'
        ? `https://vidsrc.su/embed/tv/${tmdbId}/${season}/${ep}`
        : `https://vidsrc.su/embed/movie/${tmdbId}`,
    sandbox: false, // needs top-nav for some sources
  },
];

const LOAD_TIMEOUT = 12;

export default function MovieEmbedPlayer({ tmdbId, mediaType = 'movie', season = 1, episode = 1 }) {
  const availableServers = EMBED_SERVERS;

  const [activeServer, setActiveServer] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const [showNextHint, setShowNextHint] = useState(false);
  const [autoTried, setAutoTried] = useState(new Set());
  const timerRef = useRef(null);

  const server = availableServers[activeServer] || availableServers[0];
  const url = server?.buildUrl(tmdbId, mediaType, season, episode);
  const useSandbox = server?.sandbox === true;

  const tryNextServer = useCallback(() => {
    setActiveServer((cur) => (cur + 1) % availableServers.length);
  }, [availableServers.length]);

  // Auto-rotate to the next server once per server if the current one stalls.
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowNextHint(false);
    timerRef.current = setTimeout(() => {
      setAutoTried((prev) => {
        if (prev.has(activeServer) || prev.size >= availableServers.length - 1) {
          setShowNextHint(true);
          return prev;
        }
        const next = new Set(prev).add(activeServer);
        setActiveServer((cur) => (cur + 1) % availableServers.length);
        return next;
      });
    }, LOAD_TIMEOUT * 1000);
  }, [activeServer, availableServers.length]);

  useEffect(() => {
    setIframeKey((k) => k + 1);
    setShowNextHint(false);
    startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [activeServer, startTimer]);

  return (
    <div className="anime-embed-container">
      <div className="embed-player-wrap">
        <iframe
          key={iframeKey}
          src={url}
          frameBorder="0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Movie Player"
          referrerPolicy="no-referrer"
          {...(useSandbox ? { sandbox: 'allow-same-origin allow-scripts allow-forms allow-presentation' } : {})}
        />
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
