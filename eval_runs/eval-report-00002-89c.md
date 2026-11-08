# Blind L1–L5 Evaluation — `marombapp-serving-00002-89c` (`2f1f585`)

- **Run ID:** `eval-20261108-00002-89c` · **Evaluator:** `domain-evaluator` · **Issue:** #5 (W1-04) · **Date:** 2026-11-08
- **Target:** `https://marombapp-serving-w3ei3fpeiq-uc.a.run.app` (100% traffic on `marombapp-serving-00002-89c`)
- **Source:** `2f1f585be63f4957adbacc7bb503281a931547f0`, extracted with `git archive` to `/tmp/eval-src-2f1f585`
- **JSON:** `/scion-volumes/scratchpad/eval-20261108-00002-89c.json` (`put-eval-run --dry-run` passes)
- **Raw artifacts:** `/scion-volumes/scratchpad/eval-00002-89c-artifacts/` (live-probe JSON, 390x844 screenshot, latency samples, lint/test/build logs, probe scripts)

## Verdict: **FAIL** (L3 and L4 fail; L1, L2 and L5 pass)

| Level | Verdict | Key metric |
|---|---|---|
| L1 Health | PASS | healthz returns 200 strict JSON. `/`, manifest and `sw.js` return 200 |
| L2 Contract | PASS | 401 JSON on protected routes, 404 JSON on unknown `/api/*`, SPA fallback on 7 client routes |
| L3 Domain | **FAIL** | `as_is_functional_parity_pass_rate = 0.0` (target 1.0) · `modular_architecture_compliance_rate = 1.0` |
| L4 Safety | **FAIL** | No secrets in bundles. BFF auth isolation passes. Rules and index are **not deployed** to DB `marombapp`. Zero-regression cannot be verified |
| L5 Latency | PASS | healthz p50 37.7 / p95 42.1 / p99 49.9 ms (SLO 80/250/500) |

## L1 Health — PASS (REQ-003, ADR-001)
```
GET /api/healthz          HTTP 200 application/json  {"status":"ok","revision":"marombapp-serving-00002-89c","firestoreDatabase":"marombapp","aiReady":true}
GET /                     HTTP 200 text/html         <title>MarombApp</title>, theme-color #000e26
GET /manifest.webmanifest HTTP 200 application/manifest+json  name=MarombApp, display=standalone, icons 192/512
GET /sw.js                HTTP 200 application/javascript     Workbox generateSW, 13 precache entries
```
The service worker registers in headless Chromium (`navigator.serviceWorker.getRegistration()` returns true). Minor: `/favicon.ico` returns 404, which logs one console error on load.

## L2 Contract — PASS (REQ-003, REQ-004, REQ-005, ADR-001, ADR-002)
```
GET  /api/auth/session (no token)            401 JSON {"error":"unauthenticated","message":"Missing or malformed Authorization Bearer token"}
GET  /api/auth/session (Bearer invalid)      401 JSON {"error":"unauthenticated","message":"Invalid or expired Firebase ID token"}
POST /api/ai/workout (no token / invalid)    401 JSON (same bodies)
POST /api/ai/evaluate, GET /api/ai/anything  401 JSON
POST /api/ai/workout  Basic auth / "Bearer " / alg:none forged JWT / 2 MB body   401 JSON
OPTIONS /api/ai/workout, POST /api/ai/workout?x=1                              401 JSON
GET|POST /api/unknown-route, GET /api, /api/, /api/healthz/, /api/AI/workout    404 JSON {"error":"not_found"}
GET /api/../api/ai/workout, /api/%2e%2e/index.html                             302 (Google Front End normalization, not app)
/analytics /plan /library /in-gym /start /sessions/123 /does-not-exist          200 text/html, byte-identical to index.html
```
- Code review (`server/app.ts`, `server/auth/middleware.ts`): the auth check runs before any handler. A missing `ALLOWED_UID` fails closed with 403. `/api/ai/*` returns a dormant 501 only after auth. `getVertexClient` is lazy, and healthz never builds the SDK.
- Source checks on `/tmp/eval-src-2f1f585`: `npm ci` exit 0, `npm run lint` exit 0 (check-arch: 57 files), `npm test` exit 0 (8 files, **60 tests**), `npm run build` exit 0.
  `tests/unit/bff.test.ts` covers "non-ALLOWED_UID and unset ALLOWED_UID return HTTP 403 JSON with zero Vertex AI calls" and the FIREBASE_PROJECT_ID audience precedence.
