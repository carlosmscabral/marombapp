# Blind L1–L5 Evaluation + Adversarial Audit of #13 "Deletion review" — `marombapp-serving-00005-99q` (`30e33c3`)

- **Run ID:** `eval-20261115-00005-99q` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-15
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004]). Rollback is `marombapp-serving-00004-cjq`.
- **Source:** `30e33c3e503c744c1c26eea36affc71f416f9fc8`, extracted with `git archive` to `/tmp/eval-src-30e33c3`. Changes since `d95555f`: `67ea46f` and `30e33c3` (#13), 17 files.
  - Unchanged: `server/`, `sessionShadow.ts`, `usePlanDayExercises.ts`, `firebase.ts`, `auth.tsx`, rules, indexes and `firebase.json`.
- **JSON:** `/scion-volumes/scratchpad/eval-20261115-00005-99q.json`. `factory_store.py --project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Raw artifacts:** `/scion-volumes/scratchpad/eval-00005-99q-artifacts/`:
  - pipeline logs, live probes and assets, rules and indexes
  - `getdocs-offline-probe.txt` and its script
  - evaluator adversarial spec, log and screenshots
  - STE check, latency samples

## Verdict: **PASS** — 16/16 golden probes · #13 **VERIFIED WITH FINDINGS** (1 medium, 2 low)

| Level | Verdict | Key metric |
|---|---|---|
| L1 Health | PASS | healthz 200 strict JSON, `revision=marombapp-serving-00005-99q`. 12/12 precached assets return 200. The SW registers |
| L2 Contract | PASS | 14/14 protected probes return 401 JSON. 4/4 unknown `/api` routes return 404 JSON and `POST /api/healthz` returns 405. 8/8 SPA routes return byte-identical `index.html` |
| L3 Domain | PASS | `as_is_functional_parity_pass_rate` = **1.0** (Playwright 40/40; Vitest 76/76; evaluator adversarial 3/3) · `modular_architecture_compliance_rate` = **1.0** |
| L4 Safety | PASS | 0 secrets. Rules grant delete only to ALLOWED_UID. Release `88e55196` matches the repo. Index READY. `(default)` untouched |
| L5 Latency | PASS | healthz p50 **55.7** / p95 **67.6** / p99 **79.5** ms (SLO 80/250/500) |

## #13 adversarial audit
### 1. Creatables inventory — every user-creatable item now has an undo or delete path
| Creatable | Create path | Delete / undo path (at `30e33c3`) | Confirm | ≥44 px |
|---|---|---|---|---|
| Plan | Inline "Create plan" | **Cancel** on inline row (new). **Delete plan** in PlanDetailView (new). **Delete** in list ⋮ menu (new, next to Archive) | yes, named | yes |
| Plan day | Inline "Add Day" | **Cancel** on inline row (new). Row trash `Delete <day>`. **Delete training day** labelled button in PlanDay (moved from icon) | yes, named | yes |
| Exercise in a day | Picker | Remove ✕ **now confirms** `Remove "<ex>" from "<day>"?` | yes (new) | yes |
| Custom library exercise | Library form | Delete → inline Confirm/Cancel. **66 seeds read-only** (E2E-verified) | yes | yes |
| Active session | Start → day | **Abandon** (confirm) | yes | yes |
| Mid-workout exercise / set | Add exercise / Add set | Remove exercise ✕ (confirm). Remove **last** set (confirm if completed) | yes | yes |
| Finished session | Finish | **Delete session** in SessionDetail (new). Hidden **and** guarded when `status==='active'` | yes, named | yes |

Gaps (F2, low, for the PO):
- Plans **archived** before #13 are filtered out of every view (`PlanListView` `archivedAt == null`), so they can be neither restored nor hard-deleted.
- **Abandoned** sessions persist invisibly.
- Only the last set can be removed mid-workout. This is as-is behaviour and fits accidental "Add set" taps.

### 2. Security rules cover deletion
`firestore.rules` is `match /databases/{database}/documents { match /{document=**} { allow read, write: if request.auth.uid == 'iELlq0wRQhR2F5NmrM6pbMSrJuj1' } }`.
- `write` includes `delete`, and the recursive wildcard covers `plans/{id}`, `plans/{id}/days/{id}`, `sessions/{id}` and `exercises/{id}`.
- The deployed release `cloud.firestore/marombapp` → ruleset `88e55196` has identical source (diffed). Unauthenticated REST reads return 403.

### 3. Edge cases
| Edge case | Method | Result |
|---|---|---|
| Delete the **active** plan | Code + **EVAL-13-B** (my spec, fake build) | `subscribeActivePlan` → null, `/start` shows **"No active plan"** with a Go-to-plans link. `Plan.tsx` effect clears the stale selection. 0 pageerror. PASS |
| Delete a plan/day referenced by an **active** session | Code + **EVAL-13-A** | Sessions are denormalized (`planName`, `dayName`, exercise snapshot). No session view reads plan or day docs. In-Gym keeps rendering the active workout, plan+days are removed and both sessions kept. 0 pageerror. PASS |
| Delete a plan/day referenced by **completed** sessions (Analytics, SessionDetail, last-3) | `deletion-sessions.spec` #3 + EVAL-13-A | All three still render. PASS |
| Delete a finished session → navigation | `deletion-sessions.spec` #1 + **EVAL-13-C** (20 ms DOM sampling) | `navigate('/analytics', {replace:true})`, no "Not found" flash, 0 pageerror, row and totals gone. `deleteSession` calls `clearShadow`. PASS |
| Delete session while active | `deletion-sessions.spec` #2 + EVAL-13-A | Button not rendered, and `handleDeleteSession` returns early on `active`. PASS |
| Resurrection by trailing debounced writes | Code | `renamePlan`, `renamePlanDay`, `setDayExercises` and session writes all use **`updateDoc`**, which fails on a deleted doc instead of recreating it. Both delete handlers cancel `debouncedRename` and `cancelExercises`. PASS |
| Offline `deleteSession`, `deletePlanDay`, custom exercise delete | Code + unit | Fire-and-forget `void deleteDoc(...).catch()`, resolved immediately. PASS |
| Offline `deletePlan` | Code + **real-SDK probe** | **F1 (medium).** See below |

**F1 — `deletePlan` stalls on poor connectivity (REQ-002, medium).**
- `deletePlan` runs `await getDocs(daysCol(planId)).catch(() => getDocsFromCache(col))` before building the batch.
- I measured the real `firebase/firestore` from the `30e33c3` lockfile against an unreachable backend (`scripts/getdocs-offline-probe.mjs`):
  ```
  {"mode":"refused","ms":597,"outcome":"getDocs resolved (fromCache=true, size=0)"}     # airplane mode / RST
  {"mode":"blackhole","ms":11093,"outcome":"getDocs resolved (fromCache=true, size=0)"} # hanging connection (gym lie-fi)
  ```
- `getDocs` **never rejects** offline. It waits for the SDK's online-state timeout, then serves cache. So the `.catch(getDocsFromCache)` branch is dead code in production.
- `PlanDetailView.handleDeletePlan` awaits `deletePlan` before `onBack()`. The user confirms, then the screen freezes for about **11 s** with no feedback.
- In the list menu, the plan stays visible for the same time, so a second tap opens a second confirm. A repeated delete is harmless.
- `tests/unit/deletion.test.ts` mocks `getDocs` as an **instant throw** offline, which does not model the SDK. The "does not await server acknowledgment offline" test passes for a path that can't happen. This is adjacent to invariants Rule 4 (no green-mock bypass).
- Suggested fix: use `getDocsFromCache` first (PlanDetailView already subscribes to the days, so the cache is warm), or call `onBack()` before awaiting. Make the mock return a pending or slow promise.
- This does **not** fail L4-02 (no as-is flow regressed), but it should be an `eval-finding`.

**F3 (low):** on the cache path, only days cached on this device are batch-deleted. Days never synced here would stay orphaned under the deleted plan. They are invisible and not cleaned up.

### 4. Test audit (#13)
| File | Tests | `expect(` | skip/only/fixme | Notes |
|---|---|---|---|---|
| `tests/unit/deletion.test.ts` | 4 | 14 | 0 | Real store assertions (batch removes plan + child days, other plan untouched, zero-day plan, shadow cleared). Offline mock is unrealistic (F1) |
| `tests/e2e/deletion.spec.ts` | 3 | 28 | 0 | Exact dialog text, `expectTouchTarget` ≥44×44 boxes, `expectStore` polls the fake store for child-day removal, seeds have no edit/delete |
| `tests/e2e/deletion-sessions.spec.ts` | 3 | 33 | 0 | Analytics totals before and after, last-3 drops the deleted session, active-session hiding, orphan-safe rendering |

The fakes change is one line: `getDocsFromCache = getDocs`. The `sessionShadow.test` change adds a `deleteDoc: vi.fn()` mock only. I found no green-mock bypass beyond F1.

## L1 / L2 — PASS
```
GET /api/healthz   200 {"status":"ok","revision":"marombapp-serving-00005-99q","firestoreDatabase":"marombapp","aiReady":true}
GET / | /manifest.webmanifest | /sw.js | workbox   200     GET /favicon.ico 404 (F6)
14/14 protected probes (session, ai/workout, ai/evaluate, ai, OPTIONS × none/"Bearer"/garbage/alg:none/Basic) -> 401 JSON
GET|POST /api/unknown, GET /api, GET /api/healthz/ -> 404 JSON;  POST /api/healthz -> 405 JSON
8 client routes -> 200 byte-identical index.html (sha 1404ea2d378aa8db)
```
`bff.test.ts` checks the 403 for non-ALLOWED_UID with the Vertex spy not called. `server/` is unchanged.

## L3 — PASS
| Step (`/tmp/eval-src-30e33c3`) | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 (tsc ×2 + check-arch **78 files**) |
| `npm run test:unit` | exit 0 (**12 files, 76 tests**; deletion 4, planDay 4, sessionShadow 5) |
| `npm run build` | exit 0 (13 precache entries) |
| `npx playwright test` | exit 0 (**40 passed**, 2.2 min, `mobile-390x844`) |
| evaluator `zz-eval-adversarial-13.spec.ts` | exit 0 (**3 passed**). It ran in the private extraction only and was removed afterwards |

- **Live 390x844:** 7 routes return 200 and SignIn mounts. 0 pageerror, 0 nav, no invalid-api-key. The popup opens `accounts.google.com`, and the offline reload serves the shell.
- **L3-ARCH:**
  - Entrypoints: `main.tsx` 15, `App.tsx` 81, `server/index.ts` 27 lines.
  - Max module is **`sessions.ts` 292** (F4, headroom 8), then `Analytics.tsx` 290 and `InGym.tsx` 287. `PlanListView` is 276, `PlanDetailView` 267, `SessionDetail` 262, `PlanDay` 254.
  - 0 import cycles and 0 missing docblocks in 50 files.
  - STE check (`scripts/ste-docblocks.py`) finds **0 `;`** in docblock prose across the 13 #13-touched files. The docblocks use active voice and say *why* (for example "avoids awaiting server ack so offline deletion stays responsive").

## L4 — PASS
- **Secrets:** 12 live assets and `dist/` have 0 hits for keys, `client_email`, `@google/genai`/`GoogleGenAI`, aiplatform/generativelanguage, `ya29.`, `service_account`, `GOOGLE_CLOUD_PROJECT`, `client_secret` and e2e fakes. The only `AIza…` is the public `vibe-cabral` key.
- **Config:** `projectId:"vibe-cabral"`, `authDomain:"vibe-cabral.firebaseapp.com"`, ALLOWED_UID `iELlq0wRQhR2F5NmrM6pbMSrJuj1`, databaseId `marombapp`.
- **DB:** release `88e55196` matches the repo, index `CICAgOjXh4EK` is READY, and unauthenticated reads return 403. `(default)` has 0 composite indexes and its release `6f770431` was last updated 2026-06-04, so it is untouched (read-only checks).
- **No AI UI:** clean in source and in the live DOM. The new UI consists only of the PO-requested delete and cancel controls.
- **Offline:** persistent cache and multi-tab manager are kept. `offline.spec` passes and the live offline reload works. F1 applies only to the new `deletePlan`.

## L5 — PASS (idle host, after Playwright)
```
/api/healthz      n=50 [200] min=41.1 p50=55.7 p95=67.6 p99=79.5 ms
/api/auth/session n=50 [401] min=38.6 p50=48.5 p95=76.8 p99=85.5 ms
```

## Regression
| Issue | Result |
|---|---|
| #5 | PASS: L1–L5, real config |
| #6 | PASS: `sessionShadow.ts` unchanged, 5/5 |
| #8 | PASS: hook unchanged, planDay 4/4 |
| #9 | PASS: SignIn on 7 routes, 0 pageerror |
| #10 | PASS: rules, ruleset and index unchanged. `(default)` untouched |
| #11 | PASS: 0 `cabral-scion-hub` hits |
| #12 | PASS: hook unchanged, #12 specs pass |

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | Vitest 76 + Playwright 40 at 390x844 + 3 evaluator adversarial specs |
| REQ-002 | PASS | Every accidental creatable has delete or cancel with confirm and ≥44 px. No as-is regression. F1 is an offline UX stall in `deletePlan` |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 ([ADR-001]) |
| REQ-004 | PASS | Delete is allowed only for ALLOWED_UID. Release == repo rules. `(default)` untouched ([ADR-004]) |
| REQ-005 | PASS | No credentials or Vertex SDK in bundles. `/api/ai` dormant |
| REQ-006 | PASS | Limits met (max 292), 0 cycles, STE docblocks ([ADR-003] scope kept: no speculative features) |

## Findings
1. **F1 — medium (REQ-002, #13):** `deletePlan` awaits `getDocs`. The real SDK holds it about 11 s on a hanging network, the `getDocsFromCache` fallback is dead code, and the unit mock is unrealistic. **Recommend an `eval-finding` issue.**
2. **F2 — low (#13 scope, PO):** archived plans can't be restored or deleted, and abandoned sessions persist invisibly.
3. **F3 — low (#13):** the cache-path `deletePlan` can orphan unsynced days server-side.
4. **F4 — info (REQ-006):** `sessions.ts` is at 292/300 lines.
5. **F5 — low (carried over):** `run.services.get` is still denied for `vibe-agent@`.
6. **F6 — info (carried over):** favicon 404, COOP warnings from the Google popup. A PO smoke test is still needed for live authenticated journeys.

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
