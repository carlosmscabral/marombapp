/**
 * Session-scoped rest timer storage and sticky top bar component.
 * Persists the rest start timestamp in `sessionStorage` so tab switches and reloads keep the clock running.
 */

import { createContext } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '../../components/Layout';
import { formatElapsed } from '../../lib/format';

/** Callback invoked when the user completes a set so the rest clock restarts from zero. */
export const StartRestContext = createContext<() => void>(() => {});

const REST_KEY = 'maromba.restTimer';

/**
 * Reads the persisted rest timer start timestamp for `sessionId` from `sessionStorage`.
 * Keying by `sessionId` prevents a stale timer from leaking into a subsequent workout.
 */
export function loadRest(sessionId: string): number | null {
  try {
    const raw = sessionStorage.getItem(REST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { startedAt?: unknown; sessionId?: unknown };
    if (p.sessionId !== sessionId || typeof p.startedAt !== 'number') return null;
    return p.startedAt;
  } catch {
    return null;
  }
}

/**
 * Saves or clears the rest timer start timestamp in `sessionStorage`.
 */
export function saveRest(sessionId: string, startedAt: number | null): void {
  try {
    if (startedAt != null) {
      sessionStorage.setItem(REST_KEY, JSON.stringify({ startedAt, sessionId }));
    } else {
      sessionStorage.removeItem(REST_KEY);
    }
  } catch {
    /* If sessionStorage is unavailable, the timer continues running in memory. */
  }
}

/**
 * Sticky top bar displaying elapsed rest time since the last completed set.
 * Before the first completed set, the clock renders dimmed at `00:00`.
 */
export function RestBar({ elapsedMs, running }: { elapsedMs: number; running: boolean }) {
  return (
    <div className="sticky top-16 z-40 -mx-4 px-4 py-2 bg-surface-container-high/95 backdrop-blur-md border-b border-outline-variant/20 flex items-center gap-3">
      <Timer
        className={cn(
          'w-5 h-5',
          running ? 'text-tertiary-fixed' : 'text-on-surface-variant/40',
        )}
      />
      <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        Rest
      </span>
      <span
        className={cn(
          'ml-auto font-headline text-2xl font-bold tabular-nums',
          running ? 'text-on-surface' : 'text-on-surface-variant/40',
        )}
      >
        {formatElapsed(elapsedMs)}
      </span>
    </div>
  );
}
