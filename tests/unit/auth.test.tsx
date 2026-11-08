/**
 * Unit tests for `AuthProvider`, `isAuthorizedUid`, and `SignIn` error resilience.
 * Verifies that missing/invalid Firebase config mounts `SignIn` without throwing and that empty `ALLOWED_UID` fails closed.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthListener = (user: { uid: string } | null) => void | Promise<void>;

const mocks = vi.hoisted(() => ({
  getFirebaseAuth: vi.fn(),
  resolveAllowedUid: vi.fn(() => 'allowed-uid'),
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(async () => undefined),
  listener: null as AuthListener | null,
}));

vi.mock('../../src/lib/firebase', () => ({
  getFirebaseAuth: mocks.getFirebaseAuth,
  resolveAllowedUid: mocks.resolveAllowedUid,
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    readonly providerId = 'google.com';
  },
  onAuthStateChanged: (auth: unknown, cb: AuthListener) => {
    mocks.listener = cb;
    return mocks.onAuthStateChanged(auth, cb);
  },
  signInWithPopup: mocks.signInWithPopup,
  signInWithRedirect: mocks.signInWithRedirect,
  signOut: mocks.signOut,
}));

import { AuthProvider, isAuthorizedUid, useAuth } from '../../src/lib/auth';
import { SignIn } from '../../src/screens/SignIn';

interface MinimalElement {
  nodeType: number;
  nodeName: string;
  tagName: string;
  namespaceURI: string;
  ownerDocument: unknown;
  childNodes: Array<MinimalElement | { nodeType: 3; nodeValue: string; parentNode?: unknown }>;
  parentNode?: unknown;
  style: Record<string, unknown>;
  attributes: Record<string, string>;
  addEventListener: () => void;
  removeEventListener: () => void;
  setAttribute: (k: string, v: unknown) => void;
  removeAttribute: (k: string) => void;
  appendChild: (c: MinimalElement) => MinimalElement;
  removeChild: (c: MinimalElement) => MinimalElement;
  insertBefore: (c: MinimalElement, b: MinimalElement | null) => MinimalElement;
  textContent: string;
}

/**
 * Installs a lightweight DOM container so `react-dom/client` executes `useEffect` hooks in Node.
 */
function createTestContainer(): MinimalElement {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as Record<string, unknown>).HTMLIFrameElement = class {};

  const doc: Record<string, unknown> = {
    nodeType: 9,
    documentElement: { style: {} },
    createElement: (tag: string) => makeEl(tag),
    createElementNS: (_ns: string, tag: string) => makeEl(tag),
    createTextNode: (text: string) => ({
      nodeType: 3 as const,
      nodeValue: String(text),
      data: String(text),
    }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };

  function makeEl(tag: string): MinimalElement {
    const el: MinimalElement = {
      nodeType: 1,
      nodeName: tag.toUpperCase(),
      tagName: tag.toUpperCase(),
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      ownerDocument: doc,
      childNodes: [],
      style: {},
      attributes: {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      setAttribute(k: string, v: unknown) {
        this.attributes[k] = String(v);
      },
      removeAttribute(k: string) {
        delete this.attributes[k];
      },
      appendChild(child: MinimalElement) {
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
      },
      removeChild(child: MinimalElement) {
        this.childNodes = this.childNodes.filter((x) => x !== child);
        return child;
      },
      insertBefore(child: MinimalElement, before: MinimalElement | null) {
        const idx = before ? this.childNodes.indexOf(before) : -1;
        if (idx === -1) this.childNodes.push(child);
        else this.childNodes.splice(idx, 0, child);
        child.parentNode = this;
        return child;
      },
      get textContent(): string {
        return this.childNodes
          .map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent))
          .join('');
      },
      set textContent(value: string) {
        this.childNodes = value
          ? [{ nodeType: 3 as const, nodeValue: String(value), parentNode: this }]
          : [];
      },
    };
    return el;
  }

  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).document = doc;
  return makeEl('div');
}

describe('AuthProvider and SignIn resilience', () => {
  let container: MinimalElement;
  let root: Root | null = null;
  let capturedAuth: ReturnType<typeof useAuth> | null = null;

  function Probe() {
    capturedAuth = useAuth();
    return <SignIn />;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listener = null;
    mocks.resolveAllowedUid.mockReturnValue('allowed-uid');
    mocks.onAuthStateChanged.mockImplementation(() => () => undefined);
    capturedAuth = null;
    container = createTestContainer();
    root = createRoot(container as unknown as Element);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
  });

  it('fails closed in isAuthorizedUid when ALLOWED_UID is empty or whitespace', () => {
    expect(isAuthorizedUid('any-user', '')).toBe(false);
    expect(isAuthorizedUid('any-user', '   ')).toBe(false);
    expect(isAuthorizedUid('', 'allowed-uid')).toBe(false);
    expect(isAuthorizedUid('allowed-uid', 'allowed-uid')).toBe(true);
  });

  it('mounts SignIn without throwing when getFirebaseAuth throws auth/invalid-api-key and surfaces error on signIn()', async () => {
    mocks.getFirebaseAuth.mockImplementation(() => {
      throw Object.assign(new Error('Firebase: Error (auth/invalid-api-key).'), {
        code: 'auth/invalid-api-key',
      });
    });

    await act(async () => {
      root!.render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    expect(capturedAuth?.loading).toBe(false);
    expect(capturedAuth?.user).toBeNull();
    expect(capturedAuth?.error).toBe('Firebase: Error (auth/invalid-api-key).');
    expect(container.textContent).toContain('MarombApp');
    expect(container.textContent).toContain('Sign in with Google');
    expect(container.textContent).toContain('Firebase: Error (auth/invalid-api-key).');

    await act(async () => {
      await expect(capturedAuth!.signIn()).resolves.toBeUndefined();
    });
    expect(capturedAuth?.error).toBe('Firebase: Error (auth/invalid-api-key).');
  });

  it('rejects and signs out a signed-in user when ALLOWED_UID is empty', async () => {
    const fakeAuth = { currentUser: { uid: 'some-user' } };
    mocks.getFirebaseAuth.mockReturnValue(fakeAuth);
    mocks.resolveAllowedUid.mockReturnValue('');

    await act(async () => {
      root!.render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    await act(async () => {
      await mocks.listener?.({ uid: 'some-user' });
    });

    expect(mocks.signOut).toHaveBeenCalledWith(fakeAuth);
    expect(capturedAuth?.loading).toBe(false);
    expect(capturedAuth?.user).toBeNull();
    expect(capturedAuth?.error).toBe('unauthorized');
    expect(container.textContent).toContain('This account is not authorized for MarombApp.');

    mocks.signInWithPopup.mockResolvedValueOnce({ user: { uid: 'some-user' } });
    await act(async () => {
      await capturedAuth!.signIn();
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
    expect(capturedAuth?.user).toBeNull();
    expect(capturedAuth?.error).toBe('unauthorized');
  });
});
