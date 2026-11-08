/**
 * Locators and seed state shared by the InGym parity specs.
 * Keeping them here lets the start and logging specs assert the same DOM contract.
 */

import type { Page } from '@playwright/test';
import { completedSession, done, libraryDocs, pe, planDocs, sx, type Docs } from './data';

/** PPL plan with a Push day (Bench 3 sets 8-12, Row 2 sets 6-10) and four prior Bench sessions. */
export function gymDocs(): Docs {
  return {
    ...libraryDocs(),
    ...planDocs('PPL', [{ name: 'Push', exercises: [pe('ex-bench', 3, 8, 12), pe('ex-row', 2, 6, 10)] }]),
    ...completedSession('s-old', 20, [sx('ex-bench', [done(55, 10)])]),
    ...completedSession('s-10', 10, [sx('ex-bench', [done(60, 10), done(60, 9)])]),
    ...completedSession('s-5', 5, [sx('ex-bench', [done(62.5, 10), done(62.5, 8)], 'felt good')]),
    ...completedSession('s-2', 2, [sx('ex-bench', [done(65, 8), done(70, 6), { weight: 99, reps: 1, completedAt: null }])]),
  };
}

export const card = (page: Page, name: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name, exact: true, level: 3 }) });

export const restClock = (page: Page) =>
  page.locator('div.sticky').filter({ hasText: 'Rest' }).locator('span.tabular-nums');

export const weights = (page: Page, name: string) => card(page, name).getByPlaceholder('kg');
export const reps = (page: Page, name: string) => card(page, name).getByPlaceholder('reps');

/** Opens /start and picks the Push day, which creates the active session. */
export async function startPush(page: Page): Promise<void> {
  await page.goto('/start');
  await page.getByRole('button', { name: /^Push/ }).click();
  await page.waitForURL(/\/in-gym$/);
}

/** Returns the single active session document from the store, or undefined. */
export function activeSession(docs: Docs): Record<string, unknown> | undefined {
  return Object.entries(docs).find(([p, d]) => p.startsWith('sessions/') && d.status === 'active')?.[1];
}

export type Ex = { exerciseName: string; notes: string; sets: Array<{ weight: number; reps: number; completedAt: number | null }> };
export const exercisesOf = (docs: Docs): Ex[] => (activeSession(docs)?.exercises as Ex[]) ?? [];
