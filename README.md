# MarombApp

A single-user, mobile-first gym tracker. Build training plans, run workouts in the gym, track progressive overload across sessions. Web only — installable as a PWA from any modern mobile browser.

Stack: React 19, Vite, TypeScript, Tailwind v4, Firebase Hosting + Firestore.

## Prerequisites

- Node.js 20+
- A Firebase project with:
  - Firestore (in Native mode)
  - Authentication with Google provider enabled
  - Hosting (for deploy)

## Local development

1. Install dependencies:
   ```
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Firebase web-app config and the Google UID that should be allowed to sign in:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_ALLOWED_UID=...
   ```

   Tip: you can find your UID after the first successful Google sign-in (it will be shown in the Firebase Auth console).

3. Update `firestore.rules` and `.firebaserc`:
   - Replace `REPLACE_WITH_ALLOWED_UID` in `firestore.rules` with your UID.
   - Replace `REPLACE-WITH-PROJECT-ID` in `.firebaserc` with your Firebase project ID.

4. Run the dev server:
   ```
   npm run dev
   ```

## Deploy

```
npm run build
firebase deploy --only hosting,firestore:rules
```

## Notes

- The PWA icons in `public/icons/` are placeholders. Replace them with real artwork before publishing.
- Firestore offline persistence is enabled; writes are queued and replayed when reconnecting.
- The active workout session is a Firestore document — closing the tab mid-workout is safe.
