/**
 * Lazy Firebase client factories for Authentication and Firestore.
 * Initializes SDK singletons on first call so module imports stay free of side effects.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

export const ALLOWED_UID = (import.meta.env.VITE_FIREBASE_ALLOWED_UID as string) ?? '';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

/**
 * Returns the shared FirebaseApp instance, creating it on first access.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    appInstance = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
  }
  return appInstance;
}

/**
 * Returns the shared Firebase Auth client.
 */
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

/**
 * Returns the shared Firestore client configured with multi-tab IndexedDB persistence.
 * Multi-tab persistence queues offline writes locally during spotty gym connectivity.
 */
export function getFirestoreDb(): Firestore {
  if (!dbInstance) {
    dbInstance = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  }
  return dbInstance;
}
