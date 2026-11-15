/**
 * Initial exercise encyclopedia seeder (#22, REQ-001, REQ-002, REQ-004, ADR-005).
 * Queries the Firestore server authoritatively (`getDocsFromServer`) with a bounded timeout,
 * skips silently when offline or served from cache, and writes deterministic document IDs
 * without awaiting commit acknowledgement so multi-tab launches never duplicate exercises.
 */

import {
  collection,
  doc,
  getDocsFromServer,
  limit,
  query,
  writeBatch,
} from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import type { Exercise, MuscleGroup } from '../types';

export interface SeedItem {
  name: string;
  primaryMuscle: MuscleGroup;
}

export const SEED_SERVER_CHECK_TIMEOUT_MS = 5_000;

export const SEED_EXERCISES: readonly SeedItem[] = [
  // Chest (6)
  { name: 'Bench Press', primaryMuscle: 'chest' },
  { name: 'Incline Dumbbell Press', primaryMuscle: 'chest' },
  { name: 'Dumbbell Fly', primaryMuscle: 'chest' },
  { name: 'Cable Crossover', primaryMuscle: 'chest' },
  { name: 'Push Up', primaryMuscle: 'chest' },
  { name: 'Dips', primaryMuscle: 'chest' },
  // Back (6)
  { name: 'Pull Up', primaryMuscle: 'back' },
  { name: 'Barbell Row', primaryMuscle: 'back' },
  { name: 'Lat Pulldown', primaryMuscle: 'back' },
  { name: 'Seated Cable Row', primaryMuscle: 'back' },
  { name: 'T-Bar Row', primaryMuscle: 'back' },
  { name: 'Face Pull', primaryMuscle: 'back' },
  // Shoulders (6)
  { name: 'Overhead Press', primaryMuscle: 'shoulders' },
  { name: 'Lateral Raise', primaryMuscle: 'shoulders' },
  { name: 'Rear Delt Fly', primaryMuscle: 'shoulders' },
  { name: 'Arnold Press', primaryMuscle: 'shoulders' },
  { name: 'Front Raise', primaryMuscle: 'shoulders' },
  { name: 'Upright Row', primaryMuscle: 'shoulders' },
  // Biceps (6)
  { name: 'Barbell Curl', primaryMuscle: 'biceps' },
  { name: 'Hammer Curl', primaryMuscle: 'biceps' },
  { name: 'Preacher Curl', primaryMuscle: 'biceps' },
  { name: 'Cable Curl', primaryMuscle: 'biceps' },
  { name: 'Incline Dumbbell Curl', primaryMuscle: 'biceps' },
  { name: 'Concentration Curl', primaryMuscle: 'biceps' },
  // Triceps (6)
  { name: 'Tricep Pushdown', primaryMuscle: 'triceps' },
  { name: 'Skull Crushers', primaryMuscle: 'triceps' },
  { name: 'Overhead Tricep Extension', primaryMuscle: 'triceps' },
  { name: 'Close Grip Bench', primaryMuscle: 'triceps' },
  { name: 'Tricep Dips', primaryMuscle: 'triceps' },
  { name: 'Tricep Kickback', primaryMuscle: 'triceps' },
  // Forearms (6)
  { name: 'Wrist Curl', primaryMuscle: 'forearms' },
  { name: 'Reverse Wrist Curl', primaryMuscle: 'forearms' },
  { name: "Farmer's Walk", primaryMuscle: 'forearms' },
  { name: 'Plate Pinch', primaryMuscle: 'forearms' },
  { name: 'Forearm Hammer Curl', primaryMuscle: 'forearms' },
  { name: 'Reverse Curl', primaryMuscle: 'forearms' },
  // Abs (6)
  { name: 'Plank', primaryMuscle: 'abs' },
  { name: 'Hanging Leg Raise', primaryMuscle: 'abs' },
  { name: 'Cable Crunch', primaryMuscle: 'abs' },
  { name: 'Russian Twist', primaryMuscle: 'abs' },
  { name: 'Ab Rollout', primaryMuscle: 'abs' },
  { name: 'Sit Up', primaryMuscle: 'abs' },
  // Glutes (6)
  { name: 'Hip Thrust', primaryMuscle: 'glutes' },
  { name: 'Bulgarian Split Squat', primaryMuscle: 'glutes' },
  { name: 'Glute Bridge', primaryMuscle: 'glutes' },
  { name: 'Cable Kickback', primaryMuscle: 'glutes' },
  { name: 'Step Up', primaryMuscle: 'glutes' },
  { name: 'Sumo Deadlift', primaryMuscle: 'glutes' },
  // Quads (6)
  { name: 'Back Squat', primaryMuscle: 'quads' },
  { name: 'Front Squat', primaryMuscle: 'quads' },
  { name: 'Leg Press', primaryMuscle: 'quads' },
  { name: 'Leg Extension', primaryMuscle: 'quads' },
  { name: 'Walking Lunge', primaryMuscle: 'quads' },
  { name: 'Hack Squat', primaryMuscle: 'quads' },
  // Hamstrings (6)
  { name: 'Romanian Deadlift', primaryMuscle: 'hamstrings' },
  { name: 'Lying Leg Curl', primaryMuscle: 'hamstrings' },
  { name: 'Seated Leg Curl', primaryMuscle: 'hamstrings' },
  { name: 'Good Morning', primaryMuscle: 'hamstrings' },
  { name: 'Stiff Leg Deadlift', primaryMuscle: 'hamstrings' },
  { name: 'Nordic Curl', primaryMuscle: 'hamstrings' },
  // Calves (6)
  { name: 'Standing Calf Raise', primaryMuscle: 'calves' },
  { name: 'Seated Calf Raise', primaryMuscle: 'calves' },
  { name: 'Donkey Calf Raise', primaryMuscle: 'calves' },
  { name: 'Smith Machine Calf Raise', primaryMuscle: 'calves' },
  { name: 'Single Leg Calf Raise', primaryMuscle: 'calves' },
  { name: 'Calf Press', primaryMuscle: 'calves' },
];

