# Live Mobile PWA Ergonomics & `#13` Deletion UI Audit — `marombapp-serving-00005-99q` (`30e33c3e503c`)

- **Auditor:** `ui-auditor` (`marombapp-eval`)
- **Target Service:** `marombapp-serving` (`https://marombapp-serving-280799742875.us-central1.run.app` in `vibe-cabral`)
- **Live Revision:** `marombapp-serving-00005-99q` (Source commit: `30e33c3e503c744c1c26eea36affc71f416f9fc8`, shipping `#13` *"Deletion review"*)
- **Audit Viewport:** `390x844` (`deviceScaleFactor: 3`, mobile touch enabled, headless `/usr/bin/chromium`)
- **Audited At (UTC):** `2026-11-15T13:35:25Z` – `2026-11-15T13:40:28Z`
- **Cited Specifications:** `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-006`, `ADR-001`, `ADR-003`, `ADR-004`, `invariants.md` (Rules 2 & 3), Issue `#13`

---

## Executive Verdict: **PASS (Live `00005-99q` PWA & All `#13` Deletion Surfaces Verified at `390x844`)**

1. **Live Unpatched Service Audit (`marombapp-serving-00005-99q` in `vibe-cabral` — `REQ-001`–`REQ-005`, `ADR-001`, `ADR-003`, `ADR-004`):** **PASS**
   - All 7 SPA routes (`/`, `/plan`, `/library`, `/in-gym`, `/analytics`, `/start`, `/sessions/123`) return HTTP `200`, `pageErrors: []`, `scrollWidth === 390` (`0` overflowing elements), render `<SignIn />` (`h1` `"MarombApp"` at `14.69:1` WCAG AAA contrast; `"Sign in with Google"` button at **`276px x 44px`** and `6.07:1` WCAG AA contrast), show `hasInvalidApiKeyBanner: false`, and open the live `vibe-cabral` OAuth handler popup (`https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`) on click.
   - `/manifest.webmanifest`, `/icons/icon-192.png`, `/icons/icon-512.png`, and `/sw.js` (`activeState: "activated"`) return `200 OK`; offline reloads (`context.setOffline(true)`) on `/`, `/plan`, and `/in-gym` resolve from Service Worker (`fromServiceWorker: true`) with `scrollWidth === 390` and `pageErrors: []`.
   - Live client bundle `/assets/index-D9ul6UEp.js` (`339,427` bytes) contains `0` speculative AI UI strings, `0` `@google/genai` imports, `0` GCP service-account secrets, and embeds the expected `vibe-cabral` Firebase web config targeting database `marombapp`. `GET /api/healthz` returns `{"status":"ok","revision":"marombapp-serving-00005-99q","firestoreDatabase":"marombapp","aiReady":true}`.
2. **`#13` Deletion UI Ergonomics, Touch-Target Geometry (`>=44x44px`), & Confirmation Safety (`390x844` against isolated `dist-e2e` build of `30e33c3` — `REQ-001`, `REQ-002`, `REQ-006`, `#13`):** **PASS (`15/15` `#13` deletion & inline-cancel controls `>=44x44px`, `scrollWidth === 390`, `0` `pageErrors`, `0` Firebase network calls)**
   - **Mistaken Day Creation & Day/Exercise Deletion (`PlanDay` & `PlanDetailView`):** Creating a day via `Add Day` opens `PlanDay` with a prominent, labeled `"Delete training day"` button (**`202.7px x 44px`** at `(171.3, 160)`, immediately visible in the initial `390x844` viewport without scrolling, `6.01:1` contrast, `confirm('Delete training day "<name>"?')`). `DayRow` trash button (`44px x 44px`), inline `Add Day` `Cancel` button (`71.3px x 44px`), and `PlanDay` `Remove exercise` button (`44px x 44px`, `confirm('Remove "<Ex>" from "<Day>"?')`) all meet `>=44x44px`.
   - **Plan Creation Cancel & Hard Deletion (`PlanDetailView` & `PlanListView`):** Inline `Create plan` `Cancel` (`71.3px x 44px`), `PlanDetailView` `"Delete plan"` (`142.1px x 44px` at `(231.9, 161)`, `inInitialViewport: true`, `6.01:1` contrast), and `PlanListView` `More` (`44px x 44px`) -> `"Delete"` (`174px x 44px`, `6.10:1` contrast) all meet `>=44x44px` and confirm `"Delete plan \"<name>\"? This cannot be undone."`, batch-deleting child days.
   - **Session Deletion (`SessionDetail`):** Completed and abandoned sessions render `"Delete session"` (**`167.5px x 44px`** at `(206.5, 88)`, `inInitialViewport: true`, `6.01:1` contrast, `confirm('Delete session "<dayName>"? This cannot be undone.')`), updating Analytics and In-Gym progressive-overload history; active sessions (`status === 'active'`) hide `"Delete session"` (`0` rendered).
   - **Library Custom Exercise Deletion & Seed Protection (`Library`):** All `66` built-in seeded exercises remain read-only (`0` `Edit` / `0` `Delete` buttons); custom exercises render `Delete` (`176px x 44px`, `5.77:1` contrast) -> two-step inline confirmation `Cancel` (`162px x 44px`) and `Confirm` (`162px x 44px`, `6.09:1` contrast).
   - **Active Workout Removal & Abandon (`InGym`):** `"Remove <Exercise>"` (`44px x 44px`), `"Remove last set"` (`44px x 44px`), and `"Abandon"` (`358px x 44px`, `4.59:1` contrast) all meet `>=44x44px` with confirmation dialogs on destructive state loss.
   - **Non-Blocking Pre-Existing / Adjacent Observations:** Pre-existing `ExerciseFormSheet` `Cancel`/`Create` buttons render at `175px x 40px` (`py-3` without `min-h-11`), `BottomSheet` close `X` renders at `32px x 32px` (backdrop tap also closes), and pre-existing `PlanListView` `More -> Archive` (`174px x 44px`) soft-archives immediately without a confirmation dialog or unarchive view (documented in Section 6).

