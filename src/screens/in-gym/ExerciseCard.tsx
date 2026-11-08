/**
 * Exercise card and prior-execution history panel (`ExerciseCard`) for `InGym`.
 * Coordinates exercise notes, set addition/removal, mid-workout exercise removal, and `SetRow` rendering.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import {
  addSetToExercise,
  debounce,
  removeExerciseFromSession,
  removeSetFromExercise,
  updateSessionExercise,
} from '../../lib/db';
import { formatRelative } from '../../lib/format';
import type { HistoryEntry } from '../../lib/history';
import type { SessionExercise } from '../../types';
import { SET_DEBOUNCE_MS, SetRow } from './SetRow';

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

export interface ExerciseCardProps {
  sessionId: string;
  exercise: SessionExercise;
  index: number;
  history?: HistoryEntry[];
}

/**
 * Renders one exercise block during an active workout with set controls and prior history.
 */
export function ExerciseCard({ sessionId, exercise, index, history }: ExerciseCardProps) {
  const [notes, setNotes] = useState<string>(exercise.notes ?? '');
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setNotes(exercise.notes ?? '');
  }, [exercise.notes]);

  const writeNotes = useMemo(
    () =>
      debounce((value: string) => {
        void updateSessionExercise(sessionId, index, { notes: value });
      }, SET_DEBOUNCE_MS),
    [sessionId, index],
  );
  useEffect(() => () => writeNotes.flush(), [writeNotes]);

  const repsRange =
    exercise.targetRepsLow && exercise.targetRepsHigh
      ? `${exercise.targetRepsLow}–${exercise.targetRepsHigh} reps`
      : exercise.targetRepsLow
        ? `${exercise.targetRepsLow}+ reps`
        : null;

  const handleRemoveLastSet = () => {
    const lastIdx = exercise.sets.length - 1;
    if (lastIdx < 1) return;
    const lastSet = exercise.sets[lastIdx];
    if (lastSet?.completedAt != null && !confirm('Remove the last completed set?')) {
      return;
    }
    void removeSetFromExercise(sessionId, index, lastIdx);
  };

  const handleRemoveExercise = () => {
    const hasCompleted = exercise.sets.some((s) => s.completedAt != null);
    const msg = hasCompleted
      ? `Remove ${exercise.exerciseName} and its completed sets from this workout?`
      : `Remove ${exercise.exerciseName} from this workout?`;
    if (!confirm(msg)) return;
    writeNotes.cancel();
    void removeExerciseFromSession(sessionId, index);
  };

  return (
    <section className="bg-surface-container-low rounded-xl border-t-4 border-primary overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
              Exercise {index + 1}
            </p>
            <h3 className="font-headline text-xl font-bold truncate">
              {exercise.exerciseName}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {repsRange && (
              <span className="text-[10px] font-label font-bold uppercase tracking-widest text-tertiary-fixed bg-surface-container-highest px-2 py-1 rounded-md">
                {repsRange}
              </span>
            )}
            <button
              type="button"
              onClick={handleRemoveExercise}
              aria-label={`Remove ${exercise.exerciseName}`}
              className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant/60 hover:text-secondary hover:bg-surface-container-high transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void addSetToExercise(sessionId, index)}
            className="flex-1 py-2 rounded-lg border border-dashed border-outline-variant/40 text-sm font-label font-semibold text-on-surface-variant hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add set
          </button>
          {exercise.sets.length > 1 && (
            <button
              type="button"
              onClick={handleRemoveLastSet}
              aria-label="Remove last set"
              className="px-3 py-2 rounded-lg border border-dashed border-outline-variant/30 text-sm font-label font-semibold text-on-surface-variant/70 hover:text-secondary hover:border-secondary/40 transition-colors flex items-center justify-center gap-1"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
