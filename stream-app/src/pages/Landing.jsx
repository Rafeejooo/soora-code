import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

  // Animated particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        color: ['#7c5cfc', '#ff6b9d', '#00d4aa', '#fbbf24'][Math.floor(Math.random() * 4)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });

      // Draw connections
      ctx.globalAlpha = 0.03;
      ctx.strokeStyle = '#7c5cfc';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const brands = [
    {
      name: 'sooranime',
      accent: 'anime',
      color: '#7c5cfc',
      glow: 'rgba(124, 92, 252, 0.3)',
      icon: (
        <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          <path d="M22 44V20l24 12-24 12z" fill="currentColor" opacity="0.9"/>
          <path d="M18 16c2-4 8-8 14-8s12 4 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
          <circle cx="24" cy="28" r="3" fill="currentColor" opacity="0.4"/>
          <circle cx="40" cy="28" r="3" fill="currentColor" opacity="0.4"/>
        </svg>
      ),
      tagline: 'Anime Streaming',
      desc: 'Tonton ribuan anime sub & dub. Dari klasik legendaris sampai seasonal terbaru.',
      path: '/anime',
      features: ['10,000+ Anime', 'Sub & Dub', 'HD Quality'],
    },
    {
      name: 'sooraflix',
      accent: 'aflix',
      color: '#ff6b9d',
      glow: 'rgba(255, 107, 157, 0.3)',
      icon: (
        <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
          <rect x="8" y="14" width="48" height="32" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          <rect x="14" y="20" width="36" height="20" rx="2" fill="currentColor" opacity="0.15"/>
          <path d="M28 26v8l7-4-7-4z" fill="currentColor" opacity="0.9"/>
          <path d="M24 50h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
          <path d="M32 46v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
        </svg>
      ),
      tagline: 'Movies & TV Shows',
      desc: 'Film blockbuster, serial TV populer, K-Drama, dan konten dari seluruh dunia.',
      path: '/movies',
      features: ['Movies & Series', 'Multi-Server', 'Global Content'],
    },
    {
      name: 'sooramics',
      accent: 'amics',
      color: '#00d4aa',
      glow: 'rgba(0, 212, 170, 0.3)',
      icon: (
        <svg viewBox="0 0 64 64" fill="none" width="48" height="48">
          <rect x="10" y="8" width="20" height="28" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3" transform="rotate(-5 20 22)"/>
          <rect x="34" y="8" width="20" height="28" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3" transform="rotate(5 44 22)"/>
          <rect x="22" y="12" width="20" height="28" rx="2" fill="currentColor" opacity="0.15"/>
          <path d="M28 20h8M28 24h6M28 28h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
          <circle cx="32" cy="50" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          <path d="M30 48l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
        </svg>
      ),
      tagline: 'Manga & Comics',
      desc: 'Baca manga, manhwa, manhua, dan komik favorit. Koleksi terlengkap, terupdate.',
      path: '/manga',
      features: ['Manga & Manhwa', 'Full Color', 'Free Reading'],
    },
  ];

  return (
    <div className="landing-page">
      <canvas ref={canvasRef} className="landing-particles" />

      {/* Gradient orbs */}
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />

      <div className="landing-content">
        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-mark">
            <svg viewBox="0 0 40 40" width="36" height="36" fill="none">
              <circle cx="20" cy="20" r="17" stroke="url(#logoGrad)" strokeWidth="2"/>
              <path d="M13 26C13.8 27 15.5 28 18 28c3.5 0 5.5-2 5.5-4.2 0-2.3-1.8-3.2-4.5-3.8l-1-.2C15.5 19.3 14 18.5 14 16.8c0-1.8 1.8-3.3 4.2-3.3 1.8 0 3.2.7 4 1.5" stroke="url(#logoGrad)" strokeWidth="2.2" strokeLinecap="round"/>
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#7c5cfc"/>
                  <stop offset="50%" stopColor="#ff6b9d"/>
                  <stop offset="100%" stopColor="#00d4aa"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="landing-logo-text">soora</h1>
        </div>

        <p className="landing-tagline">Your Universe of Entertainment</p>
        <p className="landing-subtitle">Anime, Movies, Manga — semua dalam satu tempat.</p>

        {/* Brand cards */}
        <div className="landing-cards">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className={`landing-card ${!brand.path ? 'landing-card-soon' : ''}`}
              style={{ '--card-color': brand.color, '--card-glow': brand.glow }}
              onClick={() => brand.path && navigate(brand.path)}
            >
              <div className="landing-card-glow" />
              <div className="landing-card-icon">{brand.icon}</div>
              <h2 className="landing-card-name">
                soor<span style={{ color: brand.color }}>{brand.accent}</span>
              </h2>
              <span className="landing-card-tagline">{brand.tagline}</span>
              <p className="landing-card-desc">{brand.desc}</p>
              <div className="landing-card-features">
                {brand.features.map((f) => (
                  <span key={f} className="landing-card-feature">{f}</span>
                ))}
              </div>
              <div className="landing-card-cta">
                {brand.path ? (
                  <span className="landing-card-btn">
                    Masuk
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </span>
                ) : (
                  <span className="landing-card-btn landing-card-btn-soon">Coming Soon</span>
                )}
              </div>
              {!brand.path && <div className="landing-card-overlay-soon" />}
            </div>
          ))}
        </div>

        <footer className="landing-footer">
          <p>&copy; 2026 soora. Open-source entertainment platform.</p>
        </footer>
      </div>
    </div>
  );
}
