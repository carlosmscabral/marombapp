/**
 * Post-cutover retirement and diff-guard unit tests for `scripts/migrate/` (#23, #15, REQ-002, REQ-004, ADR-005).
 * Verifies `--apply` is refused by default after cutover, in-place edits and target deletions block `--apply`
 * even when `--overwrite-live-data-after-cutover` is supplied, and `--dry-run` clearly lists edited/deleted IDs.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  createReadOnlySource,
  evaluateTargetGuard,
  formatMigrationReport,
  parseCliArgs,
  runCopyMigration,
  scanAllowlistedDatabase,
} from '../../scripts/migrate/copy-default-to-marombapp.mjs';
import { InMemoryFirestore } from './support/inMemoryFirestore';

const CUTOVER_PLAN_ID = 'F1gy8Zd2pECD2aRQIPBY';
const CUTOVER_DELETED_DAY_PATH = `plans/${CUTOVER_PLAN_ID}/days/vLWiy4o5gmYm63rBJWi7`;
const CUTOVER_KEPT_DAY_PATH = `plans/${CUTOVER_PLAN_ID}/days/day-kept`;
const CUTOVER_CUSTOM_EX_PATH = 'exercises/sdbKprKdP7qlHnbVuANA';

function makeCutoverSource() {
  return new InMemoryFirestore('(default)', {
    'exercises/ex-builtin': {
      name: 'Bench Press',
      primaryMuscle: 'chest',
      isCustom: false,
      notes: '',
    },
    [CUTOVER_CUSTOM_EX_PATH]: {
      name: 'Machine Preacher Curl',
      primaryMuscle: 'biceps',
      isCustom: true,
      notes: 'Seat 4',
    },
    [`plans/${CUTOVER_PLAN_ID}`]: {
      name: 'Upper / Lower',
      active: true,
      createdAt: Timestamp.fromMillis(1_715_000_000_000),
    },
    [CUTOVER_KEPT_DAY_PATH]: {
      name: 'Upper A',
      order: 0,
      exercises: [{ exerciseId: 'ex-builtin', targetSets: 3, restSec: 90 }],
    },
    [CUTOVER_DELETED_DAY_PATH]: {
      name: 'Old Extra Day',
      order: 1,
      exercises: [{ exerciseId: 'sdbKprKdP7qlHnbVuANA', targetSets: 3, restSec: 60 }],
    },
    'sessions/sess-1': {
      planId: CUTOVER_PLAN_ID,
      status: 'completed',
      startedAt: 1_715_100_000_000,
      finishedAt: 1_715_103_600_000,
    },
  });
}

function makeExactMigratedTarget() {
  return new InMemoryFirestore('marombapp', {
    'exercises/ex-builtin': {
      name: 'Bench Press',
      primaryMuscle: 'chest',
      isCustom: false,
      notes: '',
    },
    [CUTOVER_CUSTOM_EX_PATH]: {
      name: 'Machine Preacher Curl',
      primaryMuscle: 'biceps',
      isCustom: true,
      notes: 'Seat 4',
    },
    [`plans/${CUTOVER_PLAN_ID}`]: {
      name: 'Upper / Lower',
      active: true,
      createdAt: Timestamp.fromMillis(1_715_000_000_000),
    },
    [CUTOVER_KEPT_DAY_PATH]: {
      name: 'Upper A',
      order: 0,
      exercises: [{ exerciseId: 'ex-builtin', targetSets: 3, restSec: 90 }],
    },
    [CUTOVER_DELETED_DAY_PATH]: {
      name: 'Old Extra Day',
      order: 1,
      exercises: [{ exerciseId: 'sdbKprKdP7qlHnbVuANA', targetSets: 3, restSec: 60 }],
    },
    'sessions/sess-1': {
      planId: CUTOVER_PLAN_ID,
      status: 'completed',
      startedAt: 1_715_100_000_000,
      finishedAt: 1_715_103_600_000,
    },
  });
}

describe('post-cutover retirement and edit/delete guard (#23, ADR-005)', () => {
  it('refuses --apply by default (CLI and programmatic) without --overwrite-live-data-after-cutover', async () => {
    expect(() => parseCliArgs(['--apply'])).toThrow(
      /--overwrite-live-data-after-cutover|retired/i,
    );
    expect(() => parseCliArgs(['--dry-run', '--overwrite-live-data-after-cutover'])).toThrow(
      /--apply/i,
    );
    expect(parseCliArgs(['--apply', '--overwrite-live-data-after-cutover'])).toMatchObject({
      dryRun: false,
      overwriteLiveDataAfterCutover: true,
    });

    const source = makeCutoverSource();
    const target = new InMemoryFirestore('marombapp');

    await expect(
      runCopyMigration({ sourceDb: source, targetDb: target, dryRun: false }),
    ).rejects.toThrow(/--overwrite-live-data-after-cutover|retired/i);

    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
  });

  it('blocks --apply with 0 mutations when a migrated target doc was edited in-place', async () => {
    const source = makeCutoverSource();
    const target = makeExactMigratedTarget();
    // Simulate the PO updating primaryMuscle on an existing migrated custom exercise after cutover.
    target.seed(CUTOVER_CUSTOM_EX_PATH, {
      name: 'Machine Preacher Curl',
      primaryMuscle: 'forearms',
      isCustom: true,
      notes: 'Seat 4',
    });

    const srcScan = await scanAllowlistedDatabase(createReadOnlySource(source));
    const tgtScan = await scanAllowlistedDatabase(createReadOnlySource(target));
    const guard = evaluateTargetGuard(srcScan, tgtScan);

    expect(guard.blocked).toBe(true);
    expect(guard.editedDocs).toEqual([CUTOVER_CUSTOM_EX_PATH]);

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: target,
        dryRun: false,
        overwriteLiveDataAfterCutover: true,
        forcePurgeTargetSessions: true,
      } as Parameters<typeof runCopyMigration>[0]),
    ).rejects.toThrow(/editedDocs=\[exercises\/sdbKprKdP7qlHnbVuANA\]/);

    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
    expect(target.readRaw(CUTOVER_CUSTOM_EX_PATH)?.primaryMuscle).toBe('forearms');
  });

  it('blocks --apply with 0 mutations when a migrated doc was deleted in the target', async () => {
    const source = makeCutoverSource();
    const target = new InMemoryFirestore('marombapp', {
      'exercises/ex-builtin': source.readRaw('exercises/ex-builtin')!,
      [CUTOVER_CUSTOM_EX_PATH]: source.readRaw(CUTOVER_CUSTOM_EX_PATH)!,
      [`plans/${CUTOVER_PLAN_ID}`]: source.readRaw(`plans/${CUTOVER_PLAN_ID}`)!,
      [CUTOVER_KEPT_DAY_PATH]: source.readRaw(CUTOVER_KEPT_DAY_PATH)!,
      // CUTOVER_DELETED_DAY_PATH intentionally absent (deleted by PO in marombapp).
      'sessions/sess-1': source.readRaw('sessions/sess-1')!,
    });

    const srcScan = await scanAllowlistedDatabase(createReadOnlySource(source));
    const tgtScan = await scanAllowlistedDatabase(createReadOnlySource(target));
    const guard = evaluateTargetGuard(srcScan, tgtScan);

    expect(guard.blocked).toBe(true);
    expect(guard.deletedDocs).toEqual([CUTOVER_DELETED_DAY_PATH]);

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: target,
        dryRun: false,
        overwriteLiveDataAfterCutover: true,
        forcePurgeTargetSessions: true,
      } as Parameters<typeof runCopyMigration>[0]),
    ).rejects.toThrow(
      /deletedDocs=\[plans\/F1gy8Zd2pECD2aRQIPBY\/days\/vLWiy4o5gmYm63rBJWi7\]/,
    );

    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
    expect(target.readRaw(CUTOVER_DELETED_DAY_PATH)).toBeUndefined();
  });

  it('reports edited and deleted document IDs clearly in --dry-run without mutating target', async () => {
    const source = makeCutoverSource();
    const target = new InMemoryFirestore('marombapp', {
      'exercises/ex-builtin': source.readRaw('exercises/ex-builtin')!,
      [CUTOVER_CUSTOM_EX_PATH]: {
        name: 'Machine Preacher Curl',
        primaryMuscle: 'forearms',
        isCustom: true,
        notes: 'Seat 4',
      },
      [`plans/${CUTOVER_PLAN_ID}`]: {
        name: 'Upper / Lower',
        active: true,
        createdAt: Timestamp.fromMillis(1_715_000_000_000),
      },
      [CUTOVER_KEPT_DAY_PATH]: {
        name: 'Upper A',
        order: 0,
        exercises: [{ exerciseId: 'ex-builtin', targetSets: 4, restSec: 90 }],
      },
      'sessions/sess-1': source.readRaw('sessions/sess-1')!,
    });

    const report = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: true,
    });
    const formatted = formatMigrationReport(report);

    expect(report.dryRun).toBe(true);
    expect(report.guard.blocked).toBe(true);
    expect(report.verification.targetEqualsSource).toBe(false);
    expect(report.guard).toMatchObject({
      editedDocs: [CUTOVER_CUSTOM_EX_PATH, CUTOVER_KEPT_DAY_PATH],
      deletedDocs: [CUTOVER_DELETED_DAY_PATH],
    });
    expect(formatted).toContain(CUTOVER_CUSTOM_EX_PATH);
    expect(formatted).toContain(CUTOVER_KEPT_DAY_PATH);
    expect(formatted).toContain(CUTOVER_DELETED_DAY_PATH);
    expect(formatted).toContain('GUARD WOULD BLOCK --apply');
    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
  });

  it('detects Timestamp differences and added or removed fields as in-place edits', async () => {
    const source = makeCutoverSource();
    const target = makeExactMigratedTarget();
    target.seed(`plans/${CUTOVER_PLAN_ID}`, {
      name: 'Upper / Lower',
      active: true,
      createdAt: Timestamp.fromMillis(1_715_000_000_001),
    });
    target.seed('sessions/sess-1', {
      planId: CUTOVER_PLAN_ID,
      status: 'completed',
      startedAt: 1_715_100_000_000,
      finishedAt: 1_715_103_600_000,
      notes: 'Post-cutover note added in marombapp',
    });

    const report = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: true,
    });

    expect(report.guard.blocked).toBe(true);
    expect(report.guard.editedDocs).toEqual([`plans/${CUTOVER_PLAN_ID}`, 'sessions/sess-1']);
    expect(formatMigrationReport(report)).toContain(
      `Diff (edited in target): plans/${CUTOVER_PLAN_ID}, sessions/sess-1`,
    );
  });
});
