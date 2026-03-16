import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import MiniPlayer from './components/MiniPlayer';
import { MiniPlayerProvider } from './context/MiniPlayerContext';
import { AuthProvider } from './context/AuthContext';
import { LegacyAnimeRedirect, LegacyMovieRedirect, LegacyMangaRedirect } from './components/LegacyRedirect';
import { usePWAMobileOptimizations } from './hooks/usePWAMobile';
import Companion from './components/Companion';
import CompanionSettings, { useCompanionState } from './components/CompanionSettings';
import './App.css';

/* ── Route-level code splitting: each page loads its own JS chunk on demand ── */
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Landing = lazy(() => import('./pages/Landing'));
const Home = lazy(() => import('./pages/Home'));
const MovieHome = lazy(() => import('./pages/MovieHome'));
const MangaHome = lazy(() => import('./pages/MangaHome'));
const MangaInfo = lazy(() => import('./pages/MangaInfo'));
const MangaReader = lazy(() => import('./pages/MangaReader'));
const MangaDownloads = lazy(() => import('./pages/MangaDownloads'));
const Search = lazy(() => import('./pages/Search'));
const AnimeInfo = lazy(() => import('./pages/AnimeInfo'));
const MovieInfo = lazy(() => import('./pages/MovieInfo'));
const Watch = lazy(() => import('./pages/Watch'));
const MyList = lazy(() => import('./pages/MyList'));
const SooramicsPlus = lazy(() => import('./pages/SooramicsPlus'));

/* Minimal route-transition fallback (no spinner — skeleton in each page handles UX) */
function RouteFallback() {
  return <div className="route-loading" />;
}

function AppLayout() {
  const location = useLocation();
  const { animal, setAnimal, visible, setVisible } = useCompanionState();

  // PWA mobile optimizations (overscroll, back button, orientation, etc.)
  usePWAMobileOptimizations();

  const isLanding = location.pathname === '/';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isSooramicsPlus = location.pathname === '/33';

  // Detect which "app" we're in based on path
  const isMovieSection = location.pathname.startsWith('/movies') || location.pathname.startsWith('/movie/') || location.pathname.startsWith('/series/') || location.pathname.startsWith('/watch/movie');
  const isMangaSection = location.pathname.startsWith('/manga');
  const isAnimeMyList = location.pathname === '/anime/mylist';
  const isMovieMyList = location.pathname === '/movies/mylist';
  const isMangaMyList = location.pathname === '/manga/mylist';
  const section = isMangaSection || isMangaMyList ? 'sooramics' : isMovieSection || isMovieMyList ? 'sooraflix' : 'sooranime';

  // Hide navbar on manga reader page for immersive reading
  const isMangaReader = location.pathname === '/manga/read';

  return (
    <MiniPlayerProvider>
      {!isLanding && !isAuthPage && !isMangaReader && !isSooramicsPlus && <Navbar section={section} />}
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* sooramics+ hidden route */}
        <Route path="/33" element={<SooramicsPlus />} />

        {/* sooranime routes */}
        <Route path="/anime" element={<Home />} />
        <Route path="/anime/search" element={<Search searchType="anime" />} />
        <Route path="/anime/info" element={<LegacyAnimeRedirect />} />
        <Route path="/anime/mylist" element={<MyList section="anime" />} />
        <Route path="/anime/:id" element={<AnimeInfo />} />
        <Route path="/watch/anime" element={<Watch />} />

        {/* sooraflix routes */}
        <Route path="/movies" element={<MovieHome />} />
        <Route path="/movies/search" element={<Search searchType="movie" />} />
        <Route path="/movies/info" element={<LegacyMovieRedirect />} />
        <Route path="/movies/mylist" element={<MyList section="movie" />} />
        <Route path="/movie/*" element={<MovieInfo mediaType="movie" />} />
        <Route path="/series/*" element={<MovieInfo mediaType="tv" />} />
        <Route path="/movies/*" element={<MovieInfo />} />
        <Route path="/watch/movie" element={<Watch />} />

        {/* sooramics routes */}
        <Route path="/manga" element={<MangaHome />} />
        <Route path="/manga/search" element={<Search searchType="manga" />} />
        <Route path="/manga/info" element={<LegacyMangaRedirect />} />
        <Route path="/manga/mylist" element={<MyList section="manga" />} />
        <Route path="/manga/downloads" element={<MangaDownloads />} />
        <Route path="/manga/read" element={<MangaReader />} />
        <Route path="/manga/*" element={<MangaInfo />} />

        {/* shared — legacy route redirects to anime mylist */}
        <Route path="/mylist" element={<MyList section="anime" />} />
        {/* Legacy redirects */}
        <Route path="/search/:type" element={<Search />} />
        <Route path="/movie/info" element={<LegacyMovieRedirect />} />
        <Route path="/series/info" element={<LegacyMovieRedirect />} />
      </Routes>
      </Suspense>
      {!isLanding && !isAuthPage && !isMangaReader && !isSooramicsPlus && <MiniPlayer />}
      {!isLanding && !isAuthPage && !isSooramicsPlus && (
        <>
          <Companion animal={animal} visible={visible} onHide={() => setVisible(false)} />
          <CompanionSettings animal={animal} setAnimal={setAnimal} visible={visible} setVisible={setVisible} />
        </>
      )}
    </MiniPlayerProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
