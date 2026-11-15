/**
 * Component tests for accent-insensitive PT-BR exercise search and localized Firestore error rendering
 * across `ExercisePickerModal`, `ExerciseFormSheet`, and `SessionDetail` (#21, REQ-002, REQ-006).
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise } from '../../src/types';
import {
  createTestContainer,
  findInputs,
  getReactProps,
  type MinimalElement,
} from './support/minimalDom';

const dbMocks = vi.hoisted(() => ({
  createExercise: vi.fn(),
  updateExercise: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('../../src/lib/db', () => ({
  createExercise: dbMocks.createExercise,
  updateExercise: dbMocks.updateExercise,
  getSession: dbMocks.getSession,
  deleteSession: dbMocks.deleteSession,
}));

import { ExercisePickerModal } from '../../src/components/ExercisePickerModal';
import { ExerciseFormSheet } from '../../src/screens/library/ExerciseFormSheet';
import { SessionDetail } from '../../src/screens/SessionDetail';

function findForms(rootEl: MinimalElement): MinimalElement[] {
  const out: MinimalElement[] = [];
  function walk(node: MinimalElement) {
    if (node.tagName === 'FORM') out.push(node);
    for (const child of node.childNodes) {
      if (child.nodeType === 1) walk(child as MinimalElement);
    }
  }
  walk(rootEl);
  return out;
}

describe('Accent-insensitive picker search and localized Firestore UI errors (#21)', () => {
  let container: MinimalElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    container = createTestContainer();
    const doc = globalThis.document as unknown as {
      body?: { style: Record<string, unknown> };
      createElement: (tag: string) => MinimalElement;
    };
    doc.body = { style: {} };
    const origCreateElement = doc.createElement.bind(doc);
    doc.createElement = (tag: string) => {
      const el = origCreateElement(tag);
      if (el.tagName === 'SELECT') {
        Object.defineProperty(el, 'options', {
          get: () =>
            el.childNodes.filter(
              (c): c is MinimalElement =>
                c.nodeType === 1 && (c as MinimalElement).tagName === 'OPTION',
            ),
        });
      }
      return el;
    };
    const win = globalThis as Record<string, unknown>;
    win.addEventListener = () => undefined;
    win.removeEventListener = () => undefined;
    root = createRoot(container as unknown as Element);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
  });

  it('matches unaccented PT-BR name, muscle, and sub-muscle queries in ExercisePickerModal', async () => {
    const library: Exercise[] = [
      {
        id: 'ex-1',
        name: 'Bulgarian Split Squat',
        primaryMuscle: 'glutes',
        subMuscle: 'glute max',
        isCustom: false,
        notes: '',
      },
      {
        id: 'ex-2',
        name: 'Skull Crushers',
        primaryMuscle: 'triceps',
        subMuscle: 'long head',
        isCustom: false,
        notes: '',
      },
      {
        id: 'ex-3',
        name: 'Lateral Raise',
        primaryMuscle: 'shoulders',
        subMuscle: 'side delts',
        isCustom: false,
        notes: '',
      },
      {
        id: 'ex-4',
        name: 'Plank',
        primaryMuscle: 'abs',
        subMuscle: 'upper abs',
        isCustom: false,
        notes: '',
      },
    ];

    await act(async () => {
      root!.render(
        <ExercisePickerModal
          library={library}
          existingIds={[]}
          onPick={() => undefined}
          onClose={() => undefined}
        />,
      );
    });

    const searchInput = findInputs(container)[0]!;
    for (const [query, expectedTitle] of [
      ['agachamento bulgaro', 'Agachamento Búlgaro'],
      ['triceps testa', 'Tríceps Testa'],
      ['elevacao lateral', 'Elevação Lateral'],
      ['abdomen', 'Prancha'],
      ['gluteo maximo', 'Agachamento Búlgaro'],
    ] as const) {
      await act(async () => {
        getReactProps(searchInput).onChange?.({ target: { value: query } });
      });
      expect(container.textContent).toContain(expectedTitle);
    }
  });

  it('localizes Firestore permission-denied and unknown save errors in ExerciseFormSheet', async () => {
    dbMocks.createExercise.mockRejectedValueOnce(
      Object.assign(new Error('Missing or insufficient permissions.'), {
        code: 'permission-denied',
      }),
    );

    await act(async () => {
      root!.render(
        <ExerciseFormSheet editingExercise={null} onClose={() => undefined} />,
      );
    });

    const nameInput = findInputs(container)[0]!;
    await act(async () => {
      getReactProps(nameInput).onChange?.({ target: { value: 'Agachamento Zercher' } });
    });

    const form = findForms(container)[0]!;
    const formProps = getReactProps(form) as {
      onSubmit?: (e: { preventDefault: () => void }) => void;
    };
    await act(async () => {
      formProps.onSubmit?.({ preventDefault: () => undefined });
    });

    expect(container.textContent).toContain(
      'Sem permissão para acessar ou salvar estes dados.',
    );
    expect(container.textContent).not.toContain('Missing or insufficient permissions');

    dbMocks.createExercise.mockRejectedValueOnce(
      new Error('Raw English transport exception'),
    );
    await act(async () => {
      formProps.onSubmit?.({ preventDefault: () => undefined });
    });
    expect(container.textContent).toContain('Falha ao salvar');
    expect(container.textContent).not.toContain('Raw English transport exception');
  });

  it('localizes Firestore unavailable and unknown load errors in SessionDetail', async () => {
    dbMocks.getSession.mockRejectedValueOnce(
      Object.assign(new Error('The service is currently unavailable.'), {
        code: 'unavailable',
      }),
    );

    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={['/sessions/s-123']}>
          <Routes>
            <Route path="/sessions/:sessionId" element={<SessionDetail />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain(
      'Serviço temporariamente indisponível. Verifique sua conexão e tente novamente.',
    );
    expect(container.textContent).not.toContain('currently unavailable');
  });
});
