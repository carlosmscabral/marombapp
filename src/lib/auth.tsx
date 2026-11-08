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
  type User,
} from 'firebase/auth';
import { ALLOWED_UID, getFirebaseAuth } from './firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provides Firebase authentication state and immediately signs out non-allowlisted accounts.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (next) => {
      if (next && ALLOWED_UID && next.uid !== ALLOWED_UID) {
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
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      signIn: async () => {
        const auth = getFirebaseAuth();
        setError(null);
        const provider = new GoogleAuthProvider();
        try {
          const result = await signInWithPopup(auth, provider);
          if (ALLOWED_UID && result.user.uid !== ALLOWED_UID) {
            await fbSignOut(auth);
            setUser(null);
            setError('unauthorized');
          }
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, provider);
            return;
          }
          if (
            code !== 'auth/popup-closed-by-user' &&
            code !== 'auth/cancelled-popup-request'
          ) {
            setError((err as Error).message || 'sign-in failed');
          }
        }
      },
      signOut: async () => {
        await fbSignOut(getFirebaseAuth());
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
