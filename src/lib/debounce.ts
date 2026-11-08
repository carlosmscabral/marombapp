/**
 * Keystroke write debouncer with explicit flush and cancel controls.
 * Coalesces rapid input updates while allowing blur or unmount hooks to commit immediately.
 */

export type DebouncedFn<Args extends unknown[]> = ((...args: Args) => void) & {
  flush: () => void;
  cancel: () => void;
};

/**
 * Wraps `fn` so calls within `ms` milliseconds coalesce into the latest argument list.
 * Call `flush()` before navigation or structural array edits to commit pending state.
 * Call `cancel()` before destructive edits so stale timers do not overwrite newer data.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void | Promise<void>,
  ms: number,
): DebouncedFn<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  const wrapped = (...args: Args) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) void fn(...lastArgs);
      lastArgs = null;
    }, ms);
  };

  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs) {
      const pending = lastArgs;
      lastArgs = null;
      void fn(...pending);
    }
  };

  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return wrapped;
}
