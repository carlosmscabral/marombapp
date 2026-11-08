# Testing playbook — as-is parity suite

Delivers REQ-001 and guards REQ-002. Follows ADR-002 (never touch production `vibe-cabral` data) and ADR-003.

## Commands

| Command | Runs |
|---|---|
| `npm test` | `npm run test:unit` and then `npm run test:e2e`. Both must pass. |
| `npm run test:unit` | Vitest, `tests/unit/**/*.test.ts(x)`, Node environment, about 5 s. |
| `npm run test:e2e` | Playwright, `tests/e2e/**/*.spec.ts`, Chromium at 390x844, about 4 min on a 4-vCPU container. |

Playwright uses the system Chromium (`/usr/bin/chromium`, override with `CHROMIUM_PATH`). Never run
`npx playwright install` in agent containers. Set `E2E_PORT` if port 4173 is busy.

## Data strategy: fake Firebase modules, test build only

The Firebase emulators need Java, and the containers do not have it. Thus the e2e build aliases the SDK to
in-browser fakes. The `lead` approved this choice on issue #2.

- `vite.e2e.config.ts` extends `vite.config.ts`. It aliases `firebase/app`, `firebase/auth`, and
  `firebase/firestore` to `tests/e2e/fakes/*`, and it sets `VITE_FIREBASE_ALLOWED_UID=e2e-allowed-uid`.
- Playwright builds with that config into `dist-e2e/` and serves it with `vite preview`. The suite tests a
  production bundle (lazy chunks, no StrictMode double effects), not the dev server.
- `npm run build` never reads `vite.e2e.config.ts`. `dist/` always bundles the real SDK. No file under `src/`
  knows about the fakes.
- No spec opens a connection to any Google endpoint. No credential exists in the e2e build.

### How the fakes behave

- **Auth** (`fakes/firebase-auth.ts`): the signed-in user lives in `localStorage` (`fake-auth:user`), so the
  session survives a reload. The "Google popup" returns the uid in `fake-auth:popup-uid` (default
  `e2e-allowed-uid`). If `fake-auth:popup-error` holds a code, the popup rejects with it. Specs cover the
  signed-out, wrong-UID, and allowed-UID gate states.
- **Firestore** (`fakes/fake-store.ts`, `fakes/firebase-firestore.ts`): every document lives in
  `localStorage` (`fake-fs:docs`), keyed by path such as `plans/p1/days/d1`. Data survives a reload, so the
  rest-timer and active-session reload specs are real. Listeners fire after every write and on `storage`
  events from other tabs.
- Specs seed state with `boot(page, { docs, signedIn })` from `tests/e2e/support/app.ts`. It writes storage
  once per tab, before the app boots. Assertions read the store back with `readDocs` and `expectStore`.

### Limits of the fakes (what this suite does not prove)

- **No security rules.** `firestore.rules` and the BFF auth middleware need their own tests (REQ-004).
- **No IndexedDB cache and no write queue.** `localStorage` stands in for `persistentLocalCache`.
  `metadata.hasPendingWrites` is always `false`, so the `sessionShadow` "keep shadow while writes are
  pending" branch never runs in e2e.
