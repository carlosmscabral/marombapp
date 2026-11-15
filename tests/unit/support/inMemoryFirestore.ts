/**
 * Shared in-memory Firestore fake for migration unit tests (#15, ADR-004, ADR-005).
 * Records collection reads, batch sizes, and write/delete counts while throwing if `listCollections()` is ever called.
 */

export class InMemoryFirestore {
  readonly databaseId: string;
  private readonly docs = new Map<string, Record<string, unknown>>();
  readonly readCollections: string[] = [];
  listCollectionsCalls = 0;
  batchCalls = 0;
  commitSizes: number[] = [];
  writeAttempts = 0;
  deleteAttempts = 0;

  constructor(
    databaseId: string,
    initialDocs: Record<string, Record<string, unknown>> = {},
  ) {
    this.databaseId = databaseId;
    for (const [docPath, data] of Object.entries(initialDocs)) {
      this.docs.set(docPath, data);
    }
  }

  seed(docPath: string, data: Record<string, unknown>): void {
    this.docs.set(docPath, data);
  }

  readRaw(docPath: string): Record<string, unknown> | undefined {
    return this.docs.get(docPath);
  }

  size(): number {
    return this.docs.size;
  }

  async listCollections(): Promise<never> {
    this.listCollectionsCalls += 1;
    throw new Error(
      'listCollections() must never be called because strict allowlist is required',
    );
  }

  collection(colPath: string) {
    const normalized = colPath.replace(/^\/+|\/+$/g, '');
    const prefix = `${normalized}/`;
    const colDepth = normalized.split('/').length;

    return {
      id: normalized.split('/').pop()!,
      path: normalized,
      doc: (docId: string) => this.doc(`${normalized}/${docId}`),
      get: async () => {
        this.readCollections.push(normalized);
        const matched: Array<{
          id: string;
          data: () => Record<string, unknown>;
          ref: ReturnType<InMemoryFirestore['doc']>;
        }> = [];
        for (const [docPath, data] of this.docs.entries()) {
          if (!docPath.startsWith(prefix)) {
            continue;
          }
          const segments = docPath.split('/');
          if (segments.length === colDepth + 1) {
            matched.push({
              id: segments[segments.length - 1]!,
              data: () => data,
              ref: this.doc(docPath),
            });
          }
        }
        return {
          docs: matched,
          size: matched.length,
          empty: matched.length === 0,
        };
      },
      listDocuments: async () => {
        this.readCollections.push(`${normalized}:listDocuments`);
        const docIds = new Set<string>();
        for (const docPath of this.docs.keys()) {
          if (!docPath.startsWith(prefix)) {
            continue;
          }
          const segments = docPath.split('/');
          if (segments.length >= colDepth + 1) {
            docIds.add(segments[colDepth]!);
          }
        }
        return [...docIds].sort().map((id) => this.doc(`${normalized}/${id}`));
      },
    };
  }

  doc(docPath: string) {
    const normalized = docPath.replace(/^\/+|\/+$/g, '');
    const segments = normalized.split('/');
    const id = segments[segments.length - 1]!;
    return {
      id,
      path: normalized,
      get: async () => {
        const val = this.docs.get(normalized);
        return {
          id,
          exists: val !== undefined,
          data: () => val,
        };
      },
      collection: (subName: string) => this.collection(`${normalized}/${subName}`),
    };
  }

  batch() {
    this.batchCalls += 1;
    const ops: Array<{
      kind: 'set' | 'delete';
      path: string;
      data?: Record<string, unknown>;
    }> = [];
    return {
      set: (docRef: { path: string }, data: Record<string, unknown>) => {
        this.writeAttempts += 1;
        ops.push({ kind: 'set', path: docRef.path, data });
      },
      delete: (docRef: { path: string }) => {
        this.deleteAttempts += 1;
        ops.push({ kind: 'delete', path: docRef.path });
      },
      commit: async () => {
        this.commitSizes.push(ops.length);
        for (const op of ops) {
          if (op.kind === 'delete') {
            this.docs.delete(op.path);
          } else {
            this.docs.set(op.path, op.data!);
          }
        }
      },
    };
  }
}
