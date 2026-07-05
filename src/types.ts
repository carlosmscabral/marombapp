export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const SUB_MUSCLES: Record<MuscleGroup, string[]> = {
  chest: ['upper chest', 'mid chest', 'lower chest'],
  back: ['lats', 'upper back', 'lower back', 'traps'],
  shoulders: ['front delts', 'side delts', 'rear delts'],
  biceps: ['long head', 'short head', 'brachialis'],
  triceps: ['long head', 'lateral head', 'medial head'],
  forearms: ['flexors', 'extensors', 'brachioradialis'],
  abs: ['upper abs', 'lower abs', 'obliques'],
  glutes: ['glute max', 'glute med', 'glute min'],
  quads: ['rectus femoris', 'vastus lateralis', 'vastus medialis'],
  hamstrings: ['biceps femoris', 'semitendinosus', 'semimembranosus'],
  calves: ['gastrocnemius', 'soleus'],
};

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  subMuscle?: string;
  isCustom: boolean;
  notes: string;
}

export interface PlanExercise {
  exerciseId: string;
  targetSets: number;
  targetRepsLow: number;
  targetRepsHigh: number;
  restSec: number;
  notes: string;
}

export interface PlanDay {
  id: string;
  name: string;
  order: number;
  exercises: PlanExercise[];
}

export interface Plan {
  id: string;
  name: string;
  active: boolean;
  createdAt: number;
  archivedAt: number | null;
}

export interface SessionSet {
  weight: number;
  reps: number;
  completedAt: number | null;
}

export interface SessionExercise {
  exerciseId: string;
  exerciseName: string;
  notes: string;
  sets: SessionSet[];
  targetRepsLow?: number;
  targetRepsHigh?: number;
  restSec?: number;
}

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface Session {
  id: string;
  planId: string;
  planName: string;
  dayId: string;
  dayName: string;
  startedAt: number;
  finishedAt: number | null;
  status: SessionStatus;
  sessionNotes: string;
  restTimer: { startedAt: number; durationSec: number } | null;
  exercises: SessionExercise[];
}