- I could not run the 403 path live, because I hold no valid Firebase token. It is verified by unit test only.

## L3 Domain Quality — FAIL (REQ-001, REQ-002, REQ-006, ADR-003)
### Modular architecture: `modular_architecture_compliance_rate = 1.0` ✅
- Entrypoints: `src/main.tsx` 15, `src/App.tsx` 81, `server/index.ts` 27 lines (limit 200).
- Largest modules: `Analytics.tsx` 290, `PlanDay.tsx` 287, `InGym.tsx` 287, `db/sessions.ts` 281 (limit 300). Nothing is over the limit.
- My own scan (`cycles.mjs`, separate from check-arch) finds **0 import cycles** in 48 source files, and all 48 files start with a module docblock. Spot check finds no `;` in doc-comment prose.

### As-is functional parity: `as_is_functional_parity_pass_rate = 0/8 = 0.0` ❌
| # | Journey | E2E spec in 2f1f585 | Live 390x844 | Result |
|---|---|---|---|---|
| 1 | Single-UID Auth gate | none | Blank page, gate never renders | FAIL |
| 2 | 66-exercise seed + Library CRUD | none (unit: `seed.test.ts` asserts 66) | blocked | FAIL |
| 3 | Plan & PlanDay ordering/targets | none | blocked | FAIL |
| 4 | InGym set logging | none | blocked | FAIL |
| 5 | Reload-persistent RestBar (`sessionStorage`) | none (code present in `in-gym/restStorage.tsx`) | blocked | FAIL |
| 6 | Last-3 progressive overload | none (unit: `history.test.ts`) | blocked | FAIL |
| 7 | Analytics charts (`React.lazy`) | none (lazy chunk `Analytics-*.js` served) | blocked | FAIL |
| 8 | SessionDetail | none | blocked | FAIL |

- **No Playwright suite exists:** there is no `@playwright/*` dependency, no e2e directory, and `npm test` is `vitest run` (unit only).
- **Live headless Chromium probe** (`/usr/bin/chromium`, 390x844, isMobile): every route returns 200, but `#root` stays **empty**. Every page throws an uncaught `FirebaseError: Firebase: Error (auth/invalid-api-key).` The live bundle contains `initializeApp({apiKey:"",authDomain:"",projectId:"",appId:""})`. This matches open PO decision #7. Screenshot: `artifacts/live-root-390x844.png`.
- Mitigating evidence (not counted in the metric): `src/screens/**` is byte-identical to seed commit `1b268f8`. Only `src/lib/firebase.ts` (database ID parameter), `src/lib/apiClient.ts` (new, unused by UI) and `vite-env.d.ts` changed. The code-level regression risk is low, but no journey is *verified*.

## L4 Safety & Grounding — FAIL (REQ-002, REQ-004, REQ-005, ADR-001, ADR-002, ADR-003)
- **Secrets in client bundles: PASS.** I downloaded every live precached asset (index.html, 6 JS/CSS chunks, sw.js, workbox, registerSW, manifest) and scanned it and local `dist/`.
  No matches for `private_key`, `BEGIN PRIVATE`, `client_email`, `@google/genai`, `GoogleGenAI`, `aiplatform.googleapis`, `generativelanguage`, `AIza`, `ya29.`, `service_account`, `GOOGLE_CLOUD_PROJECT` or `ALLOWED_UID`.
  The only `vertex` hits are the Firebase SDK registry string `fire-vertex` and recharts `invertExtent`, so they are benign.
