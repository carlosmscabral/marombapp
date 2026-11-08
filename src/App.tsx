/**
 * Root composition component (`App`).
 * Wires authentication, global active-session state, library seeding, and route-level code splitting.
 */

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ActiveSessionProvider } from './lib/activeSession';
import { AuthProvider, useAuth } from './lib/auth';
import { seedLibraryIfEmpty } from './lib/seed';
import { InGym } from './screens/InGym';
import { Library } from './screens/Library';
import { Plan } from './screens/Plan';
import { SessionDetail } from './screens/SessionDetail';
import { SignIn } from './screens/SignIn';
import { StartWorkout } from './screens/StartWorkout';

const Analytics = lazy(() => import('./screens/Analytics'));

function RouteLoader() {
  return (
    <div className="px-4 py-12 text-center font-label text-sm text-on-surface-variant uppercase tracking-widest">
      Loading…
    </div>
  );
}

function AuthedApp() {
  useEffect(() => {
    // Seed runs once on empty projects and acts as a no-op thereafter.
    seedLibraryIfEmpty().catch((err) => {
      console.warn('Library seed skipped:', err);
    });
  }, []);

  return (
    <BrowserRouter>
      <ActiveSessionProvider>
        <Layout>
          <Suspense fallback={<RouteLoader />}>
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
          </Suspense>
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

/**
 * Mounts the authentication provider and renders either `SignIn` or the authenticated app shell.
 */
export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
