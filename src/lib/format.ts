/**
 * Shared date, duration, and label formatters for MarombApp screens.
 * Centralizes relative date math and tabular clock formatting across views.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formats an elapsed millisecond counter as `mm:ss` or `h:mm:ss`.
 * If the input is negative or non-finite, the formatter clamps the value to zero.
 */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/**
 * Formats a completed workout duration in minutes and hours (`45m` or `1h 05m`).
 * If `padMinutes` is true and duration reaches one hour, minutes render with two digits.
 */
export function formatDuration(ms: number, padMinutes = false): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  const mins = padMinutes ? String(m).padStart(2, '0') : String(m);
  return `${h}h ${mins}m`;
}

/**
 * Formats a Unix millisecond timestamp as a short calendar label (for example `Jul 5`).
 */
export function formatDateShort(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Formats a Unix millisecond timestamp with weekday, date, and local clock time.
 */
export function formatDateTime(ts: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toString();
  }
}

/**
 * Formats a timestamp relative to now (`Today`, `Yesterday`, `N days ago`, or `Jul 5`).
 */
export function formatRelative(ts: number): string {
  if (!ts) return '—';
  const now = Date.now();
  const diff = now - ts;
  if (diff < DAY_MS && new Date(ts).toDateString() === new Date(now).toDateString()) {
    return 'Today';
  }
  if (diff < 2 * DAY_MS) return 'Yesterday';
  const days = Math.floor(diff / DAY_MS);
  if (days < 7) return `${days} days ago`;
  return formatDateShort(ts);
}

/**
 * Capitalizes the first character of a non-empty label.
 */
export function cap(label: string): string {
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}
