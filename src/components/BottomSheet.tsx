/**
 * Reusable modal bottom sheet component.
 * Locks background document scrolling and closes on backdrop click or Escape key press.
 */

import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { SignatureBar } from './Layout';

export interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Renders a mobile-friendly bottom sheet dialog with backdrop blur and safe-area padding.
 */
export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md bg-surface-container-low rounded-t-2xl border-t border-outline-variant/20 max-h-[90vh] flex flex-col animate-[slideUp_0.2s_ease-out]">
        <SignatureBar />
        <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/15">
          <h3 className="font-headline text-lg font-semibold text-on-surface">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 py-4 overflow-y-auto pb-[env(safe-area-inset-bottom,1rem)]">
          {children}
        </div>
      </div>
    </div>
  );
}
