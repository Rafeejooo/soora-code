import { useState, useEffect, useRef, useCallback } from 'react';
import Card from './Card';

export default function Top10Section({ title, items, type, accentColor }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, items]);

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const cardW = scrollRef.current.querySelector('.top10-item')?.offsetWidth || 220;
    scrollRef.current.scrollBy({ left: dir * cardW * 2, behavior: 'smooth' });
  };

  const top10 = (items || []).slice(0, 10);
  if (top10.length === 0) return null;

  return (
    <section className="home-section top10-section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="top10-badge" style={accentColor ? { background: accentColor } : undefined}>TOP 10</span>
          {title}
        </h2>
        <div className="section-nav">
          <button
            onClick={() => scroll(-1)}
            className={`scroll-btn ${!canScrollLeft ? 'disabled' : ''}`}
            aria-label="Scroll left"
            disabled={!canScrollLeft}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            onClick={() => scroll(1)}
            className={`scroll-btn ${!canScrollRight ? 'disabled' : ''}`}
            aria-label="Scroll right"
            disabled={!canScrollRight}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div className="card-row-wrapper">
        {canScrollLeft && <div className="row-fade row-fade-left" />}
        {canScrollRight && <div className="row-fade row-fade-right" />}
        <div className="top10-row" ref={scrollRef}>
          {top10.map((item, i) => (
            <div className="top10-item" key={item.id}>
              <span className="top10-rank" data-rank={i + 1}>{i + 1}</span>
              <Card item={item} type={type} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
