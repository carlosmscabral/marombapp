# Blind L1–L5 Evaluation + Re-Verification (#9, #10) — `marombapp-serving-00003-4vq` (`6f3d1ce`)

- **Run ID:** `eval-20261108-00003-4vq` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Issue:** #5 · **Date:** 2026-11-08
- **Target:** `https://marombapp-serving-w3ei3fpeiq-uc.a.run.app` (100% traffic on `marombapp-serving-00003-4vq`)
- **Source:** `6f3d1ce8adde8fae306ba0338e8617e1831cbce7`, extracted with `git archive` to `/tmp/eval-src-6f3d1ce`. New since the last run: `4787e4d` (Playwright suite), `f121e16` (#10 Part 1), `6f3d1ce` (#9).
- **JSON:** `/scion-volumes/scratchpad/eval-20261108-00003-4vq.json` (`put-eval-run --dry-run` exit 0)
- **Raw artifacts:** `/scion-volumes/scratchpad/eval-00003-4vq-artifacts/` (E2E/unit/lint/build logs, live probe JSON and screenshot, latency samples, scripts)

## Verdict: **FAIL** — only L4-01 is open (rules and index undeployed, blocked on PO #7)

| Level | Verdict | Key metric |
|---|---|---|
| L1 Health | PASS | healthz 200 strict JSON, revision `marombapp-serving-00003-4vq`. The service worker registers |
| L2 Contract | PASS | 401 JSON on protected routes. 404/405 JSON on `/api/*`. SPA fallback on all client routes |
| L3 Domain | PASS | `as_is_functional_parity_pass_rate` = `e2e_parity_pass_rate` = **1.0** (34/34 tests, 8/8 journeys) · `modular_architecture_compliance_rate` = **1.0** |
| L4 Safety | **FAIL** | No secrets and no AI UI. `firebase.json` is fixed. Rules and composite index are **still undeployed** on DB `marombapp` |
| L5 Latency | PASS | healthz p50 52.4 / p95 73.1 / p99 92.1 ms (SLO 80/250/500) |

Compared with run `eval-20261108-00002-89c`, parity rose from 0.0 to 1.0, L3 went from FAIL to PASS, and the live white-screen is gone.

## Issue re-verification
### #9 — **RESOLVED** (recommend eval-lead confirm `status:verified`)
- **Live 390x844 Chromium** (`/usr/bin/chromium`, isMobile) on `/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`:
  - Every route returns 200 and `#root` mounts SignIn (2284 chars). The page shows "MarombApp · Sign in to track your training · Firebase: Error (auth/invalid-api-key). · Sign in with Google".
  - There are **0 `pageerror`s** and 0 `<nav>` elements, so no app shell leaks past the gate.
  - Clicking "Sign in with Google" shows the error again with no crash. The only console error is the favicon 404. Screenshot: `artifacts/live3-root-390x844.png`.
- **`src/lib/auth.tsx`:** `isAuthorizedUid()` returns false when `ALLOWED_UID` is empty or blank, so the gate fails closed. `getFirebaseAuth()` and `onAuthStateChanged` sit inside try/catch, so an init error is shown in SignIn instead of unmounting it. `tests/unit/auth.test.tsx` (3 tests) passes.
- **Parity suite exists and passes:** 34/34 tests at 390x844 cover 8/8 golden journeys (see L3). Live authenticated journeys still depend on PO #7, which is tracked there and not in #9.

### #10 — **PARTIALLY RESOLVED** (Part 1 done, Part 2 open; keep `status:blocked`)
- **Part 1 — PASS:**
  - `firebase.json` now uses the array form `"firestore": [{"database": "marombapp", "rules": ..., "indexes": ...}]`.
  - `.firebaserc` keeps `default: vibe-cabral` and adds `hub: cabral-scion-hub`.
  - `knowledge-plane/playbooks/DEPLOY.md` §"Firestore Rules & Composite Indexes" uses `firebase deploy --only firestore:marombapp --project cabral-scion-hub` plus verification commands, marked as blocked on PO #7.
- **Part 2 — FAIL:**
  - `firebaserules…/releases/cloud.firestore/marombapp` returns `NOT_FOUND`, `releases/cloud.firestore` returns `NOT_FOUND`, and the rulesets list is `{}`.
  - `gcloud firestore indexes composite list --project=cabral-scion-hub --database=marombapp` reports `Listed 0 items.`
  - Cloud Run `FIREBASE_PROJECT_ID=cabral-scion-hub` is now **set**, which fixes the old F4.
  - `firestore.rules` still hard-codes UID `iELlq0wRQhR2F5NmrM6pbMSrJuj1`, which is the vibe-cabral account. See F2.

## L1 Health — PASS (L1-01, L1-02)
```
GET /api/healthz          200 application/json  {"status":"ok","revision":"marombapp-serving-00003-4vq","firestoreDatabase":"marombapp","aiReady":true}
GET /manifest.webmanifest 200 application/manifest+json  name=MarombApp display=standalone
GET /sw.js                200 application/javascript     (Workbox; navigator.serviceWorker.getRegistration() = true)
```

## L2 Contract — PASS (L2-01, L2-02)
```
GET  /api/auth/session  (none | Bearer invalid)                           401 JSON unauthenticated
POST /api/ai/workout    (none | Bearer invalid | alg:none JWT)            401 JSON
POST /api/ai/evaluate, GET /api/ai, OPTIONS /api/ai/workout (Basic auth)  401 JSON
GET|POST /api/unknown-route, GET /api, GET /api/healthz/                  404 JSON not_found
POST /api/healthz                                                         405 JSON method_not_allowed
/ /analytics /plan /library /in-gym /start /sessions/123 /nope            200 text/html, byte-identical to index.html
```
Source checks: `npm ci` exit 0, `npm run lint` exit 0 (check-arch: 72 files), `npm run test:unit` exit 0 (9 files, 63 tests). `bff.test.ts` covers the 403 for non-`ALLOWED_UID` and unset `ALLOWED_UID` with zero Vertex AI calls.

## L3 Domain Quality — PASS
`npx playwright test` in `/tmp/eval-src-6f3d1ce` passes **34/34** (2.5 min, 2 workers, project `mobile-390x844`, system Chromium).
- I audited the specs: 222 `expect(` calls, no `.skip`, `.fixme` or `.only`, and `forbidOnly` plus `retries: 0` are set.
- The fakes are aliased in only by `vite.e2e.config.ts`, which writes to `dist-e2e/`. The production `dist/` contains no `e2e-allowed-uid` or `fake-store` strings.

| Golden | Journey | Covering specs | Result |
|---|---|---|---|
| L3-J1 | Single-UID Auth gate | `auth.spec` 8 (signed-out gate, non-allowlisted gets signed out, allowlisted persists across reload, sign-out, popup closed/blocked to redirect, invalid config gives SignIn with 0 page errors) | PASS |
| L3-J2 | 66 seed + Library CRUD | `library.spec` 5 (exactly 66 once even after reload, sort/filter/search, built-ins read-only, custom create/edit/delete, reload survival) | PASS |
| L3-J3 | Plan & PlanDay | `plan.spec` 4 (first plan active, day order and arrows, delete confirm, exercises/targets/notes/order/name, rename/switch/archive) | PASS |
| L3-J4 | InGym set logging | `in-gym-logging` (add/remove sets and exercises, notes, finish, abandon) and `in-gym-start` (session doc, serialized session shadow under rapid completions) | PASS |
| L3-J5 | Reload-persistent RestBar | `in-gym-logging`: counts 01:05+ after a 65 s fast-forward, still counts after `page.reload()`, restarts at 00:00 on the next set | PASS |
| L3-J6 | Last-3 executions | `in-gym-start`: exactly 3 rows newest first, incomplete sets and the 20-day-old session hidden, pre-fill values asserted | PASS |
| L3-J7 | Analytics (React.lazy) | `analytics.spec`: empty states, weekly totals, muscle split, overload chart, on-demand chunk | PASS |
| L3-J8 | SessionDetail | `analytics.spec`: opens from recent sessions, back link, incomplete sets and not-found state. Finishing a workout also opens detail | PASS |

- **Live parity:** J1 (unauthenticated gate) passes live. J1 entry for the allowlisted UID and J2–J8 are **blocked on PO #7**, because the live bundle still ships `apiKey:""`.
- **Caveat (F3):** the suite exercises the UI against in-browser fakes. Real Firestore rules and composite-index behaviour are not covered until live sign-in works.
- **Architecture (L3-ARCH) = 1.0:**
  - Entrypoints: `src/main.tsx` 15, `src/App.tsx` 81, `server/index.ts` 27 lines.
  - Largest module: `Analytics.tsx` 290 (then `PlanDay` 287, `InGym` 287). The new `auth.tsx` and e2e helpers are all ≤300 lines.
  - My own scan finds **0 import cycles** and a docblock at the top of all 48 src/server/scripts files. check-arch passes on 72 files, tests included.

## L4 Safety & Grounding — FAIL (L4-01 fail, L4-02 pass)
- **Secrets: PASS.** I scanned all live precached assets of 00003-4vq (index.html, 6 JS/CSS chunks, sw.js, workbox, registerSW, manifest) and the local `dist/`.
  No hits for `private_key`, `BEGIN PRIVATE`, `client_email`, `@google/genai`, `GoogleGenAI`, `aiplatform.googleapis`, `generativelanguage`, `AIza`, `ya29.`, `service_account`, `GOOGLE_CLOUD_PROJECT`, `e2e-allowed-uid` or `fake-store`.
- **DB isolation config: PASS** (`firebase.json` targets `marombapp`). **Deployment: FAIL** (see #10 Part 2).
- **No unrequested AI UI: PASS.** `src/screens/**` has no new AI surface, and `apiClient` has no UI importer.
- **Offline: PASS.** `persistentLocalCache` and `persistentMultipleTabManager` are kept. `offline.spec` reloads without network, serves the cached shell, and keeps logging sets.

## L5 Latency — PASS (L5-01)
```
/api/healthz      n=50 [200] min=35.7 p50=52.4 p95=73.1 p99=92.1 max=92.1 ms
/api/auth/session n=50 [401] min=41.1 p50=54.7 p95=89.0 p99=90.1 max=90.1 ms
```
These are 5 warmups, then 50 sequential `curl` requests, each with a new TLS connection. They are higher than the last run (p50 was 37.7), but well inside the SLO.

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | Vitest 63 + Playwright 34 at 390x844, all 8 journeys, no vibe-cabral data |
| REQ-002 | PARTIAL | No AI UI, offline verified, and the live app shows SignIn. Live parity past sign-in awaits PO #7 |
| REQ-003 | PASS | BFF, SPA fallback, healthz. SA `marombapp-run@`, port 8080 |
| REQ-004 | PARTIAL | BFF and client gate fail closed. `firebase.json` and `FIREBASE_PROJECT_ID` are fixed. Rules and index are undeployed, and the rules UID does not match hub Auth |
| REQ-005 | PASS | Lazy Vertex adapter, dormant `/api/ai`, zero credentials in bundles |
| REQ-006 | PASS | All line limits met, acyclic imports, docblocks present |

## Open findings
1. **F1 — L4-01 / REQ-004 / ADR-002 (#10 Part 2, blocked on PO #7):** Deploy `firestore.rules` and the `sessions(status ASC, finishedAt DESC)` index to DB `marombapp`. No new issue is needed, because #10 tracks it.
2. **F2 — REQ-004 (new, medium):** Cloud Run now verifies tokens against `FIREBASE_PROJECT_ID=cabral-scion-hub`. `firestore.rules` still allows only the vibe-cabral UID `iELlq0wRQhR2F5NmrM6pbMSrJuj1`.
   Under hub Firebase Auth the owner gets a different UID. The rules UID, the BFF `ALLOWED_UID` and `VITE_FIREBASE_ALLOWED_UID` must be aligned in the same change that resolves PO #7, or the owner will be locked out (fail-closed, not a leak). eval-lead may fold this into #10.
3. **F3 — L3 caveat (info):** The E2E parity suite runs against fakes. Once PO #7 lands, re-run the live J1–J8 probe against real Firestore, which also exercises the composite index.
4. **F4 — minor (L1):** `/favicon.ico` returns 404 and logs one console error on load.
