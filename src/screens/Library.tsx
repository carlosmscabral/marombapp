import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  X,
  Edit3,
  Trash2,
  Dumbbell as DumbbellIcon,
  AlertTriangle,
} from 'lucide-react';
import { cn, SignatureBar } from '../components/Layout';
import {
  subscribeLibrary,
  createExercise,
  updateExercise,
  deleteExercise,
} from '../lib/db';
import {
  MUSCLE_GROUPS,
  SUB_MUSCLES,
  type Exercise,
  type MuscleGroup,
} from '../types';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type FormState = {
  name: string;
  primaryMuscle: MuscleGroup;
  subMuscle: string;
  notes: string;
};

const blankForm: FormState = {
  name: '',
  primaryMuscle: 'chest',
  subMuscle: '',
  notes: '',
};

export function Library() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<'all' | MuscleGroup>('all');

  // Modal state: form (create/edit) or detail (view)
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const unsub = subscribeLibrary((items) => {
      setExercises(items);
      setLoaded(true);
    });
    return unsub;
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

  function openCreate() {
    setEditingId(null);
    setForm(blankForm);
    setFormOpen(true);
  }

  function openEdit(ex: Exercise) {
    setEditingId(ex.id);
    setForm({
      name: ex.name,
      primaryMuscle: ex.primaryMuscle,
      subMuscle: ex.subMuscle ?? '',
      notes: ex.notes ?? '',
    });
    setDetailId(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(blankForm);
    setSaveError(null);
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Firestore rejects `undefined` field values, so omit subMuscle when empty.
      const payload: Omit<Exercise, 'id' | 'isCustom'> = {
        name,
        primaryMuscle: form.primaryMuscle,
        notes: form.notes,
      };
      if (form.subMuscle) payload.subMuscle = form.subMuscle;
      if (editingId) {
        await updateExercise(editingId, payload);
      } else {
        await createExercise(payload);
      }
      closeForm();
    } catch (err) {
      console.error('Save exercise failed', err);
      setSaveError((err as Error)?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    await deleteExercise(detail.id);
    setConfirmDelete(false);
    setDetailId(null);
  }

  const subOptions = SUB_MUSCLES[form.primaryMuscle] ?? [];

  return (
    <div className="flex-1 pb-24">
      {/* Header */}
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
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary font-label text-xs uppercase tracking-widest font-semibold hover:bg-primary-dim transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Search */}
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

      {/* Muscle filter chips */}
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

      {/* Grid */}
      <div className="px-4">
        {loaded && filtered.length === 0 ? (
          <div className="bg-surface-container-low rounded-xl border-t-4 border-outline-variant/30 p-8 text-center">
            <DumbbellIcon className="w-10 h-10 mx-auto text-outline mb-3" />
            <p className="font-headline text-lg text-on-surface">
              No exercises match
            </p>
            <p className="text-on-surface-variant text-sm mt-1 font-body">
              Try a different filter or add a custom exercise.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((ex) => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                onClick={() => setDetailId(ex.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      {detail && (
        <BottomSheet onClose={() => setDetailId(null)} title="Exercise">
          <div className="space-y-4">
            <div>
              <h3 className="font-headline text-2xl font-semibold text-on-surface">
                {detail.name}
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Tag color="primary">{cap(detail.primaryMuscle)}</Tag>
                {detail.subMuscle && <Tag>{detail.subMuscle}</Tag>}
                {detail.isCustom && <Tag color="tertiary">Custom</Tag>}
              </div>
            </div>

            <Field label="Primary muscle" value={cap(detail.primaryMuscle)} />
            {detail.subMuscle && (
              <Field label="Sub-muscle" value={detail.subMuscle} />
            )}
            <Field label="Notes" value={detail.notes || '—'} multiline />

            {detail.isCustom && (
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => openEdit(detail)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-semibold hover:bg-surface-container-highest transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-secondary/15 text-secondary border border-secondary/30 font-label text-xs uppercase tracking-widest font-semibold hover:bg-secondary/25 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}

            {confirmDelete && (
              <div className="mt-2 p-3 rounded-xl bg-secondary-container/20 border border-secondary/30">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                  <p className="text-sm text-on-surface font-body">
                    Delete <span className="font-semibold">{detail.name}</span>?
                    This cannot be undone.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary text-on-secondary font-label text-xs uppercase tracking-widest font-semibold"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        </BottomSheet>
      )}

      {/* Create/Edit form sheet */}
      {formOpen && (
        <BottomSheet
          onClose={closeForm}
          title={editingId ? 'Edit exercise' : 'New exercise'}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="space-y-4"
          >
            <FormRow label="Name" required>
              <input
                type="text"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Incline Dumbbell Press"
                className="w-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:outline-none rounded-lg px-3 py-2.5 text-on-surface placeholder:text-outline/50 font-body"
              />
            </FormRow>

            <FormRow label="Primary muscle" required>
              <select
                value={form.primaryMuscle}
                onChange={(e) =>
                  setForm({
                    ...form,
                    primaryMuscle: e.target.value as MuscleGroup,
                    subMuscle: '',
                  })
                }
                className="w-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:outline-none rounded-lg px-3 py-2.5 text-on-surface font-body"
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {cap(m)}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Sub-muscle">
              <select
                value={form.subMuscle}
                onChange={(e) => setForm({ ...form, subMuscle: e.target.value })}
                className="w-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:outline-none rounded-lg px-3 py-2.5 text-on-surface font-body"
              >
                <option value="">— None —</option>
                {subOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Notes">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Cues, tempo, setup…"
                className="w-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:outline-none rounded-lg px-3 py-2.5 text-on-surface placeholder:text-outline/50 font-body resize-none"
              />
            </FormRow>

            {saveError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary text-sm font-body">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-words">{saveError}</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 px-3 py-3 rounded-xl bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="flex-1 px-3 py-3 rounded-xl bg-primary text-on-primary font-label text-xs uppercase tracking-widest font-semibold hover:bg-primary-dim transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </BottomSheet>
      )}
    </div>
  );
}

// ----- Small UI building blocks -----

function FilterChip({
  label,
  active,
  onClick,
  size = 'md',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  size?: 'md' | 'sm';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-shrink-0 rounded-full font-label transition-colors border',
        size === 'md' ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs',
        active
          ? 'bg-primary/15 border-primary/40 text-primary font-semibold'
          : 'bg-surface-container-high border-transparent text-on-surface-variant hover:text-on-surface',
      )}
    >
      {label}
    </button>
  );
}

function ExerciseCard({ ex, onClick }: { ex: Exercise; onClick: () => void }) {
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

function Tag({
  children,
  color = 'neutral',
}: {
  children: React.ReactNode;
  color?: 'neutral' | 'primary' | 'tertiary';
}) {
  return (
    <span
      className={cn(
        'text-[10px] font-label uppercase tracking-widest font-bold px-2 py-0.5 rounded',
        color === 'primary' && 'bg-primary/15 text-primary',
        color === 'tertiary' && 'bg-tertiary-fixed/20 text-tertiary-fixed',
        color === 'neutral' &&
          'bg-surface-container-highest text-on-surface-variant',
      )}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <span className="font-label uppercase tracking-widest text-xs text-on-surface-variant">
        {label}
      </span>
      <p
        className={cn(
          'mt-1 text-on-surface font-body text-sm',
          multiline && 'whitespace-pre-wrap',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-label uppercase tracking-widest text-xs text-on-surface-variant block mb-1.5">
        {label}
        {required && <span className="text-secondary ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function BottomSheet({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
          <h3 className="font-headline text-lg font-semibold text-on-surface">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
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
