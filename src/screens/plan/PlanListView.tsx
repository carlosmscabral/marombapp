/**
 * Training plan list view (`PlanListView`).
 * Creates plans, toggles the active plan optimistically, and renders `PlanRow` items.
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  createPlan,
  isPlanPendingDelete,
  setActivePlan,
} from '../../lib/db';
import { PT_BR } from '../../lib/i18n/pt-BR';
import type { Plan } from '../../types';
import { PlanRow } from './PlanRow';

export interface PlanListViewProps {
  plans: Plan[];
  onOpen: (id: string) => void;
  onActivatePlan?: (id: string) => void;
  onCreatedPlan?: (plan: Plan) => void;
  onRemovedPlan?: (id: string) => void;
}

/**
 * Renders the list of non-archived training plans and the inline creation row.
 */
export function PlanListView({
  plans,
  onOpen,
  onActivatePlan,
  onCreatedPlan,
  onRemovedPlan,
}: PlanListViewProps) {
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [localActiveId, setLocalActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    setLocalActiveId(null);
  }, [plans]);

  const visiblePlans = useMemo(
    () =>
      plans
        .filter(
          (p) =>
            p.archivedAt == null &&
            !deletedIds.has(p.id) &&
            !isPlanPendingDelete(p.id),
        )
        .map((p) =>
          localActiveId ? { ...p, active: p.id === localActiveId } : p,
        ),
    [plans, deletedIds, localActiveId],
  );

  const knownPlansForActivation = useMemo(
    () =>
      plans.map((p) => ({
        id: p.id,
        active: p.active || p.id === localActiveId,
      })),
    [plans, localActiveId],
  );

  const cancelCreate = () => {
    setCreating(false);
    setNewName('');
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) {
      cancelCreate();
      return;
    }
    const isFirst = visiblePlans.length === 0;
    const id = await createPlan(name);
    setNewName('');
    setCreating(false);
    onCreatedPlan?.({
      id,
      name,
      active: isFirst,
      createdAt: Date.now(),
      archivedAt: null,
    });
    if (isFirst) {
      setLocalActiveId(id);
      onActivatePlan?.(id);
      void setActivePlan(id, knownPlansForActivation).catch(() => {});
    }
    onOpen(id);
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto w-full">
      <section className="space-y-1">
        <p className="text-primary font-label text-xs tracking-[0.2em] uppercase">
          {PT_BR.plan.kicker}
        </p>
        <h2 className="font-headline text-3xl font-bold tracking-tight">
          {PT_BR.plan.title}
        </h2>
      </section>

      {creating ? (
        <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitCreate();
              if (e.key === 'Escape') cancelCreate();
            }}
            placeholder={PT_BR.plan.namePlaceholderExample}
            className="flex-1 min-w-0 bg-surface-container-highest/40 rounded-lg px-3 py-2.5 text-on-surface outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={cancelCreate}
            className="min-h-11 px-3 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
          >
            {PT_BR.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submitCreate()}
            className="min-h-11 px-3.5 rounded-lg bg-primary text-on-primary text-sm font-medium"
          >
            {PT_BR.common.create}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
        >
          <Plus className="w-5 h-5" />
          {PT_BR.plan.createPlan}
        </button>
      )}

      {visiblePlans.length === 0 && !creating && (
        <div className="bg-surface-container-low rounded-xl p-8 text-center border border-dashed border-outline-variant/30">
          <p className="text-on-surface-variant text-sm">{PT_BR.plan.emptyPlans}</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-2 bg-primary text-on-primary font-headline font-medium px-5 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            {PT_BR.plan.createFirstPlan}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {visiblePlans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            knownPlans={knownPlansForActivation}
            onOpen={() => onOpen(plan.id)}
            onActivate={() => {
              setLocalActiveId(plan.id);
              onActivatePlan?.(plan.id);
            }}
            onDeleted={() => {
              setDeletedIds((prev) => new Set(prev).add(plan.id));
              onRemovedPlan?.(plan.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}
