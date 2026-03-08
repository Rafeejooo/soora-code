/**
 * SkeletonSearchGrid — shimmer placeholder that mimics the browse/search
 * card-grid layout. Shows skeleton cards matching the real search results
 * grid so users see structure immediately while data is loading.
 */
export default function SkeletonSearchGrid({ count = 12, accentColor }) {
  return (
    <div className="browse-results skeleton-search">
      {/* Skeleton header */}
      <div className="browse-results-header">
        <div className="skeleton-shimmer" style={{
          width: '200px',
          height: '24px',
          borderRadius: '6px',
          background: accentColor
            ? `linear-gradient(90deg, ${accentColor}15 25%, ${accentColor}30 50%, ${accentColor}15 75%)`
            : undefined,
        }} />
        <div className="skeleton-shimmer" style={{
          width: '70px',
          height: '18px',
          borderRadius: '12px',
        }} />
      </div>
      {/* Skeleton card grid */}
      <div className="card-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-search-card">
            <div className="skeleton-search-card-img skeleton-shimmer" />
            <div className="skeleton-search-card-info">
              <div className="skeleton-shimmer" style={{ width: '80%', height: '12px', borderRadius: '4px' }} />
              <div className="skeleton-shimmer" style={{ width: '50%', height: '10px', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
