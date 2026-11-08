/**
 * Training analytics dashboard screen (`/analytics`).
 * Aggregates weekly volume, muscle distribution, recent session cards, and progressive overload trends.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight } from 'lucide-react';
import { cn } from '../components/Layout';
import { subscribeLibrary, subscribeRecentSessions } from '../lib/db';
import { formatDateShort, formatDuration, formatRelative } from '../lib/format';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup, type Session } from '../types';
import { OverloadCard, type OverloadPoint } from './analytics/OverloadCard';
import { WeeklySplitCard } from './analytics/WeeklySplitCard';

const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: '#6ab2ff',
  back: '#ff716c',
  shoulders: '#ffeb3b',
  biceps: '#4CAF50',
  triceps: '#a78bfa',
  forearms: '#22d3ee',
  abs: '#f97316',
  glutes: '#ec4899',
  quads: '#84cc16',
  hamstrings: '#eab308',
  calves: '#06b6d4',
};

function sessionVolume(s: Session): number {
  let total = 0;
  for (const ex of s.exercises) {
    for (const set of ex.sets) {
      if (set.completedAt) total += (set.weight || 0) * (set.reps || 0);
    }
  }
  return total;
}

function sessionCompletedSetCount(s: Session): number {
  let n = 0;
  for (const ex of s.exercises) {
    for (const set of ex.sets) if (set.completedAt) n += 1;
  }
  return n;
}

/**
 * Renders the Analytics screen. Lazy-loaded from `App.tsx` so Recharts stays out of the gym bundle.
 */
