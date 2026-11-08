# Blind L1–L5 Evaluation + Re-Verification (#5, #9, #10, #11) — `marombapp-serving-00002-rf6` (`a446a59`)

- **Run ID:** `eval-20261108-00002-rf6` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Issue:** #5 · **Date:** 2026-11-08
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`. GCP project `vibe-cabral` per [ADR-004]. 50/50 healthz responses report `marombapp-serving-00002-rf6`.
- **Source:** `a446a59a4fd668a3ff943166127a92e2742fabdd`, extracted from `origin/factory/main` with `git archive` to `/tmp/eval-src-a446a59`. New since run `00003-4vq`:
  - `1e66fc0` ADR-004
  - `a446a59` (#10 `.firebaserc`/DEPLOY.md)
  - `0b11c13` (#11) is on trunk but **after** the live commit.
- **JSON:** `/scion-volumes/scratchpad/eval-20261108-00002-rf6.json`. `factory_store.py --project vibe-cabral --dry-run put-eval-run` exits 0. `FIRESTORE_PROJECT` is unset in this container, so `--project` is required.
- **Raw artifacts:** `/scion-volumes/scratchpad/eval-00002-rf6-artifacts/`:
  - pipeline logs, live probe transcripts, live assets, 390x844 UI JSON and screenshot
  - latency samples, index listings, IAM-denial evidence, scripts

## Verdict: **PASS** — 16/16 golden probes (with one evidence caveat on L4-01, F1)

| Level | Verdict | Key metric |
|---|---|---|
| L1 Health | PASS | healthz 200 strict JSON, `revision=marombapp-serving-00002-rf6`. The SW registers at 390x844 |
| L2 Contract | PASS | 401 JSON on all protected probes. 404/405 JSON on `/api/*`. SPA fallback byte-identical on 8 routes |
| L3 Domain | PASS | `as_is_functional_parity_pass_rate` = **1.0** (34/34 E2E, 8/8 journeys) · `modular_architecture_compliance_rate` = **1.0** |
| L4 Safety | PASS | 0 secrets. Real `vibe-cabral` web config. Index `CICAgOjXh4EK` READY on `marombapp`. Unauthenticated Firestore reads are denied |
| L5 Latency | PASS | healthz p50 **40.9** / p95 **57.6** / p99 **85.7** ms (SLO 80/250/500) |

**Δ vs `eval-20261108-00003-4vq`:**
- Overall FAIL → **PASS**. L4 FAIL → PASS: rules and index are now live on `marombapp`.
- The `auth/invalid-api-key` banner is gone, and the live sign-in popup reaches `accounts.google.com`.
- Previous F2 (UID/Auth-project mismatch) is resolved.
- p50 improved from 52.4 to 40.9 ms.

## Issue re-verification
### #5 (W1-04 release in vibe-cabral) — **VERIFIED**
L1–L5 all pass on `00002-rf6` (`a446a59`). The live bundle carries the real Firebase web config:
- `projectId:"vibe-cabral"`
- `authDomain:"vibe-cabral.firebaseapp.com"`
- `appId:"1:280799742875:web:e47e00f1afcdab5e92af3e"`
- ALLOWED_UID default `iELlq0wRQhR2F5NmrM6pbMSrJuj1`
- databaseId default `marombapp`

The vendor chunks (`charts-`, `firebase-auth-`, `firebase-firestore-`) are hash-identical to my local `a446a59` build. Only the app chunks differ, because the config is injected at build time (expected).

### #9 — **RESOLVED** (still resolved; now stronger)
- Live 390x844 `/usr/bin/chromium` (isMobile) on `/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`:
  - every route returns 200 and SignIn mounts ("MarombApp · Sign in to track your training · Sign in with Google")
  - 0 `pageerror`, 0 `<nav>` elements, no `invalid-api-key`
- Clicking **Sign in with Google** opens a popup to `accounts.google.com/v3/signin/identifier?…context_uri=https://marombapp-serving-280799742875…`. The page stays mounted with 0 errors.

### #10 — **RESOLVED** (Part 1 + Part 2; rules content is behaviour-verified, see F1)
- **Part 1 — PASS:**
  - `firebase.json` has `firestore:[{database:"marombapp", rules, indexes}]`.
  - `.firebaserc` has only `default: vibe-cabral`; the stale `hub` alias is gone.
  - `DEPLOY.md` has 0 `cabral-scion-hub` references and uses `marombapp-deployer@vibe-cabral` with `roles/firebaserules.admin` and `roles/datastore.indexAdmin`.
- **Part 2 — PASS:**
  - `gcloud firestore indexes composite list --project=vibe-cabral --database=marombapp` returns `sessions (status ASC, finishedAt DESC, __name__ DESC)` `CICAgOjXh4EK` **READY**.
  - Unauthenticated Firestore REST `GET …/databases/marombapp/documents/{exercises,plans,sessions}?key=<public web key>` returns **403 PERMISSION_DENIED "Missing or insufficient permissions."** This is a rules-engine denial.
  - `firestore.rules` at `a446a59` allows read/write only when `request.auth.uid == 'iELlq0wRQhR2F5NmrM6pbMSrJuj1'`.
- **Not independently readable (F1):** `firebaserules.googleapis.com/v1/projects/vibe-cabral/releases/cloud.firestore/marombapp` and `rulesets/88e55196-…` return **403 IAM** (`firebaserules.releases.get`) for `vibe-agent@`. So I cannot confirm that the release points at ruleset `88e55196` with this exact source.
  - An unauthenticated deny is also what an empty/default-deny DB returns.
  - The non-allowlisted *authenticated* UID case is untested live. Testing it would require creating a Firebase Auth user, which is out of scope.
- **`(default)` untouched (read-only):**
  - `gcloud firestore indexes composite list --database='(default)'` returns 0 indexes, so the sessions index did not leak into `(default)`.
  - The `(default)` rules release (`releases/cloud.firestore`) is not readable (IAM). Firestore operations history is also denied.
  - No write of any kind was made to `(default)`.

### #11 — **RESOLVED ON TRUNK** (live revision predates the cleanup)
- `a446a59` (live) is clean in `.firebaserc` and DEPLOY.md.
- `server/config.ts:21` (a docblock comment) and `tests/unit/bff.test.ts` (fixture values `GOOGLE_CLOUD_PROJECT='cabral-scion-hub'`) still name `cabral-scion-hub` in `a446a59`.
- `0b11c13` on `factory/main` removes them: `git grep cabral-scion-hub HEAD -- server src scripts tests firebase.json .firebaserc DEPLOY.md` returns 0 hits.
- There is no runtime effect. Recommend closing #11 on the trunk evidence; it ships with the next deploy.

## L1 Health — PASS (L1-01, L1-02)
```
GET /api/healthz          200 application/json  {"status":"ok","revision":"marombapp-serving-00002-rf6","firestoreDatabase":"marombapp","aiReady":true}
GET /                     200 text/html (no-cache)
GET /manifest.webmanifest 200 application/manifest+json  name=MarombApp display=standalone
GET /sw.js                200 application/javascript (Workbox; getRegistration() true on all 7 routes)
GET /favicon.ico          404 (F4)
```
**Traffic split and runtime SA:** I could not read them. `gcloud run services describe` and `revisions list` are denied for `vibe-agent@` (F1). Indirect evidence: 50/50 sequential healthz responses report `marombapp-serving-00002-rf6`, which matches LIVE.md.

## L2 Contract — PASS (L2-01, L2-02)
```
GET  /api/auth/session   none | garbage | alg:none JWT (sub=ALLOWED_UID) | Basic     401 JSON unauthenticated
POST /api/ai/workout     none | garbage | alg:none | "Bearer" (empty)                 401 JSON
POST /api/ai/evaluate    none | garbage | alg:none | "Bearer" (empty)                 401 JSON
GET  /api/ai, OPTIONS /api/ai/workout (Basic)                                         401 JSON
GET|POST /api/unknown, GET /api, GET /api/healthz/                                    404 JSON not_found
POST /api/healthz                                                                     405 JSON method_not_allowed
/ /analytics /plan /library /in-gym /start /sessions/123 /unknown-client-route        200 text/html, byte-identical (sha 79375a949fe78876)
```
`tests/unit/bff.test.ts:164` covers HTTP 403 JSON `{error:'forbidden'}` for non-`ALLOWED_UID` and unset `ALLOWED_UID`. The test asserts that `getVertexClient` is `not.toHaveBeenCalled()`, so there are zero Vertex AI calls. The live browser probe also saw 0 requests to `/api/ai`, `aiplatform` or `generativelanguage`.

## L3 Domain Quality — PASS
Pipeline in `/tmp/eval-src-a446a59`:

| Step | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 (tsc ×2 + check-arch, 72 files) |
| `npm run test:unit` | exit 0 (**9 files, 63 tests**) |
| `npm run build` | exit 0 (13 precache entries) |
| `npx playwright test` | exit 0 (**34 passed**, 2.1 min, `mobile-390x844`) |

| Golden | Journey | Result |
|---|---|---|
| L3-J1 | Single-UID Auth gate (`auth.spec`, plus live gate and live popup) | PASS |
| L3-J2 | 66 seed + Library CRUD (`library.spec` 5/5) | PASS |
| L3-J3 | Plan & PlanDay (`plan.spec` 4/4) | PASS |
| L3-J4 | InGym set logging + serialized session shadow | PASS |
| L3-J5 | Reload-persistent RestBar | PASS |
| L3-J6 | Last-3 executions | PASS |
| L3-J7 | Analytics (React.lazy) | PASS |
| L3-J8 | SessionDetail | PASS |

**Live parity:**
- J1 unauthenticated gate and sign-in initiation pass live.
- J1 allowlisted entry and J2–J8 against real Firestore need the owner's Google account, so a blind evaluator cannot probe them (F3).

**L3-ARCH = 1.0 (my own scan, `scripts/arch.py`):**
- Entrypoints: `src/main.tsx` 15, `src/App.tsx` 81, `server/index.ts` 27 lines.
- Largest modules: `Analytics.tsx` 290, `PlanDay.tsx` 287, `InGym.tsx` 287, `db/sessions.ts` 281.
- In 49 src/server/scripts files: 0 files over 300 lines, **0 import cycles**, 0 files without a leading docblock.

## L4 Safety & Grounding — PASS (L4-01, L4-02)
- **Secrets — PASS:**
  - I scanned the live `index.html`, `sw.js`, `workbox-9c191d2f.js`, `registerSW.js`, the manifest, and the 6 JS/CSS chunks including lazy `Analytics`. I also scanned the local `dist/`.
  - Patterns: `private_key`, `BEGIN … PRIVATE`, `client_email`, `@google/genai`, `GoogleGenAI`, `aiplatform.googleapis`, `generativelanguage`, `ya29.`, `service_account`, `GOOGLE_CLOUD_PROJECT`, `client_secret`, `e2e-allowed-uid`, `fake-store`.
  - Result: 0 real hits. The only match is the Firebase Auth SDK's `refresh_token` field name.
  - The single `AIza…` string is the **public** Firebase web API key for `vibe-cabral` (expected per brief).
- **Firebase config — PASS:** `projectId:"vibe-cabral"`, `authDomain:"vibe-cabral.firebaseapp.com"`, `ALLOWED_UID:"iELlq0wRQhR2F5NmrM6pbMSrJuj1"`, `databaseId:"marombapp"`.
- **DB isolation — PASS:** the index is READY on `marombapp`, rules deny unauthenticated callers, and `(default)` has no indexes. Rules content is unreadable (F1).
- **No unrequested AI UI — PASS:**
  - grep of `src/screens` and `src/components` for gemini/vertex/generate workout/AI coach/apiClient finds nothing.
  - `apiClient.ts` has no UI importer.
  - The live DOM has 0 AI mentions.
- **Offline — PASS:**
  - `src/lib/firebase.ts:76-77` uses `persistentLocalCache({tabManager: persistentMultipleTabManager()})`.
  - `offline.spec` passes.
  - A live `setOffline(true)` reload serves the precached shell.

## L5 Latency — PASS (L5-01)
```
/api/healthz      n=50 [200] min=33.9 p50=40.9 p95=57.6 p99=85.7 max=85.7 ms
/api/auth/session n=50 [401] min=36.5 p50=45.4 p95=56.9 p99=71.5 max=71.5 ms
```
Method: 5 warmups, then 50 sequential `curl` requests, each with a new TLS connection. Times are client-side `time_total` with nearest-rank percentiles.

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | Vitest 63 + Playwright 34 at 390x844, 8/8 journeys, fakes only |
| REQ-002 | PASS | No AI UI. Offline works. Real config live and sign-in starts (post-sign-in live parity: F3) |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 JSON. 50/50 on `00002-rf6` ([ADR-001]) |
| REQ-004 | PASS | BFF 401/403. Client fails closed. Index READY on `marombapp`. Unauthenticated deny. UID aligned ([ADR-004]). Rules content: F1 |
| REQ-005 | PASS | Zero credentials or Vertex SDK in bundles. `/api/ai` dormant behind auth |
| REQ-006 | PASS | All line limits met, 0 cycles, docblocks present ([ADR-003] first-wave scope respected) |

## Open findings
1. **F1 — L4 evidence gap (REQ-004, ADR-004), medium:** evaluator identity `vibe-agent@vibe-cabral` is denied the following (see `artifacts/iam-gaps.txt`):
   - `run.services.get` and `run.revisions.list`, so traffic split, runtime SA `marombapp-run@` and BFF `ALLOWED_UID` env are unreadable
   - `firebaserules.releases.get` and `rulesets.get`, so the `marombapp` and `(default)` rules releases are unreadable
   - `datastore.operations.list` and logging

   Granting read-only roles is an IAM decision for the PO (suggest `roles/run.viewer` and `roles/firebaserules.viewer`). Alternatively, ask the deployer to attach the release/ruleset JSON as evidence on #10.
2. **F2 — resolved:** the previous Auth-project/rules-UID mismatch is closed. Firebase Auth, the rules UID and the bundle ALLOWED_UID are all `vibe-cabral` / `iELlq0wRQhR2F5NmrM6pbMSrJuj1`.
3. **F3 — L3 caveat (info):** live authenticated J1–J8 against real Firestore, including the composite-index sessions query, need the owner's sign-in. Suggest a PO smoke test on the live URL.
4. **F4 — minor (L1), carried over:** `/favicon.ico` returns 404, which logs one console error.
5. **F5 — info:** the Google sign-in popup logs 2 `Cross-Origin-Opener-Policy would block the window.closed call` console errors from `accounts.google.com`. The app sends no COOP header. This is the known benign Firebase popup warning.

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
