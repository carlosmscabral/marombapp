/**
 * Safety guards and report formatter for the `(default)` to `marombapp` Firestore migration (#15, ADR-004, ADR-005).
 * Enforces target DB refusal, strict allowlisting, and pre-apply protection against post-cutover data loss.
 */

export const DEFAULT_SOURCE_DB = '(default)';
export const ALLOWLIST_TOP_COLLECTIONS = Object.freeze(['exercises', 'plans', 'sessions']);
export const COLLECTION_KEYS = Object.freeze([
  'exercises',
  'plans',
  'plans/*/days',
  'sessions',
]);

/**
 * Validates that the target database is a named Firestore database and never `(default)` or `default`.
 */
export function assertSafeTargetDatabase(
  targetDatabaseId,
  sourceDatabaseId = DEFAULT_SOURCE_DB,
) {
  const normalizedTarget =
    typeof targetDatabaseId === 'string' ? targetDatabaseId.trim() : '';
  const normalizedSource =
    typeof sourceDatabaseId === 'string' && sourceDatabaseId.trim()
      ? sourceDatabaseId.trim()
      : DEFAULT_SOURCE_DB;

  if (!normalizedTarget) {
    throw new Error(
      'Refusing migration: target database ID must be a non-empty named database.',
    );
  }
  if (normalizedTarget === '(default)' || normalizedTarget.toLowerCase() === 'default') {
    throw new Error(
      `Refusing migration: target database cannot be "${targetDatabaseId}". Source "(default)" is read-only.`,
    );
  }
  if (normalizedTarget === normalizedSource) {
    throw new Error(
      `Refusing migration: target database "${normalizedTarget}" must differ from source "${normalizedSource}".`,
    );
  }
  return normalizedTarget;
}

/**
 * Ensures a collection path belongs strictly to `exercises`, `plans`, `plans/{id}/days`, or `sessions`.
 */
export function assertAllowlistedCollectionPath(collectionPath) {
  const normalized = String(collectionPath ?? '').replace(/^\/+|\/+$/g, '');
  const parts = normalized.split('/');
  const isTopAllowed =
    parts.length === 1 && ALLOWLIST_TOP_COLLECTIONS.includes(parts[0]);
  const isPlanDays =
    parts.length === 3 &&
    parts[0] === 'plans' &&
    Boolean(parts[1]) &&
    parts[2] === 'days';

  if (!isTopAllowed && !isPlanDays) {
    throw new Error(
      `Collection "${collectionPath}" is outside the strict MarombApp allowlist.`,
    );
  }
  return normalized;
}

/**
 * Ensures a document path belongs strictly to allowlisted MarombApp collections.
 */
export function assertAllowlistedDocPath(docPath) {
  const normalized = String(docPath ?? '').replace(/^\/+|\/+$/g, '');
  const parts = normalized.split('/');
  if (parts.length !== 2 && parts.length !== 4) {
    throw new Error(
      `Document "${docPath}" is outside the strict MarombApp allowlist.`,
    );
  }
  assertAllowlistedCollectionPath(parts.slice(0, -1).join('/'));
  return normalized;
}

/**
 * Evaluates whether `marombapp` holds post-cutover user data absent from `(default)` before purging.
 * Seeded built-in exercises (`isCustom: false`) and empty 0-day test plans remain purgeable.
 */
