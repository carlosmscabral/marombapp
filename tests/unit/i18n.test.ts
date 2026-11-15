/**
 * Unit tests for the `pt-BR` display-layer glossary and HTML language metadata (#16, REQ-002, REQ-006).
 * Verifies 100% coverage and uniqueness across all 66 seed exercises, 11 muscle groups, and 34 sub-muscles,
 * while confirming custom user exercises render verbatim without modifying stored names.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXERCISE_NAMES_PT_BR,
  MUSCLE_LABELS_PT_BR,
  SUB_MUSCLE_LABELS_PT_BR,
  tExercise,
  tExerciseName,
  tMuscle,
  tSubMuscle,
} from '../../src/lib/i18n/pt-BR';
import { SEED_EXERCISES } from '../../src/lib/seed';
import { MUSCLE_GROUPS, SUB_MUSCLES } from '../../src/types';

describe('pt-BR glossary coverage and display-layer rules (#16)', () => {
  it('maps all 66 canonical seed exercises to unique non-empty display names', () => {
    expect(SEED_EXERCISES).toHaveLength(66);
    expect(Object.keys(EXERCISE_NAMES_PT_BR)).toHaveLength(66);

    const translated = new Set<string>();
    for (const item of SEED_EXERCISES) {
      const label = EXERCISE_NAMES_PT_BR[item.name];
      expect(label, `missing PT-BR mapping for "${item.name}"`).toBeTruthy();
      expect(label.trim().length).toBeGreaterThan(0);
      translated.add(label);
    }
    expect(translated.size).toBe(66);
  });

  it('translates built-in exercises at render while keeping custom exercise names as typed', () => {
    expect(tExercise({ name: 'Bench Press', isCustom: false })).toBe('Supino Reto');
    expect(tExercise({ name: 'Barbell Row', isCustom: false })).toBe('Remada Curvada');
    expect(tExercise({ name: 'Stiff Leg Deadlift', isCustom: false })).toBe('Stiff');
    expect(tExercise({ name: 'Cable Crossover', isCustom: false })).toBe('Crossover');
    expect(tExercise({ name: 'Face Pull', isCustom: false })).toBe('Face Pull');
    expect(tExercise({ name: 'Leg Press', isCustom: false })).toBe('Leg Press');

    // Custom exercises stay verbatim even if their name matches a canonical seed entry.
    expect(tExercise({ name: 'Zercher Squat', isCustom: true })).toBe('Zercher Squat');
    expect(tExercise({ name: 'Bench Press', isCustom: true })).toBe('Bench Press');
    expect(tExerciseName('Unknown exercise')).toBe('Exercício desconhecido');
  });

  it('maps every MuscleGroup and SUB_MUSCLES entry to a non-empty PT-BR label', () => {
    for (const m of MUSCLE_GROUPS) {
      expect(MUSCLE_LABELS_PT_BR[m]).toBeTruthy();
      expect(tMuscle(m)).toBe(MUSCLE_LABELS_PT_BR[m]);

      for (const sub of SUB_MUSCLES[m]) {
        expect(
          SUB_MUSCLE_LABELS_PT_BR[sub],
          `missing PT-BR sub-muscle mapping for "${sub}"`,
        ).toBeTruthy();
        expect(tSubMuscle(sub)).toBe(SUB_MUSCLE_LABELS_PT_BR[sub]);
      }
    }
    expect(tSubMuscle('')).toBe('');
    expect(tSubMuscle('custom sub')).toBe('custom sub');
  });

  it('sets lang="pt-BR" on index.html', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('<html lang="pt-BR">');
  });
});