---

## 1. Live Route Rendering, Page Errors & Overflow (`390x844` — `REQ-001`–`REQ-004`)

All 7 routes were audited directly against `https://marombapp-serving-280799742875.us-central1.run.app` (`marombapp-serving-00005-99q`) without script interception.

| Route | HTTP Status | Uncaught `pageErrors` | `auth/invalid-api-key` Banner | Rendered Heading (`h1`) | Rendered CTA Button (`W x H`) | `scrollWidth` (`<=390`) | Overflowing Elements | Result |
|---|---|---|---|---|---|---|---|---|
| `/` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/plan` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/library` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/in-gym` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/analytics` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/start` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |
| `/sessions/123` | `200` | `0` (`[]`) | `None` (`false`) | `"MarombApp"` | `"Sign in with Google"` (`276x44`) | `390` | `0` | **PASS** |

---

## 2. Live Sign-In Ergonomics, PWA Offline Reload & Bundle Hygiene (`00005-99q`)

- **Sign-In Accessibility & Live OAuth Flow (`REQ-001`, `REQ-004`, `ADR-004`):**
  - `"Sign in with Google"` (`button[type="button"]`): **`276px x 44px`** at `(57px, 488px)`, `borderRadius: 12px`, `rgb(0, 48, 85)` on `rgb(106, 178, 255)` -> **`6.07:1`** WCAG AA (`PASS`).
  - Heading `"MarombApp"` (`h1`): `30px` (`font-weight: 600`), `rgb(219, 229, 255)` on `rgb(0, 19, 47)` / `rgb(4, 22, 51)` -> **`14.69:1` / `14.80:1`** WCAG AAA (`PASS`).
  - Clicking `"Sign in with Google"`: `pageErrors: []`, `hasInvalidApiKeyBanner: false`, opens real OAuth popup `https://vibe-cabral.firebaseapp.com/__/auth/handler?...&authType=signInViaPopup`, `scrollWidth: 390` (`PASS`).
- **PWA Manifest, Icons, Service Worker & Offline Reload (`REQ-002`, `REQ-003`, `ADR-001`):**
  - `GET /manifest.webmanifest` (`200 OK`, `419` bytes), `GET /icons/icon-192.png` (`200 OK`, `3,055` bytes), `GET /icons/icon-512.png` (`200 OK`, `8,602` bytes), `GET /sw.js` (`200 OK`, `1,638` bytes, `activeState: "activated"` at scope `https://marombapp-serving-280799742875.us-central1.run.app/`).
  - `context.setOffline(true)` reload on `/`, `/plan`, and `/in-gym`: all 3 return HTTP `200` (`fromServiceWorker: true`), `pageErrors: []`, `<SignIn />` rendered (`276px x 44px`), `scrollWidth: 390` (`PASS`).
