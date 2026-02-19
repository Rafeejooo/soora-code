import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  getMovieDetailsTMDB,
  getTVDetailsTMDB,
  tmdbImg,
  tmdbBackdrop,
  hasTMDBKey,
  getGokuInfo,
  findTMDBDetailsByTitle,
  getLK21Info,
  getLK21SeriesInfo,
} from '../api';
import { useSEO, buildMovieSchema, buildMovieUrl, detectMovieProvider } from '../utils/seo';
import Card from '../components/Card';
import Loading from '../components/Loading';

// Detect if an id is a Goku ID (contains "watch-") vs numeric TMDB ID
const isGokuId = (id) => id && (id.includes('watch-') || id.includes('/'));

// Enlarge Goku thumbnail (250x400 → 600x900)
const gokuLargeImg = (url) => url ? url.replace(/\/resize\/\d+x\d+\//, '/resize/600x900/') : url;

export default function MovieInfo() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const id = params['*'] || ''; // splat captures the full ID including slashes
  const type = searchParams.get('type') || 'movie'; // 'movie' or 'tv'
  const provider = detectMovieProvider(id); // auto-detect from ID format
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [tmdbData, setTmdbData] = useState(null); // Enrichment data from TMDB
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'goku', 'tmdb', or 'lk21'

  useEffect(() => {
    if (!id) return;
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      setTmdbData(null);
      try {
        if (provider === 'lk21') {
          setSource('lk21');
          const res = type === 'tv'
            ? await getLK21SeriesInfo(id)
            : await getLK21Info(id);
          setInfo(res.data);

          // Enrich with TMDB data (cast images, recommendations, similar, backdrop)
          if (hasTMDBKey() && res.data?.title) {
            try {
              const tmdbRes = await findTMDBDetailsByTitle(res.data.title, type);
              if (tmdbRes.data) setTmdbData(tmdbRes.data);
            } catch { /* TMDB enrichment is optional */ }
          }
        } else if (isGokuId(id)) {
          setSource('goku');
          const res = await getGokuInfo(id);
          setInfo(res.data);

          // Enrich with TMDB data (cast images, recommendations, similar, backdrop)
          if (hasTMDBKey() && res.data?.title) {
            try {
              const tmdbRes = await findTMDBDetailsByTitle(res.data.title, type);
              if (tmdbRes.data) setTmdbData(tmdbRes.data);
            } catch { /* TMDB enrichment is optional */ }
          }
        } else if (hasTMDBKey()) {
          setSource('tmdb');
          const res =
            type === 'tv'
              ? await getTVDetailsTMDB(id)
              : await getMovieDetailsTMDB(id);
          setInfo(res.data);
        } else {
          setError('TMDB API key required for numeric IDs');
        }
      } catch (err) {
        setError(err.response?.data?.status_message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [id, type, provider]);

  // SEO hook (must be before early returns to satisfy Rules of Hooks)
  const seoMovieTitle = info
    ? (source === 'goku' || source === 'lk21' ? (info.title || 'Unknown') : (info.title || info.name || 'Unknown'))
    : '';
  const seoYear = info
    ? (source === 'goku' || source === 'lk21'
      ? (info.releaseDate || '')
      : (info.release_date || info.first_air_date || '').split('-')[0])
    : '';
  const seoDesc = info
    ? (tmdbData?.overview || info.synopsis || info.description || info.overview || '')
    : '';
  const seoGenres = info
    ? ((source === 'goku' || source === 'lk21')
      ? (tmdbData?.genres || (info.genres || []).map((g, i) => ({ id: i, name: g })))
      : (info.genres || []))
    : [];
  const seoCanonical = id ? buildMovieUrl(id, type) : '';
  const seoPoster = info
    ? (source === 'lk21'
      ? (tmdbData?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : info.posterImg || '')
      : source === 'goku'
        ? (tmdbData?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : info.image || '')
        : (info.poster_path ? `https://image.tmdb.org/t/p/w500${info.poster_path}` : ''))
    : '';

  useSEO(info ? {
    title: `Nonton ${type === 'tv' ? 'Series' : 'Film'} ${seoMovieTitle}${seoYear ? ` (${seoYear})` : ''} Sub Indo | Streaming HD Gratis - Soora`,
    description: `Nonton streaming ${type === 'tv' ? 'series' : 'film'} ${seoMovieTitle} subtitle Indonesia full ${type === 'tv' ? 'episode' : 'movie'} HD gratis.${seoGenres.length ? ` Genre: ${seoGenres.map(g => typeof g === 'string' ? g : g.name).filter(Boolean).join(', ')}.` : ''} Trending terbaru bahasa Indo hanya di Soora.`,
    canonical: seoCanonical,
    image: seoPoster,
    type: type === 'tv' ? 'video.tv_show' : 'video.movie',
    schema: buildMovieSchema({ ...info, ...tmdbData, title: seoMovieTitle, overview: seoDesc }, type, seoCanonical),
  } : {});

  if (!id) return <div className="error-msg">No movie ID provided</div>;
  if (loading) return <Loading text="Loading..." theme="sooraflix" />;
  if (error) return <div className="error-msg">{error}</div>;
  if (!info) return <div className="error-msg">No data found</div>;

  // Normalize fields for Goku, TMDB, and LK21
  const isGoku = source === 'goku';
  const isLK21 = source === 'lk21';
  const isAlt = isGoku || isLK21; // non-TMDB source
  const title = isAlt
    ? (info.title || 'Unknown')
    : (info.title || info.name || 'Unknown');
  const poster = isLK21
    ? (tmdbData?.poster_path ? tmdbImg(tmdbData.poster_path, 'w500') : info.posterImg || '')
    : isGoku
      ? (tmdbData?.poster_path ? tmdbImg(tmdbData.poster_path, 'w500') : gokuLargeImg(info.image))
      : tmdbImg(info.poster_path, 'w500');
  const backdrop = isLK21
    ? (tmdbData?.backdrop_path ? tmdbBackdrop(tmdbData.backdrop_path) : info.posterImg || '')
    : isGoku
      ? (tmdbData?.backdrop_path ? tmdbBackdrop(tmdbData.backdrop_path) : gokuLargeImg(info.cover || info.image))
      : tmdbBackdrop(info.backdrop_path);
  const year = isAlt
    ? (info.releaseDate || '')
    : (info.release_date || info.first_air_date || '').split('-')[0];
  const description = isAlt
    ? (tmdbData?.overview || info.synopsis || info.description || '')
    : (info.overview || '');
  const genres = isAlt
    ? (tmdbData?.genres || (info.genres || []).map((g, i) => ({ id: i, name: g })))
    : (info.genres || []);
  const cast = isAlt
    ? (tmdbData?.credits?.cast?.slice(0, 10) || (info.casts || []).map((name, i) => ({ id: i, name, character: '' })))
    : (info.credits?.cast?.slice(0, 10) || []);
  const duration = isAlt
    ? (info.duration || '')
    : (info.runtime > 0 ? `${info.runtime} min` : '');
  const production = isAlt
    ? (tmdbData?.production_companies?.map((c) => c.name).join(', ') || info.production || '')
    : (info.production_companies || []).map((c) => c.name).join(', ');
  const rating = isAlt
    ? (tmdbData?.vote_average?.toFixed(1) || info.rating || null)
    : info.vote_average?.toFixed(1);
  const tagline = isAlt ? (tmdbData?.tagline || '') : (info.tagline || '');
  const episodes = isGoku ? (info.episodes || []) : [];
  const recommendations = isAlt
    ? (tmdbData?.recommendations?.results || []).slice(0, 12)
    : (info.recommendations?.results || []).slice(0, 12);
  const similarItems = isAlt
    ? (tmdbData?.similar?.results || []).slice(0, 12)
    : (info.similar?.results || []).slice(0, 12);
  const seasons = isAlt ? [] : (info.seasons?.filter((s) => s.season_number > 0) || []);
  const tmdbId = isAlt ? tmdbData?.id : info.id;

  // Build seasons from Goku episodes
  const gokuSeasons = [];
  if (isGoku && episodes.length > 0 && type === 'tv') {
    const seasonMap = {};
    episodes.forEach((ep) => {
      const s = ep.season || 1;
      if (!seasonMap[s]) seasonMap[s] = [];
      seasonMap[s].push(ep);
    });
    Object.keys(seasonMap).sort((a, b) => a - b).forEach((s) => {
      gokuSeasons.push({ season: Number(s), count: seasonMap[s].length });
    });
  }

  const handleWatch = (s = 1, ep = 1) => {
    if (isLK21) {
      if (type === 'tv') {
        navigate(
          `/watch/movie?lk21Id=${encodeURIComponent(id)}&type=tv&season=${s}&episode=${ep}&title=${encodeURIComponent(title)}`
        );
      } else {
        navigate(
          `/watch/movie?lk21Id=${encodeURIComponent(id)}&type=movie&title=${encodeURIComponent(title)}`
        );
      }
    } else if (isGoku) {
      if (type === 'tv') {
        navigate(
          `/watch/movie?gokuId=${encodeURIComponent(id)}&type=tv&season=${s}&episode=${ep}&title=${encodeURIComponent(title)}`
        );
      } else {
        navigate(
          `/watch/movie?gokuId=${encodeURIComponent(id)}&type=movie&title=${encodeURIComponent(title)}`
        );
      }
    } else {
      if (type === 'tv') {
        navigate(
          `/watch/movie?tmdbId=${id}&type=tv&season=${s}&episode=${ep}&title=${encodeURIComponent(title)}`
        );
      } else {
        navigate(
          `/watch/movie?tmdbId=${id}&type=movie&title=${encodeURIComponent(title)}`
        );
      }
    }
  };

  const normalizeRec = (r) => ({
    id: r.id,
    tmdbId: r.id,
    title: r.title || r.name,
    image: tmdbImg(r.poster_path),
    releaseDate: r.release_date || r.first_air_date,
    rating: r.vote_average ? Math.round(r.vote_average * 10) : null,
    mediaType: r.media_type || type,
  });

  return (
    <div className="info-page">
      {/* Cinematic backdrop */}
      <div className="info-backdrop">
        <img src={backdrop || poster} alt="" />
      </div>

      <button className="back-btn" onClick={() => navigate(-1)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back
      </button>

      <div className="info-content">
        <div className="info-header">
          <div className="info-poster">
            <img
              src={poster}
              alt={title}
              onError={(e) => {
                e.target.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="320" viewBox="0 0 220 320"><rect fill="%231a1a2e" width="220" height="320"/><text x="110" y="160" text-anchor="middle" fill="%23666" font-family="system-ui" font-size="13">No Image</text></svg>')}`;
              }}
            />
          </div>
          <div className="info-details">
            <h1>{title}</h1>
            {!isGoku && info.tagline && <p className="info-tagline">"{info.tagline}"</p>}
            {isGoku && tagline && <p className="info-tagline">"{tagline}"</p>}

            <div className="info-meta">
              <span className="badge badge-accent">
                {type === 'tv' ? 'TV Series' : 'Movie'}
              </span>
              {year && <span className="badge">{year}</span>}
              {duration && <span className="badge">{duration}</span>}
              {info.number_of_seasons > 0 && (
                <span className="badge">{info.number_of_seasons} Seasons</span>
              )}
              {gokuSeasons.length > 0 && (
                <span className="badge">{gokuSeasons.length} Seasons</span>
              )}
              {rating && rating !== '0.0' && (
                <span className="badge badge-gold">★ {rating}</span>
              )}
              {info.status && <span className="badge">{info.status}</span>}
            </div>

            {genres.length > 0 && (
              <div className="info-genres">
                {genres.map((g) => (
                  <span className="genre-tag" key={g.id}>{g.name}</span>
                ))}
              </div>
            )}

            {description && (
              <div className="description">
                <p>{description}</p>
              </div>
            )}

            {production && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <strong>Production:</strong> {production}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={() => handleWatch()}
              style={{ marginTop: '1rem' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Watch Now
            </button>
          </div>
        </div>

        {/* Cast */}
        {cast.length > 0 && (
          <div className="info-cast-section">
            <h2>Cast</h2>
            <div className="cast-row">
              {cast.map((c, i) => (
                <div className="cast-item" key={c.id ?? i}>
                  <img
                    src={
                      c.profile_path
                        ? tmdbImg(c.profile_path, 'w185')
                        : `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%231a1a2e" width="80" height="80" rx="40"/><text x="40" y="45" text-anchor="middle" fill="%23666" font-family="system-ui" font-size="24">' + (c.name?.[0] || '?') + '</text></svg>')}`
                    }
                    alt={c.name}
                    onError={(e) => {
                      e.target.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%231a1a2e" width="80" height="80" rx="40"/><text x="40" y="45" text-anchor="middle" fill="%23666" font-family="system-ui" font-size="24">' + (c.name?.[0] || '?') + '</text></svg>')}`;
                    }}
                  />
                  <span className="cast-name">{c.name}</span>
                  {c.character && <span className="cast-char">{c.character}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seasons — TMDB */}
        {seasons.length > 0 && (
          <div className="episode-section">
            <h2>Seasons</h2>
            <div className="episodes-grid">
              {seasons.map((s) => (
                <button
                  className="ep-btn"
                  key={s.season_number}
                  onClick={() => handleWatch(s.season_number, 1)}
                >
                  <span className="ep-num">Season {s.season_number}</span>
                  <span className="ep-title">{s.episode_count} episodes</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Seasons — Goku TV */}
        {gokuSeasons.length > 0 && (
          <div className="episode-section">
            <h2>Seasons</h2>
            <div className="episodes-grid">
              {gokuSeasons.map((s) => (
                <button
                  className="ep-btn"
                  key={s.season}
                  onClick={() => handleWatch(s.season, 1)}
                >
                  <span className="ep-num">Season {s.season}</span>
                  <span className="ep-title">{s.count} episodes</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section className="home-section info-rec-section">
            <h2 className="section-title">Recommended</h2>
            <div className="card-grid compact">
              {recommendations.map((r) => (
                <Card key={r.id} item={normalizeRec(r)} type="movie" />
              ))}
            </div>
          </section>
        )}

        {/* Similar */}
        {similarItems.length > 0 && (
          <section className="home-section info-rec-section">
            <h2 className="section-title">Similar</h2>
            <div className="card-grid compact">
              {similarItems.map((r) => (
                <Card key={r.id} item={normalizeRec(r)} type="movie" />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
