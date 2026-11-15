/**
 * Parity spec for Analytics and SessionDetail in PT-BR (REQ-001, #16).
 * Analytics loads as a lazy route and shows pt-BR formatted weekly totals, muscle split pie,
 * recent sessions, and progressive-overload line chart. Recent sessions open SessionDetail.
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
  await expect(page.getByRole('heading', { name: 'Análises' })).toBeVisible();
  await expect(page.getByText('treinos nesta semana')).toBeVisible();
  await expect(page.getByText('Conclua algumas séries nesta semana para ver sua divisão muscular.')).toBeVisible();
  await expect(page.getByText('Nenhum treino concluído ainda. Finalize um treino para vê-lo aqui.')).toBeVisible();
  await expect(page.getByText('Registre séries concluídas para acompanhar a evolução por exercício.')).toBeVisible();
});

test('weekly totals, muscle split, recent sessions, and overload chart render in pt-BR from history', async ({ page }) => {
  await boot(page, { signedIn: true, docs: historyDocs(), path: '/analytics' });
  const header = page.locator('header').filter({ hasText: 'treinos nesta semana' });
  await expect(header).toContainText('2treinos nesta semana');
  await expect(header).toContainText('2.200kg de volume');

  const split = page.locator('section').filter({ hasText: 'Divisão muscular da semana' });
  await expect(split).toContainText('Últimos 7 dias · 5 séries');
  await expect(split.locator('.recharts-pie-sector')).toHaveCount(3);
  await expect(split.locator('li')).toHaveText([/Peito\s*2\s*séries/, /Quadríceps\s*2\s*séries/, /Bíceps\s*1\s*série/]);

  const recent = page.locator('section').filter({ hasText: 'Treinos recentes' });
  await expect(recent).toContainText('Últimos 3');
  await expect(recent.locator('li h3')).toHaveText(['Legs', 'Push', 'Old Push']);
  await expect(recent.locator('li').first()).toContainText('Ontem');
  await expect(recent.locator('li').first()).toContainText('50m · 1.600 kg · 3 séries · 2 exercícios');
  await expect(recent).not.toContainText('Abandoned Day');

  const overload = page.locator('section').filter({ hasText: 'Sobrecarga progressiva' });
  const picker = overload.getByRole('combobox');
  await expect(picker.locator('option')).toHaveText(['Agachamento Livre', 'Rosca Direta', 'Supino Reto']);
  await expect(picker).toHaveValue('ex-squat');
  await expect(overload).toContainText('Um treino registrado até agora');
  await expect(overload).toContainText('100 kg');

  await picker.selectOption('ex-bench');
  await expect(overload.locator('.recharts-line')).toHaveCount(2);
  await expect(overload.locator('.recharts-line-dots').first().locator('circle')).toHaveCount(3);
  await expect(overload.locator('.recharts-legend-item-text')).toHaveText(['Maior carga', 'Volume']);
});

test('a recent session opens its detail and the back link returns to analytics', async ({ page }) => {
  await boot(page, { signedIn: true, docs: historyDocs(), path: '/analytics' });
  await page.locator('li').filter({ hasText: 'Legs' }).getByRole('button').click();
  await expect(page).toHaveURL(/\/sessions\/w1$/);
  await expect(page.getByText('Treino concluído')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Legs', level: 1 })).toBeVisible();
  await expect(page.getByText('PPL', { exact: true })).toBeVisible();
  await expect(page.getByText('Deep squats')).toBeVisible();
  await expect(page.locator('section').filter({ hasText: 'Duração' }).first()).toContainText('50m');
  await expect(page.locator('section').filter({ hasText: 'Volume' }).first()).toContainText('1.600kg');
  await expect(page.locator('section').filter({ hasText: 'Séries' }).first()).toContainText('3/ 3');

  const squat = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Agachamento Livre' }) });
  await expect(squat).toContainText('Exercício 1');
  await expect(squat).toContainText('1.000 kg');

  await page.getByRole('link', { name: 'Voltar' }).click();
  await expect(page.getByRole('heading', { name: 'Análises' })).toBeVisible();
});

test('session detail shows incomplete sets and a not-found state', async ({ page }) => {
  await boot(page, { signedIn: true, docs: historyDocs(), path: '/sessions/w2' });
  await expect(page.locator('section').filter({ hasText: 'Séries' }).first()).toContainText('2/ 3');
  const bench = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Supino Reto' }) });
  await expect(bench).toContainText('400 kg');
  await expect(bench).toContainText('90');

  await page.goto('/sessions/missing-id');
  await expect(page.getByText('Treino não encontrado')).toBeVisible();
  await page.getByRole('link', { name: 'Voltar para análises' }).click();
  await expect(page).toHaveURL(/\/analytics$/);
});

test('the analytics route loads its code-split chunk on demand', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/Analytics-[\w-]+\.js$/.test(r.url())) chunks.push(r.url());
  });
  await boot(page, { signedIn: true, docs: libraryDocs(), path: '/library' });
  await expect(page.getByText('4 exercícios disponíveis')).toBeVisible();
  expect(chunks).toHaveLength(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Análises' }).click();
  await expect(page.getByRole('heading', { name: 'Análises' })).toBeVisible();
  expect(chunks).toHaveLength(1);
});
