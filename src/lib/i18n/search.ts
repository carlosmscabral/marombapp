/**
 * Accent-insensitive and case-insensitive search normalization for Brazilian Portuguese UI queries.
 * Decomposes Unicode strings via NFD and strips combining diacritics so mobile gym searches match
 * accented PT-BR names, muscle labels, and canonical English fallbacks (#21, REQ-002).
 */

/**
 * Normalizes a search query or candidate label by NFD-decomposing, stripping combining diacritics,
 * and lowercasing. Returns an empty string for null or undefined inputs.
 */
export function foldSearch(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
