import { useState, useEffect, useRef, useCallback } from 'react';
import {
  findSamehadakuAnime,
  getSamehadakuAnimeInfo,
  getSamehadakuEpisode,
  getSamehadakuServerUrl,
} from '../api';

/**
 * SubIndoPlayer — iframe-based player for Indonesian-subbed anime
 * Sources from Samehadaku via the Sankavollerei API.
 *
 * Flow:
 *  1. Search Samehadaku by anime title
 *  2. Fetch episode list for the matched anime
 *  3. Find the episode matching the current episode number
 *  4. Get server list and default streaming URL
 *  5. Display in an iframe (servers are embed URLs)
 *
 * Props:
 *  - animeTitle: string — title of the anime (used for search)
 *  - japaneseTitle: string — alternate title for better matching
 *  - episode: number — current episode number
 */

// Preferred quality order (highest first)
const QUALITY_PREF = ['720p', '480p', '360p'];

export default function SubIndoPlayer({ animeTitle, japaneseTitle, episode = 1 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [servers, setServers] = useState([]); // { title, serverId, quality }
  const [activeServerIdx, setActiveServerIdx] = useState(0);
  const [samehadakuEpisodes, setSamehadakuEpisodes] = useState([]);
  const [matchedAnimeId, setMatchedAnimeId] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [showNextHint, setShowNextHint] = useState(false);
  const timerRef = useRef(null);

  const LOAD_TIMEOUT = 12;

  // Start a countdown — if it fires, show "try next" hint
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowNextHint(false);
    timerRef.current = setTimeout(() => {
      setShowNextHint(true);
    }, LOAD_TIMEOUT * 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Main fetch: search → info → episode → servers
  useEffect(() => {
    if (!animeTitle) return;

    const fetchSubIndo = async () => {
      setLoading(true);
      setError(null);
      setEmbedUrl(null);
      setServers([]);
      setActiveServerIdx(0);

      try {
        // 1) Find the anime on Samehadaku
        const match = await findSamehadakuAnime(animeTitle, japaneseTitle);
        if (!match) {
          setError(`"${animeTitle}" tidak ditemukan di Samehadaku`);
          setLoading(false);
          return;
        }

        setMatchedAnimeId(match.animeId);

        // 2) Get anime info (episode list)
        const animeInfo = await getSamehadakuAnimeInfo(match.animeId);
        if (!animeInfo || !animeInfo.episodeList?.length) {
          setError('Tidak ada episode tersedia');
          setLoading(false);
          return;
        }

        setSamehadakuEpisodes(animeInfo.episodeList);

        // 3) Find the matching episode
        // episodeId format is usually: "anime-slug-episode-N"
        const targetEp = animeInfo.episodeList.find((ep) => {
          // Try to extract episode number from episodeId
          const numMatch = ep.episodeId.match(/episode-(\d+)/);
          return numMatch && parseInt(numMatch[1]) === episode;
        }) || animeInfo.episodeList[0]; // fallback to first ep

        if (!targetEp) {
          setError(`Episode ${episode} tidak ditemukan`);
          setLoading(false);
          return;
        }

        // 4) Get episode streaming data
        const epData = await getSamehadakuEpisode(targetEp.episodeId);
        if (!epData) {
          setError('Gagal memuat data episode');
          setLoading(false);
          return;
        }

        // 5) Build server list from all qualities
        const allServers = [];
        if (epData.server?.qualities) {
          for (const q of epData.server.qualities) {
            for (const s of (q.serverList || [])) {
              allServers.push({
                title: s.title || `${q.title} Server`,
                serverId: s.serverId,
                quality: q.title,
              });
            }
          }
        }

        // Sort by quality preference
        allServers.sort((a, b) => {
          const aIdx = QUALITY_PREF.indexOf(a.quality);
          const bIdx = QUALITY_PREF.indexOf(b.quality);
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });

        setServers(allServers);

        // 6) Use defaultStreamingUrl first (blogger.com video — direct embed)
        if (epData.defaultStreamingUrl) {
          setEmbedUrl(epData.defaultStreamingUrl);
          setLoading(false);
          startTimer();
          return;
        }

        // 7) If no default, resolve best server
        if (allServers.length > 0) {
          const serverData = await getSamehadakuServerUrl(allServers[0].serverId);
          if (serverData?.url) {
            setEmbedUrl(serverData.url);
          } else {
            setError('Gagal memuat URL streaming');
          }
        } else {
          setError('Tidak ada server tersedia');
        }
      } catch (err) {
        console.error('[SubIndoPlayer] Error:', err);
        setError(err.message || 'Gagal memuat Sub Indo');
      } finally {
        setLoading(false);
        startTimer();
      }
    };

    fetchSubIndo();

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [animeTitle, japaneseTitle, episode, startTimer]);

  // Switch to a specific server
  const switchServer = useCallback(async (idx) => {
    if (idx < 0 || idx >= servers.length) return;
    setActiveServerIdx(idx);
    setShowNextHint(false);

    // "Default" is index -1 (defaultStreamingUrl) — handled separately
    // For indexed servers, resolve the URL
    try {
      setLoading(true);
      const serverData = await getSamehadakuServerUrl(servers[idx].serverId);
      if (serverData?.url) {
        setEmbedUrl(serverData.url);
        setIframeKey((k) => k + 1);
      } else {
        setError('Server tidak tersedia');
      }
    } catch {
      setError('Gagal memuat server');
    } finally {
      setLoading(false);
      startTimer();
    }
  }, [servers, startTimer]);

  // Try next server
  const tryNextServer = useCallback(() => {
    const next = (activeServerIdx + 1) % (servers.length || 1);
    switchServer(next);
  }, [activeServerIdx, servers, switchServer]);

  if (!animeTitle) {
    return (
      <div className="anime-embed-container">
        <div className="embed-player-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Judul anime tidak tersedia</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="anime-embed-container">
        <div className="embed-player-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="subindo-spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Memuat Sub Indo dari Samehadaku...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="anime-embed-container">
        <div className="embed-player-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" style={{ opacity: 0.5 }}>
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', maxWidth: '320px' }}>
            {error}
          </p>
          {servers.length > 0 && (
            <button className="btn-play btn-sm" onClick={() => switchServer(0)} style={{ fontSize: '0.8rem' }}>
              Coba Server Lain
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="anime-embed-container">
      {/* Server bar */}
      <div className="embed-server-bar">
        <span className="embed-server-label">
          <span className="subindo-badge">🇮🇩 Sub Indo</span>
          Server:
        </span>
        {servers.length > 0 ? (
          servers.map((s, i) => (
            <button
              key={s.serverId}
              className={`embed-srv-btn ${i === activeServerIdx ? 'active' : ''}`}
              onClick={() => switchServer(i)}
              title={`${s.title} (${s.quality})`}
            >
              {s.title}
            </button>
          ))
        ) : (
          <span className="embed-srv-btn active">Default</span>
        )}
      </div>

      {/* Player */}
      <div className="embed-player-wrap">
        {embedUrl ? (
          <iframe
            key={iframeKey}
            src={embedUrl}
            frameBorder="0"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Sub Indo Player"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: 'var(--text-muted)' }}>Tidak ada URL streaming</p>
          </div>
        )}
      </div>

      {/* Hint / next server prompt */}
      {showNextHint && servers.length > 1 && (
        <div className="embed-hint embed-hint-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Tidak loading?
          <button className="embed-srv-btn active" style={{ marginLeft: 8, fontSize: '0.75rem' }} onClick={tryNextServer}>
            Coba {servers[(activeServerIdx + 1) % servers.length]?.title} →
          </button>
        </div>
      )}

      {!showNextHint && embedUrl && (
        <div className="embed-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Sumber: Samehadaku — jika tidak loading, coba server lain
        </div>
      )}
    </div>
  );
}
