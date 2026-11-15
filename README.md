# MarombApp

A single-user, mobile-first gym tracker. Build training plans, run workouts in the gym, track progressive overload across sessions. Web only — installable as a PWA from any modern mobile browser.

Stack: React 19, Vite, TypeScript, Tailwind v4, Node.js BFF on Cloud Run + Firebase Auth + Firestore.

## Prerequisites

- Node.js 20+
- GCP / Firebase project (`vibe-cabral`) with:
  - Firestore in Native mode (named databases `marombapp` for production and `marombapp-test` for tests/evals)
  - Authentication with Google provider enabled
  - Cloud Run (`marombapp-serving`, `us-central1`) for unified SPA + BFF serving

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Firebase web-app config, allowlisted Google UID, and non-production Firestore database ID:
   ```dotenv
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_ALLOWED_UID=...
   VITE_FIRESTORE_DATABASE_ID=marombapp-test
   ```

   Tip: you can find your UID after the first successful Google sign-in (shown in the Firebase Auth console). Point local/test development at `marombapp-test` — never write test data to `marombapp` or `(default)`.

3. Check `firestore.rules`, `firebase.json`, and `.firebaserc`:
   - `firestore.rules` enforces single-UID isolation; `.firebaserc` targets `vibe-cabral`; `firebase.json` scopes Firestore rules and indexes to `marombapp` and `marombapp-test`.

4. Run the dev server and verification suite:
   ```bash
   npm run dev
   npm run lint && npm run build && npm test
   ```

## Deploy

Follow [`knowledge-plane/playbooks/DEPLOY.md`](knowledge-plane/playbooks/DEPLOY.md) for the full build, rollout, verification, and rollback runbook:

- **App & BFF serving:** Cloud Run service `marombapp-serving` (`vibe-cabral`, `us-central1`), built from a clean `git archive` export.
- **Firestore rules & indexes:** Deploy **only** to an explicit named database target (`firestore:marombapp` or `firestore:marombapp-test`):
  ```bash
  firebase deploy --only firestore:marombapp --project vibe-cabral
  firebase deploy --only firestore:marombapp-test --project vibe-cabral
  ```
- **Forbidden commands ([ADR-004](knowledge-plane/adr/ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral.md), [ADR-005](knowledge-plane/adr/ADR-005-marombapp-db-is-production-marombapp-test-for-tests.md)):** Never run a bare `firebase deploy`, `--only hosting`, an unscoped `--only firestore`, or any command targeting the `(default)` Firestore database or Firebase Hosting `vibe-cabral.web.app`.

## Notes

- The PWA icons in `public/icons/` are placeholders. Replace them with real artwork before publishing.
- Firestore offline persistence is enabled; writes are queued and replayed when reconnecting.
- The active workout session is a Firestore document — closing the tab mid-workout is safe.
