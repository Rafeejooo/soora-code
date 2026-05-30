/**
 * SkeletonWatch — loading placeholder for the Watch page.
 * Clean layout: a 16:9 player box, then a few content lines. Reuses the
 * global `skeleton-shimmer` animation. No floating icons (kept minimal).
 */
export default function SkeletonWatch({ episodes = true }) {
  return (
    <div className="watch-page skeleton-watch">
      <div className="watch-player-wrap">
        <div className="sk-player-box">
          <div className="sk-player-fill skeleton-shimmer" />
        </div>
      </div>

      <div className="watch-content">
        <div className="sk-title-block">
          <span className="sk-bar sk-title skeleton-shimmer" />
          <span className="sk-bar sk-sub skeleton-shimmer" />
          <div className="sk-badges">
            {[52, 60, 44].map((w, i) => (
              <span key={i} className="sk-badge skeleton-shimmer" style={{ width: w }} />
            ))}
          </div>
        </div>

        {episodes && (
          <div className="sk-eps">
            <span className="sk-bar sk-eps-title skeleton-shimmer" />
            <div className="sk-eps-grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="sk-ep skeleton-shimmer" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
