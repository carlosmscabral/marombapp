import { Dumbbell, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { SignatureBar } from '../components/Layout';

export function SignIn() {
  const { signIn, error, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background text-on-surface">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-surface-container-low rounded-2xl border border-outline-variant/15 overflow-hidden">
          <SignatureBar />
          <div className="p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <Dumbbell className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h1 className="font-headline text-3xl font-semibold tracking-tight">
                MarombApp
              </h1>
              <p className="font-body text-sm text-on-surface-variant">
                Sign in to track your training
              </p>
            </div>

            {error === 'unauthorized' && (
              <div className="w-full flex items-start gap-2 p-3 rounded-lg bg-secondary-container/20 border border-secondary/30 text-left">
                <AlertCircle className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                <p className="text-xs text-on-surface-variant">
                  This account is not authorized for MarombApp.
                </p>
              </div>
            )}

            {error && error !== 'unauthorized' && (
              <div className="w-full flex items-start gap-2 p-3 rounded-lg bg-secondary-container/20 border border-secondary/30 text-left">
                <AlertCircle className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                <p className="text-xs text-on-surface-variant">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void signIn()}
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-primary text-on-primary font-label font-semibold text-sm tracking-wide hover:bg-primary-dim transition-colors disabled:opacity-50"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
