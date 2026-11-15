# Blind L1–L5 Evaluation · #21 Re-verify (PT-BR search + localized errors) · #14 — `marombapp-serving-00009-vvr` (`64f7cd6`)

- **Run ID:** `eval-20261115-00009-vvr` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-15
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004], [ADR-005]). Rollback is `marombapp-serving-00008-m7h`.
- **Source:** `64f7cd6a37edbdf66d308cc3f565927fcb7b9ae9` → `/tmp/eval-src-64f7cd6`. The only change since `bfdd480` is `64f7cd6` (#21), plus the LIVE.md doc commit.
- **ADR-005:** **zero Firestore writes.**
  - Live checks were unauthenticated GETs plus rules and index metadata reads.
  - All UI, unit and adversarial probes ran on the e2e fake build or in-process modules.
- **JSON:** `/scion-volumes/scratchpad/eval-20261115-00009-vvr.json`. `--project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Artifacts:** `/scion-volumes/scratchpad/eval-00009-vvr-artifacts/`:
  - `eval-adversarial-16-21.json`, `i18n21-probe.json`
  - `mutation-21-unit-on-bfdd480.log`, `mutation-21-e2e-on-bfdd480.log`
  - pipeline logs, live probes, latency samples, scripts

## Verdict: **PASS** — 16/16 golden probes
| Item | Verdict |
|---|---|
| #21 | **VERIFIED** (closes eval-00007 F1 and F2) |
| #14 / #17 / #19 | **NO REGRESSION** |
| Findings | info only |

| Level | Verdict | Key metric |
|---|---|---|
| L1 | PASS | healthz 200 `{status:ok, revision:marombapp-serving-00009-vvr, firestoreDatabase:marombapp, aiReady:true}`. Manifest and `<html>` lang `pt-BR`. 12/12 assets return 200 |
| L2 | PASS | 14/14 protected probes return 401 JSON (unit 403 with 0 Vertex calls). 8/8 SPA routes byte-identical. 4/4 return 404 and 1/1 returns 405 JSON |
| L3 | PASS | Parity **1.0** (Playwright **41/41**, Vitest **107/107** in 19 files) · arch **1.0** (check-arch 94 files) |
| L4 | PASS | 0 secrets. Live `databaseId` is `marombapp`. Rules == repo on both DBs, index READY on both, unauthenticated 403 on both. `(default)` untouched |
| L5 | PASS | healthz p50 **62.5** / p95 **88.0** / p99 **153.5** ms (session 62.6/88.0/95.8) · 50/50 on `00009-vvr` |

> **Process note:** the first pipeline `npm run test:unit` exited 1. The only failure was *my* temporary probe file, which the run collected while I was removing it. All 107 product tests passed in that run. A clean rerun exits 0 with 107/107 (`npm_run_test_unit.log`; the contaminated log is kept for transparency).

## #21 — **VERIFIED**
### F1: diacritic-insensitive search
- **Code:**
  - `src/lib/i18n/search.ts` `foldSearch()` applies `normalize('NFD')`, strips `\p{Diacritic}` and lower-cases, and is null-safe.
  - It is applied to the query **and** to all 6 candidate fields (PT name, PT muscle, PT sub-muscle, English name, enum, sub-muscle key) in `Library.tsx` and `ExercisePickerModal.tsx`.
- **My eval-00007 spec, re-run and extended (browser, 390x844):** all searches below **PASS**. With the same base probes, eval-00007 failed 5/6.

| Surface | Queries (all PASS) |
|---|---|
| Library | `agachamento bulgaro`, `triceps testa`, `elevacao lateral`, `abdomen`, `elevacao`, `gluteo`, `ombro`, `bench press`, `skull crushers`, `Agachamento Búlgaro` |
| Library, custom | `rotacao` → *Crucifixo Inclinado com Rotação* (accented custom) · `rotacão` → *Remada Rotacao Neutra* (unaccented custom) |
| PlanDay picker | `agachamento bulgaro`, `triceps testa`, `flexao nordica`, `rotacao`, `hamstrings` |

- **Unit matrix** (real modules, 21 queries) gives the same results, plus `ROTAÇÃO`, `  Tríceps  `, `posterior de coxa` and `peitoral superior`.
- `gemeos` returns 0 because "gêmeos" isn't in the glossary (F1, vocabulary only).

### F2: localized Firebase / Firestore errors
- **Code:** `src/lib/i18n/errors.pt-BR.ts` `localizeFirebaseError(err, fallback)` maps `err.code`, codes embedded in the message (`(auth/…)`), `firestore/`-prefixed codes, the "Missing or insufficient permissions" text and `config` to PT-BR. Anything else gets the caller's PT fallback.
- **Wired into:**
  - all 5 `auth.tsx` error paths (init ×3, redirect, popup)
  - `ExerciseFormSheet` save
  - `SessionDetail` load
  - `SignIn` also maps any stray `config` or `Firebase:` string at render time.
- **Matrix** (`i18n21-probe.json`, 25 inputs) leaks **no raw SDK text**:

| Inputs | Result |
|---|---|
| `FirebaseError(auth/network-request-failed)`, `{code,message}` shape, raw `"Firebase: Error (auth/network-request-failed)."` string | "Sem conexão de rede. Verifique sua internet e tente novamente." |
| `firestore/permission-denied`, `permission-denied`, message-only "Missing or insufficient permissions." | "Sem permissão para acessar ou salvar estes dados." |
| `unavailable` / `deadline-exceeded` / `unauthenticated` | PT unavailable, timeout and session-expired copy |
| `auth/popup-closed-by-user`, `auth/cancelled-popup-request`, `auth/popup-blocked`, `auth/invalid-api-key`, long `auth/api-key-not-valid.-please-pass…` | specific PT copy (closed and cancelled are also suppressed in `auth.tsx`) |
| `'config'`, `Error('config')` | PT config message |
| `auth/internal-error` | "Erro interno de autenticação…" |
| #19 `Refusing Firestore database "(default)"…`, `auth/totally-new-code`, `Failed to fetch`, `'boom'`, `null`, `{}`, `undefined`, English text with parentheses | caller's PT fallback |

- **`src/` sweep:**
  - 0 remaining `err.message`, `error.message` or `String(err)` render sites.
  - The only `.message` read is `apiClient.ts:144`, which parses BFF JSON and has no UI importer.
  - No `alert` or `confirm` calls receive error objects.
  - Every `set*Error` call uses `localizeFirebaseError`, a `PT_BR` constant or `'unauthorized'`.
- **Browser:**
  - **EVAL-16-AUTH** (`auth/network-request-failed`) renders "Sem conexão de rede. Verifique sua internet e tente novamente." with no `Firebase: Error`. It failed in eval-00007.
  - **EVAL-21-SAVE**: a forced `permission-denied` save rejection in ExerciseFormSheet renders PT copy, with no "Missing or insufficient…" text.
  - SessionDetail load rejection is covered by `firebaseErrorsUi.test.tsx` (unavailable and unknown → PT). The fake store serves reads from memory, so the browser can't force a read rejection.

### Rule 4 mutation (`invariants.md`)
| Tests from `64f7cd6` run on pre-#21 `bfdd480` | Result |
|---|---|
| Unit: `auth.test.tsx`, `firebaseErrorsUi.test.tsx`, `i18n.test.ts` | **7 FAIL** (all #21 tests) / 6 pass (pre-existing #9/#16 tests) |
| E2E: `auth.spec.ts`, `library.spec.ts` | **3 FAIL** (exactly: popup/network PT copy, config PT copy, unaccented search in Library+Picker) / 11 pass |
| Same tests on `64f7cd6` | all pass |

## Regression: #14, #17, #19 — none
- `src/lib/db`, `src/screens/plan`, `server/`, `src/lib/firebase.ts` and the rules are byte-identical to `bfdd480`.
- Tests pass: `deletion.test` 4/4, `planDeletionUi` 2/2, `planOfflineMutations` 3/3, `planOfflineUi` 3/3, `firebase.test` 5/5, `bff.test`.
- The live bundle `databaseId` default is `marombapp`, and healthz reports `marombapp`.

## L3-ARCH / STE / L4 details
- **Architecture:**
  - Entrypoints: `main.tsx` 15, `App.tsx` 82, `server/index.ts` 27 lines.
  - Largest modules: `copy-default-to-marombapp.mjs` 294, `sessions.ts` 292, `plans.ts` and `InGym.tsx` 290.
  - The new `errors.pt-BR.ts` is 122 lines and `search.ts` is 17.
  - In 57 files: 0 import cycles, 0 missing docblocks.
  - **0 `;`** in docblock prose across the 14 #21 files.
- **Secrets:** 12 live assets and `dist/` have 0 hits. The only `AIza…` is the public `vibe-cabral` key. The live bundle contains `normalize("NFD")` and the PT error copy.
- **DB:** `marombapp`→`88e55196` and `marombapp-test`→`81832c18`, both equal to `firestore.rules@64f7cd6`. `CICAgOjXh4EK` is READY on both, and unauthenticated GETs return 403 ×3 on each. `(default)` has 0 indexes and release `6f770431` (2026-06-04).
- **No AI UI.** `offline.spec` passes.

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | 107 unit + 41 E2E. Rule 4 proven for #21 (unit 7 and E2E 3 fail pre-fix) |
| REQ-002 | PASS | PT-BR search ignores accents and every SDK error is localized. Offline paths unchanged |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 ([ADR-001]) |
| REQ-004 | PASS | Single-UID rules on both DBs. `(default)` untouched ([ADR-004], [ADR-005]) |
| REQ-005 | PASS | No credentials or Vertex SDK in bundles. No AI UI |
| REQ-006 | PASS | Limits met (max 294), 0 cycles, STE docblocks ([ADR-003] scope kept) |

## Findings (info only, none blocking)
1. **F1 — info (#21 scope):** `gemeos`/"gêmeos" (a common word for calves) isn't in the glossary, so it returns 0 results. This is vocabulary, not diacritics. Optional: search aliases.
2. **F2 — info:** `localizeFirebaseError` takes the first parenthesized token as a code, so the #19 refusal reads as `default`. It still falls back correctly to PT; noted for future message formats.
3. **F3 — info (carried):**
   - unused module-level `FIRESTORE_DATABASE_ID` (white-screen on a misconfigured build);
   - the DB guard is a denylist;
   - concurrent `addPlanDay` can produce a duplicate order.
4. **F4 — info (carried, REQ-006):** four modules are at 290–294 lines.
5. **F5 — low (carried):**
   - `run.services.get` is denied for `vibe-agent@`;
   - favicon 404;
   - COOP popup warnings;
   - PO smoke test on real data and the archived-plans decision are pending;
   - #20 is tracked (not re-filed).

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
[ADR-005]: ADR-005-marombapp-db-is-production-marombapp-test-for-tests
