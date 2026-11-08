/**
 * Seed data builders for the parity specs.
 * They produce documents in the exact shape that `src/lib/db/*` writes, keyed by Firestore path.
 * Specs seed through these builders when a journey needs prior state (history, analytics, plans).
 */

import type { Exercise, PlanExercise, Session, SessionExercise, SessionSet } from '../../../src/types';

export type Docs = Record<string, Record<string, unknown>>;

export const DAY = 86_400_000;

/** Three custom-free library entries with fixed ids so specs can reference them. */
export const LIB: Exercise[] = [
  { id: 'ex-bench', name: 'Bench Press', primaryMuscle: 'chest', isCustom: false, notes: '' },
  { id: 'ex-row', name: 'Barbell Row', primaryMuscle: 'back', isCustom: false, notes: '' },
  { id: 'ex-curl', name: 'Barbell Curl', primaryMuscle: 'biceps', isCustom: false, notes: '' },
  { id: 'ex-squat', name: 'Back Squat', primaryMuscle: 'quads', isCustom: false, notes: '' },
];

export function libraryDocs(items: Exercise[] = LIB): Docs {
  const out: Docs = {};
  for (const { id, ...data } of items) out[`exercises/${id}`] = data;
  return out;
}

export const pe = (exerciseId: string, targetSets = 3, low = 8, high = 12): PlanExercise => ({
  exerciseId,
  targetSets,
  targetRepsLow: low,
  targetRepsHigh: high,
  notes: '',
});

/** Builds one active plan `p1` with the given days (ids `d1`, `d2`, … in order). */
export function planDocs(name: string, days: Array<{ name: string; exercises: PlanExercise[] }>, active = true): Docs {
  const out: Docs = {
    'plans/p1': { name, active, createdAt: Date.now() - 30 * DAY, archivedAt: null },
  };
  days.forEach((d, i) => {
    out[`plans/p1/days/d${i + 1}`] = { name: d.name, order: i, exercises: d.exercises };
  });
  return out;
}

export const done = (weight: number, reps: number, at = 1): SessionSet => ({ weight, reps, completedAt: at });

export const sx = (exerciseId: string, sets: SessionSet[], notes = ''): SessionExercise => ({
  exerciseId,
  exerciseName: LIB.find((e) => e.id === exerciseId)?.name ?? exerciseId,
  notes,
  sets,
});

/** Builds a completed session document that finished `daysAgo` days ago and lasted 50 minutes. */
export function completedSession(id: string, daysAgo: number, exercises: SessionExercise[], extra: Partial<Session> = {}): Docs {
  const finishedAt = Date.now() - daysAgo * DAY;
  const data: Omit<Session, 'id'> = {
    planId: 'p1',
    planName: 'PPL',
    dayId: 'd1',
    dayName: 'Push',
    startedAt: finishedAt - 50 * 60_000,
    finishedAt,
    status: 'completed',
    sessionNotes: '',
    exercises,
    ...extra,
  };
  return { [`sessions/${id}`]: data as unknown as Record<string, unknown> };
}
