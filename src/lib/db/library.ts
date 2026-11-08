/**
 * Firestore repository for the exercise encyclopedia (`exercises` collection).
 * Streams sorted exercise entries and handles custom exercise CRUD operations.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
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
 * Creates a user-defined exercise (`isCustom: true`) and returns its document id.
 */
export async function createExercise(
  data: Omit<Exercise, 'id' | 'isCustom'>,
): Promise<string> {
  const ref = await addDoc(exercisesCol(), { ...data, isCustom: true });
  return ref.id;
}

/**
 * Patches fields on an existing custom exercise document.
 */
export async function updateExercise(
  id: string,
  updates: Partial<Omit<Exercise, 'id'>>,
): Promise<void> {
  await updateDoc(exerciseDoc(id), updates);
}

/**
 * Deletes an exercise document by id.
 */
export async function deleteExercise(id: string): Promise<void> {
  await deleteDoc(exerciseDoc(id));
}
