/**
 * Retired one-off Firestore migration tool from `(default)` into `marombapp` (#15, #23, ADR-004, ADR-005).
 * Defaults to read-only `--dry-run` diff inspection and refuses `--apply` after cutover without explicit authorization.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createReadOnlySource, scanAllowlistedDatabase } from './read-only-scanner.mjs';
import {
  ALLOWLIST_TOP_COLLECTIONS,
  COLLECTION_KEYS,
  DEFAULT_SOURCE_DB,
  POST_CUTOVER_OVERWRITE_FLAG,
  areFirestoreDocsEqual,
  assertAllowlistedCollectionPath,
  assertAllowlistedDocPath,
  assertPostCutoverApplyAuthorized,
  assertSafeTargetDatabase,
  evaluateTargetGuard,
  formatMigrationReport,
} from './target-guard.mjs';

export {
  ALLOWLIST_TOP_COLLECTIONS,
  COLLECTION_KEYS,
  DEFAULT_SOURCE_DB,
  POST_CUTOVER_OVERWRITE_FLAG,
  areFirestoreDocsEqual,
  assertAllowlistedCollectionPath,
  assertAllowlistedDocPath,
  assertPostCutoverApplyAuthorized,
  assertSafeTargetDatabase,
  createReadOnlySource,
  evaluateTargetGuard,
  formatMigrationReport,
  scanAllowlistedDatabase,
};

export const DEFAULT_PROJECT_ID = 'vibe-cabral';
export const DEFAULT_TARGET_DB = 'marombapp';
export const MAX_BATCH_SIZE = 400;

async function commitBatches(targetDb, items, batchSize, applyOp) {
  let count = 0;
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = targetDb.batch();
    for (const item of items.slice(offset, offset + batchSize)) {
      applyOp(batch, item);
    }
    await batch.commit();
    count += 1;
  }
  return count;
}

/**
 * Runs post-cutover authorization and diff guards, purges/copies only when authorized, and verifies equality.
 */
export async function runCopyMigration({
  sourceDb,
  targetDb,
  projectId = DEFAULT_PROJECT_ID,
  sourceDatabaseId = DEFAULT_SOURCE_DB,
  targetDatabaseId = DEFAULT_TARGET_DB,
  dryRun = true,
  batchSize = MAX_BATCH_SIZE,
  forcePurgeTargetSessions = /** @type {boolean | string[]} */ (false),
  overwriteLiveDataAfterCutover = false,
}) {
  const safeTargetId = assertSafeTargetDatabase(targetDatabaseId, sourceDatabaseId);
  if (typeof targetDb?.databaseId === 'string') {
    assertSafeTargetDatabase(targetDb.databaseId, sourceDatabaseId);
  }
  assertPostCutoverApplyAuthorized(dryRun, overwriteLiveDataAfterCutover, safeTargetId);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(`Invalid batchSize ${batchSize}: must be 1..${MAX_BATCH_SIZE}.`);
  }

  const sourceScan = await scanAllowlistedDatabase(createReadOnlySource(sourceDb));
  const beforeScan = await scanAllowlistedDatabase(createReadOnlySource(targetDb));
  const guard = evaluateTargetGuard(sourceScan, beforeScan, forcePurgeTargetSessions);
  if (!dryRun && guard.blocked) {
    const reasonText = guard.reasons.join('; ');
    throw new Error(`Refusing --apply: target diverges from source (${reasonText}).`);
  }

  const docsToPurge = [...beforeScan.orderedDocs].reverse();
  let deleteBatches = 0;
  let writeBatches = 0;

  if (!dryRun) {
    deleteBatches = await commitBatches(targetDb, docsToPurge, batchSize, (batch, entry) => {
      batch.delete(targetDb.doc(assertAllowlistedDocPath(entry.path)));
    });
    writeBatches = await commitBatches(
      targetDb,
      sourceScan.orderedDocs,
      batchSize,
      (batch, entry) => {
        batch.set(targetDb.doc(assertAllowlistedDocPath(entry.path)), entry.data);
      },
    );
  }

  const afterScan = await scanAllowlistedDatabase(createReadOnlySource(targetDb));
  const collections = COLLECTION_KEYS.map((collection) => {
    const srcMap = sourceScan.buckets.get(collection);
    const beforeMap = beforeScan.buckets.get(collection);
    const afterMap = afterScan.buckets.get(collection);
    const idsMatch =
      srcMap.size === afterMap.size && [...srcMap.keys()].every((docPath) => afterMap.has(docPath));
    const docsMatch =
      idsMatch &&
      [...srcMap.entries()].every(([docPath, srcData]) =>
        areFirestoreDocsEqual(srcData, afterMap.get(docPath)),
      );
    return {
      collection,
      source: srcMap.size,
      targetBefore: beforeMap.size,
      wouldDelete: beforeMap.size,
      deleted: dryRun ? 0 : beforeMap.size,
      wouldWrite: srcMap.size,
      written: dryRun ? 0 : srcMap.size,
      targetAfter: afterMap.size,
      countsMatch: srcMap.size === afterMap.size,
      idsMatch,
      docsMatch,
    };
  });

  const targetEqualsSource = collections.every((c) => c.countsMatch && c.idsMatch && c.docsMatch);
  const zeroMutationsVerified =
    dryRun &&
    deleteBatches === 0 &&
    writeBatches === 0 &&
    collections.every((c) => c.targetBefore === c.targetAfter);

  return {
    mode: dryRun ? 'dry-run' : 'apply',
    dryRun,
    projectId,
    sourceDatabaseId,
    targetDatabaseId: safeTargetId,
    batchSize,
    deleteBatches,
    writeBatches,
    totalSourceDocs: sourceScan.orderedDocs.length,
    totalTargetBefore: beforeScan.orderedDocs.length,
    totalDeleted: dryRun ? 0 : docsToPurge.length,
    totalWritten: dryRun ? 0 : sourceScan.orderedDocs.length,
    guard,
    purgedTargetOnlySessionIds: dryRun ? [] : guard.forcedSessions,
    collections,
    verification: {
      verified: dryRun ? zeroMutationsVerified : targetEqualsSource,
      targetEqualsSource,
      zeroMutationsVerified,
    },
  };
}

