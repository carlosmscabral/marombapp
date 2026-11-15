/**
 * Parity spec for the exercise Library (REQ-001, #16).
 * Seeds 66 built-in exercises in canonical English in Firestore while rendering PT-BR names and muscles.
 * Users browse by muscle chip or search, and create, edit, and delete only custom exercises (rendered verbatim).
 */

import { expect, test, type Page } from '@playwright/test';
import { boot, expectStore, nav, readCollection } from './support/app';

const count = (page: Page) => page.getByText(/exercícios? disponíve(?:l|is)$/);
const card = (page: Page, name: string) =>
  page.locator('main button').filter({ has: page.getByRole('heading', { name, exact: true }) });

test.beforeEach(async ({ page }) => {
  await boot(page, { signedIn: true, path: '/library' });
  await expect(count(page)).toHaveText('66 exercícios disponíveis');
});

test('seeds exactly 66 built-in exercises once in canonical English, even after reload', async ({ page }) => {
  const docs = await readCollection(page, 'exercises');
  expect(Object.keys(docs)).toHaveLength(66);
  expect(Object.values(docs).every((d) => d.isCustom === false)).toBe(true);
  expect(Object.values(docs).some((d) => d.name === 'Bench Press')).toBe(true);

  await page.reload();
  await expect(count(page)).toHaveText('66 exercícios disponíveis');
  expect(Object.keys(await readCollection(page, 'exercises'))).toHaveLength(66);
});

test('lists exercises alphabetically in pt-BR and filters by muscle chip and search', async ({ page }) => {
  const names = await page.locator('main h4').allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'pt-BR')));

  await page.getByRole('button', { name: 'Panturrilhas', exact: true }).click();
  await expect(page.locator('main h4')).toHaveCount(6);
  await expect(card(page, 'Panturrilha em Pé')).toBeVisible();

  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.getByPlaceholder('Buscar exercícios ou músculos…').fill('rosca');
  const roscas = await page.locator('main h4').allTextContents();
  expect(roscas.length).toBeGreaterThan(0);
  expect(roscas.every((n) => /rosca/i.test(n))).toBe(true);

  await page.getByPlaceholder('Buscar exercícios ou músculos…').fill('zzz-none');
  await expect(page.getByText('Nenhum exercício encontrado')).toBeVisible();
});

test('matches unaccented PT-BR search queries in Library and ExercisePickerModal', async ({
  page,
}) => {
  const search = page.getByPlaceholder('Buscar exercícios ou músculos…');

  for (const [query, expected] of [
    ['agachamento bulgaro', 'Agachamento Búlgaro'],
    ['triceps testa', 'Tríceps Testa'],
    ['elevacao lateral', 'Elevação Lateral'],
    ['abdomen', 'Prancha'],
    ['gluteo', 'Elevação Pélvica'],
    ['Agachamento Búlgaro', 'Agachamento Búlgaro'],
    ['Skull Crushers', 'Tríceps Testa'],
  ] as const) {
    await search.fill(query);
    await expect(card(page, expected)).toBeVisible();
  }

  await nav(page, 'Planos');
  await page.getByRole('button', { name: 'Criar seu primeiro plano' }).click();
  await page.getByPlaceholder('Nome do plano (ex.: PPL)').fill('PPL');
  await page.getByPlaceholder('Nome do plano (ex.: PPL)').press('Enter');
  await page.getByRole('button', { name: 'Adicionar Dia' }).click();
  await page.getByPlaceholder('Nome do dia (ex.: Push 1)').fill('Dia A');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.getByText('Dia de Treino', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Adicionar Exercício' }).click();
  const picker = page.getByRole('dialog');
  const pickerSearch = picker.getByPlaceholder('Buscar exercícios ou músculos…');
  for (const [query, expected] of [
    ['agachamento bulgaro', 'Agachamento Búlgaro'],
    ['triceps testa', 'Tríceps Testa'],
    ['elevacao', 'Elevação Lateral'],
    ['abdomen', 'Abdominal Supra'],
    ['gluteo', 'Agachamento Búlgaro'],
  ] as const) {
    await pickerSearch.fill(query);
    await expect(picker.getByRole('button', { name: new RegExp(`^${expected}`) })).toBeVisible();
  }
});

test('built-in exercises open read-only details in PT-BR without edit or delete', async ({ page }) => {
  await card(page, 'Supino Reto').click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Supino Reto' })).toBeVisible();
  await expect(sheet.getByText('Peito').first()).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Excluir' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('creates, edits, and deletes a custom exercise (custom name stays verbatim)', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByRole('heading', { name: 'Novo exercício' })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Criar' })).toBeDisabled();
  await form.getByPlaceholder('ex.: Supino Inclinado com Halteres').fill('  Zercher Squat  ');
  await form.getByLabel('Músculo principal').selectOption('quads');
  await form.getByLabel('Submúsculo').selectOption('vastus medialis');
  await form.getByPlaceholder('Dicas de execução, cadência, ajustes…').fill('Bar in elbows');
  await form.getByRole('button', { name: 'Criar' }).click();
  await expect(form).toHaveCount(0);
  await expect(count(page)).toHaveText('67 exercícios disponíveis');

  const created = card(page, 'Zercher Squat');
  await expect(created).toContainText('Personalizado');
  await expect(created).toContainText('Quadríceps · Vasto medial');
  await expectStore(
    page,
    (d) =>
      Object.values(d).some(
        (x) =>
          x.name === 'Zercher Squat' &&
          x.isCustom === true &&
          x.subMuscle === 'vastus medialis' &&
          x.notes === 'Bar in elbows',
      ),
    'custom exercise persisted with trimmed name and canonical subMuscle key',
  );

  await created.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog');
  await expect(edit.getByRole('heading', { name: 'Editar exercício' })).toBeVisible();
  await expect(edit.getByPlaceholder('ex.: Supino Inclinado com Halteres')).toHaveValue('Zercher Squat');
  await edit.getByPlaceholder('ex.: Supino Inclinado com Halteres').fill('Zercher Squat Heavy');
  await edit.getByLabel('Músculo principal').selectOption('glutes');
  await expect(edit.getByLabel('Submúsculo')).toHaveValue('');
  await edit.getByRole('button', { name: 'Salvar' }).click();
  await expect(card(page, 'Zercher Squat Heavy')).toContainText('Glúteos');
  await expect(count(page)).toHaveText('67 exercícios disponíveis');

  await card(page, 'Zercher Squat Heavy').click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('button', { name: 'Excluir' }).click();
  await expect(detail.getByText('Esta ação não pode ser desfeita.')).toBeVisible();
  await detail.getByRole('button', { name: 'Cancelar' }).click();
  await expect(detail.getByRole('button', { name: 'Confirmar' })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Excluir' }).click();
  await detail.getByRole('button', { name: 'Confirmar' }).click();
  await expect(count(page)).toHaveText('66 exercícios disponíveis');
  await expect(card(page, 'Zercher Squat Heavy')).toHaveCount(0);
});

test('custom exercises survive a reload and tab navigation', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.getByPlaceholder('ex.: Supino Inclinado com Halteres').fill('Sissy Squat');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(count(page)).toHaveText('67 exercícios disponíveis');
  await page.reload();
  await expect(card(page, 'Sissy Squat')).toBeVisible();
  await nav(page, 'Análises');
  await nav(page, 'Biblioteca');
  await expect(count(page)).toHaveText('67 exercícios disponíveis');
});
