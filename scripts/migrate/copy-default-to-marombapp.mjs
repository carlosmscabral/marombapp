/**
 * One-off idempotent Firestore migration tool copying MarombApp data from `(default)` into `marombapp`.
 * Wraps `(default)` read-only, runs `target-guard` before any purge, spares `eval_runs`, and defaults to `--dry-run`.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  ALLOWLIST_TOP_COLLECTIONS, COLLECTION_KEYS, DEFAULT_SOURCE_DB,
  assertAllowlistedCollectionPath, assertAllowlistedDocPath, assertSafeTargetDatabase,
  evaluateTargetGuard, formatMigrationReport,
} from './target-guard.mjs';

export {
  ALLOWLIST_TOP_COLLECTIONS, COLLECTION_KEYS, DEFAULT_SOURCE_DB,
  assertAllowlistedCollectionPath, assertAllowlistedDocPath, assertSafeTargetDatabase,
  evaluateTargetGuard, formatMigrationReport,
};

export const DEFAULT_PROJECT_ID = 'vibe-cabral';
export const DEFAULT_TARGET_DB = 'marombapp';
export const MAX_BATCH_SIZE = 400;

/**
 * Wraps a Firestore handle in a frozen read-only facade restricted to allowlisted MarombApp collections.
 */
export function createReadOnlySource(rawDb) {
  function wrapDocRef(rawDocRef, colPath) {
    return Object.freeze({
      id: rawDocRef.id,
      path: `${colPath}/${rawDocRef.id}`,
      get: () => rawDocRef.get(),
      collection: (subName) => {
        const subPath = assertAllowlistedCollectionPath(`${colPath}/${rawDocRef.id}/${subName}`);
        const rawSub =
          typeof rawDocRef.collection === 'function'
            ? rawDocRef.collection(subName)
            : rawDb.collection(subPath);
        return wrapCollectionRef(rawSub, subPath);
      },
    });
  }

  function wrapCollectionRef(rawColRef, colPath) {
    const safePath = assertAllowlistedCollectionPath(colPath);
    const hasListDocuments = typeof rawColRef.listDocuments === 'function';
    return Object.freeze({
      id: rawColRef.id,
      path: safePath,
      get: async () => {
        const snap = await rawColRef.get();
        return Object.freeze({
          size: snap.docs.length,
          empty: snap.docs.length === 0,
          docs: snap.docs.map((d) =>
            Object.freeze({ id: d.id, data: () => d.data(), ref: wrapDocRef(d.ref, safePath) }),
          ),
        });
      },
      listDocuments: hasListDocuments
        ? async () => (await rawColRef.listDocuments()).map((r) => wrapDocRef(r, safePath))
        : undefined,
      doc: (docId) => wrapDocRef(rawColRef.doc(docId), safePath),
    });
  }

  return Object.freeze({
    collection: (collectionPath) => {
      const safePath = assertAllowlistedCollectionPath(collectionPath);
      return wrapCollectionRef(rawDb.collection(safePath), safePath);
    },
  });
}

/**
 * Scans only `exercises`, `plans`, `plans/{id}/days`, and `sessions` without calling `listCollections()`.
 */
export async function scanAllowlistedDatabase(readOnlyDb) {
  const buckets = new Map(COLLECTION_KEYS.map((key) => [key, new Map()]));
  const orderedDocs = [];

  async function collectFlat(colPath, bucketKey) {
    const snap = await readOnlyDb.collection(colPath).get();
    const sorted = [...snap.docs].sort((a, b) => a.id.localeCompare(b.id));
    for (const docSnap of sorted) {
      const data = docSnap.data();
      buckets.get(bucketKey).set(docSnap.ref.path, data);
      orderedDocs.push({ id: docSnap.id, path: docSnap.ref.path, collectionKey: bucketKey, data });
    }
    return sorted;
  }

  await collectFlat('exercises', 'exercises');
  const plansCol = readOnlyDb.collection('plans');
  const planDocs = await collectFlat('plans', 'plans');
  const planIds = new Set(planDocs.map((d) => d.id));
  if (typeof plansCol.listDocuments === 'function') {
    for (const ref of await plansCol.listDocuments()) {
      planIds.add(ref.id);
    }
  }
  for (const planId of [...planIds].sort()) {
    await collectFlat(`plans/${planId}/days`, 'plans/*/days');
  }
  await collectFlat('sessions', 'sessions');
  return { buckets, orderedDocs };
}

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
 * Runs pre-apply safety checks, purges target leftovers on `--apply`, copies verbatim, and verifies counts.
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
}) {
  const safeTargetId = assertSafeTargetDatabase(targetDatabaseId, sourceDatabaseId);
  if (typeof targetDb?.databaseId === 'string') {
    assertSafeTargetDatabase(targetDb.databaseId, sourceDatabaseId);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(
      `Invalid batchSize ${batchSize}: must be an integer between 1 and ${MAX_BATCH_SIZE}.`,
    );
  }

  const sourceScan = await scanAllowlistedDatabase(createReadOnlySource(sourceDb));
  const beforeScan = await scanAllowlistedDatabase(createReadOnlySource(targetDb));
  const guard = evaluateTargetGuard(sourceScan, beforeScan, forcePurgeTargetSessions);
  if (!dryRun && guard.blocked) {
    const reasonText = guard.reasons.join('; ');
    throw new Error(`Refusing --apply: target holds real data absent from source (${reasonText}).`);
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
    };
  });

  const targetEqualsSource = collections.every((c) => c.countsMatch && c.idsMatch);
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
 * Parses CLI flags with `--dry-run` enforced as default unless `--apply` is explicitly supplied.
 */
export function parseCliArgs(argv) {
  let explicitDryRun = false;
  let explicitApply = false;
  let forcePurgeTargetSessions = /** @type {boolean | string[]} */ (false);
  let projectId = DEFAULT_PROJECT_ID;
  let targetDatabaseId = DEFAULT_TARGET_DB;
  let batchSize = MAX_BATCH_SIZE;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') explicitDryRun = true;
    else if (arg === '--apply') explicitApply = true;
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
  const safeTarget = assertSafeTargetDatabase(targetDatabaseId, DEFAULT_SOURCE_DB);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(`Invalid --batch-size: must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
  }
  return {
    dryRun: !explicitApply,
    projectId: projectId.trim() || DEFAULT_PROJECT_ID,
    targetDatabaseId: safeTarget,
    batchSize,
    forcePurgeTargetSessions,
  };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const opts = parseCliArgs(process.argv.slice(2));
  const app = initializeApp(
    { credential: applicationDefault(), projectId: opts.projectId },
    `migrate-${Date.now()}`,
  );
  try {
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
    await deleteApp(app);
  }
}
