/**
 * Parity spec for the exercise Library (REQ-001).
 * The as-is app seeds 66 built-in exercises once into an empty project.
 * Users browse by muscle chip or search, and create, edit, and delete only custom exercises.
 */

import { expect, test, type Page } from '@playwright/test';
import { boot, expectStore, nav, readCollection } from './support/app';

const count = (page: Page) => page.getByText(/exercises? available$/);
const card = (page: Page, name: string) =>
  page.locator('main button').filter({ has: page.getByRole('heading', { name, exact: true }) });

test.beforeEach(async ({ page }) => {
  await boot(page, { signedIn: true, path: '/library' });
  await expect(count(page)).toHaveText('66 exercises available');
});

test('seeds exactly 66 built-in exercises once, even after reload', async ({ page }) => {
  const docs = await readCollection(page, 'exercises');
  expect(Object.keys(docs)).toHaveLength(66);
  expect(Object.values(docs).every((d) => d.isCustom === false)).toBe(true);

  await page.reload();
  await expect(count(page)).toHaveText('66 exercises available');
  expect(Object.keys(await readCollection(page, 'exercises'))).toHaveLength(66);
});

test('lists exercises alphabetically and filters by muscle chip and search', async ({ page }) => {
  const names = await page.locator('main h4').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

  await page.getByRole('button', { name: 'Calves', exact: true }).click();
  await expect(page.locator('main h4')).toHaveCount(6);
  await expect(card(page, 'Standing Calf Raise')).toBeVisible();

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByPlaceholder('Search exercises or muscles…').fill('curl');
  const curls = await page.locator('main h4').allTextContents();
  expect(curls.length).toBeGreaterThan(0);
  expect(curls.every((n) => /curl/i.test(n))).toBe(true);

  await page.getByPlaceholder('Search exercises or muscles…').fill('zzz-none');
  await expect(page.getByText('No exercises match')).toBeVisible();
});

test('built-in exercises open read-only details without edit or delete', async ({ page }) => {
  await card(page, 'Bench Press').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Bench Press' })).toBeVisible();
  await expect(sheet.getByText('Chest').first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('creates, edits, and deletes a custom exercise', async ({ page }) => {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByRole('heading', { name: 'New exercise' })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Create' })).toBeDisabled();
  await form.getByPlaceholder('e.g. Incline Dumbbell Press').fill('  Zercher Squat  ');
  await form.getByLabel('Primary muscle').selectOption('quads');
  await form.getByLabel('Sub-muscle').selectOption('vastus medialis');
  await form.getByPlaceholder('Cues, tempo, setup…').fill('Bar in elbows');
  await form.getByRole('button', { name: 'Create' }).click();
  await expect(form).toHaveCount(0);
  await expect(count(page)).toHaveText('67 exercises available');

  const created = card(page, 'Zercher Squat');
  await expect(created).toContainText('Custom');
  await expect(created).toContainText('Quads · vastus medialis');
  await expectStore(
    page,
    (d) =>
      Object.values(d).some(
        (x) => x.name === 'Zercher Squat' && x.isCustom === true && x.subMuscle === 'vastus medialis' && x.notes === 'Bar in elbows',
      ),
    'custom exercise persisted with trimmed name',
  );

  await created.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog');
  await expect(edit.getByRole('heading', { name: 'Edit exercise' })).toBeVisible();
  await expect(edit.getByPlaceholder('e.g. Incline Dumbbell Press')).toHaveValue('Zercher Squat');
  await edit.getByPlaceholder('e.g. Incline Dumbbell Press').fill('Zercher Squat Heavy');
  await edit.getByLabel('Primary muscle').selectOption('glutes');
  await expect(edit.getByLabel('Sub-muscle')).toHaveValue('');
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(card(page, 'Zercher Squat Heavy')).toContainText('Glutes');
  await expect(count(page)).toHaveText('67 exercises available');

  await card(page, 'Zercher Squat Heavy').click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('button', { name: 'Delete' }).click();
  await expect(detail.getByText('This cannot be undone.')).toBeVisible();
  await detail.getByRole('button', { name: 'Cancel' }).click();
  await expect(detail.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Delete' }).click();
  await detail.getByRole('button', { name: 'Confirm' }).click();
  await expect(count(page)).toHaveText('66 exercises available');
  await expect(card(page, 'Zercher Squat Heavy')).toHaveCount(0);
});

test('custom exercises survive a reload and tab navigation', async ({ page }) => {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('e.g. Incline Dumbbell Press').fill('Sissy Squat');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(count(page)).toHaveText('67 exercises available');
  await page.reload();
  await expect(card(page, 'Sissy Squat')).toBeVisible();
  await nav(page, 'Analytics');
  await nav(page, 'Library');
  await expect(count(page)).toHaveText('67 exercises available');
});
