/**
 * SkeletonHero — shimmer placeholder that mimics the hero banner layout.
 * Shown while the hero data is still being fetched.
 * Combined with SkeletonSection rows it gives a Netflix-style loading experience.
 */
export default function SkeletonHero({ theme = '' }) {
  const cls = ['skeleton-hero', theme ? `skeleton-hero-${theme}` : ''].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="skeleton-hero-bg skeleton-shimmer" />
      <div className="skeleton-hero-content">
        {/* Badge */}
        <div className="skeleton-hero-badge skeleton-shimmer" />
        {/* Title */}
        <div className="skeleton-hero-title skeleton-shimmer" />
        {/* Description lines */}
        <div className="skeleton-hero-desc">
          <div className="skeleton-hero-line skeleton-shimmer" style={{ width: '90%' }} />
          <div className="skeleton-hero-line skeleton-shimmer" style={{ width: '70%' }} />
        </div>
        {/* Meta tags */}
        <div className="skeleton-hero-meta">
          <div className="skeleton-hero-tag skeleton-shimmer" />
          <div className="skeleton-hero-tag skeleton-shimmer" style={{ width: '60px' }} />
          <div className="skeleton-hero-tag skeleton-shimmer" style={{ width: '50px' }} />
        </div>
        {/* Action buttons */}
        <div className="skeleton-hero-actions">
          <div className="skeleton-hero-btn skeleton-shimmer" />
          <div className="skeleton-hero-btn skeleton-hero-btn-secondary skeleton-shimmer" />
        </div>
        {/* Dots */}
        <div className="skeleton-hero-dots">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton-hero-dot skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
