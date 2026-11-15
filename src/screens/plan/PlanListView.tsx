/**
 * Training plan list view (`PlanListView`).
 * Creates plans, toggles the active plan, renames plans inline, archives plans, and deletes plans optimistically.
 */

import { useEffect, useState } from 'react';
import { MoreVertical, Plus } from 'lucide-react';
import { cn, SignatureBar } from '../../components/Layout';
import {
  archivePlan,
  createPlan,
  deletePlan,
  isPlanPendingDelete,
  renamePlan,
  setActivePlan,
  subscribePlanDays,
} from '../../lib/db';
import { PT_BR } from '../../lib/i18n/pt-BR';
import type { Plan } from '../../types';

export interface PlanListViewProps {
  plans: Plan[];
  onOpen: (id: string) => void;
}

/**
 * Renders the list of non-archived training plans and the inline creation row.
 */
export function PlanListView({ plans, onOpen }: PlanListViewProps) {
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const visiblePlans = plans.filter(
    (p) => p.archivedAt == null && !deletedIds.has(p.id) && !isPlanPendingDelete(p.id),
  );
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const cancelCreate = () => {
    setCreating(false);
    setNewName('');
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) {
      cancelCreate();
      return;
    }
    const id = await createPlan(name);
    setNewName('');
    setCreating(false);
    if (visiblePlans.length === 0) {
      await setActivePlan(id).catch(() => {});
    }
    onOpen(id);
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto w-full">
      <section className="space-y-1">
        <p className="text-primary font-label text-xs tracking-[0.2em] uppercase">
          {PT_BR.plan.kicker}
        </p>
        <h2 className="font-headline text-3xl font-bold tracking-tight">
          {PT_BR.plan.title}
        </h2>
      </section>

      {creating ? (
        <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitCreate();
              if (e.key === 'Escape') cancelCreate();
            }}
            placeholder={PT_BR.plan.namePlaceholderExample}
            className="flex-1 min-w-0 bg-surface-container-highest/40 rounded-lg px-3 py-2.5 text-on-surface outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={cancelCreate}
            className="min-h-11 px-3 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors"
          >
            {PT_BR.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submitCreate()}
            className="min-h-11 px-3.5 rounded-lg bg-primary text-on-primary text-sm font-medium"
          >
            {PT_BR.common.create}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
        >
          <Plus className="w-5 h-5" />
          {PT_BR.plan.createPlan}
        </button>
      )}

      {visiblePlans.length === 0 && !creating && (
        <div className="bg-surface-container-low rounded-xl p-8 text-center border border-dashed border-outline-variant/30">
          <p className="text-on-surface-variant text-sm">{PT_BR.plan.emptyPlans}</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-2 bg-primary text-on-primary font-headline font-medium px-5 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            {PT_BR.plan.createFirstPlan}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {visiblePlans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            onOpen={() => onOpen(plan.id)}
            onDeleted={() => setDeletedIds((prev) => new Set(prev).add(plan.id))}
          />
        ))}
      </div>
    </div>
  );
}

function PlanRow({
  plan,
  onOpen,
  onDeleted,
}: {
  plan: Plan;
  onOpen: () => void;
  onDeleted: () => void;
}) {
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
                    onClick={async () => {
                      setMenuOpen(false);
                      await setActivePlan(plan.id).catch(() => {});
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
