/**
 * Initial exercise encyclopedia seeder.
 * Populates the `exercises` collection once when the user signs in to an empty project.
 */

import { collection, getDocs, limit, query, writeBatch, doc } from 'firebase/firestore';
import { getFirestoreDb } from './firebase';
import type { Exercise, MuscleGroup } from '../types';

interface SeedItem {
  name: string;
  primaryMuscle: MuscleGroup;
}

const SEED_EXERCISES: SeedItem[] = [
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
 * Seeds the default 66 exercises if the `exercises` collection has zero documents.
 */
export async function seedLibraryIfEmpty(): Promise<void> {
  const db = getFirestoreDb();
  const col = collection(db, 'exercises');
  const snap = await getDocs(query(col, limit(1)));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  for (const item of SEED_EXERCISES) {
    const ref = doc(col);
    const payload: Omit<Exercise, 'id'> = {
      name: item.name,
      primaryMuscle: item.primaryMuscle,
      isCustom: false,
      notes: '',
    };
    batch.set(ref, payload);
  }
  await batch.commit();
}
