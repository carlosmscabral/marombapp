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

/**
 * Resolves the allowlisted single-user Firebase UID, returning an empty string when unset or blank.
 */
export function resolveAllowedUid(
  rawAllowedUid: string | undefined = import.meta.env.VITE_FIREBASE_ALLOWED_UID as string | undefined,
): string {
  return rawAllowedUid?.trim() ?? '';
}

/**
 * Resolves the target Firestore database identifier, defaulting to `(default)` when unset or blank.
 */
export function resolveFirestoreDatabaseId(
  rawDatabaseId: string | undefined = import.meta.env.VITE_FIRESTORE_DATABASE_ID as string | undefined,
): string {
  const trimmed = rawDatabaseId?.trim();
  return trimmed ? trimmed : '(default)';
}

export const FIRESTORE_DATABASE_ID = resolveFirestoreDatabaseId();

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
 * Targets `FIRESTORE_DATABASE_ID` (`(default)` or named database) and queues offline writes locally.
 */
export function getFirestoreDb(): Firestore {
  if (!dbInstance) {
    dbInstance = initializeFirestore(
      getFirebaseApp(),
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      FIRESTORE_DATABASE_ID,
    );
  }
  return dbInstance;
}
