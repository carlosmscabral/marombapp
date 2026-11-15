/**
 * Shared `pt-BR` date, number, duration, and label formatters for MarombApp screens (#16, REQ-002).
 * Centralizes relative date math, `Intl` `pt-BR` formatting, and tabular clock formatting across views.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PT_BR_INTEGER = new Intl.NumberFormat('pt-BR');
const PT_BR_DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const PT_BR_SHORT_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'short',
});
const PT_BR_DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Formats a rounded integer in `pt-BR` grouping (for example `1.600`).
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return PT_BR_INTEGER.format(Math.round(value));
}

/**
 * Formats a decimal number in `pt-BR` notation with up to two fraction digits (for example `62,5`).
 */
export function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return PT_BR_DECIMAL.format(value);
}

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
 * Formats a Unix millisecond timestamp as a short `pt-BR` calendar label (for example `5 de jul.`).
 */
export function formatDateShort(ts: number): string {
  if (!ts) return '—';
  return PT_BR_SHORT_DATE.format(new Date(ts));
}

/**
 * Formats a Unix millisecond timestamp with `pt-BR` weekday, date, and local clock time.
 */
export function formatDateTime(ts: number): string {
  if (!ts) return '—';
  try {
    return PT_BR_DATE_TIME.format(new Date(ts));
  } catch {
    return new Date(ts).toString();
  }
}

/**
 * Formats a timestamp relative to now in `pt-BR` (`Hoje`, `Ontem`, `há N dias`, or short calendar label).
 */
export function formatRelative(ts: number): string {
  if (!ts) return '—';
  const now = Date.now();
  const diff = now - ts;
  if (diff < DAY_MS && new Date(ts).toDateString() === new Date(now).toDateString()) {
    return 'Hoje';
  }
  if (diff < 2 * DAY_MS) return 'Ontem';
  const days = Math.floor(diff / DAY_MS);
  if (days < 7) return days === 1 ? 'há 1 dia' : `há ${days} dias`;
  return formatDateShort(ts);
}

/**
 * Capitalizes the first character of a non-empty label.
 */
export function cap(label: string): string {
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}
