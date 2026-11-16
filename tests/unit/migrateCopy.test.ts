/**
 * Core unit tests for `scripts/migrate/copy-default-to-marombapp.mjs` (#15, ADR-004, ADR-005).
 * Verifies dry-run safety, `(default)` refusal, strict allowlisting, target purge sparing `eval_runs`,
 * verbatim ID and Timestamp copying, bounded batching, and cutover re-run idempotence.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import {
  MAX_BATCH_SIZE,
  assertAllowlistedCollectionPath,
  assertAllowlistedDocPath,
  assertSafeTargetDatabase,
  createReadOnlySource,
  formatMigrationReport,
  parseCliArgs,
  runCopyMigration,
} from '../../scripts/migrate/copy-default-to-marombapp.mjs';
import { InMemoryFirestore } from './support/inMemoryFirestore';

describe('copy-default-to-marombapp core migration (#15, ADR-004, ADR-005)', () => {
  it('defaults CLI parsing to --dry-run and rejects (default), default, or unauthorized --apply', () => {
    expect(parseCliArgs([])).toEqual({
      dryRun: true,
      overwriteLiveDataAfterCutover: false,
      projectId: 'vibe-cabral',
      targetDatabaseId: 'marombapp',
      batchSize: MAX_BATCH_SIZE,
      forcePurgeTargetSessions: false,
    });
    expect(() => parseCliArgs(['--apply'])).toThrow(/retired|--overwrite-live-data-after-cutover/i);
    expect(parseCliArgs(['--apply', '--overwrite-live-data-after-cutover'])).toMatchObject({
      dryRun: false,
      overwriteLiveDataAfterCutover: true,
      targetDatabaseId: 'marombapp',
    });
    expect(() => parseCliArgs(['--dry-run', '--apply'])).toThrow(/Cannot combine/);
    expect(() => parseCliArgs(['--target', '(default)'])).toThrow(/Refusing migration/);
    expect(() => parseCliArgs(['--target=default'])).toThrow(/Refusing migration/);
    expect(() => parseCliArgs(['--batch-size', '401'])).toThrow(/batch-size/);
    expect(() => parseCliArgs(['--unknown'])).toThrow(/Unknown CLI argument/);
    expect(() => assertSafeTargetDatabase(' (default) ')).toThrow(/Refusing migration/);
    expect(() => assertAllowlistedCollectionPath('conversions')).toThrow(/allowlist/);
    expect(() => assertAllowlistedDocPath('eval_runs/run-1')).toThrow(/allowlist/);
  });

  it('refuses to run if targetDatabaseId or targetDb.databaseId is (default) or default', async () => {
    const source = new InMemoryFirestore('(default)', {
      'exercises/ex-1': { name: 'Squat' },
    });
    const defaultTarget = new InMemoryFirestore('(default)');
    const namedDefaultTarget = new InMemoryFirestore('default');

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: defaultTarget,
        targetDatabaseId: '(default)',
        dryRun: false,
      }),
    ).rejects.toThrow(/Refusing migration/);

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: defaultTarget,
        targetDatabaseId: 'marombapp',
        dryRun: false,
      }),
    ).rejects.toThrow(/Refusing migration/);

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: namedDefaultTarget,
        targetDatabaseId: 'marombapp',
        dryRun: false,
      }),
    ).rejects.toThrow(/Refusing migration/);

    expect(defaultTarget.writeAttempts).toBe(0);
    expect(defaultTarget.deleteAttempts).toBe(0);
  });

  it('enforces strict allowlist and deletes/writes nothing in dry-run mode', async () => {
    const source = new InMemoryFirestore('(default)', {
      'exercises/ex-1': {
        name: 'Bench Press',
        equipment: 'Barbell',
        isCustom: false,
      },
      'plans/plan-1': {
        name: 'Strength',
        active: true,
        createdAt: Timestamp.fromMillis(1_700_000_000_000),
      },
      'plans/plan-1/days/day-1': {
        name: 'Day A',
        order: 0,
        exercises: [{ exerciseId: 'ex-1', restSec: 90 }],
      },
      'sessions/sess-1': {
        planId: 'plan-1',
        status: 'completed',
        startedAt: 1000,
        restTimer: null,
      },
      'conversions/conv-1': { roman: 'XLII' },
      'global_workouts/gw-1': { name: 'Unrelated' },
    });
    const target = new InMemoryFirestore('marombapp', {
      'exercises/seed-random-1': { name: 'Bench Press', isCustom: false },
      'plans/empty-test-plan': { name: 'Temp Plan', active: true },
      'eval_runs/eval-1': { overall_status: 'PASS', l1_passed: true },
    });

    const ro = createReadOnlySource(source) as Record<string, unknown>;
    expect(ro.batch).toBeUndefined();
    expect(ro.listCollections).toBeUndefined();
    expect(() => (ro.collection as (p: string) => unknown)('conversions')).toThrow(
      /allowlist/,
    );

    const report = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: true,
    });
    expect(report.dryRun).toBe(true);
    expect(report.totalDeleted).toBe(0);
    expect(report.totalWritten).toBe(0);
    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
    expect(
      source.readCollections.some(
        (c) => c.startsWith('conversions') || c.startsWith('global_workouts'),
      ),
    ).toBe(false);
    expect(target.readCollections.some((c) => c.startsWith('eval_runs'))).toBe(false);
    expect(report.collections.find((c) => c.collection === 'exercises')).toMatchObject({
      source: 1,
      targetBefore: 1,
      wouldDelete: 1,
      wouldWrite: 1,
      targetAfter: 1,
    });
    expect(formatMigrationReport(report)).toContain('DRY-RUN');
  });

  it(
    'purges allowed leftovers, spares eval_runs, copies verbatim fields and Timestamps, and supports cutover re-run',
    async () => {
    const ts = Timestamp.fromMillis(1_715_000_123_456);
    const source = new InMemoryFirestore('(default)', {
      'exercises/ex-built-1': {
        name: 'Pull Up',
        primaryMuscle: 'Back',
        isCustom: false,
        equipment: 'Bodyweight',
      },
      'exercises/ex-custom-1': {
        name: 'Cable Row',
        primaryMuscle: 'Back',
        isCustom: true,
        notes: 'Wide grip',
      },
      'plans/plan-real': {
        name: 'PPL',
        active: true,
        createdAt: ts,
        archivedAt: null,
      },
      'plans/plan-real/days/day-push': {
        name: 'Push',
        order: 0,
        exercises: [{ exerciseId: 'ex-built-1', restSec: 120 }],
      },
      'plans/plan-real/days/day-pull': {
        name: 'Pull',
        order: 1,
        exercises: [{ exerciseId: 'ex-custom-1', restSec: 90 }],
      },
      'sessions/sess-10': {
        planId: 'old-deleted-plan',
        status: 'completed',
        startedAt: 1_715_000_000_000,
        finishedAt: 1_715_003_600_000,
        restTimer: null,
      },
      'conversions/c-99': { number: 99, roman: 'XCIX' },
      'bookings/b-1': { bookingid: 'b-1' },
    });
    const target = new InMemoryFirestore('marombapp', {
      'exercises/auto-seed-1': { name: 'Pull Up', isCustom: false },
      'exercises/auto-seed-2': { name: 'Push Up', isCustom: false },
      'plans/empty-test-plan': { name: 'E2E Plan', active: true },
      'eval_runs/eval-001': { run_id: 'eval-001', overall_status: 'PASS' },
      'eval_runs/eval-002': { run_id: 'eval-002', overall_status: 'PASS' },
    });

    const report = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: false,
      overwriteLiveDataAfterCutover: true,
      batchSize: 2,
    });

    expect(source.writeAttempts).toBe(0);
    expect(source.deleteAttempts).toBe(0);
    expect(source.listCollectionsCalls).toBe(0);
    expect(target.commitSizes.every((n) => n <= 2)).toBe(true);
    expect(report.deleteBatches).toBe(2);
    expect(report.writeBatches).toBe(3);
    expect(report.verification).toEqual({
      verified: true,
      targetEqualsSource: true,
      zeroMutationsVerified: false,
    });

    expect(target.readRaw('exercises/auto-seed-1')).toBeUndefined();
    expect(target.readRaw('plans/empty-test-plan')).toBeUndefined();
    expect(target.readRaw('conversions/c-99')).toBeUndefined();
    expect(target.readRaw('eval_runs/eval-001')).toEqual({
      run_id: 'eval-001',
      overall_status: 'PASS',
    });
    expect(target.readRaw('eval_runs/eval-002')).toEqual({
      run_id: 'eval-002',
      overall_status: 'PASS',
    });

    expect(target.readRaw('exercises/ex-built-1')?.equipment).toBe('Bodyweight');
    const copiedCreatedAt = target.readRaw('plans/plan-real')?.createdAt as Timestamp;
    expect(copiedCreatedAt).toBeInstanceOf(Timestamp);
    expect(copiedCreatedAt.toMillis()).toBe(ts.toMillis());
    expect(target.readRaw('plans/plan-real/days/day-push')).toMatchObject({
      name: 'Push',
      order: 0,
    });
    expect(target.readRaw('sessions/sess-10')).toMatchObject({
      restTimer: null,
      startedAt: 1_715_000_000_000,
    });

    const rerun = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: false,
      overwriteLiveDataAfterCutover: true,
    });
    expect(rerun.verification.verified).toBe(true);
    expect(rerun.verification.targetEqualsSource).toBe(true);
    expect(target.size()).toBe(8);
    expect(target.readRaw('eval_runs/eval-001')).toEqual({
      run_id: 'eval-001',
      overall_status: 'PASS',
    });
  },
  );
});