- **Speculative AI UI, Bundle Security & Healthz (`REQ-002`, `REQ-005`, `ADR-003`, `ADR-004`, Invariants 2 & 3):**
  - Client bundles (`/assets/index-D9ul6UEp.js` `339,427` bytes, `/assets/charts-CyQaC5Dm.js` `392,265` bytes, `/assets/firebase-auth-5xDtBWTY.js` `213,031` bytes, `/assets/firebase-firestore-CFeFN6hU.js` `348,086` bytes): **`0`** speculative AI UI strings, **`0`** `@google/genai` / `vertexai.googleapis.com` references, **`0`** GCP service-account secrets (`PRIVATE_KEY`, `client_secret`).
  - Confirmed `vibe-cabral` Firebase web config in `/assets/index-D9ul6UEp.js`: `VITE_FIREBASE_API_KEY` (`AIzaSy...` web key), `VITE_FIREBASE_AUTH_DOMAIN="vibe-cabral.firebaseapp.com"`, `VITE_FIREBASE_PROJECT_ID="vibe-cabral"`, `VITE_FIREBASE_APP_ID="1:280799742875:web:e47e00f1afcdab5e92af3e"`, `VITE_FIREBASE_ALLOWED_UID="iELlq0wRQhR2F5NmrM6pbMSrJuj1"`, `VITE_FIRESTORE_DATABASE_ID="marombapp"` (`PASS`).
  - `GET /api/healthz`: HTTP `200` JSON `{"status":"ok","revision":"marombapp-serving-00005-99q","firestoreDatabase":"marombapp","aiReady":true}` (`PASS`).

---

## 3. `#13` Deletion UI Touch-Target & Ergonomics Matrix (`390x844` — `dist-e2e` of `30e33c3`)

Audited in `/tmp/ui-audit-30e33c3` built with `vite.e2e.config.ts` (`localStorage` Firebase fakes, `0` requests to `vibe-cabral`, `pageErrorsTotal: 0`).

| Screen / Surface | Control | Bounding Box (`W x H` @ `x, y`) | `>=44x44` | Initial Viewport | Contrast (WCAG 2.1) | `scrollWidth` | Confirmation / Behavior | Result |
|---|---|---|---|---|---|---|---|---|
| `PlanDay` (newly created day) | `"Delete training day"` button | **`202.7 x 44`** @ `(171.3, 160)` | `true` | `true` (no scroll needed) | **`6.01:1`** (AA text) | `390` | `confirm('Delete training day "Mistake Day"?')` | **PASS** |
| `PlanDetailView` (`DayRow`) | Day trash button (`aria-label="Delete Push"`) | **`44 x 44`** @ `(314, 298)` | `true` | `true` | **`4.71:1`** (AA icon) | `390` | `confirm('Delete training day "Push"?')` | **PASS** |
| `PlanDetailView` (inline `Add Day`) | `"Cancel"` button | **`71.3 x 44`** @ `(226.8, 390)` | `true` | `true` | **`7.08:1`** (AAA text) | `390` | Closes inline input without creating day | **PASS** |
| `PlanDetailView` (inline `Add Day`) | `"Add"` submit button | **`55.9 x 44`** @ `(306.1, 390)` | `true` | `true` | **`6.07:1`** (AA text) | `390` | Creates day & opens `PlanDay` | **PASS** |
| `PlanDay` (exercise card) | `"Remove exercise"` (`X`) button | **`44 x 44`** @ `(314, 248)` | `true` | `true` | **`8.02:1`** (AAA icon) | `390` | `confirm('Remove "Bench Press" from "Push"?')` | **PASS** |
| `PlanListView` (inline `Create plan`) | `"Cancel"` button | **`71.3 x 44`** @ `(208.6, 180)` | `true` | `true` | **`7.08:1`** (AAA text) | `390` | Closes inline input without creating plan | **PASS** |
| `PlanDetailView` (header actions) | `"Delete plan"` button | **`142.1 x 44`** @ `(231.9, 161)` | `true` | `true` | **`6.01:1`** (AA text) | `390` | `confirm('Delete plan "Accidental Plan"? This cannot be undone.')` + deletes child days | **PASS** |
| `PlanListView` (`PlanRow`) | `"More"` (`⋮`) menu trigger | **`44 x 44`** @ `(314, 263)` | `true` | `true` | **`8.02:1`** (AAA icon) | `390` | Opens `Set Active / Rename / Archive / Delete` menu | **PASS** |
| `PlanListView` (`More` menu) | `"Delete"` danger menu item | **`174 x 44`** @ `(183, 444)` | `true` | `true` | **`6.10:1`** (AA text) | `390` | `confirm('Delete plan "<name>"? This cannot be undone.')` + deletes child days | **PASS** |
| `SessionDetail` (`completed` / `abandoned`) | `"Delete session"` button | **`167.5 x 44`** @ `(206.5, 88)` | `true` | `true` | **`6.01:1`** (AA text) | `390` | `confirm('Delete session "Mistake Push"? This cannot be undone.')` -> `/analytics` | **PASS** |
| `SessionDetail` (`active`) | `"Delete session"` button | *Not rendered (`count === 0`)* | — | — | — | `390` | Hidden while `status === 'active'` | **PASS** |
| `Library` (`ExerciseDetailSheet`, 66 seeds) | `Edit` / `Delete` buttons | *Not rendered (`count === 0`)* | — | — | — | `390` | Built-in 66 exercises stay read-only | **PASS** |
| `Library` (`ExerciseDetailSheet`, custom) | `"Delete"` button | **`176 x 44`** @ `(198, 800)` | `true` | `true` | **`5.77:1`** (AA text) | `390` | Opens inline `"Delete <name>? This cannot be undone."` | **PASS** |
| `Library` (`ExerciseDetailSheet`, step 2) | `"Cancel"` / `"Confirm"` buttons | **`162 x 44`** / **`162 x 44`** @ `y=787` | `true` | `true` | **`12.97:1`** / **`6.09:1`** | `390` | Two-step destructive confirmation | **PASS** |
| `InGym` (`ExerciseCard`) | `"Remove <Exercise>"` (`X`) button | **`44 x 44`** @ `(314, 496.5)` | `true` | `true` | **`3.61:1`** (AA UI icon) | `390` | `confirm('Remove Bench Press and its completed sets from this workout?')` (or without completed sets) | **PASS** |
| `InGym` (`ExerciseCard`) | `"Remove last set"` (`−`) button | **`44 x 44`** @ `(314, 935.5)` | `true` | Scrollable | **`4.47:1`** (AA UI icon) | `390` | Immediate undo if trailing set uncompleted; `confirm('Remove the last completed set?')` if completed | **PASS** |
| `InGym` (`ActiveSessionView`) | `"Abandon"` workout button | **`358 x 44`** @ `(16, 1584.5)` | `true` | Scrollable | **`4.59:1`** (AA text) | `390` | `confirm('Abandon this workout? Logged sets will be kept in history.')` | **PASS** |

