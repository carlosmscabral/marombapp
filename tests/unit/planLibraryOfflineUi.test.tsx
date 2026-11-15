/**
 * Component tests for optimistic PT-BR `Plan` creation, rename, archive, and day reorder on unacked writes (#20, REQ-002).
 * Mocks only `firebase/firestore` with hanging writes and non-re-emitting `onSnapshot`
 * to prove remaining plan organizer flows never stall on poor signal.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestContainer,
  findButtons,
  findInputs,
  getReactProps,
  makeMockSnapshot,
  type MinimalElement,
} from './support/minimalDom';
import {
  makeColRef,
  makeDocRef,
  type MockDocRef,
} from './support/offlineFsMock';

const fsState = vi.hoisted(() => ({
  plans: [] as Array<{ id: string; name: string; active: boolean; createdAt: number }>,
  dayDocsByPlan: new Map<string, Array<{ id: string; name: string; order: number }>>(),
  nextSeq: 1,
  addDocCalls: [] as string[],
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  updateDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  batchUpdates: {} as Record<string, Record<string, unknown>>,
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
      () => `gen-plan-${String(fsState.nextSeq++).padStart(4, '0')}`,
    ),
  query: (base: { path: string }) => base,
  orderBy: () => ({}),
  where: () => ({}),
  limit: () => ({}),
  serverTimestamp: () => 0,
  getDocsFromCache: async () => ({
    docs: [],
    empty: true,
    forEach: () => undefined,
  }),
  addDoc: (col: { path: string }) => {
    fsState.addDocCalls.push(col.path);
    return new Promise<MockDocRef>(() => {});
  },
  setDoc: (ref: MockDocRef, data: Record<string, unknown>) => {
    fsState.setDocCalls.push({ path: ref.path, data });
    return new Promise<void>(() => {});
  },
  updateDoc: (ref: MockDocRef, data: Record<string, unknown>) => {
    fsState.updateDocCalls.push({ path: ref.path, data });
    return new Promise<void>(() => {});
  },
  deleteDoc: () => new Promise<void>(() => {}),
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
      update(ref: MockDocRef, data: Record<string, unknown>) {
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

const clickEvt = { stopPropagation: () => undefined };

describe('Plan optimistic PT-BR UI on unacked create, rename, archive, and reorder (#20)', () => {
  let container: MinimalElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    fsState.plans = [];
    fsState.dayDocsByPlan.clear();
    fsState.nextSeq = 1;
    fsState.addDocCalls = [];
    fsState.setDocCalls = [];
    fsState.updateDocCalls = [];
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

  it('Plan opens newly created first plan immediately as "Plano ativo" without addDoc ack or snapshot re-emission', async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter>
          <Plan />
        </MemoryRouter>,
      );
    });

    const startCreateBtn = findButtons(container).find((b) =>
      b.textContent.includes('Criar plano'),
    )!;
    await act(async () => {
      getReactProps(startCreateBtn).onClick?.(clickEvt);
    });

    const planNameInput = findInputs(container)[0]!;
    await act(async () => {
      getReactProps(planNameInput).onChange?.({ target: { value: 'Treino A/B' } });
    });

    const createBtn = findButtons(container).find(
      (b) => b.textContent.trim() === 'Criar',
    )!;
    await act(async () => {
      getReactProps(createBtn).onClick?.(clickEvt);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fsState.addDocCalls).toEqual([]);
    expect(fsState.setDocCalls[0]).toMatchObject({
      path: 'plans/gen-plan-0001',
      data: { name: 'Treino A/B', active: false, archivedAt: null },
    });
    expect(container.textContent).toContain('Plano ativo');
    expect(container.textContent).toContain('Dias de Treino');
  });

  it('Plan reorders days, renames inline, and hides archived plans immediately when server acks hang', async () => {
    fsState.plans = [
      { id: 'p1', name: 'PPL', active: true, createdAt: 2000 },
      { id: 'p2', name: 'Full Body', active: false, createdAt: 1000 },
    ];
    fsState.dayDocsByPlan.set('p1', [
      { id: 'd1', name: 'Dia Alfa', order: 0 },
      { id: 'd2', name: 'Dia Beta', order: 1 },
    ]);

    await act(async () => {
      root!.render(
        <MemoryRouter>
          <Plan />
        </MemoryRouter>,
      );
    });

    // Open PPL and reorder Dia Alfa below Dia Beta.
    const openP1 = findButtons(container).find((b) => b.textContent.includes('PPL'))!;
    await act(async () => {
      getReactProps(openP1).onClick?.(clickEvt);
    });
    const moveDownBtn = findButtons(container).find(
      (b) => getReactProps(b)['aria-label'] === 'Mover para baixo',
    )!;
    await act(async () => {
      getReactProps(moveDownBtn).onClick?.(clickEvt);
    });
    expect(container.textContent.indexOf('Dia Beta')).toBeLessThan(
      container.textContent.indexOf('Dia Alfa'),
    );

    // Return to list, rename Full Body inline, then archive it.
    const backBtn = findButtons(container).find(
      (b) => getReactProps(b)['aria-label'] === 'Voltar aos planos',
    )!;
    await act(async () => {
      getReactProps(backBtn).onClick?.(clickEvt);
    });
    const menus = findButtons(container).filter(
      (b) => getReactProps(b)['aria-label'] === 'Mais opções',
    );
    await act(async () => {
      getReactProps(menus[1]!).onClick?.(clickEvt);
    });
    const renameMenu = findButtons(container).find(
      (b) => b.textContent.trim() === 'Renomear',
    )!;
    await act(async () => {
      getReactProps(renameMenu).onClick?.(clickEvt);
    });
    const inlineInput = findInputs(container)[0]!;
    await act(async () => {
      getReactProps(inlineInput).onChange?.({ target: { value: 'Força Pura' } });
    });
    await act(async () => {
      getReactProps(inlineInput).onKeyDown?.({ key: 'Enter' });
    });
    expect(container.textContent).toContain('Força Pura');

    const menusAfter = findButtons(container).filter(
      (b) => getReactProps(b)['aria-label'] === 'Mais opções',
    );
    await act(async () => {
      getReactProps(menusAfter[1]!).onClick?.(clickEvt);
    });
    const archiveMenu = findButtons(container).find(
      (b) => b.textContent.trim() === 'Arquivar',
    )!;
    await act(async () => {
      getReactProps(archiveMenu).onClick?.(clickEvt);
    });
    expect(container.textContent).not.toContain('Força Pura');
  });
});
