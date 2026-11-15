# Blind L1–L5 Evaluation · #22 Seed Fix Re-verify · #21 / #14 / #20 Regression — `marombapp-serving-00011-tr2` (`9a87baa`)

- **Run ID:** `eval-20261115-00011-tr2` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-15
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004], [ADR-005]). Rollback is `marombapp-serving-00010-zcx`.
- **Source:** `9a87baaf3ed33e12ff61d556885bc61761a6efdf` → `/tmp/eval-src-9a87baa`. The only change since `8c8981b` is `9a87baa` (#22): `seed.ts`, `App.tsx`, the e2e fake and `seed.test.ts`.
- **ADR-005:** **zero Firestore writes.**
  - Live checks were unauthenticated GETs plus rules and index metadata reads.
  - Real-SDK probes used an unreachable `127.0.0.1` emulator host with `projectId: demo-probe`.
  - UI probes ran on the e2e fake build.
- **JSON:** `/scion-volumes/scratchpad/eval-20261115-00011-tr2.json`. `--project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Artifacts:** `/scion-volumes/scratchpad/eval-00011-tr2-artifacts/`:
  - `seed-22-probe.json`, `eval-22-firstlaunch.json`
  - `mutation-22-on-8c8981b.log`, `eval-adversarial-00011.json`
  - pipeline logs, live probes, latency samples, scripts

## Verdict: **PASS** — 16/16 golden probes
| Item | Verdict |
|---|---|
| #22 | **VERIFIED** (closes eval-00010 F1) |
| #21 / #14 / #20 | **NO REGRESSION** |

| Level | Verdict | Key metric |
|---|---|---|
| L1 | PASS | healthz 200 `{status:ok, revision:marombapp-serving-00011-tr2, firestoreDatabase:marombapp, aiReady:true}`. Manifest and `<html>` lang `pt-BR`. 12/12 assets return 200 |
| L2 | PASS | 14/14 protected probes return 401 JSON (unit 403 with 0 Vertex calls). 8/8 SPA routes byte-identical. 4/4 return 404 and 1/1 returns 405 JSON |
| L3 | PASS | Parity **1.0** (Playwright **41/41**, Vitest **120/120**) · arch **1.0** (check-arch 101 files) |
| L4 | PASS | 0 secrets. Live `databaseId` is `marombapp`. Rules == repo on both DBs, index READY on both, unauthenticated 403 on both. `(default)` untouched |
| L5 | PASS | healthz p50 **37.3** / p95 **44.2** / p99 **44.4** ms (session 35.3/40.0/42.1) · 50/50 on `00011-tr2` |

## #22 — server-authoritative seeding + deterministic slug IDs — **VERIFIED**
### Code
- `seedLibraryIfEmpty()` calls `getDocsFromServer(query(exercises, limit(1)))` behind a 5 s `withTimeout`. The timeout absorbs late rejections and clears its timer.
- It **skips** on a timeout (`null`), on `metadata.fromCache`, on a non-empty result, or on any thrown error.
- Otherwise it writes the 66 canonical seeds through `batch.set(doc(col, seedExerciseId(name)), …)` and `void batch.commit().catch(…)`. An `inFlightSeed` guard prevents same-tab overlap.
- `App.tsx` calls it as `void seedLibraryIfEmpty().catch(() => undefined)`, so startup is non-blocking.

### Real Firestore SDK, empty cache, unreachable backend (production `seed.ts`)
| Mode | Return | Seed docs queued | Concurrent ×2 | Queued after |
|---|---|---|---|---|
| refused (RST) | 895 ms | **0** | 4 ms | **0** |
| blackhole (hang) | 5001 ms (timeout) | **0** | 5000 ms | **0** |
| *`8c8981b`, same probe in eval-00010* | — | *66* | — | — |

- **0 unhandled rejections.**
- The client used the memory cache, because Node has no IndexedDB for `persistentLocalCache`. The empty-cache semantics are identical.

### Idempotency
I mocked only `getDocsFromServer` as "server empty" and kept the real SDK's local batch:
- 3 concurrent calls → **66** docs.
- A second "tab" (a fresh module instance with its own in-flight guard), then a repeat → still **66**.
- 66 unique IDs, all with `isCustom: false`.

Deterministic IDs make `batch.set` converge even across tabs or devices.

### Slug audit
- **66/66 unique**, with 0 invalid IDs. Every ID matches `^[a-z0-9-]+$`, none contains `/`, none is `.` or `..`, and none has the `__x__` form.
- Punctuated names: `T-Bar Row` → `t-bar-row`, `Farmer's Walk` → `farmers-walk`.
- The payload is unchanged from `8c8981b`: `name`, `primaryMuscle`, `isCustom: false`, `notes: ''`. Seeds never had a `subMuscle`.
- **Downstream:**
  - `history.ts` (last-3 in InGym and StartWorkout) matches strictly by `exerciseId`.
  - Migrated PO exercises keep their legacy IDs, and slug IDs only appear on a server-confirmed **empty** project, so the two never mix.
  - Library, the read-only `ExerciseDetailSheet` guard, PlanDay and Analytics key on `isCustom` and `id` exactly as before.

### Browser: EVAL-22-FIRSTLAUNCH (e2e fake, `navigator.onLine` controlled) — PASS
- Offline first launch with an **empty** library → **0** exercises.
- Online relaunch → **66** slug IDs (`bench-press`, `incline-dumbbell-press`, `dumbbell-fly`, `cable-crossover`, …).
- A second relaunch → still **66**.
- 0 pageerror.

The fake's `getDocsFromServer` throws code `unavailable` when `navigator.onLine === false`, which mirrors the SDK's offline rejection. It lives in `tests/e2e/fakes/firebase-firestore.ts`; the brief names `src/lib/firebase.e2e.ts`, which does not exist.

### Rule 4 mutation
`seed.test.ts` from `9a87baa` run on pre-#22 `8c8981b` → **5 FAIL / 1 pass**:
- **Failing:** offline-empty, `fromCache`, timeout, slug-ID seeding, multi-tab dedupe.
- **Passing:** "writes nothing when the server already has documents", which the old code also met.

## Regression (#21, #14, #20) — none
- `src/lib/db`, `src/screens`, `src/components`, `src/lib/i18n`, `auth.tsx`, `firebase.ts`, `server/` and the rules are byte-identical to `8c8981b`.
- Product tests pass: `deletion.test`, `planDeletionUi` and the offline unit specs.
- My specs on `9a87baa`:
  - EVAL-16-SEARCH passes **12/12**, and AUTH and HISTORY pass.
  - **EVAL-20-OFFLINE-JOURNEY passes.** Steps took 0.7–2.8 s while 3 specs ran in parallel; there were no stalls.
  - EVAL-21-SAVE still fails by the eval-00010 **F2** design (the form closes optimistically). This is unchanged.

## L3-ARCH / L4 details
- **Architecture:**
  - Entrypoints: `main.tsx` 15, `App.tsx` 80, `server/index.ts` 27 lines. `seed.ts` is 177.
  - Largest modules: `plans.ts` 295, `copy-default-to-marombapp.mjs` 294, `PlanDetailView.tsx` 293.
  - In 58 files: 0 import cycles, 0 missing docblocks. check-arch passes on 101 files.
  - **0 `;`** in docblock prose of the #22 files.
- **Secrets:** 12 live assets and `dist/` have 0 hits. The only `AIza…` is the public `vibe-cabral` key.
- **Bundle:** `databaseId` default is `marombapp`, and `foldSearch` and the slug seeder are present.
- **DB:** `marombapp`→`88e55196` and `marombapp-test`→`81832c18`, both equal to `firestore.rules@9a87baa`. `CICAgOjXh4EK` is READY on both, and unauthenticated GETs return 403 ×3 on each. `(default)` has 0 indexes and release `6f770431` (2026-06-04).
- **No AI UI.**

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | 120 unit + 41 E2E. Rule 4 proven for #22 |
| REQ-002 | PASS | Offline first launch doesn't seed. Startup is non-blocking. Offline journey intact |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 ([ADR-001]) |
| REQ-004 | PASS | The production library is protected from duplicate seeds. Single-UID rules. `(default)` untouched ([ADR-004], [ADR-005]) |
| REQ-005 | PASS | No credentials or Vertex SDK in bundles. No AI UI |
| REQ-006 | PASS | Limits met (max 295), 0 cycles, STE docblocks ([ADR-003] scope kept) |

## Findings
1. **F1 — info (#22):** on a genuinely empty new project where the server check takes more than 5 s, seeding is skipped for that launch and retried at the next start. This is a safe trade-off; document it.
2. **F2 — low (carried from eval-00010):** the `ExerciseFormSheet` save-error UI is unreachable after #20, and its unit test mocks an impossible rejection. eval-lead should decide whether to track it.
3. **F3 — info (REQ-006, carried):** three modules are at 293–295 lines.
4. **F4 — info (carried):**
   - unused module-level `FIRESTORE_DATABASE_ID`;
   - the DB guard is a denylist;
   - concurrent `addPlanDay` can produce a duplicate order;
   - the `gemeos` glossary gap.
5. **F5 — low (carried):**
   - `run.services.get` is denied for `vibe-agent@`;
   - favicon 404;
   - COOP popup warnings;
   - PO smoke test on real data and the archived-plans decision are pending.

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
[ADR-005]: ADR-005-marombapp-db-is-production-marombapp-test-for-tests
