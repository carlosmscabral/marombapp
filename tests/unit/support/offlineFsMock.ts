/**
 * Shared mock Firestore reference and timeout helpers for offline-resilience unit tests (#20, REQ-002).
 * Keeps individual data-layer and UI spec files concise without collapsing lines or weakening assertions.
 */

export interface MockColRef {
  kind: 'col';
  path: string;
}

export interface MockDocRef {
  kind: 'doc';
  id: string;
  path: string;
}

/**
 * Builds a mock `CollectionReference` from path segments.
 */
export function makeColRef(...segments: string[]): MockColRef {
  return { kind: 'col', path: segments.join('/') };
}

/**
 * Builds a mock `DocumentReference` under `parent`, generating a sequential client ID when `segments` is empty.
 */
export function makeDocRef(
  parent: { kind?: string; path?: string },
  segments: string[],
  nextId: () => string,
): MockDocRef {
  const base = parent?.kind === 'col' && parent.path ? [parent.path] : [];
  const parts = segments.length > 0 ? segments : [nextId()];
  const path = [...base, ...parts].join('/');
  return {
    kind: 'doc',
    id: path.split('/').pop() ?? '',
    path,
  };
}

/**
 * Builds a minimal Firestore `DocumentSnapshot`-like object for `getDoc` and `getDocFromCache` mocks.
 */
export function makeDocSnap(
  ref: MockDocRef,
  data: Record<string, unknown> | undefined,
) {
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => data ?? {},
  };
}

/**
 * Races `promise` against a `ms`-millisecond `'stalled'` sentinel to detect hanging network/ack awaits.
 */
export function raceTimeout<T>(
  promise: Promise<T>,
  ms = 50,
): Promise<T | 'stalled'> {
  return Promise.race([
    promise,
    new Promise<'stalled'>((resolve) => setTimeout(() => resolve('stalled'), ms)),
  ]);
}

/**
 * Builds a realistic active-session Firestore document record for in-gym unit tests.
 */
export function makeActiveSessionRecord(
  dayName: string,
  withBenchSet: boolean,
): Record<string, unknown> {
  return {
    planId: 'p1',
    planName: 'PPL',
    dayId: 'd1',
    dayName,
    startedAt: Date.now() - 1_800_000,
    finishedAt: null,
    status: 'active',
    sessionNotes: '',
    exercises: withBenchSet
      ? [
          {
            exerciseId: 'ex-bench',
            exerciseName: 'Barbell Bench Press',
            notes: '',
            sets: [{ weight: 100, reps: 6, completedAt: Date.now() - 60_000 }],
          },
        ]
      : [],
  };
}
