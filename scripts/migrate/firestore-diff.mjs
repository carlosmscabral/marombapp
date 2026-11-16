/**
 * Deep structural comparison for allowlisted Firestore documents in `scripts/migrate/` (#23, ADR-005).
 * Detects in-place field edits (including `Timestamp` and nested array changes) and post-migration deletions.
 */

function isFirestoreTimestamp(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.toMillis === 'function' &&
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number'
  );
}

/**
 * Compares two Firestore field values recursively for exact structural and type equality.
 */
export function areFirestoreValuesEqual(left, right) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left === right || (Number.isNaN(left) && Number.isNaN(right));
  }
  if (Object.is(left, right)) {
    return true;
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  if (isFirestoreTimestamp(left) || isFirestoreTimestamp(right)) {
    return (
      isFirestoreTimestamp(left) &&
      isFirestoreTimestamp(right) &&
      left.seconds === right.seconds &&
      left.nanoseconds === right.nanoseconds
    );
  }
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  if (left instanceof Uint8Array || right instanceof Uint8Array) {
    if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) {
      return false;
    }
    if (left.byteLength !== right.byteLength) {
      return false;
    }
    for (let i = 0; i < left.byteLength; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i += 1) {
      if (!areFirestoreValuesEqual(left[i], right[i])) {
        return false;
      }
    }
    return true;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false;
    }
    if (!areFirestoreValuesEqual(left[key], right[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Compares two Firestore document data maps for exact equality.
 */
export function areFirestoreDocsEqual(sourceData, targetData) {
  return areFirestoreValuesEqual(sourceData, targetData);
}

/**
 * Computes deterministic lists of edited and deleted migrated document paths in `beforeScan`.
 * Missing source paths are flagged as deletions once `beforeScan` holds at least one migrated source document.
 */
export function computeSourceTargetDiffs(sourceScan, beforeScan, collectionKeys) {
  let sharedDocCount = 0;
  const editedDocs = [];
  const missingFromTarget = [];

  for (const collectionKey of collectionKeys) {
    const srcMap = sourceScan.buckets.get(collectionKey);
    const tgtMap = beforeScan.buckets.get(collectionKey);
    for (const [docPath, srcData] of srcMap.entries()) {
      if (tgtMap.has(docPath)) {
        sharedDocCount += 1;
        if (!areFirestoreDocsEqual(srcData, tgtMap.get(docPath))) {
          editedDocs.push(docPath);
        }
      } else {
        missingFromTarget.push(docPath);
      }
    }
  }

  const deletedDocs = sharedDocCount > 0 ? missingFromTarget : [];
  return { sharedDocCount, editedDocs, deletedDocs };
}
