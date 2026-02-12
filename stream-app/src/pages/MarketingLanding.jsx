import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

/* ── SVG Icon components — clean, no emojis ── */
const Icons = {
  play: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  check: (c = '#00d4aa') => <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  film: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><rect x="2" y="2" width="20" height="20" rx="3"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="12" x2="22" y2="12"/><line x1="17" y1="17" x2="22" y2="17"/></svg>,
  book: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
  tv: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>,
  globe: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>,
  server: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  zap: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  crown: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22"><path d="M2 20h20L19 8l-5 6-2-8-2 8-5-6-3 12z"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  bookmark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  message: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  hd: <svg viewBox="0 0 28 20" fill="none" width="22" height="16"><rect x="1" y="1" width="26" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><text x="14" y="14" textAnchor="middle" fill="currentColor" fontSize="9" fontWeight="bold" fontFamily="system-ui">HD</text></svg>,
  star: <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
};

export default function MarketingLanding() {
  const navigate = useNavigate();
  const [visibleSections, setVisibleSections] = useState(new Set());
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [statCounts, setStatCounts] = useState({ anime: 0, movies: 0, manga: 0, users: 0 });
  const [activePlan, setActivePlan] = useState('login');
  const canvasRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    const h = (e) => setMousePos({ x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 });
    window.addEventListener('mousemove', h);
    return () => window.removeEventListener('mousemove', h);
  }, []);

  useEffect(() => {
    const h = () => { setScrollY(window.scrollY); setNavSolid(window.scrollY > 60); };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setVisibleSections((p) => new Set([...p, e.target.dataset.section])); });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('[data-section]').forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visibleSections.has('stats')) return;
    const targets = { anime: 10000, movies: 5000, manga: 50000, users: 100000 };
    const dur = 2200, start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / dur, 1), ease = 1 - Math.pow(1 - t, 4);
      setStatCounts({ anime: Math.floor(targets.anime * ease), movies: Math.floor(targets.movies * ease), manga: Math.floor(targets.manga * ease), users: Math.floor(targets.users * ease) });
      if (t < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [visibleSections]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); let animId;
    const ps = [];
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    for (let i = 0; i < 45; i++) ps.push({ x: Math.random() * c.width, y: Math.random() * c.height, vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12, r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.2 + 0.03 });
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0; if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(124,92,252,${p.a})`; ctx.fill(); });
      ctx.strokeStyle = 'rgba(124,92,252,0.012)'; ctx.lineWidth = 0.5;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y; if (dx * dx + dy * dy < 11000) { ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke(); } }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const features = [
    { icon: Icons.film, title: 'Streaming Tanpa Batas', desc: 'Tonton anime, film, dan serial TV tanpa batasan. Library konten diperbarui setiap hari.', color: '#7c5cfc' },
    { icon: Icons.book, title: 'Baca Manga Gratis', desc: 'Koleksi manga, manhwa, dan manhua terlengkap. Chapter terbaru secepat rilisnya.', color: '#00d4aa' },
    { icon: Icons.server, title: 'Multi-Server Backup', desc: 'Server down? Switch ke cadangan. Tidak ada lagi buffering tanpa akhir.', color: '#ff6b9d' },
    { icon: Icons.globe, title: 'Subtitle Indonesia', desc: 'Mayoritas konten dilengkapi subtitle Bahasa Indonesia berkualitas.', color: '#fbbf24' },
    { icon: Icons.zap, title: 'Loading Super Cepat', desc: 'CDN global memastikan streaming lancar tanpa loading lama.', color: '#22d3ee' },
    { icon: Icons.shield, title: 'Tanpa Iklan Popup', desc: 'Pengalaman bersih. Tidak ada popup, redirect, atau iklan mengganggu.', color: '#a78bfa' },
  ];

  const platforms = [
    { name: 'sooranime', accent: '#7c5cfc', icon: Icons.tv, tag: 'Anime Streaming', desc: '10,000+ judul anime dengan sub Indonesia, update seasonal tiap minggu.' },
    { name: 'sooraflix', accent: '#ff6b9d', icon: Icons.film, tag: 'Film & Series', desc: 'Film Hollywood, K-Drama, TV Series lengkap dengan multi-server.' },
    { name: 'sooramics', accent: '#00d4aa', icon: Icons.book, tag: 'Manga & Comics', desc: '50,000+ chapter manga, manhwa, dan manhua — baca sepuasnya.' },
  ];

  const freeFeatures = ['Streaming anime unlimited', 'Nonton film & series', 'Baca manga sepuasnya', 'Kualitas hingga 720p', 'Multi-server backup', 'Subtitle Indonesia', 'Update konten harian', 'Tanpa iklan popup'];
  const loginFeatures = ['Semua fitur Free', 'HD 1080p — 1x per hari', 'Bookmark & My List', 'Komentar & diskusi', 'Like & rating konten', 'Histori nonton', 'Sinkronisasi perangkat', 'Profil personal'];
  const vipFeatures = ['Semua fitur Login', 'HD 1080p unlimited', 'Bookmark tanpa batas', 'Prioritas server', 'Request konten baru', 'Badge VIP eksklusif', 'Early access fitur', 'Support prioritas'];

  const comparison = [
    { feature: 'Streaming Anime & Film', free: true, login: true, vip: true },
    { feature: 'Baca Manga', free: true, login: true, vip: true },
    { feature: 'Kualitas 720p', free: true, login: true, vip: true },
    { feature: 'Kualitas HD 1080p', free: false, login: '1x/hari', vip: true },
    { feature: 'Bookmark & My List', free: false, login: true, vip: true },
    { feature: 'Komentar & Diskusi', free: false, login: true, vip: true },
    { feature: 'Like & Rating', free: false, login: true, vip: true },
    { feature: 'Histori Nonton', free: false, login: true, vip: true },
    { feature: 'Prioritas Server', free: false, login: false, vip: true },
    { feature: 'Request Konten', free: false, login: false, vip: true },
    { feature: 'Badge Eksklusif', free: false, login: false, vip: true },
  ];

  const testimonials = [
    { name: 'Andi R.', text: 'Akhirnya ada platform yang beneran gratis dan kualitasnya bagus. UI-nya clean banget.', rating: 5 },
    { name: 'Sarah M.', text: 'Koleksi animenya lengkap, dari klasik sampai yang baru tayang. Sub Indo juga cepat.', rating: 5 },
    { name: 'Dimas K.', text: 'Baca manga disini ketagihan. Loading cepat, chapter rapi, dan gratis.', rating: 5 },
    { name: 'Putri A.', text: 'My List berguna banget buat tracking. Player-nya smooth, no buffering.', rating: 5 },
  ];

  return (
    <div className="ml">
      <canvas ref={canvasRef} className="ml-particles" />
      <div className="ml-orb ml-orb-1" style={{ transform: `translate(${mousePos.x * 25}px, ${mousePos.y * 25}px)` }} />
      <div className="ml-orb ml-orb-2" style={{ transform: `translate(${-mousePos.x * 18}px, ${mousePos.y * 15}px)` }} />

      {/* NAV */}
      <nav className={`ml-nav ${navSolid ? 'ml-nav-solid' : ''}`}>
        <div className="ml-nav-inner">
          <div className="ml-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="ml-logo-icon">
              <svg viewBox="0 0 36 36" width="26" height="26" fill="none"><circle cx="18" cy="18" r="15" stroke="url(#mlG)" strokeWidth="2"/><path d="M12 24c.7.9 2.2 1.8 4.5 1.8 3.2 0 5-1.8 5-3.8 0-2.1-1.6-2.9-4-3.5l-.9-.2c-2.2-.5-3.5-1.2-3.5-2.7 0-1.6 1.6-3 3.8-3 1.6 0 2.9.6 3.6 1.4" stroke="url(#mlG)" strokeWidth="2" strokeLinecap="round"/><defs><linearGradient id="mlG" x1="0" y1="0" x2="36" y2="36"><stop offset="0%" stopColor="#7c5cfc"/><stop offset="100%" stopColor="#00d4aa"/></linearGradient></defs></svg>
            </div>
            <span className="ml-logo-text">soora</span>
          </div>
          <div className="ml-nav-links">
            <a href="#features" className="ml-nav-link">Fitur</a>
            <a href="#platforms" className="ml-nav-link">Platform</a>
            <a href="#pricing" className="ml-nav-link">Harga</a>
          </div>
          <div className="ml-nav-actions">
            <button className="ml-btn-ghost-sm" onClick={() => navigate('/login')}>Masuk</button>
            <button className="ml-btn-primary-sm" onClick={() => navigate('/register')}>Daftar Gratis</button>
          </div>
          <button className="ml-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span className={mobileMenuOpen ? 'open' : ''} /><span className={mobileMenuOpen ? 'open' : ''} /><span className={mobileMenuOpen ? 'open' : ''} />
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="ml-mobile-dropdown">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>Fitur</a>
            <a href="#platforms" onClick={() => setMobileMenuOpen(false)}>Platform</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Harga</a>
            <div className="ml-mobile-btns">
              <button onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}>Masuk</button>
              <button className="primary" onClick={() => { setMobileMenuOpen(false); navigate('/register'); }}>Daftar Gratis</button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="ml-hero" data-section="hero">
        <div className={`ml-hero-content ${visibleSections.has('hero') ? 'visible' : ''}`} style={{ transform: `translateY(${scrollY * 0.12}px)` }}>
          <div className="ml-hero-badge"><span className="ml-badge-pulse" />100% GRATIS — Tanpa Batas</div>
          <h1 className="ml-hero-title">Semua Hiburan.<br /><span className="ml-gradient-text">Satu Platform.</span></h1>
          <p className="ml-hero-sub">Anime, film, series, manga — streaming dan baca sepuasnya.<br />Gratis selamanya. Tanpa kartu kredit. Tanpa kompromi.</p>
          <div className="ml-hero-btns">
            <button className="ml-btn-primary ml-btn-glow" onClick={() => navigate('/register')}>Mulai Sekarang{Icons.arrow}</button>
            <button className="ml-btn-secondary" onClick={() => navigate('/app')}>{Icons.play}Jelajahi Dulu</button>
          </div>
          <div className="ml-hero-mini-stats">
            {[{ n: '10K+', l: 'Anime' }, { n: '5K+', l: 'Film' }, { n: '50K+', l: 'Manga' }, { n: '100K+', l: 'Users' }].map((s, i) => (
              <div key={i} className="ml-hero-mini-stat">{i > 0 && <span className="ml-mini-divider" />}<span className="ml-mini-num">{s.n}</span><span className="ml-mini-label">{s.l}</span></div>
            ))}
          </div>
        </div>
        <div className={`ml-hero-visual ${visibleSections.has('hero') ? 'visible' : ''}`} style={{ transform: `translateY(${scrollY * 0.06}px)` }}>
          <div className="ml-hero-cards">
            {platforms.map((p, i) => (
              <div key={i} className="ml-hero-card" style={{ '--card-accent': p.accent, animationDelay: `${i * 0.18}s`, transform: `translate(${mousePos.x * (8 - i * 3)}px, ${mousePos.y * (6 - i * 2)}px)` }}>
                <div className="ml-hero-card-icon">{p.icon}</div>
                <div className="ml-hero-card-info">
                  <span className="ml-hero-card-name" style={{ color: p.accent }}>{p.name}</span>
                  <span className="ml-hero-card-tag">{p.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="ml-features" id="features" data-section="features">
        <div className={`ml-section-head ${visibleSections.has('features') ? 'visible' : ''}`}>
          <span className="ml-section-tag">Fitur Utama</span>
          <h2 className="ml-section-title">Semua yang Kamu Butuhkan</h2>
          <p className="ml-section-desc">Platform all-in-one untuk seluruh kebutuhan hiburanmu</p>
        </div>
        <div className={`ml-features-grid ${visibleSections.has('features') ? 'visible' : ''}`}>
          {features.map((f, i) => (
            <div key={i} className="ml-feature-card" style={{ '--feat-color': f.color, animationDelay: `${i * 0.08}s` }}>
              <div className="ml-feature-icon">{f.icon}</div>
              <h3 className="ml-feature-title">{f.title}</h3>
              <p className="ml-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="ml-platforms" id="platforms" data-section="platforms">
        <div className={`ml-section-head ${visibleSections.has('platforms') ? 'visible' : ''}`}>
          <span className="ml-section-tag">3 Platform, 1 Akun</span>
          <h2 className="ml-section-title">Pilih Duniamu</h2>
        </div>
        <div className={`ml-platforms-grid ${visibleSections.has('platforms') ? 'visible' : ''}`}>
          {platforms.map((p, i) => (
            <div key={i} className="ml-platform-card" style={{ '--pl-color': p.accent, animationDelay: `${i * 0.12}s` }}>
              <div className="ml-platform-icon" style={{ color: p.accent }}>{p.icon}</div>
              <h3 className="ml-platform-name" style={{ color: p.accent }}>{p.name}</h3>
              <span className="ml-platform-tag">{p.tag}</span>
              <p className="ml-platform-desc">{p.desc}</p>
              <button className="ml-platform-btn" style={{ '--pl-color': p.accent }} onClick={() => navigate('/app')}>
                Jelajahi <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="ml-pricing" id="pricing" data-section="pricing">
        <div className={`ml-section-head ${visibleSections.has('pricing') ? 'visible' : ''}`}>
          <span className="ml-section-tag">Harga</span>
          <h2 className="ml-section-title">Pilih Sesuai Kebutuhanmu</h2>
          <p className="ml-section-desc">Mulai dari gratis. Upgrade kapan saja.</p>
        </div>
        <div className={`ml-plan-toggle ${visibleSections.has('pricing') ? 'visible' : ''}`}>
          {['free', 'login', 'vip'].map((p) => (
            <button key={p} className={`ml-plan-tab ${activePlan === p ? 'active' : ''}`} onClick={() => setActivePlan(p)}>
              {p === 'free' ? 'Gratis' : p === 'login' ? 'Login' : 'VIP'}
            </button>
          ))}
        </div>
        <div className={`ml-pricing-grid ${visibleSections.has('pricing') ? 'visible' : ''}`}>
          {/* Free */}
          <div className={`ml-price-card ${activePlan === 'free' ? 'ml-price-highlight' : ''}`}>
            <div className="ml-price-head"><span className="ml-price-name">Free</span><div className="ml-price-amount"><span className="ml-price-currency">Rp</span><span className="ml-price-number">0</span></div><span className="ml-price-period">Gratis selamanya</span></div>
            <p className="ml-price-desc">Akses semua konten tanpa bayar. Tanpa trial, tanpa batas waktu.</p>
            <ul className="ml-price-list">{freeFeatures.map((f, i) => <li key={i}>{Icons.check()}<span>{f}</span></li>)}</ul>
            <button className="ml-btn-primary ml-price-btn" onClick={() => navigate('/app')}>Mulai Gratis</button>
          </div>
          {/* Login */}
          <div className={`ml-price-card ml-price-popular ${activePlan === 'login' ? 'ml-price-highlight' : ''}`}>
            <div className="ml-price-badge">Rekomendasi</div>
            <div className="ml-price-head"><span className="ml-price-name">Login</span><div className="ml-price-amount"><span className="ml-price-currency">Rp</span><span className="ml-price-number">0</span></div><span className="ml-price-period">Cukup buat akun gratis</span></div>
            <p className="ml-price-desc">Daftar untuk unlock fitur sosial, bookmark, dan HD 1080p 1x/hari.</p>
            <ul className="ml-price-list">{loginFeatures.map((f, i) => <li key={i}>{Icons.check('#7c5cfc')}<span>{f}</span></li>)}</ul>
            <button className="ml-btn-primary ml-price-btn" onClick={() => navigate('/register')}>Daftar Sekarang</button>
          </div>
          {/* VIP */}
          <div className={`ml-price-card ml-price-vip ${activePlan === 'vip' ? 'ml-price-highlight' : ''}`}>
            <div className="ml-price-vip-badge">{Icons.crown}<span>VIP</span></div>
            <div className="ml-price-head"><span className="ml-price-name">VIP</span><div className="ml-price-amount"><span className="ml-price-currency">Rp</span><span className="ml-price-number">19K</span></div><span className="ml-price-period">/ bulan</span></div>
            <p className="ml-price-desc">HD 1080p unlimited, semua fitur terbuka penuh, prioritas server.</p>
            <ul className="ml-price-list">{vipFeatures.map((f, i) => <li key={i}>{Icons.check('#fbbf24')}<span>{f}</span></li>)}</ul>
            <button className="ml-btn-vip ml-price-btn" onClick={() => navigate('/register')}>Upgrade ke VIP</button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className={`ml-compare ${visibleSections.has('pricing') ? 'visible' : ''}`}>
          <h3 className="ml-compare-title">Perbandingan Lengkap</h3>
          <div className="ml-compare-table">
            <div className="ml-compare-header"><div className="ml-compare-feat">Fitur</div><div>Free</div><div>Login</div><div className="ml-compare-vip">VIP</div></div>
            {comparison.map((r, i) => (
              <div key={i} className="ml-compare-row">
                <div className="ml-compare-feat">{r.feature}</div>
                <div>{r.free === true ? Icons.check() : r.free === false ? Icons.x : <span className="ml-compare-sp">{r.free}</span>}</div>
                <div>{r.login === true ? Icons.check('#7c5cfc') : r.login === false ? Icons.x : <span className="ml-compare-sp">{r.login}</span>}</div>
                <div className="ml-compare-vip">{r.vip === true ? Icons.check('#fbbf24') : r.vip === false ? Icons.x : <span className="ml-compare-sp">{r.vip}</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VIP SPOTLIGHT */}
      <section className="ml-vip-section" data-section="vip">
        <div className={`ml-vip-inner ${visibleSections.has('vip') ? 'visible' : ''}`}>
          <div className="ml-vip-content">
            <div className="ml-vip-tag">{Icons.crown}<span>VIP Experience</span></div>
            <h2 className="ml-vip-title">Unlock <span className="ml-gradient-gold">Full HD 1080p</span></h2>
            <p className="ml-vip-desc">Nikmati pengalaman menonton tanpa kompromi. Kualitas HD 1080p unlimited, akses prioritas server, dan fitur eksklusif lainnya.</p>
            <div className="ml-vip-perks">
              {[
                { icon: Icons.hd, label: '1080p Unlimited', desc: 'Streaming HD tanpa batasan harian' },
                { icon: Icons.bookmark, label: 'Bookmark Tanpa Batas', desc: 'Simpan konten favoritmu' },
                { icon: Icons.message, label: 'Komentar & Diskusi', desc: 'Interaksi dengan komunitas' },
                { icon: Icons.heart, label: 'Like & Rating', desc: 'Beri rating konten favorit' },
              ].map((pk, i) => (
                <div key={i} className="ml-vip-perk" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="ml-vip-perk-icon">{pk.icon}</div>
                  <div><span className="ml-vip-perk-label">{pk.label}</span><span className="ml-vip-perk-desc">{pk.desc}</span></div>
                </div>
              ))}
            </div>
            <button className="ml-btn-vip ml-btn-lg" onClick={() => navigate('/register')}>{Icons.crown}Upgrade ke VIP — Rp 29K/bulan</button>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="ml-stats" data-section="stats">
        <div className={`ml-stats-inner ${visibleSections.has('stats') ? 'visible' : ''}`}>
          {[{ label: 'Anime', value: statCounts.anime, suffix: '+', color: '#7c5cfc' }, { label: 'Film & Series', value: statCounts.movies, suffix: '+', color: '#ff6b9d' }, { label: 'Chapter Manga', value: statCounts.manga, suffix: '+', color: '#00d4aa' }, { label: 'Pengguna Aktif', value: statCounts.users, suffix: '+', color: '#fbbf24' }].map((s, i) => (
            <div key={i} className="ml-stat"><span className="ml-stat-value" style={{ color: s.color }}>{s.value.toLocaleString()}{s.suffix}</span><span className="ml-stat-label">{s.label}</span></div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="ml-testimonials" data-section="testimonials">
        <div className={`ml-section-head ${visibleSections.has('testimonials') ? 'visible' : ''}`}>
          <span className="ml-section-tag">Testimonials</span>
          <h2 className="ml-section-title">Kata Pengguna Kami</h2>
        </div>
        <div className={`ml-testimonials-grid ${visibleSections.has('testimonials') ? 'visible' : ''}`}>
          {testimonials.map((t, i) => (
            <div key={i} className="ml-testimonial" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="ml-testimonial-stars">{Array.from({ length: t.rating }).map((_, j) => <span key={j} style={{ color: '#fbbf24' }}>{Icons.star}</span>)}</div>
              <p className="ml-testimonial-text">"{t.text}"</p>
              <div className="ml-testimonial-author"><div className="ml-testimonial-avatar" style={{ background: ['#7c5cfc', '#ff6b9d', '#00d4aa', '#fbbf24'][i] }}>{t.name[0]}</div><span>{t.name}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="ml-cta" data-section="cta">
        <div className={`ml-cta-inner ${visibleSections.has('cta') ? 'visible' : ''}`}>
          <h2 className="ml-cta-title">Siap untuk Mulai?</h2>
          <p className="ml-cta-desc">Bergabung dengan 100,000+ pengguna. Gratis selamanya, upgrade kapan saja.</p>
          <div className="ml-cta-btns">
            <button className="ml-btn-primary ml-btn-lg ml-btn-glow" onClick={() => navigate('/register')}>Buat Akun Gratis{Icons.arrow}</button>
            <button className="ml-btn-ghost" onClick={() => navigate('/login')}>Sudah punya akun? Masuk</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="ml-footer">
        <div className="ml-footer-inner">
          <div className="ml-footer-brand"><span className="ml-footer-logo">soora</span><p>Your Universe of Entertainment</p></div>
          <div className="ml-footer-cols">
            <div className="ml-footer-col"><h4>Platform</h4><a onClick={() => navigate('/app')}>sooranime</a><a onClick={() => navigate('/app')}>sooraflix</a><a onClick={() => navigate('/app')}>sooramics</a></div>
            <div className="ml-footer-col"><h4>Akun</h4><a onClick={() => navigate('/login')}>Masuk</a><a onClick={() => navigate('/register')}>Daftar</a></div>
            <div className="ml-footer-col"><h4>Info</h4><a href="#">Tentang Kami</a><a href="#">Kebijakan Privasi</a><a href="#">Syarat & Ketentuan</a></div>
          </div>
        </div>
        <div className="ml-footer-bottom"><p>2026 soora — Open-source entertainment platform.</p></div>
      </footer>
    </div>
  );
}
