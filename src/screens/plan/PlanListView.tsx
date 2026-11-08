/**
 * Training plan list view (`PlanListView`).
 * Creates plans, toggles the active plan, renames plans inline, and archives unused plans.
 */

import { useEffect, useState } from 'react';
import { MoreVertical, Plus } from 'lucide-react';
import { cn, SignatureBar } from '../../components/Layout';
import {
  archivePlan,
  createPlan,
  renamePlan,
  setActivePlan,
  subscribePlanDays,
} from '../../lib/db';
import type { Plan } from '../../types';

export interface PlanListViewProps {
  plans: Plan[];
  onOpen: (id: string) => void;
}

/**
 * Renders the list of non-archived training plans and the inline creation row.
 */
export function PlanListView({ plans, onOpen }: PlanListViewProps) {
  const visiblePlans = plans.filter((p) => p.archivedAt == null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      setNewName('');
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
          Your Plans
        </p>
        <h2 className="font-headline text-3xl font-bold tracking-tight">
          Training Plans
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
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            placeholder="Plan name (e.g. PPL)"
            className="flex-1 bg-surface-container-highest/40 rounded-lg px-3 py-2 text-on-surface outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => void submitCreate()}
            className="px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium"
          >
            Create
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create plan
        </button>
      )}

      {visiblePlans.length === 0 && !creating && (
        <div className="bg-surface-container-low rounded-xl p-8 text-center border border-dashed border-outline-variant/30">
          <p className="text-on-surface-variant text-sm">
            You don't have any plans yet.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-2 bg-primary text-on-primary font-headline font-medium px-5 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Create your first plan
          </button>
        </div>
      )}

      <div className="space-y-3">
        {visiblePlans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} onOpen={() => onOpen(plan.id)} />
        ))}
      </div>
    </div>
  );
}

function PlanRow({ plan, onOpen }: { plan: Plan; onOpen: () => void }) {
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(plan.name);

  useEffect(() => {
    return subscribePlanDays(plan.id, (days) => setDayCount(days.length));
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
                Active
              </span>
            )}
          </div>
          <p className="text-on-surface-variant text-xs mt-0.5">
            {dayCount == null
              ? '…'
              : `${dayCount} ${dayCount === 1 ? 'day' : 'days'}`}
          </p>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="w-9 h-9 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
            aria-label="More"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              />
              <div className="absolute right-0 top-10 z-20 w-44 bg-surface-container-high rounded-lg shadow-lg overflow-hidden border border-outline-variant/15">
                {!plan.active && (
                  <MenuItem
                    label="Set Active"
                    onClick={async () => {
                      setMenuOpen(false);
                      await setActivePlan(plan.id).catch(() => {});
                    }}
                  />
                )}
                <MenuItem
                  label="Rename"
                  onClick={() => {
                    setMenuOpen(false);
                    setRenameValue(plan.name);
                    setRenaming(true);
                  }}
                />
                <MenuItem
                  label="Archive"
                  variant="danger"
                  onClick={async () => {
                    setMenuOpen(false);
                    await archivePlan(plan.id).catch(() => {});
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
        'w-full text-left px-3 py-2 text-sm hover:bg-surface-container-highest transition-colors',
        variant === 'danger' ? 'text-secondary' : 'text-on-surface',
      )}
    >
      {label}
    </button>
  );
}
