import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import { ALLOWED_UID, auth } from './firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      if (next && ALLOWED_UID && next.uid !== ALLOWED_UID) {
        // Not the allowlisted user — sign them out immediately.
        try {
          await fbSignOut(auth);
        } catch {
          // ignore
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
          if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
            setError((err as Error).message || 'sign-in failed');
          }
        }
      },
      signOut: async () => {
        await fbSignOut(auth);
        setUser(null);
      },
    }),
    [user, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
