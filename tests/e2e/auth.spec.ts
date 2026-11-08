/**
 * Parity spec for the single-UID authentication gate (REQ-001).
 * The as-is app shows SignIn when signed out, rejects any account except ALLOWED_UID,
 * keeps the allowed session across reloads, and returns to SignIn on sign-out.
 */

import { expect, test } from '@playwright/test';
import { ALLOWED_UID, boot } from './support/app';
import { libraryDocs } from './support/data';

const signInButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Sign in with Google' });

test('signed-out visitors see only the sign-in screen', async ({ page }) => {
  await boot(page, { path: '/library' });
  await expect(page.getByRole('heading', { name: 'MarombApp' })).toBeVisible();
  await expect(signInButton(page)).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByText('This account is not authorized')).toHaveCount(0);
});

test('a non-allowlisted account is signed out and told it is unauthorized', async ({ page }) => {
  await boot(page, { popupUid: 'intruder-uid', docs: libraryDocs() });
  await signInButton(page).click();
  await expect(page.getByText('This account is not authorized for MarombApp.')).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('fake-auth:user'))).toBeNull();
  await page.reload();
  await expect(signInButton(page)).toBeVisible();
});

test('the allowlisted account enters the app and stays signed in across reloads', async ({ page }) => {
  await boot(page, { docs: libraryDocs() });
  await signInButton(page).click();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  const user = await page.evaluate(() => JSON.parse(localStorage.getItem('fake-auth:user') ?? 'null'));
  expect(user.uid).toBe(ALLOWED_UID);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(signInButton(page)).toHaveCount(0);
});

test('sign-out from the account menu returns to the sign-in screen', async ({ page }) => {
  await boot(page, { signedIn: true, docs: libraryDocs() });
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Account menu' });
  await expect(menu).toHaveText('TL');
  await menu.click();
  await expect(page.getByText(`${ALLOWED_UID}@example.test`)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(signInButton(page)).toBeVisible();
  await page.reload();
  await expect(signInButton(page)).toBeVisible();
});

test('closing the popup shows no error and a generic failure shows its message', async ({ page }) => {
  await boot(page, { popupError: 'auth/popup-closed-by-user' });
  await signInButton(page).click();
  await expect(signInButton(page)).toBeEnabled();
  await expect(page.locator('p.text-xs')).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem('fake-auth:popup-error', 'auth/network-request-failed'));
  await signInButton(page).click();
  await expect(page.getByText('Firebase: Error (auth/network-request-failed).')).toBeVisible();
});

test('a blocked popup falls back to the redirect flow', async ({ page }) => {
  await boot(page, { popupError: 'auth/popup-blocked', docs: libraryDocs() });
  await signInButton(page).click();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
});

test('unknown client routes redirect to analytics once signed in', async ({ page }) => {
  await boot(page, { signedIn: true, docs: libraryDocs(), path: '/does-not-exist' });
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
});
