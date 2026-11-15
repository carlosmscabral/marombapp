/**
 * Create and edit bottom-sheet form for custom library exercises.
 * Validates required fields and omits empty optional `subMuscle` keys before writing to Firestore.
 */

import { type ReactNode, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { createExercise, updateExercise } from '../../lib/db';
import { localizeFirebaseError, PT_BR, tMuscle, tSubMuscle } from '../../lib/i18n/pt-BR';
import {
  MUSCLE_GROUPS,
  SUB_MUSCLES,
  type Exercise,
  type MuscleGroup,
} from '../../types';

export interface ExerciseFormSheetProps {
  editingExercise: Exercise | null;
  onClose: () => void;
  onSaved?: (exercise: Exercise) => void;
}

/**
 * Renders a bottom-sheet form to create a custom exercise or edit an existing one.
 */
export function ExerciseFormSheet({
  editingExercise,
  onClose,
  onSaved,
}: ExerciseFormSheetProps) {
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
        onSaved?.({
          id: editingExercise.id,
          ...payload,
          isCustom: editingExercise.isCustom,
        });
      } else {
        const id = await createExercise(payload);
        onSaved?.({ id, ...payload, isCustom: true });
      }
      onClose();
    } catch (err) {
      console.error('Save exercise failed', err);
      setSaveError(localizeFirebaseError(err, PT_BR.library.saveFailed));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      onClose={onClose}
      title={
        editingExercise
          ? PT_BR.library.editExerciseTitle
          : PT_BR.library.newExerciseTitle
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="space-y-4"
      >
        <FormRow label={PT_BR.library.nameLabel} required>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={PT_BR.library.namePlaceholder}
            className="w-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:outline-none rounded-lg px-3 py-2.5 text-on-surface placeholder:text-outline/50 font-body"
          />
        </FormRow>

        <FormRow label={PT_BR.library.primaryMuscle} required>
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
                {tMuscle(m)}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label={PT_BR.library.subMuscle}>
          <select
            value={subMuscle}
            onChange={(e) => setSubMuscle(e.target.value)}
            className="w-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:outline-none rounded-lg px-3 py-2.5 text-on-surface font-body"
          >
            <option value="">{PT_BR.common.noneOption}</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>
                {tSubMuscle(s)}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label={PT_BR.library.notes}>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={PT_BR.library.notesPlaceholder}
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
            {PT_BR.common.cancel}
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="flex-1 px-3 py-3 rounded-xl bg-primary text-on-primary font-label text-xs uppercase tracking-widest font-semibold hover:bg-primary-dim transition-colors disabled:opacity-50"
          >
            {saving
              ? PT_BR.common.saving
              : editingExercise
                ? PT_BR.common.save
                : PT_BR.common.create}
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
