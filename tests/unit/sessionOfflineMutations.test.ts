/**
 * Unit tests for offline-resilient `sessions.ts` operations (#20, REQ-002, REQ-006).
 * Uses hanging network `getDoc` and unacknowledged `addDoc`, `setDoc`, and `updateDoc` mocks
 * to prove `createSession`, `finishSession`, `abandonSession`, and `getSession` never stall on poor gym signal.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, Plan, PlanDay, Session } from '../../src/types';
import {
  makeColRef,
  makeDocRef,
  makeDocSnap,
  raceTimeout,
  type MockColRef,
  type MockDocRef,
} from './support/offlineFsMock';

const state = vi.hoisted(() => ({
  cacheDocs: new Map<string, Record<string, unknown>>(),
  networkDocs: new Map<string, Record<string, unknown>>(),
  nextSeq: 1,
  addDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  updateDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  getDocCalls: [] as string[],
  getDocFromCacheCalls: [] as string[],
  hangWrites: false,
  hangNetworkReads: false,
  cacheMiss: false,
}));

vi.mock('../../src/lib/firebase', () => ({
  getFirestoreDb: () => ({ kind: 'mock-db' }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => makeColRef(...segments),
  doc: (parent: { kind?: string; path?: string }, ...segments: string[]) =>
    makeDocRef(
      parent,
      segments,
      () => `client-session-${String(state.nextSeq++).padStart(6, '0')}`,
    ),
  getDoc: (ref: MockDocRef) => {
    state.getDocCalls.push(ref.path);
    if (state.hangNetworkReads) return new Promise<never>(() => {});
    return Promise.resolve(makeDocSnap(ref, state.networkDocs.get(ref.path)));
  },
  getDocFromCache: async (ref: MockDocRef) => {
    state.getDocFromCacheCalls.push(ref.path);
    if (state.cacheMiss) throw new Error('cache-miss');
    return makeDocSnap(ref, state.cacheDocs.get(ref.path));
  },
  addDoc: (col: MockColRef, data: Record<string, unknown>) => {
    const id = `server-session-${String(state.nextSeq++).padStart(6, '0')}`;
    const path = `${col.path}/${id}`;
    state.addDocCalls.push({ path, data });
    state.cacheDocs.set(path, { ...data });
    if (state.hangWrites) return new Promise<MockDocRef>(() => {});
    return Promise.resolve({ kind: 'doc' as const, id, path });
  },
  setDoc: (ref: MockDocRef, data: Record<string, unknown>) => {
    state.setDocCalls.push({ path: ref.path, data });
    state.cacheDocs.set(ref.path, { ...data });
    if (state.hangWrites) return new Promise<void>(() => {});
    return Promise.resolve();
  },
  updateDoc: (ref: MockDocRef, data: Record<string, unknown>) => {
    state.updateDocCalls.push({ path: ref.path, data });
    const prev = state.cacheDocs.get(ref.path) ?? {};
    state.cacheDocs.set(ref.path, { ...prev, ...data });
    if (state.hangWrites) return new Promise<void>(() => {});
    return Promise.resolve();
  },
  deleteDoc: (ref: MockDocRef) => {
    state.cacheDocs.delete(ref.path);
    if (state.hangWrites) return new Promise<void>(() => {});
    return Promise.resolve();
  },
  limit: vi.fn(),
  onSnapshot: vi.fn(() => () => undefined),
  orderBy: vi.fn(),
  query: vi.fn((base: unknown) => base),
  waitForPendingWrites: () => new Promise<void>(() => {}),
  where: vi.fn(),
}));

import {
  abandonSession,
  createSession,
  finishSession,
  getSession,
  logSet,
} from '../../src/lib/db';
import { clearShadow } from '../../src/lib/db/sessionShadow';

const PLAN: Plan = {
  id: 'p1',
  name: 'PPL',
  active: true,
  createdAt: 1000,
  archivedAt: null,
};

const DAY: PlanDay = {
  id: 'd1',
  name: 'Push',
  order: 0,
  exercises: [
    {
      exerciseId: 'ex-bench',
      targetSets: 2,
      targetRepsLow: 6,
      targetRepsHigh: 10,
      notes: '',
    },
  ],
};

const LIBRARY: Exercise[] = [
  {
    id: 'ex-bench',
    name: 'Barbell Bench Press',
    primaryMuscle: 'chest',
    notes: '',
    isCustom: false,
  },
];

describe('sessions.ts offline resilience on hanging reads and unacked writes (#20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.cacheDocs.clear();
    state.networkDocs.clear();
    state.nextSeq = 1;
    state.addDocCalls = [];
    state.setDocCalls = [];
    state.updateDocCalls = [];
    state.getDocCalls = [];
    state.getDocFromCacheCalls = [];
    state.hangWrites = false;
    state.hangNetworkReads = false;
    state.cacheMiss = false;
    clearShadow('s-finish');
    clearShadow('s-abandon');
  });

  it('createSession generates a client ID, seeds shadow, and queues setDoc locally without awaiting server ack', async () => {
    state.hangWrites = true;
    const historyMap = new Map([
      [
        'ex-bench',
        [
          {
            date: 500,
            sets: [
              { weight: 80, reps: 8, completedAt: 498 },
              { weight: 82.5, reps: 7, completedAt: 499 },
            ],
            noteText: '',
          },
        ],
      ],
    ]);

    const outcome = await raceTimeout(createSession(PLAN, DAY, LIBRARY, historyMap), 40);
    expect(outcome).toBe('client-session-000001');
    expect(state.addDocCalls).toEqual([]);
    expect(state.setDocCalls).toHaveLength(1);
    expect(state.setDocCalls[0]?.path).toBe('sessions/client-session-000001');
    expect(state.setDocCalls[0]?.data).toMatchObject({
      planId: 'p1',
      planName: 'PPL',
      dayId: 'd1',
      dayName: 'Push',
      status: 'active',
    });

    // Immediate set logging uses the seeded shadow without network reads.
    void logSet('client-session-000001', 0, 0, {
      weight: 85,
      reps: 8,
      completedAt: 1234,
    });
    await new Promise((r) => setTimeout(r, 15));
    expect(state.updateDocCalls).toHaveLength(1);
    expect(state.cacheDocs.get('sessions/client-session-000001')).toMatchObject({
      status: 'active',
    });
  });

  it('finishSession and abandonSession drain same-tick shadow updates and queue status writes without server ack', async () => {
    state.hangWrites = true;
    state.cacheDocs.set('sessions/s-finish', {
      planId: 'p1',
      planName: 'PPL',
      dayId: 'd1',
      dayName: 'Push',
      startedAt: 1000,
      finishedAt: null,
      status: 'active',
      sessionNotes: '',
      exercises: [
        {
          exerciseId: 'ex-bench',
          exerciseName: 'Barbell Bench Press',
          notes: '',
          sets: [{ weight: 80, reps: 8, completedAt: null }],
        },
      ],
    });
    state.cacheDocs.set('sessions/s-abandon', {
      planId: 'p1',
      planName: 'PPL',
      dayId: 'd1',
      dayName: 'Push',
      startedAt: 2000,
      finishedAt: null,
      status: 'active',
      sessionNotes: '',
      exercises: [],
    });

    void logSet('s-finish', 0, 0, { weight: 82.5, reps: 8, completedAt: 1500 });
    const finishOutcome = await raceTimeout(
      finishSession('s-finish').then(() => 'resolved' as const),
      40,
    );
    const abandonOutcome = await raceTimeout(
      abandonSession('s-abandon').then(() => 'resolved' as const),
      40,
    );

    expect(finishOutcome).toBe('resolved');
    expect(abandonOutcome).toBe('resolved');
    expect(state.cacheDocs.get('sessions/s-finish')).toMatchObject({
      status: 'completed',
    });
    const savedExercises = state.cacheDocs.get('sessions/s-finish')?.exercises as
      | Session['exercises']
      | undefined;
    expect(savedExercises?.[0]?.sets[0]?.completedAt).toBe(1500);
    expect(state.cacheDocs.get('sessions/s-abandon')).toMatchObject({
      status: 'abandoned',
    });
  });

  it('getSession reads cache first without stalling on hanging network getDoc and refreshes in the background', async () => {
    state.hangNetworkReads = true;
    state.cacheDocs.set('sessions/s-cached', {
      planId: 'p1',
      planName: 'PPL',
      dayId: 'd1',
      dayName: 'Push',
      startedAt: 1000,
      finishedAt: 2800,
      status: 'completed',
      sessionNotes: 'Cached note',
      exercises: [],
    });

    const cachedOutcome = await raceTimeout(getSession('s-cached'), 40);
    expect(cachedOutcome).not.toBe('stalled');
    expect((cachedOutcome as Session | null)?.sessionNotes).toBe('Cached note');
    expect(state.getDocFromCacheCalls).toEqual(['sessions/s-cached']);

    // When online and server has newer notes, background refresh delivers updated session.
    state.hangNetworkReads = false;
    state.networkDocs.set('sessions/s-cached', {
      planId: 'p1',
      planName: 'PPL',
      dayId: 'd1',
      dayName: 'Push',
      startedAt: 1000,
      finishedAt: 2800,
      status: 'completed',
      sessionNotes: 'Refreshed from server',
      exercises: [],
    });
    const refreshed: Session[] = [];
    const immediate = await getSession('s-cached', (fresh) => refreshed.push(fresh));
    expect(immediate?.sessionNotes).toBe('Cached note');
    await new Promise((r) => setTimeout(r, 10));
    expect(refreshed[0]?.sessionNotes).toBe('Refreshed from server');
  });
});
