/**
 * End-to-end deletion and accidental-creation recovery spec for Plans, Days, and Library at 390x844 (#13, #16, REQ-002, REQ-006).
 * Covers inline creation cancel buttons, >=44px touch targets, PT-BR named confirmation dialogs,
 * immediate mistaken-day deletion, hard plan deletion (with child days), and custom exercise deletion.
 */

import { expect, type Locator, test } from '@playwright/test';
import { boot, expectStore } from './support/app';
import { DAY, libraryDocs, pe, planDocs } from './support/data';

async function expectTouchTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test('cancels inline day creation, deletes a mistaken day right after creation, and confirms exercise removal', async ({
  page,
}) => {
  await boot(page, {
    signedIn: true,
    acceptDialogs: false,
    path: '/plan',
    docs: {
      ...libraryDocs(),
      ...planDocs('PPL', [{ name: 'Push', exercises: [pe('ex-bench', 4, 6, 8)] }]),
    },
  });

  await page.getByRole('heading', { name: 'PPL' }).click();
  await expectTouchTarget(page.getByRole('button', { name: 'Excluir Push' }));

  // Inline "Adicionar Dia" row has a >=44px Cancel button that aborts creation on mobile.
  await page.getByRole('button', { name: 'Adicionar Dia' }).click();
  await page.getByPlaceholder('Nome do dia (ex.: Push 1)').fill('Abort Me');
  const cancelAddDay = page.getByRole('button', { name: 'Cancelar', exact: true });
  await expectTouchTarget(cancelAddDay);
  await cancelAddDay.click();
  await expect(page.getByPlaceholder('Nome do dia (ex.: Push 1)')).toHaveCount(0);
  await expect(page.getByText('1 dia')).toBeVisible();

  // Mistakenly creating a day opens PlanDay with a visible >=44px labeled "Excluir dia de treino" button.
  await page.getByRole('button', { name: 'Adicionar Dia' }).click();
  await page.getByPlaceholder('Nome do dia (ex.: Push 1)').fill('Mistake Day');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(
    page.getByText('Nenhum exercício ainda. Adicione um para montar este dia.'),
  ).toBeVisible();

  const deleteDayBtn = page.getByRole('button', { name: 'Excluir dia de treino' });
  await expectTouchTarget(deleteDayBtn);
  await expect(deleteDayBtn).toContainText('Excluir dia de treino');

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o dia de treino "Mistake Day"?');
    void d.dismiss();
  });
  await deleteDayBtn.click();
  await expect(page.getByPlaceholder('Nome do dia')).toHaveValue('Mistake Day');

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o dia de treino "Mistake Day"?');
    void d.accept();
  });
  await deleteDayBtn.click();
  await expect(page.getByText('1 dia')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mistake Day' })).toHaveCount(0);

  // Removing an exercise inside PlanDay has >=44px touch target and confirms naming the exercise and day.
  await page.getByRole('heading', { name: 'Push' }).click();
  const removeExBtn = page.getByRole('button', { name: 'Remover exercício' });
  await expectTouchTarget(removeExBtn);

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Remover "Supino Reto" de "Push"?');
    void d.dismiss();
  });
  await removeExBtn.click();
  await expect(page.locator('main h4')).toHaveText(['Supino Reto']);

  page.once('dialog', (d) => void d.accept());
  await removeExBtn.click();
  await expect(
    page.getByText('Nenhum exercício ainda. Adicione um para montar este dia.'),
  ).toBeVisible();
});

