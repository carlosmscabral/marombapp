# Blind L1–L5 Evaluation + Verification (#6, #8, #11; regression #5, #9, #10) — `marombapp-serving-00003-hts` (`5ceebae`)

- **Run ID:** `eval-20261108-00003-hts` · **Golden:** `golden-v1.jsonl` (16 probes) · **Evaluator:** `domain-evaluator` · **Date:** 2026-11-08
- **Target:** `https://marombapp-serving-280799742875.us-central1.run.app`, GCP project `vibe-cabral` ([ADR-004]). Rollback is `marombapp-serving-00002-rf6`.
- **Source:** `5ceebae7cefd7babb79a7a2abd0ea876fee66a1e`, extracted with `git archive` from `origin/factory/main` to `/tmp/eval-src-5ceebae`. Changes since `a446a59`:
  - `0b11c13` (#11)
  - `892218f` (#6)
  - `5ceebae` (#8)
- **JSON:** `/scion-volumes/scratchpad/eval-20261108-00003-hts.json`. `factory_store.py --project vibe-cabral --database marombapp --dry-run put-eval-run` exits 0.
- **Raw artifacts:** `/scion-volumes/scratchpad/eval-00003-hts-artifacts/`:
  - pipeline logs, live probes, live assets, UI JSON and screenshot
  - rules release and ruleset JSON, index listings
  - 2 latency runs, scripts

## Verdict: **PASS** — 16/16 golden probes

| Level | Verdict | Key metric |
|---|---|---|
| L1 Health | PASS | healthz 200 strict JSON, `revision=marombapp-serving-00003-hts`. The SW registers at 390x844 |
| L2 Contract | PASS | 14/14 protected probes return 401 JSON. 4 unknown `/api` routes return 404 JSON and `POST /api/healthz` returns 405. 8 SPA routes return byte-identical `index.html` |
| L3 Domain | PASS | `as_is_functional_parity_pass_rate` = **1.0** (Playwright 34/34, 8/8 journeys; Vitest 70/70) · `modular_architecture_compliance_rate` = **1.0** |
| L4 Safety | PASS | 0 secrets. Rules release `88e55196` matches `firestore.rules`. Index READY. `(default)` untouched |
| L5 Latency | PASS | healthz p50 **36.3** / p95 **41.4** / p99 **46.0** ms (SLO 80/250/500) |

**Δ vs `eval-20261108-00002-rf6`:**
- Unit tests went from 63 to 70.
- `PlanDay.tsx` went from 287 to 245 lines.
- The `firebaserules` read gap from the last run (F1) is closed: `vibe-agent@` can now read releases and rulesets, so the rules deployment is verified **directly** and no longer only by behaviour.
- Latency is lower (healthz p50 from 40.9 to 36.3 ms).

## Work-item verification
### #6 — sessionShadow same-tick race — **VERIFIED**
- `src/lib/db/sessionShadow.ts` (120 lines) adds a per-session `mutationQueues` promise chain:
  - Each read-modify-write step reads `exercisesShadow` **after** the previous step, so same-tick callers compose and no longer overwrite each other.
  - The tracked queue promise resolves when the RMW step finishes, **not** on the `updateDoc` server ack. Offline writes go to Firestore's local queue without blocking later mutations, so the non-blocking behaviour is preserved.
  - The promise returned to callers still resolves on the write, which matches the previous behaviour.
  - `syncShadowFromSnapshot` ignores server snapshots while a queue is active, and `clearShadow` evicts the queue.
- Evidence: `tests/unit/sessionShadow.test.ts` passes 5/5. The E2E `in-gym-start` "rapid set completions all persist through the serialized session shadow" passes, as does `offline.spec`.

### #8 — PlanDay snapshot drops fast edits — **VERIFIED**
- New `src/screens/plan/usePlanDayExercises.ts` (166 lines, docblock explains the *why*):
  - It keeps pending field patches keyed by `exerciseId#occurrence` and overlays them on each incoming snapshot, so an intermediate echo can no longer drop keystrokes.
  - A patch is pruned in an effect once the snapshot echoes its values. Structural edits (move, remove, append) cancel the debounce and clear patches, as the old code did.
- `PlanDay.tsx` is now 245 lines.
- Evidence: `tests/unit/planDay.test.tsx` passes 2/2, and `plan.spec` passes 4/4.
- Info F4: see open findings.

### #11 — stale `cabral-scion-hub` references — **VERIFIED**
At `5ceebae`, `grep cabral-scion-hub` over `src server tests scripts firebase.json .firebaserc knowledge-plane/playbooks/DEPLOY.md` finds **0 hits**. The cleanup is live.

### Regression: #5 / #9 / #10 — **NO REGRESSION**
- **#5:** L1–L5 pass. The live bundle has the real `vibe-cabral` web config.
- **#9:**
  - SignIn mounts on all 7 routes with 0 `pageerror` and no `invalid-api-key`.
  - The Sign-in click opens `accounts.google.com/v3/signin/identifier?…context_uri=https://marombapp-serving-280799742875…`.
  - The client gate still fails closed on an empty ALLOWED_UID (unit test).
- **#10 (strengthened):**
  - `releases/cloud.firestore/marombapp` points to `rulesets/88e55196-5b7e-400a-927f-70777c7c9001` (created 2026-11-08T13:05:35Z).
  - The ruleset source file `firestore.rules` is **identical** to `firestore.rules@5ceebae`: read/write only if `request.auth.uid == 'iELlq0wRQhR2F5NmrM6pbMSrJuj1'`.
  - Index `CICAgOjXh4EK` `sessions(status ASC, finishedAt DESC, __name__ DESC)` is **READY**.
  - Unauthenticated REST reads of `exercises`, `plans` and `sessions` return `403 PERMISSION_DENIED`.
  - **`(default)` untouched (read-only checks):** 0 composite indexes. Its release `cloud.firestore` → `6f770431…` was last updated **2026-06-04**, before the factory existed. The other DB releases (`jogo-navinha`, `ai-studio-…`) are also older. No write was made.

## L1 Health — PASS (L1-01, L1-02)
```
GET /api/healthz          200 {"status":"ok","revision":"marombapp-serving-00003-hts","firestoreDatabase":"marombapp","aiReady":true}
GET / | /manifest.webmanifest | /sw.js | /workbox-9c191d2f.js   200
GET /favicon.ico          404 (F3)
```
The traffic split cannot be read (`run.services.get` denied, F1). All 100/100 timed healthz responses report `00003-hts`.

## L2 Contract — PASS (L2-01, L2-02)
```
GET /api/auth/session, POST /api/ai/workout, POST /api/ai/evaluate, GET /api/ai, OPTIONS /api/ai/workout
   none | "Bearer" | garbage | alg:none JWT (sub=ALLOWED_UID) | Basic          -> 14/14 401 JSON unauthenticated
GET|POST /api/unknown, GET /api, GET /api/healthz/                             -> 404 JSON not_found
POST /api/healthz                                                              -> 405 JSON method_not_allowed
/ /analytics /plan /library /in-gym /start /sessions/123 /unknown-client-route -> 200, byte-identical (sha 997194ad50704728)
```
`tests/unit/bff.test.ts:164` checks the 403 for non-`ALLOWED_UID` and unset `ALLOWED_UID`, and asserts that `getVertexClient` is not called. The live browser probe saw 0 requests to `/api/ai` or Vertex AI.

## L3 Domain Quality — PASS
| Step (`/tmp/eval-src-5ceebae`) | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run lint` | exit 0 (tsc ×2 + check-arch **75 files**) |
| `npm run test:unit` | exit 0 (**11 files, 70 tests**; `sessionShadow` 5, `planDay` 2) |
| `npm run build` | exit 0 (13 precache entries) |
| `npx playwright test` | exit 0 (**34 passed**, 2.0 min, `mobile-390x844`) |

| Golden | Journey | Result |
|---|---|---|
| L3-J1 | Auth gate (`auth.spec`, plus live gate and popup) | PASS |
| L3-J2 | 66 seed + Library CRUD (`library.spec` 5/5) | PASS |
| L3-J3 | Plan & PlanDay (`plan.spec` 4/4 + `planDay.test` 2/2) | PASS |
| L3-J4 | InGym logging (`in-gym-*` + `sessionShadow.test` 5/5) | PASS |
| L3-J5 | Reload-persistent RestBar | PASS |
| L3-J6 | Last-3 executions | PASS |
| L3-J7 | Analytics (lazy) | PASS |
| L3-J8 | SessionDetail | PASS |

**Live 390x844 (`/usr/bin/chromium`, isMobile), 7 routes:**
- 200, SignIn mounted (1659 chars)
- 0 `pageerror`, 0 `<nav>`, no `invalid-api-key`, 0 AI mentions
- SW registered
- the popup opens Google sign-in
- the offline reload serves the shell

Authenticated live journeys need the owner's account (F2).

**L3-ARCH = 1.0 (my own scan, `scripts/arch.py`):**
- Entrypoints: `main.tsx` 15, `App.tsx` 81, `server/index.ts` 27 lines.
- Largest modules: `Analytics.tsx` 290, `InGym.tsx` 287, `db/sessions.ts` 281.
- In 50 files: 0 over 300 lines, **0 import cycles**, 0 missing docblocks.

## L4 Safety & Grounding — PASS (L4-01, L4-02)
- **Secrets:**
  - I scanned 13 live assets (`index.html`, `sw.js`, workbox, `registerSW`, manifest, 6 JS/CSS chunks including lazy `Analytics`) and the local `dist/`.
  - Patterns: `private_key`, `BEGIN … PRIVATE`, `client_email`, `@google/genai`, `GoogleGenAI`, `aiplatform`, `generativelanguage`, `ya29.`, `service_account`, `GOOGLE_CLOUD_PROJECT`, `client_secret`, `e2e-allowed-uid`, `fake-store`.
  - Result: **0 hits**. The only `AIza…` is the public `vibe-cabral` Firebase web key.
- **Config:** `projectId:"vibe-cabral"`, `authDomain:"vibe-cabral.firebaseapp.com"`, `appId:"1:280799742875:web:e47e00f1afcdab5e92af3e"`, ALLOWED_UID `iELlq0wRQhR2F5NmrM6pbMSrJuj1`, databaseId `marombapp`.
- **DB isolation:** the rules release is verified directly, the index is READY, unauthenticated reads are denied, and `(default)` is untouched (see #10).
- **No AI UI:** grep of `src/screens` and `src/components` finds nothing, and `apiClient.ts` has no UI importer.
- **Offline:** `persistentLocalCache({tabManager: persistentMultipleTabManager()})` is kept (`firebase.ts:76-77`). The #6 queue stays non-blocking. `offline.spec` passes, and the live offline reload works.

## L5 Latency — PASS (L5-01)
```
idle host (recorded):
/api/healthz      n=50 [200] min=31.7 p50=36.3 p95=41.4 p99=46.0  max=46.0 ms
/api/auth/session n=50 [401] min=32.1 p50=35.9 p95=45.2 p99=49.1  max=49.1 ms
contended host (first sample, concurrent with local Playwright):
/api/healthz      n=50 [200] min=36.9 p50=57.4 p95=94.9 p99=119.3 ms
/api/auth/session n=50 [401] min=38.3 p50=71.1 p95=129.6 p99=188.1 ms
```
Method: 5 warmups, then 50 sequential `curl` requests, each with a new TLS connection. Times are client-side with nearest-rank percentiles. Both samples are within the SLO. The spread in the first sample came from load on my own host, not from the service.

## Requirement status
| REQ | Status | Note |
|---|---|---|
| REQ-001 | PASS | Vitest 70 + Playwright 34 at 390x844, 8/8 journeys |
| REQ-002 | PASS | #6 and #8 close as-is data-loss races with no UI change. Offline kept, no AI UI |
| REQ-003 | PASS | healthz, SPA fallback, `/api` 404/405 JSON ([ADR-001]) |
| REQ-004 | PASS | BFF 401/403. Rules release == single-UID rules on `marombapp`. Index READY. `(default)` untouched ([ADR-004]) |
| REQ-005 | PASS | Zero credentials or Vertex SDK in bundles. `/api/ai` dormant behind auth |
| REQ-006 | PASS | All limits met (PlanDay 245, hook 166, max 290), 0 cycles ([ADR-003] scope kept) |

## Open findings
1. **F1 — residual evidence gap (REQ-003/REQ-004), low:** `run.services.get` is still denied for `vibe-agent@`, so the traffic split, runtime SA and BFF `ALLOWED_UID` env are unverified directly. The rules part of the previous F1 is closed.
2. **F2 — L3 caveat, info:** live authenticated J1–J8 against real Firestore need the owner's sign-in. Suggest a PO smoke test, which would also exercise #6 and #8 under real network latency.
3. **F3 — minor (L1), carried over:** `/favicon.ico` returns 404.
4. **F4 — info (#8):** a pending patch is pruned only when the snapshot echoes its values. `setDayExercises(...).catch(() => {})` swallows errors, so a rejected write leaves its patch covering the server value for that field until the next structural edit or a day switch. This is low impact for a single user with the Firestore offline queue. Optional hardening: drop the patch when the write rejects.
5. **F5 — info, carried over:** the Google popup logs 2 COOP `window.closed` warnings from `accounts.google.com`. The app sends no COOP header.

[ADR-001]: ADR-001-unified-cloud-run-bff-static-pwa-serving
[ADR-003]: ADR-003-re-infrastructure-first-wave-scoping
[ADR-004]: ADR-004-co-locate-hub-runtime-and-named-db-in-vibe-cabral
