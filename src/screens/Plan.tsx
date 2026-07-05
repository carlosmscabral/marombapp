import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  MoreVertical,
  Play,
  Plus,
} from 'lucide-react';
import type { Exercise, Plan as PlanT, PlanDay as PlanDayT } from '../types';
import {
  addPlanDay,
  archivePlan,
  createPlan,
  debounce,
  renamePlan,
  reorderPlanDays,
  setActivePlan,
  subscribeAllPlans,
  subscribeLibrary,
  subscribePlanDays,
} from '../lib/db';
import { cn, SignatureBar } from '../components/Layout';
import { PlanDay } from './PlanDay';

export function Plan() {
  const [plans, setPlans] = useState<PlanT[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  useEffect(() => subscribeAllPlans(setPlans), []);
  useEffect(() => subscribeLibrary(setLibrary), []);

  // If selected plan disappears (e.g. archived), bounce back to list.
  useEffect(() => {
    if (!selectedPlanId) return;
    if (!plans.some((p) => p.id === selectedPlanId && p.archivedAt == null)) {
      setSelectedPlanId(null);
      setSelectedDayId(null);
    }
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  // Plan detail
  if (selectedPlan) {
    return (
      <PlanDetailView
        plan={selectedPlan}
        library={library}
        selectedDayId={selectedDayId}
        onSelectDay={setSelectedDayId}
        onBack={() => {
          setSelectedPlanId(null);
          setSelectedDayId(null);
        }}
      />
    );
  }

  // Plan list
  return <PlanListView plans={plans} onOpen={setSelectedPlanId} />;
}

// ============================================================
// Plan list view
// ============================================================

function PlanListView({
  plans,
  onOpen,
}: {
  plans: PlanT[];
  onOpen: (id: string) => void;
}) {
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
    // Auto-set as active if it's the first plan.
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

      {/* Create row */}
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
            onClick={submitCreate}
            className="px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium"
          >
            Create
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create plan
        </button>
      )}

      {/* Empty state */}
      {visiblePlans.length === 0 && !creating && (
        <div className="bg-surface-container-low rounded-xl p-8 text-center border border-dashed border-outline-variant/30">
          <p className="text-on-surface-variant text-sm">
            You don't have any plans yet.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex items-center gap-2 bg-primary text-on-primary font-headline font-medium px-5 py-2.5 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Create your first plan
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {visiblePlans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} onOpen={() => onOpen(plan.id)} />
        ))}
      </div>
    </div>
  );
}

