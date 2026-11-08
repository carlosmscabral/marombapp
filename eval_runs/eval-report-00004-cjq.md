# Blind L1–L5 Evaluation + Verification (#12; regression #5, #6, #8, #9, #10, #11) — `marombapp-serving-00004-cjq` (`d95555f`)

- **Run ID:** `eval-20261108-00004-cjq` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-08
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004]). Rollback is `marombapp-serving-00003-hts`.
- **Source:** `d95555facbbd97abc7b5b64858179687a5975958`, extracted with `git archive` from `origin/factory/main` to `/tmp/eval-src-d95555f`.
  - Changes since `5ceebae`: only `src/screens/plan/usePlanDayExercises.ts`, `tests/unit/planDay.test.tsx` and `LIVE.md`.
  - `src/lib`, `server/`, `firestore.rules`, `firestore.indexes.json` and `firebase.json` are unchanged.
- **JSON:** `/scion-volumes/scratchpad/eval-20261108-00004-cjq.json`. `factory_store.py --project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Raw artifacts:** `/scion-volumes/scratchpad/eval-00004-cjq-artifacts/`

## Verdict: **PASS** — 16/16 golden probes

| Level | Verdict | Key metric |
|---|---|---|
| L1 Health | PASS | healthz 200 strict JSON, `revision=marombapp-serving-00004-cjq`. The SW registers at 390x844 |
| L2 Contract | PASS | 14/14 protected probes return 401 JSON. 4/4 unknown `/api` routes return 404 JSON and `POST /api/healthz` returns 405. 8/8 SPA routes return byte-identical `index.html` |
| L3 Domain | PASS | `as_is_functional_parity_pass_rate` = **1.0** (Playwright 34/34, 8/8 journeys; Vitest 72/72) · `modular_architecture_compliance_rate` = **1.0** |
| L4 Safety | PASS | 0 secrets. Release `88e55196` matches `firestore.rules`. Index READY. `(default)` untouched |
| L5 Latency | PASS | healthz p50 **35.3** / p95 **44.3** / p99 **51.8** ms (SLO 80/250/500) |

## Work-item verification
### #12 — prune rejected PlanDay patches + exerciseId reorder — **VERIFIED** (closes prior F4)
- In `usePlanDayExercises.ts` (now 194 lines; the docblock adds the #12 *why*), the debounced write:
  - sends `latestExercisesRef.current`
  - snapshots the patches it sent
  - in `.catch`, prunes **only** the fields whose current pending value still equals the sent value. Keystrokes typed after the send survive.
- After pruning it calls `bumpPatchVersion`, so the UI falls back to the server value.
- Offline writes go to Firestore's local queue and never reject, so their patches stay. This is the offline behaviour REQ-002 requires.
- Reorder safety: patches are keyed by `exerciseId#occurrence`, not by index, so a reordering snapshot keeps each patch on its exercise.
- Evidence: `tests/unit/planDay.test.tsx` passes **4/4**:
  - #8 field A+B before flush
  - #8 stale snapshot after blur
  - #12 reorder keeps patch on X
  - #12 rejected save prunes, offline-pending keeps
- `plan.spec` passes 4/4.
- Side effect (F6, info): `patchExercise` now re-renders on every keystroke. This is functionally neutral.

### Regression — **NO REGRESSION**
| Issue | Evidence |
|---|---|
| #5 | L1–L5 pass. Live bundle has `projectId:"vibe-cabral"`, `authDomain:"vibe-cabral.firebaseapp.com"`, ALLOWED_UID `iELlq0wRQhR2F5NmrM6pbMSrJuj1`, databaseId `marombapp` |
| #6 | `sessionShadow.ts` unchanged (`mutationQueues` present). `sessionShadow.test` 5/5. E2E rapid-completion and `offline.spec` pass |
| #8 | Both #8 specs pass. `PlanDay.tsx` 245 lines |
| #9 | SignIn on 7 routes with 0 `pageerror` and no `invalid-api-key`. Popup opens `accounts.google.com/v3/signin/identifier?…context_uri=https://marombapp-serving-…`. Offline reload serves the shell |
| #10 | `releases/cloud.firestore/marombapp` → `88e55196` (updated 2026-11-08T13:05:35Z, unchanged). Source is identical to `firestore.rules@d95555f`. Index `CICAgOjXh4EK` READY. Unauthenticated REST reads of `exercises/plans/sessions` return 403 `PERMISSION_DENIED`. `(default)`: 0 composite indexes, release `6f770431` last updated 2026-06-04 (untouched, read-only checks) |
| #11 | `grep cabral-scion-hub` over src/server/tests/scripts/firebase.json/.firebaserc/DEPLOY.md finds 0 hits |

