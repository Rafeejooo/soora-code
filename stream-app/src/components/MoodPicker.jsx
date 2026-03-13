import { useState } from 'react';
import Card from './Card';

const MOODS = [
  { id: 'ketawa',   label: 'Pengen Ketawa',  emoji: '😂', genres: ['comedy', 'slice-of-life'] },
  { id: 'aksi',     label: 'Butuh Aksi',     emoji: '🔥', genres: ['action', 'adventure', 'sports'] },
  { id: 'baper',    label: 'Pengen Baper',   emoji: '😢', genres: ['drama', 'romance'] },
  { id: 'horor',    label: 'Tantang Nyali',  emoji: '😱', genres: ['horror', 'mystery'] },
  { id: 'romantis', label: 'Kisah Cinta',    emoji: '💕', genres: ['romance'] },
  { id: 'mikir',    label: 'Bikin Mikir',    emoji: '🤯', genres: ['sci-fi', 'mystery', 'drama'] },
  { id: 'santai',   label: 'Santai Aja',     emoji: '✨', genres: ['slice-of-life', 'comedy', 'music'] },
  { id: 'klasik',   label: 'Anime Klasik',   emoji: '🎌', genres: ['action', 'adventure', 'fantasy'] },
];

// Movie mood map (uses genre keys from MovieHome GENRE_SECTIONS labels lowercased)
const MOVIE_MOODS = [
  { id: 'ketawa',   label: 'Pengen Ketawa',  emoji: '😂', genres: ['comedy', 'animation', 'family'] },
  { id: 'aksi',     label: 'Butuh Aksi',     emoji: '🔥', genres: ['action'] },
  { id: 'baper',    label: 'Pengen Baper',   emoji: '😢', genres: ['drama', 'romance'] },
  { id: 'horor',    label: 'Tantang Nyali',  emoji: '😱', genres: ['horror', 'thriller'] },
  { id: 'romantis', label: 'Kisah Cinta',    emoji: '💕', genres: ['romance'] },
  { id: 'mikir',    label: 'Bikin Mikir',    emoji: '🤯', genres: ['sci-fi', 'documentary'] },
  { id: 'santai',   label: 'Santai Aja',     emoji: '✨', genres: ['animation', 'family', 'comedy'] },
  { id: 'klasik',   label: 'Film Klasik',    emoji: '🎬', genres: ['drama', 'thriller'] },
];

export default function MoodPicker({ genreData = {}, onNavigate, mode = 'anime' }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);

  const moods = mode === 'movie' ? MOVIE_MOODS : MOODS;

  const handleMoodSelect = (mood) => {
    setSelected(mood.id);
    // Collect items from all matching genres
    const seen = new Set();
    const items = [];
    for (const g of mood.genres) {
      const arr = genreData[g] || [];
      for (const item of arr) {
        const key = item.id || item.mal_id || item.title;
        if (key && !seen.has(key)) {
          seen.add(key);
          items.push(item);
        }
      }
    }
    // Shuffle and limit to 12
    const shuffled = [...items].sort(() => Math.random() - 0.5).slice(0, 12);
    setResults(shuffled);
  };

  const handleRandom = () => {
    const all = Object.values(genreData).flat();
    const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 12);
    setResults(shuffled);
    setSelected('random');
  };

  if (!open) {
    return (
      <button className="mood-picker-trigger" onClick={() => setOpen(true)}>
        🎯 Lagi mau nonton apa?
      </button>
    );
  }

  return (
    <div className="mood-picker-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="mood-picker-modal">
        <button className="mood-picker-close" onClick={() => setOpen(false)}>✕</button>
        <h2 className="mood-picker-title">Lagi mau nonton apa?</h2>

        <div className="mood-picker-grid">
          {moods.map((mood) => (
            <button
              key={mood.id}
              className={`mood-option ${selected === mood.id ? 'mood-option-active' : ''}`}
              onClick={() => handleMoodSelect(mood)}
            >
              <span className="mood-emoji">{mood.emoji}</span>
              <span className="mood-label">{mood.label}</span>
            </button>
          ))}
        </div>

        {selected && results.length === 0 && (
          <div className="mood-empty">
            <p>Hmm, belum ada data untuk mood ini.</p>
            <button className="mood-random-btn" onClick={handleRandom}>🎲 Acak Genre</button>
          </div>
        )}

        {results.length > 0 && (
          <div className="mood-results">
            <div className="mood-results-header">
              <span className="mood-results-title">Rekomendasi untukmu</span>
              <button className="mood-random-btn" onClick={handleRandom}>🎲 Acak</button>
            </div>
            <div className="mood-results-grid">
              {results.map((item) => (
                <Card
                  key={item.id || item.mal_id || item.title}
                  id={item.id || item.mal_id}
                  title={item.title || item.name}
                  image={item.image || item.poster_path}
                  rating={item.rating || item.vote_average}
                  type={item.type}
                  onClick={() => onNavigate && onNavigate(item)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
