/**
 * Plan detail organizer (`PlanDetailView`).
 * Manages plan renaming, active-plan selection, day creation, reordering, and deletion.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Play, Plus } from 'lucide-react';
import { cn } from '../../components/Layout';
import {
  addPlanDay,
  debounce,
  deletePlanDay,
  renamePlan,
  reorderPlanDays,
  setActivePlan,
  subscribePlanDays,
} from '../../lib/db';
import type { Exercise, Plan as PlanT, PlanDay as PlanDayT } from '../../types';
import { PlanDay } from '../PlanDay';
import { DayRow } from './DayRow';

export interface PlanDetailViewProps {
  plan: PlanT;
  library: Exercise[];
  selectedDayId: string | null;
  onSelectDay: (id: string | null) => void;
  onBack: () => void;
}

/**
 * Renders the day list for `plan` or delegates to `PlanDay` when a day is open.
 */
export function PlanDetailView({
  plan,
  library,
  selectedDayId,
  onSelectDay,
  onBack,
}: PlanDetailViewProps) {
  const navigate = useNavigate();
  const [days, setDays] = useState<PlanDayT[]>([]);
  const [name, setName] = useState(plan.name);
  const nameFocusedRef = useRef(false);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayName, setNewDayName] = useState('');

  useEffect(() => subscribePlanDays(plan.id, setDays), [plan.id]);

  useEffect(() => {
    if (!nameFocusedRef.current) setName(plan.name);
  }, [plan.name, plan.id]);

  const debouncedRename = useMemo(
    () =>
      debounce((next: string) => {
        const trimmed = next.trim();
        if (!trimmed || trimmed === plan.name) return;
        renamePlan(plan.id, trimmed).catch(() => {});
      }, 250),
    [plan.id, plan.name],
  );
  useEffect(() => () => debouncedRename.flush(), [debouncedRename]);

  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;
  if (selectedDay) {
    return (
      <PlanDay
        planId={plan.id}
        day={selectedDay}
        library={library}
        onBack={() => onSelectDay(null)}
      />
    );
  }

  const moveDay = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= days.length) return;
    const orderedIds = days.map((d) => d.id);
    [orderedIds[idx], orderedIds[target]] = [orderedIds[target], orderedIds[idx]];
    await reorderPlanDays(plan.id, orderedIds).catch(() => {});
  };

  const handleDeleteDay = async (day: PlanDayT) => {
    if (!confirm(`Delete training day "${day.name}"?`)) return;
    await deletePlanDay(plan.id, day.id).catch(() => {});
  };

  const submitAddDay = async () => {
    const dayName = newDayName.trim();
    if (!dayName) {
      setAddingDay(false);
      setNewDayName('');
      return;
    }
    const id = await addPlanDay(plan.id, dayName);
    setNewDayName('');
    setAddingDay(false);
    onSelectDay(id);
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          aria-label="Back to plans"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-primary font-label text-xs tracking-[0.2em] uppercase">Plan</p>
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
            placeholder="Plan name"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={async () => {
          if (plan.active) return;
          await setActivePlan(plan.id).catch(() => {});
        }}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
          plan.active
            ? 'bg-primary/10 border-primary/30 text-primary cursor-default'
            : 'bg-surface-container-low border-outline-variant/20 text-on-surface hover:bg-surface-container-high',
        )}
      >
        <span className="flex items-center gap-2">
          {plan.active ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
          <span className="font-headline text-sm font-medium">
            {plan.active ? 'Active plan' : 'Set as active plan'}
          </span>
        </span>
      </button>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-lg font-semibold">Training Days</h3>
          <span className="text-on-surface-variant text-xs">
            {days.length} {days.length === 1 ? 'day' : 'days'}
          </span>
        </div>

        {days.length === 0 && !addingDay && (
          <div className="bg-surface-container-low rounded-xl p-6 text-center border border-dashed border-outline-variant/30">
            <p className="text-on-surface-variant text-sm">
              No training days yet. Add one to get started.
            </p>
          </div>
        )}

        {days.map((d, idx) => (
          <DayRow
            key={d.id}
            day={d}
            isFirst={idx === 0}
            isLast={idx === days.length - 1}
            onMoveUp={() => void moveDay(idx, -1)}
            onMoveDown={() => void moveDay(idx, 1)}
            onDelete={() => void handleDeleteDay(d)}
            onOpen={() => onSelectDay(d.id)}
          />
        ))}

        {addingDay ? (
          <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2">
            <input
              autoFocus
              value={newDayName}
              onChange={(e) => setNewDayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitAddDay();
                if (e.key === 'Escape') {
                  setAddingDay(false);
                  setNewDayName('');
                }
              }}
              placeholder="Day name (e.g. Push 1)"
              className="flex-1 bg-surface-container-highest/40 rounded-lg px-3 py-2 text-on-surface outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={() => void submitAddDay()}
              className="px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingDay(true)}
            className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Day
          </button>
        )}
      </section>

      {plan.active && days.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={() => navigate('/start')}
            className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-headline font-semibold px-6 py-3 rounded-full shadow-[0_16px_32px_rgba(106,178,255,0.15)] ring-4 ring-background"
          >
            <Play className="w-5 h-5 fill-on-primary-fixed" />
            Start Workout
          </button>
        </div>
      )}
    </div>
  );
}
