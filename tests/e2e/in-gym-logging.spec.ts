/**
 * Parity spec for active-session logging in InGym (REQ-001, REQ-002).
 * It covers set logging, the sticky rest count-up that survives a reload, mid-workout set and
 * exercise edits, notes, and the finish and abandon exits. The Playwright clock drives time
 * so the rest timer specs never sleep. Real time still flows, so they assert short time windows.
 */

import { expect, test } from '@playwright/test';
import { boot, expectStore, readDocs } from './support/app';
import { card, exercisesOf, gymDocs, reps, restClock, startPush, weights } from './support/gym';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: Date.now() });
  await boot(page, { signedIn: true, docs: gymDocs(), acceptDialogs: false });
  await startPush(page);
});

test('the rest bar counts up from each completed set and survives a reload', async ({ page }) => {
  await expect(restClock(page)).toHaveText('00:00');
  await expect(restClock(page)).toHaveClass(/text-on-surface-variant/);

  await weights(page, 'Bench Press').first().fill('67.5');
  await reps(page, 'Bench Press').first().fill('9');
  await card(page, 'Bench Press').getByRole('button', { name: 'Mark set complete' }).first().click();
  await expect(restClock(page)).toHaveClass(/text-on-surface(?!-)/);
  await page.clock.fastForward(65_000);
  // Real time keeps flowing under the installed clock, so allow a slow container some seconds.
  await expect(restClock(page)).toHaveText(/^01:(0[5-9]|[1-4]\d)$/);

  await page.reload();
  await expect(restClock(page)).toHaveText(/^01:(0[5-9]|[1-5]\d)$/);
  await page.clock.fastForward(60_000);
  await expect(restClock(page)).toHaveText(/^02:(0[5-9]|[1-5]\d)$/);
  await expect(card(page, 'Bench Press').getByRole('button', { name: 'Mark set incomplete' })).toHaveCount(1);
  await expect(weights(page, 'Bench Press').first()).toHaveValue('67.5');

  // Completing the next set restarts the count from zero.
  await card(page, 'Bench Press').getByRole('button', { name: 'Mark set complete' }).first().click();
  await expect(restClock(page)).toHaveText('00:00');
  await expectStore(
    page,
    (d) => {
      const sets = exercisesOf(d)[0]?.sets ?? [];
      return sets[0].weight === 67.5 && sets[0].reps === 9 && sets[0].completedAt !== null && sets[1].completedAt !== null;
    },
    'logged sets persisted',
  );

  // Un-completing a set keeps its values and clears completedAt.
  await card(page, 'Bench Press').getByRole('button', { name: 'Mark set incomplete' }).first().click();
  await expectStore(page, (d) => exercisesOf(d)[0]?.sets[0].completedAt === null && exercisesOf(d)[0]?.sets[0].weight === 67.5, 'set un-completed');
});

test('the session clock shows elapsed workout time', async ({ page }) => {
  await page.clock.fastForward('01:02:03');
  await expect(page.getByText(/^1:02:0\d$/)).toBeVisible();
});

test('sets and exercises can be added and removed mid-workout', async ({ page }) => {
  const row = card(page, 'Barbell Row');
  await reps(page, 'Barbell Row').nth(1).fill('6');
  await weights(page, 'Barbell Row').nth(1).fill('50');
  await weights(page, 'Barbell Row').nth(1).blur();
  await row.getByRole('button', { name: 'Add set' }).click();
  await expect(weights(page, 'Barbell Row')).toHaveCount(3);
  await expect(weights(page, 'Barbell Row').nth(2)).toHaveValue('50');
  await expect(reps(page, 'Barbell Row').nth(2)).toHaveValue('6');

  await row.getByRole('button', { name: 'Mark set complete' }).nth(2).click();
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Remove the last completed set?');
    void d.dismiss();
  });
  await row.getByRole('button', { name: 'Remove last set' }).click();
  await expect(weights(page, 'Barbell Row')).toHaveCount(3);
  page.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Remove last set' }).click();
  await expect(weights(page, 'Barbell Row')).toHaveCount(2);
  await row.getByRole('button', { name: 'Remove last set' }).click();
  await expect(weights(page, 'Barbell Row')).toHaveCount(1);
  await expect(row.getByRole('button', { name: 'Remove last set' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add exercise to session' }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('heading', { name: 'Add Exercise to Session' })).toBeVisible();
  await expect(picker.getByRole('button', { name: /^Bench Press/ })).toContainText('Added');
  await picker.getByRole('button', { name: /^Barbell Curl/ }).click();
  await expect(card(page, 'Barbell Curl')).toContainText('Exercise 3');
  await expect(weights(page, 'Barbell Curl')).toHaveCount(3);

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Remove Barbell Row from this workout?');
    void d.accept();
  });
  await page.getByRole('button', { name: 'Remove Barbell Row' }).click();
  await expect(card(page, 'Barbell Row')).toHaveCount(0);
  await expect(card(page, 'Barbell Curl')).toContainText('Exercise 2');
  await expectStore(
    page,
    (d) => exercisesOf(d).map((e) => `${e.exerciseName}:${e.sets.length}`).join() === 'Bench Press:3,Barbell Curl:3',
    'mid-workout edits persisted',
  );
});

test('notes persist and finishing opens the session detail', async ({ page }) => {
  await page.getByPlaceholder('How are you feeling today?').fill('Strong day');
  await card(page, 'Bench Press').getByPlaceholder('Notes for this exercise…').fill('Elbows tucked');
  await card(page, 'Bench Press').getByPlaceholder('Notes for this exercise…').blur();
  await card(page, 'Bench Press').getByRole('button', { name: 'Mark set complete' }).first().click();
  await page.clock.fastForward('45:00');

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Finish this workout?');
    void d.accept();
  });
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page).toHaveURL(/\/sessions\/[A-Za-z0-9]{20}$/);
  await expect(page.getByText('Completed session')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Push' })).toBeVisible();
  await expect(page.getByText('Strong day')).toBeVisible();
  await expect(page.getByText('Elbows tucked')).toBeVisible();
  // One completed 65 kg x 8 set out of five planned sets.
  await expect(page.locator('section').filter({ hasText: 'Volume' })).toContainText('520kg');
  await expect(page.locator('section').filter({ hasText: 'Sets' }).first()).toContainText('1/ 5');
  await expect(page.getByText('Active session — tap to resume')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('maromba.restTimer'))).toBeNull();

  const id = page.url().split('/').pop() as string;
  const s = (await readDocs(page))[`sessions/${id}`];
  expect(s).toMatchObject({ status: 'completed', sessionNotes: 'Strong day' });
  expect(typeof s.finishedAt).toBe('number');
});

test('abandoning ends the session and keeps it out of history', async ({ page }) => {
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Abandon this workout? Logged sets will be kept in history.');
    void d.accept();
  });
  await page.getByRole('button', { name: 'Abandon' }).click();
  await expect(page.getByRole('heading', { name: 'No active session' })).toBeVisible();
  const docs = await readDocs(page);
  expect(Object.values(docs).filter((d) => d.status === 'abandoned')).toHaveLength(1);
  expect(Object.values(docs).filter((d) => d.status === 'active')).toHaveLength(0);
});
