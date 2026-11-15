/**
 * Firestore repository for the exercise encyclopedia (`exercises` collection).
 * Streams sorted exercise entries and queues custom exercise CRUD writes locally without awaiting server acknowledgments.
 */

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb } from '../firebase';
import type { Exercise } from '../../types';

const exercisesCol = () => collection(getFirestoreDb(), 'exercises');
const exerciseDoc = (id: string) => doc(getFirestoreDb(), 'exercises', id);

/**
 * Subscribes to the exercise library sorted alphabetically by name.
 */
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

/**
 * Creates a user-defined exercise (`isCustom: true`) with a client-generated ID and queues `setDoc` without awaiting server acknowledgment.
 */
export function createExercise(
  data: Omit<Exercise, 'id' | 'isCustom'>,
): Promise<string> {
  const ref = doc(exercisesCol());
  void setDoc(ref, { ...data, isCustom: true }).catch(() => {});
  return Promise.resolve(ref.id);
}

/**
 * Queues field updates on an existing custom exercise document without awaiting server acknowledgment.
 */
export function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, 'id'>>,
): Promise<void> {
  void updateDoc(exerciseDoc(id), updates).catch(() => {});
  return Promise.resolve();
}

/**
 * Queues deletion of an exercise document by id without awaiting server acknowledgment.
 */
export function deleteExercise(id: string): Promise<void> {
  void deleteDoc(exerciseDoc(id)).catch(() => {});
  return Promise.resolve();
}