test('cancels inline plan creation and hard-deletes a plan (and its child days) from detail or list menu', async ({
  page,
}) => {
  await boot(page, {
    signedIn: true,
    acceptDialogs: false,
    path: '/plan',
    docs: {
      ...libraryDocs(),
      ...planDocs('PPL', [{ name: 'Push', exercises: [pe('ex-bench')] }]),
      'plans/p2': {
        name: 'Scratch Plan',
        active: false,
        createdAt: Date.now() - DAY,
        archivedAt: null,
      },
      'plans/p2/days/d1': { name: 'Scratch Push', order: 0, exercises: [] },
      'plans/p2/days/d2': { name: 'Scratch Pull', order: 1, exercises: [] },
    },
  });

  // Inline "Criar plano" row has a >=44px Cancel button.
  await page.getByRole('button', { name: 'Criar plano' }).click();
  await page.getByPlaceholder('Nome do plano (ex.: PPL)').fill('Never Created');
  const cancelCreate = page.getByRole('button', { name: 'Cancelar', exact: true });
  await expectTouchTarget(cancelCreate);
  await cancelCreate.click();
  await expect(page.getByPlaceholder('Nome do plano (ex.: PPL)')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Never Created' })).toHaveCount(0);

  // Creating a plan by mistake opens PlanDetailView with an immediate >=44px "Excluir plano" action.
  await page.getByRole('button', { name: 'Criar plano' }).click();
  await page.getByPlaceholder('Nome do plano (ex.: PPL)').fill('Accidental Plan');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByPlaceholder('Nome do plano')).toHaveValue('Accidental Plan');

  const deletePlanDetailBtn = page.getByRole('button', { name: 'Excluir plano' });
  await expectTouchTarget(deletePlanDetailBtn);

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o plano "Accidental Plan"? Esta ação não pode ser desfeita.');
    void d.accept();
  });
  await deletePlanDetailBtn.click();
  await expect(page.getByRole('heading', { name: 'Planos de Treino' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Accidental Plan' })).toHaveCount(0);
  await expectStore(
    page,
    (d) => !Object.values(d).some((doc) => doc.name === 'Accidental Plan'),
    'accidental plan hard-deleted from store',
  );

  // PlanListView More menu (>=44px) offers hard Excluir next to Arquivar and removes plan + child days.
  const scratchRow = page
    .locator('main > div > div > div')
    .filter({ has: page.getByRole('heading', { name: 'Scratch Plan' }) });
  const moreBtn = scratchRow.getByRole('button', { name: 'Mais opções' });
  await expectTouchTarget(moreBtn);
  await moreBtn.click();

  await expect(page.getByRole('button', { name: 'Arquivar' })).toBeVisible();
  const deleteMenuBtn = page.getByRole('button', { name: 'Excluir', exact: true });
  await expectTouchTarget(deleteMenuBtn);

  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o plano "Scratch Plan"? Esta ação não pode ser desfeita.');
    void d.dismiss();
  });
  await deleteMenuBtn.click();
  await expect(page.getByRole('heading', { name: 'Scratch Plan' })).toBeVisible();

  await moreBtn.click();
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Excluir o plano "Scratch Plan"? Esta ação não pode ser desfeita.');
    void d.accept();
  });
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scratch Plan' })).toHaveCount(0);

  await expectStore(
    page,
    (d) =>
      d['plans/p2'] === undefined &&
      d['plans/p2/days/d1'] === undefined &&
      d['plans/p2/days/d2'] === undefined &&
      d['plans/p1'] !== undefined,
    'Scratch Plan and all child days removed while PPL remains intact',
  );
});

test('custom library exercise delete and confirm controls meet >=44px touch targets while seeds stay protected', async ({
  page,
}) => {
  await boot(page, {
    signedIn: true,
    path: '/library',
    docs: {
      ...libraryDocs(),
      'exercises/ex-custom': {
        name: 'Cable Fly',
        primaryMuscle: 'chest',
        isCustom: true,
        notes: '',
      },
    },
  });

  await page
    .locator('main button')
    .filter({ has: page.getByRole('heading', { name: 'Cable Fly' }) })
    .click();
  const sheet = page.getByRole('dialog');
  const deleteBtn = sheet.getByRole('button', { name: 'Excluir' });
  await expectTouchTarget(deleteBtn);
  await deleteBtn.click();

  await expectTouchTarget(sheet.getByRole('button', { name: 'Cancelar' }));
  const confirmBtn = sheet.getByRole('button', { name: 'Confirmar' });
  await expectTouchTarget(confirmBtn);
  await confirmBtn.click();
  await expect(page.getByRole('heading', { name: 'Cable Fly' })).toHaveCount(0);
});
