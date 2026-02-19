import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import Hls from 'hls.js';

/**
 * VideoPlayer - Netflix-style HLS player with custom controls
 * Custom overlay: play/pause, seek, volume, brightness, resolution, PiP, fullscreen
 */
const VideoPlayer = forwardRef(function VideoPlayer(
  { src, subtitles = [], referer = '', initialTime = 0, onError, onLevelsLoaded, onLevelSwitched, onMinimize },
  ref
) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const progressRef = useRef(null);
  const hideTimer = useRef(null);
  const volumeBeforeMute = useRef(1);
  const mediaErrorRecoveries = useRef(0); // track HLS media error recovery attempts
  const networkRetries = useRef(0); // track HLS network error retries
  const clickTimer = useRef(null); // debounce click vs double-click
  const isTouchDevice = useRef(false); // detect touch vs mouse

  const [hlsLevels, setHlsLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [selectedLevel, setSelectedLevel] = useState(-1);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('main'); // 'main' | 'quality' | 'brightness' | 'subtitles'
  const [seeking, setSeeking] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState(-1); // -1 = off, index = active track

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
    getHls: () => hlsRef.current,
    getCurrentTime: () => videoRef.current?.currentTime || 0,
    setLevel: (levelIndex) => {
      if (hlsRef.current) {
        hlsRef.current.currentLevel = levelIndex;
        setSelectedLevel(levelIndex);
      }
    },
  }));

  const proxyUrl = useCallback(
    (url) => {
      const streamBase = import.meta.env.VITE_STREAM_URL;
      // If VITE_STREAM_URL is set (e.g. https://stream.soora.fun), use it directly
      // Otherwise fall back to /api/proxy (proxied via Vercel rewrite)
      const base = streamBase ? `${streamBase}/proxy` : '/api/proxy';
      const baseParam = streamBase ? `&base=${encodeURIComponent(base)}` : '';
      return `${base}?url=${encodeURIComponent(url)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}${baseParam}`;
    },
    [referer]
  );

  // ===== HLS SETUP =====
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const streamUrl = proxyUrl(src);

    // Fully tear down previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Reset video element to clear stale MediaSource buffers (prevents bufferAddCodecError)
    video.removeAttribute('src');
    video.load();

    setHlsLevels([]);
    setCurrentLevel(-1);
    setSelectedLevel(-1);
    mediaErrorRecoveries.current = 0; // reset recovery counter for new source
    networkRetries.current = 0;

    const isDirectVideo = /\.(mp4|webm|ogg|avi|mkv)(\?|$)/i.test(src);

    // Helper: fall back to native <video> when HLS.js fails (codec issues etc.)
    const tryNativePlayback = () => {
      console.info('[VideoPlayer] HLS.js failed — trying native <video> playback');
      video.src = streamUrl;
      // Wait briefly for the browser to probe the source
      const onCanPlay = () => {
        video.removeEventListener('error', onNativeError);
        if (initialTime > 0) video.currentTime = initialTime;
        video.play().catch(() => {});
      };
      const onNativeError = () => {
        video.removeEventListener('canplay', onCanPlay);
        console.error('[VideoPlayer] Native playback also failed');
        onError?.('Stream codec error — try embed player');
      };
      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('error', onNativeError, { once: true });
    };

    if (!isDirectVideo && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
        enableWorker: true,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels.map((lv, idx) => ({
          index: idx,
          height: lv.height,
          width: lv.width,
          bitrate: lv.bitrate,
          label: lv.height ? `${lv.height}p` : `${Math.round(lv.bitrate / 1000)}kbps`,
        }));
        levels.sort((a, b) => (b.height || 0) - (a.height || 0));
        setHlsLevels(levels);
        onLevelsLoaded?.(levels);
        if (initialTime > 0) video.currentTime = initialTime;
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
        onLevelSwitched?.(data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data.type, data.details);

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            networkRetries.current += 1;
            if (networkRetries.current <= 3) {
              // Retry loading (max 3 attempts)
              console.warn(`HLS network error retry ${networkRetries.current}/3`);
              hls.startLoad();
            } else {
              console.error('HLS network error: giving up after 3 retries');
              hls.destroy();
              hlsRef.current = null;
              tryNativePlayback();
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrorRecoveries.current += 1;
            if (mediaErrorRecoveries.current === 1) {
              // First attempt: simple recovery
              console.warn('HLS media error recovery attempt 1');
              hls.recoverMediaError();
            } else if (mediaErrorRecoveries.current === 2) {
              // Second attempt: swap audio codec and recover
              console.warn('HLS media error recovery attempt 2 (swap audio codec)');
              hls.swapAudioCodec();
              hls.recoverMediaError();
            } else {
              // Give up on HLS.js — try native <video> as last resort
              console.error('HLS media error: giving up after', mediaErrorRecoveries.current, 'attempts');
              hls.destroy();
              hlsRef.current = null;
              tryNativePlayback();
            }
          } else {
            hls.destroy();
            hlsRef.current = null;
            tryNativePlayback();
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => video.play().catch(() => {}));
    } else {
      video.src = src.startsWith('http') ? proxyUrl(src) : src;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      // Clear video src to prevent stale buffer errors on re-mount
      if (video) { video.removeAttribute('src'); video.load(); }
      if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    };
  }, [src, referer, proxyUrl, onError]);

  // ===== VIDEO EVENT LISTENERS =====
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      if (!seeking) setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onEnd = () => setPlaying(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('ended', onEnd);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('ended', onEnd);
    };
  }, [seeking]);

  // ===== FULLSCREEN LISTENER =====
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ===== AUTO-HIDE CONTROLS =====
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing && !showSettings) setShowControls(false);
    }, 3000);
  }, [playing, showSettings]);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [playing, showSettings]);

  // ===== KEYBOARD SHORTCUTS =====
  useEffect(() => {
    const handleKey = (e) => {
      const video = videoRef.current;
      if (!video) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          resetHideTimer();
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.currentTime + 10, video.duration);
          resetHideTimer();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(video.currentTime - 10, 0);
          resetHideTimer();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => { const nv = Math.min(v + 0.1, 1); video.volume = nv; return nv; });
          resetHideTimer();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => { const nv = Math.max(v - 0.1, 0); video.volume = nv; return nv; });
          resetHideTimer();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'Escape':
          setShowSettings(false);
          break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [resetHideTimer]);

  // ===== CONTROL ACTIONS =====
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
    resetHideTimer();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (muted) {
      video.muted = false;
      video.volume = volumeBeforeMute.current;
      setVolume(volumeBeforeMute.current);
      setMuted(false);
    } else {
      volumeBeforeMute.current = volume;
      video.muted = true;
      setMuted(true);
    }
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) { video.volume = v; video.muted = v === 0; }
    setVolume(v);
    setMuted(v === 0);
  };

  const handleBrightness = (val) => {
    setBrightness(val);
  };

  // ===== SUBTITLE MANAGEMENT =====
  const selectSubtitle = (index) => {
    const video = videoRef.current;
    if (!video) return;
    const tracks = video.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = i === index ? 'showing' : 'hidden';
    }
    setActiveSubtitle(index);
  };

  // Initialize subtitles off by default, then enable first English if available
  useEffect(() => {
    const video = videoRef.current;
    if (!video || validSubs.length === 0) return;
    const checkTracks = () => {
      const tracks = video.textTracks;
      if (tracks.length === 0) return;
      // Find English subtitle or default to first
      let defaultIdx = -1;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'hidden';
        if (defaultIdx === -1 && (tracks[i].label?.toLowerCase().includes('english') || tracks[i].language === 'en')) {
          defaultIdx = i;
        }
      }
      if (defaultIdx >= 0) {
        tracks[defaultIdx].mode = 'showing';
        setActiveSubtitle(defaultIdx);
      }
    };
    // textTracks may load async
    if (video.textTracks.length > 0) checkTracks();
    else video.textTracks.addEventListener('addtrack', checkTracks, { once: true });
    return () => video.textTracks.removeEventListener('addtrack', checkTracks);
  }, [src, subtitles.length]);

  const handleSeekStart = () => setSeeking(true);
  const handleSeek = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentTime(pct * duration);
  };
  const handleSeekEnd = (e) => {
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const video = videoRef.current;
    if (video) video.currentTime = pct * duration;
    setSeeking(false);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
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

  const selectQuality = (index) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setSelectedLevel(index);
    }
    setShowSettings(false);
    setSettingsTab('main');
  };

  const skip = (sec) => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, Math.min(video.currentTime + sec, video.duration));
    resetHideTimer();
  };

  // ===== FORMAT TIME =====
  const fmt = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const qualityLabel = selectedLevel === -1
    ? 'Auto' + (currentLevel >= 0 ? ` (${hlsLevels.find((l) => l.index === currentLevel)?.label || ''})` : '')
    : hlsLevels.find((l) => l.index === selectedLevel)?.label || 'Auto';

  const validSubs = subtitles.filter(
    (s) => s.lang && !s.lang.toLowerCase().includes('thumbnail')
  );

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`nf-player ${showControls ? 'show-controls' : ''} ${isFullscreen ? 'nf-fullscreen' : ''}`}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
      onTouchStart={() => { isTouchDevice.current = true; }}
      onClick={(e) => {
        if (e.target !== containerRef.current && e.target !== videoRef.current) return;
        if (showSettings) { setShowSettings(false); return; }

        if (isTouchDevice.current) {
          // Mobile: single tap = show/hide controls, double tap = play/pause
          if (clickTimer.current) {
            clearTimeout(clickTimer.current);
            clickTimer.current = null;
            togglePlay();
          } else {
            clickTimer.current = setTimeout(() => {
              clickTimer.current = null;
              // Single tap — just toggle controls visibility
              setShowControls((v) => !v);
              if (!showControls) resetHideTimer();
            }, 300);
          }
        } else {
          // Desktop: single click = play/pause (debounced to not conflict with dblclick)
          if (clickTimer.current) {
            clearTimeout(clickTimer.current);
            clickTimer.current = null;
            // second click within window → treat as dblclick
            toggleFullscreen();
          } else {
            clickTimer.current = setTimeout(() => {
              clickTimer.current = null;
              togglePlay();
            }, 250);
          }
        }
      }}
    >
      {/* Wrapper div for brightness — filter on parent reliably affects GPU-composited video */}
      <div className="nf-video-wrap" style={{ width: '100%', height: '100%', filter: brightness !== 100 ? `brightness(${brightness / 100})` : 'none' }}>
        <video
          ref={videoRef}
          playsInline
          crossOrigin="anonymous"
          className="nf-video"
        >
          {validSubs.map((sub, i) => (
            <track
              key={i}
              kind="subtitles"
              src={sub.url ? proxyUrl(sub.url) : ''}
              srcLang={sub.lang?.slice(0, 2)?.toLowerCase() || 'en'}
              label={sub.lang || `Subtitle ${i + 1}`}
            />
          ))}
        </video>
      </div>

      {/* Center play button (when paused) */}
      {!playing && (
        <button className="nf-center-play" onClick={togglePlay}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      )}

      {/* Skip backward/forward indicators (keyboard) */}

      {/* ===== BOTTOM CONTROLS ===== */}
      <div className="nf-controls">
        {/* Progress bar */}
        <div
          className="nf-progress-wrap"
          ref={progressRef}
          onMouseDown={(e) => { handleSeekStart(); handleSeek(e); }}
          onMouseMove={(e) => { if (seeking) handleSeek(e); }}
          onMouseUp={handleSeekEnd}
          onMouseLeave={() => { if (seeking) handleSeekEnd({ clientX: 0 }); }}
        >
          <div className="nf-progress-bar">
            <div className="nf-progress-buffered" style={{ width: `${bufferedPct}%` }} />
            <div className="nf-progress-filled" style={{ width: `${progressPct}%` }}>
              <div className="nf-progress-thumb" />
            </div>
          </div>
        </div>

        {/* Control buttons row */}
        <div className="nf-controls-row">
          <div className="nf-controls-left">
            {/* Play/Pause */}
            <button className="nf-btn" onClick={togglePlay} title={playing ? 'Pause (k)' : 'Play (k)'}>
              {playing ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>

            {/* Skip back 10s */}
            <button className="nf-btn" onClick={() => skip(-10)} title="Back 10s">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M12.5 8L9 12l3.5 4"/>
                <path d="M21 12a9 9 0 1 1-9-9"/>
              </svg>
            </button>

            {/* Skip forward 10s */}
            <button className="nf-btn" onClick={() => skip(10)} title="Forward 10s">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M11.5 8L15 12l-3.5 4"/>
                <path d="M3 12a9 9 0 1 0 9-9"/>
              </svg>
            </button>

            {/* Volume */}
            <div className="nf-volume-group">
              <button className="nf-btn" onClick={toggleMute} title={muted ? 'Unmute (m)' : 'Mute (m)'}>
                {muted || volume === 0 ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/></svg>
                ) : volume < 0.5 ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="nf-volume-slider"
              />
            </div>

            {/* Time */}
            <span className="nf-time">{fmt(currentTime)} / {fmt(duration)}</span>
          </div>

          <div className="nf-controls-right">
            {/* Settings (Quality + Brightness) */}
            <button
              className="nf-btn"
              onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setSettingsTab('main'); }}
              title="Settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            </button>

            {/* Minimize (YouTube-style mini player) */}
            {onMinimize && (
              <button className="nf-btn" onClick={onMinimize} title="Minimize">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/>
                </svg>
              </button>
            )}

            {/* PiP */}
            <button className="nf-btn" onClick={togglePiP} title="Picture in Picture">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <rect x="2" y="3" width="20" height="14" rx="2"/><rect x="11" y="9" width="9" height="7" rx="1" fill="currentColor" opacity="0.3"/>
              </svg>
            </button>

            {/* Fullscreen */}
            <button className="nf-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen (f)' : 'Fullscreen (f)'}>
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ===== SETTINGS PANEL ===== */}
      {showSettings && (
        <div className="nf-settings" onClick={(e) => e.stopPropagation()}>
          {settingsTab === 'main' && (
            <>
              <div className="nf-settings-header">Settings</div>
              {hlsLevels.length > 1 && (
                <button className="nf-settings-item" onClick={() => setSettingsTab('quality')}>
                  <span>Quality</span>
                  <span className="nf-settings-value">{qualityLabel}</span>
                </button>
              )}
              <button className="nf-settings-item" onClick={() => setSettingsTab('subtitles')}>
                <span>Subtitles</span>
                <span className="nf-settings-value">
                  {validSubs.length === 0 ? 'None' : activeSubtitle === -1 ? 'Off' : (validSubs[activeSubtitle]?.lang || `Track ${activeSubtitle + 1}`)}
                </span>
              </button>
              <button className="nf-settings-item" onClick={() => setSettingsTab('brightness')}>
                <span>Brightness</span>
                <span className="nf-settings-value">{brightness}%</span>
              </button>
            </>
          )}

          {settingsTab === 'quality' && (
            <>
              <button className="nf-settings-back" onClick={() => setSettingsTab('main')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m15 18-6-6 6-6"/></svg>
                Quality
              </button>
              <button
                className={`nf-settings-item ${selectedLevel === -1 ? 'active' : ''}`}
                onClick={() => selectQuality(-1)}
              >
                <span>Auto{currentLevel >= 0 && selectedLevel === -1 ? ` (${hlsLevels.find(l => l.index === currentLevel)?.label || ''})` : ''}</span>
                {selectedLevel === -1 && <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
              </button>
              {hlsLevels.map((lv) => (
                <button
                  key={lv.index}
                  className={`nf-settings-item ${selectedLevel === lv.index ? 'active' : ''}`}
                  onClick={() => selectQuality(lv.index)}
                >
                  <span>{lv.label}{lv.height >= 1080 ? ' HD' : ''}</span>
                  {selectedLevel === lv.index && <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                </button>
              ))}
            </>
          )}

          {settingsTab === 'subtitles' && (
            <>
              <button className="nf-settings-back" onClick={() => setSettingsTab('main')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m15 18-6-6 6-6"/></svg>
                Subtitles
              </button>
              {validSubs.length === 0 ? (
                <div className="nf-settings-item" style={{ opacity: 0.5, cursor: 'default' }}>
                  <span>No subtitles available for this content</span>
                </div>
              ) : (
                <>
                  <button
                    className={`nf-settings-item ${activeSubtitle === -1 ? 'active' : ''}`}
                    onClick={() => { selectSubtitle(-1); setShowSettings(false); }}
                  >
                    <span>Off</span>
                    {activeSubtitle === -1 && <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                  </button>
                  {validSubs.map((sub, i) => (
                    <button
                      key={i}
                      className={`nf-settings-item ${activeSubtitle === i ? 'active' : ''}`}
                      onClick={() => { selectSubtitle(i); setShowSettings(false); }}
                    >
                      <span>{sub.lang || `Subtitle ${i + 1}`}</span>
                      {activeSubtitle === i && <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                    </button>
                  ))}
                </>
              )}
            </>
          )}

          {settingsTab === 'brightness' && (
            <>
              <button className="nf-settings-back" onClick={() => setSettingsTab('main')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m15 18-6-6 6-6"/></svg>
                Brightness
              </button>
              <div className="nf-brightness-control">
                <input
                  type="range"
                  min="30"
                  max="150"
                  value={brightness}
                  onChange={(e) => handleBrightness(parseInt(e.target.value))}
                  className="nf-brightness-slider"
                />
                <span className="nf-brightness-val">{brightness}%</span>
              </div>
              <div className="nf-brightness-presets">
                {[50, 75, 100, 125, 150].map((v) => (
                  <button
                    key={v}
                    className={`nf-brightness-preset ${brightness === v ? 'active' : ''}`}
                    onClick={() => handleBrightness(v)}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default VideoPlayer;
