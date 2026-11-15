/**
 * Portuguese (Brazil) display-layer glossary for muscle groups, sub-muscles, and built-in exercises (#16, REQ-002, REQ-006).
 * Translates canonical English Firestore values at render time while leaving stored documents and custom exercise names untouched.
 */

import type { Exercise, MuscleGroup } from '../../types';

/**
 * Display labels in Brazilian Portuguese for every `MuscleGroup` enum value.
 */
export const MUSCLE_LABELS_PT_BR: Record<MuscleGroup, string> = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  abs: 'Abdômen',
  glutes: 'Glúteos',
  quads: 'Quadríceps',
  hamstrings: 'Posterior de Coxa',
  calves: 'Panturrilhas',
};

/**
 * Display labels in Brazilian Portuguese for every canonical `SUB_MUSCLES` key.
 */
export const SUB_MUSCLE_LABELS_PT_BR: Record<string, string> = {
  // Chest
  'upper chest': 'Peitoral superior',
  'mid chest': 'Peitoral médio',
  'lower chest': 'Peitoral inferior',
  // Back
  lats: 'Dorsais',
  'upper back': 'Costas superior',
  'lower back': 'Lombar',
  traps: 'Trapézio',
  // Shoulders
  'front delts': 'Deltóide anterior',
  'side delts': 'Deltóide lateral',
  'rear delts': 'Deltóide posterior',
  // Biceps & Triceps
  'long head': 'Cabeça longa',
  'short head': 'Cabeça curta',
  brachialis: 'Braquial',
  'lateral head': 'Cabeça lateral',
  'medial head': 'Cabeça medial',
  // Forearms
  flexors: 'Flexores',
  extensors: 'Extensores',
  brachioradialis: 'Braquiorradial',
  // Abs
  'upper abs': 'Abdômen superior',
  'lower abs': 'Abdômen inferior',
  obliques: 'Oblíquos',
  // Glutes
  'glute max': 'Glúteo máximo',
  'glute med': 'Glúteo médio',
  'glute min': 'Glúteo mínimo',
  // Quads
  'rectus femoris': 'Reto femoral',
  'vastus lateralis': 'Vasto lateral',
  'vastus medialis': 'Vasto medial',
  // Hamstrings
  'biceps femoris': 'Bíceps femoral',
  semitendinosus: 'Semitendíneo',
  semimembranosus: 'Semimembranoso',
  // Calves
  gastrocnemius: 'Gastrocnêmio',
  soleus: 'Sóleo',
};

/**
 * Display names in Brazilian Portuguese keyed by the 66 canonical seed exercise names in `src/lib/seed.ts`.
 * Terms naturally used in English in Brazilian gyms (`Crossover`, `Face Pull`, `Farmer's Walk`,
 * `Russian Twist`, `Step Up`, `Leg Press`, `Good Morning`, `Stiff`) stay idiomatic.
 */
