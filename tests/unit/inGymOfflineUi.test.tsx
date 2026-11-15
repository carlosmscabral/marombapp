/**
 * Component tests for offline in-gym workout start, finish, abandon, and detail views (#20, REQ-002, REQ-006).
 * Mocks only `firebase/firestore` with hanging `addDoc`/`setDoc`/`updateDoc`/`waitForPendingWrites`/`getDoc`
 * and non-re-emitting `onSnapshot` to verify zero UI stalls across `/start`, `/in-gym`, and `/sessions/:sessionId`.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestContainer,
  findButtons,
  findElementsByTag,
  getReactProps,
  makeMockSnapshot,
  type MinimalElement,
} from './support/minimalDom';
import {
  makeActiveSessionRecord,
  makeColRef,
  makeDocRef,
  makeDocSnap,
  type MockDocRef,
} from './support/offlineFsMock';

const fsState = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  activeSessionDoc: null as { id: string; data: Record<string, unknown> } | null,
  activePlanDoc: null as { id: string; data: Record<string, unknown> } | null,
  planDays: [] as Array<{ id: string; data: Record<string, unknown> }>,
  libraryDocs: [] as Array<{ id: string; data: Record<string, unknown> }>,
  nextSeq: 1,
  addDocCalls: [] as string[],
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  updateDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  waitForPendingWritesCalls: 0,
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
      () => `gen-sess-${String(fsState.nextSeq++).padStart(4, '0')}`,
    ),
  query: (base: { path: string }) => base,
  orderBy: () => ({}),
  where: () => ({}),
  limit: () => ({}),
  waitForPendingWrites: () => {
    fsState.waitForPendingWritesCalls += 1;
    return new Promise<void>(() => {});
  },
  getDoc: () => new Promise<never>(() => {}),
  getDocFromCache: async (ref: MockDocRef) => makeDocSnap(ref, fsState.docs.get(ref.path)),
  addDoc: (col: { path: string }) => {
    fsState.addDocCalls.push(col.path);
    return new Promise<MockDocRef>(() => {});
  },
  setDoc: (ref: MockDocRef, data: Record<string, unknown>) => {
    fsState.setDocCalls.push({ path: ref.path, data });
    fsState.docs.set(ref.path, { ...data });
    return new Promise<void>(() => {});
  },
  updateDoc: (ref: MockDocRef, data: Record<string, unknown>) => {
    fsState.updateDocCalls.push({ path: ref.path, data });
    const prev = fsState.docs.get(ref.path) ?? {};
    fsState.docs.set(ref.path, { ...prev, ...data });
    return new Promise<void>(() => {});
  },
  deleteDoc: (ref: MockDocRef) => {
    fsState.docs.delete(ref.path);
    return new Promise<void>(() => {});
  },
  onSnapshot: (
    target: { path: string },
    a: ((snap: unknown) => void) | Record<string, unknown>,
    b?: (snap: unknown) => void,
  ) => {
    const cb = (typeof a === 'function' ? a : b)!;
    if (target.path === 'sessions') {
      const items = fsState.activeSessionDoc
        ? [{ id: fsState.activeSessionDoc.id, ...fsState.activeSessionDoc.data }]
        : [];
      const docs = items.map((it) => ({
        id: it.id,
        metadata: { hasPendingWrites: false },
        data: () => it,
      }));
      cb({ docs, empty: docs.length === 0, forEach: () => undefined });
      return () => undefined;
    }
    if (target.path === 'plans') {
      const items = fsState.activePlanDoc
        ? [{ id: fsState.activePlanDoc.id, ...fsState.activePlanDoc.data }]
        : [];
      cb(makeMockSnapshot('plans', items, (it) => it));
      return () => undefined;
    }
    if (target.path.endsWith('/days')) {
      const items = fsState.planDays.map((d) => ({ id: d.id, ...d.data }));
      cb(makeMockSnapshot(target.path, items, (it) => it));
      return () => undefined;
    }
    if (target.path === 'exercises') {
      const items = fsState.libraryDocs.map((e) => ({ id: e.id, ...e.data }));
      cb(makeMockSnapshot('exercises', items, (it) => it));
      return () => undefined;
    }
    cb({ docs: [], empty: true, forEach: () => undefined });
    return () => undefined;
  },
}));

import { ActiveSessionProvider } from '../../src/lib/activeSession';
import { InGym } from '../../src/screens/InGym';
import { SessionDetail } from '../../src/screens/SessionDetail';
import { StartWorkout } from '../../src/screens/StartWorkout';

const clickEvt = { stopPropagation: () => undefined };

function renderRoutes(root: Root, initialEntry: string) {
  root.render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ActiveSessionProvider>
        <Routes>
          <Route path="/start" element={<StartWorkout />} />
          <Route path="/in-gym" element={<InGym />} />
          <Route path="/sessions/:sessionId" element={<SessionDetail />} />
        </Routes>
      </ActiveSessionProvider>
    </MemoryRouter>,
  );
}

describe('StartWorkout, InGym, and SessionDetail offline resilience (#20)', () => {
  let container: MinimalElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    fsState.docs.clear();
    fsState.activeSessionDoc = null;
    fsState.activePlanDoc = null;
    fsState.planDays = [];
    fsState.libraryDocs = [];
    fsState.nextSeq = 1;
    fsState.addDocCalls = [];
    fsState.setDocCalls = [];
    fsState.updateDocCalls = [];
    fsState.waitForPendingWritesCalls = 0;
    container = createTestContainer();
    (globalThis as Record<string, unknown>).confirm = () => true;
    (globalThis as Record<string, unknown>).sessionStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
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

  it('StartWorkout navigates to /in-gym and renders active exercise cards immediately when writes never ack', async () => {
    fsState.activePlanDoc = {
      id: 'p1',
      data: { name: 'PPL', active: true, createdAt: 1000, archivedAt: null },
    };
    fsState.planDays = [
      {
        id: 'd1',
        data: {
          name: 'Push',
          order: 0,
          exercises: [
            {
              exerciseId: 'ex-bench',
              targetSets: 3,
              targetRepsLow: 8,
              targetRepsHigh: 12,
              notes: '',
            },
          ],
        },
      },
    ];
    fsState.libraryDocs = [
      {
        id: 'ex-bench',
        data: {
          name: 'Bench Press',
          primaryMuscle: 'chest',
          notes: '',
          isCustom: false,
        },
      },
    ];

    await act(async () => {
      renderRoutes(root!, '/start');
    });

    const pickDayBtn = findButtons(container).find((b) =>
      b.textContent.includes('Push'),
    )!;
    await act(async () => {
      getReactProps(pickDayBtn).onClick?.(clickEvt);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fsState.addDocCalls).toEqual([]);
    expect(fsState.setDocCalls).toHaveLength(1);
    expect(fsState.setDocCalls[0]?.path).toBe('sessions/gen-sess-0001');
    expect(container.textContent).toContain('Treino Ativo');
    expect(container.textContent).toContain('Supino Reto');
    expect(container.textContent).not.toContain('Nenhum treino ativo');
  });

  it('InGym "Finalizar treino" skips waitForPendingWrites, queues completed status, and opens SessionDetail from cache', async () => {
    const activeData = makeActiveSessionRecord('Push Pesado', true);
    fsState.activeSessionDoc = { id: 's-live', data: activeData };
    fsState.docs.set('sessions/s-live', activeData);

    await act(async () => {
      renderRoutes(root!, '/in-gym');
    });

    const notesArea = findElementsByTag(container, 'TEXTAREA')[0]!;
    await act(async () => {
      getReactProps(notesArea).onChange?.({ target: { value: 'Ótimo treino offline' } });
    });

    const finishBtn = findButtons(container).find((b) =>
      b.textContent.includes('Finalizar treino'),
    )!;
    await act(async () => {
      getReactProps(finishBtn).onClick?.(clickEvt);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fsState.waitForPendingWritesCalls).toBe(0);
    expect(fsState.docs.get('sessions/s-live')).toMatchObject({
      status: 'completed',
      sessionNotes: 'Ótimo treino offline',
    });
    expect(container.textContent).toContain('Treino concluído');
    expect(container.textContent).toContain('Push Pesado');
    expect(container.textContent).toContain('Ótimo treino offline');
  });

  it('InGym "Abandonar" queues abandoned status and switches immediately to EmptyState without server ack', async () => {
    const activeData = makeActiveSessionRecord('Pull', false);
    fsState.activeSessionDoc = { id: 's-abort', data: activeData };
    fsState.docs.set('sessions/s-abort', activeData);

    await act(async () => {
      renderRoutes(root!, '/in-gym');
    });

    const abandonBtn = findButtons(container).find(
      (b) => b.textContent.trim() === 'Abandonar',
    )!;
    await act(async () => {
      getReactProps(abandonBtn).onClick?.(clickEvt);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fsState.waitForPendingWritesCalls).toBe(0);
    expect(fsState.docs.get('sessions/s-abort')).toMatchObject({
      status: 'abandoned',
    });
    expect(container.textContent).toContain('Nenhum treino ativo');
  });
});