- **No latency.** Writes commit synchronously, so race windows are smaller than on a phone. Back-to-back
  taps are tested. Two latent races stay out of the parity specs on purpose:
  [#6](https://github.com/carlosmscabral/marombapp/issues/6) (`sessionShadow` same-tick mutations lose writes)
  and [#8](https://github.com/carlosmscabral/marombapp/issues/8) (PlanDay re-render drops a fast follow-up
  field edit). The plan spec edits one field at a time for that reason. When a fix lands, add its regression spec.
- **Query subset only.** `where` supports `==` only, plus `orderBy` and `limit`. A new query shape throws
  `unsupported where op`. Extend the fake in the same change.
- `serverTimestamp()` resolves to a number, not a `Timestamp`. `planFromDoc` accepts both.
- **No real Google sign-in.** OAuth popup and redirect wiring are tested only up to the SDK boundary.

## Determinism rules

- Locale is `en-US` and the timezone is `America/Sao_Paulo`, pinned in `playwright.config.ts`.
- Never call `page.waitForTimeout`. Use web-first assertions, `expect.poll`, or `expectStore`.
- Rest-timer specs drive time with `page.clock`. Real time still flows, so the assertions accept a window
  (for example `01:05` to `01:49`), never an exact second after a slow step.
- Service workers are blocked except in `offline.spec.ts`, so no spec sees a stale precache.
- `retries: 0`. A flaky spec is a bug. Budgets are 90 s per test and 10 s per assertion, because a cold
  4-vCPU container needs up to about 50 s for the first test.
- Each test gets a fresh browser context, so storage never leaks between tests.

## Journey to spec coverage (as-is app `a521b53`)

| Journey | Spec | Test |
|---|---|---|
| Single-UID auth gate: signed out | `tests/e2e/auth.spec.ts` | signed-out visitors see only the sign-in screen |
| Auth gate: wrong UID rejected | `tests/e2e/auth.spec.ts` | a non-allowlisted account is signed out… |
| Auth gate: allowed UID, reload, sign-out | `tests/e2e/auth.spec.ts` | the allowlisted account enters…, sign-out from the account menu… |
| Auth errors and redirect fallback | `tests/e2e/auth.spec.ts` | closing the popup…, a blocked popup falls back… |
| SPA fallback for unknown client routes | `tests/e2e/auth.spec.ts` | unknown client routes redirect to analytics… |
| 66-exercise seed, once only | `tests/unit/seed.test.ts`, `tests/e2e/library.spec.ts` | seeds exactly 66… |
| Library browse, chips, search | `tests/e2e/library.spec.ts` | lists exercises alphabetically and filters… |
| Built-in exercises are read-only | `tests/e2e/library.spec.ts` | built-in exercises open read-only details… |
| Custom Library CRUD | `tests/e2e/library.spec.ts` | creates, edits, and deletes a custom exercise; custom exercises survive a reload… |
| Plan create, first plan auto-active | `tests/e2e/plan.spec.ts` | the first plan becomes active… |
| PlanDay add, reorder, delete with confirm | `tests/e2e/plan.spec.ts` | days reorder with arrows… |
| Day exercises, targets, notes, order, rename, delete | `tests/e2e/plan.spec.ts` | a day edits exercises, targets, notes, order, and name |
| Plan rename, set active, archive | `tests/e2e/plan.spec.ts` | plans rename, switch the active plan, and archive… |
| Start workout from the active plan | `tests/e2e/in-gym-start.spec.ts` | without an active plan…, start workout lists days… |
| History weight and rep pre-fill | `tests/unit/history.test.ts`, `tests/e2e/in-gym-start.spec.ts` | picking a day creates a session with history pre-fill… |
| Last-3-executions display | `tests/unit/history.test.ts`, `tests/e2e/in-gym-start.spec.ts` | picking a day creates a session… |
| Active-session banner and /start redirect | `tests/e2e/in-gym-start.spec.ts` | an active session shows the resume banner… |
| sessionShadow serialized writes | `tests/e2e/in-gym-start.spec.ts` | rapid set completions all persist… |
| Set logging and un-complete | `tests/e2e/in-gym-logging.spec.ts` | the rest bar counts up… |
| Reload-persistent sticky RestBar count-up | `tests/e2e/in-gym-logging.spec.ts` | the rest bar counts up from each completed set and survives a reload |
| Session elapsed clock | `tests/unit/format.test.ts`, `tests/e2e/in-gym-logging.spec.ts` | the session clock shows elapsed workout time |
| Mid-workout set and exercise add or remove | `tests/e2e/in-gym-logging.spec.ts` | sets and exercises can be added and removed mid-workout |
| Session and exercise notes, finish | `tests/e2e/in-gym-logging.spec.ts` | notes persist and finishing opens the session detail |
| Abandon | `tests/e2e/in-gym-logging.spec.ts` | abandoning ends the session… |
| Keystroke debounce flush and cancel | `tests/unit/debounce.test.ts` | all |
| Lazy Analytics route | `tests/e2e/analytics.spec.ts` | the analytics route loads its code-split chunk on demand |
| Analytics totals, pie, recent sessions, overload chart | `tests/e2e/analytics.spec.ts` | an empty history…, weekly totals, muscle split… |
| SessionDetail | `tests/e2e/analytics.spec.ts` | a recent session opens its detail…, session detail shows incomplete sets… |
| PWA manifest and offline reload | `tests/e2e/offline.spec.ts` | all |

## Add a spec

1. Put it in `tests/e2e/<journey>.spec.ts`. Start the file with a Why-focused STE100 header.
2. Seed with the builders in `tests/e2e/support/data.ts`. Do not click through setup that another spec covers.
3. Assert visible text and the persisted store. Add a row to the table above.