/**
 * Parses CLI flags with `--dry-run` enforced as default and post-cutover `--apply` refused unless overridden.
 */
export function parseCliArgs(argv) {
  let explicitDryRun = false;
  let explicitApply = false;
  let overwriteLiveDataAfterCutover = false;
  let forcePurgeTargetSessions = /** @type {boolean | string[]} */ (false);
  let projectId = DEFAULT_PROJECT_ID;
  let targetDatabaseId = DEFAULT_TARGET_DB;
  let batchSize = MAX_BATCH_SIZE;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') explicitDryRun = true;
    else if (arg === '--apply') explicitApply = true;
    else if (arg === POST_CUTOVER_OVERWRITE_FLAG) overwriteLiveDataAfterCutover = true;
    else if (arg === '--force-purge-target-sessions') forcePurgeTargetSessions = true;
    else if (arg.startsWith('--force-purge-target-sessions=')) {
      const raw = arg.slice('--force-purge-target-sessions='.length);
      const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length === 0) {
        throw new Error('--force-purge-target-sessions= requires comma-separated session IDs.');
      }
      forcePurgeTargetSessions = ids;
    } else if (arg.startsWith('--project=')) projectId = arg.slice('--project='.length);
    else if (arg === '--project') projectId = argv[++i] ?? '';
    else if (arg.startsWith('--target=')) targetDatabaseId = arg.slice('--target='.length);
    else if (arg === '--target') targetDatabaseId = argv[++i] ?? '';
    else if (arg.startsWith('--batch-size=')) batchSize = Number(arg.slice('--batch-size='.length));
    else if (arg === '--batch-size') batchSize = Number(argv[++i]);
    else throw new Error(`Unknown CLI argument: ${arg}`);
  }

  if (explicitDryRun && explicitApply) throw new Error('Cannot combine --dry-run and --apply.');
  if (!explicitApply && overwriteLiveDataAfterCutover) {
    throw new Error(`${POST_CUTOVER_OVERWRITE_FLAG} is only valid with --apply.`);
  }
  const safeTarget = assertSafeTargetDatabase(targetDatabaseId, DEFAULT_SOURCE_DB);
  assertPostCutoverApplyAuthorized(!explicitApply, overwriteLiveDataAfterCutover, safeTarget);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(`Invalid --batch-size: must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
  }
  return {
    dryRun: !explicitApply,
    overwriteLiveDataAfterCutover,
    projectId: projectId.trim() || DEFAULT_PROJECT_ID,
    targetDatabaseId: safeTarget,
    batchSize,
    forcePurgeTargetSessions,
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  let app = null;
  try {
    const opts = parseCliArgs(process.argv.slice(2));
    app = initializeApp(
      { credential: applicationDefault(), projectId: opts.projectId },
      `migrate-${Date.now()}`,
    );
    const report = await runCopyMigration({
      ...opts,
      sourceDb: getFirestore(app, DEFAULT_SOURCE_DB),
      targetDb: getFirestore(app, opts.targetDatabaseId),
    });
    console.log(formatMigrationReport(report));
    if (!report.verification.verified) process.exitCode = 1;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    if (app) await deleteApp(app);
  }
}
