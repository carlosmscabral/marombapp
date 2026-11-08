/**
 * In-memory shadow store for active workout session `exercises` arrays.
 * Serializes nested array updates synchronously and seeds from IndexedDB cache first
 * so rapid gym inputs never overwrite sibling sets or stall on weak mobile signal.
 */

import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  updateDoc,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase';
import type { SessionExercise } from '../../types';

export const sessionsCol = () => collection(getFirestoreDb(), 'sessions');
export const sessionDoc = (id: string) => doc(getFirestoreDb(), 'sessions', id);

const exercisesShadow = new Map<string, SessionExercise[]>();
const seedLocks = new Map<string, Promise<SessionExercise[] | null>>();

/**
 * Deep-clones an array of `SessionExercise` records and their nested `sets`.
 */
export function cloneExercises(list: SessionExercise[]): SessionExercise[] {
  return list.map((ex) => ({
    ...ex,
    sets: ex.sets.map((s) => ({ ...s })),
  }));
}

/**
 * Stores an authoritative `exercises` snapshot in memory when no local writes are pending.
 */
export function syncShadowFromSnapshot(
  sessionId: string,
  exercises: SessionExercise[],
  hasPendingWrites: boolean,
): void {
  if (!hasPendingWrites || !exercisesShadow.has(sessionId)) {
    exercisesShadow.set(sessionId, cloneExercises(exercises));
  }
}

/**
 * Seeds the shadow directly when creating a new workout session.
 */
export function setInitialShadow(
  sessionId: string,
  exercises: SessionExercise[],
): void {
  exercisesShadow.set(sessionId, cloneExercises(exercises));
}

/**
 * Evicts `sessionId` from the in-memory shadow when a workout finishes or aborts.
 */
export function clearShadow(sessionId: string): void {
  exercisesShadow.delete(sessionId);
}

async function ensureShadow(sessionId: string): Promise<SessionExercise[] | null> {
  const existing = exercisesShadow.get(sessionId);
  if (existing) return existing;

  let pending = seedLocks.get(sessionId);
  if (!pending) {
    pending = (async () => {
      const ref = sessionDoc(sessionId);
      const snap = await getDocFromCache(ref).catch(() => getDoc(ref));
      if (!snap.exists()) return null;
      const data = snap.data() as { exercises?: SessionExercise[] };
      const seeded = cloneExercises(data.exercises ?? []);
      if (!exercisesShadow.has(sessionId)) {
        exercisesShadow.set(sessionId, seeded);
      }
      return exercisesShadow.get(sessionId) ?? seeded;
    })().finally(() => {
      seedLocks.delete(sessionId);
    });
    seedLocks.set(sessionId, pending);
  }
  return pending;
}

/**
 * Applies `mutator` synchronously to the latest `exercises` shadow and queues `updateDoc`.
 */
export async function mutateSessionExercises(
  sessionId: string,
  mutator: (current: SessionExercise[]) => SessionExercise[] | null,
): Promise<void> {
  const current = await ensureShadow(sessionId);
  if (!current) return;
  const next = mutator(cloneExercises(current));
  if (!next) return;
  exercisesShadow.set(sessionId, next);
  await updateDoc(sessionDoc(sessionId), { exercises: next });
}