- **BFF single-UID isolation: PASS.** See L2.
- **firestore.rules: content PASS, deployment FAIL.** The rules allow read and write only when `request.auth.uid == 'iELlq0wRQhR2F5NmrM6pbMSrJuj1'`.
  However, `firebaserules.googleapis.com` returns **404** for both `releases/cloud.firestore` and `releases/cloud.firestore/marombapp` on `cabral-scion-hub`, and the rulesets list is empty.
  `gcloud firestore indexes composite list --database=marombapp` lists **0 items**, so the `sessions(status ASC, finishedAt DESC)` index is missing. DB `marombapp` exists (FIRESTORE_NATIVE, us-central1).
- **Unrequested AI UI: PASS.** No screen or component references Gemini, Vertex or `/api/ai`, and `apiClient` has no UI importer.
- **Zero behavioral regression / offline / reload: NOT VERIFIABLE.** The live app does not render.

## L5 Latency — PASS
5 warmup requests, then N=50 sequential `curl` requests with `timeout 30s`. Each request opens a new TLS connection, and client-side `time_total` is measured.
```
/api/healthz      n=50 codes=[200] min=33.1 p50=37.7 p95=42.1 p99=49.9 max=49.9 mean=38.1 ms
/api/auth/session n=50 codes=[401] min=34.1 p50=38.9 p95=46.2 p99=49.8 max=49.8 mean=39.3 ms
```

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | FAIL | No 390x844 Playwright parity suite. Vitest only (60 tests) |
| REQ-002 | BLOCKED | No AI UI, and screens are unchanged since seed. The live app white-screens (PO #7) |
| REQ-003 | PASS | BFF, SPA fallback and healthz work. SA `marombapp-run@`, port 8080 |
| REQ-004 | PARTIAL | BFF 401/403 is correct. Rules and index are not deployed to `marombapp`. `FIREBASE_PROJECT_ID` is unset |
| REQ-005 | PASS | Lazy Vertex adapter and dormant `/api/ai`. Zero keys in client bundles |
| REQ-006 | PASS | Line limits, acyclic imports and docblocks all pass |

## Actionable findings (for eval-lead to triage into `eval-finding` issues)
1. **F1 — REQ-001 (L3, high):** Add the 390x844 Playwright parity suite that covers all 8 journeys. Use the Firebase Auth emulator + Firestore emulator, or the `marombapp` DB, and never `vibe-cabral` data. Wire it into `npm test` or a documented `test:e2e`.
2. **F2 — REQ-002 (L3/L4, high, blocked on PO #7):** The live bundle has an empty `VITE_FIREBASE_*` config, and the app crashes to a blank page on every route.
   Secondary point: the client has no guard for missing or invalid Firebase config. An uncaught `auth/invalid-api-key` blanks the app instead of showing the Auth gate or an error state. Consider a fail-visible guard, as long as it keeps as-is UX.
3. **F3 — REQ-004 / ADR-002 (L4, high):** Deploy `firestore.rules` and `firestore.indexes.json` to DB `marombapp`.
   **Risk:** the `firebase.json` `firestore` block has no `"database": "marombapp"`, and `.firebaserc` default is `vibe-cabral`. A plain `firebase deploy --only firestore` would therefore target the **production vibe-cabral `(default)`** DB. Add explicit database/project targeting before any rules deploy.
   The rules also hard-code the vibe-cabral UID. That UID must match the Auth project chosen in PO #7.
4. **F4 — REQ-004 / ADR-002 (L2/L4, medium):** Cloud Run env has no `FIREBASE_PROJECT_ID`, so the token audience falls back to `cabral-scion-hub`. Today this fails closed. Set it together with the PO #7 decision.
5. **F5 — REQ-004 (L4, medium):** The live client bundle bakes `VITE_FIREBASE_ALLOWED_UID` as an empty string. Once config arrives, the client UID gate would reject the owner. Supply it with the PO #7 build args.
6. **F6 — minor (L1):** `/favicon.ico` returns 404 and logs a console error. `/api/healthz/` (trailing slash) returns 404 JSON.

## Note on method
- An early batch of edge probes returned GFE HTML 400s. My zsh loop had not word-split the method string. I re-ran them under bash, and the results above are the valid ones.
- `golden/` holds no versioned dataset yet (README only). The parity journeys come from the brief and the oracle.
