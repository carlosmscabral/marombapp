import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  Dumbbell,
  Flag,
  Plus,
  Trash2,
  Timer,
  X,
} from 'lucide-react';
import { cn, SignatureBar } from '../components/Layout';
import { useWakeLock } from '../lib/useWakeLock';
import {
  abandonSession,
  addSetToExercise,
  debounce,
  finishSession,
  flushPendingWrites,
  logSet,
  subscribeActiveSession,
  updateSessionExercise,
  updateSessionField,
} from '../lib/db';
import type { Session, SessionExercise, SessionSet } from '../types';

const DEBOUNCE_MS = 250;
const DEFAULT_REST_SEC = 90;

// Local, non-persisted rest timer. Completing a set calls this with the
// exercise's target rest so the floating timer can start counting up.
const StartRestContext = createContext<(targetSec: number) => void>(() => {});

function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function formatRest(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// One-shot best-effort chime using Web Audio. Returns true if it played.
function playChime(): boolean {
  try {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    osc.onended = () => {
      ctx.close().catch(() => {});
    };
    return true;
  } catch {
    return false;
  }
}

function vibrate(pattern: number[]): void {
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    nav.vibrate?.(pattern);
  } catch {
    /* best-effort */
  }
}

interface SetRowProps {
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
  set: SessionSet;
  restSec: number;
}

