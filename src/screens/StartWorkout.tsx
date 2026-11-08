/**
 * Workout day selector screen (`/start`).
 * Redirects to `/in-gym` if a session is already active, or starts a new session pre-filled from history.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell, Play } from 'lucide-react';
import { SignatureBar } from '../components/Layout';
import { useActiveSession } from '../lib/activeSession';
import {
  createSession,
  subscribeActivePlan,
  subscribeLibrary,
  subscribePlanDays,
  subscribeRecentSessions,
} from '../lib/db';
import { buildHistoryMap, HISTORY_WINDOW } from '../lib/history';
import type { Exercise, Plan, PlanDay, Session } from '../types';

/**
 * Lists training days for the active plan and creates a new workout session on selection.
 */
export function StartWorkout() {
  const navigate = useNavigate();
  const { activeSession, loading: sessionLoading } = useActiveSession();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [planReady, setPlanReady] = useState(false);
  const [creatingDayId, setCreatingDayId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeActivePlan((p) => {
      setPlan(p);
      setPlanReady(true);
    });
  }, []);

  useEffect(() => {
    if (!plan) {
      setDays([]);
      return;
    }
    return subscribePlanDays(plan.id, setDays);
  }, [plan]);

  useEffect(() => subscribeLibrary(setLibrary), []);
  useEffect(() => subscribeRecentSessions(HISTORY_WINDOW, setRecentSessions), []);

  useEffect(() => {
    if (!sessionLoading && activeSession) {
      navigate('/in-gym', { replace: true });
    }
  }, [sessionLoading, activeSession, navigate]);

  const libIndex = useMemo(
    () => new Map(library.map((e) => [e.id, e] as const)),
    [library],
  );
  const historyMap = useMemo(() => buildHistoryMap(recentSessions), [recentSessions]);

  const handlePickDay = async (day: PlanDay) => {
    if (!plan || creatingDayId) return;
    setCreatingDayId(day.id);
    try {
      await createSession(plan, day, library, historyMap);
      navigate('/in-gym');
    } catch (err) {
      console.error('createSession failed', err);
      setCreatingDayId(null);
    }
  };

  if (!planReady || sessionLoading) {
    return (
      <div className="px-4 py-12 text-center font-label text-sm text-on-surface-variant uppercase tracking-widest">
        Loading…
      </div>
    );
  }

  if (activeSession) {
    return (
      <div className="px-4 py-12 max-w-2xl mx-auto text-center space-y-4">
        <p className="font-label text-sm text-on-surface-variant uppercase tracking-widest">
          Resuming current session…
        </p>
        <Link
          to="/in-gym"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label font-bold uppercase tracking-widest text-xs"
        >
          <Play className="w-4 h-4" />
          Go to In-Gym
        </Link>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="px-4 py-12 max-w-2xl mx-auto flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-surface-container-low flex items-center justify-center border-t-4 border-primary">
          <Dumbbell className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="font-headline text-2xl font-bold">No active plan</h2>
          <p className="text-sm text-on-surface-variant">
            Create a training plan and mark it active before starting a workout.
          </p>
        </div>
        <Link
          to="/plan"
          className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label font-bold uppercase tracking-widest text-sm"
        >
          Go to plans
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-6 pb-24">
      <header className="space-y-1">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
          Start workout
        </p>
        <h1 className="font-headline text-3xl font-bold">{plan.name}</h1>
        <p className="text-sm text-on-surface-variant">
          Pick a training day to begin logging.
        </p>
      </header>

      <SignatureBar />

      {days.length === 0 ? (
        <div className="bg-surface-container-low rounded-xl p-6 text-center text-sm text-on-surface-variant">
          This plan has no days yet.{' '}
          <Link to="/plan" className="text-primary font-semibold">
            Add a day
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {days.map((day) => {
            const count = day.exercises.length;
            const totalSets = day.exercises.reduce(
              (sum, pe) => sum + (pe.targetSets || 0),
              0,
            );
            const preview = day.exercises
              .slice(0, 3)
              .map((pe) => libIndex.get(pe.exerciseId)?.name ?? 'Exercise')
              .join(' • ');
            const isCreating = creatingDayId === day.id;

            return (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => void handlePickDay(day)}
                  disabled={isCreating || count === 0}
                  className="w-full text-left bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-xl overflow-hidden border-t-4 border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-headline text-lg font-bold truncate">
                        {day.name}
                      </h3>
                      <p className="text-xs font-label text-on-surface-variant">
                        {count} {count === 1 ? 'exercise' : 'exercises'}
                        {totalSets ? ` • ${totalSets} sets` : ''}
                      </p>
                      {preview && (
                        <p className="text-xs text-on-surface-variant/70 truncate">
                          {preview}
                          {count > 3 ? ' …' : ''}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                      {isCreating ? (
                        <span className="font-label text-[10px] uppercase">…</span>
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