export function Analytics() {
  const navigate = useNavigate();
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sessionsReady = false;
    let libraryReady = false;
    const settle = () => {
      if (sessionsReady && libraryReady) setLoading(false);
    };
    const unsubA = subscribeRecentSessions(50, (s) => {
      setRecentSessions(s);
      sessionsReady = true;
      settle();
    });
    const unsubB = subscribeLibrary((l) => {
      setLibrary(l);
      libraryReady = true;
      settle();
    });
    return () => {
      unsubA();
      unsubB();
    };
  }, []);

  const exerciseIndex = useMemo(
    () => new Map(library.map((e) => [e.id, e] as const)),
    [library],
  );

  const weekCutoff = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const weekSessions = useMemo(
    () => recentSessions.filter((s) => (s.finishedAt ?? s.startedAt) >= weekCutoff),
    [recentSessions, weekCutoff],
  );

  const weekTotalVolume = useMemo(
    () => weekSessions.reduce((acc, s) => acc + sessionVolume(s), 0),
    [weekSessions],
  );

  const muscleDistribution = useMemo(() => {
    const counts = new Map<MuscleGroup, number>();
    for (const s of weekSessions) {
      for (const ex of s.exercises) {
        const completed = ex.sets.filter((set) => set.completedAt).length;
        if (completed === 0) continue;
        const lib = exerciseIndex.get(ex.exerciseId);
        if (!lib) continue;
        counts.set(lib.primaryMuscle, (counts.get(lib.primaryMuscle) ?? 0) + completed);
      }
    }
    return MUSCLE_GROUPS.map((m) => ({
      muscle: m,
      sets: counts.get(m) ?? 0,
      color: MUSCLE_COLORS[m],
    }))
      .filter((r) => r.sets > 0)
      .sort((a, b) => b.sets - a.sets);
  }, [weekSessions, exerciseIndex]);

  const totalWeekSets = useMemo(
    () => muscleDistribution.reduce((acc, r) => acc + r.sets, 0),
    [muscleDistribution],
  );

  const last10 = useMemo(() => recentSessions.slice(0, 10), [recentSessions]);

  const trackableExercises = useMemo(() => {
    const ids = new Set<string>();
    for (const s of recentSessions) {
      for (const ex of s.exercises) {
        if (ex.sets.some((st) => st.completedAt)) ids.add(ex.exerciseId);
      }
    }
    return library
      .filter((e) => ids.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [recentSessions, library]);

  useEffect(() => {
    if (selectedExerciseId) {
      if (!trackableExercises.find((e) => e.id === selectedExerciseId)) {
        setSelectedExerciseId(trackableExercises[0]?.id ?? '');
      }
      return;
    }
    if (trackableExercises.length > 0) {
      setSelectedExerciseId(trackableExercises[0].id);
    }
  }, [trackableExercises, selectedExerciseId]);

  const overloadData = useMemo<OverloadPoint[]>(() => {
    if (!selectedExerciseId) return [];
    const rows: OverloadPoint[] = [];
    const ordered = [...recentSessions].sort(
      (a, b) => (a.finishedAt ?? a.startedAt) - (b.finishedAt ?? b.startedAt),
    );
    for (const s of ordered) {
      let topWeight = 0;
      let volume = 0;
      let any = false;
      for (const ex of s.exercises) {
        if (ex.exerciseId !== selectedExerciseId) continue;
        for (const set of ex.sets) {
          if (!set.completedAt) continue;
          any = true;
          if (set.weight > topWeight) topWeight = set.weight;
          volume += (set.weight || 0) * (set.reps || 0);
        }
      }
      if (any) {
        const ts = s.finishedAt ?? s.startedAt;
        rows.push({ date: formatDateShort(ts), ts, topWeight, volume });
      }
    }
    return rows;
  }, [selectedExerciseId, recentSessions]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-on-surface-variant font-label text-sm tracking-widest uppercase">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      <header className="space-y-2">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Analytics</h1>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-on-surface-variant">
          <div className="flex items-baseline gap-2">
            <span className="font-headline text-2xl font-semibold text-on-surface">
              {weekSessions.length}
            </span>
            <span className="text-xs font-label uppercase tracking-widest">
              sessions this week
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-headline text-2xl font-semibold text-on-surface">
              {Math.round(weekTotalVolume).toLocaleString()}
            </span>
            <span className="text-xs font-label uppercase tracking-widest">kg volume</span>
          </div>
        </div>
      </header>

      <WeeklySplitCard rows={muscleDistribution} totalSets={totalWeekSets} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-semibold">Recent sessions</h2>
          <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
            Last {last10.length}
          </span>
        </div>

        {last10.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl border-t-4 border-secondary p-6">
            <p className="text-sm font-body text-on-surface-variant py-6 text-center">
              No completed sessions yet. Finish a workout to see it here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {last10.map((s, idx) => {
              const ts = s.finishedAt ?? s.startedAt;
              const duration =
                s.finishedAt && s.startedAt ? formatDuration(s.finishedAt - s.startedAt) : '—';
              const volume = Math.round(sessionVolume(s));
              const setCount = sessionCompletedSetCount(s);
              const exerciseCount = s.exercises.length;
              const accent =
                idx % 3 === 0
                  ? 'border-primary'
                  : idx % 3 === 1
                    ? 'border-secondary'
                    : 'border-tertiary-fixed';
              const accentText =
                idx % 3 === 0
                  ? 'text-primary'
                  : idx % 3 === 1
                    ? 'text-secondary'
                    : 'text-tertiary-fixed';
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/sessions/${s.id}`)}
                    className={cn(
                      'w-full text-left bg-surface-container-low rounded-xl border-t-4',
                      accent,
                      'hover:bg-surface-container transition-colors group',
                    )}
                  >
                    <div className="p-4 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-surface-bright flex items-center justify-center shrink-0">
                        <Calendar className={cn('w-5 h-5', accentText)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="font-headline font-semibold truncate">
                            {s.dayName || 'Workout'}
                          </h3>
                          <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant shrink-0">
                            {formatRelative(ts)}
                          </span>
                        </div>
                        <p className="text-xs font-label text-on-surface-variant mt-1 truncate">
                          {duration} · {volume.toLocaleString()} kg · {setCount} sets ·{' '}
                          {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-outline group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <OverloadCard
        exercises={trackableExercises}
        selectedExerciseId={selectedExerciseId}
        onSelectExercise={setSelectedExerciseId}
        data={overloadData}
      />
    </div>
  );
}

export default Analytics;
