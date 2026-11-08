/**
 * Searchable exercise picker modal shared by PlanDay and InGym.
 * Filters the exercise library by text query or primary muscle group chip.
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../types';
import { cap } from '../lib/format';
import { cn } from './Layout';

export interface ExercisePickerModalProps {
  library: Exercise[];
  existingIds: string[];
  onPick: (ex: Exercise) => void;
  onClose: () => void;
  title?: string;
}

/**
 * Displays a searchable modal list of exercises, highlighting entries already in the day or session.
 */
export function ExercisePickerModal({
  library,
  existingIds,
  onPick,
  onClose,
  title = 'Add Exercise',
}: ExercisePickerModalProps) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<'all' | MuscleGroup>('all');
  const existingSet = useMemo(() => new Set(existingIds), [existingIds]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return library.filter((e) => {
      if (muscle !== 'all' && e.primaryMuscle !== muscle) return false;
      if (!needle) return true;
      return (
        e.name.toLowerCase().includes(needle) ||
        e.primaryMuscle.toLowerCase().includes(needle) ||
        (e.subMuscle?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [library, q, muscle]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md bg-surface-container rounded-t-2xl sm:rounded-2xl max-h-[82vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-outline-variant/15">
          <h3 className="font-headline text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-2 bg-surface-container-highest rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-on-surface-variant" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search exercises or muscles…"
              className="flex-1 bg-transparent text-sm outline-none text-on-surface placeholder:text-on-surface-variant"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setMuscle('all')}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-full text-xs font-label border transition-colors',
                muscle === 'all'
                  ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                  : 'bg-surface-container-high border-transparent text-on-surface-variant',
              )}
            >
              All
            </button>
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMuscle(m)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-full text-xs font-label border transition-colors',
                  muscle === m
                    ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
                    : 'bg-surface-container-high border-transparent text-on-surface-variant',
                )}
              >
                {cap(m)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
          {filtered.length === 0 && (
            <p className="p-6 text-center text-on-surface-variant text-sm">
              No matching exercises.
            </p>
          )}
          {filtered.map((ex) => {
            const added = existingSet.has(ex.id);
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => onPick(ex)}
                className="w-full text-left px-4 py-3 hover:bg-surface-container-high transition-colors flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-headline text-sm font-medium text-on-surface truncate">
                    {ex.name}
                  </div>
                  <div className="text-xs text-on-surface-variant capitalize">
                    {ex.primaryMuscle}
                    {ex.subMuscle ? ` · ${ex.subMuscle}` : ''}
                  </div>
                </div>
                {added && (
                  <span className="text-[10px] font-label uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
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