function PlanRow({ plan, onOpen }: { plan: PlanT; onOpen: () => void }) {
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
                onBlur={submitRename}
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

// ============================================================
// Plan detail view
// ============================================================

function PlanDetailView({
  plan,
  library,
  selectedDayId,
  onSelectDay,
  onBack,
}: {
  plan: PlanT;
  library: Exercise[];
  selectedDayId: string | null;
  onSelectDay: (id: string | null) => void;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const [days, setDays] = useState<PlanDayT[]>([]);
  const [name, setName] = useState(plan.name);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayName, setNewDayName] = useState('');

  useEffect(() => subscribePlanDays(plan.id, setDays), [plan.id]);

  // Pull plan.name updates from snapshot
  useEffect(() => {
    setName(plan.name);
  }, [plan.name, plan.id]);

  const debouncedRename = useMemo(
    () =>
      debounce((next: string) => {
        const trimmed = next.trim();
        if (!trimmed || trimmed === plan.name) return;
        renamePlan(plan.id, trimmed).catch(() => {});
      }, 250),
    [plan.id, plan.name],
  );

  // If we're showing a sub-view (single day), render it
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;
  if (selectedDay) {
    return (
      <PlanDay
        planId={plan.id}
        day={selectedDay}
        library={library}
        onBack={() => onSelectDay(null)}
      />
    );
  }

  const moveDay = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= days.length) return;
    const orderedIds = days.map((d) => d.id);
    [orderedIds[idx], orderedIds[target]] = [
      orderedIds[target],
      orderedIds[idx],
    ];
    await reorderPlanDays(plan.id, orderedIds).catch(() => {});
  };

  const submitAddDay = async () => {
    const dayName = newDayName.trim();
    if (!dayName) {
      setAddingDay(false);
      setNewDayName('');
      return;
    }
    const id = await addPlanDay(plan.id, dayName);
    setNewDayName('');
    setAddingDay(false);
    onSelectDay(id);
  };

  return (
    <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          aria-label="Back to plans"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-primary font-label text-xs tracking-[0.2em] uppercase">
            Plan
          </p>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              debouncedRename(e.target.value);
            }}
            onBlur={() => debouncedRename.flush()}
            className="w-full bg-transparent font-headline text-2xl font-bold tracking-tight text-on-surface outline-none focus:bg-surface-container-low rounded-lg px-1 -mx-1"
            placeholder="Plan name"
          />
        </div>
      </div>

      {/* Active toggle */}
      <button
        onClick={async () => {
          if (plan.active) return;
          await setActivePlan(plan.id).catch(() => {});
        }}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors',
          plan.active
            ? 'bg-primary/10 border-primary/30 text-primary cursor-default'
            : 'bg-surface-container-low border-outline-variant/20 text-on-surface hover:bg-surface-container-high',
        )}
      >
        <span className="flex items-center gap-2">
          {plan.active ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
          <span className="font-headline text-sm font-medium">
            {plan.active ? 'Active plan' : 'Set as active plan'}
          </span>
        </span>
      </button>

      {/* Days */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-headline text-lg font-semibold">Training Days</h3>
          <span className="text-on-surface-variant text-xs">
            {days.length} {days.length === 1 ? 'day' : 'days'}
          </span>
        </div>

        {days.length === 0 && !addingDay && (
          <div className="bg-surface-container-low rounded-xl p-6 text-center border border-dashed border-outline-variant/30">
            <p className="text-on-surface-variant text-sm">
              No training days yet. Add one to get started.
            </p>
          </div>
        )}

        {days.map((d, idx) => (
          <DayRow
            key={d.id}
            day={d}
            isFirst={idx === 0}
            isLast={idx === days.length - 1}
            onMoveUp={() => moveDay(idx, -1)}
            onMoveDown={() => moveDay(idx, 1)}
            onOpen={() => onSelectDay(d.id)}
          />
        ))}

        {addingDay ? (
          <div className="bg-surface-container-low rounded-xl p-3 flex items-center gap-2">
            <input
              autoFocus
              value={newDayName}
              onChange={(e) => setNewDayName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitAddDay();
                if (e.key === 'Escape') {
                  setAddingDay(false);
                  setNewDayName('');
                }
              }}
              placeholder="Day name (e.g. Push 1)"
              className="flex-1 bg-surface-container-highest/40 rounded-lg px-3 py-2 text-on-surface outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              onClick={submitAddDay}
              className="px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingDay(true)}
            className="w-full flex items-center justify-center gap-2 bg-surface-container-highest text-primary font-headline font-medium px-6 py-3 rounded-xl border border-primary/20 hover:bg-surface-bright transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Day
          </button>
        )}
      </section>

      {/* Start workout FAB — only for active plan */}
      {plan.active && days.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => navigate('/start')}
            className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary-fixed font-headline font-semibold px-6 py-3 rounded-full shadow-[0_16px_32px_rgba(106,178,255,0.15)] ring-4 ring-background"
          >
            <Play className="w-5 h-5 fill-on-primary-fixed" />
            Start Workout
          </button>
        </div>
      )}
    </div>
  );
}

function DayRow({
  day,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onOpen,
}: {
  day: PlanDayT;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden border-l-2 border-primary/40">
      <SignatureBar />
      <div className="p-4 flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Move up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Move down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <h4 className="font-headline text-lg font-semibold truncate">
            {day.name}
          </h4>
          <p className="text-on-surface-variant text-xs">
            {day.exercises.length}{' '}
            {day.exercises.length === 1 ? 'exercise' : 'exercises'}
          </p>
        </button>
      </div>
    </div>
  );
}
