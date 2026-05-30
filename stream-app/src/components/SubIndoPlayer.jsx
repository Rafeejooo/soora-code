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

// Preferred quality order (highest first) — default to best available
const QUALITY_PREF = ['1080p', '720p', '480p', '360p'];
const qIndex = (q) => { const i = QUALITY_PREF.indexOf(q); return i === -1 ? 99 : i; };

export default function SubIndoPlayer({ animeTitle, japaneseTitle, episode = 1, samehadakuId = null }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [servers, setServers] = useState([]); // { title, serverId, quality }
  const [activeServerIdx, setActiveServerIdx] = useState(0);
  const [samehadakuEpisodes, setSamehadakuEpisodes] = useState([]);
  const [matchedAnimeId, setMatchedAnimeId] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  const timerRef = useRef(null);

  const LOAD_TIMEOUT = 14;
  const autoTriedRef = useRef(new Set());

  // Countdown — if the current server stalls, AUTO-rotate to the next one
  // (once per server). No manual control surfaced; fully automatic.
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveServerIdx((cur) => {
        if (autoTriedRef.current.has(cur) || servers.length < 2) return cur;
        autoTriedRef.current.add(cur);
        const next = (cur + 1) % servers.length;
        switchServerRef.current?.(next);
        return cur;
      });
    }, LOAD_TIMEOUT * 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [servers.length]);
  const switchServerRef = useRef(null);

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
        // 1) Find the anime on Samehadaku — use direct ID if provided
        let match = null;
        if (samehadakuId) {
          // We already know the Samehadaku ID — skip search entirely
          match = { animeId: samehadakuId };
        } else {
          match = await findSamehadakuAnime(animeTitle, japaneseTitle);
        }
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

        // 5) Build server list — only real qualities, sorted best-first
        const allServers = [];
        if (epData.server?.qualities) {
          for (const q of epData.server.qualities) {
            const qual = (q.title || '').trim();
            if (!qual || qual.toLowerCase() === 'unknown') continue; // skip noise
            for (const s of (q.serverList || [])) {
              allServers.push({ title: s.title || qual, serverId: s.serverId, quality: qual });
            }
          }
        }
        allServers.sort((a, b) => qIndex(a.quality) - qIndex(b.quality));
        setServers(allServers);

        // 6) Resolve the BEST quality server first (e.g. 1080p/720p, not the
        //    360p Blogger default). Fall back to Blogger default only if needed.
        let played = false;
        for (const srv of allServers) {
          try {
            const sd = await getSamehadakuServerUrl(srv.serverId);
            if (sd?.url) {
              setActiveServerIdx(allServers.indexOf(srv));
              setEmbedUrl(sd.url);
              played = true;
              break;
            }
          } catch { /* try next */ }
        }
        if (!played && epData.defaultStreamingUrl) {
          setEmbedUrl(epData.defaultStreamingUrl);
          played = true;
        }
        if (!played) setError('Tidak ada server tersedia');
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
  }, [animeTitle, japaneseTitle, episode, samehadakuId, startTimer]);

  // Switch to a specific server (used by auto-rotation only)
  const switchServer = useCallback(async (idx) => {
    if (idx < 0 || idx >= servers.length) return;
    setActiveServerIdx(idx);
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
  switchServerRef.current = switchServer;

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

  // Distinct qualities for the picker (best-first)
  const qualities = [...new Set(servers.map((s) => s.quality))].sort((a, b) => qIndex(a) - qIndex(b));
  const activeQuality = servers[activeServerIdx]?.quality;
  const pickQuality = (q) => {
    const idx = servers.findIndex((s) => s.quality === q);
    if (idx >= 0) switchServer(idx);
  };

  return (
    <div className="anime-embed-container">
      {qualities.length > 0 && (
        <div className="subindo-quality-bar">
          <span className="subindo-quality-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H4z"/><path d="M2 20h20"/></svg>
            Kualitas
          </span>
          {qualities.map((q) => (
            <button
              key={q}
              className={`subindo-quality-pill ${q === activeQuality ? 'active' : ''}`}
              onClick={() => pickQuality(q)}
            >
              {q}
              {qIndex(q) <= 1 && <span className="subindo-hd-badge">HD</span>}
            </button>
          ))}
        </div>
      )}
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
            referrerPolicy="no-referrer"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: 'var(--text-muted)' }}>Tidak ada URL streaming</p>
          </div>
        )}
      </div>
    </div>
  );
}
