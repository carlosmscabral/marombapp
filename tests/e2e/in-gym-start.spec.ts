/**
 * Parity spec for starting a workout and the progressive-overload display in PT-BR (REQ-001, #16).
 * StartWorkout lists the active plan's days. Picking a day creates one active session,
 * pre-fills set rows from the latest execution, and shows the last three executions per exercise in pt-BR.
 */

import { expect, test } from '@playwright/test';
import { boot, expectStore, nav, readDocs } from './support/app';
import { libraryDocs } from './support/data';
import { activeSession, card, exercisesOf, gymDocs, reps, startPush, weights } from './support/gym';

test('without an active plan, start workout points to plans', async ({ page }) => {
  await boot(page, { signedIn: true, docs: libraryDocs(), path: '/in-gym' });
  await expect(page.getByRole('heading', { name: 'Nenhum treino ativo' })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar treino' }).click();
  await expect(page.getByRole('heading', { name: 'Nenhum plano ativo' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir para planos' }).click();
  await expect(page.getByRole('heading', { name: 'Planos de Treino' })).toBeVisible();
});

test('start workout lists days with counts and a translated preview', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs(), path: '/start' });
  await expect(page.getByRole('heading', { name: 'PPL' })).toBeVisible();
  const push = page.getByRole('button', { name: /^Push/ });
  await expect(push).toContainText('2 exercícios • 5 séries');
  await expect(push).toContainText('Supino Reto • Remada Curvada');
});

test('picking a day creates a session with history pre-fill and the last three executions', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs() });
  await startPush(page);

  await expect(page.getByText('PPL • Push')).toBeVisible();
  await expect(page.getByText('Treino Ativo')).toBeVisible();
  const bench = card(page, 'Supino Reto');
  await expect(bench).toContainText('Exercício 1');
  await expect(bench).toContainText('8–12 reps');
  await expect(card(page, 'Remada Curvada')).toContainText('6–10 reps');

  // Last three executions, newest first. Incomplete sets and the 20-day-old session stay hidden.
  const history = bench.locator('p:text-is("Últimos treinos") + div > div');
  await expect(history).toHaveCount(3);
  await expect(history.nth(0)).toContainText('há 2 dias');
  await expect(history.nth(0)).toContainText('65×8');
  await expect(history.nth(0)).toContainText('70×6');
  await expect(history.nth(0)).not.toContainText('99×1');
  await expect(history.nth(1)).toContainText('há 5 dias');
  await expect(history.nth(1)).toContainText('62,5×10');
  await expect(history.nth(1)).toContainText('felt good');
  await expect(history.nth(2)).toContainText(/\d{1,2} de [a-zç]{3}\./i);
  await expect(history.nth(2)).toContainText('60×9');
  await expect(card(page, 'Remada Curvada')).toContainText('Sem dados anteriores');

  // Pre-fill copies the latest execution set by set and repeats its last set.
  await expect(weights(page, 'Supino Reto')).toHaveCount(3);
  for (const [i, [w, r]] of [['65', '8'], ['70', '6'], ['70', '6']].entries()) {
    await expect(weights(page, 'Supino Reto').nth(i)).toHaveValue(w);
    await expect(reps(page, 'Supino Reto').nth(i)).toHaveValue(r);
  }
  await expect(weights(page, 'Remada Curvada')).toHaveCount(2);
  await expect(weights(page, 'Remada Curvada').first()).toHaveValue('');

  const docs = await readDocs(page);
  const session = activeSession(docs);
  expect(session).toMatchObject({ planId: 'p1', planName: 'PPL', dayId: 'd1', dayName: 'Push', finishedAt: null, sessionNotes: '' });
  expect(exercisesOf(docs).map((e) => e.exerciseName)).toEqual(['Bench Press', 'Barbell Row']);
  expect(exercisesOf(docs).map((e) => e.sets.every((s) => s.completedAt === null))).toEqual([true, true]);
});

test('an active session shows the resume banner and /start redirects to In-Gym', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs() });
  await startPush(page);
  await expect(page.getByText('Treino em andamento — toque para retomar')).toHaveCount(0);
  await nav(page, 'Biblioteca');
  await expect(page.getByText('Treino em andamento — toque para retomar')).toBeVisible();
  await page.getByText('Treino em andamento — toque para retomar').click();
  await expect(page).toHaveURL(/\/in-gym$/);
  await page.goto('/start');
  await expect(page).toHaveURL(/\/in-gym$/);
  await expect(page.getByText('PPL • Push')).toBeVisible();
});

test('rapid set completions all persist through the serialized session shadow', async ({ page }) => {
  await boot(page, { signedIn: true, docs: gymDocs() });
  await startPush(page);
  const done = page.getByRole('button', { name: 'Marcar série como concluída' });
  await expect(done).toHaveCount(5);
  // Tap five set buttons back to back. Each tap is its own task, as on a phone, and no tap waits for a write.
  for (let i = 0; i < 5; i++) await done.first().click();
  await expect(page.getByRole('button', { name: 'Desmarcar série concluída' })).toHaveCount(5);
  await expectStore(
    page,
    (d) => exercisesOf(d).flatMap((e) => e.sets).filter((s) => s.completedAt !== null).length === 5,
    'all five completions persisted',
  );

  // After a reload the shadow re-seeds from the cache, and edits still keep earlier sets.
  await page.reload();
  await reps(page, 'Remada Curvada').first().fill('7');
  await reps(page, 'Remada Curvada').first().blur();
  await expectStore(
    page,
    (d) => {
      const ex = exercisesOf(d);
      return ex[1]?.sets[0].reps === 7 && ex.flatMap((e) => e.sets).every((s) => s.completedAt !== null);
    },
    'post-reload edit keeps completions',
  );
});
