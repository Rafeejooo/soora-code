/**
 * Unified platform config — detects Capacitor native vs web browser.
 * Web: returns same values as before (relative paths via Vite proxy).
 * Native: points directly to production API/stream URLs.
 */
const isCapacitor = !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform());

export const IS_NATIVE = isCapacitor;

export const API_BASE = isCapacitor
  ? 'https://api.soora.fun'
  : (import.meta.env.VITE_API_URL || '/api');

export const STREAM_BASE = isCapacitor
  ? 'https://stream.soora.fun/proxy'
  : (import.meta.env.VITE_STREAM_URL
      ? `${import.meta.env.VITE_STREAM_URL}/proxy`
      : '/api/proxy');
