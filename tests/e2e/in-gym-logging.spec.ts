/**
 * Parity spec for active-session logging in InGym in PT-BR (REQ-001, REQ-002, #16).
 * Covers set logging, the sticky rest count-up that survives a reload, mid-workout set and
 * exercise edits (keeping canonical English exercise names in Firestore), notes, and finish/abandon exits.
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

  await weights(page, 'Supino Reto').first().fill('67.5');
  await reps(page, 'Supino Reto').first().fill('9');
  await card(page, 'Supino Reto').getByRole('button', { name: 'Marcar série como concluída' }).first().click();
  await expect(restClock(page)).toHaveClass(/text-on-surface(?!-)/);
  await page.clock.fastForward(65_000);
  // Real time keeps flowing under the installed clock, so allow a slow container some seconds.
  await expect(restClock(page)).toHaveText(/^01:(0[5-9]|[1-4]\d)$/);

  await page.reload();
  await expect(restClock(page)).toHaveText(/^01:(0[5-9]|[1-5]\d)$/);
  await page.clock.fastForward(60_000);
  await expect(restClock(page)).toHaveText(/^02:(0[5-9]|[1-5]\d)$/);
  await expect(card(page, 'Supino Reto').getByRole('button', { name: 'Desmarcar série concluída' })).toHaveCount(1);
  await expect(weights(page, 'Supino Reto').first()).toHaveValue('67.5');

  // Completing the next set restarts the count from zero.
  await card(page, 'Supino Reto').getByRole('button', { name: 'Marcar série como concluída' }).first().click();
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
  await card(page, 'Supino Reto').getByRole('button', { name: 'Desmarcar série concluída' }).first().click();
  await expectStore(page, (d) => exercisesOf(d)[0]?.sets[0].completedAt === null && exercisesOf(d)[0]?.sets[0].weight === 67.5, 'set un-completed');
});

test('the session clock shows elapsed workout time', async ({ page }) => {
  await page.clock.fastForward('01:02:03');
  await expect(page.getByText(/^1:02:0\d$/)).toBeVisible();
});

test('sets and exercises can be added and removed mid-workout', async ({ page }) => {
  const row = card(page, 'Remada Curvada');
  await reps(page, 'Remada Curvada').nth(1).fill('6');
  await weights(page, 'Remada Curvada').nth(1).fill('50');
  await weights(page, 'Remada Curvada').nth(1).blur();
  await row.getByRole('button', { name: 'Adicionar série' }).click();
  await expect(weights(page, 'Remada Curvada')).toHaveCount(3);
  await expect(weights(page, 'Remada Curvada').nth(2)).toHaveValue('50');
  await expect(reps(page, 'Remada Curvada').nth(2)).toHaveValue('6');

  await row.getByRole('button', { name: 'Marcar série como concluída' }).nth(2).click();
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Remover a última série concluída?');
    void d.dismiss();
  });
  await row.getByRole('button', { name: 'Remover última série' }).click();
  await expect(weights(page, 'Remada Curvada')).toHaveCount(3);
  page.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Remover última série' }).click();
  await expect(weights(page, 'Remada Curvada')).toHaveCount(2);
  await row.getByRole('button', { name: 'Remover última série' }).click();
  await expect(weights(page, 'Remada Curvada')).toHaveCount(1);
  await expect(row.getByRole('button', { name: 'Remover última série' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Adicionar exercício ao treino' }).click();
  const picker = page.getByRole('dialog');
  await expect(picker.getByRole('heading', { name: 'Adicionar Exercício ao Treino' })).toBeVisible();
  await expect(picker.getByRole('button', { name: /^Supino Reto/ })).toContainText('Adicionado');
  await picker.getByRole('button', { name: /^Rosca Direta/ }).click();
  await expect(card(page, 'Rosca Direta')).toContainText('Exercício 3');
  await expect(weights(page, 'Rosca Direta')).toHaveCount(3);

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Remover Remada Curvada deste treino?');
    void d.accept();
  });
  await page.getByRole('button', { name: 'Remover Remada Curvada' }).click();
  await expect(card(page, 'Remada Curvada')).toHaveCount(0);
  await expect(card(page, 'Rosca Direta')).toContainText('Exercício 2');
  await expectStore(
    page,
    (d) => exercisesOf(d).map((e) => `${e.exerciseName}:${e.sets.length}`).join() === 'Bench Press:3,Barbell Curl:3',
    'mid-workout edits persisted with canonical English exerciseName',
  );
});

test('notes persist and finishing opens the session detail', async ({ page }) => {
  await page.getByPlaceholder('Como você está se sentindo hoje?').fill('Strong day');
  await card(page, 'Supino Reto').getByPlaceholder('Observações deste exercício…').fill('Elbows tucked');
  await card(page, 'Supino Reto').getByPlaceholder('Observações deste exercício…').blur();
  await card(page, 'Supino Reto').getByRole('button', { name: 'Marcar série como concluída' }).first().click();
  await page.clock.fastForward('45:00');

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Finalizar este treino?');
    void d.accept();
  });
  await page.getByRole('button', { name: 'Finalizar treino' }).click();
  await expect(page).toHaveURL(/\/sessions\/[A-Za-z0-9]{20}$/);
  await expect(page.getByText('Treino concluído')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Push' })).toBeVisible();
  await expect(page.getByText('Strong day')).toBeVisible();
  await expect(page.getByText('Elbows tucked')).toBeVisible();
  // One completed 65 kg x 8 set out of five planned sets.
  await expect(page.locator('section').filter({ hasText: 'Volume' })).toContainText('520kg');
  await expect(page.locator('section').filter({ hasText: 'Séries' }).first()).toContainText('1/ 5');
  await expect(page.getByText('Treino em andamento — toque para retomar')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('maromba.restTimer'))).toBeNull();

  const id = page.url().split('/').pop() as string;
  const s = (await readDocs(page))[`sessions/${id}`];
  expect(s).toMatchObject({ status: 'completed', sessionNotes: 'Strong day' });
  expect(typeof s.finishedAt).toBe('number');
});

test('abandoning ends the session and keeps it out of history', async ({ page }) => {
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Abandonar este treino? As séries registradas serão mantidas no histórico.');
    void d.accept();
  });
  await page.getByRole('button', { name: 'Abandonar' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum treino ativo' })).toBeVisible();
  const docs = await readDocs(page);
  expect(Object.values(docs).filter((d) => d.status === 'abandoned')).toHaveLength(1);
  expect(Object.values(docs).filter((d) => d.status === 'active')).toHaveLength(0);
});
