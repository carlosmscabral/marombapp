/**
 * Screen Wake Lock hook for active gym sessions.
 * Keeps the phone display awake between sets and re-acquires the lock after app switches.
 */

import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockAPI {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

/**
 * Requests a screen wake lock while `active` is true.
 * When the browser hides the tab, the platform releases the sentinel automatically.
 * Listening to the `release` event clears the local reference so `visibilitychange`
 * acquires a fresh sentinel when the user returns to the workout screen.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockAPI }).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const handleSentinelRelease = () => {
      sentinel = null;
    };

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) {
          await next.release().catch(() => {});
          return;
        }
        sentinel = next;
        next.addEventListener('release', handleSentinelRelease);
      } catch {
        /* If the browser blocks or lacks Wake Lock support, fail silently. */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        sentinel.removeEventListener('release', handleSentinelRelease);
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [active]);
}
