import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchSamehadaku, searchMoviesTMDB } from '../api';

/**
 * SearchSuggest — search box with a YouTube-style live suggestion dropdown
 * (poster + title + year). `kind` = 'anime' | 'movie'.
 * - anime: samehadaku results → opens AnimeInfo (?sub=1)
 * - movie: TMDB results → opens movie/tv watch
 * Submitting (Enter / search icon) goes to the full search page.
 */
export default function SearchSuggest({ kind = 'anime', placeholder, className = '' }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const debRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetchSuggest = useCallback(async (term) => {
    setLoading(true);
    try {
      if (kind === 'anime') {
        const r = await searchSamehadaku(term);
        const list = (r.animeList || []).slice(0, 6).map((a) => ({
          id: a.animeId, title: a.title, image: a.poster || a.image,
          year: a.year || '', type: a.type || 'TV', _sub: true,
        }));
        setItems(list);
      } else {
        const r = await searchMoviesTMDB(term, 1);
        const list = (r.data?.results || []).slice(0, 6).map((m) => ({
          id: m.tmdbId || m.id, title: m.title, image: m.image,
          year: (m.releaseDate || '').slice(0, 4), type: m.type, mediaType: m.mediaType,
        }));
        setItems(list);
      }
    } catch { setItems([]); }
    setLoading(false);
  }, [kind]);

  const onChange = (e) => {
    const val = e.target.value;
    setQ(val); setActive(-1);
    if (debRef.current) clearTimeout(debRef.current);
    if (!val.trim() || val.trim().length < 2) { setItems([]); setOpen(false); return; }
    setOpen(true);
    debRef.current = setTimeout(() => fetchSuggest(val.trim()), 350);
  };

  const goFull = () => {
    if (!q.trim()) return;
    const path = kind === 'anime' ? '/anime/search' : '/movies/search';
    navigate(`${path}?q=${encodeURIComponent(q.trim())}`);
    setOpen(false);
  };

  const pick = (it) => {
    setOpen(false);
    if (kind === 'anime') {
      navigate(`/anime/${encodeURIComponent(it.id)}?sub=1`);
    } else {
      const mt = it.mediaType || 'movie';
      navigate(`/${mt === 'tv' ? 'series' : 'movie'}/${it.id}`);
    }
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && items[active]) pick(items[active]); else goFull(); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className={`ss-wrap ${className}`} ref={boxRef}>
      <form className="ss-form" onSubmit={(e) => { e.preventDefault(); goFull(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          type="text"
          placeholder={placeholder || 'Cari...'}
          value={q}
          onChange={onChange}
          onKeyDown={onKey}
          onFocus={() => { if (items.length) setOpen(true); }}
        />
        {q && <button type="button" className="ss-clear" onClick={() => { setQ(''); setItems([]); setOpen(false); }} aria-label="Clear">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>}
      </form>

      {open && (q.trim().length >= 2) && (
        <div className="ss-dropdown">
          {loading && items.length === 0 ? (
            <div className="ss-empty">Mencari…</div>
          ) : items.length === 0 ? (
            <div className="ss-empty">Tidak ada hasil</div>
          ) : (
            <>
              {items.map((it, i) => (
                <button
                  key={it.id}
                  className={`ss-item ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(it)}
                >
                  <div className="ss-thumb">
                    {it.image
                      ? <img src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.target.style.opacity = 0; }} />
                      : <div className="ss-thumb-ph" />}
                  </div>
                  <div className="ss-meta">
                    <span className="ss-title">{it.title}</span>
                    <span className="ss-sub">{[it.type, it.year].filter(Boolean).join(' · ')}</span>
                  </div>
                </button>
              ))}
              <button className="ss-all" onClick={goFull}>
                Lihat semua hasil untuk “{q.trim()}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