/**
 * Derives a deterministic, lowercase ASCII slug ID from a canonical English seed exercise name.
 */
export function seedExerciseId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Races `promise` against a bounded timeout, clearing the timer on settlement and absorbing
 * late rejections after timeout so hanging network checks never leak unhandled rejections.
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  promise.catch(() => undefined);
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timerId = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}

let inFlightSeed: Promise<void> | null = null;

async function runSeedLibraryIfEmpty(timeoutMs: number): Promise<void> {
  try {
    const db = getFirestoreDb();
    const col = collection(db, 'exercises');
    const snap = await withTimeout(getDocsFromServer(query(col, limit(1))), timeoutMs);
    if (!snap || snap.metadata?.fromCache === true || !snap.empty) {
      return;
    }

    const batch = writeBatch(db);
    for (const item of SEED_EXERCISES) {
      const ref = doc(col, seedExerciseId(item.name));
      const payload: Omit<Exercise, 'id'> = {
        name: item.name,
        primaryMuscle: item.primaryMuscle,
        isCustom: false,
        notes: '',
      };
      batch.set(ref, payload);
    }
    void batch.commit().catch(() => undefined);
  } catch {
    /* Skip silently when offline, unavailable, or timed out so cached/server data stays intact. */
  }
}

/**
 * Seeds the default 66 exercises only when the Firestore server confirms `exercises` has zero documents.
 */
export function seedLibraryIfEmpty(
  timeoutMs: number = SEED_SERVER_CHECK_TIMEOUT_MS,
): Promise<void> {
  if (!inFlightSeed) {
    inFlightSeed = runSeedLibraryIfEmpty(timeoutMs).finally(() => {
      inFlightSeed = null;
    });
  }
  return inFlightSeed;
}
