/**
 * Active workout logger screen.
 * Tracks live workout sets, progressive-overload history, and session-scoped elapsed rest time.
 */

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
  subscribeRecentSessions,
  updateSessionExercise,
  updateSessionField,
} from '../lib/db';
import type { Session, SessionExercise, SessionSet } from '../types';

const DEBOUNCE_MS = 250;

// How many recent completed sessions to scan, and how many prior executions to
// show per exercise. 30 covers weekly/twice-weekly exercises cheaply; exercises
// not trained within that window simply show no history (only recent history is
// actionable for progressive overload).
const HISTORY_WINDOW = 30;
const HISTORY_MAX = 3;

// One prior execution of an exercise: its completed sets, the session date, and
// the exercise note from that session (for progressive-overload context).
interface HistoryEntry {
  date: number;
  noteText: string;
  sets: SessionSet[];
}

// Build exerciseId -> last N executions from completed sessions (newest first).
// Matching is by exerciseId only, so plan edits, reordering, and renames don't
// break it. Within a single session, multiple occurrences of the same exercise
// (e.g. supersets) are merged into one entry; a session where the exercise had
// no completed set is not counted as an execution.
function buildHistoryMap(sessions: Session[]): Map<string, HistoryEntry[]> {
  const map = new Map<string, HistoryEntry[]>();
  for (const s of sessions) {
    // Collapse duplicate occurrences of the same exerciseId within this session.
    const perExercise = new Map<string, { sets: SessionSet[]; noteText: string }>();
    for (const ex of s.exercises) {
      const doneSets = ex.sets.filter((set) => set.completedAt != null);
      if (doneSets.length === 0) continue;
      const acc = perExercise.get(ex.exerciseId);
      if (acc) {
        acc.sets.push(...doneSets);
        if (!acc.noteText && ex.notes) acc.noteText = ex.notes;
      } else {
        perExercise.set(ex.exerciseId, {
          sets: doneSets,
          noteText: ex.notes ?? '',
        });
      }
    }
    const date = s.finishedAt ?? s.startedAt;
    for (const [exerciseId, acc] of perExercise) {
      const list = map.get(exerciseId) ?? [];
      if (list.length >= HISTORY_MAX) continue;
      list.push({ date, noteText: acc.noteText, sets: acc.sets });
      map.set(exerciseId, list);
    }
  }
  return map;
}

function formatDateShort(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// "Today" / "Yesterday" / "N days ago" / "Jul 5" — matches Analytics.tsx.
function formatRelative(ts: number): string {
  if (!ts) return '—';
  const now = Date.now();
  const diff = now - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day && new Date(ts).toDateString() === new Date(now).toDateString()) {
    return 'Today';
  }
  if (diff < 2 * day) return 'Yesterday';
  const days = Math.floor(diff / day);
  if (days < 7) return `${days} days ago`;
  return formatDateShort(ts);
}

// Local, non-persisted rest timer. Completing a set invokes this callback so
// the sticky top bar resets and counts up from zero.
const StartRestContext = createContext<() => void>(() => {});

// SessionStorage keeps the running rest timestamp across tab navigation and
// reloads without writing to Firestore. Keying by session id prevents leaks
// across workouts, and closing the tab clears the state automatically.
const REST_KEY = 'maromba.restTimer';

