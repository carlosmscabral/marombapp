/**
 * Active workout logger screen (`/in-gym`).
 * Orchestrates the session clock, rest timer bar, exercise cards, ad-hoc exercise picker, and finish flow.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Flag, Plus, Trash2 } from 'lucide-react';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { SignatureBar } from '../components/Layout';
import { useActiveSession } from '../lib/activeSession';
import {
  abandonSession,
  addExerciseToSession,
  debounce,
  finishSession,
  flushPendingWrites,
  subscribeLibrary,
  subscribeRecentSessions,
  updateSessionField,
} from '../lib/db';
import { formatElapsed } from '../lib/format';
import { buildHistoryMap, HISTORY_WINDOW } from '../lib/history';
import { useWakeLock } from '../lib/useWakeLock';
import type { Exercise, Session } from '../types';
import { ExerciseCard } from './in-gym/ExerciseCard';
import { loadRest, RestBar, saveRest, StartRestContext } from './in-gym/restStorage';

const DEBOUNCE_MS = 250;

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="px-4 py-12 max-w-2xl mx-auto w-full flex flex-col items-center text-center gap-6">
      <div className="w-20 h-20 rounded-2xl bg-surface-container-low flex items-center justify-center border-t-4 border-primary">
        <Dumbbell className="w-10 h-10 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="font-headline text-2xl font-bold">No active session</h2>
        <p className="text-sm text-on-surface-variant">
          Pick a day from your active plan to start logging sets.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/start')}
        className="px-6 py-3 rounded-xl bg-primary text-on-primary font-label font-bold uppercase tracking-widest text-sm"
      >
        Start workout
      </button>
    </div>
  );
}

function ActiveSessionView({ session }: { session: Session }) {
  const navigate = useNavigate();
  const sessionId = session.id;

  useWakeLock(true);

  const [recentSessions, setRecentSessions] = useState<Session[] | null>(null);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => subscribeRecentSessions(HISTORY_WINDOW, setRecentSessions), []);
  useEffect(() => {
    if (!pickerOpen) return;
    return subscribeLibrary(setLibrary);
  }, [pickerOpen]);

  const historyMap = useMemo(
    () => (recentSessions ? buildHistoryMap(recentSessions) : null),
    [recentSessions],
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onVis = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const [sessionNotes, setSessionNotes] = useState(session.sessionNotes ?? '');
  const notesFocusedRef = useRef(false);
  useEffect(() => {
    if (!notesFocusedRef.current) setSessionNotes(session.sessionNotes ?? '');
  }, [session.sessionNotes]);

  const writeSessionNotes = useMemo(
    () =>
      debounce((value: string) => {
        void updateSessionField(sessionId, 'sessionNotes', value);
      }, DEBOUNCE_MS),
    [sessionId],
  );
  useEffect(() => () => writeSessionNotes.flush(), [writeSessionNotes]);

  useEffect(() => {
    const flush = () => {
      writeSessionNotes.flush();
      void flushPendingWrites();
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [writeSessionNotes]);

  const [restStartedAt, setRestStartedAt] = useState<number | null>(() =>
    loadRest(sessionId),
  );
  useEffect(() => {
    setRestStartedAt(loadRest(sessionId));
  }, [sessionId]);

  const startRest = useCallback(() => {
    const ts = Date.now();
    setRestStartedAt(ts);
    setNow(ts);
    saveRest(sessionId, ts);
  }, [sessionId]);

  const clearRest = useCallback(() => {
    setRestStartedAt(null);
    saveRest(sessionId, null);
  }, [sessionId]);

  const handleFinish = useCallback(async () => {
    if (!confirm('Finish this workout?')) return;
    clearRest();
    writeSessionNotes.flush();
    await flushPendingWrites();
    await finishSession(sessionId);
    navigate(`/sessions/${sessionId}`);
  }, [sessionId, writeSessionNotes, navigate, clearRest]);

  const handleAbandon = useCallback(async () => {
    if (!confirm('Abandon this workout? Logged sets will be kept in history.')) return;
    clearRest();
    writeSessionNotes.flush();
    await flushPendingWrites();
    await abandonSession(sessionId);
  }, [sessionId, writeSessionNotes, clearRest]);

  const handlePickExercise = (ex: Exercise) => {
    const latestHistory = historyMap?.get(ex.id)?.[0];
    void addExerciseToSession(sessionId, ex, latestHistory);
    setPickerOpen(false);
  };

  const elapsedMs = now - session.startedAt;
  const restElapsedMs = restStartedAt == null ? 0 : Math.max(0, now - restStartedAt);

  return (
    <StartRestContext.Provider value={startRest}>
      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto w-full pb-8">
        <RestBar elapsedMs={restElapsedMs} running={restStartedAt != null} />

        <section className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-highest border border-outline-variant/20">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-[10px] font-label font-bold tracking-[0.2em] uppercase text-secondary">
              Active Session
            </span>
          </div>
          <div className="font-headline text-6xl font-extrabold tracking-tighter text-white tabular-nums">
            {formatElapsed(elapsedMs)}
          </div>
          <p className="font-label text-sm text-on-surface-variant tracking-wide">
            {session.planName ? `${session.planName} • ` : ''}
            {session.dayName || 'Session'}
          </p>
        </section>

        <SignatureBar />

        <section className="bg-surface-container-low rounded-xl p-4 border-l-4 border-secondary">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/60 mb-2">
            Session notes
          </p>
          <textarea
            value={sessionNotes}
            onFocus={() => {
              notesFocusedRef.current = true;
            }}
            onBlur={() => {
              notesFocusedRef.current = false;
              writeSessionNotes.flush();
            }}
            onChange={(e) => {
              setSessionNotes(e.target.value);
              writeSessionNotes(e.target.value);
            }}
            rows={2}
            placeholder="How are you feeling today?"
            className="w-full bg-surface-container rounded-lg px-3 py-2 text-sm font-body outline-none focus:ring-2 focus:ring-primary/40 resize-none placeholder:text-on-surface-variant/50"
          />
        </section>

        <div className="space-y-5">
          {session.exercises.length === 0 ? (
            <div className="bg-surface-container-low rounded-xl p-6 text-center text-sm text-on-surface-variant">
              This workout has no exercises yet. Add an exercise below to start logging.
            </div>
          ) : (
            session.exercises.map((ex, idx) => (
              <ExerciseCard
                key={`${ex.exerciseId}-${idx}`}
                sessionId={sessionId}
                exercise={ex}
                index={idx}
                history={historyMap ? (historyMap.get(ex.exerciseId) ?? []) : undefined}
              />
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full py-3 rounded-xl bg-surface-container-highest text-primary font-headline font-medium border border-primary/20 hover:bg-surface-bright transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add exercise to session
        </button>

        <div className="pt-2 space-y-3">
          <button
            type="button"
            onClick={() => void handleFinish()}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-headline font-black text-lg flex items-center justify-center gap-3"
          >
            Finish workout
            <Flag className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => void handleAbandon()}
            className="w-full py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant/70 hover:text-secondary flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Abandon
          </button>
        </div>

        {pickerOpen && (
          <ExercisePickerModal
            library={library}
            existingIds={session.exercises.map((e) => e.exerciseId)}
            onPick={handlePickExercise}
            onClose={() => setPickerOpen(false)}
            title="Add Exercise to Session"
          />
        )}
      </div>
    </StartRestContext.Provider>
  );
}

/**
 * Renders the active workout view or the empty start prompt.
 */
export function InGym() {
  const { activeSession, loading } = useActiveSession();

  if (loading) {
    return (
      <div className="px-4 py-12 text-center font-label text-sm text-on-surface-variant uppercase tracking-widest">
        Loading…
      </div>
    );
  }

  if (!activeSession) return <EmptyState />;
  return <ActiveSessionView session={activeSession} />;
}
