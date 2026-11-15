/**
 * Parity spec for Plan and PlanDay management in PT-BR (REQ-001, #16).
 * Covers plan create, rename, set-active, and archive, day add, reorder, and delete,
 * and per-day exercise add, reorder, remove, targets, and notes while preserving canonical Firestore IDs.
 */

import { expect, test, type Page } from '@playwright/test';
import { boot, expectStore, readCollection, readDocs } from './support/app';
import { libraryDocs, pe, planDocs } from './support/data';

const dayNames = (page: Page) => page.locator('main h4').allTextContents();

async function createPlan(page: Page, name: string, first = false) {
  await page.getByRole('button', { name: first ? 'Criar seu primeiro plano' : 'Criar plano' }).click();
  await page.getByPlaceholder('Nome do plano (ex.: PPL)').fill(name);
  await page.getByPlaceholder('Nome do plano (ex.: PPL)').press('Enter');
}

async function addDay(page: Page, name: string) {
  await page.getByRole('button', { name: 'Adicionar Dia' }).click();
  await page.getByPlaceholder('Nome do dia (ex.: Push 1)').fill(name);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  // Adding a day opens it. Return to the plan detail view.
  await expect(page.getByText('Dia de Treino', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
}

test('the first plan becomes active and days keep their order', async ({ page }) => {
  await boot(page, { signedIn: true, docs: libraryDocs(), path: '/plan' });
  await expect(page.getByText('Você ainda não tem nenhum plano.')).toBeVisible();
  await createPlan(page, 'PPL', true);

  await expect(page.getByPlaceholder('Nome do plano')).toHaveValue('PPL');
  await expect(page.getByText('Plano ativo')).toBeVisible();
  await expect(page.getByText('Nenhum dia de treino ainda. Adicione um para começar.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar Treino' })).toHaveCount(0);

  for (const d of ['Push', 'Pull', 'Legs']) await addDay(page, d);
  await expect(page.getByText('3 dias')).toBeVisible();
  expect(await dayNames(page)).toEqual(['Push', 'Pull', 'Legs']);
  await expect(page.getByRole('button', { name: 'Iniciar Treino' })).toBeVisible();

  const days = Object.values(await readCollection(page, `plans/${await planId(page)}/days`));
  expect(days.map((d) => [d.name, d.order]).sort()).toEqual([['Legs', 2], ['Pull', 1], ['Push', 0]]);
});

test('days reorder with arrows, and deletion asks for confirmation', async ({ page }) => {
  await boot(page, {
    signedIn: true,
    acceptDialogs: false,
    path: '/plan',
    docs: { ...libraryDocs(), ...planDocs('PPL', [{ name: 'Push', exercises: [] }, { name: 'Pull', exercises: [] }, { name: 'Legs', exercises: [] }]) },
  });
  await page.getByRole('heading', { name: 'PPL' }).click();
  await expect.poll(() => dayNames(page)).toEqual(['Push', 'Pull', 'Legs']);
  await expect(page.getByRole('button', { name: 'Mover para cima' }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mover para baixo' }).last()).toBeDisabled();

  await page.getByRole('button', { name: 'Mover para baixo' }).first().click();
  await expect.poll(() => dayNames(page)).toEqual(['Pull', 'Push', 'Legs']);
  await page.getByRole('button', { name: 'Mover para cima' }).last().click();
  await expect.poll(() => dayNames(page)).toEqual(['Pull', 'Legs', 'Push']);

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o dia de treino "Legs"?');
    void d.dismiss();
  });
  await page.getByRole('button', { name: 'Excluir Legs' }).click();
  await expect.poll(() => dayNames(page)).toEqual(['Pull', 'Legs', 'Push']);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Excluir Legs' }).click();
  await expect.poll(() => dayNames(page)).toEqual(['Pull', 'Push']);

  await page.reload();
  await page.getByRole('heading', { name: 'PPL' }).click();
  await expect.poll(() => dayNames(page)).toEqual(['Pull', 'Push']);
  const days = await readCollection(page, 'plans/p1/days');
  expect(days['plans/p1/days/d2'].order).toBe(0);
  expect(days['plans/p1/days/d1'].order).toBe(2);
});

test('a day edits exercises, targets, notes, order, and name', async ({ page }) => {
  await boot(page, {
    signedIn: true,
    path: '/plan',
    docs: { ...libraryDocs(), ...planDocs('PPL', [{ name: 'Push', exercises: [] }]) },
  });
  await page.getByRole('heading', { name: 'PPL' }).click();
  await page.getByRole('heading', { name: 'Push' }).click();
  await expect(page.getByText('Nenhum exercício ainda. Adicione um para montar este dia.')).toBeVisible();

  for (const name of ['Supino Reto', 'Remada Curvada']) {
    await page.getByRole('button', { name: 'Adicionar Exercício' }).click();
    const picker = page.getByRole('dialog');
    await picker.getByPlaceholder('Buscar exercícios ou músculos…').fill(name.split(' ')[1]);
    await picker.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  }
  await expect(page.getByText('2 exercícios')).toBeVisible();
  await expectStore(page, (d) => (d['plans/p1/days/d1'].exercises as unknown[]).length === 2, 'two exercises saved');
  const saved = (await readDocs(page))['plans/p1/days/d1'].exercises;
  expect(saved).toEqual([pe('ex-bench'), pe('ex-row')]);

  // The picker marks exercises that the day already contains.
  await page.getByRole('button', { name: 'Adicionar Exercício' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Supino Reto/ })).toContainText('Adicionado');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();

  // Edit one field at a time and let each save land, as a person moving between fields does.
  const fields: Array<[import('@playwright/test').Locator, string, string, unknown]> = [
    [page.getByRole('spinbutton').nth(0), '5', 'targetSets', 5],
    [page.getByRole('spinbutton').nth(1), '3', 'targetRepsLow', 3],
    [page.getByRole('spinbutton').nth(2), '5', 'targetRepsHigh', 5],
    [page.getByPlaceholder('ex.: pausa no peito, cadência 3-1-1…').first(), 'paused', 'notes', 'paused'],
  ];
  for (const [input, value, key, expected] of fields) {
    await input.fill(value);
    await input.blur();
    await expectStore(page, (d) => (d['plans/p1/days/d1'].exercises as Array<Record<string, unknown>>)[0][key] === expected, `${key} saved`);
  }
  await expectStore(
    page,
    (d) => JSON.stringify((d['plans/p1/days/d1'].exercises as unknown[])[0]) === JSON.stringify({ ...pe('ex-bench', 5, 3, 5), notes: 'paused' }),
    'targets and notes saved',
  );

  await page.getByRole('button', { name: 'Mover para baixo' }).first().click();
  await expect(page.locator('main h4')).toHaveText(['Remada Curvada', 'Supino Reto']);
  await page.getByRole('button', { name: 'Remover exercício' }).first().click();
  await expect(page.locator('main h4')).toHaveText(['Supino Reto']);
  await expectStore(
    page,
    (d) => JSON.stringify(d['plans/p1/days/d1'].exercises) === JSON.stringify([{ ...pe('ex-bench', 5, 3, 5), notes: 'paused' }]),
    'reorder and remove saved without losing targets',
  );

  await page.getByPlaceholder('Nome do dia').fill('Push Heavy');
  await page.getByPlaceholder('Nome do dia').blur();
  await expectStore(page, (d) => d['plans/p1/days/d1'].name === 'Push Heavy', 'day rename saved');
  await page.getByRole('button', { name: 'Voltar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Push Heavy' })).toBeVisible();
  await expect(page.getByText('1 exercício', { exact: true })).toBeVisible();

  await page.getByRole('heading', { name: 'Push Heavy' }).click();
  await page.getByRole('button', { name: 'Excluir dia de treino' }).click();
  await expect(page.getByText('Nenhum dia de treino ainda. Adicione um para começar.')).toBeVisible();
});

