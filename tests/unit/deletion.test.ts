/**
 * Unit tests for hard plan and workout session deletion (#13, REQ-002, REQ-006).
 * Verifies that `deletePlan` atomically deletes child `days` documents and the parent plan,
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
  deleteDocCalls: [] as string[],
  offlineServerAckPending: false,
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
  getDocs: async (col: { path: string }) => {
    if (state.offlineServerAckPending) {
      throw new Error('offline: unavailable');
    }
    return queryDocsFromStore(col);
  },
  getDocsFromCache: async (col: { path: string }) => queryDocsFromStore(col),
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
    // Like Firestore persistentLocalCache, local cache updates synchronously while the returned promise awaits server ack.
    state.docs.delete(ref.path);
    if (state.offlineServerAckPending) {
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
    const ops: Array<() => void> = [];
    const batch = {
      delete(ref: DocRef) {
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
        for (const op of ops) op();
        if (state.offlineServerAckPending) {
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

import { deletePlan, deleteSession } from '../../src/lib/db';
import {
  mutateSessionExercises,
  setInitialShadow,
} from '../../src/lib/db/sessionShadow';

describe('deletePlan and deleteSession (#13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.docs.clear();
    state.batchCommits = 0;
    state.deleteDocCalls = [];
    state.offlineServerAckPending = false;
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
    expect([...state.docs.keys()].sort()).toEqual([
      'plans/p-keep',
      'plans/p-keep/days/d1',
    ]);
  });

  it('deletePlan succeeds cleanly when a newly created plan has zero days', async () => {
    state.docs.set('plans/p-empty', { name: 'Empty Plan', active: true });

    await deletePlan('p-empty');

    expect(state.batchCommits).toBe(1);
    expect(state.docs.has('plans/p-empty')).toBe(false);
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

    // Because clearShadow ran and the document is deleted, a stray mutation no-ops cleanly.
    const spy = vi.fn();
    await mutateSessionExercises('s-mistake', (exs) => {
      spy(exs);
      return exs;
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('deleteSession and deletePlan do not await server acknowledgment offline and guard background rejections', async () => {
    state.offlineServerAckPending = true;
    state.docs.set('sessions/s-offline', { status: 'completed', exercises: [] });
    state.docs.set('plans/p-offline', { name: 'Offline Plan', active: false });
    state.docs.set('plans/p-offline/days/d1', { name: 'Day 1', order: 0 });

    const sessionOutcome = await Promise.race([
      deleteSession('s-offline').then(() => 'resolved' as const),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);
    expect(sessionOutcome).toBe('resolved');
    expect(state.deleteDocCalls).toEqual(['sessions/s-offline']);
    expect(state.docs.has('sessions/s-offline')).toBe(false);

    const planOutcome = await Promise.race([
      deletePlan('p-offline').then(() => 'resolved' as const),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);
    expect(planOutcome).toBe('resolved');
    expect(state.docs.has('plans/p-offline')).toBe(false);
    expect(state.docs.has('plans/p-offline/days/d1')).toBe(false);

    // Background deleteDoc rejection must be caught rather than surfacing as unhandled rejection.
    state.offlineServerAckPending = false;
    state.rejectDeleteDoc = true;
    await expect(deleteSession('s-rejected')).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 10));
  });
});
