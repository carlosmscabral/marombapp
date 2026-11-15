/**
 * End-to-end session deletion and dangling plan/day reference spec at 390x844 in PT-BR (#13, #16, REQ-002, REQ-006).
 * Verifies finished-session deletion from `SessionDetail` (updating Analytics and In-Gym history),
 * active-session >=44px touch targets, and crash-free rendering of sessions whose plan or day was deleted.
 */

import { expect, type Locator, test } from '@playwright/test';
import { boot, nav, readDocs } from './support/app';
import { completedSession, DAY, done, libraryDocs, pe, planDocs, sx } from './support/data';
import { card, startPush, weights } from './support/gym';

async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test('deletes a finished session from SessionDetail and removes it from Analytics and In-Gym history', async ({
  page,
}) => {
  await boot(page, {
    signedIn: true,
    acceptDialogs: false,
    path: '/analytics',
    docs: {
      ...libraryDocs(),
      ...planDocs('PPL', [{ name: 'Push', exercises: [pe('ex-bench', 2, 8, 10)] }]),
      ...completedSession('w-valid', 3, [sx('ex-bench', [done(60, 8)])], {
        dayName: 'Push',
      }),
      ...completedSession('w-mistake', 1, [sx('ex-bench', [done(100, 10)])], {
        dayName: 'Mistake Push',
      }),
    },
  });

  const header = page.locator('header').filter({ hasText: 'treinos nesta semana' });
  await expect(header).toContainText('2treinos nesta semana');
  await expect(header).toContainText('1.480kg de volume');

  await page.locator('li').filter({ hasText: 'Mistake Push' }).getByRole('button').click();
  await expect(page).toHaveURL(/\/sessions\/w-mistake$/);

  const deleteSessionBtn = page.getByRole('button', { name: 'Excluir treino' });
  await expectTouchTarget(deleteSessionBtn);

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o treino "Mistake Push"? Esta ação não pode ser desfeita.');
    void d.dismiss();
  });
  await deleteSessionBtn.click();
  await expect(page.getByRole('heading', { name: 'Mistake Push', level: 1 })).toBeVisible();

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o treino "Mistake Push"? Esta ação não pode ser desfeita.');
    void d.accept();
  });
  await deleteSessionBtn.click();

  await expect(page).toHaveURL(/\/analytics$/);
  await expect(header).toContainText('1treinos nesta semana');
  await expect(header).toContainText('480kg de volume');
  const recent = page.locator('section').filter({ hasText: 'Treinos recentes' });
  await expect(recent.locator('li h3')).toHaveText(['Push']);
  expect((await readDocs(page))['sessions/w-mistake']).toBeUndefined();

  // Starting Push in In-Gym pre-fills from w-valid (60x8), NOT the deleted w-mistake (100x10).
  await nav(page, 'Treino');
  await startPush(page);
  const bench = card(page, 'Supino Reto');
  await expect(weights(page, 'Supino Reto').first()).toHaveValue('60');
  const historyRows = bench.locator('p:text-is("Últimos treinos") + div > div');
  await expect(historyRows).toHaveCount(1);
  await expect(historyRows.first()).toContainText('60×8');
  await expect(bench).not.toContainText('100×10');

  // Verify >=44px touch targets on active-session set/exercise/session discard controls too.
  await expectTouchTarget(page.getByRole('button', { name: 'Remover Supino Reto' }));
  await expectTouchTarget(bench.getByRole('button', { name: 'Remover última série' }));
  await expectTouchTarget(page.getByRole('button', { name: 'Abandonar' }));
});

test('hides Delete session when an active session is opened directly via /sessions/:sessionId', async ({
  page,
}) => {
  await boot(page, {
    signedIn: true,
    path: '/sessions/w-active',
    docs: {
      ...libraryDocs(),
      ...completedSession('w-active', 0, [sx('ex-bench', [done(60, 8)])], {
        status: 'active',
        finishedAt: null,
        dayName: 'Active Push',
      }),
    },
  });

  await expect(page.getByText('Treino • ativo')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active Push', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Excluir treino' })).toHaveCount(0);
});

test('finished sessions whose plan or day was deleted still render in Analytics, SessionDetail, and In-Gym last-3', async ({
  page,
}) => {
  await boot(page, {
    signedIn: true,
    path: '/plan',
    docs: {
      ...libraryDocs(),
      ...planDocs('PPL', [
        { name: 'Push', exercises: [pe('ex-bench', 2, 8, 10)] },
        { name: 'Bonus Chest', exercises: [pe('ex-bench', 2, 8, 10)] },
      ]),
      'plans/p-old': {
        name: 'Old Split',
        active: false,
        createdAt: Date.now() - 10 * DAY,
        archivedAt: null,
      },
      'plans/p-old/days/d-old': {
        name: 'Old Push',
        order: 0,
        exercises: [pe('ex-bench')],
      },
      ...completedSession('w-plan-gone', 2, [sx('ex-bench', [done(75, 6)])], {
        planId: 'p-old',
        planName: 'Old Split',
        dayId: 'd-old',
        dayName: 'Old Push',
      }),
      ...completedSession('w-day-gone', 1, [sx('ex-bench', [done(80, 5)])], {
        planId: 'p1',
        planName: 'PPL',
        dayId: 'd2',
        dayName: 'Bonus Chest',
      }),
    },
  });

  // Delete Old Split (dangling planId/dayId on w-plan-gone) and Bonus Chest (dangling dayId on w-day-gone).
  const oldRow = page
    .locator('main > div > div > div')
    .filter({ has: page.getByRole('heading', { name: 'Old Split' }) });
  await oldRow.getByRole('button', { name: 'Mais opções' }).click();
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await page.getByRole('heading', { name: 'PPL' }).click();
  await page.getByRole('button', { name: 'Excluir Bonus Chest' }).click();
  await expect(page.getByText('1 dia')).toBeVisible();

  await nav(page, 'Análises');
  const header = page.locator('header').filter({ hasText: 'treinos nesta semana' });
  await expect(header).toContainText('2treinos nesta semana');
  await expect(header).toContainText('850kg de volume');
  const recent = page.locator('section').filter({ hasText: 'Treinos recentes' });
  await expect(recent.locator('li h3')).toHaveText(['Bonus Chest', 'Old Push']);

  await page.locator('li').filter({ hasText: 'Old Push' }).getByRole('button').click();
  await expect(page.getByRole('heading', { name: 'Old Push', level: 1 })).toBeVisible();
  await expect(page.getByText('Old Split', { exact: true })).toBeVisible();
  await expect(page.locator('section').filter({ hasText: 'Volume' }).first()).toContainText('450kg');

  await nav(page, 'Treino');
  await startPush(page);
  await expect(weights(page, 'Supino Reto').first()).toHaveValue('80');
  const history = card(page, 'Supino Reto').locator('p:text-is("Últimos treinos") + div > div');
  await expect(history).toHaveCount(2);
  await expect(history.nth(0)).toContainText('80×5');
  await expect(history.nth(1)).toContainText('75×6');
});
