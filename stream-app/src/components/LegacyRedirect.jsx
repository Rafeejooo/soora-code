/**
 * LegacyRedirect — handles old query-string URLs and redirects to new clean URLs.
 * Used for backward compatibility and SEO transition.
 *
 * Example:
 *  /anime/info?id=bleach-806          → /anime/bleach-806
 *  /movies/info?id=xyz&type=movie     → /movies/xyz?type=movie
 *  /manga/info?id=6372/slug           → /manga/6372/slug
 */
import { Navigate, useSearchParams } from 'react-router-dom';
import { encodePathId } from '../utils/seo';

export function LegacyAnimeRedirect() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  if (!id) return <Navigate to="/anime" replace />;
  return <Navigate to={`/anime/${encodeURIComponent(id)}`} replace />;
}

export function LegacyMovieRedirect() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  if (!id) return <Navigate to="/movies" replace />;

  const type = searchParams.get('type');
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  return <Navigate to={`/movies/${encodePathId(id)}${qs}`} replace />;
}

export function LegacyMangaRedirect() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  if (!id) return <Navigate to="/manga" replace />;

  return <Navigate to={`/manga/${encodePathId(id)}`} replace />;
}