---

## 4. Discoverability & End-to-End Deletion Flow Verification (`#13`)

- **Direct resolution of `#13` primary pain point (*"mistakenly created day within a training plan creation"*):**
  1. **Before creation:** Inline `Add Day` (and `Create plan`) now renders a dedicated `Cancel` button (`71.3px x 44px`) alongside `Add`/`Create` so mobile touch users without a hardware `Escape` key can abort inline creation in 1 tap.
  2. **Immediately after creation:** Submitting `Add Day` navigates into `PlanDay`, where a labeled secondary-danger `"Delete training day"` button (`202.7px x 44px` with `Trash2` icon) sits directly above the empty-day placeholder at `y = 160px` (`inInitialViewport: true`), requiring zero scrolling or back-navigation to discover.
  3. **From `PlanDetailView`:** Every `DayRow` exposes a `44px x 44px` trash button (`aria-label="Delete <day.name>"`), and the plan header exposes `"Delete plan"` (`142.1px x 44px`).
- **Referential integrity across views:** Deleting a plan or day leaves historical completed sessions intact in `/analytics`, `/sessions/:id`, and `InGym` last-3 progressive overload history (via denormalized `planName`/`dayName`), whereas deleting a finished session from `SessionDetail` immediately removes its volume/count from `/analytics` and excludes its sets from `InGym` pre-fill history.

---

## 5. Non-Blocking Pre-Existing / Adjacent Ergonomics Notes (Informational)

Per the audit brief's instruction to flag any button `< 44px` or unconfirmed action encountered while inspecting adjacent sheets/menus:

1. **Pre-existing `ExerciseFormSheet` & `BottomSheet` modal dismiss controls (`< 44px` height, untouched in `#13`):**
   - In `src/screens/library/ExerciseFormSheet.tsx` (`New exercise` / `Edit exercise` sheet), the `Cancel` and `Create`/`Save` buttons use `px-3 py-3` without `min-h-11`, rendering at **`175px x 40px`** (`4px` below `44px` height).
   - In `src/components/BottomSheet.tsx`, the top-right `Close dialog` (`X`) icon button uses `p-1.5` around `w-5 h-5`, rendering at **`32px x 32px`** (tapping the full-screen backdrop also dismisses the sheet).
   - Pre-existing non-deletion controls (`DayRow`/`PlanDay` `Move up`/`Move down` reorder arrows `28px x 28px`, `Library` header `+ Add` button `75.7px x 32px`, `SetRow` completion circle `40px x 40px`) remain unchanged per `REQ-002` as-is visual parity.
2. **Pre-existing `PlanListView` `More -> Archive` (`174px x 44px`):**
   - `Archive` soft-archives a plan immediately (`archivedAt = Date.now()`) without a `confirm()` prompt and the app has no archived-plans restore screen, whereas `#13`'s new `More -> Delete` item right below it prompts `confirm('Delete plan "<name>"? This cannot be undone.')`. Because `Archive` is pre-existing as-is behavior (`REQ-002`), this is informational only and not a regression.
