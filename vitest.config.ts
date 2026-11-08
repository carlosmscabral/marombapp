/**
 * Vitest configuration for MarombApp unit and component tests.
 * Unit tests run in Node so they stay fast and deterministic.
 * The config excludes Playwright specs so each runner owns only its own files.
 */

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
    environment: 'node',
    testTimeout: 10_000,
    restoreMocks: true,
  },
});
