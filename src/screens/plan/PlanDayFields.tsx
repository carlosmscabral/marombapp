/**
 * Focus-aware controlled inputs (`NumberField` and `NotesField`) for `PlanDay`.
 * Syncs external Firestore updates when idle without overwriting active user typing,
 * and avoids uncontrolled `defaultValue` desync when exercise cards reorder.
 */

import { useEffect, useRef, useState } from 'react';

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  min?: number;
  step?: number;
}

/**
 * Renders a labeled numeric target input that flushes pending writes on blur.
 */
export function NumberField({
  label,
  value,
  onChange,
  onBlur,
  min = 0,
  step = 1,
}: NumberFieldProps) {
  const [raw, setRaw] = useState(String(value));
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setRaw(String(value));
  }, [value]);

  return (
    <div className="bg-surface-container-highest/40 p-2 rounded-lg">
      <label className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant block mb-1">
        {label}
      </label>
      <input
        type="number"
        inputMode="numeric"
        value={raw}
        min={min}
        step={step}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          setRaw(String(value));
          onBlur();
        }}
        onChange={(e) => {
          setRaw(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
        }}
        className="w-full bg-transparent font-headline text-lg font-medium text-on-surface outline-none"
      />
    </div>
  );
}

export interface NotesFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/**
 * Renders a labeled coaching-notes textarea for a planned exercise.
 */
export function NotesField({ value, onChange, onBlur }: NotesFieldProps) {
  const [text, setText] = useState(value ?? '');
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setText(value ?? '');
  }, [value]);

  return (
    <div>
      <label className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant block mb-1">
        Notes
      </label>
      <textarea
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          onBlur();
        }}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        rows={2}
        placeholder="e.g. paused, tempo 3-1-1…"
        className="w-full bg-surface-container-highest/40 text-on-surface text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary/40 resize-none"
      />
    </div>
  );
}
