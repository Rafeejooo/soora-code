/**
 * Soora PWA — Mobile Optimizations
 * ─────────────────────────────────
 * - Disable pull-to-refresh & overscroll bounce
 * - Handle Android back button (exit app at root, else history.back)
 * - Auto-landscape on fullscreen video (streaming pages)
 * - Prevent accidental double-tap zoom
 *
 * Import once in App.jsx — all effects auto-cleanup.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Checks if the current page is a root-level page (no meaningful "back").
 */
const ROOT_PATHS = ['/', '/anime', '/movies', '/manga', '/login', '/register'];

export function usePWAMobileOptimizations() {
  const location = useLocation();
  const navigate = useNavigate();

  // ─── 1. Disable overscroll / pull-to-refresh via CSS ───
  useEffect(() => {
    // Apply once — CSS handles it globally
    const style = document.createElement('style');
    style.id = 'pwa-overscroll-fix';
    style.textContent = `
      html, body {
        overscroll-behavior: none;
        overscroll-behavior-y: none;
        -webkit-overflow-scrolling: touch;
      }
      /* Prevent rubber-banding on iOS standalone */
      html.pwa-standalone {
        position: fixed;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      html.pwa-standalone body {
        width: 100%;
        height: 100%;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      /* Safe area insets for notched phones */
      body {
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
        padding-right: env(safe-area-inset-right);
      }
      /* Prevent text selection on long-press (app-like feel) */
      .pwa-standalone .hero-banner,
      .pwa-standalone .card,
      .pwa-standalone .btn-play,
      .pwa-standalone .navbar {
        -webkit-user-select: none;
        user-select: none;
      }
    `;

    if (!document.getElementById('pwa-overscroll-fix')) {
      document.head.appendChild(style);
    }

    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      document.documentElement.classList.add('pwa-standalone');
    }

    return () => {
      const el = document.getElementById('pwa-overscroll-fix');
      if (el) el.remove();
      document.documentElement.classList.remove('pwa-standalone');
    };
  }, []);

  // ─── 2. Android Back Button handling ───
  useEffect(() => {
    // Push a dummy state so we can intercept popstate
    const handlePopState = (e) => {
      const isRoot = ROOT_PATHS.includes(location.pathname);

      if (isRoot) {
        // At root — try to close the app (Android TWA / standalone)
        // Push state back so pressing back again also works
        if (window.history.length <= 1) {
          // Nothing to go back to — minimize/close
          // On TWA/PWA this effectively minimizes the app
          window.close?.();
        }
        // Browser will handle the default back behavior
      }
      // If not at root, default browser back behavior applies (SPA router handles it)
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location.pathname, navigate]);

  // ─── 3. Auto-landscape for streaming pages ───
  useEffect(() => {
    const isWatchPage = location.pathname.startsWith('/watch');

    if (!isWatchPage) return;

    // Request landscape when entering fullscreen on watch pages
    const handleFullscreenChange = () => {
      if (document.fullscreenElement && screen.orientation?.lock) {
        screen.orientation.lock('landscape').catch(() => {
          // Orientation lock not supported or user denied — ignore
        });
      } else if (!document.fullscreenElement && screen.orientation?.unlock) {
        screen.orientation.unlock?.();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      // Unlock orientation when leaving watch page
      if (screen.orientation?.unlock) {
        screen.orientation.unlock?.();
      }
    };
  }, [location.pathname]);

  // ─── 4. Prevent double-tap zoom (PWA standalone mode) ───
  useEffect(() => {
    let lastTouchEnd = 0;
    const handler = (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    document.addEventListener('touchend', handler, { passive: false });
    return () => document.removeEventListener('touchend', handler);
  }, []);
}
