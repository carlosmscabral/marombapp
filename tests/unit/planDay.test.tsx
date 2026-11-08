/**
 * Component tests for `PlanDay` snapshot re-render race protection (#8, REQ-002).
 * Verifies that a Firestore snapshot re-render between a debounced field edit and its flush
 * never drops pending or follow-up field edits.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../../src/lib/debounce';
import type { Exercise, PlanDay as PlanDayT, PlanExercise } from '../../src/types';

const mocks = vi.hoisted(() => ({
  setDayExercises: vi.fn(async (_p: string, _d: string, _ex: PlanExercise[]) => undefined),
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
  nodeName: string;
  tagName: string;
  namespaceURI: string;
  ownerDocument: unknown;
  childNodes: Array<MinimalElement | { nodeType: 3; nodeValue: string; parentNode?: unknown }>;
  parentNode?: unknown;
  style: Record<string, unknown>;
  attributes: Record<string, string>;
  addEventListener: () => void;
  removeEventListener: () => void;
  setAttribute: (k: string, v: unknown) => void;
  removeAttribute: (k: string) => void;
  appendChild: (c: MinimalElement) => MinimalElement;
  removeChild: (c: MinimalElement) => MinimalElement;
  insertBefore: (c: MinimalElement, b: MinimalElement | null) => MinimalElement;
  textContent: string;
  [key: string]: unknown;
}

/**
 * Creates a lightweight DOM container so `react-dom/client` mounts `PlanDay` in Node.
 */
function createTestContainer(): MinimalElement {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as Record<string, unknown>).HTMLIFrameElement = class {};

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
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };

  function makeEl(tag: string): MinimalElement {
    const el: MinimalElement = {
      nodeType: 1,
      nodeName: tag.toUpperCase(),
      tagName: tag.toUpperCase(),
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      ownerDocument: doc,
      childNodes: [],
      style: {},
      attributes: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setAttribute(k: string, v: unknown) {
        this.attributes[k] = String(v);
      },
      removeAttribute(k: string) {
        delete this.attributes[k];
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
      get textContent(): string {
        return this.childNodes
          .map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent))
          .join('');
      },
      set textContent(value: string) {
        this.childNodes = value
          ? [{ nodeType: 3 as const, nodeValue: String(value), parentNode: this }]
          : [];
      },
    };
    return el;
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
];

function makeDay(overrides?: Partial<PlanExercise>): PlanDayT {
  return {
    id: 'd1',
    name: 'Push',
    order: 0,
    exercises: [
      {
        exerciseId: 'ex-bench',
        targetSets: 3,
        targetRepsLow: 8,
        targetRepsHigh: 12,
        notes: '',
        ...overrides,
      },
    ],
  };
}

describe('PlanDay snapshot re-render race protection (#8)', () => {
  let container: MinimalElement;
  let root: Root | null = null;

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

  it('persists both field A and field B when a Firestore snapshot re-renders before debounce flush', async () => {
    const onBack = vi.fn();
    await act(async () => {
      root!.render(<PlanDay planId="p1" day={makeDay()} library={LIBRARY} onBack={onBack} />);
    });

    const numberInputs = () =>
      findAllByTag(container, 'input').filter((el) => getReactProps(el).type === 'number');
    const notesTextarea = () => findAllByTag(container, 'textarea')[0]!;

    // 1. Edit field A (Sets -> 5) without flushing the 250ms debounce yet.
    await act(async () => {
      const setsProps = getReactProps(numberInputs()[0]!);
      setsProps.onFocus?.();
      setsProps.onChange?.({ target: { value: '5' } });
    });

    vi.advanceTimersByTime(100);
    expect(mocks.setDayExercises).not.toHaveBeenCalled();

    // 2. Deliver a Firestore snapshot re-render with pre-patch exercises before debounce flushes.
    await act(async () => {
      root!.render(<PlanDay planId="p1" day={makeDay()} library={LIBRARY} onBack={onBack} />);
    });

    // 3. Edit field B (Reps Low -> 6 and Notes -> 'paused') before the debounce flushes.
    await act(async () => {
      const repsLowProps = getReactProps(numberInputs()[1]!);
      repsLowProps.onFocus?.();
      repsLowProps.onChange?.({ target: { value: '6' } });

      const notesProps = getReactProps(notesTextarea());
      notesProps.onFocus?.();
      notesProps.onChange?.({ target: { value: 'paused' } });
    });

    // 4. Advance timers to flush the debounced write and assert both field A and field B persisted.
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(mocks.setDayExercises).toHaveBeenCalledTimes(1);
    expect(mocks.setDayExercises).toHaveBeenLastCalledWith('p1', 'd1', [
      {
        exerciseId: 'ex-bench',
        targetSets: 5,
        targetRepsLow: 6,
        targetRepsHigh: 12,
        notes: 'paused',
      },
    ]);
  });

  it('persists field A and field B when a stale snapshot arrives after field A blur before field B edit', async () => {
    const onBack = vi.fn();
    await act(async () => {
      root!.render(<PlanDay planId="p1" day={makeDay()} library={LIBRARY} onBack={onBack} />);
    });

    const numberInputs = () =>
      findAllByTag(container, 'input').filter((el) => getReactProps(el).type === 'number');

    // 1. Edit field A (Sets -> 5) and blur immediately to flush.
    await act(async () => {
      const setsProps = getReactProps(numberInputs()[0]!);
      setsProps.onFocus?.();
      setsProps.onChange?.({ target: { value: '5' } });
      setsProps.onBlur?.();
    });

    expect(mocks.setDayExercises).toHaveBeenCalledTimes(1);

    // 2. A stale snapshot (targetSets still 3) re-renders PlanDay before the write echoes back.
    await act(async () => {
      root!.render(<PlanDay planId="p1" day={makeDay()} library={LIBRARY} onBack={onBack} />);
    });

    // 3. Edit field B (Reps High -> 10) and blur to flush.
    await act(async () => {
      const repsHighProps = getReactProps(numberInputs()[2]!);
      repsHighProps.onFocus?.();
      repsHighProps.onChange?.({ target: { value: '10' } });
      repsHighProps.onBlur?.();
    });

    expect(mocks.setDayExercises).toHaveBeenCalledTimes(2);
    expect(mocks.setDayExercises).toHaveBeenLastCalledWith('p1', 'd1', [
      {
        exerciseId: 'ex-bench',
        targetSets: 5,
        targetRepsLow: 8,
        targetRepsHigh: 10,
        notes: '',
      },
    ]);
  });
});
