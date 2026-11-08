/**
 * Training plans route (`/plan`).
 * Coordinates Firestore plan/library subscriptions and switches between `PlanListView` and `PlanDetailView`.
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
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  useEffect(() => subscribeAllPlans(setPlans), []);
  useEffect(() => subscribeLibrary(setLibrary), []);

  useEffect(() => {
    if (!selectedPlanId) return;
    if (!plans.some((p) => p.id === selectedPlanId && p.archivedAt == null)) {
      setSelectedPlanId(null);
      setSelectedDayId(null);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  if (selectedPlan) {
    return (
      <PlanDetailView
        plan={selectedPlan}
        library={library}
        selectedDayId={selectedDayId}
        onSelectDay={setSelectedDayId}
        onBack={() => {
          setSelectedPlanId(null);
          setSelectedDayId(null);
        }}
      />
    );
  }

  return <PlanListView plans={plans} onOpen={setSelectedPlanId} />;
}
