/**
 * Test-only stand-in for the `firebase/auth` module.
 * It keeps the signed-in user in `localStorage` so the session survives a page reload, like real Auth.
 * Specs choose the account that the "Google popup" returns. Thus they can test the
 * signed-out, wrong-UID, and allowed-UID gate states without a network call.
 */

export const USER_KEY = 'fake-auth:user';
export const POPUP_UID_KEY = 'fake-auth:popup-uid';
export const POPUP_ERROR_KEY = 'fake-auth:popup-error';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface Auth {
  currentUser: User | null;
}

type Listener = (user: User | null) => void;

const listeners = new Set<Listener>();
const auth: Auth = { currentUser: readUser() };

function readUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeUser(user: User | null): void {
  auth.currentUser = user;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
  for (const l of [...listeners]) l(user);
}

/** Returns the shared fake Auth handle. */
export function getAuth(): Auth {
  return auth;
}

/** Calls `cb` with the current user on the next tick and on every later change. */
export function onAuthStateChanged(_auth: Auth, cb: Listener): () => void {
  listeners.add(cb);
  const timer = setTimeout(() => cb(auth.currentUser), 0);
  return () => {
    clearTimeout(timer);
    listeners.delete(cb);
  };
}

/** Marker class that the app constructs before it opens the popup. */
export class GoogleAuthProvider {
  readonly providerId = 'google.com';
}

/**
 * Signs in the account named by `fake-auth:popup-uid`.
 * If `fake-auth:popup-error` holds an error code, the popup rejects with that code instead.
 */
export async function signInWithPopup(_auth: Auth, _provider: GoogleAuthProvider): Promise<{ user: User }> {
  const code = localStorage.getItem(POPUP_ERROR_KEY);
  if (code) throw Object.assign(new Error(`Firebase: Error (${code}).`), { code });
  const uid = localStorage.getItem(POPUP_UID_KEY) ?? 'e2e-allowed-uid';
  const user: User = { uid, email: `${uid}@example.test`, displayName: 'Test Lifter' };
  writeUser(user);
  return { user };
}

/** Behaves like the popup flow because a redirect cannot leave the test page. */
export async function signInWithRedirect(a: Auth, p: GoogleAuthProvider): Promise<void> {
  localStorage.removeItem(POPUP_ERROR_KEY);
  await signInWithPopup(a, p);
}

/** Clears the persisted user and notifies listeners. */
export async function signOut(_auth: Auth): Promise<void> {
  writeUser(null);
}