function SetRow({ sessionId, exerciseIndex, setIndex, set, restSec }: SetRowProps) {
  const startRest = useContext(StartRestContext);
  const [weight, setWeight] = useState<string>(
    set.weight ? String(set.weight) : '',
  );
  const [reps, setReps] = useState<string>(set.reps ? String(set.reps) : '');

  // Latest values via refs so the debounced writer always sees fresh state.
  const latestRef = useRef({ set, weight, reps });
  latestRef.current = { set, weight, reps };

  // Sync from incoming Firestore state when this isn't the focused row.
  const weightFocusedRef = useRef(false);
  const repsFocusedRef = useRef(false);
  useEffect(() => {
    if (!weightFocusedRef.current) {
      setWeight(set.weight ? String(set.weight) : '');
    }
    if (!repsFocusedRef.current) {
      setReps(set.reps ? String(set.reps) : '');
    }
  }, [set.weight, set.reps]);

  // Stable debounced writer per row.
  const writeDebounced = useMemo(
    () =>
      debounce((nextWeight: number, nextReps: number) => {
        void logSet(sessionId, exerciseIndex, setIndex, {
          weight: nextWeight,
          reps: nextReps,
          completedAt: latestRef.current.set.completedAt,
        });
      }, DEBOUNCE_MS),
    [sessionId, exerciseIndex, setIndex],
  );

  useEffect(() => {
    return () => writeDebounced.flush();
  }, [writeDebounced]);

  const handleWeightChange = (raw: string) => {
    setWeight(raw);
    const n = Number(raw);
    writeDebounced(Number.isFinite(n) ? n : 0, Number(latestRef.current.reps) || 0);
  };
  const handleRepsChange = (raw: string) => {
    setReps(raw);
    const n = Number(raw);
    writeDebounced(Number(latestRef.current.weight) || 0, Number.isFinite(n) ? n : 0);
  };

  const toggleComplete = () => {
    // Immediate write — checkmarks must never debounce.
    writeDebounced.flush();
    const isComplete = set.completedAt != null;
    const w = Number(latestRef.current.weight) || 0;
    const r = Number(latestRef.current.reps) || 0;
    void logSet(sessionId, exerciseIndex, setIndex, {
      weight: w,
      reps: r,
      completedAt: isComplete ? null : Date.now(),
    });
    if (!isComplete) {
      startRest(restSec || DEFAULT_REST_SEC);
    }
  };

  const completed = set.completedAt != null;

  return (
    <div
      className={cn(
        'grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-2 py-2 px-2 rounded-lg',
        completed
          ? 'bg-surface-container-highest/40'
          : 'bg-surface-bright/40 border border-primary/20',
      )}
    >
      <div className="text-center font-headline font-bold text-on-surface-variant">
        {setIndex + 1}
      </div>
      <input
        inputMode="decimal"
        type="number"
        step="0.5"
        value={weight}
        onChange={(e) => handleWeightChange(e.target.value)}
        onFocus={() => {
          weightFocusedRef.current = true;
        }}
        onBlur={() => {
          weightFocusedRef.current = false;
          writeDebounced.flush();
        }}
        placeholder="kg"
        className="w-full bg-surface-container-low rounded-md px-2 py-1.5 text-center font-headline text-lg font-semibold outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        inputMode="numeric"
        type="number"
        value={reps}
        onChange={(e) => handleRepsChange(e.target.value)}
        onFocus={() => {
          repsFocusedRef.current = true;
        }}
        onBlur={() => {
          repsFocusedRef.current = false;
          writeDebounced.flush();
        }}
        placeholder="reps"
        className="w-full bg-surface-container-low rounded-md px-2 py-1.5 text-center font-headline text-lg font-semibold outline-none focus:ring-2 focus:ring-primary/50"
      />
      <button
        type="button"
        onClick={toggleComplete}
        aria-label={completed ? 'Mark set incomplete' : 'Mark set complete'}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-colors mx-auto',
          completed
            ? 'bg-primary text-on-primary'
            : 'bg-surface-container-highest text-outline hover:text-primary',
        )}
      >
        {completed ? (
          <CheckCircle2 className="w-6 h-6" />
        ) : (
          <Circle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}

interface ExerciseCardProps {
  sessionId: string;
  exercise: SessionExercise;
  index: number;
}

function ExerciseCard({ sessionId, exercise, index }: ExerciseCardProps) {
  const [notes, setNotes] = useState<string>(exercise.notes ?? '');
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setNotes(exercise.notes ?? '');
  }, [exercise.notes]);

  const writeNotes = useMemo(
    () =>
      debounce((value: string) => {
        void updateSessionExercise(sessionId, index, { notes: value });
      }, DEBOUNCE_MS),
    [sessionId, index],
  );
  useEffect(() => () => writeNotes.flush(), [writeNotes]);

  const repsRange =
    exercise.targetRepsLow && exercise.targetRepsHigh
      ? `${exercise.targetRepsLow}–${exercise.targetRepsHigh} reps`
      : exercise.targetRepsLow
        ? `${exercise.targetRepsLow}+ reps`
        : null;

  const restSec = exercise.restSec ?? DEFAULT_REST_SEC;

  return (
    <section className="bg-surface-container-low rounded-xl border-t-4 border-primary overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
              Exercise {index + 1}
            </p>
            <h3 className="font-headline text-xl font-bold truncate">
              {exercise.exerciseName}
            </h3>
          </div>
          {repsRange && (
            <span className="shrink-0 text-[10px] font-label font-bold uppercase tracking-widest text-tertiary-fixed bg-surface-container-highest px-2 py-1 rounded-md">
              {repsRange}
            </span>
          )}
        </div>

        <textarea
          value={notes}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            writeNotes.flush();
          }}
          onChange={(e) => {
            setNotes(e.target.value);
            writeNotes(e.target.value);
          }}
          rows={2}
          placeholder="Notes for this exercise…"
          className="w-full bg-surface-container rounded-lg px-3 py-2 text-sm font-body outline-none focus:ring-2 focus:ring-primary/40 resize-none placeholder:text-on-surface-variant/50"
        />

        <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] gap-2 px-2 text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant/60">
          <div className="text-center">Set</div>
          <div className="text-center">Kg</div>
          <div className="text-center">Reps</div>
          <div className="text-center">Done</div>
        </div>

        <div className="space-y-2">
          {exercise.sets.map((s, sIdx) => (
            <SetRow
              key={sIdx}
              sessionId={sessionId}
              exerciseIndex={index}
              setIndex={sIdx}
              set={s}
              restSec={restSec}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => void addSetToExercise(sessionId, index)}
          className="w-full py-2 rounded-lg border border-dashed border-outline-variant/40 text-sm font-label font-semibold text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add set
        </button>
      </div>
    </section>
  );
}

