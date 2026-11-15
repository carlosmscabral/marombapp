/**
 * Unit tests for the initial exercise library seeder (#22, REQ-001, REQ-002, REQ-004, REQ-006, ADR-005).
 * Models Firestore persistent-cache vs server-authoritative behavior (`fromCache`, offline `unavailable`
 * rejections, blackhole hangs, unacked commits, and multi-tab races) with zero real network calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSCLE_GROUPS } from '../../src/types';

type FetchMode = 'online' | 'offline-empty-cache' | 'cached-snapshot' | 'hang';

interface RecordedSet {
  col: string;
  id: string;
  data: Record<string, unknown>;
}

const state = vi.hoisted(() => ({
  mode: 'online' as FetchMode,
  autoIdCounter: 0,
  docsById: new Map<string, Record<string, unknown>>(),
  sets: [] as RecordedSet[],
  commits: 0,
  getDocsCalls: 0,
  getDocsFromServerCalls: 0,
  pendingServerRejects: [] as Array<(reason?: unknown) => void>,
  commitImpl: null as (() => Promise<void>) | null,
}));

vi.mock('../../src/lib/firebase', () => ({
  getFirestoreDb: () => ({ fake: 'db' }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  limit: (n: number) => ({ limit: n }),
  query: (col: unknown, ...c: unknown[]) => ({ col, c }),
  getDocs: async () => {
    state.getDocsCalls += 1;
    if (state.mode === 'offline-empty-cache' || state.mode === 'cached-snapshot') {
      return {
        empty: state.docsById.size === 0,
        metadata: { fromCache: true, hasPendingWrites: false },
      };
    }
    if (state.mode === 'hang') {
      return new Promise<never>(() => undefined);
    }
    return {
      empty: state.docsById.size === 0,
      metadata: { fromCache: false, hasPendingWrites: false },
    };
  },
  getDocsFromServer: async () => {
    state.getDocsFromServerCalls += 1;
    if (state.mode === 'offline-empty-cache') {
      throw Object.assign(new Error('Failed to get documents from server.'), {
        code: 'unavailable',
      });
    }
    if (state.mode === 'cached-snapshot') {
      return {
        empty: state.docsById.size === 0,
        metadata: { fromCache: true, hasPendingWrites: false },
      };
    }
    if (state.mode === 'hang') {
      return new Promise<never>((_resolve, reject) => {
        state.pendingServerRejects.push(reject);
      });
    }
    return {
      empty: state.docsById.size === 0,
      metadata: { fromCache: false, hasPendingWrites: false },
    };
  },
  doc: (col: { name: string }, explicitId?: string) => {
    const id = explicitId ?? `auto-${++state.autoIdCounter}`;
    return { col: col.name, id };
  },
  writeBatch: () => {
    const staged: RecordedSet[] = [];
    return {
      set: (ref: { col: string; id: string }, data: Record<string, unknown>) => {
        const entry: RecordedSet = { col: ref.col, id: ref.id, data };
        staged.push(entry);
        state.sets.push(entry);
      },
      commit: () => {
        state.commits += 1;
        for (const entry of staged) {
          state.docsById.set(entry.id, entry.data);
        }
        if (state.commitImpl) {
          return state.commitImpl();
        }
        return Promise.resolve();
      },
    };
  },
}));

const { SEED_EXERCISES, seedLibraryIfEmpty } = await import('../../src/lib/seed');

describe('seedLibraryIfEmpty (#22, ADR-005)', () => {
  beforeEach(() => {
    state.mode = 'online';
    state.autoIdCounter = 0;
    state.docsById.clear();
    state.sets = [];
    state.commits = 0;
    state.getDocsCalls = 0;
    state.getDocsFromServerCalls = 0;
    state.pendingServerRejects = [];
    state.commitImpl = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes 0 documents when offline with an empty local cache (getDocsFromServer unavailable)', async () => {
    state.mode = 'offline-empty-cache';

    await expect(seedLibraryIfEmpty()).resolves.toBeUndefined();

    expect(state.getDocsFromServerCalls).toBe(1);
    expect(state.getDocsCalls).toBe(0);
    expect(state.sets).toHaveLength(0);
    expect(state.commits).toBe(0);
    expect(state.docsById.size).toBe(0);
  });

  it('never seeds when a snapshot reports metadata.fromCache === true', async () => {
    state.mode = 'cached-snapshot';

    await expect(seedLibraryIfEmpty()).resolves.toBeUndefined();

    expect(state.sets).toHaveLength(0);
    expect(state.commits).toBe(0);
    expect(state.docsById.size).toBe(0);
  });

  it('times out cleanly with 0 writes and 0 unhandled rejections when getDocsFromServer hangs', async () => {
    vi.useFakeTimers();
    state.mode = 'hang';
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    try {
      let settled = false;
      const runPromise = seedLibraryIfEmpty().then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(10_000);
      await runPromise;

      expect(settled).toBe(true);
      expect(state.sets).toHaveLength(0);
      expect(state.commits).toBe(0);

      // Late network reset after timeout must not surface an unhandled rejection.
      for (const reject of state.pendingServerRejects) {
        reject(Object.assign(new Error('Stream reset'), { code: 'unavailable' }));
      }
      await Promise.resolve();
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('seeds 66 canonical English exercises with deterministic slug IDs without awaiting commit ack', async () => {
    let rejectCommitAck: ((err: unknown) => void) | null = null;
    state.commitImpl = () =>
      new Promise<void>((_resolve, reject) => {
        rejectCommitAck = reject;
      });

    await expect(seedLibraryIfEmpty()).resolves.toBeUndefined();

    expect(SEED_EXERCISES).toHaveLength(66);
    expect(state.sets).toHaveLength(66);
    expect(state.commits).toBe(1);
    expect(state.autoIdCounter).toBe(0);
    expect(state.docsById.size).toBe(66);

    const ids = new Set<string>();
    const names = new Set<string>();
    const counts = new Map<string, number>();

    for (const { col, id, data } of state.sets) {
      expect(col).toBe('exercises');
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(id).not.toMatch(/^auto-/);
      expect(Object.keys(data).sort()).toEqual([
        'isCustom',
        'name',
        'notes',
        'primaryMuscle',
      ]);
      expect(data.isCustom).toBe(false);
      expect(data.notes).toBe('');
      expect(MUSCLE_GROUPS).toContain(data.primaryMuscle);
      ids.add(id);
      names.add(String(data.name));
      const m = String(data.primaryMuscle);
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }

    expect(ids.size).toBe(66);
    expect(names.size).toBe(66);
    expect(ids.has('bench-press')).toBe(true);
    expect(ids.has('farmers-walk')).toBe(true);
    expect(ids.has('t-bar-row')).toBe(true);
    expect(ids.has('bulgarian-split-squat')).toBe(true);
    for (const m of MUSCLE_GROUPS) {
      expect(counts.get(m)).toBe(6);
    }

    // Late commit rejection must be swallowed without an unhandled rejection.
    rejectCommitAck?.(new Error('Connection closed before ack'));
    await Promise.resolve();
  });

  it('produces zero duplicates on overlapping same-tab calls, re-runs, and multi-tab launches', async () => {
    // Overlapping calls in the same tab (e.g. React StrictMode mount) share one server check and batch.
    await Promise.all([seedLibraryIfEmpty(), seedLibraryIfEmpty()]);
    const firstPassIds = state.sets.map((s) => s.id);
    expect(state.getDocsFromServerCalls).toBe(1);
    expect(state.commits).toBe(1);
    expect(state.docsById.size).toBe(66);

    // Second sequential call sees non-empty server collection and writes nothing.
    await seedLibraryIfEmpty();
    expect(state.commits).toBe(1);
    expect(state.sets).toHaveLength(66);

    // Simulate a second tab that also saw empty=true before tab 1's commit reached the server:
    // clear server visibility momentarily, capture the second batch's IDs, and merge into one map.
    const mergedServerDocs = new Map(state.docsById);
    state.docsById.clear();
    await seedLibraryIfEmpty();
    const secondTabSets = state.sets.slice(66);
    expect(secondTabSets).toHaveLength(66);
    expect(secondTabSets.map((s) => s.id)).toEqual(firstPassIds);
    for (const s of secondTabSets) {
      mergedServerDocs.set(s.id, s.data);
    }
    expect(mergedServerDocs.size).toBe(66);
  });

  it('writes nothing when the server collection already has documents (e.g. migrated PO data)', async () => {
    state.docsById.set('legacy-random-po-doc-id', {
      name: 'Bench Press',
      primaryMuscle: 'chest',
      isCustom: false,
      notes: '',
    });

    await seedLibraryIfEmpty();

    expect(state.sets).toHaveLength(0);
    expect(state.commits).toBe(0);
    expect(state.docsById.size).toBe(1);
  });
});
