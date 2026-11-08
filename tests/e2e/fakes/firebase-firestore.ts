/**
 * Test-only stand-in for the `firebase/firestore` module.
 * The e2e Vite config aliases `firebase/firestore` here, so specs never reach a real project.
 * It exposes only the API surface that `src/lib/db/*` and `src/lib/seed.ts` call.
 * Data lives in `fake-store.ts`, which persists to `localStorage` and survives a reload.
 */

import { applyWrites, autoId, type Constraint, type DocData, readDoc, runQuery, subscribe } from './fake-store';

export interface Firestore {
  kind: 'db';
}
export interface CollectionReference {
  kind: 'collection';
  path: string;
  id: string;
}
export interface DocumentReference {
  kind: 'doc';
  path: string;
  id: string;
}
export interface Query {
  kind: 'query';
  path: string;
  constraints: Constraint[];
}
export type Unsubscribe = () => void;

const DB: Firestore = { kind: 'db' };
const SERVER_TS = '__fake_server_timestamp__';
const metadata = { hasPendingWrites: false, fromCache: false };

export const initializeFirestore = (): Firestore => DB;
export const getFirestore = (): Firestore => DB;
export const persistentLocalCache = (o: unknown = {}) => o;
export const persistentMultipleTabManager = () => ({});
export const serverTimestamp = () => SERVER_TS;
export const waitForPendingWrites = async (): Promise<void> => undefined;

const lastId = (path: string) => path.split('/').pop() as string;

export function collection(parent: Firestore | DocumentReference, ...segments: string[]): CollectionReference {
  const base = parent.kind === 'doc' ? [parent.path] : [];
  const path = [...base, ...segments].join('/');
  return { kind: 'collection', path, id: lastId(path) };
}

export function doc(parent: Firestore | CollectionReference, ...segments: string[]): DocumentReference {
  const base = parent.kind === 'collection' ? [parent.path] : [];
  const parts = segments.length ? segments : [autoId()];
  const path = [...base, ...parts].join('/');
  return { kind: 'doc', path, id: lastId(path) };
}

export const where = (field: string, op: string, value: unknown): Constraint => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): Constraint => ({ kind: 'orderBy', field, dir });
export const limit = (n: number): Constraint => ({ kind: 'limit', n });

export function query(base: CollectionReference | Query, ...constraints: Constraint[]): Query {
  const prior = base.kind === 'query' ? base.constraints : [];
  return { kind: 'query', path: base.path, constraints: [...prior, ...constraints] };
}

function resolve(data: DocData): DocData {
  const out: DocData = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    out[k] = v === SERVER_TS ? Date.now() : v;
  }
  return out;
}

function docSnap(path: string, data: DocData | undefined) {
  const ref: DocumentReference = { kind: 'doc', path, id: lastId(path) };
  return { id: ref.id, ref, metadata, exists: () => data !== undefined, data: () => data as DocData };
}

function querySnap(path: string, constraints: Constraint[]) {
  const docs = runQuery(path, constraints).map((r) => docSnap(r.path, r.data));
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    metadata,
    forEach: (cb: (d: ReturnType<typeof docSnap>) => void) => docs.forEach(cb),
  };
}

export async function getDoc(ref: DocumentReference) {
  return docSnap(ref.path, readDoc(ref.path));
}
export const getDocFromCache = getDoc;

export async function getDocs(q: CollectionReference | Query) {
  return querySnap(q.path, q.kind === 'query' ? q.constraints : []);
}

export async function addDoc(col: CollectionReference, data: DocData): Promise<DocumentReference> {
  const ref = doc(col);
  applyWrites([{ path: ref.path, op: 'set', data: resolve(data) }]);
  return ref;
}
export async function setDoc(ref: DocumentReference, data: DocData): Promise<void> {
  applyWrites([{ path: ref.path, op: 'set', data: resolve(data) }]);
}
export async function updateDoc(ref: DocumentReference, data: DocData): Promise<void> {
  applyWrites([{ path: ref.path, op: 'update', data: resolve(data) }]);
}
export async function deleteDoc(ref: DocumentReference): Promise<void> {
  applyWrites([{ path: ref.path, op: 'delete' }]);
}

/** Collects writes and commits them in one atomic store update. */
export function writeBatch(_db: Firestore) {
  const writes: Parameters<typeof applyWrites>[0] = [];
  const batch = {
    set(ref: DocumentReference, data: DocData) {
      writes.push({ path: ref.path, op: 'set', data: resolve(data) });
      return batch;
    },
    update(ref: DocumentReference, data: DocData) {
      writes.push({ path: ref.path, op: 'update', data: resolve(data) });
      return batch;
    },
    delete(ref: DocumentReference) {
      writes.push({ path: ref.path, op: 'delete' });
      return batch;
    },
    async commit() {
      applyWrites(writes);
    },
  };
  return batch;
}

type SnapCb = (snap: never) => void;

/**
 * Streams a document or query. It emits once on the next microtask, then after every write.
 * The optional options argument (`includeMetadataChanges`) is accepted and ignored.
 */
export function onSnapshot(
  target: DocumentReference | CollectionReference | Query,
  a: SnapCb | Record<string, unknown>,
  b?: SnapCb,
): Unsubscribe {
  const cb = (typeof a === 'function' ? a : b) as (snap: unknown) => void;
  let active = true;
  const emit = () => {
    if (!active) return;
    if (target.kind === 'doc') cb(docSnap(target.path, readDoc(target.path)));
    else cb(querySnap(target.path, target.kind === 'query' ? target.constraints : []));
  };
  queueMicrotask(emit);
  const off = subscribe(emit);
  return () => {
    active = false;
    off();
  };
}
