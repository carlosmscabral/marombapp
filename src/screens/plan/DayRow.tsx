/**
 * Training day row card (`DayRow`) and inline day creation control (`AddDayRow`) inside `PlanDetailView`.
 * Provides up/down reordering buttons, exercise count summary, day deletion, and day creation input.
 */

import { ArrowDown, ArrowUp, Play, Plus, Trash2 } from 'lucide-react';
import { SignatureBar } from '../../components/Layout';
import { PT_BR } from '../../lib/i18n/pt-BR';
import type { PlanDay } from '../../types';

/**
 * Applies an optimistic ID permutation to `days`, appending any newly added day IDs not yet in `orderIds`.
 */
export function applyOptimisticDayOrder(
  days: PlanDay[],
  orderIds: readonly string[] | null,
): PlanDay[] {
  if (!orderIds) return days;
  const byId = new Map(days.map((d) => [d.id, d] as const));
  const ordered: PlanDay[] = [];
  for (const id of orderIds) {
    const found = byId.get(id);
    if (found) {
      ordered.push(found);
      byId.delete(id);
    }
  }
  for (const extra of byId.values()) {
    ordered.push(extra);
  }
  return ordered;
}

/**
 * Renders the floating "Iniciar Treino" action button when an active plan has at least one day.
 */
export function StartWorkoutFab({ onClick }: { onClick: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-headline font-semibold px-6 py-3 rounded-full shadow-[0_16px_32px_rgba(106,178,255,0.15)] ring-4 ring-background"
      >
        <Play className="w-5 h-5 fill-on-primary-fixed" />
        {PT_BR.plan.startWorkoutFab}
      </button>
    </div>
  );
}

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
            aria-label={PT_BR.plan.moveUp}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={PT_BR.plan.moveDown}
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
        <button type="button" onClick={onOpen} className="flex-1 text-left min-w-0">
          <h4 className="font-headline text-lg font-semibold truncate">{day.name}</h4>
          <p className="text-on-surface-variant text-xs">
            {PT_BR.common.exerciseCount(day.exercises.length)}
          </p>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={PT_BR.plan.deleteDayAria(day.name)}
          className="w-11 h-11 rounded-lg flex items-center justify-center text-secondary/80 hover:text-secondary hover:bg-secondary/15 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export interface AddDayRowProps {
  adding: boolean;
  value: string;
  onStart: () => void;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Renders either the "Adicionar Dia" trigger button or the inline day-name form.
 */
export function AddDayRow({
  adding,
  value,
  onStart,
  onChange,
  onSubmit,
  onCancel,
}: AddDayRowProps) {
  if (!adding) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
      >
        <Plus className="w-5 h-5" />
        {PT_BR.plan.addDayBtn}
      </button>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={PT_BR.plan.dayNamePlaceholderExample}
        className="flex-1 min-w-0 bg-surface-container-highest/40 rounded-lg px-3 py-2.5 text-on-surface outline-none focus:ring-1 focus:ring-primary/40"
      />
      <button
        type="button"
        onClick={onCancel}
        className="min-h-11 px-3 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
      >
        {PT_BR.common.cancel}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        className="min-h-11 px-3.5 rounded-lg bg-primary text-on-primary text-sm font-medium"
      >
        {PT_BR.common.add}
      </button>
    </div>
  );
}
