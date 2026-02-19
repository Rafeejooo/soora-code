import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import { useMiniPlayer } from '../context/MiniPlayerContext';

/**
 * MiniPlayer — YouTube-style floating mini player (bottom-right).
 * Plays HLS anime streams. For movies (VidKing/iframe) we don't support mini.
 */
export default function MiniPlayer() {
  const { miniPlayer, closeMini, updateTime } = useMiniPlayer();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState({ x: null, y: null });
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const proxyUrl = useCallback(
    (url) => {
      const ref = miniPlayer?.referer || '';
      const streamBase = import.meta.env.VITE_STREAM_URL;
      const base = streamBase ? `${streamBase}/proxy` : '/api/proxy';
      const baseParam = streamBase ? `&base=${encodeURIComponent(base)}` : '';
      return `${base}?url=${encodeURIComponent(url)}${ref ? `&referer=${encodeURIComponent(ref)}` : ''}${baseParam}`;
    },
    [miniPlayer?.referer]
  );

  // Setup HLS when miniPlayer opens
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !miniPlayer?.src) return;

    const streamUrl = proxyUrl(miniPlayer.src);

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const isDirectVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(miniPlayer.src);

    if (!isDirectVideo && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, startLevel: -1 });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (miniPlayer.currentTime > 0) {
          video.currentTime = miniPlayer.currentTime;
        }
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { hls.destroy(); closeMini(); }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        if (miniPlayer.currentTime > 0) video.currentTime = miniPlayer.currentTime;
        video.play().catch(() => {});
      }, { once: true });
    } else {
      video.src = miniPlayer.src.startsWith('http') ? proxyUrl(miniPlayer.src) : miniPlayer.src;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [miniPlayer?.src]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !miniPlayer) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      updateTime(video.currentTime);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
    };
  }, [miniPlayer, updateTime]);

  // Drag handlers
  const handleDragStart = (e) => {
    if (e.target.closest('button') || e.target.closest('.mini-progress')) return;
    setDragging(true);
    const container = e.currentTarget.closest('.mini-player');
    const rect = container.getBoundingClientRect();
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: dragPos.x ?? (window.innerWidth - rect.right),
      oy: dragPos.y ?? (window.innerHeight - rect.bottom),
    };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = dragStart.current.x - e.clientX;
      const dy = dragStart.current.y - e.clientY;
      setDragPos({
        x: Math.max(0, dragStart.current.ox + dx),
        y: Math.max(0, dragStart.current.oy + dy),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  };

  const handleExpand = () => {
    // Navigate back to the watch page, keeping current time
    if (!miniPlayer) return;
    const video = videoRef.current;
    const time = video ? video.currentTime : miniPlayer.currentTime || 0;
    const url = miniPlayer.watchUrl;
    closeMini();
    navigate(url, { state: { resumeTime: time } });
  };

  const handleClose = () => {
    closeMini();
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  };

  const handleProgressClick = (e) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
  };

  if (!miniPlayer) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`mini-player ${dragging ? 'dragging' : ''}`}
      style={{
        right: dragPos.x != null ? `${dragPos.x}px` : undefined,
        bottom: dragPos.y != null ? `${dragPos.y}px` : undefined,
      }}
    >
      {/* Video */}
      <div className="mini-video-wrap" onMouseDown={handleDragStart}>
        <video
          ref={videoRef}
          playsInline
          crossOrigin="anonymous"
          className="mini-video"
        />

        {/* Overlay controls */}
        <div className="mini-overlay">
          <div className="mini-overlay-top">
            <span className="mini-title">{miniPlayer.title}</span>
            {miniPlayer.epLabel && (
              <span className="mini-ep">{miniPlayer.epLabel}</span>
            )}
          </div>

          <div className="mini-overlay-center">
            {/* Play/Pause */}
            <button className="mini-btn mini-btn-play" onClick={togglePlay}>
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <rect x="6" y="4" width="4" height="16" rx="1"/>
                  <rect x="14" y="4" width="4" height="16" rx="1"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>
          </div>

          <div className="mini-overlay-bottom">
            {/* Expand (go back to watch) */}
            <button className="mini-btn" onClick={handleExpand} title="Expand">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
              </svg>
            </button>

            {/* PiP */}
            <button className="mini-btn" onClick={togglePiP} title="Picture in Picture">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <rect x="11" y="9" width="9" height="7" rx="1" fill="currentColor" opacity="0.3"/>
              </svg>
            </button>

            {/* Close */}
            <button className="mini-btn" onClick={handleClose} title="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mini-progress" onClick={handleProgressClick}>
        <div className="mini-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  );
}
