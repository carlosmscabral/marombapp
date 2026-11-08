/**
 * Unit tests for the initial exercise library seeder.
 * The as-is app seeds exactly 66 built-in exercises into an empty `exercises` collection.
 * The test replaces the Firestore SDK with an in-memory recorder so no network call happens.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSCLE_GROUPS } from '../../src/types';

const state = vi.hoisted(() => ({
  empty: true,
  sets: [] as Array<{ ref: unknown; data: Record<string, unknown> }>,
  commits: 0,
}));

vi.mock('../../src/lib/firebase', () => ({ getFirestoreDb: () => ({ fake: 'db' }) }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  limit: (n: number) => ({ limit: n }),
  query: (col: unknown, ...c: unknown[]) => ({ col, c }),
  getDocs: async () => ({ empty: state.empty }),
  doc: (col: { name: string }) => ({ col: col.name }),
  writeBatch: () => ({
    set: (ref: unknown, data: Record<string, unknown>) => state.sets.push({ ref, data }),
    commit: async () => {
      state.commits += 1;
    },
  }),
}));

const { seedLibraryIfEmpty } = await import('../../src/lib/seed');

describe('seedLibraryIfEmpty', () => {
  beforeEach(() => {
    state.empty = true;
    state.sets = [];
    state.commits = 0;
  });

  it('writes exactly 66 built-in exercises in one batch when the collection is empty', async () => {
    await seedLibraryIfEmpty();
    expect(state.sets).toHaveLength(66);
    expect(state.commits).toBe(1);
    expect(state.sets.every((s) => (s.ref as { col: string }).col === 'exercises')).toBe(true);
  });

  it('writes built-in, non-custom payloads with valid muscle groups and unique names', async () => {
    await seedLibraryIfEmpty();
    const names = new Set<string>();
    for (const { data } of state.sets) {
      expect(Object.keys(data).sort()).toEqual(['isCustom', 'name', 'notes', 'primaryMuscle']);
      expect(data.isCustom).toBe(false);
      expect(data.notes).toBe('');
      expect(MUSCLE_GROUPS).toContain(data.primaryMuscle);
      names.add(String(data.name));
    }
    expect(names.size).toBe(66);
  });

  it('covers every muscle group with six exercises each', async () => {
    await seedLibraryIfEmpty();
    const counts = new Map<string, number>();
    for (const { data } of state.sets) {
      const m = String(data.primaryMuscle);
      counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    for (const m of MUSCLE_GROUPS) expect(counts.get(m)).toBe(6);
  });

  it('writes nothing when the collection already has documents', async () => {
    state.empty = false;
    await seedLibraryIfEmpty();
    expect(state.sets).toHaveLength(0);
    expect(state.commits).toBe(0);
  });
});
