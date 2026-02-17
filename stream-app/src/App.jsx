import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import MiniPlayer from './components/MiniPlayer';
import { MiniPlayerProvider } from './context/MiniPlayerContext';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Home from './pages/Home';
import MovieHome from './pages/MovieHome';
import MangaHome from './pages/MangaHome';
import MangaInfo from './pages/MangaInfo';
import MangaReader from './pages/MangaReader';
import Search from './pages/Search';
import AnimeInfo from './pages/AnimeInfo';
import MovieInfo from './pages/MovieInfo';
import Watch from './pages/Watch';
import MyList from './pages/MyList';
import SooramicsPlus from './pages/SooramicsPlus';
import './App.css';

function AppLayout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isSooramicsPlus = location.pathname.startsWith('/2');

  // Detect which "app" we're in based on path
  const isMovieSection = location.pathname.startsWith('/movies') || location.pathname.startsWith('/watch/movie');
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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* sooramics+ hidden route */}
        <Route path="/33" element={<SooramicsPlus />} />
        {/* sooranime routes */}
        <Route path="/anime" element={<Home />} />
        <Route path="/anime/search" element={<Search searchType="anime" />} />
        <Route path="/anime/info" element={<AnimeInfo />} />
        <Route path="/anime/mylist" element={<MyList section="anime" />} />
        <Route path="/watch/anime" element={<Watch />} />
        {/* sooraflix routes */}
        <Route path="/movies" element={<MovieHome />} />
        <Route path="/movies/search" element={<Search searchType="movie" />} />
        <Route path="/movies/info" element={<MovieInfo />} />
        <Route path="/movies/mylist" element={<MyList section="movie" />} />
        <Route path="/watch/movie" element={<Watch />} />
        {/* sooramics routes */}
        <Route path="/manga" element={<MangaHome />} />
        <Route path="/manga/search" element={<Search searchType="manga" />} />
        <Route path="/manga/info" element={<MangaInfo />} />
        <Route path="/manga/mylist" element={<MyList section="manga" />} />
        <Route path="/manga/read" element={<MangaReader />} />
        {/* shared — legacy route redirects to anime mylist */}
        <Route path="/mylist" element={<MyList section="anime" />} />
        {/* Legacy redirects */}
        <Route path="/search/:type" element={<Search />} />
        <Route path="/movie/info" element={<MovieInfo />} />
      </Routes>
      {!isLanding && !isAuthPage && !isMangaReader && !isSooramicsPlus && <MiniPlayer />}
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
