import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Analytics } from './screens/Analytics';
import { Plan } from './screens/Plan';
import { Library } from './screens/Library';
import { InGym } from './screens/InGym';
import { StartWorkout } from './screens/StartWorkout';
import { SessionDetail } from './screens/SessionDetail';
import { SignIn } from './screens/SignIn';
import { AuthProvider, useAuth } from './lib/auth';
import { seedLibraryIfEmpty } from './lib/seed';
import { subscribeActiveSession } from './lib/db';
import type { Session } from './types';

// ---------- Active session context ----------------------------------------

interface ActiveSessionContextValue {
  activeSession: Session | null;
  loading: boolean;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  activeSession: null,
  loading: true,
});

export function useActiveSession(): ActiveSessionContextValue {
  return useContext(ActiveSessionContext);
}

function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeActiveSession((s) => {
      setActiveSession(s);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <ActiveSessionContext.Provider value={{ activeSession, loading }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

// ---------- Authed app shell ----------------------------------------------

function AuthedApp() {
  useEffect(() => {
    // Fire-and-forget; safe to call on every mount because it's a no-op
    // when the library already has entries.
    seedLibraryIfEmpty().catch((err) => {
      console.warn('Library seed skipped:', err);
    });
  }, []);

  return (
    <BrowserRouter>
      <ActiveSessionProvider>
        <Layout>
          <Routes>
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/library" element={<Library />} />
            <Route path="/in-gym" element={<InGym />} />
            <Route path="/start" element={<StartWorkout />} />
            <Route path="/sessions/:sessionId" element={<SessionDetail />} />
            <Route path="/" element={<Navigate to="/analytics" replace />} />
            <Route path="*" element={<Navigate to="/analytics" replace />} />
          </Routes>
        </Layout>
      </ActiveSessionProvider>
    </BrowserRouter>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant">
        <span className="font-label text-sm tracking-widest uppercase">Loading…</span>
      </div>
    );
  }
  if (!user) return <SignIn />;
  return <AuthedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
