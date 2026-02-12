import { useEffect, useRef } from 'react';

/**
 * VidKingPlayer — iframe-based video player using TMDB IDs
 * Handles resolution, subtitles, and server selection internally.
 *
 * Movies:  /embed/movie/{tmdbId}
 * TV:      /embed/tv/{tmdbId}/{season}/{episode}
 */
export default function VidKingPlayer({
  tmdbId,
  type = 'movie',
  season = 1,
  episode = 1,
  onProgress,
}) {
  const iframeRef = useRef(null);

  const buildUrl = () => {
    const params = new URLSearchParams({
      color: '7c5cfc',
      autoPlay: 'true',
    });

    const base = 'https://www.vidking.net/embed';

    if (type === 'tv') {
      params.set('nextEpisode', 'true');
      params.set('episodeSelector', 'true');
      return `${base}/tv/${tmdbId}/${season}/${episode}?${params}`;
    }

    return `${base}/movie/${tmdbId}?${params}`;
  };

  // Listen for postMessage events from VidKing (progress, play, pause, etc.)
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.origin.includes('vidking.net')) return;
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (onProgress && data.currentTime !== undefined) {
          onProgress(data);
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onProgress]);

  return (
    <div className="vidking-player-container">
      <iframe
        ref={iframeRef}
        src={buildUrl()}
        frameBorder="0"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Video Player"
      />
    </div>
  );
}
