/**
 * Exercise encyclopedia screen (`/library`).
 * Searches and filters seeded and custom exercises and delegates detail/form sheets.
 */

import { useEffect, useMemo, useState } from 'react';
import { Dumbbell as DumbbellIcon, Plus, Search } from 'lucide-react';
import { cn } from '../components/Layout';
import { subscribeLibrary } from '../lib/db';
import { cap } from '../lib/format';
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '../types';
import { ExerciseDetailSheet } from './library/ExerciseDetailSheet';
import { ExerciseFormSheet } from './library/ExerciseFormSheet';

/**
 * Renders the searchable exercise grid, muscle filter bar, detail modal, and custom form sheet.
 */
export function Library() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<'all' | MuscleGroup>('all');

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    return subscribeLibrary((items) => {
      setExercises(items);
      setLoaded(true);
    });
  }, []);

  const detail = useMemo(
    () => exercises.find((e) => e.id === detailId) ?? null,
    [exercises, detailId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (muscle !== 'all' && ex.primaryMuscle !== muscle) return false;
      if (!q) return true;
      return (
        ex.name.toLowerCase().includes(q) ||
        ex.primaryMuscle.toLowerCase().includes(q) ||
        (ex.subMuscle?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [exercises, search, muscle]);

  return (
    <div className="flex-1 pb-24">
      <section className="px-4 pt-8 pb-4">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="text-primary font-label text-xs uppercase tracking-[0.3em]">
              Encyclopedia
            </span>
            <h2 className="font-headline text-4xl font-bold mt-1">Library</h2>
            <p className="text-on-surface-variant text-sm mt-1 font-body">
              {loaded
                ? `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} available`
                : 'Loading…'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingExercise(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary font-label text-xs uppercase tracking-widest font-semibold hover:bg-primary-dim transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="text-outline w-5 h-5" />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-low border-2 border-transparent focus:border-primary focus:outline-none rounded-xl py-3.5 pl-12 pr-4 transition-all text-on-surface placeholder:text-outline/60 font-body"
            placeholder="Search exercises or muscles…"
            type="text"
          />
        </div>
      </section>

      <section className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <FilterChip
            label="All"
            active={muscle === 'all'}
            onClick={() => setMuscle('all')}
          />
          {MUSCLE_GROUPS.map((m) => (
            <FilterChip
              key={m}
              label={cap(m)}
              active={muscle === m}
              onClick={() => setMuscle(m)}
            />
          ))}
        </div>
      </section>

      <div className="px-4">
        {loaded && filtered.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl border-t-4 border-outline-variant/30 p-8 text-center">
            <DumbbellIcon className="w-10 h-10 mx-auto text-outline mb-3" />
            <p className="font-headline text-lg text-on-surface">No exercises match</p>
            <p className="text-on-surface-variant text-sm mt-1 font-body">
              Try a different filter or add a custom exercise.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((ex) => (
              <LibraryCard key={ex.id} ex={ex} onClick={() => setDetailId(ex.id)} />
            ))}
          </div>
        )}
      </div>

      {detail && (
        <ExerciseDetailSheet
          exercise={detail}
          onClose={() => setDetailId(null)}
          onEdit={(ex) => {
            setEditingExercise(ex);
            setDetailId(null);
            setFormOpen(true);
          }}
        />
      )}

      {formOpen && (
        <ExerciseFormSheet
          editingExercise={editingExercise}
          onClose={() => {
            setFormOpen(false);
            setEditingExercise(null);
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-shrink-0 rounded-full font-label transition-colors border px-4 py-1.5 text-sm',
        active
          ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
          : 'bg-surface-container-high border-transparent text-on-surface-variant hover:text-on-surface',
      )}
    >
      {label}
    </button>
  );
}

function LibraryCard({ ex, onClick }: { ex: Exercise; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface-container-low rounded-xl border-t-4 border-primary/60 p-3 hover:bg-surface-container transition-colors flex flex-col gap-2 min-h-[120px]"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-headline font-semibold text-on-surface text-sm leading-tight line-clamp-2">
          {ex.name}
        </h4>
        {ex.isCustom && (
          <span className="shrink-0 text-[9px] font-label uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-tertiary-fixed/20 text-tertiary-fixed">
            Custom
          </span>
        )}
      </div>
      <div className="mt-auto">
        <p className="text-xs text-on-surface-variant font-body">
          {cap(ex.primaryMuscle)}
          {ex.subMuscle ? ` · ${ex.subMuscle}` : ''}
        </p>
      </div>
    </button>
  );
}
