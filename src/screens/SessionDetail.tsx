/**
 * Completed workout detail screen (`/sessions/:sessionId`).
 * Displays workout duration, total volume, set completion count, notes, per-set breakdown, and session deletion.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { SignatureBar } from '../components/Layout';
import { deleteSession, getSession } from '../lib/db';
import { formatDateTime, formatDecimal, formatDuration, formatNumber } from '../lib/format';
import { PT_BR, tExerciseName } from '../lib/i18n/pt-BR';
import type { Session } from '../types';

/**
 * Loads and renders a historical workout session by route parameter `sessionId`.
 */
export function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setError(PT_BR.sessionDetail.missingId);
      setLoading(false);
      return;
    }
    setLoading(true);
    getSession(sessionId)
      .then((s) => {
        if (cancelled) return;
        if (!s) setError(PT_BR.sessionDetail.notFound);
        setSession(s);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : PT_BR.sessionDetail.loadFailed,
        );
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
        {PT_BR.common.loading}
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="px-4 py-12 max-w-2xl mx-auto text-center space-y-4">
        <p className="text-sm text-on-surface-variant">
          {error ?? PT_BR.sessionDetail.notFound}
        </p>
        <Link
          to="/analytics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-low text-on-surface text-xs font-label font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          {PT_BR.sessionDetail.backToAnalytics}
        </Link>
      </div>
    );
  }

  const finishedAt = session.finishedAt ?? session.startedAt;
  const durationMs = finishedAt - session.startedAt;

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

  const handleDeleteSession = async () => {
    if (session.status === 'active') return;
    const label = session.dayName || PT_BR.inGym.fallbackSessionName;
    if (!confirm(PT_BR.sessionDetail.confirmDeleteSession(label))) return;
    await deleteSession(session.id).catch(() => {});
    navigate('/analytics', { replace: true });
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto w-full space-y-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/analytics"
          className="min-h-11 inline-flex items-center gap-2 text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          {PT_BR.common.back}
        </Link>
        {session.status !== 'active' && (
          <button
            type="button"
            onClick={() => void handleDeleteSession()}
            className="min-h-11 px-3.5 rounded-xl bg-secondary/15 text-secondary border border-secondary/30 font-label text-xs uppercase tracking-widest font-semibold hover:bg-secondary/25 transition-colors inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            {PT_BR.sessionDetail.deleteSessionBtn}
          </button>
        )}
      </div>

      <header className="space-y-2">
        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
          {PT_BR.sessionDetail.statusKicker(session.status)}
        </p>
        <h1 className="font-headline text-3xl font-bold">
          {session.dayName || PT_BR.inGym.fallbackSessionName}
        </h1>
        {session.planName && (
          <p className="text-sm text-on-surface-variant">{session.planName}</p>
        )}
      </header>

      <SignatureBar />

      <section className="grid grid-cols-3 gap-3">
        <div className="bg-surface-container-low rounded-xl p-3 border-t-4 border-primary">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60">
            {PT_BR.sessionDetail.durationLabel}
          </p>
          <p className="font-headline text-xl font-bold mt-1">
            {formatDuration(durationMs, true)}
          </p>
        </div>
        <div className="bg-surface-container-low rounded-xl p-3 border-t-4 border-secondary">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60">
            {PT_BR.sessionDetail.volumeLabel}
          </p>
          <p className="font-headline text-xl font-bold mt-1 tabular-nums">
            {formatNumber(totalVolume)}
            <span className="text-xs ml-1 text-on-surface-variant font-label">kg</span>
          </p>
        </div>
        <div className="bg-surface-container-low rounded-xl p-3 border-t-4 border-tertiary-fixed">
          <p className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/60">
            {PT_BR.sessionDetail.setsLabel}
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
          {formatDateTime(session.startedAt)}
          {session.finishedAt ? ` → ${formatDateTime(finishedAt)}` : ''}
        </span>
      </div>

      {session.sessionNotes && (
        <section className="bg-surface-container-low rounded-xl p-4 border-l-4 border-secondary">
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant/60 mb-1">
            {PT_BR.inGym.sessionNotesLabel}
          </p>
          <p className="text-sm text-on-surface whitespace-pre-wrap">
            {session.sessionNotes}
          </p>
        </section>
      )}

      <div className="space-y-4">
        {session.exercises.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-8">
            {PT_BR.sessionDetail.noExercisesRecorded}
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
                        {PT_BR.inGym.exerciseIndex(idx + 1)}
                      </p>
                      <h3 className="font-headline text-lg font-bold truncate">
                        {tExerciseName(ex.exerciseName)}
                      </h3>
                    </div>
                    <span className="shrink-0 text-[10px] font-label font-bold uppercase tracking-widest text-tertiary-fixed bg-surface-container-highest px-2 py-1 rounded-md tabular-nums">
                      {formatNumber(exVolume)} kg
                    </span>
                  </div>

                  {ex.notes && (
                    <p className="text-xs text-on-surface-variant whitespace-pre-wrap bg-surface-container rounded-md px-3 py-2">
                      {ex.notes}
                    </p>
                  )}

                  <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] gap-2 px-2 text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant/60">
                    <div className="text-center">{PT_BR.inGym.colSet}</div>
                    <div className="text-center">{PT_BR.inGym.colKg}</div>
                    <div className="text-center">{PT_BR.inGym.colReps}</div>
                    <div className="text-center">{PT_BR.inGym.colDone}</div>
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
                            {s.weight ? formatDecimal(s.weight) : '—'}
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
