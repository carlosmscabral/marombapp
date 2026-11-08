/**
 * Component tests for `PlanDay` snapshot re-render race protection (#8, #12, REQ-002).
 * Verifies that Firestore snapshot re-renders (including exercise reorders) preserve pending
 * local patches, while rejected writes prune failed patches and pending offline writes keep them.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../../src/lib/debounce';
import type { Exercise, PlanDay as PlanDayT, PlanExercise } from '../../src/types';

const mocks = vi.hoisted(() => ({
  setDayExercises: vi.fn(
    async (_p: string, _d: string, _ex: PlanExercise[]) => undefined,
  ),
  renamePlanDay: vi.fn(async () => undefined),
  deletePlanDay: vi.fn(async () => undefined),
}));

vi.mock('../../src/lib/db', () => ({
  debounce,
  setDayExercises: mocks.setDayExercises,
  renamePlanDay: mocks.renamePlanDay,
  deletePlanDay: mocks.deletePlanDay,
}));

import { PlanDay } from '../../src/screens/PlanDay';

interface MinimalElement {
  nodeType: number;
  tagName: string;
  childNodes: Array<MinimalElement | { nodeType: 3; nodeValue: string }>;
  parentNode?: unknown;
  style: Record<string, unknown>;
  attributes: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Creates a lightweight DOM container so `react-dom/client` mounts `PlanDay` in Node.
 */
function createTestContainer(): MinimalElement {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as Record<string, unknown>).HTMLIFrameElement = class {};
  const noop = () => undefined;

  const doc: Record<string, unknown> = {
    nodeType: 9,
    documentElement: { style: {} },
    createElement: (tag: string) => makeEl(tag),
    createElementNS: (_ns: string, tag: string) => makeEl(tag),
    createTextNode: (text: string) => ({
      nodeType: 3 as const,
      nodeValue: String(text),
      data: String(text),
    }),
    addEventListener: noop,
    removeEventListener: noop,
  };

  function makeEl(tag: string): MinimalElement {
    const upper = tag.toUpperCase();
    return {
      nodeType: 1,
      nodeName: upper,
      tagName: upper,
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      ownerDocument: doc,
      childNodes: [],
      style: {},
      attributes: {},
      addEventListener: noop,
      removeEventListener: noop,
      setAttribute(k: string, v: unknown) {
        (this.attributes as Record<string, string>)[k] = String(v);
      },
      removeAttribute(k: string) {
        delete (this.attributes as Record<string, string>)[k];
      },
      appendChild(child: MinimalElement) {
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
      },
      removeChild(child: MinimalElement) {
        this.childNodes = this.childNodes.filter((x) => x !== child);
        return child;
      },
      insertBefore(child: MinimalElement, before: MinimalElement | null) {
        const idx = before ? this.childNodes.indexOf(before) : -1;
        if (idx === -1) this.childNodes.push(child);
        else this.childNodes.splice(idx, 0, child);
        child.parentNode = this;
        return child;
      },
    };
  }

  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).document = doc;
  return makeEl('div');
}

function findAllByTag(rootEl: MinimalElement, tag: string): MinimalElement[] {
  const upper = tag.toUpperCase();
  const out: MinimalElement[] = [];
  function walk(node: MinimalElement) {
    if (node.tagName === upper) out.push(node);
    for (const child of node.childNodes) {
      if (child.nodeType === 1) walk(child as MinimalElement);
    }
  }
  walk(rootEl);
  return out;
}

interface ElementReactProps {
  type?: string;
  value?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onChange?: (e: { target: { value: string } }) => void;
}

function getReactProps(el: MinimalElement): ElementReactProps {
  const propKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return (propKey ? (el[propKey] as ElementReactProps) : {}) ?? {};
}

const LIBRARY: Exercise[] = [
  {
    id: 'ex-bench',
    name: 'Bench Press',
    primaryMuscle: 'chest',
    subMuscle: 'mid chest',
    isCustom: false,
    notes: '',
  },
  {
    id: 'ex-row',
    name: 'Barbell Row',
    primaryMuscle: 'back',
    subMuscle: 'lats',
    isCustom: false,
    notes: '',
  },
];

