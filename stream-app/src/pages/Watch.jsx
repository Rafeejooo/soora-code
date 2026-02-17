import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import AnimeEmbedPlayer from '../components/AnimeEmbedPlayer';
import MovieEmbedPlayer from '../components/MovieEmbedPlayer';
import SubIndoPlayer from '../components/SubIndoPlayer';
import { useMiniPlayer } from '../context/MiniPlayerContext';
import {
  watchAnimeEpisode,
  getAnimeInfo,
  getHiAnimeInfo,
  fetchAnimeIds,
  getAnimeSpotlight,
  getMovieDetailsTMDB,
  getTVDetailsTMDB,
  getTVSeasonTMDB,
  getMovieStreamingSources,
  getTVStreamingSources,
  getGokuInfo,
  getGokuMovieStream,
  getGokuTVStream,
  findTMDBDetailsByTitle,
  tmdbImg,
  tmdbBackdrop,
  hasTMDBKey,
} from '../api';
import Card from '../components/Card';
import Loading from '../components/Loading';

export default function Watch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { miniPlayer, openMini, closeMini } = useMiniPlayer();

  // Close mini player when Watch page mounts (avoid two streams)
  useEffect(() => {
    if (miniPlayer) closeMini();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume time from mini player expand
  const resumeTime = useRef(location.state?.resumeTime || 0);

  const isAnime = location.pathname.includes('/watch/anime');
  const isMovie = location.pathname.includes('/watch/movie');

  // Common
  const title = searchParams.get('title') || 'Now Playing';

  // Movie / TV params (TMDB or Goku)
  const tmdbId = searchParams.get('tmdbId');
  const gokuId = searchParams.get('gokuId');
  const mediaType = searchParams.get('type') || 'movie';
  const season = parseInt(searchParams.get('season')) || 1;
  const episode = parseInt(searchParams.get('episode')) || 1;

  // Anime params
  const episodeId = searchParams.get('episodeId');
  const epNum = searchParams.get('ep') || '';
  const animeId = searchParams.get('animeId');

  // Anime HLS state
  const [sources, setSources] = useState([]);
  const [subtitles, setSubtitles] = useState([]);
  const [referer, setReferer] = useState('');
  const [currentSource, setCurrentSource] = useState(null);

  // Shared state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Content data
  const [movieDetails, setMovieDetails] = useState(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [animeInfo, setAnimeInfo] = useState(null);
  const [animeEpisodes, setAnimeEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(season);

  // Anime HLS quality state
  const [animeHlsLevels, setAnimeHlsLevels] = useState([]);
  const [animeSelectedLevel, setAnimeSelectedLevel] = useState(-1);
  const [animeCurrentLevel, setAnimeCurrentLevel] = useState(-1);
  const [animeRecs, setAnimeRecs] = useState([]);

  // Episode range / search state
  const [epActiveRange, setEpActiveRange] = useState(0);
  const [epSearch, setEpSearch] = useState('');

  // Embed fallback state (when consumet extractors fail)
  const [malId, setMalId] = useState(null);
  const [alId, setAlId] = useState(null);
  const [useEmbedPlayer, setUseEmbedPlayer] = useState(false);
  const [useSubIndo, setUseSubIndo] = useState(false);
  const [subLang, setSubLang] = useState(null); // null = direct, 'id' | 'en' | 'multi'
  const [retryKey, setRetryKey] = useState(0); // bump to re-trigger data fetch

  const playerRef = useRef(null);
  const lastWorkingSource = useRef(null); // track last source that played successfully
  const userForcedDirect = useRef(false); // true when user explicitly clicks Direct pill

  // Normalize TMDB results for <Card>
  const normRec = (r) => ({
    id: r.id,
    tmdbId: r.id,
    title: r.title || r.name,
    image: tmdbImg(r.poster_path),
    releaseDate: r.release_date || r.first_air_date,
    rating: r.vote_average ? Math.round(r.vote_average * 10) : null,
    type: r.media_type === 'tv' || r.first_air_date ? 'TV Series' : 'Movie',
    mediaType: r.media_type || (r.first_air_date ? 'tv' : 'movie'),
  });

  // ===== FETCH MOVIE / TV DATA =====
  useEffect(() => {
    if (!isMovie || (!tmdbId && !gokuId)) return;
    const fetchMovieData = async () => {
      setLoading(true);
      setError(null);
      setSources([]);
      setSubtitles([]);
      setReferer('');
      setCurrentSource(null);
      try {
        let details;

        // ── Goku direct flow (from Goku listings) ──
        if (gokuId) {
          const gokuRes = await getGokuInfo(gokuId);
          const gInfo = gokuRes.data;
          details = {
            title: gInfo.title,
            name: gInfo.title,
            overview: gInfo.description || '',
            poster_path: null,
            backdrop_path: null,
            _gokuImage: gInfo.image || '',
            genres: (gInfo.genres || []).map((g, i) => ({ id: i, name: g })),
            release_date: gInfo.releaseDate || '',
            runtime: parseInt(gInfo.duration) || 0,
            casts: gInfo.casts || [],
            _isGoku: true,
          };
          // For Goku TV, build season episodes from Goku episodes
          if (mediaType === 'tv' && gInfo.episodes) {
            const eps = gInfo.episodes.filter((e) => e.season === selectedSeason);
            setSeasonEpisodes(
              eps.map((e) => ({
                episode_number: e.number,
                name: e.title || `Episode ${e.number}`,
                id: e.id,
              }))
            );
          }
          setMovieDetails(details);

          // Enrich with TMDB data (recommendations, similar, cast photos, backdrop)
          if (hasTMDBKey() && gInfo.title) {
            try {
              const tmdbRes = await findTMDBDetailsByTitle(gInfo.title, mediaType);
              const td = tmdbRes.data;
              if (td) {
                // Merge TMDB enrichment into details
                setMovieDetails((prev) => ({
                  ...prev,
                  vote_average: td.vote_average || prev.vote_average,
                  tagline: td.tagline || '',
                  overview: td.overview || prev.overview,
                  poster_path: td.poster_path,
                  backdrop_path: td.backdrop_path,
                  genres: td.genres || prev.genres,
                  credits: td.credits,
                }));
                setRecommendations(
                  (td.recommendations?.results || []).slice(0, 12).map(normRec)
                );
                setSimilar(
                  (td.similar?.results || []).slice(0, 12).map(normRec)
                );
              } else {
                setRecommendations([]);
                setSimilar([]);
              }
            } catch {
              setRecommendations([]);
              setSimilar([]);
            }
          } else {
            setRecommendations([]);
            setSimilar([]);
          }

          // Stream directly from Goku (skip search)
          try {
            let streamData;
            if (mediaType === 'tv') {
              streamData = await getGokuTVStream(gokuId, season, episode);
            } else {
              streamData = await getGokuMovieStream(gokuId);
            }
            const srcs = streamData.data?.sources || [];
            setSources(srcs);
            setSubtitles(streamData.data?.subtitles || []);
            setReferer(streamData.data?.headers?.Referer || streamData.data?.headers?.referer || '');
            const auto = srcs.find((s) => s.quality === 'auto' || s.quality === 'default');
            const hd = srcs.find((s) => ['1080p', '1080'].includes(s.quality));
            const med = srcs.find((s) => ['720p', '720'].includes(s.quality));
            setCurrentSource(auto || hd || med || srcs[0] || null);
            if (srcs.length === 0) setError('No streaming sources found.');
          } catch (streamErr) {
            console.warn('Goku streaming failed:', streamErr);
            setError('Stream unavailable — sources could not be loaded.');
          }
        }
        // ── TMDB flow (backward compatibility) ──
        else if (tmdbId) {
          if (mediaType === 'tv') {
            const [tvRes, seasonRes] = await Promise.all([
              getTVDetailsTMDB(tmdbId),
              getTVSeasonTMDB(tmdbId, selectedSeason),
            ]);
            details = tvRes.data;
            setSeasonEpisodes(seasonRes.data.episodes || []);
          } else {
            const res = await getMovieDetailsTMDB(tmdbId);
            details = res.data;
          }
          setMovieDetails(details);
          setRecommendations(
            (details.recommendations?.results || []).slice(0, 12).map(normRec)
          );
          setSimilar(
            (details.similar?.results || []).slice(0, 12).map(normRec)
          );

          // Fetch streaming sources (Goku → FlixHQ fallback via title search)
          const movieTitle = details.title || details.name || title;
          const year = (details.release_date || details.first_air_date || '').slice(0, 4);
          try {
            let streamData;
            if (mediaType === 'tv') {
              streamData = await getTVStreamingSources(movieTitle, tmdbId, season, episode, year);
            } else {
              streamData = await getMovieStreamingSources(movieTitle, tmdbId, year);
            }
            const srcs = streamData.data?.sources || [];
            setSources(srcs);
            setSubtitles(streamData.data?.subtitles || []);
            setReferer(streamData.data?.headers?.Referer || streamData.data?.headers?.referer || '');
            const auto = srcs.find((s) => s.quality === 'auto' || s.quality === 'default');
            const hd = srcs.find((s) => ['1080p', '1080'].includes(s.quality));
            const med = srcs.find((s) => ['720p', '720'].includes(s.quality));
            setCurrentSource(auto || hd || med || srcs[0] || null);
            if (srcs.length === 0) setError('No streaming sources found.');
          } catch (streamErr) {
            console.warn('Movie streaming fetch failed:', streamErr);
            setError('Stream unavailable — sources could not be loaded.');
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMovieData();
  }, [tmdbId, gokuId, mediaType, selectedSeason, isMovie, season, episode, retryKey]);

  // Fetch new season episodes when tab changes (without full reload)
  useEffect(() => {
    if (!isMovie || mediaType !== 'tv' || loading) return;
    if (selectedSeason === season) return; // already loaded

    const fetchSeason = async () => {
      try {
        if (gokuId) {
          // For Goku, refetch info and filter episodes by season
          const gokuRes = await getGokuInfo(gokuId);
          const eps = (gokuRes.data.episodes || []).filter((e) => e.season === selectedSeason);
          setSeasonEpisodes(
            eps.map((e) => ({
              episode_number: e.number,
              name: e.title || `Episode ${e.number}`,
              id: e.id,
            }))
          );
        } else if (tmdbId) {
          const res = await getTVSeasonTMDB(tmdbId, selectedSeason);
          setSeasonEpisodes(res.data.episodes || []);
        }
      } catch {
        // silently fail
      }
    };
    fetchSeason();
  }, [selectedSeason]);

  // ===== FETCH ANIME DATA =====
  useEffect(() => {
    if (!isAnime || !episodeId) return;
    const fetchAnimeData = async () => {
      setLoading(true);
      setError(null);
      setUseEmbedPlayer(false);
      userForcedDirect.current = false; // reset on episode change
      setAnimeHlsLevels([]);
      setAnimeSelectedLevel(-1);
      setAnimeCurrentLevel(-1);
      // Clear previous stream to avoid stale buffer / codec errors on source switch
      setCurrentSource(null);
      lastWorkingSource.current = null;
      setSources([]);
      setSubtitles([]);
      setReferer('');

      // Track IDs locally since setState is async
      let gotMalId = malId;
      let gotAlId = alId;

      try {
        // Fetch info (AnimeKai + HiAnime in parallel for malId/alId)
        if (animeId) {
          const [ankaiResult, hianimeResult] = await Promise.allSettled([
            getAnimeInfo(animeId),
            getHiAnimeInfo(animeId),
          ]);

          // Extract malId/alId from HiAnime (always try)
          if (hianimeResult.status === 'fulfilled') {
            const hiInfo = hianimeResult.value.data;
            if (hiInfo.malID) { setMalId(hiInfo.malID); gotMalId = hiInfo.malID; }
            if (hiInfo.alID) { setAlId(hiInfo.alID); gotAlId = hiInfo.alID; }
          }

          // If HiAnime didn't give us IDs, try AnimeKai info fields
          const ankaiInfo = ankaiResult.status === 'fulfilled' ? ankaiResult.value.data : null;
          if (!gotMalId && ankaiInfo?.malID) { setMalId(ankaiInfo.malID); gotMalId = ankaiInfo.malID; }
          if (!gotAlId && ankaiInfo?.alID) { setAlId(ankaiInfo.alID); gotAlId = ankaiInfo.alID; }

          // Still no IDs? Try fetchAnimeIds (HiAnime search + Jikan fallback)
          if (!gotMalId && !gotAlId) {
            const animeTitle = ankaiInfo?.title || title;
            try {
              const ids = await fetchAnimeIds(animeId, animeTitle);
              if (ids.malId) { setMalId(ids.malId); gotMalId = ids.malId; }
              if (ids.alId) { setAlId(ids.alId); gotAlId = ids.alId; }
            } catch { /* continue without IDs */ }
          }

          // Use AnimeKai info if valid, otherwise HiAnime
          const hiInfo = hianimeResult.status === 'fulfilled' ? hianimeResult.value.data : null;
          const hasValidAnkai = ankaiInfo?.title && (ankaiInfo.episodes?.length > 0 || ankaiInfo.totalEpisodes > 0);

          const info = hasValidAnkai ? ankaiInfo : (hiInfo || ankaiInfo);
          if (info) {
            setAnimeInfo(info);
            // Prefer AnimeKai episodes (IDs work with consumet watch), fallback to HiAnime
            const eps = (hasValidAnkai ? ankaiInfo.episodes : (hiInfo?.episodes || ankaiInfo?.episodes)) || [];
            setAnimeEpisodes(eps);

            const recs = (info.recommendations || []).slice(0, 12);
            if (recs.length > 0) {
              setAnimeRecs(recs);
            } else {
              try {
                const spot = await getAnimeSpotlight();
                setAnimeRecs((spot.data?.results || spot.data || []).slice(0, 12));
              } catch { /* ignore */ }
            }
          }
        }

        // Now try to load the stream (with auto-fallback AnimeKai → HiAnime)
        console.info('[Watch] Loading stream for:', episodeId, '| ep:', epNum, '| animeId:', animeId);
        const data = (await watchAnimeEpisode(episodeId, undefined, undefined, epNum)).data;
        const fallbackProvider = data._fallback || 'animekai';
        console.info('[Watch] Stream loaded via:', fallbackProvider, '| sources:', data.sources?.length);
        const srcs = data.sources || [];
        setSources(srcs);
        setSubtitles(data.subtitles || []);
        setReferer(data.headers?.Referer || data.headers?.referer || '');
        const auto = srcs.find((s) => s.quality === 'auto' || s.quality === 'default');
        const hd = srcs.find((s) => ['1080p', '1080'].includes(s.quality));
        const med = srcs.find((s) => ['720p', '720'].includes(s.quality));
        const picked = auto || hd || med || srcs[0] || null;
        setCurrentSource(picked);
        lastWorkingSource.current = null; // reset — will be set once playback starts
        if (srcs.length === 0) {
          setError('No playable streams found.');
          // Auto-switch to embed only when we have ZERO sources (fetch completely failed)
          if (gotMalId || gotAlId) setUseEmbedPlayer(true);
        }
      } catch (err) {
        console.error('[Watch] All anime stream providers failed:', err.message);
        setError(err.message || 'Stream unavailable');
        // Auto-switch to embed only when fetch completely fails
        if (gotMalId || gotAlId) {
          console.info('[Watch] Auto-switching to embed player (malId:', gotMalId, 'alId:', gotAlId, ')');
          setUseEmbedPlayer(true);
          if (!subLang) setSubLang('multi');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAnimeData();
  }, [episodeId, animeId, isAnime, retryKey]);

  const handlePlayerError = useCallback((msg) => {
    console.warn('Player error:', msg);

    const fallback = lastWorkingSource.current;
    lastWorkingSource.current = null; // always clear to prevent revert loops

    // Quality switch failed — revert to the DIFFERENT previous working source
    if (fallback && fallback.url !== currentSource?.url) {
      console.info('[Watch] Source failed, reverting to last working source');
      setCurrentSource(fallback);
      return;
    }

    // Current source itself can't play (codec error, network etc.).
    // Auto-switch to embed if available — UNLESS user explicitly clicked Direct.
    if (malId && !userForcedDirect.current) {
      console.info('[Watch] Stream unplayable, auto-switching to embed (malId:', malId, ')');
      setCurrentSource(null);
      setError(null);
      setUseEmbedPlayer(true);
      if (!subLang) setSubLang('multi');
      return;
    }

    // User forced Direct or no embed available — show error UI
    setError(msg);
    setCurrentSource(null);
  }, [currentSource, malId, subLang]);

  // ===== MINIMIZE HANDLER (YouTube-style) =====
  const handleMinimize = useCallback(() => {
    if (!currentSource) return;
    const time = playerRef.current?.getCurrentTime?.() || 0;
    const watchUrl = location.pathname + location.search;
    openMini({
      src: currentSource.url,
      subtitles,
      referer,
      title,
      epLabel: epNum ? `Episode ${epNum}` : '',
      currentTime: time,
      watchUrl,
      type: 'anime',
    });
    navigate('/');
  }, [currentSource, subtitles, referer, title, epNum, location, openMini, navigate]);

  // ===== MINIMIZE HANDLER FOR MOVIES =====
  const handleMinimizeMovie = useCallback(() => {
    if (!currentSource) return;
    const time = playerRef.current?.getCurrentTime?.() || 0;
    const watchUrl = location.pathname + location.search;
    openMini({
      src: currentSource.url,
      subtitles,
      referer,
      title,
      epLabel: mediaType === 'tv' ? `S${season} E${episode}` : '',
      currentTime: time,
      watchUrl,
      type: 'movie',
    });
    navigate('/movies');
  }, [currentSource, subtitles, referer, title, mediaType, season, episode, location, openMini, navigate]);

  // ===== NAVIGATION HELPERS =====
  const getAdjacentEpisode = (dir) => {
    if (isAnime && animeEpisodes.length > 0) {
      const idx = animeEpisodes.findIndex((ep) => ep.id === episodeId);
      const target = animeEpisodes[idx + dir];
      if (target) {
        return `/watch/anime?episodeId=${encodeURIComponent(target.id)}&title=${encodeURIComponent(title)}&ep=${target.number || ''}&animeId=${encodeURIComponent(animeId)}`;
      }
    }
    if (isMovie && mediaType === 'tv' && seasonEpisodes.length > 0) {
      const nextEp = episode + dir;
      const target = seasonEpisodes.find(
        (e) => e.episode_number === nextEp
      );
      if (target) {
        return `/watch/movie?tmdbId=${tmdbId}&type=tv&season=${season}&episode=${nextEp}&title=${encodeURIComponent(target.name || title)}`;
      }
    }
    return null;
  };

  const prevUrl = getAdjacentEpisode(-1);
  const nextUrl = getAdjacentEpisode(1);

  // ===== RENDER =====
  if (isMovie && !hasTMDBKey()) {
    return (
      <div className="watch-page">
        <div className="watch-error-page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          <h3>TMDB API Key Required</h3>
          <p>Add your free API key to <code>.env</code> as <code>VITE_TMDB_API_KEY=your_key</code></p>
          <p style={{fontSize:'0.8rem',color:'rgba(255,255,255,0.4)'}}>Get one free at themoviedb.org/settings/api</p>
          <button className="btn-play" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    );
  }

  if (!episodeId && !tmdbId && !gokuId) {
    return <div className="error-msg">No content ID provided</div>;
  }

  if (loading) return <Loading text="Loading..." />;

  // Build seasons from either TMDB or Goku data
  const isGokuFlow = !!gokuId;
  let seasons = movieDetails?.seasons?.filter((s) => s.season_number > 0) || [];
  if (isGokuFlow && seasons.length === 0 && seasonEpisodes.length > 0) {
    // For Goku, derive seasons from the episodes we loaded
    // We just show the current season's episodes; info was loaded in the effect
    seasons = [{ season_number: selectedSeason, episode_count: seasonEpisodes.length }];
  }

  // Retry handler for failed streams
  const handleRetry = () => {
    setError(null);
    setCurrentSource(null);
    setSources([]);
    setSubtitles([]);
    setReferer('');
    setUseEmbedPlayer(false);
    setUseSubIndo(false);
    setSubLang(null);
    setAnimeHlsLevels([]);
    // Bump retryKey to re-trigger the fetch useEffect
    setRetryKey((k) => k + 1);
  };

  return (
    <div className="watch-page">
      {/* ===== PLAYER ===== */}
      <div className="watch-player-wrap">
        {isAnime && useSubIndo ? (
          <SubIndoPlayer
            animeTitle={animeInfo?.title || title}
            japaneseTitle={animeInfo?.japaneseTitle || animeInfo?.otherName || ''}
            episode={parseInt(epNum) || 1}
          />
        ) : isAnime && useEmbedPlayer && malId ? (
          <AnimeEmbedPlayer
            malId={malId}
            episode={parseInt(epNum) || 1}
          />
        ) : isMovie && useEmbedPlayer && tmdbId ? (
          <MovieEmbedPlayer
            tmdbId={tmdbId}
            mediaType={mediaType}
            season={season}
            episode={episode}
          />
        ) : currentSource ? (
          <div className="player-wrapper">
            <VideoPlayer
              ref={playerRef}
              src={currentSource.url}
              subtitles={subtitles}
              referer={referer}
              initialTime={resumeTime.current}
              onError={handlePlayerError}
              onMinimize={isAnime ? handleMinimize : isMovie ? handleMinimizeMovie : undefined}
              onLevelsLoaded={(levels) => {
                setAnimeHlsLevels(levels);
                setAnimeSelectedLevel(-1);
                // Manifest parsed successfully — this source works
                lastWorkingSource.current = currentSource;
              }}
              onLevelSwitched={(level) => setAnimeCurrentLevel(level)}
            />
          </div>
        ) : error ? (
          <div className="player-wrapper">
            <div className="player-empty player-error-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <p className="player-error-title">Stream Unavailable</p>
              <p className="player-error-desc">
                {error}
                {isAnime && ' All providers failed — try embedded player.'}
              </p>
              <div className="player-error-actions">
                <button className="btn-play btn-sm" onClick={handleRetry}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
                  Retry
                </button>
                {isAnime && malId && (
                  <button className="btn-play btn-sm" onClick={() => { setError(null); setSubLang('multi'); setUseEmbedPlayer(true); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    Embedded Player
                  </button>
                )}
                {isMovie && tmdbId && (
                  <button className="btn-play btn-sm" onClick={() => { setError(null); setSubLang('multi'); setUseEmbedPlayer(true); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    Embedded Player
                  </button>
                )}
                <button className="btn-glass btn-sm" onClick={() => navigate(-1)}>
                  Go Back
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="player-wrapper">
            <div className="player-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>
              <p>No playable source found</p>
              <div className="player-error-actions" style={{marginTop:'0.5rem'}}>
                <button className="btn-play btn-sm" onClick={handleRetry}>
                  Retry
                </button>
                {((isAnime && malId) || (isMovie && tmdbId)) && (
                  <button className="btn-play btn-sm" onClick={() => { setSubLang('multi'); setUseEmbedPlayer(true); }}>
                    Embedded Player
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== CONTENT BELOW PLAYER ===== */}
      <div className="watch-content">

        {/* Player mode selector — Direct HLS or Embed fallback */}
        {(isAnime && malId) || (isMovie && tmdbId) ? (
          <div className="watch-player-mode">
            <span className="watch-player-mode-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <polygon points="10 8 16 11 10 14 10 8" fill="currentColor"/>
              </svg>
              Player
            </span>
            <div className="watch-player-mode-pills">
              <button
                className={`watch-quality-pill ${!useEmbedPlayer && !useSubIndo ? 'active' : ''}`}
                onClick={() => { userForcedDirect.current = true; setSubLang(null); setUseEmbedPlayer(false); setUseSubIndo(false); }}
                title="Direct HLS stream — best quality"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Direct
              </button>
              <button
                className={`watch-quality-pill ${useEmbedPlayer && !useSubIndo ? 'active' : ''}`}
                onClick={() => { setSubLang('multi'); setUseEmbedPlayer(true); setUseSubIndo(false); }}
                title="Embedded player — try this if Direct doesn't work"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Embed
              </button>
              {isAnime && (
                <button
                  className={`watch-quality-pill watch-quality-pill-indo ${useSubIndo ? 'active' : ''}`}
                  onClick={() => { setSubLang('id'); setUseEmbedPlayer(false); setUseSubIndo(true); }}
                  title="Sub Indonesia — dari Samehadaku"
                >
                  🇮🇩 Sub Indo
                </button>
              )}
            </div>
          </div>
        ) : isAnime ? (
          <div className="watch-player-mode">
            <span className="watch-player-mode-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <polygon points="10 8 16 11 10 14 10 8" fill="currentColor"/>
              </svg>
              Player
            </span>
            <div className="watch-player-mode-pills">
              <button
                className={`watch-quality-pill ${!useSubIndo ? 'active' : ''}`}
                onClick={() => { userForcedDirect.current = true; setSubLang(null); setUseEmbedPlayer(false); setUseSubIndo(false); }}
                title="Direct HLS stream — best quality"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Direct
              </button>
              <button
                className={`watch-quality-pill watch-quality-pill-indo ${useSubIndo ? 'active' : ''}`}
                onClick={() => { setSubLang('id'); setUseEmbedPlayer(false); setUseSubIndo(true); }}
                title="Sub Indonesia — dari Samehadaku"
              >
                🇮🇩 Sub Indo
              </button>
            </div>
          </div>
        ) : null}

        {/* Quality selector (HLS levels discovered by player) — hide when embed player active */}
        {animeHlsLevels.length > 1 && !useEmbedPlayer && !useSubIndo && (
          <div className="watch-quality-section">
            <span className="watch-quality-label">Quality</span>
            <div className="watch-quality-pills">
              <button
                className={`watch-quality-pill ${animeSelectedLevel === -1 ? 'active' : ''}`}
                onClick={() => {
                  playerRef.current?.setLevel(-1);
                  setAnimeSelectedLevel(-1);
                }}
              >
                Auto
                {animeSelectedLevel === -1 && animeCurrentLevel >= 0 && (
                  <span className="quality-auto-hint">
                    {animeHlsLevels.find(l => l.index === animeCurrentLevel)?.label || ''}
                  </span>
                )}
              </button>
              {animeHlsLevels.map((lv) => (
                <button
                  key={lv.index}
                  className={`watch-quality-pill ${animeSelectedLevel === lv.index ? 'active' : ''}`}
                  onClick={() => {
                    playerRef.current?.setLevel(lv.index);
                    setAnimeSelectedLevel(lv.index);
                  }}
                >
                  {lv.label}
                  {lv.height >= 1080 && <span className="res-badge">HD</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Source quality selector (for non-HLS multi-source streams like AnimePahe) */}
        {animeHlsLevels.length <= 1 && sources.length > 1 && (
          <div className="watch-quality-section">
            <span className="watch-quality-label">Quality</span>
            <div className="watch-quality-pills">
              {sources.map((src, i) => (
                <button
                  key={i}
                  className={`watch-quality-pill ${currentSource?.url === src.url ? 'active' : ''}`}
                  onClick={() => {
                    // Remember current working source before switching
                    if (currentSource) lastWorkingSource.current = currentSource;
                    setCurrentSource(src);
                  }}
                >
                  {src.quality || `Source ${i + 1}`}
                  {['1080p', '1080'].includes(src.quality) && <span className="res-badge">HD</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title & Navigation */}
        <div className="watch-title-section">
          <div className="watch-title-row">
            <button
              className="watch-back-btn"
              onClick={() => navigate(-1)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="watch-title-info">
              <h1>{title}</h1>
              {isAnime && epNum && (
                <span className="watch-ep-label">Episode {epNum}</span>
              )}
              {isMovie && mediaType === 'tv' && (
                <span className="watch-ep-label">
                  Season {season} &middot; Episode {episode}
                </span>
              )}
              {movieDetails?.tagline && (
                <p className="watch-tagline">{movieDetails.tagline}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {(movieDetails?.overview || animeInfo?.description) && (
            <p
              className="watch-description"
              dangerouslySetInnerHTML={{
                __html: (() => {
                  const txt = movieDetails?.overview || animeInfo?.description || '';
                  return txt.length > 300 ? txt.slice(0, 300) + '...' : txt;
                })(),
              }}
            />
          )}

          {/* Meta badges */}
          <div className="watch-meta-badges">
            {movieDetails?.genres?.map((g) => (
              <span key={g.id} className="watch-badge">{g.name}</span>
            ))}
            {animeInfo?.genres?.map((g) => (
              <span key={g} className="watch-badge">{g}</span>
            ))}
            {movieDetails?.runtime > 0 && (
              <span className="watch-badge">{movieDetails.runtime} min</span>
            )}
            {movieDetails?.vote_average > 0 && (
              <span className="watch-badge watch-badge-gold">
                ★ {movieDetails.vote_average.toFixed(1)}
              </span>
            )}
            {animeInfo?.rating && (
              <span className="watch-badge watch-badge-gold">
                ★ {(animeInfo.rating / 10).toFixed(1)}
              </span>
            )}
            {animeInfo?.totalEpisodes && (
              <span className="watch-badge">{animeInfo.totalEpisodes} eps</span>
            )}
          </div>

          {/* Episode navigation */}
          <div className="watch-ep-nav">
            {prevUrl ? (
              <button
                className="watch-nav-btn"
                onClick={() => navigate(prevUrl)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m15 18-6-6 6-6"/></svg>
                Previous Episode
              </button>
            ) : (
              <div />
            )}
            {nextUrl && (
              <button
                className="watch-nav-btn watch-nav-next"
                onClick={() => navigate(nextUrl)}
              >
                Next Episode
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* ===== TV EPISODES (TMDB) ===== */}
        {isMovie && mediaType === 'tv' && seasons.length > 0 && (
          <div className="watch-episodes-section">
            <h2 className="watch-section-title">Episodes</h2>

            {/* Season tabs */}
            <div className="season-tabs">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  className={`season-tab ${s.season_number === selectedSeason ? 'active' : ''}`}
                  onClick={() => setSelectedSeason(s.season_number)}
                >
                  S{s.season_number}
                </button>
              ))}
            </div>

            {/* Episode grid */}
            <div className="watch-ep-grid">
              {seasonEpisodes.map((ep) => (
                <button
                  key={ep.episode_number}
                  className={`watch-ep-item ${ep.episode_number === episode && selectedSeason === season ? 'active' : ''}`}
                  onClick={() =>
                    navigate(
                      isGokuFlow
                        ? `/watch/movie?gokuId=${encodeURIComponent(gokuId)}&type=tv&season=${selectedSeason}&episode=${ep.episode_number}&title=${encodeURIComponent(ep.name || title)}`
                        : `/watch/movie?tmdbId=${tmdbId}&type=tv&season=${selectedSeason}&episode=${ep.episode_number}&title=${encodeURIComponent(ep.name || title)}`
                    )
                  }
                >
                  {ep.still_path && (
                    <img
                      src={tmdbImg(ep.still_path, 'w300')}
                      alt=""
                      className="watch-ep-thumb"
                      loading="lazy"
                    />
                  )}
                  <div className="watch-ep-info">
                    <span className="watch-ep-num">E{ep.episode_number}</span>
                    <span className="watch-ep-name">{ep.name}</span>
                    {ep.overview && (
                      <span className="watch-ep-overview">
                        {ep.overview.length > 80
                          ? ep.overview.slice(0, 80) + '...'
                          : ep.overview}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== ANIME EPISODES ===== */}
        {isAnime && animeEpisodes.length > 0 && (() => {
          const CHUNK = animeEpisodes.length > 100 ? 50 : animeEpisodes.length > 36 ? 25 : animeEpisodes.length;
          const ranges = [];
          for (let i = 0; i < animeEpisodes.length; i += CHUNK) {
            const chunk = animeEpisodes.slice(i, i + CHUNK);
            const first = chunk[0]?.number || i + 1;
            const last = chunk[chunk.length - 1]?.number || i + chunk.length;
            ranges.push({ label: `${first}-${last}`, start: i, end: i + chunk.length });
          }
          // Auto-select range for current episode
          const curIdx = animeEpisodes.findIndex(ep => ep.id === episodeId);
          const autoRange = curIdx >= 0 ? Math.floor(curIdx / CHUNK) : epActiveRange;
          const effectiveRange = epSearch ? 0 : (autoRange !== epActiveRange && epActiveRange === 0 ? autoRange : epActiveRange);

          const displayEps = epSearch.trim()
            ? animeEpisodes.filter(ep => {
                const q = epSearch.trim().toLowerCase();
                return String(ep.number).includes(q) || (ep.title && ep.title.toLowerCase().includes(q));
              })
            : animeEpisodes.slice(ranges[effectiveRange]?.start || 0, ranges[effectiveRange]?.end || animeEpisodes.length);

          return (
            <div className="watch-episodes-section">
              <div className="ep-section-header-row">
                <h2 className="watch-section-title" style={{margin:0}}>
                  Episodes ({animeEpisodes.length})
                </h2>
                {animeEpisodes.length > 12 && (
                  <div className="ep-search-wrap">
                    <svg className="ep-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input
                      className="ep-search-input"
                      placeholder="Search ep..."
                      value={epSearch}
                      onChange={e => setEpSearch(e.target.value)}
                    />
                    {epSearch && (
                      <button className="ep-search-clear" onClick={() => setEpSearch('')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Range tabs */}
              {ranges.length > 1 && !epSearch && (
                <div className="ep-range-tabs">
                  {ranges.map((r, i) => (
                    <button
                      key={i}
                      className={`ep-range-tab ${i === effectiveRange ? 'active' : ''}`}
                      onClick={() => setEpActiveRange(i)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="watch-ep-grid anime-ep-grid">
                {displayEps.map((ep) => (
                  <button
                    key={ep.id}
                    className={`watch-ep-item compact ${ep.id === episodeId ? 'active' : ''}`}
                    onClick={() =>
                      navigate(
                        `/watch/anime?episodeId=${encodeURIComponent(ep.id)}&title=${encodeURIComponent(title)}&ep=${ep.number || ''}&animeId=${encodeURIComponent(animeId)}`
                      )
                    }
                  >
                    <span className="watch-ep-num">EP {ep.number || '?'}</span>
                    {ep.title && ep.title !== String(ep.number) && (
                      <span className="watch-ep-name">
                        {ep.title.length > 20
                          ? ep.title.slice(0, 20) + '...'
                          : ep.title}
                      </span>
                    )}
                  </button>
                ))}
                {epSearch && displayEps.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1/-1', padding: '1rem 0' }}>
                    No episodes match "{epSearch}"
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* ===== ANIME RECOMMENDATIONS ===== */}
        {isAnime && animeRecs.length > 0 && (
          <div className="watch-rec-section">
            <h2 className="watch-section-title">You Might Also Like</h2>
            <div className="watch-card-scroll">
              {animeRecs.map((item) => (
                <Card
                  key={item.id}
                  item={{
                    id: item.id,
                    title: item.title,
                    image: item.image,
                    type: item.type || 'TV',
                    subOrDub: item.sub ? `Sub: ${item.sub}` : undefined,
                  }}
                  type="anime"
                />
              ))}
            </div>
          </div>
        )}

        {/* ===== YOU MIGHT ALSO LIKE ===== */}
        {recommendations.length > 0 && (
          <div className="watch-rec-section">
            <h2 className="watch-section-title">You Might Also Like</h2>
            <div className="watch-card-scroll">
              {recommendations.map((item) => (
                <Card key={item.id} item={item} type="movie" />
              ))}
            </div>
          </div>
        )}

        {/* ===== SIMILAR ===== */}
        {similar.length > 0 && (
          <div className="watch-rec-section">
            <h2 className="watch-section-title">Similar</h2>
            <div className="watch-card-scroll">
              {similar.map((item) => (
                <Card key={item.id} item={item} type="movie" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
