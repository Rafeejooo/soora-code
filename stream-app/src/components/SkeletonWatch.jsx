/**
 * SkeletonWatch — loading placeholder for the Watch page (anime & movie).
 * Mirrors the real layout: player box → server pills → title/desc/badges →
 * episode grid. Reuses the global `skeleton-shimmer` animation.
 */
export default function SkeletonWatch({ episodes = true }) {
  return (
    <div className="watch-page skeleton-watch">
      {/* Player area (16:9 box) */}
      <div className="watch-player-wrap">
        <div className="sk-watch-player skeleton-shimmer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="56" height="56">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
          </svg>
        </div>
      </div>

      <div className="watch-content">
        {/* Server / player-mode pills */}
        <div className="sk-watch-pills">
          {[64, 72, 88].map((w, i) => (
            <span key={i} className="sk-watch-pill skeleton-shimmer" style={{ width: w }} />
          ))}
        </div>

        {/* Title + meta */}
        <div className="sk-watch-title-block">
          <span className="sk-watch-bar sk-watch-title skeleton-shimmer" />
          <span className="sk-watch-bar sk-watch-sub skeleton-shimmer" />
          <span className="sk-watch-bar sk-watch-line skeleton-shimmer" />
          <span className="sk-watch-bar sk-watch-line short skeleton-shimmer" />
          <div className="sk-watch-badges">
            {[48, 56, 40, 64].map((w, i) => (
              <span key={i} className="sk-watch-badge skeleton-shimmer" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Episode grid */}
        {episodes && (
          <div className="sk-watch-eps">
            <span className="sk-watch-bar sk-watch-eps-title skeleton-shimmer" />
            <div className="sk-watch-eps-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} className="sk-watch-ep skeleton-shimmer" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
