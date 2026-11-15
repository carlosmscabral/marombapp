# Blind L1–L5 Evaluation · #20 Offline Audit · #6+#20 Seam · #14 / #21 Re-verify — `marombapp-serving-00010-zcx` (`8c8981b`)

- **Run ID:** `eval-20261115-00010-zcx` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-15
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004], [ADR-005]). Rollback is `marombapp-serving-00009-vvr`.
- **Source:** `8c8981b8092da836b9a6ca0b87e6932a7b7f3d02` → `/tmp/eval-src-8c8981b`. The only change since `64f7cd6` is `8c8981b` (#20, 24 files).
- **ADR-005:** **zero Firestore writes.**
  - Live checks were unauthenticated GETs plus rules and index metadata reads.
  - Real-SDK probes used an unreachable `127.0.0.1` emulator host with `projectId: demo-probe`.
  - UI probes ran on the e2e fake build.
  - GitHub was read only (issue list for de-duplication).
- **JSON:** `/scion-volumes/scratchpad/eval-20261115-00010-zcx.json`. `--project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Artifacts:** `/scion-volumes/scratchpad/eval-00010-zcx-artifacts/`:
  - `realsdk-20-probe.json`, `eval-20-offline-journey.json`
  - `mutation-20-on-64f7cd6.log`, `eval-adversarial-16-21.json`
  - pipeline logs, live probes, latency samples, scripts

## Verdict: **PASS** — 16/16 golden probes
| Item | Verdict |
|---|---|
| #20 | **VERIFIED** |
| #14 | **NO REGRESSION** |
| #21 | **NO REGRESSION (caveat F2)** |
| New finding | **F1 (medium, pre-existing): offline first-launch seeding can duplicate the real library** |

| Level | Verdict | Key metric |
|---|---|---|
| L1 | PASS | healthz 200 `{status:ok, revision:marombapp-serving-00010-zcx, firestoreDatabase:marombapp, aiReady:true}`. Manifest and `<html>` lang `pt-BR`. 12/12 assets return 200 |
| L2 | PASS | 14/14 protected probes return 401 JSON (unit 403 with 0 Vertex calls). 8/8 SPA routes byte-identical. 4/4 return 404 and 1/1 returns 405 JSON |
| L3 | PASS | Parity **1.0** (Playwright **41/41**, Vitest **118/118** in 24 files, plus EVAL-20-OFFLINE-JOURNEY) · arch **1.0** (check-arch 101 files) |
| L4 | PASS | 0 secrets. Live `databaseId` is `marombapp`. Rules == repo on both DBs, index READY on both, unauthenticated 403 on both. `(default)` untouched |
| L5 | PASS | healthz p50 **35.8** / p95 **42.3** / p99 **46.6** ms (session 35.2/41.4/54.7) · 50/50 on `00010-zcx` |

## #20 — offline-resilient sessions, plans and library — **VERIFIED**
### Real Firestore SDK benchmark
Production modules run on the real SDK with the backend unreachable; only `getFirestoreDb` is mocked. Times are in ms, warm.

| Op | refused | blackhole | Op | refused | blackhole |
|---|---|---|---|---|---|
| `createExercise` | 4 | 0 | `createSession` | 1 | 0 |
| `updateExercise` | 14 | 0 | **seam:** `logSet`×2 + `addSet` → `finishSession` | 52 | 7 |
| `deleteExercise` | 0 | 0 | `getSession` cache hit | 1 | 0 |
| `createPlan` | 2 | 0 | `getSession` cache miss | reject 8 | reject 80 |
| `renamePlan` | 4 | 0 | `abandonSession` (after same-tick `logSet`) | 1 | 6 |
| `setActivePlan` (#17) | 70 | 48 | `deleteSession` | 0 | 0 |
| `addPlanDay` (#17) | 7 | 2 | `archivePlan` | 0 | 1 |
| `reorderPlanDays` | 1 | 0 | `deletePlan` after create+rename+reorder (#14) | 7 | 1 |

- **No path hangs for seconds**; the worst is 70 ms.
- A `getSession` cache miss rejects fast with "client is offline". SessionDetail maps it to PT copy (`unavailable`).
- **0 unhandled rejections.** Every `void setDoc/updateDoc/deleteDoc/batch.commit` has `.catch`. `drainShadowQueue` awaits a promise that was already caught. The background `getDoc` refresh and the visibility-hidden `flushPendingWrites` both have `.catch`.

### #6 + #20 seam — PASS
- **Code:** `finishSession` and `abandonSession` call `await drainShadowQueue(id)`, which waits only for the local RMW, never a server ack. They then call `clearShadow`, then `void updateDoc({status, finishedAt})`. The status write touches only `status` and `finishedAt`, never `exercises`.
- The old `await flushPendingWrites()` (`waitForPendingWrites`, server ack) in InGym finish and abandon is **removed**.
- **Real-SDK result** (two same-tick `logSet` calls plus an `addSet`, then an immediate `finishSession`):
  - (a) all sets are preserved: `[100×8 ✓, 102.5×6 ✓, 102.5×6 open]`;
  - (b) the status is `completed` with a numeric `finishedAt`;
  - (c) a **late** `logSet` after finish (as a SetRow unmount flush would do) adds its set and leaves the status `completed`;
  - (d) a `getSession` cache hit returns `completed` in 0–1 ms.
- Abandon after a same-tick `logSet` gives `abandoned` with the set preserved.
- SetRow's debounced edits flush on blur, which fires before the Finish click, so the drain includes them.

### EVAL-20-OFFLINE-JOURNEY (390x844, SW allowed, offline after registration) — PASS
| Step (offline) | ms |
|---|---|
| Library: create custom "Rosca Inversa Offline" | 547 |
| Plans: create "Plano Offline" + *Definir como plano ativo* | 454 |
| Add day "Dia Off", then add the custom exercise and Supino Reto (accent-free picker search) | 697 |
| `/start` → Dia Off → `/in-gym` | 544 |
| Log 60×8, mark complete → rest bar | 444 |
| *Finalizar treino* → `/sessions/:id` "Treino concluído", Volume **480kg** | 418 |
| Análises shows "Dia Off" | 284 |
| **Offline reload** → SessionDetail intact (480kg) | 681 |

- Store: session `completed` with a numeric `finishedAt`, sets preserved, `maromba.restTimer` cleared, the only active plan is "Plano Offline", and the custom exercise persisted.
- **0 pageerror and 0 unhandled rejections.**

### Rule 4 mutation
The 11 new #20 specs (from `sessionOfflineMutations`, `inGymOfflineUi`, `planLibraryOffline`, `planLibraryOfflineUi`, `libraryOfflineUi`) run on pre-#20 `64f7cd6` → **11/11 FAIL**. On `8c8981b` → 11/11 pass.

### Residual awaited paths (by design, not UI-blocking)
- `ensureShadow` and `getSession` go to the network only on a **cache miss**, and they fail fast offline.
- `setDayExercises` awaits `updateDoc`, but callers never await it; #12 deliberately relies on its rejection.
- `seed.ts`: see F1.

## Re-verification
- **#14 — NO REGRESSION:** `deletePlan` on a plan just created, renamed and reordered offline (all unacked) returns in 1–7 ms, and the plan is gone from cache. `deletion.test` and `planDeletionUi` pass.
- **#21 — NO REGRESSION (caveat F2):**
  - `foldSearch`, `localizeFirebaseError`, `auth.tsx`, `SignIn` and the picker are unchanged.
  - My adversarial spec passes **19/20**: 12 Library and 5 picker searches, AUTH "Sem conexão de rede…", and HISTORY.
  - The SessionDetail cache-and-network failure still localizes.
  - **EVAL-21-SAVE now fails**: `createExercise` no longer rejects, so the form closes optimistically and the forced rejection is swallowed. No raw text is shown, but no PT error appears either (F2).

## Findings
1. **F1 — medium (REQ-002 / REQ-004 data integrity, [ADR-005]); pre-existing, NEW. Recommend an `eval-finding`.**
   - **Cause:** `src/lib/seed.ts` `seedLibraryIfEmpty()` checks emptiness with network `getDocs(limit(1))`. With an **empty local cache** (fresh PWA install, cleared site data, new phone) and no or poor signal, the real SDK resolves `getDocs` **from the empty cache** (measured in eval-00005: 597 ms refused, about 11 s blackhole).
   - **Effect:** the function then queues a 66-exercise batch. This run's probe confirms **66 seed docs queued locally** in both modes.
   - **Risk:** on reconnect the batch commits into DB `marombapp`, which now holds the PO's migrated library, creating **66 duplicate exercises**.
   - Not covered by #20 (its scope excludes `seed.ts`), and no open issue matches.
   - **Fix:** skip seeding when `snap.metadata.fromCache`, or use `getDocsFromServer` with retry, or use deterministic seed IDs (a slug of the canonical name) so a re-seed is idempotent.
2. **F2 — low (#20 × #21):**
   - `createExercise`, `updateExercise` and `deleteExercise` now always resolve, so the `ExerciseFormSheet` `localizeFirebaseError` save-error UI cannot fire on a write rejection.
   - `firebaseErrorsUi.test.tsx`'s save test mocks a rejection that production can't produce (Rule 4 adjacent).
   - On a real rejection, which is rare under single-UID rules, the optimistic entry silently disappears at the next snapshot.
   - Options: a shared background-rejection toast, or retire the stale test and the dead path.
3. **F3 — info (REQ-006):** `plans.ts` 295, `copy-default-to-marombapp.mjs` 294 and `PlanDetailView.tsx` 293 lines are near the limit. `sessions.ts` went from 292 to 266 by extracting `sessionMutations.ts` (109).
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

## L3-ARCH / L4 details
- **Architecture:**
  - Entrypoints: `main.tsx` 15, `App.tsx` 82, `server/index.ts` 27 lines.
  - In 58 files: 0 import cycles, 0 missing docblocks. check-arch passes on 101 files.
  - **0 `;`** in docblock prose across the 22 #20 files.
- **Secrets:** 12 live assets and `dist/` have 0 hits. The only `AIza…` is the public `vibe-cabral` key.
- **Bundle:** `databaseId` default is `marombapp`, and `foldSearch` (NFD) is present.
- **DB:** `marombapp`→`88e55196` and `marombapp-test`→`81832c18`, both equal to `firestore.rules@8c8981b`. `CICAgOjXh4EK` is READY on both, and unauthenticated GETs return 403 ×3 on each. `(default)` has 0 indexes and release `6f770431` (2026-06-04).
- **No AI UI.**

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | 118 unit + 41 E2E. Rule 4 proven for #20 (11/11 fail pre-fix) |
| REQ-002 | PASS | Whole app works offline: 0–70 ms ops, offline journey with reload survival, no lost sets at finish. F1 and F2 noted |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 ([ADR-001]) |
| REQ-004 | PASS | Single-UID rules on both DBs. `(default)` untouched. F1 is a data-integrity risk on the production DB ([ADR-004], [ADR-005]) |
| REQ-005 | PASS | No credentials or Vertex SDK in bundles. No AI UI |
| REQ-006 | PASS | Limits met (max 295), `sessionMutations` extracted, 0 cycles ([ADR-003] scope kept) |

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
[ADR-005]: ADR-005-marombapp-db-is-production-marombapp-test-for-tests
