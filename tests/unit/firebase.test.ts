/**
 * Unit tests for Firebase client initialization and multi-database Firestore configuration.
 * Verifies that `VITE_FIRESTORE_DATABASE_ID` defaults to `marombapp-test`, refuses `(default)`,
 * accepts named databases (`marombapp`, `marombapp-test`), and preserves IndexedDB persistence.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to marombapp-test when env is unset, empty, or whitespace', () => {
    vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', '');
    expect(resolveFirestoreDatabaseId()).toBe('marombapp-test');
    expect(resolveFirestoreDatabaseId(undefined)).toBe('marombapp-test');
    expect(resolveFirestoreDatabaseId('')).toBe('marombapp-test');
    expect(resolveFirestoreDatabaseId('   ')).toBe('marombapp-test');
  });

  it('refuses (default) and default explicitly regardless of casing or whitespace', () => {
    vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', '(default)');
    expect(() => resolveFirestoreDatabaseId()).toThrow(/\(default\)/i);
    expect(() => resolveFirestoreDatabaseId('(default)')).toThrow(/\(default\)/i);
    expect(() => resolveFirestoreDatabaseId('  (DEFAULT)  ')).toThrow(/\(default\)/i);
    expect(() => resolveFirestoreDatabaseId('default')).toThrow(/\(default\)/i);
    expect(() => resolveFirestoreDatabaseId('  Default  ')).toThrow(/\(default\)/i);
  });

  it('returns the trimmed named database identifier from arguments or env', () => {
    vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', '  marombapp  ');
    expect(resolveFirestoreDatabaseId()).toBe('marombapp');
    expect(resolveFirestoreDatabaseId('marombapp')).toBe('marombapp');
    expect(resolveFirestoreDatabaseId('marombapp-test')).toBe('marombapp-test');
    expect(resolveFirestoreDatabaseId('  marombapp-test  ')).toBe('marombapp-test');
  });
});

describe('getFirestoreDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses to initialize Firestore when VITE_FIRESTORE_DATABASE_ID is set to (default)', () => {
    vi.stubEnv('VITE_FIRESTORE_DATABASE_ID', '(default)');
    expect(() => getFirestoreDb()).toThrow(/\(default\)/i);
    expect(mocks.initializeFirestore).not.toHaveBeenCalled();
  });

  it('initializes Firestore once with persistentLocalCache, persistentMultipleTabManager, and marombapp-test', () => {
    expect(FIRESTORE_DATABASE_ID).toBe('marombapp-test');
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
