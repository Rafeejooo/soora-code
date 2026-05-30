import { useState, useEffect, useRef, useCallback } from 'react';
import { findSamehadakuAnime, getSamehadakuAnimeInfo, getSubIndoPlay } from '../api';

/**
 * SubIndoPlayer — Indonesian-subbed anime player.
 * The backend (/anime/subindo/play) resolves and VALIDATES sources, returning
 * only links that actually play. We never surface a hard failure — while
 * sources resolve (or if none are live) we show a buffering-style loading state.
 */

const QORDER = ['1080p', '720p', '480p', '360p', 'Auto'];
const qi = (q) => { const i = QORDER.indexOf(q); return i === -1 ? 99 : i; };

export default function SubIndoPlayer({ animeTitle, japaneseTitle, episode = 1, samehadakuId = null }) {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);     // [{ quality, url }]
  const [activeIdx, setActiveIdx] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const run = async () => {
      setLoading(true);
      setSources([]);
      setActiveIdx(0);
      try {
        // 1) resolve anime id
        let animeId = samehadakuId;
        if (!animeId) {
          const match = await findSamehadakuAnime(animeTitle, japaneseTitle);
          animeId = match?.animeId;
        }
        if (!animeId) { if (!cancelledRef.current) setLoading(false); return; }

        // 2) episode list → pick the matching episode id
        const info = await getSamehadakuAnimeInfo(animeId);
        const list = info?.episodeList || [];
        if (!list.length) { if (!cancelledRef.current) setLoading(false); return; }
        const target = list.find((e) => {
          const n = parseInt(String(e.episodeId).match(/episode-(\d+)/)?.[1]);
          return Number.isFinite(n) && n === episode;
        }) || list[list.length - 1];

        // 3) validated, ready-to-play sources from the backend
        const play = await getSubIndoPlay(target.episodeId);
        if (cancelledRef.current) return;
        const srcs = (play.sources || []).slice().sort((a, b) => qi(a.quality) - qi(b.quality));
        setSources(srcs);
        setActiveIdx(0);
      } catch { /* leave empty → loading state */ }
      finally { if (!cancelledRef.current) setLoading(false); }
    };
    run();
    return () => { cancelledRef.current = true; };
  }, [animeTitle, japaneseTitle, episode, samehadakuId]);

  const active = sources[activeIdx];
  const qualities = sources.map((s) => s.quality);

  const LoadingState = () => (
    <div className="anime-embed-container">
      <div className="embed-player-wrap subindo-loading-wrap">
        <div className="subindo-spinner" />
        <p>Menyiapkan video…</p>
      </div>
    </div>
  );

  if (loading) return <LoadingState />;
  // No verified source → buffering state (never a hard error)
  if (!active) return <LoadingState />;

  return (
    <div className="anime-embed-container">
      {qualities.length > 1 && (
        <div className="subindo-quality-bar">
          <span className="subindo-quality-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H4z"/><path d="M2 20h20"/></svg>
            Kualitas
          </span>
          {sources.map((s, i) => (
            <button
              key={s.quality}
              className={`subindo-quality-pill ${i === activeIdx ? 'active' : ''}`}
              onClick={() => { setActiveIdx(i); setIframeKey((k) => k + 1); }}
            >
              {s.quality}
              {qi(s.quality) <= 1 && <span className="subindo-hd-badge">HD</span>}
            </button>
          ))}
        </div>
      )}
      <div className="embed-player-wrap">
        <iframe
          key={iframeKey}
          src={active.url}
          frameBorder="0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Player"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
