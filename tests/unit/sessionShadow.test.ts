/**
 * Unit tests for `sessionShadow` and session exercise mutation serialization (#6, REQ-002).
 * Verifies that N same-tick mutations chain through a per-session queue so all N writes persist.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionExercise, SessionSet } from '../../src/types';

interface DocRef {
  id: string;
  path: string;
}

const mocks = vi.hoisted(() => ({
  store: new Map<string, { exercises: SessionExercise[] }>(),
  getDocFromCache: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('../../src/lib/firebase', () => ({
  getFirestoreDb: () => ({ kind: 'mock-db' }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ path: name }),
  doc: (_db: unknown, colName: string, id: string): DocRef => ({
    id,
    path: `${colName}/${id}`,
  }),
  getDocFromCache: (ref: DocRef) => mocks.getDocFromCache(ref),
  getDoc: (ref: DocRef) => mocks.getDoc(ref),
  updateDoc: (ref: DocRef, data: { exercises?: SessionExercise[] }) =>
    mocks.updateDoc(ref, data),
  addDoc: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  waitForPendingWrites: vi.fn(),
  where: vi.fn(),
}));

import {
  clearShadow,
  mutateSessionExercises,
  setInitialShadow,
  syncShadowFromSnapshot,
} from '../../src/lib/db/sessionShadow';
import {
  addSetToExercise,
  logSet,
  updateSessionExercise,
} from '../../src/lib/db/sessions';

function makeFiveSetExercises(): SessionExercise[] {
  const sets: SessionSet[] = Array.from({ length: 5 }, () => ({
    weight: 60,
    reps: 8,
    completedAt: null,
  }));
  return [
    {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
      notes: '',
      sets,
    },
  ];
}

describe('sessionShadow same-tick and sequential serialization (#6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.clear();
    clearShadow('s1');
    clearShadow('s-lazy');

    mocks.getDocFromCache.mockImplementation(async (ref: DocRef) => {
      const data = mocks.store.get(ref.id);
      return {
        id: ref.id,
        exists: () => Boolean(data),
        data: () => data,
      };
    });
    mocks.getDoc.mockImplementation(async (ref: DocRef) => {
      const data = mocks.store.get(ref.id);
      return {
        id: ref.id,
        exists: () => Boolean(data),
        data: () => data,
      };
    });
    mocks.updateDoc.mockImplementation(
      async (ref: DocRef, data: { exercises?: SessionExercise[] }) => {
        if (data.exercises) {
          mocks.store.set(ref.id, { exercises: data.exercises });
        }
      },
    );
  });

  it('persists all 5 logSet calls when issued in the same JS tick on a seeded shadow', async () => {
    const initial = makeFiveSetExercises();
    mocks.store.set('s1', { exercises: initial });
    setInitialShadow('s1', initial);

    await Promise.all([
      logSet('s1', 0, 0, { weight: 60, reps: 8, completedAt: 1001 }),
      logSet('s1', 0, 1, { weight: 65, reps: 8, completedAt: 1002 }),
      logSet('s1', 0, 2, { weight: 70, reps: 8, completedAt: 1003 }),
      logSet('s1', 0, 3, { weight: 75, reps: 8, completedAt: 1004 }),
      logSet('s1', 0, 4, { weight: 80, reps: 8, completedAt: 1005 }),
    ]);

    expect(mocks.updateDoc).toHaveBeenCalledTimes(5);
    const savedSets = mocks.store.get('s1')?.exercises[0]?.sets;
    expect(savedSets).toEqual([
      { weight: 60, reps: 8, completedAt: 1001 },
      { weight: 65, reps: 8, completedAt: 1002 },
      { weight: 70, reps: 8, completedAt: 1003 },
      { weight: 75, reps: 8, completedAt: 1004 },
      { weight: 80, reps: 8, completedAt: 1005 },
    ]);
  });

  it('persists all 5 same-tick logSet calls when seeding lazily from cache', async () => {
    mocks.store.set('s-lazy', { exercises: makeFiveSetExercises() });

    await Promise.all([
      logSet('s-lazy', 0, 0, { weight: 100, reps: 5, completedAt: 2001 }),
      logSet('s-lazy', 0, 1, { weight: 100, reps: 5, completedAt: 2002 }),
      logSet('s-lazy', 0, 2, { weight: 100, reps: 5, completedAt: 2003 }),
      logSet('s-lazy', 0, 3, { weight: 100, reps: 5, completedAt: 2004 }),
      logSet('s-lazy', 0, 4, { weight: 100, reps: 5, completedAt: 2005 }),
    ]);

    expect(mocks.getDocFromCache).toHaveBeenCalledTimes(1);
    const savedSets = mocks.store.get('s-lazy')?.exercises[0]?.sets;
    expect(savedSets?.map((s) => s.completedAt)).toEqual([
      2001, 2002, 2003, 2004, 2005,
    ]);
  });

  it('preserves mixed same-tick structural and field mutations in call order', async () => {
    const initial = makeFiveSetExercises();
    mocks.store.set('s1', { exercises: initial });
    setInitialShadow('s1', initial);

    await Promise.all([
      addSetToExercise('s1', 0),
      logSet('s1', 0, 5, { weight: 90, reps: 6, completedAt: 3001 }),
      updateSessionExercise('s1', 0, { notes: 'heavy top set' }),
    ]);

    const saved = mocks.store.get('s1')?.exercises[0];
    expect(saved?.sets).toHaveLength(6);
    expect(saved?.sets[5]).toEqual({ weight: 90, reps: 6, completedAt: 3001 });
    expect(saved?.notes).toBe('heavy top set');
  });

  it('keeps sequential mutations and snapshot sync working as before', async () => {
    const initial = makeFiveSetExercises();
    mocks.store.set('s1', { exercises: initial });
    setInitialShadow('s1', initial);

    await logSet('s1', 0, 0, { weight: 62.5, reps: 8, completedAt: 4001 });
    await logSet('s1', 0, 1, { weight: 62.5, reps: 8, completedAt: 4002 });

    // A snapshot with hasPendingWrites=true must not overwrite local shadow state.
    syncShadowFromSnapshot('s1', makeFiveSetExercises(), true);
    await logSet('s1', 0, 2, { weight: 62.5, reps: 8, completedAt: 4003 });

    expect(
      mocks.store.get('s1')?.exercises[0]?.sets.slice(0, 3).map((s) => s.completedAt),
    ).toEqual([4001, 4002, 4003]);

    // When idle and hasPendingWrites=false, a clean snapshot updates the shadow.
    const serverSnapshot = makeFiveSetExercises();
    serverSnapshot[0].notes = 'from server';
    syncShadowFromSnapshot('s1', serverSnapshot, false);

    await mutateSessionExercises('s1', (exs) => {
      exs[0].sets[0].completedAt = 5000;
      return exs;
    });
    expect(mocks.store.get('s1')?.exercises[0]?.notes).toBe('from server');
    expect(mocks.store.get('s1')?.exercises[0]?.sets[0]?.completedAt).toBe(5000);
  });

  it('queues cumulative writes offline when updateDoc never resolves for same-tick and sequential taps', async () => {
    const initial = makeFiveSetExercises();
    mocks.store.set('s1', { exercises: initial });
    setInitialShadow('s1', initial);

    const payloads: Array<Array<number | null>> = [];
    mocks.updateDoc.mockImplementation(
      (_ref: DocRef, data: { exercises?: SessionExercise[] }) => {
        if (data.exercises?.[0]) {
          payloads.push(data.exercises[0].sets.map((s) => s.completedAt));
        }
        return new Promise<void>(() => {});
      },
    );

    // Same-tick taps while offline (updateDoc never resolves).
    void logSet('s1', 0, 0, { weight: 60, reps: 8, completedAt: 1 });
    void logSet('s1', 0, 1, { weight: 65, reps: 8, completedAt: 2 });
    await new Promise((r) => setTimeout(r, 20));

    // Sequential tap 20ms later while still offline.
    void logSet('s1', 0, 2, { weight: 70, reps: 8, completedAt: 3 });
    await new Promise((r) => setTimeout(r, 20));

    expect(mocks.updateDoc).toHaveBeenCalledTimes(3);
    expect(payloads).toEqual([
      [1, null, null, null, null],
      [1, 2, null, null, null],
      [1, 2, 3, null, null],
    ]);
  });
});
