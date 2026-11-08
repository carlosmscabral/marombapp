/**
 * Unit tests for the `scripts/check-arch.mjs` architecture and STE100 guardrail checker.
 * Verifies repository compliance and tests deliberate failing fixtures inside isolated temporary directories.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkArchitecture } from '../../scripts/check-arch.mjs';

describe('checkArchitecture', () => {
  const tempDirs: string[] = [];

  function makeTempRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marombapp-arch-test-'));
    tempDirs.push(dir);
    return dir;
  }

  function writeRepoFile(root: string, relPath: string, content: string): void {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes on the live MarombApp repository tree', () => {
    const result = checkArchitecture(process.cwd());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checkedFiles).toBeGreaterThan(35);
  });

  it('passes on a compliant temporary fixture repository', () => {
    const root = makeTempRepo();
    writeRepoFile(
      root,
      'src/main.tsx',
      [
        '/**',
        ' * Browser entrypoint fixture.',
        ' * Mounts the application root cleanly.',
        ' */',
        'export const main = true;',
      ].join('\n'),
    );

    const result = checkArchitecture(root);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('flags files missing a leading module header docstring', () => {
    const root = makeTempRepo();
    writeRepoFile(root, 'src/noHeader.ts', 'export const x = 1;\n');

    const result = checkArchitecture(root);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('src/noHeader.ts'))).toBe(true);
    expect(result.errors.some((e) => e.includes('missing leading module header'))).toBe(
      true,
    );
  });

  it('flags semicolons inside module header docstring prose', () => {
    const root = makeTempRepo();
    writeRepoFile(
      root,
      'src/badProse.ts',
      [
        '/**',
        ' * Bad module header with semicolon; violates STE100 rule.',
        ' */',
        'export const bad = true;',
      ].join('\n'),
    );

    const result = checkArchitecture(root);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('src/badProse.ts') && e.includes('forbidden semicolon'),
      ),
    ).toBe(true);
  });

  it('enforces <=200 lines on entrypoints and <=300 lines on regular modules', () => {
    const root = makeTempRepo();
    const header = ['/**', ' * Valid fixture header.', ' */'];
    const entrypointBody = Array.from({ length: 198 }, (_, i) => `export const e${i} = ${i};`);
    writeRepoFile(root, 'src/App.tsx', [...header, ...entrypointBody].join('\n'));

    const moduleBody = Array.from({ length: 298 }, (_, i) => `export const m${i} = ${i};`);
    writeRepoFile(root, 'src/lib/oversized.ts', [...header, ...moduleBody].join('\n'));

    const result = checkArchitecture(root);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('src/App.tsx') && e.includes('exceeds entrypoint limit of 200'),
      ),
    ).toBe(true);
    expect(
      result.errors.some(
        (e) =>
          e.includes('src/lib/oversized.ts') && e.includes('exceeds module limit of 300'),
      ),
    ).toBe(true);
  });

  it('detects relative import cycles and exits non-zero when invoked via CLI', () => {
    const root = makeTempRepo();
    writeRepoFile(
      root,
      'src/cycleA.ts',
      [
        '/**',
        ' * First node in a deliberate import cycle.',
        ' */',
        ['import', '{ b }', 'from', "'./cycleB';"].join(' '),
        'export const a = b + 1;',
      ].join('\n'),
    );
    writeRepoFile(
      root,
      'src/cycleB.ts',
      [
        '/**',
        ' * Second node in a deliberate import cycle.',
        ' */',
        ['import', '{ a }', 'from', "'./cycleA';"].join(' '),
        'export const b = a + 1;',
      ].join('\n'),
    );

    const result = checkArchitecture(root);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.includes('Import cycle detected') &&
          e.includes('src/cycleA.ts') &&
          e.includes('src/cycleB.ts'),
      ),
    ).toBe(true);

    const scriptPath = path.resolve(process.cwd(), 'scripts/check-arch.mjs');
    expect(() => {
      execFileSync('node', [scriptPath, root], { stdio: 'pipe' });
    }).toThrow();
  });
});
