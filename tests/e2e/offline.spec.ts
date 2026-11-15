/**
 * Parity spec for the offline PWA shell (REQ-002, #16).
 * Registers a Workbox service worker that precaches the shell and serves the PT-BR manifest.
 * If the network drops, a reload still serves the app and the locally cached data.
 * Only this spec allows service workers, so other specs never see a stale cache.
 */

import { expect, test } from '@playwright/test';
import { boot, expectStore, nav } from './support/app';
import { libraryDocs, pe, planDocs } from './support/data';
import { card, exercisesOf, startPush, weights } from './support/gym';

test.use({ serviceWorkers: 'allow' });

test('the manifest is served with the MarombApp identity and pt-BR metadata', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m).toMatchObject({
    name: 'MarombApp',
    short_name: 'Maromba',
    description: 'Diário pessoal de musculação',
    lang: 'pt-BR',
    display: 'standalone',
    start_url: '/',
  });
});

test('a reload without network serves the cached shell and keeps logging sets', async ({ page, context }) => {
  await boot(page, {
    signedIn: true,
    docs: { ...libraryDocs(), ...planDocs('PPL', [{ name: 'Push', exercises: [pe('ex-bench', 2)] }]) },
  });
  await expect(page.getByRole('heading', { name: 'Análises' })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active))).toBe(true);
  // Wait until the worker controls the page, so the precache is complete.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await startPush(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('PPL • Push')).toBeVisible();
  await weights(page, 'Supino Reto').first().fill('40');
  await card(page, 'Supino Reto').getByRole('button', { name: 'Marcar série como concluída' }).first().click();
  await expectStore(page, (d) => exercisesOf(d)[0]?.sets[0].weight === 40, 'offline set persisted locally');

  await nav(page, 'Biblioteca');
  await expect(page.getByText('4 exercícios disponíveis')).toBeVisible();
  await context.setOffline(false);
});
