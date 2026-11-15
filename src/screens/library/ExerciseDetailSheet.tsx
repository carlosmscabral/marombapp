/**
 * Detail bottom sheet for inspecting, editing, or deleting an exercise in `/library`.
 * Separates read-only inspection and two-step delete confirmation from the exercise form.
 */

import { type ReactNode, useState } from 'react';
import { AlertTriangle, Edit3, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { cn } from '../../components/Layout';
import { deleteExercise } from '../../lib/db';
import { PT_BR, tExercise, tMuscle, tSubMuscle } from '../../lib/i18n/pt-BR';
import type { Exercise } from '../../types';

export interface ExerciseDetailSheetProps {
  exercise: Exercise;
  onClose: () => void;
  onEdit: (exercise: Exercise) => void;
  onDeleted?: (id: string) => void;
}

/**
 * Displays primary/sub-muscle metadata, notes, and custom-exercise edit/delete actions.
 */
export function ExerciseDetailSheet({
  exercise,
  onClose,
  onEdit,
  onDeleted,
}: ExerciseDetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    await deleteExercise(exercise.id);
    onDeleted?.(exercise.id);
    onClose();
  };

  const displayName = tExercise(exercise);

  return (
    <BottomSheet onClose={onClose} title={PT_BR.library.detailTitle}>
      <div className="space-y-4">
        <div>
          <h3 className="font-headline text-2xl font-semibold text-on-surface">
            {displayName}
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Tag color="primary">{tMuscle(exercise.primaryMuscle)}</Tag>
            {exercise.subMuscle && <Tag>{tSubMuscle(exercise.subMuscle)}</Tag>}
            {exercise.isCustom && <Tag color="tertiary">{PT_BR.library.customBadge}</Tag>}
          </div>
        </div>

        <Field
          label={PT_BR.library.primaryMuscle}
          value={tMuscle(exercise.primaryMuscle)}
        />
        {exercise.subMuscle && (
          <Field label={PT_BR.library.subMuscle} value={tSubMuscle(exercise.subMuscle)} />
        )}
        <Field label={PT_BR.library.notes} value={exercise.notes || '—'} multiline />

        {exercise.isCustom && (
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onEdit(exercise)}
              className="flex-1 min-h-11 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-semibold hover:bg-surface-container-highest transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              {PT_BR.common.edit}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex-1 min-h-11 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-secondary/15 text-secondary border border-secondary/30 font-label text-xs uppercase tracking-widest font-semibold hover:bg-secondary/25 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {PT_BR.common.delete}
            </button>
          </div>
        )}

        {confirmDelete && (
          <div className="mt-2 p-3 rounded-xl bg-secondary-container/20 border border-secondary/30">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
              <p className="text-sm text-on-surface font-body">
                {PT_BR.library.confirmDeletePrefix}
                <span className="font-semibold">{displayName}</span>
                {PT_BR.library.confirmDeleteSuffix}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 min-h-11 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface font-label text-xs uppercase tracking-widest font-semibold"
              >
                {PT_BR.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="flex-1 min-h-11 px-3 py-2 rounded-lg bg-secondary text-on-secondary font-label text-xs uppercase tracking-widest font-semibold"
              >
                {PT_BR.common.confirm}
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function Tag({
  children,
  color = 'neutral',
}: {
  children: ReactNode;
  color?: 'neutral' | 'primary' | 'tertiary';
}) {
  return (
    <span
      className={cn(
        'text-[10px] font-label uppercase tracking-widest font-bold px-2 py-0.5 rounded',
        color === 'primary' && 'bg-primary/15 text-primary',
        color === 'tertiary' && 'bg-tertiary-fixed/20 text-tertiary-fixed',
        color === 'neutral' && 'bg-surface-container-highest text-on-surface-variant',
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
