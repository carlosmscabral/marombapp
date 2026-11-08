/**
 * In-browser document store behind the fake `firebase/firestore` module.
 * It persists every document in `localStorage`, so data survives a page reload like the
 * real Firestore IndexedDB cache does. It also evaluates the small query subset that
 * MarombApp uses (`where ==`, `orderBy`, `limit`) and notifies live listeners after each write.
 */

export const DOCS_KEY = 'fake-fs:docs';

export type DocData = Record<string, unknown>;

export interface Constraint {
  kind: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: unknown;
  dir?: 'asc' | 'desc';
  n?: number;
}

type Notify = () => void;

let docs: Record<string, DocData> = load();
const listeners = new Set<Notify>();

function load(): Record<string, DocData> {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DocData>) : {};
  } catch {
    return {};
  }
}

function persistAndNotify(): void {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
  queueMicrotask(() => {
    for (const l of [...listeners]) l();
  });
}

// If another tab writes, reload the store so multi-tab behavior stays coherent.
window.addEventListener('storage', (e) => {
  if (e.key !== DOCS_KEY) return;
  docs = load();
  for (const l of [...listeners]) l();
});

/** Returns a deep copy so callers never mutate stored state by reference. */
function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** Generates a 20-character id in the same alphabet as Firestore auto ids. */
export function autoId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function readDoc(path: string): DocData | undefined {
  return clone(docs[path]);
}

/** Applies a group of writes atomically, then persists once and notifies listeners once. */
export function applyWrites(writes: Array<{ path: string; op: 'set' | 'update' | 'delete'; data?: DocData }>): void {
  for (const w of writes) {
    if (w.op === 'update' && !docs[w.path]) {
      throw Object.assign(new Error(`No document to update: ${w.path}`), { code: 'not-found' });
    }
  }
  for (const w of writes) {
    if (w.op === 'delete') delete docs[w.path];
    else if (w.op === 'set') docs[w.path] = clone(w.data ?? {});
    else docs[w.path] = { ...docs[w.path], ...clone(w.data ?? {}) };
  }
  persistAndNotify();
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

/** Lists the direct child documents of `collectionPath` that match `constraints`. */
export function runQuery(collectionPath: string, constraints: Constraint[]): Array<{ path: string; data: DocData }> {
  const prefix = `${collectionPath}/`;
  let rows = Object.keys(docs)
    .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .sort()
    .map((path) => ({ path, data: clone(docs[path]) }));

  for (const c of constraints) {
    if (c.kind !== 'where') continue;
    if (c.op !== '==') throw new Error(`fake firestore: unsupported where op ${c.op}`);
    rows = rows.filter((r) => r.data[c.field as string] === c.value);
  }
  const orders = constraints.filter((c) => c.kind === 'orderBy');
  if (orders.length) {
    // Firestore drops documents that lack an orderBy field.
    rows = rows.filter((r) => orders.every((o) => r.data[o.field as string] !== undefined));
    rows.sort((x, y) => {
      for (const o of orders) {
        const d = compare(x.data[o.field as string], y.data[o.field as string]);
        if (d !== 0) return o.dir === 'desc' ? -d : d;
      }
      return 0;
    });
  }
  const lim = constraints.find((c) => c.kind === 'limit');
  return lim ? rows.slice(0, lim.n) : rows;
}

/** Registers a callback that runs after every committed write. */
export function subscribe(cb: Notify): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
