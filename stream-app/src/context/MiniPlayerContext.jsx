import { createContext, useContext, useState, useCallback } from 'react';

const MiniPlayerContext = createContext(null);

export function MiniPlayerProvider({ children }) {
  const [miniPlayer, setMiniPlayer] = useState(null);
  // miniPlayer shape:
  // { src, subtitles, referer, title, epLabel, currentTime, watchUrl, type:'anime'|'movie',
  //   tmdbId, mediaType, season, episode }

  const openMini = useCallback((data) => {
    setMiniPlayer(data);
  }, []);

  const closeMini = useCallback(() => {
    setMiniPlayer(null);
  }, []);

  const updateTime = useCallback((time) => {
    setMiniPlayer((prev) => (prev ? { ...prev, currentTime: time } : null));
  }, []);

  return (
    <MiniPlayerContext.Provider value={{ miniPlayer, openMini, closeMini, updateTime }}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const ctx = useContext(MiniPlayerContext);
  if (!ctx) throw new Error('useMiniPlayer must be inside MiniPlayerProvider');
  return ctx;
}
