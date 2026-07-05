import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { BarChart2, Calendar, ChevronRight, TrendingUp } from 'lucide-react';
import { SignatureBar, cn } from '../components/Layout';
import { subscribeRecentSessions, subscribeLibrary } from '../lib/db';
import type { Exercise, Session, MuscleGroup } from '../types';
import { MUSCLE_GROUPS } from '../types';

const PRIMARY = '#6ab2ff';
const SECONDARY = '#ff716c';
const TERTIARY = '#ffeb3b';
const GREEN = '#4CAF50';

// Stable color rotation across the 11 top-level muscle groups.
const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: PRIMARY,
  back: SECONDARY,
  shoulders: TERTIARY,
  biceps: GREEN,
  triceps: '#a78bfa',
  forearms: '#22d3ee',
  abs: '#f97316',
  glutes: '#ec4899',
  quads: '#84cc16',
  hamstrings: '#eab308',
  calves: '#06b6d4',
};

const AXIS_COLOR = '#97abd4';
const GRID_COLOR = '#34486b';

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

function sessionExerciseCount(s: Session): number {
  return s.exercises.length;
}

function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDateShort(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatRelative(ts: number): string {
  if (!ts) return '—';
  const now = Date.now();
  const diff = now - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day && new Date(ts).toDateString() === new Date(now).toDateString()) return 'Today';
  if (diff < 2 * day) return 'Yesterday';
  const days = Math.floor(diff / day);
  if (days < 7) return `${days} days ago`;
  return formatDateShort(ts);
}

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

  const exerciseIndex = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const e of library) map.set(e.id, e);
    return map;
  }, [library]);

  // ---- Week aggregates ----
  const weekCutoff = useMemo(() => Date.now() - 7 * 24 * 60 * 60 * 1000, []);
  const weekSessions = useMemo(
    () =>
      recentSessions.filter((s) => (s.finishedAt ?? s.startedAt) >= weekCutoff),
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
    const rows = MUSCLE_GROUPS
      .map((m) => ({
        muscle: m,
        sets: counts.get(m) ?? 0,
        color: MUSCLE_COLORS[m],
      }))
      .filter((r) => r.sets > 0)
      .sort((a, b) => b.sets - a.sets);
    return rows;
  }, [weekSessions, exerciseIndex]);

  const totalWeekSets = useMemo(
    () => muscleDistribution.reduce((acc, r) => acc + r.sets, 0),
    [muscleDistribution],
  );

  // ---- Recent sessions (last 10) ----
  const last10 = useMemo(() => recentSessions.slice(0, 10), [recentSessions]);

  // ---- Progressive overload ----
  // Exercises with at least one completed set anywhere in history.
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

  const overloadData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const rows: { date: string; ts: number; topWeight: number; volume: number }[] = [];
    // Walk oldest → newest so the chart reads left-to-right.
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
        rows.push({
          date: formatDateShort(ts),
          ts,
          topWeight,
          volume,
        });
      }
    }
    return rows;
  }, [selectedExerciseId, recentSessions]);

  // ----------------------------- render -----------------------------------

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-on-surface-variant font-label text-sm tracking-widest uppercase">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
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

      {/* Weekly muscle distribution */}
      <section className="bg-surface-container-low rounded-xl overflow-hidden border-t-4 border-primary">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline text-lg font-semibold">Weekly muscle split</h2>
              <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant mt-0.5">
                Last 7 days · {totalWeekSets} sets
              </p>
            </div>
            <BarChart2 className="text-primary w-5 h-5" />
          </div>

          {muscleDistribution.length === 0 ? (
            <EmptyHint text="Complete a few sets this week to see your muscle split." />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="w-full h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={muscleDistribution}
                      dataKey="sets"
                      nameKey="muscle"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {muscleDistribution.map((row) => (
                        <Cell key={row.muscle} fill={row.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#001f46',
                        border: '1px solid #34486b',
                        borderRadius: 8,
                        color: '#dbe5ff',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [`${value} sets`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="space-y-2">
                {muscleDistribution.map((row) => {
                  const pct = totalWeekSets > 0 ? (row.sets / totalWeekSets) * 100 : 0;
                  return (
                    <li key={row.muscle} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="capitalize">{row.muscle}</span>
                        </div>
                        <span className="font-headline font-semibold tabular-nums">
                          {row.sets}
                          <span className="text-xs font-label text-on-surface-variant ml-1">
                            sets
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-surface-container-highest overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: row.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <SignatureBar />
      </section>

      {/* Recent sessions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-lg font-semibold">Recent sessions</h2>
          <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
            Last {last10.length}
          </span>
        </div>

        {last10.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl border-t-4 border-secondary p-6">
            <EmptyHint text="No completed sessions yet. Finish a workout to see it here." />
          </div>
        ) : (
          <ul className="space-y-3">
            {last10.map((s, idx) => {
              const ts = s.finishedAt ?? s.startedAt;
              const duration =
                s.finishedAt && s.startedAt ? formatDuration(s.finishedAt - s.startedAt) : '—';
              const volume = Math.round(sessionVolume(s));
              const setCount = sessionCompletedSetCount(s);
              const exerciseCount = sessionExerciseCount(s);
              const accent =
                idx % 3 === 0 ? 'border-primary' : idx % 3 === 1 ? 'border-secondary' : 'border-tertiary-fixed';
              const accentText =
                idx % 3 === 0 ? 'text-primary' : idx % 3 === 1 ? 'text-secondary' : 'text-tertiary-fixed';
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

      {/* Progressive overload */}
      <section className="bg-surface-container-low rounded-xl overflow-hidden border-t-4 border-tertiary-fixed">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-headline text-lg font-semibold">Progressive overload</h2>
              <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant mt-0.5">
                Top set & total volume over time
              </p>
            </div>
            <TrendingUp className="text-tertiary-fixed w-5 h-5" />
          </div>

          {trackableExercises.length === 0 ? (
            <EmptyHint text="Log some completed sets to start tracking progress per exercise." />
          ) : (
            <>
              <label className="block">
                <span className="sr-only">Pick exercise</span>
                <select
                  value={selectedExerciseId}
                  onChange={(e) => setSelectedExerciseId(e.target.value)}
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-body text-on-surface focus:outline-none focus:border-primary"
                >
                  {trackableExercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>

              {overloadData.length === 0 ? (
                <EmptyHint text="No completed sets recorded for this exercise yet." />
              ) : overloadData.length === 1 ? (
                <div className="bg-surface-container rounded-lg p-4 text-sm font-body text-on-surface-variant">
                  <p>
                    One session logged so far ({overloadData[0].date}). Top weight{' '}
                    <span className="text-on-surface font-headline font-semibold">
                      {overloadData[0].topWeight} kg
                    </span>
                    , volume{' '}
                    <span className="text-on-surface font-headline font-semibold">
                      {Math.round(overloadData[0].volume).toLocaleString()} kg
                    </span>
                    . Log another to see a trend.
                  </p>
                </div>
              ) : (
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={overloadData}
                      margin={{ top: 10, right: 12, bottom: 0, left: -12 }}
                    >
                      <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke={AXIS_COLOR}
                        tick={{ fill: AXIS_COLOR, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                        tickLine={false}
                        axisLine={{ stroke: GRID_COLOR }}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke={PRIMARY}
                        tick={{ fill: AXIS_COLOR, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                        tickLine={false}
                        axisLine={{ stroke: GRID_COLOR }}
                        width={40}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke={TERTIARY}
                        tick={{ fill: AXIS_COLOR, fontSize: 11, fontFamily: 'Plus Jakarta Sans' }}
                        tickLine={false}
                        axisLine={{ stroke: GRID_COLOR }}
                        width={48}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#001f46',
                          border: '1px solid #34486b',
                          borderRadius: 8,
                          color: '#dbe5ff',
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: 12,
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'Top weight') return [`${value} kg`, name];
                          if (name === 'Volume') return [`${Math.round(value).toLocaleString()} kg`, name];
                          return [value, name];
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: 12,
                          color: AXIS_COLOR,
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="topWeight"
                        name="Top weight"
                        stroke={PRIMARY}
                        strokeWidth={2}
                        dot={{ fill: PRIMARY, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="volume"
                        name="Volume"
                        stroke={TERTIARY}
                        strokeWidth={2}
                        dot={{ fill: TERTIARY, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="text-sm font-body text-on-surface-variant py-6 text-center">{text}</p>
  );
}
