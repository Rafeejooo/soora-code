/**
 * Soora Native App — Mobile Optimizations (Capacitor)
 * ────────────────────────────────────────────────────
 * - Status bar dark theme
 * - Android hardware back button handling
 * - Auto-landscape on fullscreen video
 * - Overscroll prevention & safe area CSS
 *
 * Replaces usePWAMobile.js when running inside Capacitor native shell.
 * Import once in App.jsx via useMobile.js wrapper.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';

const ROOT_PATHS = ['/', '/anime', '/movies', '/manga', '/login', '/register'];

export function useNativeMobileOptimizations() {
  const location = useLocation();
  const navigate = useNavigate();

  // ─── 1. Status bar — dark theme ───
  useEffect(() => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#06060e' }).catch(() => {});
  }, []);

  // ─── 2. Android back button — minimize at root, go back elsewhere ───
  useEffect(() => {
    const listener = CapApp.addListener('backButton', ({ canGoBack }) => {
      const isRoot = ROOT_PATHS.includes(location.pathname);
      if (isRoot || !canGoBack) {
        CapApp.minimizeApp();
      } else {
        navigate(-1);
      }
    });
    return () => {
      listener.then(l => l.remove());
    };
  }, [location.pathname, navigate]);

  // ─── 3. Auto-landscape on fullscreen video ───
  useEffect(() => {
    const isWatchPage = location.pathname.startsWith('/watch');
    if (!isWatchPage) return;

    const handleFullscreen = () => {
      if (document.fullscreenElement) {
        ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
      } else {
        ScreenOrientation.unlock().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('webkitfullscreenchange', handleFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('webkitfullscreenchange', handleFullscreen);
      ScreenOrientation.unlock().catch(() => {});
    };
  }, [location.pathname]);

  // ─── 4. Overscroll & safe area CSS ───
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'native-mobile-fix';
    style.textContent = `
      html, body {
        overscroll-behavior: none;
        -webkit-overflow-scrolling: touch;
      }
      body {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
      /* Prevent text selection on interactive elements (app-like feel) */
      .hero-banner, .card, .btn-play, .navbar {
        -webkit-user-select: none;
        user-select: none;
      }
      /* Disable callout on long-press images */
      img {
        -webkit-touch-callout: none;
      }
    `;

    if (!document.getElementById('native-mobile-fix')) {
      document.head.appendChild(style);
    }

    return () => {
      document.getElementById('native-mobile-fix')?.remove();
    };
  }, []);
}