function loadRest(sessionId: string): number | null {
  try {
    const raw = sessionStorage.getItem(REST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { startedAt?: unknown; sessionId?: unknown };
    if (p.sessionId !== sessionId || typeof p.startedAt !== 'number') return null;
    return p.startedAt;
  } catch {
    return null;
  }
}

function saveRest(sessionId: string, startedAt: number | null): void {
  try {
    if (startedAt != null) {
      sessionStorage.setItem(REST_KEY, JSON.stringify({ startedAt, sessionId }));
    } else {
      sessionStorage.removeItem(REST_KEY);
    }
  } catch {
    /* If sessionStorage is unavailable, the timer still runs in memory. */
  }
}

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

interface SetRowProps {
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
  set: SessionSet;
}

function SetRow({ sessionId, exerciseIndex, setIndex, set }: SetRowProps) {
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
      startRest();
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

// Read-only progressive-overload guidance: the last few times this exercise was
// executed. `undefined` = still loading; `[]` = loaded with no prior data.
function ExerciseHistory({ history }: { history?: HistoryEntry[] }) {
  return (
    <div className="border-t border-outline-variant/10 pt-3 space-y-2">
      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-tertiary-fixed/80">
        Last sessions
      </p>
      {history === undefined ? (
        <p className="text-xs text-on-surface-variant/50 font-label">Loading history…</p>
      ) : history.length === 0 ? (
        <p className="text-xs text-on-surface-variant/50 font-label">No previous data</p>
      ) : (
        <div className="space-y-1.5">
          {history.map((entry, i) => (
            <div key={i} className="bg-surface-container rounded-md px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="shrink-0 font-label text-[10px] uppercase tracking-widest text-on-surface-variant/70 w-20">
                  {formatRelative(entry.date)}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {entry.sets.map((s, sIdx) => (
                    <span
                      key={sIdx}
                      className="font-headline text-xs font-semibold tabular-nums text-tertiary-fixed bg-surface-container-highest rounded px-1.5 py-0.5"
                    >
                      {s.weight || '—'}×{s.reps || '—'}
                    </span>
                  ))}
                </div>
              </div>
              {entry.noteText && (
                <p className="text-[11px] text-on-surface-variant/70 whitespace-pre-wrap pl-1">
                  {entry.noteText}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ExerciseCardProps {
  sessionId: string;
  exercise: SessionExercise;
  index: number;
  history?: HistoryEntry[];
}

function ExerciseCard({ sessionId, exercise, index, history }: ExerciseCardProps) {
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

        <ExerciseHistory history={history} />

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

// Sticky top bar that counts up from the last completed set without enforcing
// a fixed target duration. Before the first completed set, it stays dimmed at 00:00.
function RestBar({ elapsedMs, running }: { elapsedMs: number; running: boolean }) {
  return (
    <div className="sticky top-16 z-40 -mx-4 px-4 py-2 bg-surface-container-high/95 backdrop-blur-md border-b border-outline-variant/20 flex items-center gap-3">
      <Timer
        className={cn(
          'w-5 h-5',
          running ? 'text-tertiary-fixed' : 'text-on-surface-variant/40',
        )}
      />
      <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
        Rest
      </span>
      <span
        className={cn(
          'ml-auto font-headline text-2xl font-bold tabular-nums',
          running ? 'text-on-surface' : 'text-on-surface-variant/40',
        )}
      >
        {formatElapsed(elapsedMs)}
      </span>
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

  // Prior-execution history for progressive-overload guidance. One subscription
  // for the whole screen; each card reads its slice from the memoized map.
  // null = still loading.
  const [recentSessions, setRecentSessions] = useState<Session[] | null>(null);
  useEffect(() => {
    const unsub = subscribeRecentSessions(HISTORY_WINDOW, setRecentSessions);
    return () => unsub();
  }, []);
  const historyMap = useMemo(
    () => (recentSessions ? buildHistoryMap(recentSessions) : null),
    [recentSessions],
  );

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

  // Rest timer state — kept in sessionStorage (not the DB) so it survives
  // navigating between screens and reloads within this tab. Restored on mount.
  const [restStartedAt, setRestStartedAt] = useState<number | null>(() =>
    loadRest(sessionId),
  );
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

  const elapsedMs = now - session.startedAt;
  const restElapsedMs = restStartedAt == null ? 0 : Math.max(0, now - restStartedAt);

  return (
    <StartRestContext.Provider value={startRest}>
    <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto w-full pb-8">
      <RestBar elapsedMs={restElapsedMs} running={restStartedAt != null} />

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
              history={historyMap ? (historyMap.get(ex.exerciseId) ?? []) : undefined}
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
