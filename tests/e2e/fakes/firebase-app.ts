/**
 * Test-only stand-in for the `firebase/app` module.
 * The e2e Vite config aliases `firebase/app` to this file, so no test talks to a real Firebase project.
 * Normal builds never resolve this file.
 */

export interface FirebaseApp {
  name: string;
  options: Record<string, unknown>;
}

/** Returns an inert app handle. The fakes for Auth and Firestore ignore it. */
export function initializeApp(options: Record<string, unknown> = {}): FirebaseApp {
  return { name: '[fake]', options };
}

/** Returns the inert default app handle. */
export function getApp(): FirebaseApp {
  return initializeApp();
}
