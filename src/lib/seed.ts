import { collection, getDocs, limit, query, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Exercise, MuscleGroup } from '../types';

type SeedEntry = {
  name: string;
  primaryMuscle: MuscleGroup;
};

const SEED: SeedEntry[] = [
  // chest
  { name: 'Bench Press', primaryMuscle: 'chest' },
  { name: 'Incline Dumbbell Press', primaryMuscle: 'chest' },
  { name: 'Dumbbell Fly', primaryMuscle: 'chest' },
  { name: 'Cable Crossover', primaryMuscle: 'chest' },
  { name: 'Push Up', primaryMuscle: 'chest' },
  { name: 'Dips', primaryMuscle: 'chest' },

  // back
  { name: 'Pull Up', primaryMuscle: 'back' },
  { name: 'Barbell Row', primaryMuscle: 'back' },
  { name: 'Lat Pulldown', primaryMuscle: 'back' },
  { name: 'Seated Cable Row', primaryMuscle: 'back' },
  { name: 'T-Bar Row', primaryMuscle: 'back' },
  { name: 'Face Pull', primaryMuscle: 'back' },

  // shoulders
  { name: 'Overhead Press', primaryMuscle: 'shoulders' },
  { name: 'Lateral Raise', primaryMuscle: 'shoulders' },
  { name: 'Rear Delt Fly', primaryMuscle: 'shoulders' },
  { name: 'Arnold Press', primaryMuscle: 'shoulders' },
  { name: 'Front Raise', primaryMuscle: 'shoulders' },
  { name: 'Upright Row', primaryMuscle: 'shoulders' },

  // biceps
  { name: 'Barbell Curl', primaryMuscle: 'biceps' },
  { name: 'Hammer Curl', primaryMuscle: 'biceps' },
  { name: 'Preacher Curl', primaryMuscle: 'biceps' },
  { name: 'Cable Curl', primaryMuscle: 'biceps' },
  { name: 'Incline Dumbbell Curl', primaryMuscle: 'biceps' },
  { name: 'Concentration Curl', primaryMuscle: 'biceps' },

  // triceps
  { name: 'Tricep Pushdown', primaryMuscle: 'triceps' },
  { name: 'Skull Crushers', primaryMuscle: 'triceps' },
  { name: 'Overhead Tricep Extension', primaryMuscle: 'triceps' },
  { name: 'Close Grip Bench', primaryMuscle: 'triceps' },
  { name: 'Tricep Dips', primaryMuscle: 'triceps' },
  { name: 'Tricep Kickback', primaryMuscle: 'triceps' },

  // forearms
  { name: 'Wrist Curl', primaryMuscle: 'forearms' },
  { name: 'Reverse Wrist Curl', primaryMuscle: 'forearms' },
  { name: "Farmer's Walk", primaryMuscle: 'forearms' },
  { name: 'Plate Pinch', primaryMuscle: 'forearms' },
  { name: 'Forearm Hammer Curl', primaryMuscle: 'forearms' },
  { name: 'Reverse Curl', primaryMuscle: 'forearms' },

  // abs
  { name: 'Plank', primaryMuscle: 'abs' },
  { name: 'Hanging Leg Raise', primaryMuscle: 'abs' },
  { name: 'Cable Crunch', primaryMuscle: 'abs' },
  { name: 'Russian Twist', primaryMuscle: 'abs' },
  { name: 'Ab Rollout', primaryMuscle: 'abs' },
  { name: 'Sit Up', primaryMuscle: 'abs' },

  // glutes
  { name: 'Hip Thrust', primaryMuscle: 'glutes' },
  { name: 'Bulgarian Split Squat', primaryMuscle: 'glutes' },
  { name: 'Glute Bridge', primaryMuscle: 'glutes' },
  { name: 'Cable Kickback', primaryMuscle: 'glutes' },
  { name: 'Step Up', primaryMuscle: 'glutes' },
  { name: 'Sumo Deadlift', primaryMuscle: 'glutes' },

  // quads
  { name: 'Back Squat', primaryMuscle: 'quads' },
  { name: 'Front Squat', primaryMuscle: 'quads' },
  { name: 'Leg Press', primaryMuscle: 'quads' },
  { name: 'Leg Extension', primaryMuscle: 'quads' },
  { name: 'Walking Lunge', primaryMuscle: 'quads' },
  { name: 'Hack Squat', primaryMuscle: 'quads' },

  // hamstrings
  { name: 'Romanian Deadlift', primaryMuscle: 'hamstrings' },
  { name: 'Lying Leg Curl', primaryMuscle: 'hamstrings' },
  { name: 'Seated Leg Curl', primaryMuscle: 'hamstrings' },
  { name: 'Good Morning', primaryMuscle: 'hamstrings' },
  { name: 'Stiff Leg Deadlift', primaryMuscle: 'hamstrings' },
  { name: 'Nordic Curl', primaryMuscle: 'hamstrings' },

  // calves
  { name: 'Standing Calf Raise', primaryMuscle: 'calves' },
  { name: 'Seated Calf Raise', primaryMuscle: 'calves' },
  { name: 'Donkey Calf Raise', primaryMuscle: 'calves' },
  { name: 'Smith Machine Calf Raise', primaryMuscle: 'calves' },
  { name: 'Single Leg Calf Raise', primaryMuscle: 'calves' },
  { name: 'Calf Press', primaryMuscle: 'calves' },
];

export async function seedLibraryIfEmpty(): Promise<void> {
  const col = collection(db, 'exercises');
  const probe = await getDocs(query(col, limit(1)));
  if (!probe.empty) return;

  const batch = writeBatch(db);
  for (const entry of SEED) {
    const ref = doc(col);
    const exercise: Omit<Exercise, 'id'> = {
      name: entry.name,
      primaryMuscle: entry.primaryMuscle,
      isCustom: false,
      notes: '',
    };
    batch.set(ref, exercise);
  }
  await batch.commit();
}
