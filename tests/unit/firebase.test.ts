/**
 * Unit tests for Firebase client initialization and multi-database Firestore configuration.
 * Verifies that `VITE_FIRESTORE_DATABASE_ID` defaults to `(default)`, accepts named databases, and preserves multi-tab IndexedDB persistence.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getAuth: vi.fn(() => ({ currentUser: null })),
  initializeFirestore: vi.fn(() => ({ type: 'firestore' })),
  persistentLocalCache: vi.fn((opts: unknown) => ({ kind: 'persistentLocalCache', opts })),
  persistentMultipleTabManager: vi.fn(() => ({ kind: 'persistentMultipleTabManager' })),
}));

vi.mock('firebase/app', () => ({
  initializeApp: mocks.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  getAuth: mocks.getAuth,
}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: mocks.initializeFirestore,
  persistentLocalCache: mocks.persistentLocalCache,
  persistentMultipleTabManager: mocks.persistentMultipleTabManager,
}));

import {
  FIRESTORE_DATABASE_ID,
  getFirestoreDb,
  resolveFirestoreDatabaseId,
} from '../../src/lib/firebase';

describe('resolveFirestoreDatabaseId', () => {
  it('defaults to (default) when unset, empty, or whitespace', () => {
    expect(resolveFirestoreDatabaseId(undefined)).toBe('(default)');
    expect(resolveFirestoreDatabaseId('')).toBe('(default)');
    expect(resolveFirestoreDatabaseId('   ')).toBe('(default)');
  });

  it('returns the trimmed named database identifier when configured', () => {
    expect(resolveFirestoreDatabaseId('marombapp')).toBe('marombapp');
    expect(resolveFirestoreDatabaseId('  marombapp  ')).toBe('marombapp');
  });
});

describe('getFirestoreDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes Firestore once with persistentLocalCache, persistentMultipleTabManager, and databaseId', () => {
    const first = getFirestoreDb();
    const second = getFirestoreDb();

    expect(first).toBe(second);
    expect(mocks.persistentMultipleTabManager).toHaveBeenCalledTimes(1);
    expect(mocks.persistentLocalCache).toHaveBeenCalledWith({
      tabManager: { kind: 'persistentMultipleTabManager' },
    });
    expect(mocks.initializeFirestore).toHaveBeenCalledTimes(1);
    expect(mocks.initializeFirestore).toHaveBeenCalledWith(
      { name: '[DEFAULT]' },
      {
        localCache: {
          kind: 'persistentLocalCache',
          opts: { tabManager: { kind: 'persistentMultipleTabManager' } },
        },
      },
      FIRESTORE_DATABASE_ID,
    );
  });
});
