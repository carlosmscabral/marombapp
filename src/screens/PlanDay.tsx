import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Search,
  X,
} from 'lucide-react';
import type { Exercise, PlanDay as PlanDayT, PlanExercise } from '../types';
import {
  debounce,
  renamePlanDay,
  setDayExercises,
} from '../lib/db';
import { cn, SignatureBar } from '../components/Layout';

interface PlanDayProps {
  planId: string;
  day: PlanDayT;
  library: Exercise[];
  onBack: () => void;
}

export function PlanDay({ planId, day, library, onBack }: PlanDayProps) {
  // Local mirror of the day name so the input doesn't fight the live snapshot
  const [name, setName] = useState(day.name);
  const lastIdRef = useRef(day.id);
  useEffect(() => {
    // Whenever the underlying day doc changes (or we switch to a different day)
    // pull the latest name in.
    if (lastIdRef.current !== day.id) {
      lastIdRef.current = day.id;
      setName(day.name);
    }
  }, [day.id, day.name]);

  const debouncedRename = useMemo(
    () =>
      debounce((next: string) => {
        renamePlanDay(planId, day.id, next).catch(() => {});
      }, 250),
    [planId, day.id],
  );

  const exercises = day.exercises;

  const libIndex = useMemo(() => {
    const m = new Map<string, Exercise>();
    for (const e of library) m.set(e.id, e);
    return m;
  }, [library]);

  const writeExercises = (next: PlanExercise[]) => {
    setDayExercises(planId, day.id, next).catch(() => {});
  };

  // Debounced writers per-exercise field. Because the exercises array is the
  // unit of write, we coalesce per-day rather than per-field. 250ms keystroke
  // debounce, last write wins.
  const debouncedWriteRef = useRef(
    debounce((next: PlanExercise[]) => {
      setDayExercises(planId, day.id, next).catch(() => {});
    }, 250),
  );
  // Rebuild when planId/dayId changes
  useEffect(() => {
    debouncedWriteRef.current.flush();
    debouncedWriteRef.current = debounce((next: PlanExercise[]) => {
      setDayExercises(planId, day.id, next).catch(() => {});
    }, 250);
  }, [planId, day.id]);

  const patchExercise = (idx: number, patch: Partial<PlanExercise>) => {
    const next = exercises.map((pe, i) => (i === idx ? { ...pe, ...patch } : pe));
    debouncedWriteRef.current(next);
  };

  const moveExercise = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= exercises.length) return;
    const next = [...exercises];
    [next[idx], next[target]] = [next[target], next[idx]];
    writeExercises(next);
  };

  const removeExercise = (idx: number) => {
    const next = exercises.filter((_, i) => i !== idx);
    writeExercises(next);
  };

  const [pickerOpen, setPickerOpen] = useState(false);

  const onPickExercise = (ex: Exercise) => {
    const newPe: PlanExercise = {
      exerciseId: ex.id,
      targetSets: 3,
      targetRepsLow: 8,
      targetRepsHigh: 12,
      restSec: 90,
      notes: '',
    };
    writeExercises([...exercises, newPe]);
    setPickerOpen(false);
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <p className="text-primary font-label text-xs tracking-[0.2em] uppercase">
            Training Day
          </p>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              debouncedRename(e.target.value);
            }}
            onBlur={() => debouncedRename.flush()}
            className="w-full bg-transparent font-headline text-2xl font-bold tracking-tight text-on-surface outline-none focus:bg-surface-container-low rounded-lg px-1 -mx-1"
            placeholder="Day name"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-on-surface-variant text-sm">
          {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
        </span>
      </div>

      {/* Exercise list */}
      <div className="space-y-4">
        {exercises.length === 0 && (
          <div className="bg-surface-container-low rounded-xl p-8 text-center border border-dashed border-outline-variant/30">
            <p className="text-on-surface-variant text-sm">
              No exercises yet. Add one to start building this day.
            </p>
          </div>
        )}

        {exercises.map((pe, idx) => {
          const lib = libIndex.get(pe.exerciseId);
          return (
            <div
              key={`${pe.exerciseId}-${idx}`}
              className="relative bg-surface-container-low rounded-xl overflow-hidden border-l-2 border-primary/40"
            >
              <SignatureBar />
              <div className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveExercise(idx, -1)}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
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
                      {lib?.name ?? 'Unknown exercise'}
                    </h4>
                    {lib && (
                      <p className="text-on-surface-variant text-xs capitalize">
                        {lib.primaryMuscle}
                        {lib.subMuscle ? ` · ${lib.subMuscle}` : ''}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeExercise(idx)}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors"
                    aria-label="Remove exercise"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Numeric grid */}
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Sets"
                    value={pe.targetSets}
                    min={1}
                    onChange={(v) => patchExercise(idx, { targetSets: v })}
                  />
                  <NumberField
                    label="Rest (s)"
                    value={pe.restSec}
                    min={0}
                    step={5}
                    onChange={(v) => patchExercise(idx, { restSec: v })}
                  />
                  <NumberField
                    label="Reps Low"
                    value={pe.targetRepsLow}
                    min={1}
                    onChange={(v) => patchExercise(idx, { targetRepsLow: v })}
                  />
                  <NumberField
                    label="Reps High"
                    value={pe.targetRepsHigh}
                    min={1}
                    onChange={(v) => patchExercise(idx, { targetRepsHigh: v })}
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant block mb-1">
                    Notes
                  </label>
                  <textarea
                    defaultValue={pe.notes}
                    onChange={(e) =>
                      patchExercise(idx, { notes: e.target.value })
                    }
                    onBlur={() => debouncedWriteRef.current.flush()}
                    rows={2}
                    placeholder="e.g. paused, tempo 3-1-1…"
                    className="w-full bg-surface-container-highest/40 text-on-surface text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add exercise button */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>
      </div>

      {pickerOpen && (
        <ExercisePicker
          library={library}
          existingIds={exercises.map((e) => e.exerciseId)}
          onPick={onPickExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="bg-surface-container-highest/40 p-2 rounded-lg">
      <label className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant block mb-1">
        {label}
      </label>
      <input
        type="number"
        inputMode="numeric"
        defaultValue={value}
        min={min}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full bg-transparent font-headline text-lg font-medium text-on-surface outline-none"
      />
    </div>
  );
}

function ExercisePicker({
  library,
  existingIds,
  onPick,
  onClose,
}: {
  library: Exercise[];
  existingIds: string[];
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const existingSet = useMemo(() => new Set(existingIds), [existingIds]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return library;
    return library.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        e.primaryMuscle.toLowerCase().includes(needle) ||
        (e.subMuscle?.toLowerCase().includes(needle) ?? false),
    );
  }, [library, q]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface-container rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="font-headline text-lg font-semibold">Add Exercise</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-surface-container-highest rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-on-surface-variant" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search library…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filtered.length === 0 && (
            <p className="text-center text-on-surface-variant text-sm py-8">
              No matches.
            </p>
          )}
          {filtered.map((ex) => {
            const already = existingSet.has(ex.id);
            return (
              <button
                key={ex.id}
                onClick={() => onPick(ex)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 hover:bg-surface-container-high transition-colors',
                  already && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="font-headline text-sm font-medium truncate">
                    {ex.name}
                  </div>
                  <div className="text-on-surface-variant text-xs capitalize">
                    {ex.primaryMuscle}
                    {ex.subMuscle ? ` · ${ex.subMuscle}` : ''}
                  </div>
                </div>
                {already && (
                  <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">
                    Added
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