const BENCH: PlanExercise = {
  exerciseId: 'ex-bench',
  targetSets: 3,
  targetRepsLow: 8,
  targetRepsHigh: 12,
  notes: '',
};

const ROW: PlanExercise = {
  exerciseId: 'ex-row',
  targetSets: 4,
  targetRepsLow: 6,
  targetRepsHigh: 10,
  notes: '',
};

function makeDay(exercises: PlanExercise[] = [{ ...BENCH }]): PlanDayT {
  return {
    id: 'd1',
    name: 'Push',
    order: 0,
    exercises: exercises.map((e) => ({ ...e })),
  };
}

describe('PlanDay snapshot re-render race protection (#8, #12)', () => {
  let container: MinimalElement;
  let root: Root | null = null;
  const onBack = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
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
    vi.useRealTimers();
  });

  const numberInputs = () =>
    findAllByTag(container, 'input').filter(
      (el) => getReactProps(el).type === 'number',
    );

  async function renderDay(exercises?: PlanExercise[]) {
    await act(async () => {
      root!.render(
        <PlanDay
          planId="p1"
          day={makeDay(exercises)}
          library={LIBRARY}
          onBack={onBack}
        />,
      );
    });
  }

  async function editField(el: MinimalElement, value: string, blur = false) {
    await act(async () => {
      const props = getReactProps(el);
      props.onFocus?.();
      props.onChange?.({ target: { value } });
      if (blur) props.onBlur?.();
    });
  }

  it('persists both field A and field B when a snapshot re-renders before debounce flush', async () => {
    await renderDay();
    await editField(numberInputs()[0]!, '5');

    vi.advanceTimersByTime(100);
    expect(mocks.setDayExercises).not.toHaveBeenCalled();

    await renderDay();
    await editField(numberInputs()[1]!, '6');
    await editField(findAllByTag(container, 'textarea')[0]!, 'paused');

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(mocks.setDayExercises).toHaveBeenCalledTimes(1);
    expect(mocks.setDayExercises).toHaveBeenLastCalledWith('p1', 'd1', [
      { ...BENCH, targetSets: 5, targetRepsLow: 6, notes: 'paused' },
    ]);
  });

  it('persists field A and field B when a stale snapshot arrives after field A blur', async () => {
    await renderDay();
    await editField(numberInputs()[0]!, '5', true);
    expect(mocks.setDayExercises).toHaveBeenCalledTimes(1);

    await renderDay();
    await editField(numberInputs()[2]!, '10', true);

    expect(mocks.setDayExercises).toHaveBeenCalledTimes(2);
    expect(mocks.setDayExercises).toHaveBeenLastCalledWith('p1', 'd1', [
      { ...BENCH, targetSets: 5, targetRepsHigh: 10 },
    ]);
  });

  it('keeps a pending patch attached to exercise X when a snapshot reorders exercises before flush (#12 F2)', async () => {
    await renderDay([BENCH, ROW]);
    await editField(numberInputs()[0]!, '5');
    await renderDay([ROW, BENCH]);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(mocks.setDayExercises).toHaveBeenCalledTimes(1);
    expect(mocks.setDayExercises).toHaveBeenLastCalledWith('p1', 'd1', [
      { ...ROW },
      { ...BENCH, targetSets: 5 },
    ]);
  });

  it('prunes pending patches when setDayExercises rejects but keeps them while offline pending (#12 F1)', async () => {
    await renderDay();

    // 1. Offline pending write (never settles) must NOT prune the pending patch.
    mocks.setDayExercises.mockImplementationOnce(() => new Promise<void>(() => {}));
    await editField(numberInputs()[0]!, '5', true);
    expect(getReactProps(numberInputs()[0]!).value).toBe('5');

    // 2. Rejected write must prune the failed patch so UI falls back to persisted value (3).
    mocks.setDayExercises.mockRejectedValueOnce(new Error('permission-denied'));
    await editField(numberInputs()[0]!, '7', true);
    expect(getReactProps(numberInputs()[0]!).value).toBe('3');
  });
});
