import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const BuddyContext = createContext(null);

const GENRE_MOOD_MAP = {
  action:       'excited',
  adventure:    'excited',
  sports:       'excited',
  horror:       'scared',
  mystery:      'scared',
  romance:      'shy',
  drama:        'shy',
  comedy:       'happy',
  'slice-of-life': 'normal',
  'sci-fi':     'curious',
  fantasy:      'curious',
  music:        'happy',
};

export function BuddyProvider({ children }) {
  const [mood, setMood] = useState('normal');
  const [visible, setVisible] = useState(true);

  const setBuddyMood = useCallback((newMood) => {
    setMood(newMood);
    // Auto-reset to normal after 8 seconds (except sleepy)
    if (newMood !== 'sleepy') {
      setTimeout(() => setMood('normal'), 8000);
    }
  }, []);

  const setMoodFromGenre = useCallback((genre) => {
    if (!genre) return;
    const g = genre.toLowerCase();
    const mapped = GENRE_MOOD_MAP[g] || 'normal';
    setBuddyMood(mapped);
  }, [setBuddyMood]);

  const hideBuddy = useCallback(() => setVisible(false), []);
  const showBuddy = useCallback(() => setVisible(true), []);

  // Listen for buddy-mood events dispatched from non-React code (e.g. mylist.js)
  useEffect(() => {
    const handler = (e) => setBuddyMood(e.detail);
    window.addEventListener('buddy-mood', handler);
    return () => window.removeEventListener('buddy-mood', handler);
  }, [setBuddyMood]);

  return (
    <BuddyContext.Provider value={{ mood, setBuddyMood, setMoodFromGenre, visible, hideBuddy, showBuddy }}>
      {children}
    </BuddyContext.Provider>
  );
}

export const useBuddy = () => useContext(BuddyContext);
