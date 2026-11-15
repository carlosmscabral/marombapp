/**
 * Serialized exercise and set mutators for active workout sessions (`sessions` collection).
 * Routes nested `exercises` array updates through `mutateSessionExercises` without awaiting server acknowledgments.
 */

import { buildInitialSetsFromHistory, type HistoryEntry } from '../history';
import type { Exercise, SessionExercise, SessionSet } from '../../types';
import { mutateSessionExercises } from './sessionShadow';

/**
 * Updates metadata fields (such as `notes`) on a single exercise inside `sessionId`.
 */
export async function updateSessionExercise(
  sessionId: string,
  exerciseIndex: number,
  updates: Partial<SessionExercise>,
): Promise<void> {
  await mutateSessionExercises(sessionId, (exercises) => {
    if (!exercises[exerciseIndex]) return null;
    exercises[exerciseIndex] = { ...exercises[exerciseIndex], ...updates };
    return exercises;
  });
}

/**
 * Writes weight, reps, and completion timestamp for a single set row.
 */
export async function logSet(
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  set: SessionSet,
): Promise<void> {
  await mutateSessionExercises(sessionId, (exercises) => {
    const ex = exercises[exerciseIndex];
    if (!ex || !ex.sets[setIndex]) return null;
    ex.sets[setIndex] = set;
    return exercises;
  });
}

/**
 * Appends a set to an exercise, copying weight and reps from the previous set.
 */
export async function addSetToExercise(
  sessionId: string,
  exerciseIndex: number,
): Promise<void> {
  await mutateSessionExercises(sessionId, (exercises) => {
    const ex = exercises[exerciseIndex];
    if (!ex) return null;
    const lastSet = ex.sets[ex.sets.length - 1];
    ex.sets.push({
      weight: lastSet?.weight ?? 0,
      reps: lastSet?.reps ?? 0,
      completedAt: null,
    });
    return exercises;
  });
}

/**
 * Removes `setIndex` from an exercise when more than one set exists.
 */
export async function removeSetFromExercise(
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
): Promise<void> {
  await mutateSessionExercises(sessionId, (exercises) => {
    const ex = exercises[exerciseIndex];
    if (!ex || ex.sets.length <= 1 || !ex.sets[setIndex]) return null;
    ex.sets.splice(setIndex, 1);
    return exercises;
  });
}

/**
 * Appends an ad-hoc exercise to an active workout session, pre-filling 3 sets from history.
 */
export async function addExerciseToSession(
  sessionId: string,
  exercise: Exercise,
  latestHistory?: HistoryEntry,
): Promise<void> {
  await mutateSessionExercises(sessionId, (exercises) => {
    exercises.push({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      notes: '',
      sets: buildInitialSetsFromHistory(3, latestHistory),
    });
    return exercises;
  });
}

/**
 * Removes an exercise card from an active workout session.
 */
export async function removeExerciseFromSession(
  sessionId: string,
  exerciseIndex: number,
): Promise<void> {
  await mutateSessionExercises(sessionId, (exercises) => {
    if (!exercises[exerciseIndex]) return null;
    exercises.splice(exerciseIndex, 1);
    return exercises;
  });
}
