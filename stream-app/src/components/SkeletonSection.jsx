/**
 * SkeletonSection — shimmer placeholder while a section loads.
 * Matches the exact layout of a real Section (title + horizontal card row).
 * Creates the illusion of fast loading by showing structure immediately.
 */
export default function SkeletonSection({ count = 8, accentColor }) {
  return (
    <section className="home-section skeleton-section">
      <div className="section-header">
        <h2 className="section-title">
          {accentColor && <span className="section-dot" style={{ background: accentColor }} />}
          <span className="skeleton-text skeleton-title-text">&nbsp;</span>
        </h2>
      </div>
      <div className="card-row-wrapper">
        <div className="card-row skeleton-card-row">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-card-img skeleton-shimmer" />
              <div className="skeleton-card-info">
                <div className="skeleton-card-line skeleton-shimmer" style={{ width: '80%' }} />
                <div className="skeleton-card-line skeleton-shimmer short" style={{ width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
