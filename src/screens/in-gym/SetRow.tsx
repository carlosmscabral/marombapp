/**
 * Single set row logger (`SetRow`) inside an active `InGym` exercise card.
 * Debounces weight/rep keystrokes, flushes on blur, and starts the rest clock on completion.
 */

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '../../components/Layout';
import { debounce, logSet } from '../../lib/db';
import type { SessionSet } from '../../types';
import { StartRestContext } from './restStorage';

export const SET_DEBOUNCE_MS = 250;

export interface SetRowProps {
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
  set: SessionSet;
}

/**
 * Renders weight input, reps input, and 1-tap completion toggle for one workout set.
 */
export function SetRow({ sessionId, exerciseIndex, setIndex, set }: SetRowProps) {
  const startRest = useContext(StartRestContext);
  const [weight, setWeight] = useState<string>(set.weight ? String(set.weight) : '');
  const [reps, setReps] = useState<string>(set.reps ? String(set.reps) : '');

  const latestRef = useRef({ set, weight, reps });
  latestRef.current = { set, weight, reps };

  const weightFocusedRef = useRef(false);
  const repsFocusedRef = useRef(false);
  useEffect(() => {
    if (!weightFocusedRef.current) {
      setWeight(set.weight ? String(set.weight) : '');
    }
    if (!repsFocusedRef.current) {
      setReps(set.reps ? String(set.reps) : '');
    }
  }, [set.weight, set.reps]);

  const writeDebounced = useMemo(
    () =>
      debounce((nextWeight: number, nextReps: number) => {
        void logSet(sessionId, exerciseIndex, setIndex, {
          weight: nextWeight,
          reps: nextReps,
          completedAt: latestRef.current.set.completedAt,
        });
      }, SET_DEBOUNCE_MS),
    [sessionId, exerciseIndex, setIndex],
  );

  useEffect(() => () => writeDebounced.flush(), [writeDebounced]);

  const handleWeightChange = (raw: string) => {
    setWeight(raw);
    const n = Number(raw);
    writeDebounced(Number.isFinite(n) ? n : 0, Number(latestRef.current.reps) || 0);
  };

  const handleRepsChange = (raw: string) => {
    setReps(raw);
    const n = Number(raw);
    writeDebounced(Number(latestRef.current.weight) || 0, Number.isFinite(n) ? n : 0);
  };

  const toggleComplete = () => {
    writeDebounced.cancel();
    const isComplete = set.completedAt != null;
    const w = Number(latestRef.current.weight) || 0;
    const r = Number(latestRef.current.reps) || 0;
    void logSet(sessionId, exerciseIndex, setIndex, {
      weight: w,
      reps: r,
      completedAt: isComplete ? null : Date.now(),
    });
    if (!isComplete) {
      startRest();
    }
  };

  const completed = set.completedAt != null;

  return (
    <div
      className={cn(
        'grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-2 py-2 px-2 rounded-lg',
        completed
          ? 'bg-surface-container-highest/40'
          : 'bg-surface-bright/40 border border-primary/20',
      )}
    >
      <div className="text-center font-headline font-bold text-on-surface-variant">
        {setIndex + 1}
      </div>
      <input
        inputMode="decimal"
        type="number"
        step="0.5"
        value={weight}
        onChange={(e) => handleWeightChange(e.target.value)}
        onFocus={() => {
          weightFocusedRef.current = true;
        }}
        onBlur={() => {
          weightFocusedRef.current = false;
          writeDebounced.flush();
        }}
        placeholder="kg"
        className="w-full bg-surface-container-low rounded-md px-2 py-1.5 text-center font-headline text-lg font-semibold outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        inputMode="numeric"
        type="number"
        value={reps}
        onChange={(e) => handleRepsChange(e.target.value)}
        onFocus={() => {
          repsFocusedRef.current = true;
        }}
        onBlur={() => {
          repsFocusedRef.current = false;
          writeDebounced.flush();
        }}
        placeholder="reps"
        className="w-full bg-surface-container-low rounded-md px-2 py-1.5 text-center font-headline text-lg font-semibold outline-none focus:ring-2 focus:ring-primary/50"
      />
      <button
        type="button"
        onClick={toggleComplete}
        aria-label={completed ? 'Mark set incomplete' : 'Mark set complete'}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-colors mx-auto',
          completed
            ? 'bg-primary text-on-primary'
            : 'bg-surface-container-highest text-outline hover:text-primary',
        )}
      >
        {completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
      </button>
    </div>
  );
}
