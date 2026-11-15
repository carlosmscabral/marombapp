/**
 * Unit tests for the shared `pt-BR` date, number, duration, and label formatters (#16, REQ-002).
 * These formatters drive every timer, volume figure, and history label in the UI.
 * A regression here changes visible text, so the tests pin exact `pt-BR` strings.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cap,
  formatDecimal,
  formatDuration,
  formatElapsed,
  formatNumber,
  formatRelative,
} from '../../src/lib/format';

describe('formatNumber and formatDecimal (pt-BR)', () => {
  it('formats rounded integers with pt-BR dot thousands separators', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(480)).toBe('480');
    expect(formatNumber(1600)).toBe('1.600');
    expect(formatNumber(2200.4)).toBe('2.200');
    expect(formatNumber(Number.NaN)).toBe('0');
  });

  it('formats decimal weights with pt-BR comma decimal separator', () => {
    expect(formatDecimal(100)).toBe('100');
    expect(formatDecimal(62.5)).toBe('62,5');
    expect(formatDecimal(67.25)).toBe('67,25');
  });
});

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

  it('returns Hoje for an earlier time on the same calendar day', () => {
    expect(formatRelative(new Date(2026, 6, 15, 7, 0, 0).getTime())).toBe('Hoje');
  });

  it('returns Ontem for a time less than two days ago on another day', () => {
    expect(formatRelative(new Date(2026, 6, 14, 20, 0, 0).getTime())).toBe('Ontem');
  });

  it('returns há N dias for two to six full days', () => {
    expect(formatRelative(NOW - 3 * 86_400_000)).toBe('há 3 dias');
    expect(formatRelative(NOW - 6 * 86_400_000)).toBe('há 6 dias');
  });

  it('falls back to a short pt-BR calendar label at seven days or more', () => {
    const ts = NOW - 10 * 86_400_000;
    const expected = new Intl.DateTimeFormat('pt-BR', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(ts));
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
