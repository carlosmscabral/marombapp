/**
 * Firestore repository for workout sessions (`sessions` collection).
 * Queues session lifecycle writes locally with client-generated IDs and reads cache first so gym flows never stall offline.
 */

import {
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  waitForPendingWrites,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase';
import { buildInitialSetsFromHistory, type HistoryEntry } from '../history';
import type {
  Exercise,
  Plan,
  PlanDay,
  Session,
  SessionExercise,
} from '../../types';
import {
  clearShadow,
  drainShadowQueue,
  sessionDoc,
  sessionsCol,
  setInitialShadow,
  syncShadowFromSnapshot,
} from './sessionShadow';

export * from './sessionMutations';

type LocalSessionEvent =
  | { type: 'created'; session: Session }
  | { type: 'ended'; sessionId: string };

const activeSessionListeners = new Set<(event: LocalSessionEvent) => void>();

function emitSessionEvent(event: LocalSessionEvent): void {
  for (const listener of activeSessionListeners) {
    listener(event);
  }
}

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
    exercises: (data.exercises as SessionExercise[]) ?? [],
  };
}

/**
 * Opportunistically asks Firestore to flush queued local mutations when online.
 */
export async function flushPendingWrites(): Promise<void> {
  await waitForPendingWrites(getFirestoreDb());
}

/**
 * Subscribes to the single active workout session (`status == 'active'`).
 * Propagates local `createSession`, `finishSession`, and `abandonSession` transitions immediately before snapshot echoes arrive.
 */
export function subscribeActiveSession(
  cb: (session: Session | null) => void,
): Unsubscribe {
  let pendingCreated: Session | null = null;
  const endedIds = new Set<string>();

  const onLocalEvent = (event: LocalSessionEvent) => {
    if (event.type === 'created') {
      endedIds.delete(event.session.id);
      pendingCreated = event.session;
      cb(event.session);
      return;
    }
    endedIds.add(event.sessionId);
    if (pendingCreated?.id === event.sessionId) {
      pendingCreated = null;
    }
    cb(pendingCreated);
  };
  activeSessionListeners.add(onLocalEvent);

  const q = query(sessionsCol(), where('status', '==', 'active'), limit(1));
  const offSnap = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
    const presentIds = new Set(snap.docs.map((docItem) => docItem.id));
    for (const id of endedIds) {
      if (!presentIds.has(id)) endedIds.delete(id);
    }
    if (snap.empty) {
      cb(pendingCreated);
      return;
    }
    const d = snap.docs[0];
    if (endedIds.has(d.id)) {
      cb(pendingCreated);
      return;
    }
    if (pendingCreated?.id === d.id) {
      pendingCreated = null;
    }
    const parsed = sessionFromDoc(d.id, d.data());
    syncShadowFromSnapshot(d.id, parsed.exercises, d.metadata.hasPendingWrites);
    cb(parsed);
  });

  return () => {
    activeSessionListeners.delete(onLocalEvent);
    offSnap();
  };
}

/**
 * Subscribes to the `limitCount` most recently finished workouts.
 */
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

/**
 * Loads a single session document from local IndexedDB cache first so poor gym signal never stalls `SessionDetail`.
 * Starts a non-blocking background network `getDoc` refresh when cached, and falls back to network `getDoc` only on cache miss.
 */
export async function getSession(
  id: string,
  onRefresh?: (session: Session) => void,
): Promise<Session | null> {
  const ref = sessionDoc(id);
  const cachedSnap = await getDocFromCache(ref).catch(() => null);
  if (cachedSnap && cachedSnap.exists()) {
    const cachedSession = sessionFromDoc(cachedSnap.id, cachedSnap.data());
    void getDoc(ref)
      .then((freshSnap) => {
        if (freshSnap.exists()) {
          onRefresh?.(sessionFromDoc(freshSnap.id, freshSnap.data()));
        }
      })
      .catch(() => {});
    return cachedSession;
  }
  const netSnap = await getDoc(ref);
  if (!netSnap.exists()) return null;
  return sessionFromDoc(netSnap.id, netSnap.data());
}

/**
 * Starts a new active workout session for `day` with a client-generated ID and pre-fills sets from `historyMap`.
 * Queues `setDoc` into Firestore's local persistence before returning without awaiting server acknowledgment.
 */
export function createSession(
  plan: Plan,
  day: PlanDay,
  library: Exercise[],
  historyMap?: Map<string, HistoryEntry[]>,
): Promise<string> {
  const libIndex = new Map(library.map((e) => [e.id, e] as const));
  const exercises: SessionExercise[] = day.exercises.map((pe) => {
    const lib = libIndex.get(pe.exerciseId);
    const latestHistory = historyMap?.get(pe.exerciseId)?.[0];
    return {
      exerciseId: pe.exerciseId,
      exerciseName: lib?.name ?? 'Unknown exercise',
      notes: '',
      sets: buildInitialSetsFromHistory(pe.targetSets || 0, latestHistory),
      targetRepsLow: pe.targetRepsLow,
      targetRepsHigh: pe.targetRepsHigh,
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
    exercises,
  };

  const ref = doc(sessionsCol());
  setInitialShadow(ref.id, exercises);
  void setDoc(ref, sessionData).catch(() => {});
  emitSessionEvent({
    type: 'created',
    session: { id: ref.id, ...sessionData },
  });
  return Promise.resolve(ref.id);
}

/**
 * Queues an update to a top-level scalar field (such as `sessionNotes`) on `sessionId` without awaiting server acknowledgment.
 */
export function updateSessionField<K extends keyof Session>(
  sessionId: string,
  field: K,
  value: Session[K],
): Promise<void> {
  void updateDoc(sessionDoc(sessionId), { [field]: value }).catch(() => {});
  return Promise.resolve();
}

/**
 * Drains local shadow mutations, marks `sessionId` as completed in Firestore's local queue, and clears active state immediately.
 */
export async function finishSession(sessionId: string): Promise<void> {
  await drainShadowQueue(sessionId);
  clearShadow(sessionId);
  void updateDoc(sessionDoc(sessionId), {
    finishedAt: Date.now(),
    status: 'completed',
  }).catch(() => {});
  emitSessionEvent({ type: 'ended', sessionId });
}

/**
 * Drains local shadow mutations, marks `sessionId` as abandoned in Firestore's local queue, and clears active state immediately.
 */
export async function abandonSession(sessionId: string): Promise<void> {
  await drainShadowQueue(sessionId);
  clearShadow(sessionId);
  void updateDoc(sessionDoc(sessionId), {
    finishedAt: Date.now(),
    status: 'abandoned',
  }).catch(() => {});
  emitSessionEvent({ type: 'ended', sessionId });
}

/**
 * Permanently deletes `sessionId` from history and clears its in-memory mutation shadow.
 * Starts `deleteDoc` without awaiting server acknowledgment so offline deletion never stalls navigation.
 */
export function deleteSession(sessionId: string): Promise<void> {
  clearShadow(sessionId);
  void deleteDoc(sessionDoc(sessionId)).catch(() => {});
  emitSessionEvent({ type: 'ended', sessionId });
  return Promise.resolve();
}
