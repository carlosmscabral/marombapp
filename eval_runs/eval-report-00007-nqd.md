# Blind L1–L5 Evaluation · #14 Re-verify · ADR-005 Check · #16 PT-BR Audit — `marombapp-serving-00007-nqd` (`8d46610`)

- **Run ID:** `eval-20261115-00007-nqd` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-15
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004], [ADR-005]). Rollback is `marombapp-serving-00006-5rz`.
- **Source:** `8d46610cf2e31c52dba2dc5d694767263593a62f`, extracted with `git archive` to `/tmp/eval-src-8d46610`. Changes since `30e33c3`:
  - `361a450` (#14)
  - `90d45d9` and `fb046df` (#15 / ADR-005)
  - `8d46610` (#16)
  - The migration tool `9144f56` is on trunk **after** the deployed commit. I reviewed it read-only.
- **ADR-005 compliance of this run:** **zero Firestore writes.**
  - Live checks were unauthenticated GETs plus admin metadata reads (rules releases and rulesets, composite indexes).
  - All UI and adversarial probes ran against the e2e **fake** build.
- **JSON:** `/scion-volumes/scratchpad/eval-20261115-00007-nqd.json`. `factory_store.py --project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Raw artifacts:** `/scion-volumes/scratchpad/eval-00007-nqd-artifacts/`

## Verdict: **PASS** — 16/16 golden probes
| Item | Verdict |
|---|---|
| #14 | **VERIFIED** |
| ADR-005 | **VERIFIED** |
| #16 | **VERIFIED WITH FINDINGS** (2 medium) |

| Level | Verdict | Key metric |
|---|---|---|
| L1 Health | PASS | healthz 200 strict JSON, `revision=marombapp-serving-00007-nqd`. Manifest `lang:"pt-BR"`, `<html lang="pt-BR">`. The SW registers |
| L2 Contract | PASS | 14/14 protected probes return 401 JSON. 4/4 unknown `/api` routes return 404 and `POST /api/healthz` returns 405. 8/8 SPA routes return byte-identical `index.html` |
| L3 Domain | PASS | `as_is_functional_parity_pass_rate` = **1.0** (Playwright 40/40; Vitest 84/84) · `modular_architecture_compliance_rate` = **1.0** |
| L4 Safety | PASS | 0 secrets. **Both** `marombapp` and `marombapp-test` have rules == repo, index READY and unauthenticated 403. `(default)` untouched |
| L5 Latency | PASS | healthz p50 **40.6** / p95 **57.1** / p99 **59.4** ms (SLO 80/250/500) |

## #14 — deletePlan stall (`eval-finding`) — **VERIFIED**
- **Code:**
  - `deletePlan(planId, knownDayIds)` merges caller-known day IDs with **`getDocsFromCache`** (no network `getDocs`).
  - It builds the batch and calls `void batch.commit()` without awaiting it.
  - `pendingDeletedPlans` hides the plan in `subscribeAllPlans` and `subscribeActivePlan` until the snapshot drops it, or the commit rejects.
  - `PlanDetailView.handleDeletePlan` calls `onBack()` synchronously with `days.map(d => d.id)`. `PlanListView` calls `onDeleted()` (hiding the row) before `deletePlan(plan.id, dayIds)`.
- **Real SDK timing:** `scripts/deleteplan-offline-probe.mjs` uses `firebase` from the `8d46610` lockfile with an unreachable backend:
  ```
  refused   getDocsFromCache 40 ms → return 41 ms
  blackhole getDocsFromCache 20 ms → return 21 ms     (previous getDocs path: 11093 ms)
  ```
- **Test realism (invariants Rule 4):**
  - The new `tests/unit/deletion.test.ts` models a **hanging** network `getDocs`.
  - Run against `30e33c3`, it fails **3/4**, including `expected 'stalled' to be 'resolved'` (`deletion-test-on-30e33c3.log`). On `8d46610` it passes 4/4.
  - `planDeletionUi.test.tsx` passes 2/2 for the synchronous navigation and row removal.
- This closes eval-00005 F1. It also mitigates eval-00005 F3 (orphaned days), because subscribed day IDs are always included.
- The `setActivePlan`/`addPlanDay` stalls are tracked in #17 and were not re-filed.

## ADR-005 / #15 — **VERIFIED**
| Check | `marombapp` (production) | `marombapp-test` (tests/eval) |
|---|---|---|
| `firebase.json` target | ✔ | ✔ |
| Rules release → ruleset | `88e55196` (2026-11-08) | `81832c18` (2026-11-15T15:00:42Z) |
| Ruleset source == `firestore.rules@8d46610` (ALLOWED_UID only) | ✔ identical | ✔ identical |
| Index `CICAgOjXh4EK` `sessions(status, finishedAt, __name__)` | READY | READY |
| Unauthenticated REST GET `exercises/plans/sessions` | 403 ×3 | 403 ×3 |

- **`(default)`:** 0 composite indexes, and release `6f770431` was last updated 2026-06-04. It is untouched; I read only metadata.
- **Live bundle:** `databaseId` default is `marombapp`, and the string `marombapp-test` does not appear in the bundle.
- **Migration tool (`9144f56`, reviewed read-only, never run):**
  - `createReadOnlySource` wraps `(default)` in a frozen facade that only exposes `get` on allowlisted paths.
  - `assertSafeTargetDatabase` refuses an empty target, `(default)`/`default`, or a target equal to the source.
  - `parseCliArgs` makes `dryRun: !explicitApply`, rejects `--dry-run --apply`, and rejects unknown flags.
  - Every write and purge passes `assertAllowlistedDocPath`, so only `exercises`, `plans(+days)` and `sessions` can be touched. **`eval_runs` is spared.**
  - A pre-apply guard refuses `--apply` when the target holds real data that is absent from the source.

## #16 — "Tradução completa PT-BR" — **VERIFIED WITH FINDINGS**
### Stored data / #15 compatibility — PASS
- **Stored data unchanged:** `seed.ts` diff adds `export` keywords only. There are still 66 canonical English names, and the `MuscleGroup` and `SUB_MUSCLES` enums are unchanged.
- **Translation is display-only:** `tExerciseName` / `tExercise`, `tMuscle` and `tSubMuscle` translate at render time. Custom names (`isCustom`) pass through unchanged, and `'Unknown exercise'` maps to `'Exercício desconhecido'`.
- **Coverage probe** (`scripts/zz-eval-i18n-probe.test.ts`, real modules):
  - 66/66 seed names have an entry, with 0 extra keys.
  - The 6 identical entries are the documented loanwords: Face Pull, Farmer's Walk, Russian Twist, Step Up, Leg Press, Good Morning.
- **History renders in PT-BR on every surface.** The suite fixtures store canonical English (`Bench Press`, `chest`) and assert PT-BR (`Supino Reto`, `Peito`):
  - Library, PlanDay, Picker, StartWorkout, InGym and last-3 history
  - Analytics: split list `Peito/Quadríceps/Bíceps`, legend `Maior carga/Volume`
  - SessionDetail
- **EVAL-16-HISTORY** (my spec) passes. With migrated-style English sessions, `/start`, `/sessions/h1` and `/analytics` show `Supino Reto`/`Tríceps Testa` and keep the custom `Minha Variação`, with no `Bench Press`, `Skull Crushers`, `chest` or `triceps` text and 0 pageerror.
- An exact-match dictionary means a non-canonical stored name falls back to English. This is by design and safe.

### Sort — PASS
Library, Picker and the Analytics overload selector sort by `tExercise(a).localeCompare(tExercise(b), 'pt-BR')`. The probe confirms pt-BR alphabetical order (`Abdominal na Polia`, `Abdominal Supra`, `Agachamento Búlgaro`, …).

### Search — **F1 (medium): accent-sensitive**
`Library.tsx:49-60` and `ExercisePickerModal.tsx:56-67` use `q.trim().toLowerCase()` and `.includes()` over the PT name, the PT muscle, the PT sub-muscle and the English fallbacks. There is **no diacritic folding**.

| Query | Results (probe) | Browser (e2e build, EVAL-16-SEARCH) |
|---|---|---|
| `Supino` / `supino` / `Agachamento` / `Rosca` / `remada` | 3 / 3 / 4 / 10 / 4 ✔ | — |
| `Agachamento Búlgaro` | 1 ✔ | — |
| **`agachamento bulgaro`** | **0** ✘ | **0** ✘ |
| **`triceps testa`** | **0** ✘ | **0** ✘ |
| **`elevacao lateral`** / `elevacao` | **0** ✘ | **0** ✘ |
| **`abdomen`** / `gluteo` | **0** ✘ | **0** ✘ |
| `triceps` / `biceps` | 6 (only via the English enum `triceps`/`biceps`) | — |
| `Bench Press` / `squat` (English canonical) | 1 / 4 ✔ | — |

Phone keyboards and users often skip accents. Fix: fold both sides with `s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()`.

### Untranslated-string sweep — **F2 (medium): raw English Firebase errors**
- **Clean:**
  - A heuristic sweep of JSX text, `aria-label`/`placeholder`/`title`/`alt`/`label` props and `confirm`/`alert` calls finds 0 hits (`untranslated-sweep.txt`).
  - All UI copy comes from `PT_BR`, and `format.ts` uses `Intl` `pt-BR` formatters.
  - `index.html` has `lang="pt-BR"`, and the manifest has `lang`/`description` in PT.
  - No `en-US` or locale-less `toLocale*` calls.
- **Leak:** raw SDK `err.message` is rendered verbatim in these places:
  - `auth.tsx` lines 66, 90 and 107 (init) and 124 and 132 (popup/redirect) → `SignIn.tsx:47`
  - `ExerciseFormSheet.tsx:58` save error (Firestore, for example "Missing or insufficient permissions.")
  - `SessionDetail.tsx:42` load error
- **Browser evidence:** **EVAL-16-AUTH** with `auth/network-request-failed` shows **`Firebase: Error (auth/network-request-failed).`** The product's own `tests/e2e/auth.spec.ts:88` asserts the English `Firebase: Error (auth/invalid-api-key).`.
- The literal fallback `'config'` (auth.tsx 66/90/107) would also render as text.
- Fix: map `FirebaseError.code` to PT_BR messages (`auth/network-request-failed`, `auth/popup-blocked`, `auth/invalid-api-key`, `permission-denied`, `unavailable`, …) with a generic PT fallback.

## L1 / L2 — PASS
```
GET /api/healthz   200 {"status":"ok","revision":"marombapp-serving-00007-nqd","firestoreDatabase":"marombapp","aiReady":true}
GET /manifest.webmanifest 200 {"name":"MarombApp",...,"description":"Diário pessoal de musculação","lang":"pt-BR",...}
GET / (html lang="pt-BR") | /sw.js | workbox   200     /favicon.ico 404 (F5)
14/14 protected probes -> 401 JSON · /api/unknown (GET/POST), /api, /api/healthz/ -> 404 JSON · POST /api/healthz -> 405 JSON
8 client routes -> 200 byte-identical index.html (sha 99b8a01c22037f92)
```

## L3 — PASS
| Step (`/tmp/eval-src-8d46610`) | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 (tsc ×2 + check-arch **83 files**) |
| `npm run test:unit` | exit 0 (**14 files, 84 tests**: deletion 4, planDeletionUi 2, i18n 4, format 16, …) |
| `npm run build` | exit 0 (13 precache entries) |
| `npx playwright test` | exit 0 (**40 passed**, 2.2 min, `mobile-390x844`) |

- **Live 390x844:** 7 routes return 200 and show "MarombApp · Entre para acompanhar seus treinos · **Entrar com Google**".
  - 0 pageerror, 0 nav, 0 AI mentions, SW registered.
  - The popup opens `accounts.google.com`, and the offline reload serves the shell.
- **L3-ARCH:**
  - Entrypoints: `main.tsx` 15, `App.tsx` 82, `server/index.ts` 27 lines.
  - Largest modules: **`PlanListView.tsx` 292**, **`sessions.ts` 292**, `InGym.tsx` 290 (F3).
  - In 52 files: 0 import cycles, 0 missing docblocks.
  - 0 `;` in docblock prose across all 45 #14/#15/#16-changed src/test files.

## L4 — PASS
- **Secrets:** 12 live assets and `dist/` have 0 hits. The only `AIza…` is the public `vibe-cabral` key.
- **Config:** `projectId:"vibe-cabral"`, `authDomain:"vibe-cabral.firebaseapp.com"`, ALLOWED_UID `iELlq0wRQhR2F5NmrM6pbMSrJuj1`, databaseId `marombapp`.
- **DB isolation:** see the ADR-005 table.
- **No AI UI** in source or the live DOM.
- **Offline:** persistent cache kept, `offline.spec` passes, live offline reload works.

## L5 — PASS (idle host, after Playwright)
```
/api/healthz      n=50 [200] min=33.9 p50=40.6 p95=57.1 p99=59.4 ms
/api/auth/session n=50 [401] min=33.6 p50=41.1 p95=61.4 p99=70.5 ms
```

## Regression (#5, #6, #8, #9, #10, #11, #12, #13) — none
- `server/`, `sessionShadow.ts`, `usePlanDayExercises.ts`, `firebase.ts`, rules and indexes are unchanged.
- `auth.tsx` only swaps a fallback string.
- All prior specs pass in PT-BR form.

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | Vitest 84 + Playwright 40 at 390x844. Tests write only to fakes or `marombapp-test` |
| REQ-002 | PASS | Full PT-BR display layer, stored data unchanged, #14 stall removed. F1 and F2 are quality gaps |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 ([ADR-001]) |
| REQ-004 | PASS | Single-UID rules on both DBs, `(default)` untouched ([ADR-004], [ADR-005]) |
| REQ-005 | PASS | No credentials or Vertex SDK in bundles, no AI UI |
| REQ-006 | PASS | Limits met (max 292), 0 cycles, STE docblocks ([ADR-003] scope kept) |

## Findings
1. **F1 — medium (REQ-002, #16):** accent-sensitive search in Library and ExercisePicker. 4/4 browser probes fail. **Recommend an `eval-finding`.**
2. **F2 — medium (REQ-002, #16):** raw English Firebase/Firestore `err.message` in SignIn, the ExerciseForm save error and the SessionDetail load error. `auth.spec` asserts the English text. **Recommend an `eval-finding`.**
3. **F3 — info (REQ-006):** `PlanListView.tsx` and `sessions.ts` are at 292/300, and `InGym.tsx` at 290.
4. **F4 — low (carried, PO):** archived plans are hidden and undeletable, and abandoned sessions persist.
5. **F5 — low (carried):** `run.services.get` is denied for `vibe-agent@`. Favicon 404. COOP warnings. A PO smoke test on real data is still needed for authenticated journeys.

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
[ADR-005]: ADR-005-marombapp-db-is-production-marombapp-test-for-tests
