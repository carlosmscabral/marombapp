/**
 * Training day editor screen (`PlanDay`).
 * Edits day name, exercise order, set/rep targets, and notes with race-free debounced writes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { ExercisePickerModal } from '../components/ExercisePickerModal';
import { SignatureBar } from '../components/Layout';
import {
  debounce,
  deletePlanDay,
  renamePlanDay,
} from '../lib/db';
import type { Exercise, PlanDay as PlanDayT } from '../types';
import { NotesField, NumberField } from './plan/PlanDayFields';
import { usePlanDayExercises } from './plan/usePlanDayExercises';

export interface PlanDayProps {
  planId: string;
  day: PlanDayT;
  library: Exercise[];
  onBack: () => void;
}

/**
 * Renders the exercise list and target controls for a single training day.
 */
export function PlanDay({ planId, day, library, onBack }: PlanDayProps) {
  const [name, setName] = useState(day.name);
  const nameFocusedRef = useRef(false);
  useEffect(() => {
    if (!nameFocusedRef.current) {
      setName(day.name);
    }
  }, [day.id, day.name]);

  const debouncedRename = useMemo(
    () =>
      debounce((next: string) => {
        const trimmed = next.trim();
        if (!trimmed) return;
        renamePlanDay(planId, day.id, trimmed).catch(() => {});
      }, 250),
    [planId, day.id],
  );
  useEffect(() => () => debouncedRename.flush(), [debouncedRename]);

  const {
    exercises,
    flushExercises,
    cancelExercises,
    patchExercise,
    moveExercise,
    removeExercise,
    appendExercise,
  } = usePlanDayExercises(planId, day);

  const libIndex = useMemo(
    () => new Map(library.map((e) => [e.id, e] as const)),
    [library],
  );

  const [pickerOpen, setPickerOpen] = useState(false);

  const onPickExercise = (ex: Exercise) => {
    appendExercise(ex);
    setPickerOpen(false);
  };

  const handleDeleteDay = async () => {
    if (!confirm(`Delete training day "${day.name}"?`)) return;
    debouncedRename.cancel();
    cancelExercises();
    await deletePlanDay(planId, day.id).catch(() => {});
    onBack();
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-primary font-label text-xs tracking-[0.2em] uppercase">
            Training Day
          </p>
          <input
            value={name}
            onFocus={() => {
              nameFocusedRef.current = true;
            }}
            onBlur={() => {
              nameFocusedRef.current = false;
              debouncedRename.flush();
            }}
            onChange={(e) => {
              setName(e.target.value);
              debouncedRename(e.target.value);
            }}
            className="w-full bg-transparent font-headline text-2xl font-bold tracking-tight text-on-surface outline-none focus:bg-surface-container-low rounded-lg px-1 -mx-1"
            placeholder="Day name"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleDeleteDay()}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors"
          aria-label="Delete training day"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-on-surface-variant text-sm">
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
        </span>
      </div>

      <div className="space-y-4">
        {exercises.length === 0 && (
          <div className="bg-surface-container-low rounded-xl p-8 text-center border border-dashed border-outline-variant/30">
            <p className="text-on-surface-variant text-sm">
              No exercises yet. Add one to start building this day.
            </p>
          </div>
        )}

        {exercises.map((pe, idx) => {
          const libEx = libIndex.get(pe.exerciseId);
          return (
            <div
              key={`${pe.exerciseId}-${idx}`}
              className="relative bg-surface-container-low rounded-xl overflow-hidden border-l-2 border-primary/40"
            >
              <SignatureBar />
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveExercise(idx, -1)}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(idx, 1)}
                      disabled={idx === exercises.length - 1}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-headline text-lg font-semibold truncate">
                      {libEx?.name ?? 'Unknown exercise'}
                    </h4>
                    {libEx && (
                      <p className="text-on-surface-variant text-xs capitalize">
                        {libEx.primaryMuscle}
                        {libEx.subMuscle ? ` · ${libEx.subMuscle}` : ''}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeExercise(idx)}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors"
                    aria-label="Remove exercise"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <NumberField
                    label="Sets"
                    value={pe.targetSets}
                    min={1}
                    onBlur={flushExercises}
                    onChange={(v) => patchExercise(idx, { targetSets: v })}
                  />
                  <NumberField
                    label="Reps Low"
                    value={pe.targetRepsLow}
                    min={1}
                    onBlur={flushExercises}
                    onChange={(v) => patchExercise(idx, { targetRepsLow: v })}
                  />
                  <NumberField
                    label="Reps High"
                    value={pe.targetRepsHigh}
                    min={1}
                    onBlur={flushExercises}
                    onChange={(v) => patchExercise(idx, { targetRepsHigh: v })}
                  />
                </div>

                <NotesField
                  value={pe.notes}
                  onBlur={flushExercises}
                  onChange={(val) => patchExercise(idx, { notes: val })}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>
      </div>

      {pickerOpen && (
        <ExercisePickerModal
          library={library}
          existingIds={exercises.map((e) => e.exerciseId)}
          onPick={onPickExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