## L1 / L2 — PASS
```
GET /api/healthz   200 {"status":"ok","revision":"marombapp-serving-00004-cjq","firestoreDatabase":"marombapp","aiReady":true}
GET / | /manifest.webmanifest | /sw.js | /workbox-9c191d2f.js   200     GET /favicon.ico 404 (F3)
GET /api/auth/session, POST /api/ai/{workout,evaluate}, GET /api/ai, OPTIONS /api/ai/workout
   none | "Bearer" | garbage | alg:none JWT | Basic                              -> 14/14 401 JSON
GET|POST /api/unknown, GET /api, GET /api/healthz/ -> 404 JSON;  POST /api/healthz -> 405 JSON
/ /analytics /plan /library /in-gym /start /sessions/123 /unknown-client-route -> 200, byte-identical (sha 6d7196b4525fccd6)
```
- `bff.test.ts` covers the 403 for non-`ALLOWED_UID` and unset `ALLOWED_UID`, with the Vertex spy not called.
- The live browser probe saw 0 requests to `/api/ai` or Vertex AI.
- The traffic split is not readable (F1). 50/50 timed healthz responses report `00004-cjq`.

## L3 Domain Quality — PASS
| Step (`/tmp/eval-src-d95555f`) | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 (tsc ×2 + check-arch **75 files**) |
| `npm run test:unit` | exit 0 (**11 files, 72 tests**; `planDay` 4, `sessionShadow` 5) |
| `npm run build` | exit 0 (13 precache entries) |
| `npx playwright test` | exit 0 (**34 passed**, 2.1 min, `mobile-390x844`) |

All 8 journeys (L3-J1..J8) pass via `auth`, `library`, `plan`, `in-gym-logging`, `in-gym-start`, `analytics` and `offline` specs.

**L3-ARCH = 1.0 (my own scan):**
- Entrypoints: `main.tsx` 15, `App.tsx` 81, `server/index.ts` 27 lines.
- Largest modules: `Analytics.tsx` 290, `InGym.tsx` 287, `db/sessions.ts` 281. `usePlanDayExercises.ts` is 194.
- In 50 files: 0 over 300 lines, 0 import cycles, 0 missing docblocks.

## L4 Safety & Grounding — PASS
- **Secrets:** I scanned 13 live assets (index, sw, workbox, registerSW, manifest, 6 JS/CSS chunks including lazy `Analytics`) and the local `dist/` for private keys, client_email, `@google/genai`/`GoogleGenAI`, aiplatform/generativelanguage, `ya29.`, `service_account`, `GOOGLE_CLOUD_PROJECT`, `client_secret` and e2e fakes. Result: **0 hits**. The only `AIza…` is the public `vibe-cabral` web key.
- **DB isolation:** see #10 above.
- **No AI UI:** 0 hits in `src/screens` and `src/components`, and 0 in the live DOM.
- **Offline:** `persistentLocalCache` and `persistentMultipleTabManager` are kept. #12 does not prune offline patches. The live offline reload works.

## L5 Latency — PASS (idle host, after Playwright)
```
/api/healthz      n=50 [200] min=31.5 p50=35.3 p95=44.3 p99=51.8  max=51.8 ms
/api/auth/session n=50 [401] min=30.8 p50=35.2 p95=43.6 p99=173.5 max=173.5 ms (one outlier)
```

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | Vitest 72 + Playwright 34 at 390x844, 8/8 journeys |
| REQ-002 | PASS | #12 handles a rejected save correctly and keeps offline edits. No UI change, no AI UI |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 JSON ([ADR-001]) |
| REQ-004 | PASS | BFF 401/403. Rules release == single-UID rules. Index READY. `(default)` untouched ([ADR-004]) |
| REQ-005 | PASS | Zero credentials or Vertex SDK in bundles. `/api/ai` dormant behind auth |
| REQ-006 | PASS | All limits met, 0 cycles, docblocks ([ADR-003] scope kept) |

## Findings
1. **F1 — residual evidence gap, low (carried over):** `run.services.get` is still denied for `vibe-agent@`. Traffic split, runtime SA and BFF `ALLOWED_UID` env are unverified directly.
2. **F2 — info (carried over):** live authenticated J1–J8 need the owner's sign-in. Suggest a PO smoke test.
3. **F3 — minor (carried over):** `/favicon.ico` returns 404.
4. **F4 — CLOSED by #12.**
5. **F5 — info (carried over):** the Google popup logs 2 COOP `window.closed` warnings from `accounts.google.com`.
6. **F6 — info (new):** `patchExercise` triggers a PlanDay re-render on every keystroke via `bumpPatchVersion`. This is functionally neutral and the suites pass. Watch for input lag on low-end phones.

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
