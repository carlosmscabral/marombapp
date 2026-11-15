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

export const DEFAULT_SAFE_FIRESTORE_DATABASE_ID = 'marombapp-test';

/**
 * Resolves the target Firestore database identifier, defaulting to `marombapp-test`
 * when unset or blank, and explicitly refusing `(default)` or `default` so client
 * builds never connect to the legacy shared database (ADR-004, ADR-005).
 */
export function resolveFirestoreDatabaseId(
  rawDatabaseId: string | undefined = import.meta.env.VITE_FIRESTORE_DATABASE_ID as string | undefined,
): string {
  const trimmed = rawDatabaseId?.trim();
  if (!trimmed) {
    return DEFAULT_SAFE_FIRESTORE_DATABASE_ID;
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === '(default)' || normalized === 'default') {
    throw new Error(
      `Refusing Firestore database "${trimmed}": (default) is legacy read-only (ADR-004, ADR-005). ` +
        'Use "marombapp" or "marombapp-test".',
    );
  }
  return trimmed;
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
 * Resolves and validates the named Firestore database ID before connecting and queues offline writes locally.
 */
export function getFirestoreDb(): Firestore {
  if (!dbInstance) {
    const databaseId = resolveFirestoreDatabaseId();
    dbInstance = initializeFirestore(
      getFirebaseApp(),
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      databaseId,
    );
  }
  return dbInstance;
}
