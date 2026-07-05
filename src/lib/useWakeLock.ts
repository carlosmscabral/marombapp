import { useEffect } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface WakeLockAPI {
  request: (type: 'screen') => Promise<WakeLockSentinelLike>;
}

/**
 * useWakeLock keeps the screen awake while `active` is true.
 * Re-acquires on visibilitychange when returning to visible (the platform drops
 * the lock when the tab hides). Fails silently on browsers without the API.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockAPI }).wakeLock;
    if (!wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await wakeLock.request('screen');
        if (cancelled && sentinel) {
          await sentinel.release().catch(() => {});
          sentinel = null;
        }
      } catch {
        // Wake Lock API not universally supported / may reject when hidden.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [active]);
}
