/**
 * Create and edit bottom-sheet form for custom library exercises.
 * Validates required fields and omits empty optional `subMuscle` keys before writing to Firestore.
 */

import { type ReactNode, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { createExercise, updateExercise } from '../../lib/db';
import { cap } from '../../lib/format';
import {
  MUSCLE_GROUPS,
  SUB_MUSCLES,
  type Exercise,
  type MuscleGroup,
} from '../../types';

export interface ExerciseFormSheetProps {
  editingExercise: Exercise | null;
  onClose: () => void;
}

/**
 * Renders a bottom-sheet form to create a custom exercise or edit an existing one.
 */
export function ExerciseFormSheet({ editingExercise, onClose }: ExerciseFormSheetProps) {
  const [name, setName] = useState(editingExercise?.name ?? '');
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>(
    editingExercise?.primaryMuscle ?? 'chest',
  );
  const [subMuscle, setSubMuscle] = useState(editingExercise?.subMuscle ?? '');
  const [notes, setNotes] = useState(editingExercise?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const subOptions = SUB_MUSCLES[primaryMuscle] ?? [];

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Omit<Exercise, 'id' | 'isCustom'> = {
        name: trimmed,
        primaryMuscle,
        notes,
      };
      if (subMuscle) payload.subMuscle = subMuscle;
      if (editingExercise) {
        await updateExercise(editingExercise.id, payload);
      } else {
        await createExercise(payload);
      }
      onClose();
    } catch (err) {
      console.error('Save exercise failed', err);
      setSaveError((err as Error)?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      onClose={onClose}
      title={editingExercise ? 'Edit exercise' : 'New exercise'}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Incline Dumbbell Press"
            className="w-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:outline-none rounded-lg px-3 py-2.5 text-on-surface placeholder:text-outline/50 font-body"
          />
        </FormRow>

        <FormRow label="Primary muscle" required>
          <select
            value={primaryMuscle}
            onChange={(e) => {
              setPrimaryMuscle(e.target.value as MuscleGroup);
              setSubMuscle('');
            }}
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
            value={subMuscle}
            onChange={(e) => setSubMuscle(e.target.value)}
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            onClick={onClose}
            className="flex-1 px-3 py-3 rounded-xl bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 px-3 py-3 rounded-xl bg-primary text-on-primary font-label text-xs uppercase tracking-widest font-semibold hover:bg-primary-dim transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : editingExercise ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
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
