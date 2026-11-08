/**
 * Firestore repository for training plans and training days (`plans` and `plans/{id}/days`).
 * Provides live snapshot subscriptions and atomic batch mutations for plan ordering and activation.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase';
import type { Plan, PlanDay, PlanExercise } from '../../types';

const plansCol = () => collection(getFirestoreDb(), 'plans');
const planDoc = (id: string) => doc(getFirestoreDb(), 'plans', id);
const daysCol = (planId: string) => collection(getFirestoreDb(), 'plans', planId, 'days');
const dayDoc = (planId: string, dayId: string) =>
  doc(getFirestoreDb(), 'plans', planId, 'days', dayId);

/**
 * Normalizes a Firestore plan document into a `Plan` object.
 * Handles both numeric timestamps and pending `serverTimestamp()` objects.
 */
function planFromDoc(id: string, data: Record<string, unknown>): Plan {
  const createdAtRaw = data.createdAt as { toMillis?: () => number } | number | null | undefined;
  let createdAt = 0;
  if (typeof createdAtRaw === 'number') createdAt = createdAtRaw;
  else if (createdAtRaw && typeof createdAtRaw.toMillis === 'function') {
    createdAt = createdAtRaw.toMillis();
  }
  const archivedAtRaw = data.archivedAt as number | null | undefined;
  return {
    id,
    name: (data.name as string) ?? '',
    active: Boolean(data.active),
    createdAt,
    archivedAt: archivedAtRaw ?? null,
  };
}

/**
 * Subscribes to the single currently active training plan.
 */
export function subscribeActivePlan(cb: (plan: Plan | null) => void): Unsubscribe {
  const q = query(plansCol(), where('active', '==', true), limit(1));
  return onSnapshot(q, (snap) => {
    if (snap.empty) return cb(null);
    const d = snap.docs[0];
    cb(planFromDoc(d.id, d.data()));
  });
}

/**
 * Subscribes to all training plans sorted newest first.
 */
export function subscribeAllPlans(cb: (plans: Plan[]) => void): Unsubscribe {
  return onSnapshot(plansCol(), (snap) => {
    const items = snap.docs.map((d) => planFromDoc(d.id, d.data()));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(items);
  });
}

/**
 * Subscribes to all days inside `planId` ordered by ascending `order`.
 */
export function subscribePlanDays(
  planId: string,
  cb: (days: PlanDay[]) => void,
): Unsubscribe {
  const q = query(daysCol(planId), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    const items: PlanDay[] = snap.docs.map((d) => {
      const data = d.data() as {
        name?: string;
        order?: number;
        exercises?: PlanExercise[];
      };
      return {
        id: d.id,
        name: data.name ?? '',
        order: data.order ?? 0,
        exercises: data.exercises ?? [],
      };
    });
    cb(items);
  });
}

/**
 * Creates a new inactive training plan and returns its document id.
 */
export function createPlan(name: string): Promise<string> {
  return addDoc(plansCol(), {
    name,
    active: false,
    createdAt: serverTimestamp(),
    archivedAt: null,
  }).then((ref) => ref.id);
}

/**
 * Marks `planId` as active and deactivates all other plans in a single Firestore batch.
 */
export async function setActivePlan(planId: string): Promise<void> {
  const db = getFirestoreDb();
  const snap = await getDocs(plansCol());
  const batch = writeBatch(db);
  snap.forEach((d) => {
    const isTarget = d.id === planId;
    const data = d.data() as { active?: boolean };
    if (Boolean(data.active) !== isTarget) {
      batch.update(d.ref, { active: isTarget });
    }
  });
  if (!snap.docs.some((d) => d.id === planId)) {
    batch.update(planDoc(planId), { active: true });
  }
  await batch.commit();
}

/**
 * Updates the display name of `planId`.
 */
export async function renamePlan(planId: string, name: string): Promise<void> {
  await updateDoc(planDoc(planId), { name });
}

/**
 * Soft-deletes `planId` by stamping `archivedAt` and clearing `active`.
 */
export async function archivePlan(planId: string): Promise<void> {
  await updateDoc(planDoc(planId), {
    archivedAt: Date.now(),
    active: false,
  });
}

/**
 * Appends a new training day to the end of `planId` and returns its document id.
 */
export async function addPlanDay(planId: string, name: string): Promise<string> {
  const snap = await getDocs(daysCol(planId));
  const maxOrder = snap.docs.reduce((max, d) => {
    const ord = (d.data() as { order?: number }).order ?? -1;
    return ord > max ? ord : max;
  }, -1);
  const ref = await addDoc(daysCol(planId), {
    name,
    order: maxOrder + 1,
    exercises: [],
  });
  return ref.id;
}

/**
 * Renames a training day within `planId`.
 */
export async function renamePlanDay(
  planId: string,
  dayId: string,
  name: string,
): Promise<void> {
  await updateDoc(dayDoc(planId, dayId), { name });
}

/**
 * Deletes a training day document from `planId`.
 */
export async function deletePlanDay(planId: string, dayId: string): Promise<void> {
  await deleteDoc(dayDoc(planId, dayId));
}

/**
 * Updates the `order` field of every day in `planId` to match `orderedIds`.
 */
export async function reorderPlanDays(
  planId: string,
  orderedIds: string[],
): Promise<void> {
  const batch = writeBatch(getFirestoreDb());
  orderedIds.forEach((id, idx) => {
    batch.update(dayDoc(planId, id), { order: idx });
  });
  await batch.commit();
}

/**
 * Replaces the full exercise list of a training day.
 */
export async function setDayExercises(
  planId: string,
  dayId: string,
  exercises: PlanExercise[],
): Promise<void> {
  await updateDoc(dayDoc(planId, dayId), { exercises });
}