export const EXERCISE_NAMES_PT_BR: Record<string, string> = {
  // Chest (6)
  'Bench Press': 'Supino Reto',
  'Incline Dumbbell Press': 'Supino Inclinado com Halteres',
  'Dumbbell Fly': 'Crucifixo com Halteres',
  'Cable Crossover': 'Crossover',
  'Push Up': 'Flexão de Braço',
  Dips: 'Paralelas',
  // Back (6)
  'Pull Up': 'Barra Fixa',
  'Barbell Row': 'Remada Curvada',
  'Lat Pulldown': 'Puxada Frontal',
  'Seated Cable Row': 'Remada Baixa',
  'T-Bar Row': 'Remada Cavalinho',
  'Face Pull': 'Face Pull',
  // Shoulders (6)
  'Overhead Press': 'Desenvolvimento Militar',
  'Lateral Raise': 'Elevação Lateral',
  'Rear Delt Fly': 'Crucifixo Inverso',
  'Arnold Press': 'Desenvolvimento Arnold',
  'Front Raise': 'Elevação Frontal',
  'Upright Row': 'Remada Alta',
  // Biceps (6)
  'Barbell Curl': 'Rosca Direta',
  'Hammer Curl': 'Rosca Martelo',
  'Preacher Curl': 'Rosca Scott',
  'Cable Curl': 'Rosca na Polia',
  'Incline Dumbbell Curl': 'Rosca Inclinada com Halteres',
  'Concentration Curl': 'Rosca Concentrada',
  // Triceps (6)
  'Tricep Pushdown': 'Tríceps Pulley',
  'Skull Crushers': 'Tríceps Testa',
  'Overhead Tricep Extension': 'Tríceps Francês',
  'Close Grip Bench': 'Supino Fechado',
  'Tricep Dips': 'Mergulho no Banco',
  'Tricep Kickback': 'Tríceps Coice',
  // Forearms (6)
  'Wrist Curl': 'Rosca de Punho',
  'Reverse Wrist Curl': 'Rosca de Punho Inversa',
  "Farmer's Walk": "Farmer's Walk",
  'Plate Pinch': 'Pinça com Anilha',
  'Forearm Hammer Curl': 'Rosca Martelo para Antebraço',
  'Reverse Curl': 'Rosca Inversa',
  // Abs (6)
  Plank: 'Prancha',
  'Hanging Leg Raise': 'Elevação de Pernas na Barra',
  'Cable Crunch': 'Abdominal na Polia',
  'Russian Twist': 'Russian Twist',
  'Ab Rollout': 'Roda Abdominal',
  'Sit Up': 'Abdominal Supra',
  // Glutes (6)
  'Hip Thrust': 'Elevação Pélvica',
  'Bulgarian Split Squat': 'Agachamento Búlgaro',
  'Glute Bridge': 'Ponte de Glúteos',
  'Cable Kickback': 'Coice na Polia',
  'Step Up': 'Step Up',
  'Sumo Deadlift': 'Levantamento Terra Sumô',
  // Quads (6)
  'Back Squat': 'Agachamento Livre',
  'Front Squat': 'Agachamento Frontal',
  'Leg Press': 'Leg Press',
  'Leg Extension': 'Cadeira Extensora',
  'Walking Lunge': 'Passada',
  'Hack Squat': 'Agachamento Hack',
  // Hamstrings (6)
  'Romanian Deadlift': 'Terra Romeno (RDL)',
  'Lying Leg Curl': 'Mesa Flexora',
  'Seated Leg Curl': 'Cadeira Flexora',
  'Good Morning': 'Good Morning',
  'Stiff Leg Deadlift': 'Stiff',
  'Nordic Curl': 'Flexão Nórdica',
  // Calves (6)
  'Standing Calf Raise': 'Panturrilha em Pé',
  'Seated Calf Raise': 'Panturrilha Sentado',
  'Donkey Calf Raise': 'Panturrilha Burrinho',
  'Smith Machine Calf Raise': 'Panturrilha no Smith',
  'Single Leg Calf Raise': 'Panturrilha Unilateral',
  'Calf Press': 'Panturrilha no Leg Press',
};

/**
 * Translates a `MuscleGroup` enum value to its PT-BR label.
 */
export function tMuscle(muscle: MuscleGroup): string {
  return MUSCLE_LABELS_PT_BR[muscle] ?? muscle;
}

/**
 * Translates a canonical `subMuscle` string to PT-BR, falling back to the raw value if custom or unknown.
 */
export function tSubMuscle(subMuscle: string | undefined | null): string {
  if (!subMuscle) return '';
  return SUB_MUSCLE_LABELS_PT_BR[subMuscle] ?? subMuscle;
}

/**
 * Translates a canonical built-in exercise name to PT-BR while preserving custom names as typed.
 */
export function tExerciseName(name: string, isCustom = false): string {
  if (isCustom) return name;
  if (name === 'Unknown exercise') return 'Exercício desconhecido';
  return EXERCISE_NAMES_PT_BR[name] ?? name;
}

/**
 * Translates an `Exercise` entity's display name, respecting `isCustom`.
 */
export function tExercise(exercise: Pick<Exercise, 'name' | 'isCustom'>): string {
  return tExerciseName(exercise.name, exercise.isCustom);
}
