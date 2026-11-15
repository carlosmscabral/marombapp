/**
 * Unit tests for offline-resilient `plans.ts` and `library.ts` mutations (#20, REQ-002, REQ-006).
 * Uses unacknowledged `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, and `batch.commit` mocks
 * to prove remaining plan and custom-exercise writes queue locally and resolve immediately.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ColRef {
  kind: 'col';
  path: string;
}

interface DocRef {
  kind: 'doc';
  id: string;
  path: string;
}

const state = vi.hoisted(() => ({
  nextSeq: 1,
  addDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  updateDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  deleteDocCalls: [] as string[],
  batchUpdates: {} as Record<string, Record<string, unknown>>,
  hangWrites: false,
  rejectWrite: false,
}));

vi.mock('../../src/lib/firebase', () => ({
  getFirestoreDb: () => ({ kind: 'mock-db' }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]): ColRef => ({
    kind: 'col',
    path: segments.join('/'),
  }),
  doc: (parent: { kind?: string; path?: string }, ...segments: string[]): DocRef => {
    const base = parent?.kind === 'col' && parent.path ? [parent.path] : [];
    const parts =
      segments.length > 0
        ? segments
        : [`client-doc-${String(state.nextSeq++).padStart(6, '0')}`];
    const path = [...base, ...parts].join('/');
    return {
      kind: 'doc',
      id: path.split('/').pop() ?? '',
      path,
    };
  },
  addDoc: (col: ColRef, data: Record<string, unknown>) => {
    const id = `server-doc-${String(state.nextSeq++).padStart(6, '0')}`;
    state.addDocCalls.push({ path: `${col.path}/${id}`, data });
    if (state.hangWrites) {
      return new Promise<DocRef>(() => {});
    }
    return Promise.resolve({ kind: 'doc' as const, id, path: `${col.path}/${id}` });
  },
  setDoc: (ref: DocRef, data: Record<string, unknown>) => {
    state.setDocCalls.push({ path: ref.path, data });
    if (state.rejectWrite) {
      return Promise.reject(new Error('permission-denied'));
    }
    if (state.hangWrites) {
      return new Promise<void>(() => {});
    }
    return Promise.resolve();
  },
  updateDoc: (ref: DocRef, data: Record<string, unknown>) => {
    state.updateDocCalls.push({ path: ref.path, data });
    if (state.rejectWrite) {
      return Promise.reject(new Error('permission-denied'));
    }
    if (state.hangWrites) {
      return new Promise<void>(() => {});
    }
    return Promise.resolve();
  },
  deleteDoc: (ref: DocRef) => {
    state.deleteDocCalls.push(ref.path);
    if (state.rejectWrite) {
      return Promise.reject(new Error('permission-denied'));
    }
    if (state.hangWrites) {
      return new Promise<void>(() => {});
    }
    return Promise.resolve();
  },
  writeBatch: () => {
    const updates: Record<string, Record<string, unknown>> = {};
    const batch = {
      delete: () => batch,
      update(ref: DocRef, data: Record<string, unknown>) {
        updates[ref.path] = data;
        return batch;
      },
      commit() {
        state.batchUpdates = { ...updates };
        if (state.rejectWrite) {
          return Promise.reject(new Error('permission-denied'));
        }
        if (state.hangWrites) {
          return new Promise<void>(() => {});
        }
        return Promise.resolve();
      },
    };
    return batch;
  },
  getDocsFromCache: async () => ({
    docs: [],
    empty: true,
    forEach: () => undefined,
  }),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => () => undefined),
  orderBy: vi.fn(),
  query: vi.fn((base: unknown) => base),
  serverTimestamp: vi.fn(() => '__server_ts__'),
  where: vi.fn(),
}));

import {
  archivePlan,
  createExercise,
  createPlan,
  deleteExercise,
  renamePlan,
  renamePlanDay,
  reorderPlanDays,
  updateExercise,
} from '../../src/lib/db';

function raceTimeout<T>(promise: Promise<T>): Promise<T | 'stalled'> {
  return Promise.race([
    promise,
    new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
  ]);
}

describe('plans.ts and library.ts offline resilience on unacked writes (#20)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.nextSeq = 1;
    state.addDocCalls = [];
    state.setDocCalls = [];
    state.updateDocCalls = [];
    state.deleteDocCalls = [];
    state.batchUpdates = {};
    state.hangWrites = false;
    state.rejectWrite = false;
  });

  it('createPlan, renamePlan, archivePlan, renamePlanDay, and reorderPlanDays resolve immediately when server acks hang', async () => {
    state.hangWrites = true;

    const createdId = await raceTimeout(createPlan('Upper Lower'));
    expect(createdId).toBe('client-doc-000001');
    expect(state.addDocCalls).toEqual([]);
    expect(state.setDocCalls).toEqual([
      {
        path: 'plans/client-doc-000001',
        data: {
          name: 'Upper Lower',
          active: false,
          createdAt: '__server_ts__',
          archivedAt: null,
        },
      },
    ]);

    expect(
      await raceTimeout(renamePlan('p1', 'PPL Hipertrofia').then(() => 'ok' as const)),
    ).toBe('ok');
    expect(
      await raceTimeout(archivePlan('p1').then(() => 'ok' as const)),
    ).toBe('ok');
    expect(
      await raceTimeout(renamePlanDay('p1', 'd1', 'Push A').then(() => 'ok' as const)),
    ).toBe('ok');
    expect(
      await raceTimeout(
        reorderPlanDays('p1', ['d2', 'd1', 'd3']).then(() => 'ok' as const),
      ),
    ).toBe('ok');

    expect(state.updateDocCalls[0]).toEqual({
      path: 'plans/p1',
      data: { name: 'PPL Hipertrofia' },
    });
    expect(state.updateDocCalls[1]?.path).toBe('plans/p1');
    expect(state.updateDocCalls[1]?.data).toMatchObject({ active: false });
    expect(typeof state.updateDocCalls[1]?.data.archivedAt).toBe('number');
    expect(state.updateDocCalls[2]).toEqual({
      path: 'plans/p1/days/d1',
      data: { name: 'Push A' },
    });
    expect(state.batchUpdates).toEqual({
      'plans/p1/days/d2': { order: 0 },
      'plans/p1/days/d1': { order: 1 },
      'plans/p1/days/d3': { order: 2 },
    });
  });

  it('createExercise, updateExercise, and deleteExercise queue local writes without awaiting server ack', async () => {
    state.hangWrites = true;

    const exId = await raceTimeout(
      createExercise({
        name: 'Zercher Squat',
        primaryMuscle: 'quads',
        subMuscle: 'vastus medialis',
        notes: 'Cotovelos firmes',
      }),
    );
    expect(exId).toBe('client-doc-000001');
    expect(state.addDocCalls).toEqual([]);
    expect(state.setDocCalls).toEqual([
      {
        path: 'exercises/client-doc-000001',
        data: {
          name: 'Zercher Squat',
          primaryMuscle: 'quads',
          subMuscle: 'vastus medialis',
          notes: 'Cotovelos firmes',
          isCustom: true,
        },
      },
    ]);

    expect(
      await raceTimeout(
        updateExercise('client-doc-000001', { name: 'Zercher Pesado' }).then(
          () => 'ok' as const,
        ),
      ),
    ).toBe('ok');
    expect(
      await raceTimeout(
        deleteExercise('client-doc-000001').then(() => 'ok' as const),
      ),
    ).toBe('ok');

    expect(state.updateDocCalls).toEqual([
      {
        path: 'exercises/client-doc-000001',
        data: { name: 'Zercher Pesado' },
      },
    ]);
    expect(state.deleteDocCalls).toEqual(['exercises/client-doc-000001']);

    // Background rejections must never surface as unhandled rejections.
    state.hangWrites = false;
    state.rejectWrite = true;
    await expect(createPlan('Teste')).resolves.toBe('client-doc-000002');
    await expect(
      createExercise({ name: 'Sissy Squat', primaryMuscle: 'quads', notes: '' }),
    ).resolves.toBe('client-doc-000003');
    await expect(updateExercise('ex1', { notes: 'x' })).resolves.toBeUndefined();
    await expect(deleteExercise('ex1')).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 10));
  });
});
