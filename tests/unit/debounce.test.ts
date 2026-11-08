/**
 * Unit tests for the keystroke write debouncer.
 * InGym and PlanDay rely on flush and cancel to keep Firestore writes ordered.
 * The tests use fake timers so every assertion is deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../../src/lib/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid calls into one call with the latest arguments', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d('a');
    vi.advanceTimersByTime(100);
    d('b');
    vi.advanceTimersByTime(100);
    d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('flush commits the pending call immediately and only once', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d(1, 2);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1, 2);
    vi.advanceTimersByTime(1_000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush does nothing when no call is pending', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d.flush();
    d('x');
    vi.advanceTimersByTime(300);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel drops the pending call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d('stale');
    d.cancel();
    vi.advanceTimersByTime(1_000);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('accepts async functions without surfacing their promise', () => {
    const fn = vi.fn(async (_v: string) => undefined);
    const d = debounce(fn, 50);
    expect(d('v')).toBeUndefined();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('v');
  });
});
