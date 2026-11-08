/**
 * Progressive-overload history builder and set pre-population helpers.
 * Aggregates prior completed executions by `exerciseId` across recent workouts.
 */

import type { Session, SessionSet } from '../types';

/** Number of recent completed sessions scanned for exercise history. */
export const HISTORY_WINDOW = 30;

/** Maximum number of prior executions displayed per exercise card. */
export const HISTORY_MAX = 3;

/**
 * Represents one prior completed execution of an exercise.
 */
export interface HistoryEntry {
  date: number;
  noteText: string;
  sets: SessionSet[];
}

/**
 * Builds a map from `exerciseId` to its last `HISTORY_MAX` completed executions (newest first).
 * Matching strictly by `exerciseId` keeps history intact across plan edits and day renames.
 * If a session repeats the same exercise (such as supersets), this function merges its completed sets.
 */
export function buildHistoryMap(sessions: Session[]): Map<string, HistoryEntry[]> {
  const map = new Map<string, HistoryEntry[]>();
  const ordered = [...sessions].sort(
    (a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt),
  );

  for (const s of ordered) {
    const perExercise = new Map<string, { sets: SessionSet[]; noteText: string }>();
    for (const ex of s.exercises) {
      const doneSets = ex.sets.filter((set) => set.completedAt != null);
      if (doneSets.length === 0) continue;
      const acc = perExercise.get(ex.exerciseId);
      if (acc) {
        acc.sets.push(...doneSets);
        if (!acc.noteText && ex.notes) acc.noteText = ex.notes;
      } else {
        perExercise.set(ex.exerciseId, {
          sets: doneSets,
          noteText: ex.notes ?? '',
        });
      }
    }

    const date = s.finishedAt ?? s.startedAt;
    for (const [exerciseId, acc] of perExercise) {
      const list = map.get(exerciseId) ?? [];
      if (list.length >= HISTORY_MAX) continue;
      list.push({ date, noteText: acc.noteText, sets: acc.sets });
      map.set(exerciseId, list);
    }
  }

  return map;
}

/**
 * Creates `targetSets` incomplete set rows pre-filled from the most recent completed execution.
 * If `targetSets` exceeds the prior set count, extra rows copy the last prior set's weight and reps.
 * Every returned set keeps `completedAt: null` until the user marks the set complete in the gym.
 */
export function buildInitialSetsFromHistory(
  targetSets: number,
  latestEntry?: HistoryEntry,
): SessionSet[] {
  const count = Math.max(0, targetSets || 0);
  const priorSets = latestEntry?.sets ?? [];
  return Array.from({ length: count }, (_, idx) => {
    const template = priorSets[idx] ?? priorSets[priorSets.length - 1];
    return {
      weight: template?.weight ?? 0,
      reps: template?.reps ?? 0,
      completedAt: null,
    };
  });
}
