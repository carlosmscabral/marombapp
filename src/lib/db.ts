import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  waitForPendingWrites,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Exercise,
  Plan,
  PlanDay,
  PlanExercise,
  Session,
  SessionExercise,
  SessionSet,
} from '../types';

// ----- Utilities ---------------------------------------------------------

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void | Promise<void>,
  ms: number,
): ((...args: Args) => void) & { flush: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;
  const wrapped = (...args: Args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, ms);
  };
  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  return wrapped;
}

export async function flushPendingWrites(): Promise<void> {
  await waitForPendingWrites(db);
}

// ----- Plans -------------------------------------------------------------

const plansCol = () => collection(db, 'plans');
const planDoc = (id: string) => doc(db, 'plans', id);
const daysCol = (planId: string) => collection(db, 'plans', planId, 'days');
const dayDoc = (planId: string, dayId: string) => doc(db, 'plans', planId, 'days', dayId);

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

export function subscribeActivePlan(cb: (plan: Plan | null) => void): Unsubscribe {
  const q = query(plansCol(), where('active', '==', true), limit(1));
  return onSnapshot(q, (snap) => {
    if (snap.empty) return cb(null);
    const d = snap.docs[0];
    cb(planFromDoc(d.id, d.data()));
  });
}

export function subscribeAllPlans(cb: (plans: Plan[]) => void): Unsubscribe {
  return onSnapshot(plansCol(), (snap) => {
    const items = snap.docs.map((d) => planFromDoc(d.id, d.data()));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(items);
  });
}

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

export async function createPlan(name: string): Promise<string> {
  const ref = await addDoc(plansCol(), {
    name,
    active: false,
    createdAt: serverTimestamp(),
    archivedAt: null,
  });
  return ref.id;
}

export async function setActivePlan(planId: string): Promise<void> {
  const snap = await getDocs(plansCol());
  const batch = writeBatch(db);
  snap.forEach((d) => {
    const isTarget = d.id === planId;
    const data = d.data() as { active?: boolean };
    if (Boolean(data.active) !== isTarget) {
      batch.update(d.ref, { active: isTarget });
    }
  });
  // Ensure target is included even if it wasn't in the snapshot's iteration set.
  if (!snap.docs.some((d) => d.id === planId)) {
    batch.update(planDoc(planId), { active: true });
  }
  await batch.commit();
}

export async function renamePlan(planId: string, name: string): Promise<void> {
  await updateDoc(planDoc(planId), { name });
}

export async function archivePlan(planId: string): Promise<void> {
  await updateDoc(planDoc(planId), {
    archivedAt: Date.now(),
    active: false,
  });
}

export async function addPlanDay(planId: string, name: string): Promise<string> {
  const snap = await getDocs(daysCol(planId));
  const nextOrder = snap.size;
  const ref = await addDoc(daysCol(planId), {
    name,
    order: nextOrder,
    exercises: [],
  });
  return ref.id;
}

export async function renamePlanDay(
  planId: string,
  dayId: string,
  name: string,
): Promise<void> {
  await updateDoc(dayDoc(planId, dayId), { name });
}

export async function deletePlanDay(planId: string, dayId: string): Promise<void> {
  await deleteDoc(dayDoc(planId, dayId));
}

export async function reorderPlanDays(
  planId: string,
  orderedIds: string[],
): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, idx) => {
    batch.update(dayDoc(planId, id), { order: idx });
  });
  await batch.commit();
}

export async function setDayExercises(
  planId: string,
  dayId: string,
  exercises: PlanExercise[],
): Promise<void> {
  await updateDoc(dayDoc(planId, dayId), { exercises });
}

// ----- Library -----------------------------------------------------------

const exercisesCol = () => collection(db, 'exercises');
const exerciseDoc = (id: string) => doc(db, 'exercises', id);

export function subscribeLibrary(cb: (items: Exercise[]) => void): Unsubscribe {
  return onSnapshot(exercisesCol(), (snap) => {
    const items: Exercise[] = snap.docs.map((d) => {
      const data = d.data() as Omit<Exercise, 'id'>;
      return { id: d.id, ...data };
    });
    items.sort((a, b) => a.name.localeCompare(b.name));
    cb(items);
  });
}

export async function createExercise(
  data: Omit<Exercise, 'id' | 'isCustom'>,
): Promise<string> {
  const ref = await addDoc(exercisesCol(), { ...data, isCustom: true });
  return ref.id;
}

export async function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, 'id'>>,
): Promise<void> {
  await updateDoc(exerciseDoc(id), updates);
}

export async function deleteExercise(id: string): Promise<void> {
  await deleteDoc(exerciseDoc(id));
}

// ----- Sessions ----------------------------------------------------------

const sessionsCol = () => collection(db, 'sessions');
const sessionDoc = (id: string) => doc(db, 'sessions', id);

function sessionFromDoc(id: string, data: Record<string, unknown>): Session {
  return {
    id,
    planId: (data.planId as string) ?? '',
    planName: (data.planName as string) ?? '',
    dayId: (data.dayId as string) ?? '',
    dayName: (data.dayName as string) ?? '',
    startedAt: (data.startedAt as number) ?? 0,
    finishedAt: (data.finishedAt as number | null) ?? null,
    status: (data.status as Session['status']) ?? 'active',
    sessionNotes: (data.sessionNotes as string) ?? '',
    restTimer: (data.restTimer as Session['restTimer']) ?? null,
    exercises: (data.exercises as SessionExercise[]) ?? [],
  };
}

