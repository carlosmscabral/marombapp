/**
 * Read-only allowlisted Firestore facade and scanner for `scripts/migrate/` (#15, #23, ADR-004, ADR-005).
 * Exposes zero write, delete, batch, or `listCollections` methods while scanning only MarombApp collections.
 */

import { COLLECTION_KEYS, assertAllowlistedCollectionPath } from './target-guard.mjs';

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
