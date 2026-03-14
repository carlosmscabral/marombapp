import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, Dumbbell, Library, BarChart2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export function TopAppBar({ title, rightContent }: { title: string, rightContent?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant/15 px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Dumbbell className="text-primary w-6 h-6" />
        <h1 className="font-headline text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {rightContent || (
        <button className="text-label-md font-medium px-3 py-1 rounded-lg bg-surface-container-highest text-primary text-xs tracking-widest uppercase">
          EN/PT
        </button>
      )}
    </header>
  );
}

export function BottomNavBar() {
  const location = useLocation();
  
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
            <Icon className={cn("w-6 h-6", isActive && "fill-primary/20")} />
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
  return (
    <div className="flex flex-col min-h-screen">
      <TopAppBar title={title} rightContent={rightContent} />
      <main className="flex-1 pb-24">
        {children}
      </main>
      <BottomNavBar />
    </div>
  );
}