export function evaluateTargetGuard(
  sourceScan,
  beforeScan,
  forcePurgeTargetSessions = /** @type {boolean | string[]} */ (false),
) {
  const srcExercises = sourceScan.buckets.get('exercises');
  const srcPlans = sourceScan.buckets.get('plans');
  const srcSessions = sourceScan.buckets.get('sessions');

  const allTargetOnlySessions = [...beforeScan.buckets.get('sessions').keys()]
    .filter((docPath) => !srcSessions.has(docPath))
    .map((docPath) => docPath.split('/')[1]);

  const allowedSet = Array.isArray(forcePurgeTargetSessions)
    ? new Set(forcePurgeTargetSessions)
    : null;

  let blockedSessions = allTargetOnlySessions;
  if (forcePurgeTargetSessions === true) {
    blockedSessions = [];
  } else if (allowedSet) {
    blockedSessions = allTargetOnlySessions.filter((id) => !allowedSet.has(id));
  }

  const forcedSessions = allTargetOnlySessions.filter(
    (id) => !blockedSessions.includes(id),
  );

  const customExercises = [...beforeScan.buckets.get('exercises').entries()]
    .filter(([docPath, data]) => data?.isCustom === true && !srcExercises.has(docPath))
    .map(([docPath]) => docPath.split('/')[1]);

  const nonEmptyPlanSet = new Set();
  for (const dayPath of beforeScan.buckets.get('plans/*/days').keys()) {
    const planId = dayPath.split('/')[1];
    if (!srcPlans.has(`plans/${planId}`)) {
      nonEmptyPlanSet.add(planId);
    }
  }
  const nonEmptyPlans = [...nonEmptyPlanSet].sort();

  const reasons = [];
  if (blockedSessions.length > 0) {
    reasons.push(`sessions=[${blockedSessions.join(', ')}]`);
  }
  if (customExercises.length > 0) {
    reasons.push(`customExercises=[${customExercises.join(', ')}]`);
  }
  if (nonEmptyPlans.length > 0) {
    reasons.push(`nonEmptyPlans=[${nonEmptyPlans.join(', ')}]`);
  }

  return {
    blocked: reasons.length > 0,
    reasons,
    blockedSessions,
    forcedSessions,
    customExercises,
    nonEmptyPlans,
  };
}

/**
 * Formats a human-readable per-collection summary, guard status, and source-vs-target verification table.
 */
export function formatMigrationReport(report) {
  const delLabel = report.dryRun ? 'wouldDelete' : 'deleted';
  const wrLabel = report.dryRun ? 'wouldWrite' : 'written';
  const banner = [
    `Mode: ${report.mode.toUpperCase()}`,
    `Project: ${report.projectId}`,
    `${report.sourceDatabaseId} -> ${report.targetDatabaseId}`,
  ].join(' | ');
  const headerCols = [
    'Collection'.padEnd(14),
    'source',
    'targetBefore',
    delLabel.padStart(11),
    wrLabel.padStart(10),
    'targetAfter',
    'source==target',
  ].join(' | ');

  const lines = [
    banner,
    headerCols,
    '---------------+--------+--------------+-------------+------------+-------------+---------------',
  ];

  for (const row of report.collections) {
    const delVal = report.dryRun ? row.wouldDelete : row.deleted;
    const wrVal = report.dryRun ? row.wouldWrite : row.written;
    const eqText =
      row.countsMatch && row.idsMatch
        ? 'YES'
        : report.dryRun
          ? 'NO (dry-run)'
          : 'MISMATCH';

    lines.push(
      [
        row.collection.padEnd(14),
        String(row.source).padStart(6),
        String(row.targetBefore).padStart(12),
        String(delVal).padStart(11),
        String(wrVal).padStart(10),
        String(row.targetAfter).padStart(11),
        eqText,
      ].join(' | '),
    );
  }

  if (report.purgedTargetOnlySessionIds?.length > 0) {
    const purgedList = report.purgedTargetOnlySessionIds.join(', ');
    lines.push(
      `Purged target-only sessions (--force-purge-target-sessions): ${purgedList}`,
    );
  }
  if (report.guard?.blocked) {
    lines.push(`GUARD WOULD BLOCK --apply: ${report.guard.reasons.join('; ')}`);
  }

  const delTotal = report.dryRun ? report.totalTargetBefore : report.totalDeleted;
  const wrTotal = report.dryRun ? report.totalSourceDocs : report.totalWritten;
  const totalsLine = [
    `source=${report.totalSourceDocs}`,
    `targetBefore=${report.totalTargetBefore}`,
    `${delLabel}=${delTotal}`,
    `${wrLabel}=${wrTotal}`,
    `deleteBatches=${report.deleteBatches}`,
    `writeBatches=${report.writeBatches}`,
  ].join(', ');
  const verifyLine = [
    `verified=${report.verification.verified}`,
    `targetEqualsSource=${report.verification.targetEqualsSource}`,
  ].join(', ');

  lines.push(`Totals: ${totalsLine}`, `Verification (source vs target): ${verifyLine}`);
  return lines.join('\n');
}
