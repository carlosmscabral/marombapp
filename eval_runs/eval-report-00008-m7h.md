# Blind L1–L5 Evaluation · #17 / #19 Adversarial · #18 / #15 · #14 & #21 Re-verify — `marombapp-serving-00008-m7h` (`bfdd480`)

- **Run ID:** `eval-20261115-00008-m7h` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-15
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004], [ADR-005]). Rollback is `marombapp-serving-00007-nqd`.
- **Source:** `bfdd480d8c481474741a211d4c7cbcea0847ff9d` → `/tmp/eval-src-bfdd480` (`git archive`). Changes since `8d46610`:
  - `9144f56` (#15)
  - `ea686fc` (#18)
  - `c85657f` (#17)
  - `bfdd480` (#19)
- **ADR-005:** **zero Firestore writes by the evaluator.**
  - Live checks were unauthenticated GETs plus rules and index metadata reads.
  - Real-SDK probes used an unreachable `127.0.0.1` emulator host with `projectId: demo-probe`.
  - UI probes ran on the e2e fake build.
- **JSON:** `/scion-volumes/scratchpad/eval-20261115-00008-m7h.json`. `--project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Artifacts:** `/scion-volumes/scratchpad/eval-00008-m7h-artifacts/`:
  - `plans-realsdk-probe.json`, `dbid-probe.json`
  - `mutation-17-on-ea686fc.log`, `mutation-19-on-c85657f.log`
  - `eval-adversarial-17.json`
  - pipeline logs, live probes, latency samples, scripts

## Verdict: **PASS** — 16/16 golden probes · only low/info findings
| Item | Verdict |
|---|---|
| #17 | **VERIFIED** |
| #19 | **VERIFIED** |
| #18 | **VERIFIED** |
| #15 | **VERIFIED** |
| #14 | **NO REGRESSION** |
| #21 | **STILL OPEN (expected)** |

| Level | Verdict | Key metric |
|---|---|---|
| L1 | PASS | healthz 200 `{status:ok, revision:marombapp-serving-00008-m7h, firestoreDatabase:marombapp, aiReady:true}`. Manifest and `<html>` lang `pt-BR`. The SW registers |
| L2 | PASS | 14/14 protected probes return 401 JSON (unit 403 with 0 Vertex calls). 8/8 SPA routes byte-identical. 404/405 JSON on `/api/*` |
| L3 | PASS | Parity **1.0** (Playwright 40/40, Vitest 101/101 in 18 files) · arch **1.0** (check-arch 91 files) |
| L4 | PASS | 0 secrets. Live bundle resolves `marombapp`. Rules == repo on both DBs, index READY on both, unauthenticated 403 on both. `(default)` untouched |
| L5 | PASS | healthz p50 **44.2** / p95 **57.0** / p99 **106.2** ms (session 66.0/91.2/141.6) · 50/50 on `00008-m7h` |

## #17 — offline-resilient `setActivePlan` / `addPlanDay` — **VERIFIED**
- **Code:**
  - `setActivePlan(planId, knownPlans)` merges caller-subscribed plans with `getDocsFromCache` (it skips `pendingDeletedPlans`). It batches deactivate-others plus activate-target and calls `void batch.commit()`.
  - `addPlanDay(planId, name, knownDays)` takes the max order from known days plus cache, then uses `doc(daysCol)` (a client ID) and `void setDoc(...)`.
  - There is no network `getDocs` and no awaited ack. `Plan.tsx` overlays `optimisticActiveId` until the next snapshot. `PlanDetailView` opens the new day immediately.
- **Real SDK, production `plans.ts`** (`zz-eval-plans-realsdk.test.ts`; only `getFirestoreDb` mocked, backend unreachable):

  | Call | refused (RST) | blackhole (hang) |
  |---|---|---|
  | `setActivePlan` (no known / with known / again) | 4 / 4 / 2 ms | 1 / 1 / 1 ms |
  | `addPlanDay` (sequential) | 1 ms | 0 ms |
  | `deletePlan` right after add + activate (#14) | 2 ms | 0 ms |
  | cold-client first cache read (SDK startup, paid by live subscriptions) | 1197 ms | 225 ms |

  - After a switch, exactly one plan is active (`['p2']`). After delete, the plan and its days are gone from cache.
- **Edge cases:**
  - **EVAL-17-A** (e2e, SW allowed): "Adicionar" opens the new day in about **204 ms**. It takes "Agachamento Livre", and it survives an **offline reload**. Orders are `[0, 1]`, integers, no duplicates or NaN.
  - **EVAL-17-B:** sampling every 10 ms during the switch **never shows two "Ativo" badges** (samples `[1]`). The store has a single active plan, which persists after reload.
  - **Rejection:** the SDK's latency compensation reverts the local write and the next snapshot clears `optimisticActiveId`, so there is nothing stale to roll back.
- **Rule 4 mutation:** the `c85657f` specs (`planOfflineMutations` 3 + `planOfflineUi` 3) run on pre-#17 `ea686fc` source → **6/6 FAIL**. On `c85657f` → 6/6 pass.
- **F2 (low, pre-existing race):** three **concurrent** `addPlanDay` calls all received `order: 3`. Each awaits the cache read before queueing `setDoc`. The old `getDocs`+`addDoc` code had the same race. The UI window is about 2 ms with no in-flight guard. Optional hardening: an in-flight guard in `submitAddDay`.
- The remaining awaited paths (sessions, `createPlan`/`archivePlan`/`renamePlan`/`reorderPlanDays`, library) are tracked in #20 and were not re-filed.

## #19 — `(default)` refusal and `marombapp-test` fallback — **VERIFIED**
`dbid-probe.json` shows the client `src/lib/firebase.ts` and the BFF `server/config.ts` behave identically:

| Input | Result |
|---|---|
| `undefined`, `""`, `"   "` | `marombapp-test` |
| `"(default)"`, `"default"`, `" (default) "`, **`"DEFAULT"`**, `"(DEFAULT)"`, `"\t(default)\n"` | **THROW** `Refusing Firestore database …` |
| `"marombapp"`, `"marombapp-test"`, `" marombapp "` | `marombapp`, `marombapp-test`, `marombapp` |
| `"( default )"`, `"\"(default)\""`, `"projects/vibe-cabral/databases/(default)"` | pass through (F3) |

- `getServerConfig({})` → `marombapp-test`, and `FIRESTORE_DATABASE_ID=marombapp` → `marombapp`.
- The **live bundle** bakes `kp(n="marombapp")`, and healthz reports `firestoreDatabase:"marombapp"`. Production resolves to the production DB and does not crash.
- **Rule 4 mutation:** the `bfdd480` `firebase.test` and `bff.test` run on pre-#19 `c85657f` → **7 FAIL** (fallback, refusal, getFirestoreDb guard, healthz DB).
- **F3 (info):** the guard is a denylist. The exotic spellings above can't reach `(default)` (the SDK rejects invalid IDs), but an allowlist would be stricter.
- **F4 (info):** `src/lib/firebase.ts:50` `export const FIRESTORE_DATABASE_ID = resolveFirestoreDatabaseId()` is unused elsewhere but runs at module load (`kp();` in the bundle). A misconfigured `(default)` build would white-screen before the #9 SignIn guard can show the error. The lazy `getFirestoreDb()` path already covers the guard, so the constant can be dropped.

## #18 — README / `.env.example` — **VERIFIED**
- The README "Deploy" section links `knowledge-plane/playbooks/DEPLOY.md`.
- It lists only `firebase deploy --only firestore:marombapp|firestore:marombapp-test --project vibe-cabral`.
- It explicitly forbids a bare `firebase deploy`, `--only hosting`, an unscoped `--only firestore` and `(default)`.
- `.env.example` sets `VITE_FIRESTORE_DATABASE_ID=marombapp-test` and `FIRESTORE_DATABASE_ID=marombapp-test`, with an ADR-005 comment.
- 0 unsafe deploy commands in README or DEPLOY.md.

## #15 — migration tool now in the deployed tree — **VERIFIED**
- Reviewed read-only and never executed: a read-only frozen `(default)` facade, a refusal for a `(default)`/`default`/same-as-source target, dry-run by default, and an allowlist of `exercises`/`plans(+days)`/`sessions`, so `eval_runs` is spared.
- `migrateCopy` 4/4 and `migrateGuard` 4/4 pass.

## Re-verification of open eval-findings
- **#14 — NO REGRESSION:**
  - `deletePlan` is unchanged (cache-only + `knownDayIds` + unawaited batch).
  - On the real SDK, deleting right after `addPlanDay` + `setActivePlan` takes 0–2 ms and the plan and days are gone from cache.
  - `deletion.test` and `planDeletionUi` pass. `setActivePlan` ignores plans pending delete.
- **#21 — `unfixed_in_revision_expected`** (`status:in-progress`, filed after this deploy):
  - Accent-sensitive search is still present in `Library.tsx:54-59` and `ExercisePickerModal.tsx:61-66`.
  - Raw English `err.message` is still shown at `auth.tsx` 66/90/107/124/132, `ExerciseFormSheet.tsx:58` and `SessionDetail.tsx:42`.
  - Those files are unchanged since `8d46610`. I did not re-file it.

## L3-ARCH / STE
- Entrypoints: `main.tsx` 15, `App.tsx` 82, `server/index.ts` 27 lines.
- `PlanListView.tsx` dropped from **292 to 167** by extracting `PlanRow.tsx` (186).
- Largest modules: `copy-default-to-marombapp.mjs` 294, `sessions.ts` 292, `plans.ts` 290, `InGym.tsx` 290 (F5).
- In 55 files: 0 import cycles, 0 missing docblocks. check-arch passes on 91 files.
- STE: in the 19 changed code files, 1 `;` appears in `server/config.ts` prose ("…for token audience;"). It predates this release (present at `8d46610`), and #19 added 0 new ones.

## L4 detail
- **Secrets:** 12 live assets and `dist/` have 0 hits for keys, `client_email`, `@google/genai`/`GoogleGenAI`, aiplatform/generativelanguage, `ya29.`, `service_account`, `GOOGLE_CLOUD_PROJECT`, `client_secret` and e2e fakes. The only `AIza…` is the public `vibe-cabral` key.
- **Releases:** `marombapp`→`88e55196` and `marombapp-test`→`81832c18`. Both sources are identical to `firestore.rules@bfdd480` (ALLOWED_UID only).
- **Index:** `CICAgOjXh4EK` is READY on both.
- **Unauthenticated REST:** 403 on 3 collections in each DB.
- **`(default)`:** 0 composite indexes, release `6f770431` last updated 2026-06-04.
- **No AI UI.** The persistent cache is kept, `offline.spec` passes and the live offline reload works.

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | 101 unit + 40 E2E. Rule 4 mutation proven for #17 and #19 |
| REQ-002 | PASS | Plan activation and day creation work offline in 0–4 ms with optimistic UI. #21 is tracked |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 ([ADR-001]) |
| REQ-004 | PASS | Single-UID rules on both DBs. `(default)` refused in code and untouched in GCP ([ADR-004], [ADR-005]) |
| REQ-005 | PASS | No credentials or Vertex SDK in bundles. Safe `.env.example` defaults |
| REQ-006 | PASS | Limits met (max 294), `PlanRow` extracted, 0 cycles ([ADR-003] scope kept) |

## Findings
1. **F1 — tracked (#21):** still open in `bfdd480`, as expected. No duplicate.
2. **F2 — low (#17, pre-existing):** concurrent `addPlanDay` can produce a duplicate `order`.
3. **F3 — info (#19):** the denylist guard lets exotic `(default)` spellings through, though they can't reach `(default)`.
4. **F4 — info (#19/#9):** the module-level `FIRESTORE_DATABASE_ID` would white-screen on a misconfigured build. Drop the unused constant.
5. **F5 — info (REQ-006):** three modules are at 290–294 lines. One pre-existing `;` in `server/config.ts` prose.
6. **F6 — low (carried):** `run.services.get` is denied, favicon 404, COOP warnings. A PO smoke test on real data and the archived-plans decision are still pending.

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
[ADR-005]: ADR-005-marombapp-db-is-production-marombapp-test-for-tests
