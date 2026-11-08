/**
 * Global active workout session context.
 * Maintains a single Firestore subscription shared by the shell banner, StartWorkout, and InGym.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { subscribeActiveSession } from './db';
import type { Session } from '../types';

export interface ActiveSessionContextValue {
  activeSession: Session | null;
  loading: boolean;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  activeSession: null,
  loading: true,
});

/**
 * Subscribes once to the active session document and exposes it to all descendant screens.
 */
export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeActiveSession((s) => {
      setActiveSession(s);
      setLoading(false);
    });
  }, []);

  return (
    <ActiveSessionContext.Provider value={{ activeSession, loading }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

/**
 * Reads the current active session and initial loading flag from context.
 */
export function useActiveSession(): ActiveSessionContextValue {
  return useContext(ActiveSessionContext);
}
