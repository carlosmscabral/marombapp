import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Calendar, Dumbbell, Library, BarChart2, LogOut } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../lib/auth';
import { useActiveSession } from '../App';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function SignatureBar({ className }: { className?: string }) {
  return (
    <div className={cn("signature-bar", className)}>
      <div className="bar-blue"></div>
      <div className="bar-red"></div>
      <div className="bar-yellow"></div>
      <div className="bar-green"></div>
    </div>
  );
}

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const initials = initialsFor(user?.displayName, user?.email);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="w-9 h-9 rounded-full bg-primary/15 text-primary font-label font-semibold text-xs flex items-center justify-center tracking-wider hover:bg-primary/25 transition-colors"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-48 bg-surface-container-high border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden z-50">
          {user?.email && (
            <div className="px-3 py-2 border-b border-outline-variant/15">
              <p className="font-body text-xs text-on-surface-variant truncate">
                {user.email}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-body text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopAppBar({ title, rightContent }: { title: string, rightContent?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant/15 px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Dumbbell className="text-primary w-6 h-6" />
        <h1 className="font-headline text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {rightContent || <AccountMenu />}
    </header>
  );
}

function ActiveSessionBanner() {
  return (
    <Link
      to="/in-gym"
      className="fixed left-0 right-0 z-40 flex items-center justify-center gap-2 px-4 py-2 bg-error/15 text-error border-t border-error/30 font-label text-xs tracking-widest uppercase active:bg-error/25 transition-colors"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.75rem)' }}
    >
      <span className="relative flex w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-error opacity-75 animate-ping"></span>
        <span className="relative inline-flex w-2 h-2 rounded-full bg-error"></span>
      </span>
      Active session — tap to resume
    </Link>
  );
}

export function BottomNavBar() {
  const location = useLocation();
  const { activeSession } = useActiveSession();
  const hasActive = Boolean(activeSession);

  const navItems = [
    { path: '/plan', icon: Calendar, label: 'Plan' },
    { path: '/in-gym', icon: Dumbbell, label: 'In-Gym' },
    { path: '/library', icon: Library, label: 'Library' },
    { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-container-low border-t border-outline-variant/10 px-6 py-3 flex justify-between items-center z-50 pb-safe">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path || (location.pathname === '/' && item.path === '/analytics');
        const Icon = item.icon;
        const showDot = hasActive && item.path === '/in-gym';

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 group relative",
              isActive ? "text-primary" : "text-outline hover:text-primary transition-colors"
            )}
          >
            {isActive && (
              <div className="absolute -top-3 w-8 h-1 bg-primary rounded-full"></div>
            )}
            <div className="relative">
              <Icon className={cn("w-6 h-6", isActive && "fill-primary/20")} />
              {showDot && (
                <span className="absolute -top-1 -right-1 flex w-2.5 h-2.5">
                  <span className="absolute inset-0 rounded-full bg-error opacity-75 animate-ping"></span>
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-error border border-surface-container-low"></span>
                </span>
              )}
            </div>
            <span className={cn(
              "text-[10px] font-label uppercase tracking-widest",
              isActive ? "font-bold" : "font-medium"
            )}>
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Layout({ children, title = "MarombApp", rightContent }: { children: ReactNode, title?: string, rightContent?: ReactNode }) {
  const location = useLocation();
  const { activeSession } = useActiveSession();
  const showBanner = Boolean(activeSession) && location.pathname !== '/in-gym';

  return (
    <div className="flex flex-col min-h-screen">
      <TopAppBar title={title} rightContent={rightContent} />
      <main className={cn("flex-1", showBanner ? "pb-32" : "pb-24")}>
        {children}
      </main>
      {showBanner && <ActiveSessionBanner />}
      <BottomNavBar />
    </div>
  );
}
