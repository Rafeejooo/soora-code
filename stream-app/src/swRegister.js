/**
 * Service Worker registration for Soora PWA
 * ──────────────────────────────────────────
 * - Registers /sw.js in production (served from public/)
 * - Listens for updates and notifies when a new version is available
 * - Provides `onUpdate` callback for optional UI prompt
 */

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/)
);

/**
 * Register the service worker.
 *
 * @param {{ onUpdate?: (registration: ServiceWorkerRegistration) => void,
 *           onSuccess?: (registration: ServiceWorkerRegistration) => void }} config
 */
export function register(config = {}) {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = '/sw.js';

    if (isLocalhost) {
      // In dev, validate SW exists then register
      checkValidSW(swUrl, config);
      navigator.serviceWorker.ready.then(() => {
        console.log('[SW] Running in localhost mode');
      });
    } else {
      registerValidSW(swUrl, config);
    }
  });
}

async function registerValidSW(swUrl, config) {
  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/',
    });

    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New content is available; old content will be purged
            console.log('[SW] New content available; will update on next reload');
            config?.onUpdate?.(registration);
          } else {
            // Content is cached for offline use
            console.log('[SW] Content cached for offline use');
            config?.onSuccess?.(registration);
          }
        }
      };
    };
  } catch (error) {
    console.error('[SW] Registration failed:', error);
  }
}

async function checkValidSW(swUrl, config) {
  try {
    const response = await fetch(swUrl, {
      headers: { 'Service-Worker': 'script' },
    });
    const contentType = response.headers.get('content-type');
    if (
      response.status === 404 ||
      (contentType && !contentType.includes('javascript'))
    ) {
      // SW not found — unregister and reload
      const registration = await navigator.serviceWorker.ready;
      await registration.unregister();
      window.location.reload();
    } else {
      registerValidSW(swUrl, config);
    }
  } catch {
    console.log('[SW] No internet connection. App running in offline mode.');
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error('[SW] Unregister failed:', error));
  }
}
