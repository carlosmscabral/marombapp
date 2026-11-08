/**
 * Parity spec for Analytics and SessionDetail (REQ-001).
 * Analytics loads as a lazy route and shows weekly totals, the muscle split pie, recent sessions,
 * and the progressive-overload line chart. A recent session opens its read-only detail view.
 */

import { expect, test } from '@playwright/test';
import { boot } from './support/app';
import { completedSession, done, libraryDocs, sx, type Docs } from './support/data';

function historyDocs(): Docs {
  return {
    ...libraryDocs(),
    // Inside the last 7 days: 2 sessions. Volume 100*5*2 + 60*10 + 80*5 + 20*10 = 2200.
    ...completedSession('w1', 1, [sx('ex-squat', [done(100, 5), done(100, 5)]), sx('ex-bench', [done(60, 10)])], {
      dayName: 'Legs',
      sessionNotes: 'Deep squats',
    }),
    ...completedSession('w2', 3, [sx('ex-bench', [done(80, 5), { weight: 90, reps: 1, completedAt: null }]), sx('ex-curl', [done(20, 10)])]),
    // Outside the week, but still in recent sessions and the overload trend.
    ...completedSession('old', 12, [sx('ex-bench', [done(50, 10)])], { dayName: 'Old Push' }),
    // Abandoned sessions never appear in Analytics.
    ...completedSession('ab', 2, [sx('ex-row', [done(70, 8)])], { status: 'abandoned', dayName: 'Abandoned Day' }),
  };
}

test('an empty history shows every empty state', async ({ page }) => {
  await boot(page, { signedIn: true, docs: libraryDocs(), path: '/analytics' });
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('sessions this week')).toBeVisible();
  await expect(page.getByText('Complete a few sets this week to see your muscle split.')).toBeVisible();
  await expect(page.getByText('No completed sessions yet. Finish a workout to see it here.')).toBeVisible();
  await expect(page.getByText('Log some completed sets to start tracking progress per exercise.')).toBeVisible();
});

test('weekly totals, muscle split, recent sessions, and overload chart render from history', async ({ page }) => {
  await boot(page, { signedIn: true, docs: historyDocs(), path: '/analytics' });
  const header = page.locator('header').filter({ hasText: 'sessions this week' });
  await expect(header).toContainText('2sessions this week');
  await expect(header).toContainText(`${(2200).toLocaleString('en-US')}kg volume`);

  const split = page.locator('section').filter({ hasText: 'Weekly muscle split' });
  await expect(split).toContainText('Last 7 days · 5 sets');
  await expect(split.locator('.recharts-pie-sector')).toHaveCount(3);
  await expect(split.locator('li')).toHaveText([/chest\s*2\s*sets/, /quads\s*2\s*sets/, /biceps\s*1\s*sets/]);

  const recent = page.locator('section').filter({ hasText: 'Recent sessions' });
  await expect(recent).toContainText('Last 3');
  await expect(recent.locator('li h3')).toHaveText(['Legs', 'Push', 'Old Push']);
  await expect(recent.locator('li').first()).toContainText('Yesterday');
  await expect(recent.locator('li').first()).toContainText('50m · 1,600 kg · 3 sets · 2 exercises');
  await expect(recent).not.toContainText('Abandoned Day');

  const overload = page.locator('section').filter({ hasText: 'Progressive overload' });
  const picker = overload.getByRole('combobox');
  await expect(picker.locator('option')).toHaveText(['Back Squat', 'Barbell Curl', 'Bench Press']);
  await expect(picker).toHaveValue('ex-squat');
  await expect(overload).toContainText('One session logged so far');
  await expect(overload).toContainText('100 kg');

  await picker.selectOption('ex-bench');
  await expect(overload.locator('.recharts-line')).toHaveCount(2);
  await expect(overload.locator('.recharts-line-dots').first().locator('circle')).toHaveCount(3);
  await expect(overload.locator('.recharts-legend-item-text')).toHaveText(['Top weight', 'Volume']);
});

test('a recent session opens its detail and the back link returns to analytics', async ({ page }) => {
  await boot(page, { signedIn: true, docs: historyDocs(), path: '/analytics' });
  await page.locator('li').filter({ hasText: 'Legs' }).getByRole('button').click();
  await expect(page).toHaveURL(/\/sessions\/w1$/);
  await expect(page.getByText('Completed session')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Legs', level: 1 })).toBeVisible();
  await expect(page.getByText('PPL', { exact: true })).toBeVisible();
  await expect(page.getByText('Deep squats')).toBeVisible();
  await expect(page.locator('section').filter({ hasText: 'Duration' }).first()).toContainText('50m');
  await expect(page.locator('section').filter({ hasText: 'Volume' }).first()).toContainText('1,600kg');
  await expect(page.locator('section').filter({ hasText: 'Sets' }).first()).toContainText('3/ 3');

  const squat = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Back Squat' }) });
  await expect(squat).toContainText('Exercise 1');
  await expect(squat).toContainText('1,000 kg');

  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
});

test('session detail shows incomplete sets and a not-found state', async ({ page }) => {
  await boot(page, { signedIn: true, docs: historyDocs(), path: '/sessions/w2' });
  await expect(page.locator('section').filter({ hasText: 'Sets' }).first()).toContainText('2/ 3');
  const bench = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Bench Press' }) });
  await expect(bench).toContainText('400 kg');
  await expect(bench).toContainText('90');

  await page.goto('/sessions/missing-id');
  await expect(page.getByText('Session not found')).toBeVisible();
  await page.getByRole('link', { name: 'Back to analytics' }).click();
  await expect(page).toHaveURL(/\/analytics$/);
});

test('the analytics route loads its code-split chunk on demand', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/Analytics-[\w-]+\.js$/.test(r.url())) chunks.push(r.url());
  });
  await boot(page, { signedIn: true, docs: libraryDocs(), path: '/library' });
  await expect(page.getByText('4 exercises available')).toBeVisible();
  expect(chunks).toHaveLength(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  expect(chunks).toHaveLength(1);
});
