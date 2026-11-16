/**
 * Unit tests for the pre-apply post-cutover data-loss guard in `scripts/migrate/target-guard.mjs` (#15, #23, ADR-005).
 * Proves each guard branch blocks `--apply` with zero mutations while allowing pre-cutover leftovers on unmigrated DBs.
 */

import { describe, expect, it } from 'vitest';
import {
  POST_CUTOVER_OVERWRITE_FLAG,
  formatMigrationReport,
  parseCliArgs,
  runCopyMigration,
} from '../../scripts/migrate/copy-default-to-marombapp.mjs';
import { InMemoryFirestore } from './support/inMemoryFirestore';

describe('copy-default-to-marombapp pre-apply guard (#15, #23, ADR-005)', () => {
  function makeBaseSource() {
    return new InMemoryFirestore('(default)', {
      'exercises/ex-1': { name: 'Squat', isCustom: false },
      'plans/plan-src': { name: 'Legacy Plan', active: true },
      'plans/plan-src/days/day-1': { name: 'Leg Day', order: 0 },
      'sessions/sess-src': { status: 'completed', startedAt: 1000 },
    });
  }

  it('parses --force-purge-target-sessions flags with post-cutover override and rejects empty ID lists', () => {
    expect(
      parseCliArgs(['--apply', POST_CUTOVER_OVERWRITE_FLAG, '--force-purge-target-sessions']),
    ).toMatchObject({
      dryRun: false,
      overwriteLiveDataAfterCutover: true,
      forcePurgeTargetSessions: true,
    });
    expect(
      parseCliArgs([
        '--apply',
        POST_CUTOVER_OVERWRITE_FLAG,
        '--force-purge-target-sessions=s1,s2',
      ]),
    ).toMatchObject({
      dryRun: false,
      overwriteLiveDataAfterCutover: true,
      forcePurgeTargetSessions: ['s1', 's2'],
    });
    expect(() => parseCliArgs(['--force-purge-target-sessions='])).toThrow(
      /comma-separated/,
    );
  });

  it('blocks --apply with 0 deletes and 0 writes on target-only sessions unless overridden', async () => {
    const source = makeBaseSource();
    const target = new InMemoryFirestore('marombapp', {
      'exercises/ex-1': { name: 'Squat', isCustom: false },
      'plans/plan-src': { name: 'Legacy Plan', active: true },
      'plans/plan-src/days/day-1': { name: 'Leg Day', order: 0 },
      'sessions/sess-src': { status: 'completed', startedAt: 1000 },
      'sessions/post-cutover-workout': { status: 'completed', startedAt: 2000 },
    });

    const dry = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: true,
    });
    expect(dry.guard.blocked).toBe(true);
    expect(formatMigrationReport(dry)).toContain(
      'GUARD WOULD BLOCK --apply: sessions=[post-cutover-workout]',
    );

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: target,
        dryRun: false,
        overwriteLiveDataAfterCutover: true,
      }),
    ).rejects.toThrow(/sessions=\[post-cutover-workout\]/);

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: target,
        dryRun: false,
        overwriteLiveDataAfterCutover: true,
        forcePurgeTargetSessions: ['other-id'],
      }),
    ).rejects.toThrow(/sessions=\[post-cutover-workout\]/);

    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
    expect(target.readRaw('sessions/post-cutover-workout')).toEqual({
      status: 'completed',
      startedAt: 2000,
    });

    const forced = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: false,
      overwriteLiveDataAfterCutover: true,
      forcePurgeTargetSessions: ['post-cutover-workout'],
    });
    expect(forced.purgedTargetOnlySessionIds).toEqual(['post-cutover-workout']);
    expect(formatMigrationReport(forced)).toContain('post-cutover-workout');
    expect(target.readRaw('sessions/post-cutover-workout')).toBeUndefined();
  });

  it('blocks --apply with 0 deletes and 0 writes on target-only custom exercises (isCustom === true)', async () => {
    const source = makeBaseSource();
    const target = new InMemoryFirestore('marombapp', {
      'exercises/custom-new': { name: 'Belt Squat', isCustom: true },
    });

    const dry = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: true,
    });
    expect(dry.guard.blocked).toBe(true);
    expect(formatMigrationReport(dry)).toContain(
      'GUARD WOULD BLOCK --apply: customExercises=[custom-new]',
    );

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: target,
        dryRun: false,
        overwriteLiveDataAfterCutover: true,
        forcePurgeTargetSessions: true,
      }),
    ).rejects.toThrow(/customExercises=\[custom-new\]/);

    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
    expect(target.readRaw('exercises/custom-new')).toEqual({
      name: 'Belt Squat',
      isCustom: true,
    });
  });

  it('blocks --apply with 0 deletes and 0 writes on target-only plans that have >= 1 days doc', async () => {
    const source = makeBaseSource();
    const target = new InMemoryFirestore('marombapp', {
      'plans/new-plan': { name: 'Post Cutover Plan', active: true },
      'plans/new-plan/days/day-a': { name: 'Upper', order: 0 },
    });

    const dry = await runCopyMigration({
      sourceDb: source,
      targetDb: target,
      dryRun: true,
    });
    expect(dry.guard.blocked).toBe(true);
    expect(formatMigrationReport(dry)).toContain(
      'GUARD WOULD BLOCK --apply: nonEmptyPlans=[new-plan]',
    );

    await expect(
      runCopyMigration({
        sourceDb: source,
        targetDb: target,
        dryRun: false,
        overwriteLiveDataAfterCutover: true,
        forcePurgeTargetSessions: true,
      }),
    ).rejects.toThrow(/nonEmptyPlans=\[new-plan\]/);

    expect(target.batchCalls).toBe(0);
    expect(target.deleteAttempts).toBe(0);
    expect(target.writeAttempts).toBe(0);
    expect(target.readRaw('plans/new-plan/days/day-a')).toEqual({
      name: 'Upper',
      order: 0,
    });
  });
});
