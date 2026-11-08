/**
 * Unit tests for the progressive-overload history builder.
 * The InGym card shows the last three executions and pre-fills set rows from them.
 * These tests pin ordering, the three-entry cap, superset merging, and pre-fill rules.
 */

import { describe, expect, it } from 'vitest';
import {
  HISTORY_MAX,
  HISTORY_WINDOW,
  buildHistoryMap,
  buildInitialSetsFromHistory,
} from '../../src/lib/history';
import type { Session, SessionExercise, SessionSet } from '../../src/types';

const done = (weight: number, reps: number, at = 1): SessionSet => ({ weight, reps, completedAt: at });
const open = (weight: number, reps: number): SessionSet => ({ weight, reps, completedAt: null });

function ex(exerciseId: string, sets: SessionSet[], notes = ''): SessionExercise {
  return { exerciseId, exerciseName: exerciseId, notes, sets };
}

function session(id: string, finishedAt: number | null, exercises: SessionExercise[], startedAt = 0): Session {
  return {
    id,
    planId: 'p1',
    planName: 'Plan',
    dayId: 'd1',
    dayName: 'Day',
    startedAt,
    finishedAt,
    status: 'completed',
    sessionNotes: '',
    exercises,
  };
}

describe('history constants', () => {
  it('scans 30 sessions and shows at most 3 executions', () => {
    expect(HISTORY_WINDOW).toBe(30);
    expect(HISTORY_MAX).toBe(3);
  });
});

describe('buildHistoryMap', () => {
  it('returns an empty map for no sessions', () => {
    expect(buildHistoryMap([]).size).toBe(0);
  });

  it('orders entries newest first regardless of input order', () => {
    const map = buildHistoryMap([
      session('s1', 100, [ex('bench', [done(60, 8)])]),
      session('s3', 300, [ex('bench', [done(70, 8)])]),
      session('s2', 200, [ex('bench', [done(65, 8)])]),
    ]);
    expect(map.get('bench')?.map((e) => e.date)).toEqual([300, 200, 100]);
    expect(map.get('bench')?.[0].sets).toEqual([done(70, 8)]);
  });

  it('keeps only the last three executions per exercise', () => {
    const sessions = [1, 2, 3, 4, 5].map((n) => session(`s${n}`, n * 100, [ex('squat', [done(n * 10, 5)])]));
    const entries = buildHistoryMap(sessions).get('squat') ?? [];
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.date)).toEqual([500, 400, 300]);
  });

  it('falls back to startedAt when finishedAt is null', () => {
    const map = buildHistoryMap([
      session('a', null, [ex('row', [done(40, 10)])], 500),
      session('b', 300, [ex('row', [done(35, 10)])]),
    ]);
    expect(map.get('row')?.map((e) => e.date)).toEqual([500, 300]);
  });

  it('ignores incomplete sets and exercises with no completed sets', () => {
    const map = buildHistoryMap([
      session('s1', 100, [ex('curl', [done(12, 10), open(14, 8)]), ex('fly', [open(10, 12)])]),
    ]);
    expect(map.get('curl')?.[0].sets).toEqual([done(12, 10)]);
    expect(map.has('fly')).toBe(false);
  });

  it('merges repeated exercises in one session and keeps the first non-empty note', () => {
    const map = buildHistoryMap([
      session('s1', 100, [
        ex('press', [done(40, 10)], ''),
        ex('other', [done(1, 1)]),
        ex('press', [done(42, 8)], 'felt strong'),
      ]),
    ]);
    const entry = map.get('press')?.[0];
    expect(entry?.sets).toEqual([done(40, 10), done(42, 8)]);
    expect(entry?.noteText).toBe('felt strong');
    expect(map.get('press')).toHaveLength(1);
  });

  it('matches by exerciseId so renamed days keep their history', () => {
    const a = session('a', 100, [ex('bench', [done(60, 8)])]);
    const b = { ...session('b', 200, [ex('bench', [done(62, 8)])]), dayName: 'Renamed', dayId: 'd9' };
    expect(buildHistoryMap([a, b]).get('bench')).toHaveLength(2);
  });
});

describe('buildInitialSetsFromHistory', () => {
  it('creates zeroed incomplete rows without history', () => {
    expect(buildInitialSetsFromHistory(2)).toEqual([open(0, 0), open(0, 0)]);
  });

  it('returns no rows for zero, negative, or missing targets', () => {
    expect(buildInitialSetsFromHistory(0)).toEqual([]);
    expect(buildInitialSetsFromHistory(-3)).toEqual([]);
    expect(buildInitialSetsFromHistory(Number.NaN)).toEqual([]);
  });

  it('copies weight and reps index by index and resets completedAt', () => {
    const latest = { date: 1, noteText: '', sets: [done(60, 10, 5), done(65, 8, 6)] };
    expect(buildInitialSetsFromHistory(2, latest)).toEqual([open(60, 10), open(65, 8)]);
  });

  it('repeats the last prior set when the target exceeds the prior count', () => {
    const latest = { date: 1, noteText: '', sets: [done(60, 10), done(65, 8)] };
    expect(buildInitialSetsFromHistory(4, latest)).toEqual([
      open(60, 10),
      open(65, 8),
      open(65, 8),
      open(65, 8),
    ]);
  });

  it('truncates to the target when history has more sets', () => {
    const latest = { date: 1, noteText: '', sets: [done(1, 1), done(2, 2), done(3, 3)] };
    expect(buildInitialSetsFromHistory(1, latest)).toEqual([open(1, 1)]);
  });
});
