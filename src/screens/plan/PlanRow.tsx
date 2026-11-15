/**
 * Individual training plan card (`PlanRow`) inside `PlanListView`.
 * Handles live day-count subscription, inline plan renaming, and the overflow menu for activating, archiving, or deleting a plan.
 */

import { useEffect, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn, SignatureBar } from '../../components/Layout';
import {
  archivePlan,
  deletePlan,
  renamePlan,
  setActivePlan,
  subscribePlanDays,
} from '../../lib/db';
import { PT_BR } from '../../lib/i18n/pt-BR';
import type { Plan } from '../../types';

export interface PlanRowProps {
  plan: Plan;
  knownPlans: readonly Pick<Plan, 'id' | 'active'>[];
  onOpen: () => void;
  onActivate: () => void;
  onDeleted: () => void;
}

/**
 * Renders one plan row with active badge, day count, inline rename input, and action menu.
 */
export function PlanRow({
  plan,
  knownPlans,
  onOpen,
  onActivate,
  onDeleted,
}: PlanRowProps) {
  const [dayIds, setDayIds] = useState<string[] | null>(null);
  const dayCount = dayIds?.length ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(plan.name);

  useEffect(() => {
    return subscribePlanDays(plan.id, (days) => setDayIds(days.map((d) => d.id)));
  }, [plan.id]);

  const submitRename = async () => {
    const next = renameValue.trim();
    if (next && next !== plan.name) {
      await renamePlan(plan.id, next).catch(() => {});
    }
    setRenaming(false);
  };

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden border-l-2 border-primary/40">
      <SignatureBar />
      <div className="p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 text-left min-w-0"
          disabled={renaming}
        >
          <div className="flex items-center gap-2">
            {renaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => void submitRename()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitRename();
                  if (e.key === 'Escape') {
                    setRenaming(false);
                    setRenameValue(plan.name);
                  }
                }}
                className="font-headline text-lg font-semibold bg-surface-container-highest/40 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/40"
              />
            ) : (
              <h3 className="font-headline text-lg font-semibold truncate">
                {plan.name}
              </h3>
            )}
            {plan.active && (
              <span className="bg-primary/15 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                {PT_BR.plan.activeBadge}
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-xs mt-0.5">
            {dayCount == null ? '…' : PT_BR.common.dayCount(dayCount)}
          </p>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="w-11 h-11 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
            aria-label={PT_BR.plan.moreMenu}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
                aria-label={PT_BR.plan.closeMenu}
              />
              <div className="absolute right-0 top-12 z-20 w-44 bg-surface-container-high rounded-lg shadow-lg overflow-hidden border border-outline-variant/15">
                {!plan.active && (
                  <MenuItem
                    label={PT_BR.plan.setActive}
                    onClick={() => {
                      setMenuOpen(false);
                      onActivate();
                      void setActivePlan(plan.id, knownPlans).catch(() => {});
                    }}
                  />
                )}
                <MenuItem
                  label={PT_BR.plan.rename}
                  onClick={() => {
                    setMenuOpen(false);
                    setRenameValue(plan.name);
                    setRenaming(true);
                  }}
                />
                <MenuItem
                  label={PT_BR.plan.archive}
                  onClick={async () => {
                    setMenuOpen(false);
                    await archivePlan(plan.id).catch(() => {});
                  }}
                />
                <MenuItem
                  label={PT_BR.common.delete}
                  variant="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    if (!confirm(PT_BR.plan.confirmDeletePlan(plan.name))) {
                      return;
                    }
                    onDeleted();
                    void deletePlan(plan.id, dayIds ?? []).catch(() => {});
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  variant,
}: {
  label: string;
  onClick: () => void;
  variant?: 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full min-h-11 text-left px-3 py-2.5 text-sm hover:bg-surface-container-highest transition-colors flex items-center',
        variant === 'danger' ? 'text-secondary font-medium' : 'text-on-surface',
      )}
    >
      {label}
    </button>
  );
}
