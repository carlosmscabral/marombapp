/**
 * Test-only Vite config for the Playwright parity suite.
 * It extends the production config and swaps the Firebase SDK for in-browser fakes.
 * Only `npm run test:e2e` loads this file. Thus `npm run build` always bundles the real SDK.
 * The e2e build goes to `dist-e2e/`, so it never mixes with the deployable `dist/`.
 * Specs run against a production build because dev-mode StrictMode runs effects twice.
 */

import path from 'path';
import { defineConfig, mergeConfig, type UserConfig } from 'vite';
import baseConfig from './vite.config';

const fake = (name: string) => path.resolve(__dirname, 'tests/e2e/fakes', name);

/** The fake Google popup returns this uid unless a spec chooses another one. */
export const E2E_ALLOWED_UID = 'e2e-allowed-uid';

export default defineConfig((env) => {
  const base = (typeof baseConfig === 'function' ? baseConfig(env) : baseConfig) as UserConfig;
  return mergeConfig(base, {
    resolve: {
      alias: [
        { find: /^firebase\/app$/, replacement: fake('firebase-app.ts') },
        { find: /^firebase\/auth$/, replacement: fake('firebase-auth.ts') },
        { find: /^firebase\/firestore$/, replacement: fake('firebase-firestore.ts') },
      ],
    },
    define: {
      'import.meta.env.VITE_FIREBASE_ALLOWED_UID': JSON.stringify(E2E_ALLOWED_UID),
    },
    build: { outDir: 'dist-e2e', emptyOutDir: true },
    server: { hmr: false },
  } satisfies UserConfig);
});
