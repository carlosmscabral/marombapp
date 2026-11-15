/**
 * Component tests for optimistic PT-BR `Library` custom-exercise CRUD on unacked writes (#20, REQ-002, REQ-006).
 * Mocks only `firebase/firestore` with hanging `addDoc`/`setDoc`/`updateDoc`/`deleteDoc` and non-re-emitting `onSnapshot`
 * to prove custom-exercise modals close and update the grid immediately.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../../src/types';
import {
  createTestContainer,
  findButtons,
  findElementsByTag,
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
  exercises: [] as Exercise[],
  nextSeq: 1,
  addDocCalls: [] as string[],
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  updateDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  deleteDocCalls: [] as string[],
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
      () => `gen-ex-${String(fsState.nextSeq++).padStart(4, '0')}`,
    ),
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
  deleteDoc: (ref: MockDocRef) => {
    fsState.deleteDocCalls.push(ref.path);
    return new Promise<void>(() => {});
  },
  onSnapshot: (_target: { path: string }, cb: (snap: unknown) => void) => {
    cb(
      makeMockSnapshot('exercises', fsState.exercises, (ex) => ({
        name: ex.name,
        primaryMuscle: ex.primaryMuscle,
        ...(ex.subMuscle ? { subMuscle: ex.subMuscle } : {}),
        notes: ex.notes,
        isCustom: ex.isCustom,
      })),
    );
    return () => undefined;
  },
}));

import { Library } from '../../src/screens/Library';

const clickEvt = { stopPropagation: () => undefined };

describe('Library optimistic PT-BR custom-exercise CRUD on unacked writes (#20)', () => {
  let container: MinimalElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    fsState.exercises = [
      {
        id: 'seed-1',
        name: 'Barbell Bench Press',
        primaryMuscle: 'chest',
        notes: '',
        isCustom: false,
      },
    ];
    fsState.nextSeq = 1;
    fsState.addDocCalls = [];
    fsState.setDocCalls = [];
    fsState.updateDocCalls = [];
    fsState.deleteDocCalls = [];
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

  it('creates, edits, and deletes a custom exercise and closes sheets immediately when writes never ack', async () => {
    await act(async () => {
      root!.render(<Library />);
    });
    expect(container.textContent).toContain('1 exercício disponível');

    // Create custom exercise
    const addBtn = findButtons(container).find((b) =>
      b.textContent.includes('Adicionar'),
    )!;
    await act(async () => {
      getReactProps(addBtn).onClick?.(clickEvt);
    });
    const formNameInput = findInputs(container).find(
      (i) => getReactProps(i).placeholder === 'ex.: Supino Inclinado com Halteres',
    )!;
    await act(async () => {
      getReactProps(formNameInput).onChange?.({ target: { value: 'Zercher Squat' } });
    });
    const createForm = findElementsByTag(container, 'FORM')[0]!;
    await act(async () => {
      getReactProps(createForm).onSubmit?.({ preventDefault: () => undefined });
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fsState.addDocCalls).toEqual([]);
    expect(fsState.setDocCalls[0]).toMatchObject({
      path: 'exercises/gen-ex-0001',
      data: { name: 'Zercher Squat', isCustom: true },
    });
    expect(container.textContent).not.toContain('Novo exercício');
    expect(container.textContent).toContain('2 exercícios disponíveis');
    expect(container.textContent).toContain('Zercher Squat');

    // Open detail -> Edit -> Save
    const zercherCard = findButtons(container).find((b) =>
      b.textContent.includes('Zercher Squat'),
    )!;
    await act(async () => {
      getReactProps(zercherCard).onClick?.(clickEvt);
    });
    const editBtn = findButtons(container).find((b) =>
      b.textContent.includes('Editar'),
    )!;
    await act(async () => {
      getReactProps(editBtn).onClick?.(clickEvt);
    });
    const editInput = findInputs(container).find(
      (i) => getReactProps(i).value === 'Zercher Squat',
    )!;
    await act(async () => {
      getReactProps(editInput).onChange?.({ target: { value: 'Zercher Pesado' } });
    });
    const editForm = findElementsByTag(container, 'FORM')[0]!;
    await act(async () => {
      getReactProps(editForm).onSubmit?.({ preventDefault: () => undefined });
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(container.textContent).not.toContain('Editar exercício');
    expect(container.textContent).toContain('Zercher Pesado');

    // Open detail -> Delete -> Confirm
    const heavyCard = findButtons(container).find((b) =>
      b.textContent.includes('Zercher Pesado'),
    )!;
    await act(async () => {
      getReactProps(heavyCard).onClick?.(clickEvt);
    });
    const deleteBtn = findButtons(container).find(
      (b) => b.textContent.trim() === 'Excluir',
    )!;
    await act(async () => {
      getReactProps(deleteBtn).onClick?.(clickEvt);
    });
    const confirmBtn = findButtons(container).find(
      (b) => b.textContent.trim() === 'Confirmar',
    )!;
    await act(async () => {
      getReactProps(confirmBtn).onClick?.(clickEvt);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fsState.deleteDocCalls).toEqual(['exercises/gen-ex-0001']);
    expect(container.textContent).toContain('1 exercício disponível');
    expect(container.textContent).not.toContain('Zercher Pesado');
  });
});
