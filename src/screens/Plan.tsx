/**
 * Training plans route (`/plan`).
 * Coordinates Firestore plan/library subscriptions, optimistic active-plan state, and switching between `PlanListView` and `PlanDetailView`.
 */

import { useEffect, useMemo, useState } from 'react';
import { subscribeAllPlans, subscribeLibrary } from '../lib/db';
import type { Exercise, Plan as PlanT } from '../types';
import { PlanDetailView } from './plan/PlanDetailView';
import { PlanListView } from './plan/PlanListView';

/**
 * Top-level plans route switching between the plan list and selected plan detail.
 */
export function Plan() {
  const [plans, setPlans] = useState<PlanT[]>([]);
  const [optimisticActiveId, setOptimisticActiveId] = useState<string | null>(null);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  useEffect(
    () =>
      subscribeAllPlans((next) => {
        setPlans(next);
        setOptimisticActiveId(null);
      }),
    [],
  );
  useEffect(() => subscribeLibrary(setLibrary), []);

  const effectivePlans = useMemo(
    () =>
      optimisticActiveId && plans.some((p) => p.id === optimisticActiveId)
        ? plans.map((p) => ({ ...p, active: p.id === optimisticActiveId }))
        : plans,
    [plans, optimisticActiveId],
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
    />
  );
}