// Local, non-persisted rest timer. Counts UP from when the last set was
// completed so the user can see how long they've been resting. The target
// rest is shown as guidance and the bar chimes once it's reached, but the
// timer keeps counting so overshoot is visible too.
function RestTimer({
  startedAt,
  targetSec,
  onDismiss,
}: {
  startedAt: number;
  targetSec: number;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const chimedRef = useRef(false);

  useEffect(() => {
    chimedRef.current = false;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    const onVis = () => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [startedAt]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const reached = elapsed >= targetSec;

  useEffect(() => {
    if (reached && !chimedRef.current) {
      chimedRef.current = true;
      playChime();
      vibrate([100, 50, 100]);
    }
  }, [reached]);

  const pct = Math.max(0, Math.min(100, (elapsed / targetSec) * 100));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-high border-t border-outline-variant/20 pb-safe">
      <div className="h-1 bg-surface-container-low overflow-hidden">
        <div
          className={cn(
            'h-full transition-[width] duration-200 ease-linear',
            reached ? 'bg-secondary' : 'bg-tertiary-fixed',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Timer
            className={cn(
              'w-5 h-5',
              reached ? 'text-secondary' : 'text-tertiary-fixed',
            )}
          />
          <div className="leading-tight">
            <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              {reached ? 'Rest • target reached' : 'Resting'}
            </p>
            <p className="font-headline text-2xl font-bold tabular-nums">
              {formatRest(elapsed)}
              <span className="text-sm font-semibold text-on-surface-variant/70">
                {' '}
                / {formatRest(targetSec)}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss rest timer"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-on-surface-variant text-xs font-label font-bold uppercase tracking-widest hover:text-primary"
        >
          <X className="w-4 h-4" />
          Done
        </button>
      </div>
    </div>
  );
}

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

  // Wake lock while a session is live.
  useWakeLock(true);

  // Elapsed-time ticker — only matters when visible.
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

  // Session-level notes (debounced).
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

  // Flush on hide / pagehide — this is the "tab is about to disappear" hook.
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

  const handleFinish = useCallback(async () => {
    if (!confirm('Finish this workout?')) return;
    writeSessionNotes.flush();
    await flushPendingWrites();
    await finishSession(sessionId);
    navigate(`/sessions/${sessionId}`);
  }, [sessionId, writeSessionNotes, navigate]);

  const handleAbandon = useCallback(async () => {
    if (!confirm('Abandon this workout? Logged sets will be kept in history.')) return;
    writeSessionNotes.flush();
    await flushPendingWrites();
    await abandonSession(sessionId);
  }, [sessionId, writeSessionNotes]);

  // Local, non-persisted rest timer state — starts when a set is completed.
  const [rest, setRest] = useState<{ startedAt: number; targetSec: number } | null>(
    null,
  );
  const startRest = useCallback((targetSec: number) => {
    setRest({ startedAt: Date.now(), targetSec });
  }, []);

  const elapsedMs = now - session.startedAt;

  return (
    <StartRestContext.Provider value={startRest}>
    <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto w-full pb-32">
      {/* Header */}
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

      {/* Session-level notes */}
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

      {/* Exercises */}
      <div className="space-y-5">
        {session.exercises.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl p-6 text-center text-sm text-on-surface-variant">
            This day has no exercises. Finish the session and edit the plan day.
          </div>
        ) : (
          session.exercises.map((ex, idx) => (
            <ExerciseCard
              key={`${ex.exerciseId}-${idx}`}
              sessionId={sessionId}
              exercise={ex}
              index={idx}
            />
          ))
        )}
      </div>

      {/* Finish / abandon */}
      <div className="pt-4 space-y-3">
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

      {/* Rest timer overlay (local, non-persisted) */}
      {rest && (
        <RestTimer
          startedAt={rest.startedAt}
          targetSec={rest.targetSec}
          onDismiss={() => setRest(null)}
        />
      )}
    </div>
    </StartRestContext.Provider>
  );
}

export function InGym() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeActiveSession((s) => {
      setSession(s);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) {
    return (
      <div className="px-4 py-12 text-center font-label text-sm text-on-surface-variant uppercase tracking-widest">
        Loading…
      </div>
    );
  }

  if (!session) return <EmptyState />;
  return <ActiveSessionView session={session} />;
}
