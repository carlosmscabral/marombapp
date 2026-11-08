/**
 * Hook and pure merge helper for `PlanDay` exercise target and structural edits (#8, REQ-002).
 * Preserves pending local field patches across intermediate Firestore snapshot re-renders
 * so fast follow-up edits never lose earlier keystrokes.
 */

import { useEffect, useMemo, useRef } from 'react';
import { debounce, setDayExercises } from '../../lib/db';
import type { Exercise, PlanDay as PlanDayT, PlanExercise } from '../../types';

/**
 * Builds a stable key for the `n`-th occurrence of `exerciseId` within a day's exercise list.
 */
function exercisePatchKey(list: PlanExercise[], index: number): string {
  const targetId = list[index]?.exerciseId ?? '';
  let occurrence = 0;
  for (let i = 0; i < index; i++) {
    if (list[i]?.exerciseId === targetId) occurrence += 1;
  }
  return `${targetId}#${occurrence}`;
}

/**
 * Purely overlays `patches` onto `snapshot` without mutating `patches` during render.
 */
export function mergePendingPatches(
  snapshot: PlanExercise[],
  patches: ReadonlyMap<string, Partial<PlanExercise>>,
): PlanExercise[] {
  if (patches.size === 0) return snapshot;
  return snapshot.map((pe, idx) => {
    const patch = patches.get(exercisePatchKey(snapshot, idx));
    return patch ? { ...pe, ...patch } : pe;
  });
}

export interface UsePlanDayExercisesResult {
  exercises: PlanExercise[];
  flushExercises: () => void;
  cancelExercises: () => void;
  patchExercise: (idx: number, patch: Partial<PlanExercise>) => void;
  moveExercise: (idx: number, dir: -1 | 1) => void;
  removeExercise: (idx: number) => void;
  appendExercise: (ex: Exercise) => void;
}

/**
 * Manages debounced field patches and immediate structural edits for a training day's exercises.
 */
export function usePlanDayExercises(
  planId: string,
  day: PlanDayT,
): UsePlanDayExercisesResult {
  const prevDayIdRef = useRef(day.id);
  const hasUnflushedWriteRef = useRef(false);
  const pendingPatchesRef = useRef<Map<string, Partial<PlanExercise>>>(
    new Map(),
  );

  if (prevDayIdRef.current !== day.id) {
    prevDayIdRef.current = day.id;
    hasUnflushedWriteRef.current = false;
    pendingPatchesRef.current.clear();
  }

  const exercises = mergePendingPatches(
    day.exercises,
    pendingPatchesRef.current,
  );
  const latestExercisesRef = useRef(exercises);
  latestExercisesRef.current = exercises;

  // Prune confirmed patch keys in an effect once the snapshot echoes flushed values.
  useEffect(() => {
    if (hasUnflushedWriteRef.current || pendingPatchesRef.current.size === 0) {
      return;
    }
    day.exercises.forEach((pe, idx) => {
      const key = exercisePatchKey(day.exercises, idx);
      const patch = pendingPatchesRef.current.get(key);
      if (!patch) return;
      const remaining: Partial<PlanExercise> = { ...patch };
      for (const field of Object.keys(remaining) as Array<keyof PlanExercise>) {
        if (pe[field] === remaining[field]) {
          delete remaining[field];
        }
      }
      if (Object.keys(remaining).length === 0) {
        pendingPatchesRef.current.delete(key);
      } else {
        pendingPatchesRef.current.set(key, remaining);
      }
    });
  }, [day.exercises]);

  const debouncedWrite = useMemo(
    () =>
      debounce((next: PlanExercise[]) => {
        hasUnflushedWriteRef.current = false;
        setDayExercises(planId, day.id, next).catch(() => {});
      }, 250),
    [planId, day.id],
  );
  useEffect(() => () => debouncedWrite.flush(), [debouncedWrite]);

  const commitExercisesImmediately = (next: PlanExercise[]) => {
    // Cancel any pending keystroke timer so stale array snapshots cannot overwrite structural edits.
    debouncedWrite.cancel();
    hasUnflushedWriteRef.current = false;
    pendingPatchesRef.current.clear();
    latestExercisesRef.current = next;
    setDayExercises(planId, day.id, next).catch(() => {});
  };

  const patchExercise = (idx: number, patch: Partial<PlanExercise>) => {
    const current = latestExercisesRef.current;
    if (!current[idx]) return;
    const key = exercisePatchKey(current, idx);
    hasUnflushedWriteRef.current = true;
    pendingPatchesRef.current.set(key, {
      ...pendingPatchesRef.current.get(key),
      ...patch,
    });
    const next = current.map((pe, i) => (i === idx ? { ...pe, ...patch } : pe));
    latestExercisesRef.current = next;
    debouncedWrite(next);
  };

  const moveExercise = (idx: number, dir: -1 | 1) => {
    debouncedWrite.flush();
    const current = latestExercisesRef.current;
    const target = idx + dir;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[idx], next[target]] = [next[target], next[idx]];
    commitExercisesImmediately(next);
  };

  const removeExercise = (idx: number) => {
    const current = latestExercisesRef.current;
    const next = current.filter((_, i) => i !== idx);
    commitExercisesImmediately(next);
  };

  const appendExercise = (ex: Exercise) => {
    debouncedWrite.flush();
    const newPe: PlanExercise = {
      exerciseId: ex.id,
      targetSets: 3,
      targetRepsLow: 8,
      targetRepsHigh: 12,
      notes: '',
    };
    commitExercisesImmediately([...latestExercisesRef.current, newPe]);
  };

  return {
    exercises,
    flushExercises: () => debouncedWrite.flush(),
    cancelExercises: () => debouncedWrite.cancel(),
    patchExercise,
    moveExercise,
    removeExercise,
    appendExercise,
  };
}
