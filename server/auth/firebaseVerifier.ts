/**
 * Firebase Admin ID token verification boundary for the MarombApp BFF.
 * Loads and initializes firebase-admin lazily with Application Default Credentials
 * so startup stays fast and unit tests can mock verification at the module boundary.
 */

import { resolveFirebaseAdminProjectId } from '../config.js';

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
}

/**
 * Lazily loads firebase-admin and initializes the default Firebase Admin Auth instance.
 * Uses FIREBASE_PROJECT_ID before GOOGLE_CLOUD_PROJECT so cross-project token audiences verify cleanly.
 */
async function getFirebaseAdminAuth() {
  const [{ getApp, getApps, initializeApp }, { getAuth }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
  ]);
  if (getApps().length > 0) {
    return getAuth(getApp());
  }
  const projectId = resolveFirebaseAdminProjectId();
  const app = projectId ? initializeApp({ projectId }) : initializeApp();
  return getAuth(app);
}

/**
 * Verifies a raw Firebase Auth Bearer ID token via firebase-admin.
 * Throws when the token signature, expiration, or audience is invalid.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  const auth = await getFirebaseAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    ...(decoded.email ? { email: decoded.email } : {}),
  };
}
