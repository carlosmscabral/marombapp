/**
 * Training plans route (`/plan`).
 * Coordinates Firestore plan/library subscriptions, optimistic plan creation/activation, and switching between `PlanListView` and `PlanDetailView`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isPlanPendingDelete,
  subscribeAllPlans,
  subscribeLibrary,
} from '../lib/db';
import type { Exercise, Plan as PlanT } from '../types';
import { PlanDetailView } from './plan/PlanDetailView';
import { PlanListView } from './plan/PlanListView';

/**
 * Top-level plans route switching between the plan list and selected plan detail.
 */
export function Plan() {
  const [plans, setPlans] = useState<PlanT[]>([]);
  const snapshotIdsRef = useRef<Set<string>>(new Set());
  const [optimisticPlans, setOptimisticPlans] = useState<PlanT[]>([]);
  const [optimisticActiveId, setOptimisticActiveId] = useState<string | null>(null);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeAllPlans((next) => {
        const present = new Set(next.map((p) => p.id));
        snapshotIdsRef.current = present;
        setPlans(next);
        setOptimisticPlans((prev) => prev.filter((op) => !present.has(op.id)));
        setOptimisticActiveId(null);
      }),
    [],
  );
  useEffect(() => subscribeLibrary(setLibrary), []);

  const removeOptimisticPlan = useCallback((id: string) => {
    setOptimisticPlans((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const allPlans = useMemo(() => {
    const present = new Set(plans.map((p) => p.id));
    const pendingCreated = optimisticPlans.filter(
      (op) => !present.has(op.id) && !isPlanPendingDelete(op.id),
    );
    return [...pendingCreated, ...plans];
  }, [plans, optimisticPlans]);

  const effectivePlans = useMemo(
    () =>
      optimisticActiveId && allPlans.some((p) => p.id === optimisticActiveId)
        ? allPlans.map((p) => ({ ...p, active: p.id === optimisticActiveId }))
        : allPlans,
    [allPlans, optimisticActiveId],
  );

  useEffect(() => {
    if (!selectedPlanId) return;
    if (!effectivePlans.some((p) => p.id === selectedPlanId && p.archivedAt == null)) {
      setSelectedPlanId(null);
      setSelectedDayId(null);
    }
  }, [effectivePlans, selectedPlanId]);

  const selectedPlan = useMemo(
    () => effectivePlans.find((p) => p.id === selectedPlanId) ?? null,
    [effectivePlans, selectedPlanId],
  );

  if (selectedPlan) {
    return (
      <PlanDetailView
        plan={selectedPlan}
        plans={effectivePlans}
        library={library}
        selectedDayId={selectedDayId}
        onSelectDay={setSelectedDayId}
        onActivatePlan={setOptimisticActiveId}
        onDeletedPlan={removeOptimisticPlan}
        onBack={() => {
          setSelectedPlanId(null);
          setSelectedDayId(null);
        }}
      />
    );
  }

  return (
    <PlanListView
      plans={effectivePlans}
      onOpen={setSelectedPlanId}
      onActivatePlan={setOptimisticActiveId}
      onRemovedPlan={removeOptimisticPlan}
      onCreatedPlan={(created) => {
        if (snapshotIdsRef.current.has(created.id)) return;
        setOptimisticPlans((prev) => [created, ...prev]);
      }}
    />
  );
}