test('plans rename, switch the active plan, and archive from the list menu', async ({ page }) => {
  await boot(page, {
    signedIn: true,
    path: '/plan',
    docs: { ...libraryDocs(), ...planDocs('PPL', [{ name: 'Push', exercises: [pe('ex-bench')] }]) },
  });
  await createPlan(page, 'Upper Lower');
  await expect(page.getByText('Definir como plano ativo')).toBeVisible();
  await page.getByPlaceholder('Nome do plano').fill('Upper/Lower');
  await page.getByRole('button', { name: 'Voltar aos planos' }).click();
  await expect(page.getByRole('heading', { name: 'Upper/Lower' })).toBeVisible();

  const row = (name: string) => page.locator('main > div > div > div').filter({ has: page.getByRole('heading', { name }) });
  await expect(row('PPL')).toContainText('Ativo');
  await expect(row('PPL')).toContainText('1 dia');
  await row('Upper/Lower').getByRole('button', { name: 'Mais opções' }).click();
  await page.getByRole('button', { name: 'Definir como ativo' }).click();
  await expect(row('Upper/Lower')).toContainText('Ativo');
  await expect(row('PPL')).not.toContainText('Ativo');
  await expectStore(page, (d) => d['plans/p1'].active === false, 'only one active plan');

  await row('PPL').getByRole('button', { name: 'Mais opções' }).click();
  await page.getByRole('button', { name: 'Renomear' }).click();
  await page.locator('main input:focus').fill('PPL v2');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'PPL v2' })).toBeVisible();

  await row('PPL v2').getByRole('button', { name: 'Mais opções' }).click();
  await page.getByRole('button', { name: 'Arquivar' }).click();
  await expect(page.getByRole('heading', { name: 'PPL v2' })).toHaveCount(0);
  const archived = (await readDocs(page))['plans/p1'];
  expect(typeof archived.archivedAt).toBe('number');
  expect(archived.name).toBe('PPL v2');
});

async function planId(page: Page): Promise<string> {
  const plans = await readCollection(page, 'plans');
  return Object.keys(plans)[0].split('/')[1];
}
