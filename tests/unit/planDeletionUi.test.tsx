/**
 * Component tests for optimistic, non-blocking plan deletion in `PlanDetailView` and `PlanListView` (#14, REQ-002, REQ-006).
 * Verifies that when network `getDocs` hangs and Firestore snapshots have not re-emitted yet,
 * `PlanDetailView` calls `onBack` immediately, `PlanListView` hides the deleted row immediately,
 * and all subscribed child days plus the parent plan enter the `writeBatch`.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '../../src/types';
import {
  createTestContainer,
  findButtons,
  getReactProps,
  type MinimalElement,
} from './support/minimalDom';

interface DocRef {
  id: string;
  path: string;
}

const fsState = vi.hoisted(() => ({
  dayDocsByPlan: new Map<string, Array<{ id: string; name: string; order: number }>>(),
  getDocsCalls: [] as string[],
  batchDeletes: [] as string[],
}));

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
  query: (base: { path: string }) => base,
  orderBy: () => ({}),
  where: () => ({}),
  limit: () => ({}),
  serverTimestamp: () => 0,
  addDoc: vi.fn(),
  deleteDoc: () => new Promise<void>(() => {}),
  updateDoc: () => new Promise<void>(() => {}),
  // Hanging network getDocs (~11.1s lie-fi stall in real SDK) must never block UI or batch queueing.
  getDocs: (col: { path: string }) => {
    fsState.getDocsCalls.push(col.path);
    return new Promise<never>(() => {});
  },
  // Empty cache read proves subscribed dayIds still carry child days into the delete batch.
  getDocsFromCache: async () => ({
    docs: [],
    empty: true,
    forEach: () => undefined,
  }),
  onSnapshot: (target: { path: string }, cb: (snap: unknown) => void) => {
    const match = /^plans\/([^/]+)\/days$/.exec(target.path);
    const days = match ? (fsState.dayDocsByPlan.get(match[1]!) ?? []) : [];
    const docs = days.map((d) => ({
      id: d.id,
      ref: { id: d.id, path: `${target.path}/${d.id}` },
      data: () => ({ name: d.name, order: d.order, exercises: [] }),
    }));
    cb({
      docs,
      empty: docs.length === 0,
      forEach: (fn: (d: (typeof docs)[number]) => void) => docs.forEach(fn),
    });
    return () => undefined;
  },
  writeBatch: () => {
    const deletes: string[] = [];
    const batch = {
      delete(ref: DocRef) {
        deletes.push(ref.path);
        return batch;
      },
      update() {
        return batch;
      },
      commit() {
        fsState.batchDeletes = [...deletes];
        return new Promise<void>(() => {});
      },
    };
    return batch;
  },
}));

import { PlanDetailView } from '../../src/screens/plan/PlanDetailView';
import { PlanListView } from '../../src/screens/plan/PlanListView';

const PLAN_DETAIL: Plan = {
  id: 'p-detail',
  name: 'Detail Plan',
  active: true,
  createdAt: 3000,
  archivedAt: null,
};

const PLAN_KEEP: Plan = {
  id: 'p-keep',
  name: 'PPL',
  active: true,
  createdAt: 1000,
  archivedAt: null,
};

const PLAN_SCRATCH: Plan = {
  id: 'p-scratch',
  name: 'Scratch Plan',
  active: false,
  createdAt: 2000,
  archivedAt: null,
};

describe('PlanDetailView and PlanListView optimistic delete on hanging network (#14)', () => {
  let container: MinimalElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    fsState.dayDocsByPlan.clear();
    fsState.getDocsCalls = [];
    fsState.batchDeletes = [];
    (globalThis as Record<string, unknown>).confirm = vi.fn(() => true);
    container = createTestContainer();
    root = createRoot(container as unknown as Element);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
  });

  it('PlanDetailView navigates onBack immediately, hides the plan in PlanListView, and batches subscribed days without getDocs', async () => {
    fsState.dayDocsByPlan.set('p-detail', [
      { id: 'd1', name: 'Push', order: 0 },
      { id: 'd2', name: 'Pull', order: 1 },
    ]);
    const onBack = vi.fn();

    await act(async () => {
      root!.render(
        <MemoryRouter>
          <PlanDetailView
            plan={PLAN_DETAIL}
            library={[]}
            selectedDayId={null}
            onSelectDay={vi.fn()}
            onBack={onBack}
          />
        </MemoryRouter>,
      );
    });

    const deleteBtn = findButtons(container).find((b) =>
      b.textContent.includes('Excluir plano'),
    );
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      getReactProps(deleteBtn!).onClick?.({ stopPropagation: () => undefined });
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(fsState.getDocsCalls).toEqual([]);
    expect(fsState.batchDeletes.sort()).toEqual([
      'plans/p-detail',
      'plans/p-detail/days/d1',
      'plans/p-detail/days/d2',
    ]);

    // Switching immediately to PlanListView before subscribeAllPlans re-emits must hide PLAN_DETAIL.
    await act(async () => {
      root!.render(
        <PlanListView plans={[PLAN_DETAIL, PLAN_KEEP]} onOpen={vi.fn()} />,
      );
    });
    expect(container.textContent).not.toContain('Detail Plan');
    expect(container.textContent).toContain('PPL');
  });

  it('PlanListView removes the deleted row optimistically before any snapshot re-emits and batches subscribed days', async () => {
    fsState.dayDocsByPlan.set('p-scratch', [
      { id: 'd1', name: 'Scratch Push', order: 0 },
      { id: 'd2', name: 'Scratch Pull', order: 1 },
    ]);

    await act(async () => {
      root!.render(
        <PlanListView plans={[PLAN_SCRATCH, PLAN_KEEP]} onOpen={vi.fn()} />,
      );
    });
    expect(container.textContent).toContain('Scratch Plan');

    const moreBtn = findButtons(container).find(
      (b) => getReactProps(b)['aria-label'] === 'Mais opções',
    );
    await act(async () => {
      getReactProps(moreBtn!).onClick?.({ stopPropagation: () => undefined });
    });

    const deleteMenuBtn = findButtons(container).find(
      (b) => b.textContent.trim() === 'Excluir',
    );
    await act(async () => {
      getReactProps(deleteMenuBtn!).onClick?.({ stopPropagation: () => undefined });
    });

    expect(container.textContent).not.toContain('Scratch Plan');
    expect(container.textContent).toContain('PPL');
    expect(fsState.getDocsCalls).toEqual([]);
    expect(fsState.batchDeletes.sort()).toEqual([
      'plans/p-scratch',
      'plans/p-scratch/days/d1',
      'plans/p-scratch/days/d2',
    ]);
  });
});
