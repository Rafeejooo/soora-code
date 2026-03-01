import { useState, useEffect, useRef } from 'react';

/**
 * Fixed Install Card — always visible on home pages (unless already
 * installed as PWA). Triggers native install prompt on supported
 * browsers, otherwise shows manual instructions.
 */

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/* ── Module-level prompt cache (survives re-renders) ── */
let _deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredPrompt = e;
});

export default function MobileAppBanner() {
  const [installed, setInstalled] = useState(isStandalone);
  const [showGuide, setShowGuide] = useState(false);
  const promptRef = useRef(_deferredPrompt);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      promptRef.current = e;
      _deferredPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Hide card after successful install
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Don't show if already running as installed PWA
  if (installed) return null;

  const handleInstall = async () => {
    const prompt = promptRef.current || _deferredPrompt;
    if (prompt) {
      prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === 'accepted') {
        setInstalled(true);
      }
      promptRef.current = null;
      _deferredPrompt = null;
    } else {
      setShowGuide((v) => !v);
    }
  };

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  return (
    <div className="install-card">
      <div className="install-card-inner">
        <div className="install-card-icon">
          <img src="/soranime.svg" alt="Soora" width="44" height="44" />
        </div>
        <div className="install-card-body">
          <h3 className="install-card-title">Install Soora App</h3>
          <p className="install-card-desc">
            Akses cepat dari home screen — tanpa download dari Play Store
          </p>
          <button className="install-card-btn" onClick={handleInstall}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Install Sekarang
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="install-card-guide">
          {isIOS ? (
            <p>
              <strong>Safari:</strong> Ketuk{' '}
              <span className="install-card-key">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                Share
              </span>{' '}
              → <strong>"Add to Home Screen"</strong>
            </p>
          ) : isAndroid ? (
            <p>
              <strong>Chrome:</strong> Ketuk{' '}
              <span className="install-card-key">⋮</span> (menu) →{' '}
              <strong>"Install App"</strong> atau{' '}
              <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <p>
              Buka menu browser → <strong>"Install App"</strong> atau{' '}
              <strong>"Add to Home Screen"</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
