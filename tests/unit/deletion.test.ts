/**
 * Unit tests for hard plan and workout session deletion (#13, #14, REQ-002, REQ-006).
 * Verifies that `deletePlan` never calls network `getDocs`, merges `knownDayIds` with `getDocsFromCache`,
 * queues all child `days` and the parent plan in one batch without awaiting server ack,
 * and `deleteSession` deletes the session document while clearing its in-memory shadow.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionExercise } from '../../src/types';

interface DocRef {
  id: string;
  path: string;
}

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  batchCommits: 0,
  lastBatchDeletes: [] as string[],
  deleteDocCalls: [] as string[],
  getDocsCalls: [] as string[],
  getDocsFromCacheCalls: [] as string[],
  hangingNetwork: false,
  cacheUnavailable: false,
  rejectDeleteDoc: false,
}));

function queryDocsFromStore(col: { path: string }) {
  const prefix = `${col.path}/`;
  const matching = [...state.docs.entries()]
    .filter(
      ([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'),
    )
    .map(([path, data]) => ({
      id: path.split('/').pop() ?? '',
      ref: { id: path.split('/').pop() ?? '', path },
      data: () => data,
    }));
  return {
    docs: matching,
    empty: matching.length === 0,
    forEach: (cb: (d: (typeof matching)[number]) => void) =>
      matching.forEach(cb),
  };
}

vi.mock('../../src/lib/firebase', () => ({
  getFirestoreDb: () => ({ kind: 'mock-db' }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({
    path: segments.join('/'),
  }),
  doc: (_db: unknown, ...segments: string[]): DocRef => ({
    id: segments[segments.length - 1] ?? '',
    path: segments.join('/'),
  }),
  getDocs: (col: { path: string }) => {
    state.getDocsCalls.push(col.path);
    if (state.hangingNetwork) {
      // Real Firestore SDK blocks ~11.1s+ on hanging/poor signal instead of rejecting immediately (#14).
      return new Promise<never>(() => {});
    }
    return Promise.resolve(queryDocsFromStore(col));
  },
  getDocsFromCache: async (col: { path: string }) => {
    state.getDocsFromCacheCalls.push(col.path);
    if (state.cacheUnavailable) {
      throw new Error('cache-unavailable');
    }
    return queryDocsFromStore(col);
  },
  getDocFromCache: async (ref: DocRef) => {
    const data = state.docs.get(ref.path);
    return {
      id: ref.id,
      exists: () => Boolean(data),
      data: () => data,
    };
  },
  getDoc: async (ref: DocRef) => {
    const data = state.docs.get(ref.path);
    return {
      id: ref.id,
      exists: () => Boolean(data),
      data: () => data,
    };
  },
  deleteDoc: (ref: DocRef) => {
    state.deleteDocCalls.push(ref.path);
    if (state.rejectDeleteDoc) {
      return Promise.reject(new Error('permission-denied'));
    }
    state.docs.delete(ref.path);
    if (state.hangingNetwork) {
      return new Promise<void>(() => {});
    }
    return Promise.resolve();
  },
  updateDoc: async (ref: DocRef, updates: Record<string, unknown>) => {
    const existing = state.docs.get(ref.path);
    if (existing) {
      state.docs.set(ref.path, { ...existing, ...updates });
    }
  },
  writeBatch: () => {
    const deletes: string[] = [];
    const ops: Array<() => void> = [];
    const batch = {
      delete(ref: DocRef) {
        deletes.push(ref.path);
        ops.push(() => {
          state.docs.delete(ref.path);
        });
        return batch;
      },
      update(ref: DocRef, updates: Record<string, unknown>) {
        ops.push(() => {
          const existing = state.docs.get(ref.path);
          if (existing) state.docs.set(ref.path, { ...existing, ...updates });
        });
        return batch;
      },
      commit() {
        state.batchCommits += 1;
        state.lastBatchDeletes = [...deletes];
        for (const op of ops) op();
        if (state.hangingNetwork) {
          return new Promise<void>(() => {});
        }
        return Promise.resolve();
      },
    };
    return batch;
  },
  addDoc: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  waitForPendingWrites: vi.fn(),
  where: vi.fn(),
}));

import { deletePlan, deletePlanDay, deleteSession } from '../../src/lib/db';
import {
  mutateSessionExercises,
  setInitialShadow,
} from '../../src/lib/db/sessionShadow';

describe('deletePlan, deletePlanDay, and deleteSession (#13, #14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.docs.clear();
    state.batchCommits = 0;
    state.lastBatchDeletes = [];
    state.deleteDocCalls = [];
    state.getDocsCalls = [];
    state.getDocsFromCacheCalls = [];
    state.hangingNetwork = false;
    state.cacheUnavailable = false;
    state.rejectDeleteDoc = false;
  });

  it('deletePlan removes the plan document and all child days in a single batch without touching other plans', async () => {
    state.docs.set('plans/p-mistake', { name: 'Mistake Plan', active: false });
    state.docs.set('plans/p-mistake/days/d1', { name: 'Push', order: 0 });
    state.docs.set('plans/p-mistake/days/d2', { name: 'Pull', order: 1 });
    state.docs.set('plans/p-keep', { name: 'Keep Plan', active: true });
    state.docs.set('plans/p-keep/days/d1', { name: 'Legs', order: 0 });

    await deletePlan('p-mistake');

    expect(state.batchCommits).toBe(1);
    expect(state.getDocsCalls).toEqual([]);
    expect(state.lastBatchDeletes.sort()).toEqual([
      'plans/p-mistake',
      'plans/p-mistake/days/d1',
      'plans/p-mistake/days/d2',
    ]);
    expect([...state.docs.keys()].sort()).toEqual([
      'plans/p-keep',
      'plans/p-keep/days/d1',
    ]);
  });

  it('deletePlan merges caller-supplied knownDayIds even when getDocsFromCache is empty or unavailable (#14)', async () => {
    state.cacheUnavailable = true;
    state.docs.set('plans/p-known', { name: 'Known Days Plan', active: true });
    state.docs.set('plans/p-known/days/d-sub-1', { name: 'Push', order: 0 });
    state.docs.set('plans/p-known/days/d-sub-2', { name: 'Pull', order: 1 });

    await deletePlan('p-known', ['d-sub-1', 'd-sub-2']);

    expect(state.getDocsCalls).toEqual([]);
    expect(state.batchCommits).toBe(1);
    expect(state.lastBatchDeletes.sort()).toEqual([
      'plans/p-known',
      'plans/p-known/days/d-sub-1',
      'plans/p-known/days/d-sub-2',
    ]);
    expect(state.docs.size).toBe(0);
  });

  it('resolves deletePlan, deletePlanDay, and deleteSession promptly when network getDocs and acks hang (#14)', async () => {
    state.hangingNetwork = true;
    state.docs.set('sessions/s-offline', { status: 'completed', exercises: [] });
    state.docs.set('plans/p-offline', { name: 'Offline Plan', active: false });
    state.docs.set('plans/p-offline/days/d1', { name: 'Day 1', order: 0 });
    state.docs.set('plans/p-offline/days/d2', { name: 'Day 2', order: 1 });
    state.docs.set('plans/p-day-only/days/d9', { name: 'Day 9', order: 0 });

    const planOutcome = await Promise.race([
      deletePlan('p-offline').then(() => 'resolved' as const),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);
    expect(planOutcome).toBe('resolved');
    expect(state.getDocsCalls).toEqual([]);
    expect(state.lastBatchDeletes.sort()).toEqual([
      'plans/p-offline',
      'plans/p-offline/days/d1',
      'plans/p-offline/days/d2',
    ]);
    expect(state.docs.has('plans/p-offline')).toBe(false);
    expect(state.docs.has('plans/p-offline/days/d1')).toBe(false);
    expect(state.docs.has('plans/p-offline/days/d2')).toBe(false);

    const dayOutcome = await Promise.race([
      deletePlanDay('p-day-only', 'd9').then(() => 'resolved' as const),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);
    expect(dayOutcome).toBe('resolved');
    expect(state.docs.has('plans/p-day-only/days/d9')).toBe(false);

    const sessionOutcome = await Promise.race([
      deleteSession('s-offline').then(() => 'resolved' as const),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);
    expect(sessionOutcome).toBe('resolved');
    expect(state.deleteDocCalls).toContain('sessions/s-offline');
    expect(state.docs.has('sessions/s-offline')).toBe(false);

    // Background deleteDoc rejection must be caught rather than surfacing as unhandled rejection.
    state.hangingNetwork = false;
    state.rejectDeleteDoc = true;
    await expect(deleteSession('s-rejected')).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 10));
  });

  it('deleteSession deletes the session document and clears any cached shadow state', async () => {
    const seededExercises: SessionExercise[] = [
      {
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        notes: 'stale shadow',
        sets: [{ weight: 80, reps: 5, completedAt: 1000 }],
      },
    ];
    state.docs.set('sessions/s-mistake', {
      status: 'completed',
      exercises: seededExercises,
    });
    setInitialShadow('s-mistake', seededExercises);

    await deleteSession('s-mistake');

    expect(state.deleteDocCalls).toEqual(['sessions/s-mistake']);
    expect(state.docs.has('sessions/s-mistake')).toBe(false);

    const spy = vi.fn();
    await mutateSessionExercises('s-mistake', (exs) => {
      spy(exs);
      return exs;
    });
    expect(spy).not.toHaveBeenCalled();
  });
});
