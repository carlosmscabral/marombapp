/**
 * Training day row card (`DayRow`) inside `PlanDetailView`.
 * Provides up/down reordering buttons, exercise count summary, and day deletion.
 */

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { SignatureBar } from '../../components/Layout';
import type { PlanDay } from '../../types';

export interface DayRowProps {
  day: PlanDay;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onOpen: () => void;
}

/**
 * Renders a single training day card inside a plan's day list.
 */
export function DayRow({
  day,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onOpen,
}: DayRowProps) {
  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden border-l-2 border-primary/40">
      <SignatureBar />
      <div className="p-4 flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Move up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Move down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
        <button type="button" onClick={onOpen} className="flex-1 text-left min-w-0">
          <h4 className="font-headline text-lg font-semibold truncate">{day.name}</h4>
          <p className="text-on-surface-variant text-xs">
            {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
          </p>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${day.name}`}
          className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant/60 hover:text-secondary hover:bg-surface-container-high transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