export function subscribeActiveSession(
  cb: (session: Session | null) => void,
): Unsubscribe {
  const q = query(sessionsCol(), where('status', '==', 'active'), limit(1));
  return onSnapshot(q, (snap) => {
    if (snap.empty) return cb(null);
    const d = snap.docs[0];
    cb(sessionFromDoc(d.id, d.data()));
  });
}

export function subscribeRecentSessions(
  limitCount: number,
  cb: (sessions: Session[]) => void,
): Unsubscribe {
  const q = query(
    sessionsCol(),
    where('status', '==', 'completed'),
    orderBy('finishedAt', 'desc'),
    limit(limitCount),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => sessionFromDoc(d.id, d.data())));
  });
}

export async function getSession(id: string): Promise<Session | null> {
  const snap = await getDoc(sessionDoc(id));
  if (!snap.exists()) return null;
  return sessionFromDoc(snap.id, snap.data());
}

export async function createSession(
  plan: Plan,
  day: PlanDay,
  library: Exercise[],
): Promise<string> {
  const libIndex = new Map(library.map((e) => [e.id, e] as const));
  const exercises: SessionExercise[] = day.exercises.map((pe) => {
    const lib = libIndex.get(pe.exerciseId);
    const initialSets: SessionSet[] = Array.from({ length: pe.targetSets || 0 }, () => ({
      weight: 0,
      reps: 0,
      completedAt: null,
    }));
    return {
      exerciseId: pe.exerciseId,
      exerciseName: lib?.name ?? 'Unknown exercise',
      notes: '',
      sets: initialSets,
      targetRepsLow: pe.targetRepsLow,
      targetRepsHigh: pe.targetRepsHigh,
      restSec: pe.restSec,
    };
  });

  const sessionData: Omit<Session, 'id'> = {
    planId: plan.id,
    planName: plan.name,
    dayId: day.id,
    dayName: day.name,
    startedAt: Date.now(),
    finishedAt: null,
    status: 'active',
    sessionNotes: '',
    restTimer: null,
    exercises,
  };

  const ref = await addDoc(sessionsCol(), sessionData);
  return ref.id;
}

export async function updateSessionField<K extends keyof Session>(
  sessionId: string,
  field: K,
  value: Session[K],
): Promise<void> {
  await updateDoc(sessionDoc(sessionId), { [field]: value });
}

// Firestore doesn't support dotted paths into array elements with updateDoc,
// so all nested-array writes follow the same pattern: get → mutate → set.

export async function updateSessionExercise(
  sessionId: string,
  exerciseIndex: number,
  updates: Partial<SessionExercise>,
): Promise<void> {
  const snap = await getDoc(sessionDoc(sessionId));
  if (!snap.exists()) return;
  const data = snap.data() as { exercises?: SessionExercise[] };
  const exercises = [...(data.exercises ?? [])];
  if (!exercises[exerciseIndex]) return;
  exercises[exerciseIndex] = { ...exercises[exerciseIndex], ...updates };
  await updateDoc(sessionDoc(sessionId), { exercises });
}

export async function logSet(
  sessionId: string,
  exerciseIndex: number,
  setIndex: number,
  set: SessionSet,
): Promise<void> {
  const snap = await getDoc(sessionDoc(sessionId));
  if (!snap.exists()) return;
  const data = snap.data() as { exercises?: SessionExercise[] };
  const exercises = [...(data.exercises ?? [])];
  const ex = exercises[exerciseIndex];
  if (!ex) return;
  const sets = [...ex.sets];
  sets[setIndex] = set;
  exercises[exerciseIndex] = { ...ex, sets };
  await updateDoc(sessionDoc(sessionId), { exercises });
}

export async function addSetToExercise(
  sessionId: string,
  exerciseIndex: number,
): Promise<void> {
  const snap = await getDoc(sessionDoc(sessionId));
  if (!snap.exists()) return;
  const data = snap.data() as { exercises?: SessionExercise[] };
  const exercises = [...(data.exercises ?? [])];
  const ex = exercises[exerciseIndex];
  if (!ex) return;
  const lastSet = ex.sets[ex.sets.length - 1];
  const blank: SessionSet = {
    weight: lastSet?.weight ?? 0,
    reps: 0,
    completedAt: null,
  };
  exercises[exerciseIndex] = { ...ex, sets: [...ex.sets, blank] };
  await updateDoc(sessionDoc(sessionId), { exercises });
}

export async function startRestTimer(
  sessionId: string,
  durationSec: number,
): Promise<void> {
  await updateDoc(sessionDoc(sessionId), {
    restTimer: { startedAt: Date.now(), durationSec },
  });
}

export async function clearRestTimer(sessionId: string): Promise<void> {
  await updateDoc(sessionDoc(sessionId), { restTimer: null });
}

export async function finishSession(sessionId: string): Promise<void> {
  await updateDoc(sessionDoc(sessionId), {
    finishedAt: Date.now(),
    status: 'completed',
    restTimer: null,
  });
}

export async function abandonSession(sessionId: string): Promise<void> {
  await updateDoc(sessionDoc(sessionId), {
    finishedAt: Date.now(),
    status: 'abandoned',
    restTimer: null,
  });
}

