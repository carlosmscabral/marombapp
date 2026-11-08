/**
 * Unit tests for the shared date, duration, and label formatters.
 * These formatters drive every timer and history label in the as-is UI.
 * A regression here changes visible text, so the tests pin exact strings.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cap, formatDuration, formatElapsed, formatRelative } from '../../src/lib/format';

describe('formatElapsed', () => {
  it('formats sub-hour counters as mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(999)).toBe('00:00');
    expect(formatElapsed(65_000)).toBe('01:05');
    expect(formatElapsed(59 * 60_000 + 59_000)).toBe('59:59');
  });

  it('formats counters of one hour or more as h:mm:ss', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_600_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
  });

  it('clamps negative and non-finite input to zero', () => {
    expect(formatElapsed(-5_000)).toBe('00:00');
    expect(formatElapsed(Number.NaN)).toBe('00:00');
    expect(formatElapsed(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  it('returns an em dash for zero, negative, or non-finite durations', () => {
    expect(formatDuration(0)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
  });

  it('formats durations below one hour in rounded minutes', () => {
    expect(formatDuration(45 * 60_000)).toBe('45m');
    expect(formatDuration(29_000)).toBe('0m');
    expect(formatDuration(90_000)).toBe('2m');
  });

  it('formats hours with unpadded minutes by default', () => {
    expect(formatDuration(65 * 60_000)).toBe('1h 5m');
  });

  it('pads minutes to two digits when padMinutes is true', () => {
    expect(formatDuration(65 * 60_000, true)).toBe('1h 05m');
    expect(formatDuration(45 * 60_000, true)).toBe('45m');
  });
});

describe('formatRelative', () => {
  const NOW = new Date(2026, 6, 15, 18, 0, 0).getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an em dash for a missing timestamp', () => {
    expect(formatRelative(0)).toBe('—');
  });

  it('returns Today for an earlier time on the same calendar day', () => {
    expect(formatRelative(new Date(2026, 6, 15, 7, 0, 0).getTime())).toBe('Today');
  });

  it('returns Yesterday for a time less than two days ago on another day', () => {
    expect(formatRelative(new Date(2026, 6, 14, 20, 0, 0).getTime())).toBe('Yesterday');
  });

  it('returns N days ago for two to six full days', () => {
    expect(formatRelative(NOW - 3 * 86_400_000)).toBe('3 days ago');
    expect(formatRelative(NOW - 6 * 86_400_000)).toBe('6 days ago');
  });

  it('falls back to a short calendar label at seven days or more', () => {
    const ts = NOW - 10 * 86_400_000;
    const expected = new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(formatRelative(ts)).toBe(expected);
  });
});

describe('cap', () => {
  it('capitalizes the first character and keeps the rest', () => {
    expect(cap('chest')).toBe('Chest');
    expect(cap('front delts')).toBe('Front delts');
  });

  it('returns an empty string for empty input', () => {
    expect(cap('')).toBe('');
  });
});
