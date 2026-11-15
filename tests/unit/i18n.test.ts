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
  FIREBASE_CONFIG_ERROR_PT_BR,
  GENERIC_FIREBASE_ERROR_PT_BR,
  MUSCLE_LABELS_PT_BR,
  PT_BR,
  SUB_MUSCLE_LABELS_PT_BR,
  foldSearch,
  localizeFirebaseError,
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

describe('foldSearch and localizeFirebaseError (#21, REQ-002)', () => {
  it('folds NFD diacritics, cedilla, and uppercase characters while tolerating nullish values', () => {
    expect(foldSearch('Agachamento Búlgaro')).toBe('agachamento bulgaro');
    expect(foldSearch('Tríceps Testa')).toBe('triceps testa');
    expect(foldSearch('Elevação Lateral')).toBe('elevacao lateral');
    expect(foldSearch('Abdômen')).toBe('abdomen');
    expect(foldSearch('Glúteos / Glúteo máximo')).toBe('gluteos / gluteo maximo');
    expect(foldSearch('Quadríceps - Bíceps femoral')).toBe('quadriceps - biceps femoral');
    expect(foldSearch('Pinça com Anilha')).toBe('pinca com anilha');
    expect(foldSearch(undefined)).toBe('');
    expect(foldSearch(null)).toBe('');
  });

  it('maps Firebase Auth, Firestore, and config error codes to PT-BR without leaking raw English messages', () => {
    const netErr = Object.assign(
      new Error('Firebase: Error (auth/network-request-failed).'),
      { code: 'auth/network-request-failed' },
    );
    expect(localizeFirebaseError(netErr, PT_BR.auth.signInFailed)).toBe(
      'Sem conexão de rede. Verifique sua internet e tente novamente.',
    );

    const keyErr = Object.assign(
      new Error('Firebase: Error (auth/invalid-api-key).'),
      { code: 'auth/invalid-api-key' },
    );
    expect(localizeFirebaseError(keyErr, FIREBASE_CONFIG_ERROR_PT_BR)).toBe(
      'Chave de acesso do Firebase inválida. Verifique a configuração do aplicativo.',
    );

    expect(localizeFirebaseError('config')).toBe(FIREBASE_CONFIG_ERROR_PT_BR);
    expect(
      localizeFirebaseError(new Error('Firebase: Error (auth/popup-blocked).')),
    ).toContain('pop-up');
    expect(
      localizeFirebaseError({ code: 'auth/popup-closed-by-user' }),
    ).toContain('fechada');

    const permErr = Object.assign(
      new Error('Missing or insufficient permissions.'),
      { code: 'permission-denied' },
    );
    expect(localizeFirebaseError(permErr, PT_BR.library.saveFailed)).toBe(
      'Sem permissão para acessar ou salvar estes dados.',
    );
    expect(
      localizeFirebaseError(
        { code: 'firestore/unavailable', message: 'The service is currently unavailable.' },
        PT_BR.sessionDetail.loadFailed,
      ),
    ).toBe('Serviço temporariamente indisponível. Verifique sua conexão e tente novamente.');

    // Unknown raw English errors MUST return the PT-BR fallback and never leak err.message.
    const rawSdkErr = new Error('Unexpected internal English gRPC transport failure');
    expect(localizeFirebaseError(rawSdkErr, PT_BR.library.saveFailed)).toBe(
      PT_BR.library.saveFailed,
    );
    expect(localizeFirebaseError(rawSdkErr)).toBe(GENERIC_FIREBASE_ERROR_PT_BR);
    expect(localizeFirebaseError(null)).toBe(GENERIC_FIREBASE_ERROR_PT_BR);
  });
});
