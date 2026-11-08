/**
 * Parity spec for starting a workout and the progressive-overload display (REQ-001).
 * StartWorkout lists the active plan's days. Picking a day creates one active session,
 * pre-fills set rows from the latest execution, and shows the last three executions per exercise.
 */

import { expect, test } from '@playwright/test';
import { boot, expectStore, nav, readDocs } from './support/app';
import { libraryDocs } from './support/data';
import { activeSession, card, exercisesOf, gymDocs, reps, startPush, weights } from './support/gym';

test('without an active plan, start workout points to plans', async ({ page }) => {
  await boot(page, { signedIn: true, docs: libraryDocs(), path: '/in-gym' });
  await expect(page.getByRole('heading', { name: 'No active session' })).toBeVisible();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page.getByRole('heading', { name: 'No active plan' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to plans' }).click();
  await expect(page.getByRole('heading', { name: 'Training Plans' })).toBeVisible();
});

test('start workout lists days with counts and a preview', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs(), path: '/start' });
  await expect(page.getByRole('heading', { name: 'PPL' })).toBeVisible();
  const push = page.getByRole('button', { name: /^Push/ });
  await expect(push).toContainText('2 exercises • 5 sets');
  await expect(push).toContainText('Bench Press • Barbell Row');
});

test('picking a day creates a session with history pre-fill and the last three executions', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs() });
  await startPush(page);

  await expect(page.getByText('PPL • Push')).toBeVisible();
  await expect(page.getByText('Active Session')).toBeVisible();
  const bench = card(page, 'Bench Press');
  await expect(bench).toContainText('Exercise 1');
  await expect(bench).toContainText('8–12 reps');
  await expect(card(page, 'Barbell Row')).toContainText('6–10 reps');

  // Last three executions, newest first. Incomplete sets and the 20-day-old session stay hidden.
  const history = bench.locator('p:text-is("Last sessions") + div > div');
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText('2 days ago');
  await expect(history.nth(0)).toContainText('65×8');
  await expect(history.nth(0)).toContainText('70×6');
  await expect(history.nth(0)).not.toContainText('99×1');
  await expect(history.nth(1)).toContainText('5 days ago');
  await expect(history.nth(1)).toContainText('felt good');
  await expect(history.nth(2)).toContainText(/\w{3} \d{1,2}|\d{1,2} \w{3}/);
  await expect(history.nth(2)).toContainText('60×9');
  await expect(card(page, 'Barbell Row')).toContainText('No previous data');

  // Pre-fill copies the latest execution set by set and repeats its last set.
  await expect(weights(page, 'Bench Press')).toHaveCount(3);
  for (const [i, [w, r]] of [['65', '8'], ['70', '6'], ['70', '6']].entries()) {
    await expect(weights(page, 'Bench Press').nth(i)).toHaveValue(w);
    await expect(reps(page, 'Bench Press').nth(i)).toHaveValue(r);
  }
  await expect(weights(page, 'Barbell Row')).toHaveCount(2);
  await expect(weights(page, 'Barbell Row').first()).toHaveValue('');

  const docs = await readDocs(page);
  const session = activeSession(docs);
  expect(session).toMatchObject({ planId: 'p1', planName: 'PPL', dayId: 'd1', dayName: 'Push', finishedAt: null, sessionNotes: '' });
  expect(exercisesOf(docs).map((e) => e.sets.every((s) => s.completedAt === null))).toEqual([true, true]);
});

test('an active session shows the resume banner and /start redirects to In-Gym', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs() });
  await startPush(page);
  await expect(page.getByText('Active session — tap to resume')).toHaveCount(0);
  await nav(page, 'Library');
  await expect(page.getByText('Active session — tap to resume')).toBeVisible();
  await page.getByText('Active session — tap to resume').click();
  await expect(page).toHaveURL(/\/in-gym$/);
  await page.goto('/start');
  await expect(page).toHaveURL(/\/in-gym$/);
  await expect(page.getByText('PPL • Push')).toBeVisible();
});

test('rapid set completions all persist through the serialized session shadow', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs() });
  await startPush(page);
  const done = page.getByRole('button', { name: 'Mark set complete' });
  await expect(done).toHaveCount(5);
  // Tap five set buttons back to back. Each tap is its own task, as on a phone, and no tap waits for a write.
  for (let i = 0; i < 5; i++) await done.first().click();
  await expect(page.getByRole('button', { name: 'Mark set incomplete' })).toHaveCount(5);
  await expectStore(
    page,
    (d) => exercisesOf(d).flatMap((e) => e.sets).filter((s) => s.completedAt !== null).length === 5,
    'all five completions persisted',
  );

  // After a reload the shadow re-seeds from the cache, and edits still keep earlier sets.
  await page.reload();
  await reps(page, 'Barbell Row').first().fill('7');
  await reps(page, 'Barbell Row').first().blur();
  await expectStore(
    page,
    (d) => {
      const ex = exercisesOf(d);
      return ex[1]?.sets[0].reps === 7 && ex.flatMap((e) => e.sets).every((s) => s.completedAt !== null);
    },
    'post-reload edit keeps completions',
  );
});
