/**
 * Unit tests for offline-resilient `setActivePlan` and `addPlanDay` (#17, REQ-002, REQ-006).
 * Uses a hanging `getDocs` mock and unacknowledged write mocks (`setDoc`, `addDoc`, `batch.commit`)
 * to prove neither mutation stalls on poor signal and both queue exact local writes.
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
  docs: new Map<string, Record<string, unknown>>(),
  nextAutoSeq: 1,
  batchCommits: 0,
  lastBatchUpdates: {} as Record<string, Record<string, unknown>>,
  getDocsCalls: [] as string[],
  getDocsFromCacheCalls: [] as string[],
  addDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  hangingNetwork: false,
  cacheUnavailable: false,
  rejectWrite: false,
}));

function queryDocsFromStore(col: { path: string }) {
  const prefix = `${col.path}/`;
  const matching = [...state.docs.entries()]
    .filter(
      ([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'),
    )
    .map(([path, data]) => ({
      id: path.split('/').pop() ?? '',
      ref: { kind: 'doc' as const, id: path.split('/').pop() ?? '', path },
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
  collection: (_db: unknown, ...segments: string[]): ColRef => ({
    kind: 'col',
    path: segments.join('/'),
  }),
  doc: (parent: { kind?: string; path?: string }, ...segments: string[]): DocRef => {
    const base = parent?.kind === 'col' && parent.path ? [parent.path] : [];
    const parts =
      segments.length > 0
        ? segments
        : [`client-id-${String(state.nextAutoSeq++).padStart(8, '0')}`];
    const path = [...base, ...parts].join('/');
    return {
      kind: 'doc',
      id: path.split('/').pop() ?? '',
      path,
    };
  },
  getDocs: (col: { path: string }) => {
    state.getDocsCalls.push(col.path);
    if (state.hangingNetwork) {
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
  addDoc: (col: { path: string }, data: Record<string, unknown>) => {
    const id = `server-id-${String(state.nextAutoSeq++).padStart(8, '0')}`;
    const path = `${col.path}/${id}`;
    state.addDocCalls.push({ path, data });
    state.docs.set(path, { ...data });
    if (state.hangingNetwork) {
      return new Promise<DocRef>(() => {});
    }
    return Promise.resolve({ kind: 'doc' as const, id, path });
  },
  setDoc: (ref: DocRef, data: Record<string, unknown>) => {
    state.setDocCalls.push({ path: ref.path, data });
    if (state.rejectWrite) {
      return Promise.reject(new Error('permission-denied'));
    }
    state.docs.set(ref.path, { ...data });
    if (state.hangingNetwork) {
      return new Promise<void>(() => {});
    }
    return Promise.resolve();
  },
  updateDoc: (ref: DocRef, updates: Record<string, unknown>) => {
    const existing = state.docs.get(ref.path);
    if (existing) {
      state.docs.set(ref.path, { ...existing, ...updates });
    }
    if (state.hangingNetwork) {
      return new Promise<void>(() => {});
    }
    return Promise.resolve();
  },
  deleteDoc: (ref: DocRef) => {
    state.docs.delete(ref.path);
    if (state.hangingNetwork) {
      return new Promise<void>(() => {});
    }
    return Promise.resolve();
  },
  writeBatch: () => {
    const updates: Record<string, Record<string, unknown>> = {};
    const ops: Array<() => void> = [];
    const batch = {
      delete(ref: DocRef) {
        ops.push(() => state.docs.delete(ref.path));
        return batch;
      },
      update(ref: DocRef, data: Record<string, unknown>) {
        updates[ref.path] = data;
        ops.push(() => {
          const existing = state.docs.get(ref.path) ?? {};
          state.docs.set(ref.path, { ...existing, ...data });
        });
        return batch;
      },
      commit() {
        state.batchCommits += 1;
        state.lastBatchUpdates = { ...updates };
        if (state.rejectWrite) {
          return Promise.reject(new Error('permission-denied'));
        }
        for (const op of ops) op();
        if (state.hangingNetwork) {
          return new Promise<void>(() => {});
        }
        return Promise.resolve();
      },
    };
    return batch;
  },
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn((base: unknown) => base),
  serverTimestamp: vi.fn(() => 0),
  waitForPendingWrites: vi.fn(),
  where: vi.fn(),
}));

import { addPlanDay, setActivePlan } from '../../src/lib/db';

describe('setActivePlan and addPlanDay on hanging network and unacked writes (#17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.docs.clear();
    state.nextAutoSeq = 1;
    state.batchCommits = 0;
    state.lastBatchUpdates = {};
    state.getDocsCalls = [];
    state.getDocsFromCacheCalls = [];
    state.addDocCalls = [];
    state.setDocCalls = [];
    state.hangingNetwork = false;
    state.cacheUnavailable = false;
    state.rejectWrite = false;
  });

  it('setActivePlan resolves promptly when getDocs and batch.commit hang and updates active flags from cache', async () => {
    state.hangingNetwork = true;
    state.docs.set('plans/p1', { name: 'PPL', active: true });
    state.docs.set('plans/p2', { name: 'Upper Lower', active: false });
    state.docs.set('plans/p3', { name: 'Full Body', active: false });

    const outcome = await Promise.race([
      setActivePlan('p2').then(() => 'resolved' as const),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);

    expect(outcome).toBe('resolved');
    expect(state.getDocsCalls).toEqual([]);
    expect(state.batchCommits).toBe(1);
    expect(state.lastBatchUpdates).toEqual({
      'plans/p1': { active: false },
      'plans/p2': { active: true },
    });
    expect(state.docs.get('plans/p1')?.active).toBe(false);
    expect(state.docs.get('plans/p2')?.active).toBe(true);
    expect(state.docs.get('plans/p3')?.active).toBe(false);
  });

  it('setActivePlan uses caller-subscribed knownPlans even when getDocsFromCache is unavailable', async () => {
    state.hangingNetwork = true;
    state.cacheUnavailable = true;

    const outcome = await Promise.race([
      setActivePlan('p2', [
        { id: 'p1', active: true },
        { id: 'p2', active: false },
        { id: 'p3', active: false },
      ]).then(() => 'resolved' as const),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);

    expect(outcome).toBe('resolved');
    expect(state.getDocsCalls).toEqual([]);
    expect(state.batchCommits).toBe(1);
    expect(state.lastBatchUpdates).toEqual({
      'plans/p1': { active: false },
      'plans/p2': { active: true },
    });
  });

  it('addPlanDay generates a client doc ID, computes order from cache/knownDays, and resolves without getDocs or addDoc ack', async () => {
    state.hangingNetwork = true;
    state.docs.set('plans/p1/days/d1', { name: 'Push', order: 0, exercises: [] });
    state.docs.set('plans/p1/days/d2', { name: 'Pull', order: 3, exercises: [] });

    const outcome = await Promise.race([
      addPlanDay('p1', 'Legs'),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);

    expect(outcome).toBe('client-id-00000001');
    expect(state.getDocsCalls).toEqual([]);
    expect(state.addDocCalls).toEqual([]);
    expect(state.setDocCalls).toEqual([
      {
        path: 'plans/p1/days/client-id-00000001',
        data: { name: 'Legs', order: 4, exercises: [] },
      },
    ]);

    // When cache is unavailable, knownDays still supplies maxOrder.
    state.cacheUnavailable = true;
    const secondOutcome = await Promise.race([
      addPlanDay('p1', 'Arms', [
        { id: 'd1', order: 0 },
        { id: 'client-id-00000001', order: 4 },
      ]),
      new Promise<'stalled'>((r) => setTimeout(() => r('stalled'), 40)),
    ]);

    expect(secondOutcome).toBe('client-id-00000002');
    expect(state.getDocsCalls).toEqual([]);
    expect(state.setDocCalls[1]).toEqual({
      path: 'plans/p1/days/client-id-00000002',
      data: { name: 'Arms', order: 5, exercises: [] },
    });

    // Background write rejections must not surface as unhandled promise rejections.
    state.hangingNetwork = false;
    state.rejectWrite = true;
    await expect(setActivePlan('p2', [{ id: 'p1', active: true }])).resolves.toBeUndefined();
    await expect(addPlanDay('p1', 'Core', [])).resolves.toBe('client-id-00000003');
    await new Promise((r) => setTimeout(r, 10));
  });
});
