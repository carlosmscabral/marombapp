/**
 * Authentication provider and single-user UID gate for MarombApp.
 * Signs in via Google OAuth popup (with redirect fallback on mobile PWAs) and enforces `ALLOWED_UID`.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth, resolveAllowedUid } from './firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Checks whether `uid` matches the configured single-user `ALLOWED_UID`.
 * If `ALLOWED_UID` is empty or unset, the check fails closed and rejects every account.
 */
export function isAuthorizedUid(
  uid: string | undefined | null,
  allowedUid: string = resolveAllowedUid(),
): boolean {
  const normalizedAllowed = allowedUid.trim();
  if (!normalizedAllowed || !uid) {
    return false;
  }
  return uid === normalizedAllowed;
}

/**
 * Provides Firebase authentication state, fails closed when `ALLOWED_UID` is unset,
 * and surfaces initialization or sign-in errors without unmounting the SignIn screen.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);

  useEffect(() => {
    let auth: Auth;
    try {
      auth = getFirebaseAuth();
    } catch (err) {
      setUser(null);
      setError((err as Error)?.message || 'config');
      setLoading(false);
      return undefined;
    }

    try {
      const unsub = onAuthStateChanged(auth, async (next) => {
        if (next && !isAuthorizedUid(next.uid)) {
          try {
            await fbSignOut(auth);
          } catch {
            /* Ignore sign-out errors during unauthorized cleanup. */
          }
          setUser(null);
          setError('unauthorized');
        } else {
          setUser(next);
          if (next) setError(null);
        }
        setLoading(false);
      });
      return unsub;
    } catch (err) {
      setUser(null);
      setError((err as Error)?.message || 'config');
      setLoading(false);
      return undefined;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      signIn: async () => {
        setError(null);
        let auth: Auth;
        try {
          auth = getFirebaseAuth();
        } catch (err) {
          setError((err as Error)?.message || 'config');
          return;
        }
        const provider = new GoogleAuthProvider();
        try {
          const result = await signInWithPopup(auth, provider);
          if (!isAuthorizedUid(result.user.uid)) {
            await fbSignOut(auth);
            setUser(null);
            setError('unauthorized');
          }
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'auth/popup-blocked') {
            try {
              await signInWithRedirect(auth, provider);
            } catch (redirectErr) {
              setError((redirectErr as Error)?.message || 'sign-in failed');
            }
            return;
          }
          if (
            code !== 'auth/popup-closed-by-user' &&
            code !== 'auth/cancelled-popup-request'
          ) {
            setError((err as Error)?.message || 'sign-in failed');
          }
        }
      },
      signOut: async () => {
        try {
          await fbSignOut(getFirebaseAuth());
        } catch {
          /* Ignore sign-out errors when Auth failed to initialize. */
        }
        setUser(null);
      },
    }),
    [user, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the active authentication context.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
