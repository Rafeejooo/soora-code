/**
 * Platform-aware mobile optimizations wrapper.
 * Delegates to useNativeMobile (Capacitor) or usePWAMobile (browser).
 *
 * Since IS_NATIVE is a module-level constant (determined once at import time),
 * the branch is always the same — React's rules of hooks are satisfied.
 */

import { IS_NATIVE } from '../config.js';
import { useNativeMobileOptimizations } from './useNativeMobile';
import { usePWAMobileOptimizations } from './usePWAMobile';

export function useMobileOptimizations() {
  if (IS_NATIVE) {
    useNativeMobileOptimizations();
  } else {
    usePWAMobileOptimizations();
  }
}
