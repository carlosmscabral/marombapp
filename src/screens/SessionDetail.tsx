import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { SignatureBar } from '../components/Layout';
import { getSession } from '../lib/db';
import type { Session } from '../types';

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function formatDate(ms: number): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ms).toString();
  }
}

export function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setError('Missing session id');
      setLoading(false);
      return;
    }
    setLoading(true);
    getSession(sessionId)
      .then((s) => {
        if (cancelled) return;
        if (!s) setError('Session not found');
        setSession(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load session');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="px-4 py-12 text-center font-label text-sm text-on-surface-variant uppercase tracking-widest">
        Loading…
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="px-4 py-12 max-w-2xl mx-auto text-center space-y-4">
        <p className="text-sm text-on-surface-variant">{error ?? 'Session not found'}</p>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface text-xs font-label font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to analytics
        </Link>
      </div>
    );
  }

  const finishedAt = session.finishedAt ?? session.startedAt;
  const durationMs = (session.finishedAt ?? session.startedAt) - session.startedAt;

  let totalVolume = 0;
  let completedSets = 0;
  let totalSets = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      totalSets += 1;
      if (s.completedAt != null) {
        completedSets += 1;
        totalVolume += (s.weight || 0) * (s.reps || 0);
      }
    }
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-6 pb-24">
      <div>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <header className="space-y-2">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
          {session.status === 'completed' ? 'Completed session' : `Session • ${session.status}`}
        </p>
        <h1 className="font-headline text-3xl font-bold">{session.dayName || 'Session'}</h1>
        {session.planName && (
          <p className="text-sm text-on-surface-variant">{session.planName}</p>
        )}
      </header>

      <SignatureBar />

      <section className="grid grid-cols-3 gap-3">
        <div className="bg-surface-container-low rounded-xl p-3 border-t-4 border-primary">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60">
            Duration
          </p>
          <p className="font-headline text-xl font-bold mt-1">
            {formatDuration(durationMs)}
          </p>
        </div>
        <div className="bg-surface-container-low rounded-xl p-3 border-t-4 border-secondary">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60">
            Volume
          </p>
          <p className="font-headline text-xl font-bold mt-1 tabular-nums">
            {Math.round(totalVolume).toLocaleString()}
            <span className="text-xs ml-1 text-on-surface-variant font-label">kg</span>
          </p>
        </div>
        <div className="bg-surface-container-low rounded-xl p-3 border-t-4 border-tertiary-fixed">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60">
            Sets
          </p>
          <p className="font-headline text-xl font-bold mt-1 tabular-nums">
            {completedSets}
            <span className="text-xs ml-1 text-on-surface-variant font-label">
              / {totalSets}
            </span>
          </p>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Calendar className="w-4 h-4" />
        <span>
          {formatDate(session.startedAt)}
          {session.finishedAt ? ` → ${formatDate(finishedAt)}` : ''}
        </span>
      </div>

      {session.sessionNotes && (
        <section className="bg-surface-container-low rounded-xl p-4 border-l-4 border-secondary">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/60 mb-1">
            Session notes
          </p>
          <p className="text-sm text-on-surface whitespace-pre-wrap">
            {session.sessionNotes}
          </p>
        </section>
      )}

      <div className="space-y-4">
        {session.exercises.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-8">
            No exercises recorded.
          </p>
        ) : (
          session.exercises.map((ex, idx) => {
            const exVolume = ex.sets.reduce(
              (sum, s) =>
                sum + (s.completedAt != null ? (s.weight || 0) * (s.reps || 0) : 0),
              0,
            );
            return (
              <section
                key={`${ex.exerciseId}-${idx}`}
                className="bg-surface-container-low rounded-xl overflow-hidden border-t-4 border-primary"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
                        Exercise {idx + 1}
                      </p>
                      <h3 className="font-headline text-lg font-bold truncate">
                        {ex.exerciseName}
                      </h3>
                    </div>
                    <span className="shrink-0 text-[10px] font-label font-bold uppercase tracking-widest text-tertiary-fixed bg-surface-container-highest px-2 py-1 rounded-md tabular-nums">
                      {Math.round(exVolume).toLocaleString()} kg
                    </span>
                  </div>

                  {ex.notes && (
                    <p className="text-xs text-on-surface-variant whitespace-pre-wrap bg-surface-container rounded-md px-3 py-2">
                      {ex.notes}
                    </p>
                  )}

                  <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] gap-2 px-2 text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant/60">
                    <div className="text-center">Set</div>
                    <div className="text-center">Kg</div>
                    <div className="text-center">Reps</div>
                    <div className="text-center">Done</div>
                  </div>

                  <div className="space-y-1">
                    {ex.sets.map((s, sIdx) => {
                      const done = s.completedAt != null;
                      return (
                        <div
                          key={sIdx}
                          className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-2 py-1.5 px-2 rounded-md bg-surface-container/40"
                        >
                          <div className="text-center font-headline font-bold text-on-surface-variant">
                            {sIdx + 1}
                          </div>
                          <div className="text-center font-headline font-semibold tabular-nums">
                            {s.weight || '—'}
                          </div>
                          <div className="text-center font-headline font-semibold tabular-nums">
                            {s.reps || '—'}
                          </div>
                          <div className="flex justify-center">
                            {done ? (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            ) : (
                              <Circle className="w-5 h-5 text-outline" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
