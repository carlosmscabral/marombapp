/**
 * Component tests for immediate PT-BR UI updates during offline `setActivePlan` and `addPlanDay` (#17, REQ-002, REQ-006).
 * Mocks only the Firestore SDK with hanging `getDocs`, unacked writes, and non-re-emitting snapshots
 * to verify `PlanListView`, `PlanDetailView`, and `Plan` respond immediately.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan as PlanT } from '../../src/types';
import {
  createTestContainer,
  findButtons,
  findInputs,
  getReactProps,
  makeMockSnapshot,
  type MinimalElement,
} from './support/minimalDom';

interface DocRef {
  kind: 'doc';
  id: string;
  path: string;
}

const fsState = vi.hoisted(() => ({
  plans: [] as Array<{ id: string; name: string; active: boolean; createdAt: number }>,
  dayDocsByPlan: new Map<string, Array<{ id: string; name: string; order: number }>>(),
  nextSeq: 1,
  getDocsCalls: [] as string[],
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  batchUpdates: {} as Record<string, Record<string, unknown>>,
}));

vi.mock('../../src/lib/firebase', () => ({
  getFirestoreDb: () => ({ kind: 'mock-db' }),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({
    kind: 'col' as const,
    path: segments.join('/'),
  }),
  doc: (parent: { kind?: string; path?: string }, ...segments: string[]): DocRef => {
    const base = parent?.kind === 'col' && parent.path ? [parent.path] : [];
    const parts =
      segments.length > 0
        ? segments
        : [`gen-day-${String(fsState.nextSeq++).padStart(4, '0')}`];
    const path = [...base, ...parts].join('/');
    return { kind: 'doc', id: path.split('/').pop() ?? '', path };
  },
  query: (base: { path: string }) => base,
  orderBy: () => ({}),
  where: () => ({}),
  limit: () => ({}),
  serverTimestamp: () => 0,
  getDocs: (col: { path: string }) => {
    fsState.getDocsCalls.push(col.path);
    return new Promise<never>(() => {});
  },
  getDocsFromCache: async () => ({
    docs: [],
    empty: true,
    forEach: () => undefined,
  }),
  addDoc: () => new Promise<DocRef>(() => {}),
  setDoc: (ref: DocRef, data: Record<string, unknown>) => {
    fsState.setDocCalls.push({ path: ref.path, data });
    return new Promise<void>(() => {});
  },
  deleteDoc: () => new Promise<void>(() => {}),
  updateDoc: () => new Promise<void>(() => {}),
  onSnapshot: (target: { path: string }, cb: (snap: unknown) => void) => {
    if (target.path === 'plans') {
      cb(
        makeMockSnapshot('plans', fsState.plans, (p) => ({
          name: p.name,
          active: p.active,
          createdAt: p.createdAt,
          archivedAt: null,
        })),
      );
      return () => undefined;
    }
    const match = /^plans\/([^/]+)\/days$/.exec(target.path);
    const days = match ? (fsState.dayDocsByPlan.get(match[1]!) ?? []) : [];
    cb(
      makeMockSnapshot(target.path, days, (d) => ({
        name: d.name,
        order: d.order,
        exercises: [],
      })),
    );
    return () => undefined;
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
        fsState.batchUpdates = { ...updates };
        return new Promise<void>(() => {});
      },
    };
    return batch;
  },
}));

import { Plan } from '../../src/screens/Plan';
import { PlanDetailView } from '../../src/screens/plan/PlanDetailView';
import { PlanListView } from '../../src/screens/plan/PlanListView';

const PLAN_KEEP: PlanT = {
  id: 'p-keep',
  name: 'PPL',
  active: true,
  createdAt: 1000,
  archivedAt: null,
};

const PLAN_SCRATCH: PlanT = {
  id: 'p-scratch',
  name: 'Upper Lower',
  active: false,
  createdAt: 2000,
  archivedAt: null,
};

const clickEvt = { stopPropagation: () => undefined };

describe('PlanListView, PlanDetailView, and Plan offline setActivePlan / addPlanDay (#17)', () => {
  let container: MinimalElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    fsState.plans = [];
    fsState.dayDocsByPlan.clear();
    fsState.nextSeq = 1;
    fsState.getDocsCalls = [];
    fsState.setDocCalls = [];
    fsState.batchUpdates = {};
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

  it('PlanListView "Definir como ativo" moves the "Ativo" badge immediately without getDocs or snapshot re-emission', async () => {
    await act(async () => {
      root!.render(
        <PlanListView plans={[PLAN_SCRATCH, PLAN_KEEP]} onOpen={vi.fn()} />,
      );
    });

    const moreButtons = findButtons(container).filter(
      (b) => getReactProps(b)['aria-label'] === 'Mais opções',
    );
    await act(async () => {
      getReactProps(moreButtons[0]!).onClick?.(clickEvt);
    });

    const setActiveBtn = findButtons(container).find(
      (b) => b.textContent.trim() === 'Definir como ativo',
    )!;
    await act(async () => {
      getReactProps(setActiveBtn).onClick?.(clickEvt);
    });

    expect(fsState.getDocsCalls).toEqual([]);
    expect(fsState.batchUpdates).toEqual({
      'plans/p-keep': { active: false },
      'plans/p-scratch': { active: true },
    });

    const scratchRow = findButtons(container).find((b) =>
      b.textContent.includes('Upper Lower'),
    )!;
    const keepRow = findButtons(container).find((b) =>
      b.textContent.includes('PPL'),
    )!;
    expect(scratchRow.textContent).toContain('Ativo');
    expect(keepRow.textContent).not.toContain('Ativo');
  });

  it('PlanDetailView "Definir como plano ativo" switches to "Plano ativo" and shows "Iniciar Treino" immediately', async () => {
    fsState.dayDocsByPlan.set('p-scratch', [{ id: 'd1', name: 'Upper', order: 0 }]);

    await act(async () => {
      root!.render(
        <MemoryRouter>
          <PlanDetailView
            plan={PLAN_SCRATCH}
            plans={[PLAN_KEEP, PLAN_SCRATCH]}
            library={[]}
            selectedDayId={null}
            onSelectDay={vi.fn()}
            onBack={vi.fn()}
          />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).not.toContain('Iniciar Treino');
    const activateBtn = findButtons(container).find((b) =>
      b.textContent.includes('Definir como plano ativo'),
    )!;
    await act(async () => {
      getReactProps(activateBtn).onClick?.(clickEvt);
    });

    expect(fsState.getDocsCalls).toEqual([]);
    expect(fsState.batchUpdates).toEqual({
      'plans/p-keep': { active: false },
      'plans/p-scratch': { active: true },
    });
    expect(container.textContent).toContain('Plano ativo');
    expect(container.textContent).not.toContain('Definir como plano ativo');
    expect(container.textContent).toContain('Iniciar Treino');
  });

  it('Plan "Adicionar Dia" queues unacked setDoc with next order and opens the new day immediately', async () => {
    fsState.plans = [{ id: 'p-keep', name: 'PPL', active: true, createdAt: 1000 }];
    fsState.dayDocsByPlan.set('p-keep', [
      { id: 'd1', name: 'Push', order: 0 },
      { id: 'd2', name: 'Pull', order: 1 },
    ]);

    await act(async () => {
      root!.render(
        <MemoryRouter>
          <Plan />
        </MemoryRouter>,
      );
    });

    const openPlanBtn = findButtons(container).find((b) =>
      b.textContent.includes('PPL'),
    )!;
    await act(async () => {
      getReactProps(openPlanBtn).onClick?.(clickEvt);
    });

    const addDayTrigger = findButtons(container).find((b) =>
      b.textContent.includes('Adicionar Dia'),
    )!;
    await act(async () => {
      getReactProps(addDayTrigger).onClick?.(clickEvt);
    });

    const dayInput = findInputs(container).find(
      (i) => getReactProps(i).placeholder === 'Nome do dia (ex.: Push 1)',
    )!;
    await act(async () => {
      getReactProps(dayInput).onChange?.({ target: { value: 'Pernas' } });
    });

    const submitAddBtn = findButtons(container).find(
      (b) => b.textContent.trim() === 'Adicionar',
    )!;
    await act(async () => {
      getReactProps(submitAddBtn).onClick?.(clickEvt);
    });

    expect(fsState.getDocsCalls).toEqual([]);
    expect(fsState.setDocCalls).toEqual([
      {
        path: 'plans/p-keep/days/gen-day-0001',
        data: { name: 'Pernas', order: 2, exercises: [] },
      },
    ]);
    expect(container.textContent).toContain('Dia de Treino');
    const dayTitleInput = findInputs(container).find(
      (i) => getReactProps(i).placeholder === 'Nome do dia',
    )!;
    expect(getReactProps(dayTitleInput).value).toBe('Pernas');

    const backBtn = findButtons(container).find(
      (b) => getReactProps(b)['aria-label'] === 'Voltar',
    )!;
    await act(async () => {
      getReactProps(backBtn).onClick?.(clickEvt);
    });
    expect(container.textContent).toContain('3 dias');
    expect(container.textContent).toContain('Pernas');
  });
});
