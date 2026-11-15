/**
 * Plan detail organizer (`PlanDetailView`).
 * Manages plan renaming, active-plan selection, day creation, reordering, and deletion.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Play, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../components/Layout';
import {
  addPlanDay,
  debounce,
  deletePlan,
  deletePlanDay,
  renamePlan,
  reorderPlanDays,
  setActivePlan,
  subscribePlanDays,
} from '../../lib/db';
import { PT_BR } from '../../lib/i18n/pt-BR';
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
  const [deletedDayIds, setDeletedDayIds] = useState<ReadonlySet<string>>(() => new Set());
  const [name, setName] = useState(plan.name);
  const nameFocusedRef = useRef(false);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayName, setNewDayName] = useState('');

  useEffect(() => {
    setDeletedDayIds(new Set());
    return subscribePlanDays(plan.id, setDays);
  }, [plan.id]);

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

  const visibleDays = days.filter((d) => !deletedDayIds.has(d.id));
  const selectedDay = visibleDays.find((d) => d.id === selectedDayId) ?? null;
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
    if (target < 0 || target >= visibleDays.length) return;
    const orderedIds = visibleDays.map((d) => d.id);
    [orderedIds[idx], orderedIds[target]] = [orderedIds[target], orderedIds[idx]];
    await reorderPlanDays(plan.id, orderedIds).catch(() => {});
  };

  const handleDeleteDay = (day: PlanDayT) => {
    if (!confirm(PT_BR.plan.confirmDeleteDay(day.name))) return;
    setDeletedDayIds((prev) => new Set(prev).add(day.id));
    void deletePlanDay(plan.id, day.id).catch(() => {});
  };

  const handleDeletePlan = () => {
    const displayName = name.trim() || plan.name;
    if (!confirm(PT_BR.plan.confirmDeletePlan(displayName))) return;
    debouncedRename.cancel();
    void deletePlan(
      plan.id,
      days.map((d) => d.id),
    ).catch(() => {});
    onBack();
  };

  const cancelAddDay = () => {
    setAddingDay(false);
    setNewDayName('');
  };

  const submitAddDay = async () => {
    const dayName = newDayName.trim();
    if (!dayName) {
      cancelAddDay();
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
          className="w-11 h-11 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          aria-label={PT_BR.plan.backToPlans}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-primary font-label text-xs tracking-[0.2em] uppercase">
            {PT_BR.plan.planKicker}
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
            placeholder={PT_BR.plan.namePlaceholder}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            if (plan.active) return;
            await setActivePlan(plan.id).catch(() => {});
          }}
          className={cn(
            'flex-1 min-h-11 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
            plan.active
              ? 'bg-primary/10 border-primary/30 text-primary cursor-default'
              : 'bg-surface-container-low border-outline-variant/20 text-on-surface hover:bg-surface-container-high',
          )}
        >
          <span className="flex items-center gap-2">
            {plan.active ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
            <span className="font-headline text-sm font-medium">
              {plan.active
                ? PT_BR.plan.activePlanBtn
                : PT_BR.plan.setAsActivePlanBtn}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={handleDeletePlan}
          className="shrink-0 min-h-11 px-3.5 rounded-xl bg-secondary/15 text-secondary border border-secondary/30 font-label text-xs uppercase tracking-widest font-semibold hover:bg-secondary/25 transition-colors inline-flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          {PT_BR.plan.deletePlanBtn}
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-lg font-semibold">
            {PT_BR.plan.trainingDaysTitle}
          </h3>
          <span className="text-on-surface-variant text-xs">
            {PT_BR.common.dayCount(visibleDays.length)}
          </span>
        </div>

        {visibleDays.length === 0 && !addingDay && (
          <div className="bg-surface-container-low rounded-xl p-6 text-center border border-dashed border-outline-variant/30">
            <p className="text-on-surface-variant text-sm">
              {PT_BR.plan.emptyDays}
            </p>
          </div>
        )}

        {visibleDays.map((d, idx) => (
          <DayRow
            key={d.id}
            day={d}
            isFirst={idx === 0}
            isLast={idx === visibleDays.length - 1}
            onMoveUp={() => void moveDay(idx, -1)}
            onMoveDown={() => void moveDay(idx, 1)}
            onDelete={() => handleDeleteDay(d)}
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
                if (e.key === 'Escape') cancelAddDay();
              }}
              placeholder={PT_BR.plan.dayNamePlaceholderExample}
              className="flex-1 min-w-0 bg-surface-container-highest/40 rounded-lg px-3 py-2.5 text-on-surface outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={cancelAddDay}
              className="min-h-11 px-3 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
            >
              {PT_BR.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => void submitAddDay()}
              className="min-h-11 px-3.5 rounded-lg bg-primary text-on-primary text-sm font-medium"
            >
              {PT_BR.common.add}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingDay(true)}
            className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
          >
            <Plus className="w-5 h-5" />
            {PT_BR.plan.addDayBtn}
          </button>
        )}
      </section>

      {plan.active && visibleDays.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button
            type="button"
            onClick={() => navigate('/start')}
            className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-headline font-semibold px-6 py-3 rounded-full shadow-[0_16px_32px_rgba(106,178,255,0.15)] ring-4 ring-background"
          >
            <Play className="w-5 h-5 fill-on-primary-fixed" />
            {PT_BR.plan.startWorkoutFab}
          </button>
        </div>
      )}
    </div>
  );
}
