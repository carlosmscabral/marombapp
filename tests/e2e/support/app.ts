/**
 * Shared Playwright helpers for the parity specs.
 * They seed the fake Firestore and fake Auth through `localStorage` before the app boots,
 * read the persisted store back for assertions, and drive the single-UID sign-in gate.
 */

import { expect, type Page } from '@playwright/test';
import type { Docs } from './data';

export const ALLOWED_UID = 'e2e-allowed-uid';
const DOCS_KEY = 'fake-fs:docs';
const USER_KEY = 'fake-auth:user';

interface BootOptions {
  docs?: Docs;
  signedIn?: boolean;
  popupUid?: string;
  popupError?: string;
  initError?: string;
  path?: string;
  /** If false, the spec handles `confirm()` dialogs itself. */
  acceptDialogs?: boolean;
}

/**
 * Seeds storage once per tab, then opens `path`.
 * The init script runs on every load, so a `sessionStorage` flag keeps reloads from re-seeding.
 */
export async function boot(page: Page, opts: BootOptions = {}): Promise<void> {
  const user = opts.signedIn
    ? { uid: ALLOWED_UID, email: `${ALLOWED_UID}@example.test`, displayName: 'Test Lifter' }
    : null;
  await page.addInitScript(
    ({ docs, user, popupUid, popupError, initError, keys }) => {
      if (sessionStorage.getItem('e2e:seeded')) return;
      sessionStorage.setItem('e2e:seeded', '1');
      if (docs) localStorage.setItem(keys.docs, JSON.stringify(docs));
      if (user) localStorage.setItem(keys.user, JSON.stringify(user));
      if (popupUid) localStorage.setItem('fake-auth:popup-uid', popupUid);
      if (popupError) localStorage.setItem('fake-auth:popup-error', popupError);
      if (initError) localStorage.setItem('fake-auth:init-error', initError);
    },
    {
      docs: opts.docs,
      user,
      popupUid: opts.popupUid,
      popupError: opts.popupError,
      initError: opts.initError,
      keys: { docs: DOCS_KEY, user: USER_KEY },
    },
  );
  if (opts.acceptDialogs !== false) page.on('dialog', (d) => void d.accept());
  await page.goto(opts.path ?? '/');
}

/** Returns every persisted document keyed by path. */
export async function readDocs(page: Page): Promise<Docs> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), DOCS_KEY);
}

/** Returns persisted documents whose path is a direct child of `collectionPath`. */
export async function readCollection(page: Page, collectionPath: string): Promise<Docs> {
  const all = await readDocs(page);
  const prefix = `${collectionPath}/`;
  return Object.fromEntries(
    Object.entries(all).filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')),
  );
}

/** Polls the store until `predicate` holds, so specs wait on persisted state instead of sleeping. */
export async function expectStore(page: Page, predicate: (docs: Docs) => boolean, message: string): Promise<void> {
  await expect.poll(async () => predicate(await readDocs(page)), { message }).toBe(true);
}

/** Clicks a bottom navigation tab by its label. */
export async function nav(page: Page, label: 'Plan' | 'In-Gym' | 'Library' | 'Analytics'): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: label }).click();
}
