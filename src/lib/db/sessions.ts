/**
 * Firestore repository for workout sessions (`sessions` collection).
 * Delegates nested `exercises` mutations to `sessionShadow` so rapid gym inputs stay race-free.
 */

import {
  addDoc,
  getDoc,
  getDocFromCache,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  waitForPendingWrites,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase';
import { buildInitialSetsFromHistory, type HistoryEntry } from '../history';
import type {
  Exercise,
  Plan,
  PlanDay,
  Session,
  SessionExercise,
  SessionSet,
} from '../../types';
import {
  clearShadow,
  mutateSessionExercises,
  sessionDoc,
  sessionsCol,
  setInitialShadow,
  syncShadowFromSnapshot,
} from './sessionShadow';

function sessionFromDoc(id: string, data: Record<string, unknown>): Session {
  return {
    id,
    planId: (data.planId as string) ?? '',
    planName: (data.planName as string) ?? '',
    dayId: (data.dayId as string) ?? '',
    dayName: (data.dayName as string) ?? '',
    startedAt: (data.startedAt as number) ?? 0,
    finishedAt: (data.finishedAt as number | null) ?? null,
    status: (data.status as Session['status']) ?? 'active',
    sessionNotes: (data.sessionNotes as string) ?? '',
    exercises: (data.exercises as SessionExercise[]) ?? [],
  };
}

/**
 * Waits for Firestore to flush queued local mutations when online.
 */
export async function flushPendingWrites(): Promise<void> {
  await waitForPendingWrites(getFirestoreDb());
}

/**
 * Subscribes to the single active workout session (`status == 'active'`).
 * Syncs the in-memory `exercises` shadow whenever a clean server snapshot arrives.
 */
export function subscribeActiveSession(
  cb: (session: Session | null) => void,
): Unsubscribe {
  const q = query(sessionsCol(), where('status', '==', 'active'), limit(1));
  return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    if (snap.empty) {
      cb(null);
      return;
    }
    const d = snap.docs[0];
    const parsed = sessionFromDoc(d.id, d.data());
    syncShadowFromSnapshot(d.id, parsed.exercises, d.metadata.hasPendingWrites);
    cb(parsed);
  });
}

/**
 * Subscribes to the `limitCount` most recently finished workouts.
 */
export function subscribeRecentSessions(
  limitCount: number,
  cb: (sessions: Session[]) => void,
): Unsubscribe {
  const q = query(
    sessionsCol(),
    where('status', '==', 'completed'),
    orderBy('finishedAt', 'desc'),
    limit(limitCount),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => sessionFromDoc(d.id, d.data())));
  });
}

/**
 * Loads a single session document, preferring local IndexedDB cache when offline.
 */
export async function getSession(id: string): Promise<Session | null> {
  const ref = sessionDoc(id);
  const snap = await getDoc(ref).catch(() => getDocFromCache(ref));
  if (!snap.exists()) return null;
  return sessionFromDoc(snap.id, snap.data());
}

/**
 * Starts a new active workout session for `day` and pre-fills set weights and reps
 * from `historyMap` when prior completed executions exist.
 */
export async function createSession(
  plan: Plan,
  day: PlanDay,
  library: Exercise[],
  historyMap?: Map<string, HistoryEntry[]>,
): Promise<string> {
  const libIndex = new Map(library.map((e) => [e.id, e] as const));
  const exercises: SessionExercise[] = day.exercises.map((pe) => {
    const lib = libIndex.get(pe.exerciseId);
    const latestHistory = historyMap?.get(pe.exerciseId)?.[0];
    return {
      exerciseId: pe.exerciseId,
      exerciseName: lib?.name ?? 'Unknown exercise',
      notes: '',
      sets: buildInitialSetsFromHistory(pe.targetSets || 0, latestHistory),
      targetRepsLow: pe.targetRepsLow,
      targetRepsHigh: pe.targetRepsHigh,
    };
  });

  const sessionData: Omit<Session, 'id'> = {
    planId: plan.id,
    planName: plan.name,
    dayId: day.id,
    dayName: day.name,
    startedAt: Date.now(),
    finishedAt: null,
    status: 'active',
    sessionNotes: '',
    exercises,
  };

  const ref = await addDoc(sessionsCol(), sessionData);
  setInitialShadow(ref.id, exercises);
  return ref.id;
}

/**
 * Updates a top-level scalar field (such as `sessionNotes`) on `sessionId`.
 */
export async function updateSessionField<K extends keyof Session>(
  sessionId: string,
  field: K,
  value: Session[K],
): Promise<void> {
  await updateDoc(sessionDoc(sessionId), { [field]: value });
}

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

/**
 * Marks `sessionId` as completed and clears its in-memory mutation shadow.
 */
export async function finishSession(sessionId: string): Promise<void> {
  clearShadow(sessionId);
  await updateDoc(sessionDoc(sessionId), {
    finishedAt: Date.now(),
    status: 'completed',
  });
}

/**
 * Marks `sessionId` as abandoned and clears its in-memory mutation shadow.
 */
export async function abandonSession(sessionId: string): Promise<void> {
  clearShadow(sessionId);
  await updateDoc(sessionDoc(sessionId), {
    finishedAt: Date.now(),
    status: 'abandoned',
  });
}
