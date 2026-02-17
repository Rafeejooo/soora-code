import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [shake, setShake] = useState(false);
  const [step, setStep] = useState(1);
  const [focusedField, setFocusedField] = useState(null);
  const canvasRef = useRef(null);

  // Animated background particles
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    let animId;
    const ps = [];
    const resize = () => { c.width = c.parentElement.offsetWidth; c.height = c.parentElement.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 30; i++) {
      ps.push({
        x: Math.random() * c.width, y: Math.random() * c.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.15 + 0.03,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0;
        if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,107,157,${p.a})`; ctx.fill();
      });
      ctx.strokeStyle = 'rgba(255,107,157,0.02)'; ctx.lineWidth = 0.5;
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
        if (dx * dx + dy * dy < 8000) { ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke(); }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600); };

  const handleNext = () => {
    if (!formData.name.trim()) { setError('Nama tidak boleh kosong'); triggerShake(); return; }
    if (!formData.email.trim()) { setError('Email tidak boleh kosong'); triggerShake(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Format email tidak valid'); triggerShake(); return; }
    setStep(2);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) { handleNext(); return; }
    if (!formData.password) { setError('Password tidak boleh kosong'); triggerShake(); return; }
    if (formData.password.length < 6) { setError('Password minimal 6 karakter'); triggerShake(); return; }
    if (formData.password !== formData.confirmPassword) { setError('Password tidak sama'); triggerShake(); return; }
    if (!agreed) { setError('Kamu harus menyetujui syarat & ketentuan'); triggerShake(); return; }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    const result = register(formData.name, formData.email, formData.password);
    setLoading(false);
    if (result.success) { navigate('/'); } else { setError(result.error); triggerShake(); }
  };

  const getPasswordStrength = (pw) => {
    if (!pw) return { level: 0, text: '', color: '' };
    let s = 0;
    if (pw.length >= 6) s++; if (pw.length >= 10) s++;
    if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
    if (s <= 1) return { level: 1, text: 'Lemah', color: '#ff4757' };
    if (s <= 3) return { level: 2, text: 'Sedang', color: '#fbbf24' };
    return { level: 3, text: 'Kuat', color: '#00d4aa' };
  };
  const strength = getPasswordStrength(formData.password);

  const benefits = [
    { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg>, title: 'Anime & Film', desc: 'Streaming tanpa batas' },
    { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>, title: 'Manga', desc: 'Ribuan chapter tersedia' },
    { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>, title: 'My List', desc: 'Simpan favoritmu' },
  ];

  return (
    <div className="auth-page auth-split">
      {/* Left panel — branding */}
      <div className="auth-panel-left auth-panel-left--register">
        <canvas ref={canvasRef} className="auth-panel-canvas" />
        <div className="auth-panel-overlay" />
        <div className="auth-panel-content">
          <div className="auth-panel-logo" onClick={() => navigate('/')}>
            <svg viewBox="0 0 36 36" width="30" height="30" fill="none">
              <circle cx="18" cy="18" r="15" stroke="url(#regPG)" strokeWidth="2"/>
              <path d="M12 24c.7.9 2.2 1.8 4.5 1.8 3.2 0 5-1.8 5-3.8 0-2.1-1.6-2.9-4-3.5l-.9-.2c-2.2-.5-3.5-1.2-3.5-2.7 0-1.6 1.6-3 3.8-3 1.6 0 2.9.6 3.6 1.4" stroke="url(#regPG)" strokeWidth="2" strokeLinecap="round"/>
              <defs><linearGradient id="regPG" x1="0" y1="0" x2="36" y2="36"><stop offset="0%" stopColor="#ff6b9d"/><stop offset="100%" stopColor="#7c5cfc"/></linearGradient></defs>
            </svg>
            <span>soora</span>
          </div>
          <div className="auth-panel-hero">
            <h1>Mulai<br />Petualanganmu.</h1>
            <p>Daftar gratis dan nikmati ribuan anime, film, dan manga dalam genggaman.</p>
          </div>
          <div className="auth-panel-benefits">
            {benefits.map((b, i) => (
              <div key={i} className="auth-benefit-card" style={{ animationDelay: `${0.6 + i * 0.12}s` }}>
                <div className="auth-benefit-icon">{b.icon}</div>
                <div>
                  <strong>{b.title}</strong>
                  <span>{b.desc}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="auth-panel-bottom">
            <span>100% Gratis — Tanpa Kartu Kredit</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="auth-panel-right">
        <div className="auth-right-inner">
          <button className="auth-back-minimal" onClick={() => step === 2 ? setStep(1) : navigate('/')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>

          <div className={`auth-form-card ${shake ? 'auth-shake' : ''}`}>
            {/* Mobile logo */}
            <div className="auth-mobile-logo" onClick={() => navigate('/')}>
              <svg viewBox="0 0 36 36" width="26" height="26" fill="none">
                <circle cx="18" cy="18" r="15" stroke="url(#regMG)" strokeWidth="2"/>
                <path d="M12 24c.7.9 2.2 1.8 4.5 1.8 3.2 0 5-1.8 5-3.8 0-2.1-1.6-2.9-4-3.5l-.9-.2c-2.2-.5-3.5-1.2-3.5-2.7 0-1.6 1.6-3 3.8-3 1.6 0 2.9.6 3.6 1.4" stroke="url(#regMG)" strokeWidth="2" strokeLinecap="round"/>
                <defs><linearGradient id="regMG" x1="0" y1="0" x2="36" y2="36"><stop offset="0%" stopColor="#ff6b9d"/><stop offset="100%" stopColor="#7c5cfc"/></linearGradient></defs>
              </svg>
              <span>soora</span>
            </div>

            <h2 className="auth-form-title">Buat Akun</h2>
            <p className="auth-form-subtitle">
              {step === 1 ? 'Isi informasi dasar untuk memulai' : 'Buat password yang aman'}
            </p>

            {/* Step progress */}
            <div className="auth-step-progress">
              <div className={`auth-step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
              <div className={`auth-step-connector ${step >= 2 ? 'active' : ''}`} />
              <div className={`auth-step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
            </div>

            {error && (
              <div className="auth-error-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-elegant-form">
              {step === 1 ? (
                <div className="auth-step-slide" key="step1">
                  <div className={`auth-float-field ${focusedField === 'name' || formData.name ? 'focused' : ''}`}>
                    <div className="auth-field-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input
                      id="name" name="name" type="text"
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="name" required
                    />
                    <label htmlFor="name">Nama Lengkap</label>
                    <div className="auth-field-line" />
                  </div>

                  <div className={`auth-float-field ${focusedField === 'email' || formData.email ? 'focused' : ''}`}>
                    <div className="auth-field-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 7l10 6 10-6"/></svg>
                    </div>
                    <input
                      id="email" name="email" type="email"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="email" required
                    />
                    <label htmlFor="email">Email</label>
                    <div className="auth-field-line" />
                  </div>

                  <button type="submit" className="auth-btn-submit">
                    Lanjutkan
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              ) : (
                <div className="auth-step-slide" key="step2">
                  <div className={`auth-float-field ${focusedField === 'password' || formData.password ? 'focused' : ''}`}>
                    <div className="auth-field-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    </div>
                    <input
                      id="password" name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="new-password" required
                    />
                    <label htmlFor="password">Password</label>
                    <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                    <div className="auth-field-line" />
                  </div>

                  {formData.password && (
                    <div className="auth-strength-bar-row">
                      <div className="auth-strength-bars">
                        {[1, 2, 3].map((l) => (
                          <div key={l} className={`auth-str-seg ${strength.level >= l ? 'active' : ''}`} style={{ background: strength.level >= l ? strength.color : undefined }} />
                        ))}
                      </div>
                      <span className="auth-str-label" style={{ color: strength.color }}>{strength.text}</span>
                    </div>
                  )}

                  <div className={`auth-float-field ${focusedField === 'confirmPassword' || formData.confirmPassword ? 'focused' : ''}`}>
                    <div className="auth-field-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="3"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                    </div>
                    <input
                      id="confirmPassword" name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="new-password" required
                    />
                    <label htmlFor="confirmPassword">Konfirmasi Password</label>
                    {formData.confirmPassword && formData.password === formData.confirmPassword && (
                      <div className="auth-field-match">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                    <div className="auth-field-line" />
                  </div>

                  <label className="auth-agree-elegant">
                    <input type="checkbox" checked={agreed} onChange={() => setAgreed(!agreed)} />
                    <span className="auth-agree-box" />
                    <span>
                      Saya setuju dengan <a href="#" onClick={(e) => e.preventDefault()}>Syarat & Ketentuan</a> dan{' '}
                      <a href="#" onClick={(e) => e.preventDefault()}>Kebijakan Privasi</a>
                    </span>
                  </label>

                  <button type="submit" className="auth-btn-submit auth-btn-register" disabled={loading}>
                    {loading ? <span className="auth-btn-spinner" /> : (
                      <>Buat Akun Gratis <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
                    )}
                  </button>
                </div>
              )}
            </form>

            {step === 1 && (
              <>
                <div className="auth-or-divider"><span>atau lanjutkan dengan</span></div>
                <div className="auth-social-row">
                  <button className="auth-social-chip">
                    <svg viewBox="0 0 24 24" width="18" height="18"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </button>
                  <button className="auth-social-chip">
                    <svg viewBox="0 0 24 24" fill="#5865F2" width="18" height="18"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>
                    Discord
                  </button>
                </div>
              </>
            )}

            <p className="auth-form-switch">
              Sudah punya akun? <Link to="/login">Masuk</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
