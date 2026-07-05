import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell, Play } from 'lucide-react';
import { SignatureBar } from '../components/Layout';
import {
  createSession,
  subscribeActivePlan,
  subscribeActiveSession,
  subscribeLibrary,
  subscribePlanDays,
} from '../lib/db';
import type { Exercise, Plan, PlanDay, Session } from '../types';

export function StartWorkout() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [days, setDays] = useState<PlanDay[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [planReady, setPlanReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [creatingDayId, setCreatingDayId] = useState<string | null>(null);

  // Subscribe to active plan.
  useEffect(() => {
    const unsub = subscribeActivePlan((p) => {
      setPlan(p);
      setPlanReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to the active plan's days.
  useEffect(() => {
    if (!plan) {
      setDays([]);
      return;
    }
    const unsub = subscribePlanDays(plan.id, setDays);
    return () => unsub();
  }, [plan]);

  // Subscribe to the library (for denormalized exercise names).
  useEffect(() => {
    const unsub = subscribeLibrary(setLibrary);
    return () => unsub();
  }, []);

  // Subscribe to active session — if one exists, jump straight to In-Gym.
  useEffect(() => {
    const unsub = subscribeActiveSession((s) => {
      setActiveSession(s);
      setSessionReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (sessionReady && activeSession) {
      navigate('/in-gym', { replace: true });
    }
  }, [sessionReady, activeSession, navigate]);

  const libIndex = useMemo(
    () => new Map(library.map((e) => [e.id, e] as const)),
    [library],
  );

  const handlePickDay = async (day: PlanDay) => {
    if (!plan) return;
    if (creatingDayId) return;
    setCreatingDayId(day.id);
    try {
      await createSession(plan, day, library);
      navigate('/in-gym');
    } catch (err) {
      console.error('createSession failed', err);
      setCreatingDayId(null);
    }
  };

  if (!planReady || !sessionReady) {
    return (
      <div className="px-4 py-12 text-center font-label text-sm text-on-surface-variant uppercase tracking-widest">
        Loading…
      </div>
    );
  }

  // If there is an active session we are about to redirect — render minimal UI.
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
        <div className="w-20 h-20 rounded-2xl bg-surface-container-low flex items-center justify-center border-t-4 border-secondary">
          <Dumbbell className="w-10 h-10 text-secondary" />
        </div>
        <div className="space-y-2">
          <h2 className="font-headline text-2xl font-bold">No active plan</h2>
          <p className="text-sm text-on-surface-variant">
            Set a plan as active before starting a workout.
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
            const exCount = day.exercises.length;
            const setCount = day.exercises.reduce(
              (sum, e) => sum + (e.targetSets || 0),
              0,
            );
            const preview = day.exercises
              .slice(0, 3)
              .map((e) => libIndex.get(e.exerciseId)?.name ?? 'Exercise')
              .join(' • ');
            const isCreating = creatingDayId === day.id;
            return (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => void handlePickDay(day)}
                  disabled={isCreating || exCount === 0}
                  className="w-full text-left bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-xl overflow-hidden border-t-4 border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="p-5 flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-headline text-lg font-bold truncate">
                        {day.name}
                      </h3>
                      <p className="text-xs font-label text-on-surface-variant">
                        {exCount} {exCount === 1 ? 'exercise' : 'exercises'}
                        {setCount ? ` • ${setCount} sets` : ''}
                      </p>
                      {preview && (
                        <p className="text-xs text-on-surface-variant/70 truncate">
                          {preview}
                          {exCount > 3 ? ' …' : ''}
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
