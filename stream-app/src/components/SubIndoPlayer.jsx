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
          setError('not_found');
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

        // 5) Build server list — only real qualities. Rank by RELIABILITY then
        //    quality. Raw file-hosts (wibufile/filedon/krakenfiles) expire/hotlink
        //    mid-stream ("File tidak lagi dapat diakses"), so they go LAST.
        const FILEHOST = /wibufile|filedon|krakenfiles|mp4upload|streamtape|gofile/i;
        const allServers = [];
        if (epData.server?.qualities) {
          for (const q of epData.server.qualities) {
            const qual = (q.title || '').trim();
            if (!qual || qual.toLowerCase() === 'unknown') continue;
            for (const s of (q.serverList || [])) {
              const name = s.title || qual;
              allServers.push({ title: name, serverId: s.serverId, quality: qual, filehost: FILEHOST.test(name) });
            }
          }
        }
        // reliable streaming hosts first, then by quality (best-first)
        allServers.sort((a, b) => (a.filehost - b.filehost) || (qIndex(a.quality) - qIndex(b.quality)));

        // Blogger default = most stable; expose it as a virtual "Auto" server first
        if (epData.defaultStreamingUrl) {
          allServers.unshift({ title: 'Auto', serverId: null, quality: 'Auto', url: epData.defaultStreamingUrl, filehost: false });
        }
        setServers(allServers);

        // 6) Play the first (most reliable) server.
        let played = false;
        for (let i = 0; i < allServers.length; i++) {
          const srv = allServers[i];
          try {
            const url = srv.url || (await getSamehadakuServerUrl(srv.serverId))?.url;
            if (url) { setActiveServerIdx(i); setEmbedUrl(url); played = true; break; }
          } catch { /* try next */ }
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
      const srv = servers[idx];
      const url = srv.url || (await getSamehadakuServerUrl(srv.serverId))?.url;
      if (url) {
        setEmbedUrl(url);
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

  // Silent auto-retry: if something errored, quietly cycle to another source
  // (up to a few times) instead of surfacing a failure to the user.
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (!error || servers.length === 0) return;
    if (retryCountRef.current >= servers.length) return;
    const t = setTimeout(() => {
      retryCountRef.current += 1;
      setError(null);
      switchServer(retryCountRef.current % servers.length);
    }, 1500);
    return () => clearTimeout(t);
  }, [error, servers.length, switchServer]);
  useEffect(() => { retryCountRef.current = 0; }, [samehadakuId, episode]);

  // A loading overlay we keep showing instead of any error — feels like a
  // buffering player (YouTube-style) rather than a hard failure. Auto-retry
  // keeps trying other sources silently in the background.
  const LoadingState = () => (
    <div className="anime-embed-container">
      <div className="embed-player-wrap subindo-loading-wrap">
        <div className="subindo-spinner" />
        <p>Menyiapkan video…</p>
      </div>
    </div>
  );

  if (!animeTitle) return <LoadingState />;
  if (loading) return <LoadingState />;
  // On any error, show loading instead of a failure screen (silent retry via effect).
  if (error || !embedUrl) return <LoadingState />;

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
