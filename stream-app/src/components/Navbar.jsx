import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMyList } from '../utils/mylist';
import { getStreak } from '../utils/streakTracker';

export default function Navbar({ section = 'sooranime' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [listCount, setListCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [streak, setStreak] = useState(0);

  const isSooraflix = section === 'sooraflix';
  const isSooramics = section === 'sooramics';

  // Section-specific mylist path and type filter
  const mylistPath = isSooramics ? '/manga/mylist' : isSooraflix ? '/movies/mylist' : '/anime/mylist';
  const mylistType = isSooramics ? 'manga' : isSooraflix ? 'movie' : 'anime';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const { currentStreak } = getStreak();
    setStreak(currentStreak);
    const handler = () => setStreak(getStreak().currentStreak);
    window.addEventListener('badge-unlocked', handler);
    return () => window.removeEventListener('badge-unlocked', handler);
  }, []);

  useEffect(() => {
    const updateCount = () => {
      const list = getMyList();
      setListCount(list.filter((i) => i.listType === mylistType).length);
    };
    updateCount();
    window.addEventListener('mylist-changed', updateCount);
    return () => window.removeEventListener('mylist-changed', updateCount);
  }, [mylistType]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const isActive = (path) => {
    if (path === '/anime' && !isSooraflix && !isSooramics) return location.pathname === '/anime';
    if (path === '/movies' && isSooraflix) return location.pathname === '/movies';
    if (path === '/manga' && isSooramics) return location.pathname === '/manga';
    return location.pathname.startsWith(path);
  };

  const handleNav = (path) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <div className={`navbar ${scrolled ? 'navbar-scrolled' : ''} ${isSooraflix ? 'navbar-sooraflix' : ''} ${isSooramics ? 'navbar-sooramics' : ''}`}>
      <div
        className="logo-area"
        onClick={() => {
          if (isSooramics) handleNav('/manga');
          else if (isSooraflix) handleNav('/movies');
          else handleNav('/anime');
        }}
        style={{ cursor: 'pointer' }}
      >
        <span className="logo">
          <span className="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="22" height="22" fill="none">
              <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.6" opacity="0.7"/>
              <path d="M9 18.5C9.8 19.5 11.5 20.5 14 20.5c3.5 0 5.5-2 5.5-4.2 0-2.3-1.8-3.2-4.5-3.8l-1-.2C11.5 11.8 10 11 10 9.3 10 7.5 11.8 6 14.2 6c1.8 0 3.2.7 4 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="logo-text">
            <span className="logo-name">
              {isSooramics ? (
                <>soor<span className="logo-accent-mics">amics</span></>
              ) : isSooraflix ? (
                <>soor<span className="logo-accent-flix">aflix</span></>
              ) : (
                <>soor<span className="logo-accent-anime">anime</span></>
              )}
            </span>
          </span>
        </span>
      </div>

      {/* Hamburger button — mobile only */}
      <button
        className={`nav-hamburger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <span />
        <span />
        <span />
      </button>

      {/* Overlay */}
      {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}

      <nav className={menuOpen ? 'nav-open' : ''}>
        {isSooramics ? (
          <>
            <a onClick={() => handleNav('/manga')} className={isActive('/manga') && !isActive('/manga/search') && !isActive('/manga/info') && !isActive('/manga/downloads') ? 'active' : ''}>Home</a>
            <a onClick={() => handleNav('/manga/search')} className={isActive('/manga/search') ? 'active' : ''}>Browse</a>
            <a onClick={() => handleNav('/manga/downloads')} className={`nav-downloads ${isActive('/manga/downloads') ? 'active' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Offline
            </a>
            <a onClick={() => handleNav('/')} className="nav-exit">Keluar</a>
          </>
        ) : isSooraflix ? (
          <>
            <a onClick={() => handleNav('/movies')} className={isActive('/movies') && !isActive('/movies/search') && !isActive('/movies/info') ? 'active' : ''}>Home</a>
            <a onClick={() => handleNav('/movies/search')} className={isActive('/movies/search') ? 'active' : ''}>Browse</a>
            <a onClick={() => handleNav('/')} className="nav-exit">Keluar</a>
          </>
        ) : (
          <>
            <a onClick={() => handleNav('/anime')} className={isActive('/anime') && !isActive('/anime/search') && !isActive('/anime/info') ? 'active' : ''}>Home</a>
            <a onClick={() => handleNav('/anime/search')} className={isActive('/anime/search') ? 'active' : ''}>Browse</a>
            <a onClick={() => handleNav('/')} className="nav-exit">Keluar</a>
          </>
        )}
        {streak >= 2 && (
          <span className="nav-streak" title={`${streak} hari berturut-turut nonton!`}>
            🔥 {streak}
          </span>
        )}
        <a onClick={() => handleNav(mylistPath)} className={`nav-mylist ${location.pathname.includes('/mylist') ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          My List
          {listCount > 0 && <span className="nav-badge">{listCount}</span>}
        </a>
      </nav>
    </div>
  );
}
